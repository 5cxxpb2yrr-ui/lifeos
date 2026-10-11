"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LifeOSDatabase } from "@/domain/contracts/database";
import { resolveCashForecast } from "@/domain/resolvers/cash-forecast";

function money(minor: number) {
  return (minor / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
}
function dateLabel(date: string) {
  return new Date(date + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric",
  });
}
function monthLabel(date: string) {
  return new Date(date + "T12:00:00").toLocaleDateString(undefined, {
    month: "long", year: "numeric",
  });
}
function weekday(date: string) {
  return new Date(date + "T12:00:00").getDay();
}
function dayNumber(date: string) {
  return new Date(date + "T12:00:00").getDate();
}

export default function CashForecastCalendar({ db }: { db: LifeOSDatabase }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [baseline, setBaseline] = useState<{ date: string; closingBalanceMinor: number } | null>(null);
  const dayRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const forecast = useMemo(() => resolveCashForecast(db, { horizonDays: 30 }), [db]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ date?: string }>).detail;
      if (!detail?.date) return;
      returnFocusRef.current = dayRefs.current[detail.date] ?? (document.activeElement as HTMLElement | null);
      setSelectedDate(detail.date);
      requestAnimationFrame(() => dayRefs.current[detail.date!]?.scrollIntoView({ behavior: "smooth", block: "center" }));
    };
    const baselineHandler = (event: Event) => {
      const detail = (event as CustomEvent<{ date?: string }>).detail;
      if (!detail?.date) return;
      const point = forecast.points.find((candidate) => candidate.date === detail.date);
      if (point) setBaseline({ date: detail.date, closingBalanceMinor: point.closingBalanceMinor });
    };
    window.addEventListener("lifeos:cash-forecast-day", handler);
    window.addEventListener("lifeos:cash-forecast-baseline", baselineHandler);
    return () => {
      window.removeEventListener("lifeos:cash-forecast-day", handler);
      window.removeEventListener("lifeos:cash-forecast-baseline", baselineHandler);
    };
  }, [forecast]);

  const selected = forecast.points.find((point) => point.date === selectedDate);
  const months = useMemo(() => {
    const groups = new Map<string, typeof forecast.points>();
    for (const point of forecast.points) {
      const key = point.date.slice(0, 7);
      const group = groups.get(key);
      if (group) group.push(point);
      else groups.set(key, [point]);
    }
    return Array.from(groups.entries()).map(([key, points]) => {
      const offset = weekday(points[0].date);
      const cells: Array<{ key: string; point: (typeof forecast.points)[number] | null }> = [
        ...Array.from({ length: offset }, (_, index) => ({ key: key + "-leading-" + index, point: null })),
        ...points.map((point) => ({ key: point.date, point })),
      ];
      const trailing = (7 - (cells.length % 7)) % 7;
      cells.push(...Array.from({ length: trailing }, (_, index) => ({
        key: key + "-trailing-" + index, point: null,
      })));
      return { key, label: monthLabel(points[0].date), cells };
    });
  }, [forecast.points]);

  useEffect(() => {
    if (!selected) return;
    const dialog = dialogRef.current;
    const previousFocus = returnFocusRef.current ?? (document.activeElement as HTMLElement | null);
    const focusable = () => dialog?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setSelectedDate(null);
        return;
      }
      if (event.key !== "Tab") return;
      const items = Array.from(focusable() ?? []);
      if (!items.length) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    requestAnimationFrame(() => closeButtonRef.current?.focus());
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (!selectedDate) requestAnimationFrame(() => previousFocus?.focus());
    };
  }, [selectedDate, selected]);

  const closeDetails = () => setSelectedDate(null);
  const selectDay = (date: string, trigger?: HTMLButtonElement | null) => {
    if (trigger) returnFocusRef.current = trigger;
    if (baseline?.date !== date) setBaseline(null);
    setSelectedDate(date);
  };

  return (
    <section className="card cash-forecast-calendar">
      <div className="section-title">
        <div><div className="kicker">Finance / Cash Forecast</div><h2>Daily Cash Calendar</h2></div>
        <span className="badge">{forecast.points.length} days</span>
      </div>
      <div className="row-meta">Tap a day to inspect opening cash, projected activity, closing balance, and underlying obligations.</div>
      <div className="cash-calendar-summary">
        <div><span className="kicker">Starting</span><strong>{money(forecast.startingBalanceMinor)}</strong></div>
        <div><span className="kicker">Lowest</span><strong>{money(forecast.lowestBalanceMinor)}</strong><small>{dateLabel(forecast.lowestBalanceDate)}</small></div>
        <div><span className="kicker">Ending</span><strong>{money(forecast.endingBalanceMinor)}</strong></div>
      </div>
      {months.map((month) => (
        <div className="cash-calendar-month-section" key={month.key}>
          <div className="cash-calendar-month">{month.label}</div>
          <div className="cash-calendar-grid" role="grid" aria-label={month.label + " cash forecast calendar"}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div className="cash-calendar-weekday" role="columnheader" key={day}>{day}</div>
            ))}
            {month.cells.map(({ key, point }) => point ? (
              <button
                key={key}
                ref={(element) => { dayRefs.current[point.date] = element; }}
                type="button"
                role="gridcell"
                aria-label={dateLabel(point.date) + ", closing " + money(point.closingBalanceMinor)}
                aria-pressed={selectedDate === point.date}
                className={"cash-calendar-cell " + (selectedDate === point.date ? "selected " : "") + (point.closingBalanceMinor < 0 ? "negative" : "")}
                onClick={(event) => selectDay(point.date, event.currentTarget)}
              >
                <span className="cash-calendar-cell-date">{dayNumber(point.date)}</span>
                <strong>{money(point.closingBalanceMinor)}</strong>
                <span className="cash-calendar-cell-markers">
                  {point.incomeMinor > 0 && <span className="cash-calendar-payday">+{money(point.incomeMinor)}</span>}
                  {point.outflowMinor > 0 && <span className="cash-calendar-activity">−{money(point.outflowMinor)}</span>}
                </span>
              </button>
            ) : (
              <div key={key} className="cash-calendar-cell empty" aria-hidden="true" />
            ))}
          </div>
        </div>
      ))}
      <div className="cash-calendar-legend"><span><i className="cash-calendar-legend-dot" />Closing balance</span><span>Tap a date for details</span></div>
      {selected && (
        <div className="cash-calendar-modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeDetails();
        }}>
          <section
            ref={(element) => { dialogRef.current = element; }}
            className="cash-calendar-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cash-calendar-modal-title"
            tabIndex={-1}
          >
            <div className="cash-calendar-modal-header">
              <div><div className="kicker">Daily Cash Detail</div><h3 id="cash-calendar-modal-title">{dateLabel(selected.date)}</h3></div>
              <button ref={closeButtonRef} type="button" className="cash-calendar-close" aria-label="Close day details" onClick={closeDetails}>×</button>
            </div>
            <div className="cash-calendar-balance-row"><span>Opening balance</span><strong>{money(selected.openingBalanceMinor)}</strong></div>
            <div className="cash-calendar-flow-grid">
              <div><span>Income</span><strong>{money(selected.incomeMinor)}</strong></div>
              <div><span>Bills</span><strong>{money(selected.billMinor)}</strong></div>
              <div><span>Loan payments</span><strong>{money(selected.loanPaymentMinor)}</strong></div>
              <div><span>Other</span><strong>{money(selected.otherExpenseMinor)}</strong></div>
            </div>
            <div className="cash-calendar-balance-row closing"><span>Closing balance</span><strong>{money(selected.closingBalanceMinor)}</strong></div>
            {baseline?.date === selected.date && (
              <div className="notice">Change since edit: {money(selected.closingBalanceMinor - baseline.closingBalanceMinor)}</div>
            )}
            {selected.sources.length > 0 ? (
              <div className="cash-calendar-obligations">
                <div className="kicker">Underlying obligations</div>
                {selected.sources.map((source) => (
                  <button type="button" className="row entity-row" key={source.type + source.id} onClick={() => {
                    if (source.type === "bill" || source.type === "loan_payment") {
                      window.dispatchEvent(new CustomEvent("lifeos:edit", { detail: {
                        id: source.id,
                        type: source.type === "bill" ? "recurring_rule" : "loan_payment",
                        forecastDate: selected.date,
                        amountMinor: source.amountMinor,
                      } }));
                    } else {
                      window.dispatchEvent(new CustomEvent("lifeos:navigate", { detail: { kind: "event", id: source.id } }));
                    }
                    closeDetails();
                  }}>
                    <div className="row-main">
                      <div className="row-title">{source.label}</div>
                      <div className="row-meta">{source.type.replaceAll("_", " ")} · {money(source.amountMinor)}</div>
                    </div>
                    <span className="queue-count">›</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="row-meta">
                {selected.incomeMinor > 0 || selected.outflowMinor > 0
                  ? "Forecast activity exists, but no linked source records are available for this day."
                  : "No scheduled income or obligations recorded for this day."}
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
