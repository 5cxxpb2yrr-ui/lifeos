"use client";

import { useMemo, useRef, useState } from "react";
import type { LifeOSDatabase, TransactionImportBatch } from "@/domain/contracts/database";
import { parseConnectedTransactions, summarizeTransactions, type TransactionInput } from "@/domain/resolvers/transaction-intelligence";

type Props = { db: LifeOSDatabase; onPersist: (next: LifeOSDatabase, message: string) => Promise<void> | void };

function parseCsv(text: string): TransactionInput[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) throw new Error("CSV needs a header row and at least one transaction.");
  const cells = (line: string) => {
    const values: string[] = []; let value = ""; let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' && quoted && line[i + 1] === '"') { value += '"'; i++; }
      else if (char === '"') quoted = !quoted;
      else if (char === "," && !quoted) { values.push(value.trim()); value = ""; }
      else value += char;
    }
    values.push(value.trim()); return values;
  };
  const headers = cells(lines[0]).map(x => x.toLowerCase().replace(/[\s-]+/g, "_"));
  return lines.slice(1).map(line => {
    const values = cells(line); const row: Record<string, unknown> = {};
    headers.forEach((key, i) => { row[key] = values[i] ?? ""; });
    if (row.amount !== undefined) row.amount = Number(String(row.amount).replace(/[$,]/g, ""));
    if (row.amountminor !== undefined) row.amountMinor = Number(row.amountminor);
    if (row.pending !== undefined) row.pending = String(row.pending).toLowerCase() === "true";
    return row as TransactionInput;
  });
}

function parseInput(raw: string, format: "json" | "csv"): TransactionInput[] {
  if (format === "csv") return parseCsv(raw);
  const parsed: unknown = JSON.parse(raw);
  if (Array.isArray(parsed)) return parsed as TransactionInput[];
  if (parsed && typeof parsed === "object") {
    const value = parsed as Record<string, unknown>;
    if (Array.isArray(value.transactions)) return value.transactions as TransactionInput[];
    if (Array.isArray(value.data)) return value.data as TransactionInput[];
    if (value.data && typeof value.data === "object" && Array.isArray((value.data as Record<string, unknown>).transactions)) return (value.data as Record<string, unknown>).transactions as TransactionInput[];
  }
  throw new Error("Use a JSON array, an object containing a transactions array, or CSV with a header row.");
}

function fingerprint(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) { hash ^= value.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return "fnv1a32-" + (hash >>> 0).toString(16).padStart(8, "0");
}

export default function TransactionImportCenter({ db, onPersist }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [raw, setRaw] = useState("");
  const [format, setFormat] = useState<"json" | "csv">("json");
  const [sourceName, setSourceName] = useState("Manual import");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const parsed = useMemo(() => {
    if (!raw.trim()) return { rows: [] as TransactionInput[], parsed: [], summary: null, error: "" };
    try {
      const rows = parseInput(raw, format);
      const transactions = parseConnectedTransactions(rows);
      return { rows, parsed: transactions, summary: summarizeTransactions(transactions), error: "" };
    } catch (e) {
      return { rows: [] as TransactionInput[], parsed: [], summary: null, error: e instanceof Error ? e.message : "Could not parse the import." };
    }
  }, [raw, format]);
  const money = (minor: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(minor / 100);
  const history = db.transactionImports ?? [];
  const sourceHash = raw.trim() ? fingerprint(format + ":" + raw) : "";
  const duplicate = Boolean(sourceHash && history.some(item => item.sourceFingerprint === sourceHash));
  async function saveSummary() {
    if (!parsed.summary || !parsed.parsed.length || duplicate || parsed.error) return;
    setBusy(true); setError("");
    const now = new Date().toISOString();
    const batch: TransactionImportBatch = {
      id: "txn-import-" + crypto.randomUUID(), entityType: "transaction_import_batch",
      createdAt: now, updatedAt: now, source: format === "csv" ? "manual-csv" : "manual-json",
      status: "analyzed", summary: structuredClone(parsed.summary) as unknown as Record<string, unknown>, sourceFingerprint: sourceHash,
      rawTransactionsPersisted: false, notes: sourceName.trim() || "Manual import"
    };
    const next = structuredClone(db);
    next.transactionImports = [...(next.transactionImports ?? []), batch];
    try {
      await onPersist(next, `Transaction analysis saved: ${batch.summary.transactionCount} parsed rows summarized. Individual rows were not retained; no ledger or forecast changes were made.`);
      setRaw("");
    } catch { setError("Could not save the summary. The current database was left unchanged."); }
    finally { setBusy(false); }
  }
  function loadFile(file: File) {
    const isCsv = file.name.toLowerCase().endsWith(".csv");
    file.text().then(text => { setFormat(isCsv ? "csv" : "json"); setSourceName(file.name); setRaw(text); setError(""); }).catch(() => setError("Could not read the selected file."));
  }
  return <section className="card transaction-import-center">
    <div className="section-title"><div><div className="kicker">Finance / Data Management</div><h2>Transaction Import &amp; Archive</h2><div className="row-meta">Source-independent intake · Plaid is optional</div></div><span className="badge">{history.length} summaries</span></div>
    <p className="row-meta">Paste or load transaction JSON/CSV from any provider. LifeOS parses dates, amounts, direction, transfers, pending status, categories, and review signals locally. Saving stores only a summary and import metadata—not individual rows. It does not add canonical transactions or alter your forecast.</p>
    <div className="field-grid">
      <label className="field-label">Input format<select className="command-input" value={format} onChange={e => setFormat(e.target.value as "json" | "csv")}><option value="json">JSON</option><option value="csv">CSV</option></select></label>
      <label className="field-label">Import label<input className="command-input" value={sourceName} onChange={e => setSourceName(e.target.value)} placeholder="Bank statement, manual export, etc."/></label>
    </div>
    <input ref={fileRef} hidden type="file" accept=".json,.csv,application/json,text/csv" onChange={e => { const file = e.currentTarget.files?.[0]; if (file) loadFile(file); e.currentTarget.value = ""; }} />
    <button className="action" type="button" onClick={() => fileRef.current?.click()}>Load JSON / CSV file</button>
    <label className="field-label">Transaction data<textarea className="command-input capture-body" rows={6} value={raw} onChange={e => setRaw(e.target.value)} placeholder={format === "json" ? '[{"date":"2026-10-01","amount":-2500,"name":"PAYROLL","transaction_id":"..."}]' : "date,amount,name,transaction_id\n2026-10-01,-2500,PAYROLL,..."}/></label>
    {parsed.error && <div className="notice" role="status">{parsed.error}</div>}
    {parsed.summary && <div className="transaction-intelligence-preview" aria-live="polite">
      <div className="section-title"><div><div className="kicker">Review before saving</div><h3>Import analysis</h3></div><span className="badge">Preview only</span></div>
      <div className="transaction-summary-grid">
        <div><span className="row-meta">Rows received</span><strong>{parsed.rows.length}</strong></div>
        <div><span className="row-meta">Parsed</span><strong>{parsed.summary.transactionCount}</strong></div>
        <div><span className="row-meta">Money in</span><strong>{money(parsed.summary.inflowMinor)}</strong></div>
        <div><span className="row-meta">Money out</span><strong>{money(parsed.summary.outflowMinor)}</strong></div>
        <div><span className="row-meta">Transfers</span><strong>{money(parsed.summary.transferMinor)}</strong></div>
        <div><span className="row-meta">Net flow</span><strong>{money(parsed.summary.netFlowMinor)}</strong></div>
        <div><span className="row-meta">Pending</span><strong>{parsed.summary.pendingCount}</strong></div>
        <div><span className="row-meta">Review signals</span><strong>{parsed.summary.recommendations.length}</strong></div>
      </div>
      <div className="row-meta">Categories: {parsed.summary.categoryTotals.length ? parsed.summary.categoryTotals.map(item => item.category + " · " + item.direction + " · " + money(item.totalMinor)).join(" | ") : "No categorized inflows or outflows."}</div>
      {parsed.summary.recommendations.length > 0 && <div className="list">{parsed.summary.recommendations.slice(0, 8).map(item => <div className="row" key={item.id}><div className="row-main"><div className="row-title">{item.title}</div><div className="row-meta">{item.explanation}</div></div></div>)}</div>}
      {duplicate && <div className="notice">This exact input was already summarized. Duplicate save is blocked.</div>}
      <button className="action primary" type="button" disabled={busy || !parsed.parsed.length || duplicate || Boolean(parsed.error)} onClick={() => void saveSummary()}>{busy ? "Saving summary…" : "Save summary only"}</button>
    </div>}
    {error && <div className="notice" role="status">{error}</div>}
    <div className="data-preview"><div className="section-title"><div><div className="kicker">Saved import history</div><h3>Summary records</h3></div><span className="badge">{history.length}</span></div>
      {history.length ? <div className="list">{history.slice().sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10).map(item => <div className="row" key={item.id}><div className="row-main"><div className="row-title">{item.notes || item.source} · {String(item.summary.transactionCount ?? 0)} rows</div><div className="row-meta">{item.createdAt} · {item.status} · raw rows not retained</div></div></div>)}</div> : <div className="row-meta">No transaction import summaries saved yet.</div>}
    </div>
  </section>;
}
