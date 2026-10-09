"use client";
import { useState } from "react";
import type { LifeOSDatabase } from "@/domain/contracts/database";
import { importPayrollDeposits, isLikelyPayrollDeposit, type ConnectedTransactionRecord } from "@/domain/resolvers/payroll-deposits";

type QueuedDeposit = {
  id: string; postedDate: string; amountMinor: number; description: string;
  currency: "USD"; status: "pending" | "imported"; receivedAt: string;
};
export default function UsaaEmailDepositQueue({ db, onPersist }: {
  db: LifeOSDatabase;
  onPersist: (next: LifeOSDatabase, message: string) => Promise<void> | void;
}) {
  const [items, setItems] = useState<QueuedDeposit[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function refresh() {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/usaa-bridge/v1/deposits?status=pending&limit=100", { cache: "no-store" });
      const body = await response.json() as { deposits?: QueuedDeposit[]; error?: string };
      if (!response.ok) throw new Error(body.error || "Could not load pending deposits.");
      setItems(Array.isArray(body.deposits) ? body.deposits : []);
      setMessage("Queue refreshed.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Queue refresh failed.");
    } finally { setBusy(false); }
  }
  async function importPending() {
    setBusy(true); setError(""); setMessage("");
    try {
      if (!items.length) throw new Error("No pending deposits to import. Refresh the queue first.");
      const eligible = items.filter((item) => isLikelyPayrollDeposit({ name: item.description, amount: -(item.amountMinor / 100), pending: false }));
      if (!eligible.length) throw new Error("No pending item matches a payroll deposit. Nothing was imported or acknowledged; check the alert description and resolver match rules.");
      const rows: ConnectedTransactionRecord[] = eligible.map((item) => ({
        transaction_id: "usaa-email:" + item.id,
        date: item.postedDate,
        // Existing resolver convention: negative provider amount represents income.
        amount: -(item.amountMinor / 100),
        name: item.description,
        merchant_name: item.description,
        currency: item.currency,
        pending: false,
      }));
      const result = importPayrollDeposits(db, rows, new Date().toISOString());
      if (result.imported === 0 && result.duplicates === 0) throw new Error("No eligible deposits could be imported. The queue was left unchanged.");
      const next = structuredClone(db);
      if (result.account && !next.accounts.some((account) => account.id === result.account!.id)) next.accounts.push(result.account);
      next.transactions.push(...result.transactions);
      if (result.imported > 0) await onPersist(next, `USAA email bridge: ${result.imported} deposit(s) imported; ${result.duplicates} duplicate(s) skipped. Historical deposits do not change the current cash balance.`);
      // Acknowledgement follows local persistence. If acknowledgement fails, a retry is safe because transaction IDs deduplicate.
      const failures: string[] = [];
      for (const item of eligible) {
        try {
          const response = await fetch("/api/usaa-bridge/v1/deposits/" + item.id + "/ack", {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "imported" }), cache: "no-store",
          });
          if (!response.ok) failures.push(item.id);
        } catch { failures.push(item.id); }
      }
      const acknowledged = new Set(eligible.map((item) => item.id).filter((id) => !failures.includes(id)));
      setItems((current) => current.filter((item) => !acknowledged.has(item.id)));
      setMessage(`Import complete: ${result.imported} added, ${result.duplicates} already present. ${failures.length ? failures.length + " acknowledgement(s) need retry." : "Eligible queue items acknowledged."} ${items.length - eligible.length} non-payroll item(s) left pending.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Deposit import failed.");
    } finally { setBusy(false); }
  }
  return <section className="card payroll-deposit-import">
    <div className="section-title"><div><div className="kicker">Finance / Automated Intake</div><h2>USAA Email Deposit Queue</h2></div><span className="badge">{items.length} pending</span></div>
    <p className="row-meta">Review deposits received by your iPhone Shortcut, then import them into LifeOS. Importing is duplicate-safe and does not add historical deposits to the current cash balance.</p>
    <div className="tool-actions">
      <button className="action" type="button" onClick={() => void refresh()} disabled={busy}>{busy ? "Working…" : "Refresh queue"}</button>
      <button className="action primary" type="button" onClick={() => void importPending()} disabled={busy || !items.length}>Import pending deposits</button>
    </div>
    {error && <div className="notice">{error}</div>}
    {message && <div className="row-meta" role="status">{message}</div>}
    {items.length > 0 && <div className="list">{items.map((item) => <div className="row entity-row" key={item.id}>
      <div className="row-main"><div className="row-title">{item.description}</div><div className="row-meta">{item.postedDate} · Received {new Date(item.receivedAt).toLocaleString()}</div></div>
      <strong>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(item.amountMinor / 100)}</strong>
    </div>)}</div>}
    {!items.length && <div className="row-meta">Tap Refresh queue to check for new deposit alerts.</div>}
  </section>;
}
