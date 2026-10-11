"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { calculateStandardBiweeklyPayroll } from "@/domain/payroll/payroll-calculator";
import {
  reconcileExpectedPaycheckEvent,
  upsertExpectedPaycheckEvent,
} from "@/domain/payroll/payroll-cashflow";
import type { Event, FinancialTransaction } from "@/domain/contracts/database";
import { loadLocalDatabase, saveLocalDatabase } from "@/storage/indexeddb/database";
import FloatingLifeOSMenu from "@/components/mission-control/FloatingLifeOSMenu";

const money = (minor: unknown) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    typeof minor === "number" && Number.isFinite(minor) ? minor / 100 : 0,
  );
const localDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const addDays = (date: string, count: number) => {
  const value = new Date(date + "T12:00:00.000Z");
  value.setUTCDate(value.getUTCDate() + count);
  return value.toISOString().slice(0, 10);
};
const currentPaySchedule = (today = localDateString(new Date())) => {
  // User-confirmed payday anchor: Tuesday, October 27, 2026. Keep the
  // biweekly cadence tied to payday rather than assuming a Friday deposit.
  const anchorPayDate = "2026-10-27";
  const toDayNumber = (value: string) => Math.floor(Date.parse(value + "T00:00:00.000Z") / 86_400_000);
  const daysFromAnchor = toDayNumber(today) - toDayNumber(anchorPayDate);
  const pay = daysFromAnchor <= 0
    ? anchorPayDate
    : addDays(anchorPayDate, Math.ceil(daysFromAnchor / 14) * 14);
  const start = addDays(pay, -18);
  const end = addDays(start, 13);
  return { payDate: pay, periodStart: start, periodEnd: end };
};
const payrollEvents = (events: Event[]) =>
  events.filter((e) => e.source === "payroll_forecast" && e.eventType === "income");

export default function PayrollForecastPage() {
  const [db, setDb] = useState<Awaited<ReturnType<typeof loadLocalDatabase>>>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [payDate, setPayDate] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [netOverride, setNetOverride] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedTransactions, setSelectedTransactions] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const loaded = await loadLocalDatabase();
      setDb(loaded);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load LifeOS local data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    const schedule = currentPaySchedule();
    setPayDate(schedule.payDate);
    setPeriodStart(schedule.periodStart);
    setPeriodEnd(schedule.periodEnd);
  }, [reload]);

  const estimate = useMemo(() => calculateStandardBiweeklyPayroll(), []);
  const netCents = netOverride.trim() === ""
    ? estimate.estimatedNetPayCents
    : Math.round(Number(netOverride) * 100);
  const transactions = (db?.transactions ?? []).filter(
    (t: FinancialTransaction) =>
      (t.transactionType === "income" || t.transactionType === "refund") &&
      !t.eventId,
  );
  const projections = payrollEvents(db?.events ?? []);

  const saveProjection = async () => {
    if (!db) return;
    if (!Number.isSafeInteger(netCents) || netCents < 0) {
      setMessage("Enter a valid non-negative estimated net amount.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const updated = upsertExpectedPaycheckEvent(db, {
        id: `expected-paycheck-${payDate}`,
        payDate,
        payPeriodStart: periodStart,
        payPeriodEnd: periodEnd,
        calculation: { estimatedNetPayCents: netCents, grossPayCents: estimate.grossPayCents },
        title: "Expected paycheck",
      });
      await saveLocalDatabase(updated);
      setDb(updated);
      setMessage("Paycheck projection saved to the local LifeOS database.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save paycheck projection.");
    } finally {
      setBusy(false);
    }
  };

  const reconcile = async (eventId: string) => {
    if (!db) return;
    const transactionId = selectedTransactions[eventId];
    if (!transactionId) {
      setMessage("Choose an imported income deposit to reconcile.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const updated = reconcileExpectedPaycheckEvent(db, eventId, transactionId);
      await saveLocalDatabase(updated);
      setDb(updated);
      setMessage("Reconciled. The actual deposit is linked and the projection is completed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not reconcile deposit.");
    } finally {
      setBusy(false);
    }
  };

  const inputClass = "mt-1 w-full rounded-xl border border-white/15 bg-[#0b1020] px-3 py-3 text-sm text-[#edf4ff] outline-none focus:border-cyan-400";
  const labelClass = "block text-xs font-semibold uppercase tracking-wide text-slate-400";

  return (
    <main className="payroll-forecast-page min-h-screen bg-[#080b14] px-4 py-6 pb-28 text-[#edf4ff] sm:px-6">
      <div className="payroll-forecast-layout mx-auto max-w-4xl space-y-5">
        <nav className="payroll-top-nav" aria-label="LifeOS finance navigation">
          <a href="/" className="payroll-brand"><span className="payroll-brand-mark">L</span><span>LIFEOS <small>/ FINANCE</small></span></a>
          <div className="payroll-nav-links"><a href="/">Mission Control</a><a href="/payroll">Payroll Calculator</a><a href="/payroll/forecast" aria-current="page">Payroll Forecast</a></div>
        </nav>
        <header className="payroll-hero">
          <div className="payroll-hero-copy"><p className="payroll-eyebrow"><span className="payroll-live-dot" /> CASH FLOW PLANNING · BIWEEKLY</p>
            <h1>Payroll <span>Forecast</span></h1>
            <p>Turn your next paycheck into a cash-flow event. Project net pay, carry it into your forecast, and reconcile it when the real deposit arrives.</p>
          </div>
          <div className="payroll-hero-mark" aria-hidden="true"><span>$</span><i>↗</i></div>
        </header>
        <section className="payroll-stat-strip" aria-label="Forecast overview"><div><span>PAY CYCLE</span><strong>Biweekly</strong><small>14-day period</small></div><div><span>NET PAY</span><strong>{money(netCents)}</strong><small>Current projection</small></div><div><span>RECONCILIATION</span><strong>{projections.filter((event) => event.status === "completed" || event.metadata?.reconciliationState === "reconciled").length} / {projections.length}</strong><small>Deposits matched</small></div></section>

        {message && <div role="status" className="rounded-xl border border-[#ff6a00]/35 bg-[#ff6a00]/10 p-3 text-sm">{message}</div>}
        {loading && <p className="rounded-2xl border border-white/10 p-4 text-sm text-slate-400">Loading local LifeOS data…</p>}
        {loadError && <div className="rounded-2xl border border-rose-400/30 p-4 text-sm text-rose-200">{loadError} <button onClick={() => void reload()} className="ml-2 underline">Retry</button></div>}
        {!loading && !loadError && !db && (
          <section className="rounded-2xl border border-amber-300/30 bg-amber-300/5 p-4">
            <h2 className="font-semibold text-amber-200">LifeOS has not been initialized in this browser</h2>
            <p className="mt-2 text-sm text-slate-300">Open Mission Control and initialize/load your existing LifeOS data first. This screen will not create an empty database or replace your seed.</p>
            <a className="mt-3 inline-block underline" href="/">Open Mission Control</a>
          </section>
        )}

        {!loading && !loadError && db && (
          <>
            <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold">Schedule expected paycheck</h2>
                <span className="rounded-full bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-200">Estimate</span>
              </div>
              <p className="mt-2 text-sm text-slate-400">Pay dates are prefilled from your confirmed October 27, 2026 payday and continue every 14 days. The form selects the next payday and its matching 14-day pay period. You can still adjust dates if payroll changes.</p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className={labelClass}>Pay date<input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className={inputClass} /></label>
                <label className={labelClass}>Estimated net pay (USD)<input inputMode="decimal" type="number" min="0" step="0.01" placeholder={(estimate.estimatedNetPayCents / 100).toFixed(2)} value={netOverride} onChange={(e) => setNetOverride(e.target.value)} className={inputClass} /></label>
                <label className={labelClass}>Pay period start<input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className={inputClass} /></label>
                <label className={labelClass}>Pay period end<input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className={inputClass} /></label>
              </div>
              <div className="mt-4 rounded-xl border border-[#ffd54f]/25 bg-[#ffd54f]/5 p-3">
                <div className="text-xs text-slate-400">Projected net amount used by cash forecast</div>
                <div className="mt-1 text-2xl font-bold text-[#ffd54f]">{money(netCents)}</div>
                <div className="mt-1 text-xs text-slate-500">Gross estimate: {money(estimate.grossPayCents)} · Net projection, not actual income</div>
              </div>
              <button disabled={busy} onClick={() => void saveProjection()} className="mt-4 w-full rounded-xl bg-gradient-to-r from-[#ff6a00] to-[#ffd54f] px-4 py-3 font-bold text-[#080b14] disabled:opacity-50">Save paycheck projection</button>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold">Projected paychecks</h2>
                <span className="text-xs text-slate-400">{projections.length} saved</span>
              </div>
              {projections.length === 0 ? <p className="mt-3 text-sm text-slate-400">No expected paycheck Events yet.</p> : (
                <div className="mt-3 space-y-3">
                  {projections.map((event) => {
                    const reconciled = event.status === "completed" || event.metadata?.reconciliationState === "reconciled";
                    const date = String(event.metadata?.payDate ?? event.dueAt ?? "").slice(0, 10);
                    const amount = event.metadata?.amountMinor;
                    return <article key={event.id} className="rounded-xl border border-white/10 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div><h3 className="font-semibold">{event.title}</h3><p className="mt-1 text-sm text-slate-400">{date} · {event.id}</p></div>
                        <div className="text-right"><div className="font-bold">{money(amount)}</div><div className={`mt-1 text-xs ${reconciled ? "text-emerald-300" : "text-amber-200"}`}>{reconciled ? "Actual deposit linked" : "Projected"}</div></div>
                      </div>
                      {!reconciled && <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <select value={selectedTransactions[event.id] ?? ""} onChange={(e) => setSelectedTransactions((old) => ({ ...old, [event.id]: e.target.value }))} className={inputClass}>
                          <option value="">Select imported income deposit…</option>
                          {transactions.map((t) => <option key={t.id} value={t.id}>{t.transactionDate} · {t.description || t.id} · {money(t.amountMinor)}</option>)}
                        </select>
                        <button disabled={busy || transactions.length === 0} onClick={() => void reconcile(event.id)} className="rounded-xl border border-[#ffd54f]/40 px-4 py-3 text-sm font-semibold text-[#ffd54f] disabled:opacity-40">Reconcile</button>
                      </div>}
                    </article>;
                  })}
                </div>
              )}
            </section>
          </>
        )}
        <p className="text-xs leading-relaxed text-slate-500">Local-first: writes through LifeOS IndexedDB integrity validation. The forecast uses estimated net pay rather than gross. Once reconciled, the imported bank transaction is authoritative; the completed projection should not be counted as a second inflow. Tax and net-pay figures are estimates until matched to an actual deposit.</p>
      </div>
      <FloatingLifeOSMenu />
    </main>
  );
}
