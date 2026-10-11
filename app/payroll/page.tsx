"use client";

import { useMemo, useState } from "react";
import { calculatePayroll } from "../../domain/payroll/payroll-calculator";

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const fieldStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box", background: "#101626", color: "#edf4ff", border: "1px solid rgba(255,255,255,.16)", borderRadius: 10, padding: "11px 12px", fontSize: 16 };
const labelStyle: React.CSSProperties = { display: "block", color: "#aab6cb", fontSize: 12, marginBottom: 6 };
const cardStyle: React.CSSProperties = { background: "rgba(255,255,255,.045)", border: "1px solid rgba(255,255,255,.10)", borderRadius: 16, padding: 16, minWidth: 0 };
type NumericKey = "baseRate" | "regularHours" | "overtimeHours" | "doubleTimeHours" | "ptoHours" | "holidayBankHoursUsed" | "bankedWeekdayHolidayCount" | "bonusDollars" | "flatGrossDollars" | "pretaxDollars" | "postTaxDollars" | "federalRate" | "georgiaRate" | "children";
const defaults: Record<NumericKey, number> = {
  baseRate: 41.64, regularHours: 72, overtimeHours: 0, doubleTimeHours: 12, ptoHours: 0, holidayBankHoursUsed: 0,
  bankedWeekdayHolidayCount: 0, bonusDollars: 0, flatGrossDollars: 0, pretaxDollars: 0, postTaxDollars: 0,
  federalRate: 10, georgiaRate: 5, children: 2,
};
export default function PayrollCalculatorPage() {
  const [values, setValues] = useState(defaults);
  const [filingStatus, setFilingStatus] = useState<"married_filing_jointly" | "single" | "head_of_household">("married_filing_jointly");
  const update = (key: NumericKey, value: string) => {
    setValues((current) => ({ ...current, [key]: value === "" ? 0 : Math.max(0, Number(value) || 0) }));
  };
  const result = useMemo(() => calculatePayroll({
    baseHourlyRateCents: Math.round(values.baseRate * 100),
    regularHours: values.regularHours, overtimeHours: values.overtimeHours, doubleTimeHours: values.doubleTimeHours,
    ptoHours: values.ptoHours, holidayBankHoursUsed: values.holidayBankHoursUsed,
    bankedWeekdayHolidayCount: Math.floor(values.bankedWeekdayHolidayCount),
    bonuses: values.bonusDollars > 0 ? [{ id: "bonus", label: "Bonus", amountCents: Math.round(values.bonusDollars * 100) }] : [],
    flatGrossEntries: values.flatGrossDollars > 0 ? [{ id: "flat-gross", label: "Flat gross entry", amountCents: Math.round(values.flatGrossDollars * 100) }] : [],
    pretaxDeductionsCents: Math.round(values.pretaxDollars * 100),
    postTaxDeductionsCents: Math.round(values.postTaxDollars * 100),
    filingStatus, qualifyingChildrenUnder17: Math.floor(values.children),
    taxConfig: { federalWithholdingRate: values.federalRate / 100, georgiaWithholdingRate: values.georgiaRate / 100 },
  }), [values, filingStatus]);
  const numberField = (key: NumericKey, label: string, step = "1", hint?: string) => (
    <label key={key} style={{ display: "block" }}>
      <span style={labelStyle}>{label}</span>
      <input aria-label={label} type="number" min="0" step={step} value={values[key]} onChange={(event) => update(key, event.target.value)} style={fieldStyle} />
      {hint ? <span style={{ display: "block", color: "#74839c", fontSize: 11, marginTop: 5 }}>{hint}</span> : null}
    </label>
  );
  const line = (label: string, value: number, strong = false) => (
    <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,.07)", fontWeight: strong ? 700 : 400 }}>
      <span style={{ color: strong ? "#edf4ff" : "#aab6cb" }}>{label}</span><span style={{ color: strong ? "#ffd54f" : "#edf4ff", fontVariantNumeric: "tabular-nums" }}>{money(value)}</span>
    </div>
  );
  return (
    <main style={{ minHeight: "100vh", background: "#080b14", color: "#edf4ff", padding: "max(18px, env(safe-area-inset-top)) 16px 40px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <a href="/" style={{ color: "#00e5ff", textDecoration: "none", fontSize: 13 }}>← LifeOS Mission Control</a>
        <header style={{ margin: "20px 0 22px" }}>
          <p style={{ color: "#ff6a00", letterSpacing: 2, fontSize: 11, fontWeight: 700, margin: 0 }}>LIFEOS / FINANCE</p>
          <h1 style={{ fontSize: "clamp(28px, 6vw, 42px)", margin: "8px 0", letterSpacing: -1 }}>Payroll Calculator</h1>
          <p style={{ color: "#aab6cb", lineHeight: 1.55, margin: 0 }}>Biweekly pay planning · $41.64 base rate · 14-day cycle anchored Dec 29, 2025</p>
        </header>
        <section style={{ ...cardStyle, marginBottom: 14, borderColor: "rgba(255,213,79,.38)" }}>
          <div style={{ color: "#ffd54f", fontSize: 11, letterSpacing: 1.2, fontWeight: 700 }}>STANDARD PAYCHECK BASELINE</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "baseline", marginTop: 9 }}>
            <strong style={{ fontSize: 32, color: "#ffd54f" }}>$3,997.44</strong><span style={{ color: "#aab6cb", fontSize: 13 }}>gross · 72 regular hours + 12 double-time hours</span>
          </div>
          <div style={{ color: "#74839c", fontSize: 12, marginTop: 8 }}>Annualized baseline: $103,933.44 across 26 pay periods. Actual net depends on benefits, deductions, and withholding.</div>
        </section>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 14 }}>
          <section style={cardStyle}>
            <h2 style={{ margin: "0 0 14px", fontSize: 17 }}>Hours & pay</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
              {numberField("baseRate", "Base hourly rate ($)", "0.01")}
              {numberField("regularHours", "Regular hours", "0.25")}
              {numberField("overtimeHours", "Overtime hours (1.5×)", "0.25")}
              {numberField("doubleTimeHours", "Double-time hours (2×)", "0.25")}
              {numberField("ptoHours", "PTO hours paid", "0.25")}
              {numberField("holidayBankHoursUsed", "Holiday-bank hours paid", "0.25")}
              {numberField("bankedWeekdayHolidayCount", "Weekday holidays banked", "1", "Adds 12 bank hours per holiday; no extra pay for the banked holiday.")}
              {numberField("bonusDollars", "Bonus ($)", "0.01")}
              {numberField("flatGrossDollars", "Other flat gross ($)", "0.01")}
            </div>
          </section>
          <section style={cardStyle}>
            <h2 style={{ margin: "0 0 14px", fontSize: 17 }}>Withholding & deductions</h2>
            <label style={{ display: "block", marginBottom: 12 }}>
              <span style={labelStyle}>Filing status</span>
              <select value={filingStatus} onChange={(event) => setFilingStatus(event.target.value as typeof filingStatus)} style={fieldStyle}>
                <option value="married_filing_jointly">Married filing jointly</option>
                <option value="single">Single</option>
                <option value="head_of_household">Head of household</option>
              </select>
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
              {numberField("children", "Qualifying children under 17", "1")}
              {numberField("federalRate", "Federal estimate (%)", "0.1")}
              {numberField("georgiaRate", "Georgia estimate (%)", "0.1")}
              {numberField("pretaxDollars", "Pre-tax deductions ($)", "0.01")}
              {numberField("postTaxDollars", "Post-tax deductions ($)", "0.01")}
            </div>
            <p style={{ color: "#74839c", fontSize: 11, lineHeight: 1.5, marginBottom: 0 }}>Federal and Georgia rates are editable flat-rate estimates, not official withholding calculations. Match these to a recent paystub for a closer planning estimate.</p>
          </section>
        </div>
        <section style={{ ...cardStyle, marginTop: 14 }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Paycheck estimate</h2>
          {line("Regular pay", result.regularPayCents)}
          {line("Overtime pay", result.overtimePayCents)}
          {line("Double-time pay", result.doubleTimePayCents)}
          {line("PTO pay", result.ptoPayCents)}
          {line("Holiday-bank pay", result.holidayBankPayCents)}
          {line("Bonuses", result.bonusPayCents)}
          {line("Other flat gross", result.flatGrossPayCents)}
          {line("Gross pay", result.grossPayCents, true)}
          {line("Pre-tax deductions", -result.pretaxDeductionsCents)}
          {line("Estimated federal withholding", -result.federalWithholdingCents)}
          {line("Estimated Georgia withholding", -result.georgiaWithholdingCents)}
          {line("Social Security", -result.socialSecurityCents)}
          {line("Medicare", -result.medicareCents)}
          {line("Additional Medicare", -result.additionalMedicareCents)}
          {line("Post-tax deductions", -result.postTaxDeductionsCents)}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 12, paddingTop: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>ESTIMATED TAKE-HOME</span>
            <strong style={{ color: "#ffd54f", fontSize: "clamp(28px, 6vw, 38px)", fontVariantNumeric: "tabular-nums" }}>{money(result.estimatedNetPayCents)}</strong>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            <span style={{ background: "rgba(0,229,255,.08)", color: "#00e5ff", padding: "7px 10px", borderRadius: 8, fontSize: 12 }}>Holiday bank +{result.holidayBankHoursAdded}h</span>
            <span style={{ background: "rgba(255,106,0,.08)", color: "#ff9a52", padding: "7px 10px", borderRadius: 8, fontSize: 12 }}>Holiday bank used −{result.holidayBankHoursUsed}h</span>
            <span style={{ background: "rgba(255,255,255,.06)", color: "#edf4ff", padding: "7px 10px", borderRadius: 8, fontSize: 12 }}>Net bank change {result.holidayBankNetChangeHours >= 0 ? "+" : ""}{result.holidayBankNetChangeHours}h</span>
          </div>
          <p style={{ color: "#74839c", fontSize: 11, lineHeight: 1.5, margin: "14px 0 0" }}>Planning tool only. Estimates currently use flat federal and Georgia rates; FICA wage-base caps and detailed W-4 / Georgia G-4 tables are not yet modeled. Double-time hours are separate from regular hours and must not be counted twice.</p>
        </section>
      </div>
    </main>
  );
}
