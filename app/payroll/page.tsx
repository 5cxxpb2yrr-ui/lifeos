"use client";

import { useMemo, useState } from "react";
import { calculatePayroll } from "../../domain/payroll/payroll-calculator";
import { MOST_RECENT_PAYSTUB, validatePayrollAgainstPaystub } from "../../domain/payroll/paystub-validation";

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const fieldStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box", background: "#101626", color: "#edf4ff", border: "1px solid rgba(255,255,255,.16)", borderRadius: 10, padding: "11px 12px", fontSize: 16 };
const labelStyle: React.CSSProperties = { display: "block", color: "#aab6cb", fontSize: 12, marginBottom: 6 };
const cardStyle: React.CSSProperties = { background: "rgba(255,255,255,.045)", border: "1px solid rgba(255,255,255,.10)", borderRadius: 16, padding: 16, minWidth: 0 };
type NumericKey = "baseRate" | "regularHours" | "overtimeHours" | "doubleTimeHours" | "ptoHours" | "paidHolidayHours" | "holidayBankHoursUsed" | "bankedWeekdayHolidayCount" | "bonusDollars" | "flatGrossDollars" | "pretaxDollars" | "postTaxDollars" | "ficaAdjustmentDollars" | "federalRate" | "georgiaRate" | "children";
const defaults: Record<NumericKey, number> = {
  baseRate: 41.64, regularHours: 72, overtimeHours: 0, doubleTimeHours: 12, ptoHours: 0, paidHolidayHours: 0, holidayBankHoursUsed: 0,
  bankedWeekdayHolidayCount: 0, bonusDollars: 0, flatGrossDollars: 0, pretaxDollars: 0, postTaxDollars: 0, ficaAdjustmentDollars: 0,
  federalRate: 10, georgiaRate: 5, children: 2,
};
export default function PayrollCalculatorPage() {
  const [values, setValues] = useState(defaults);
  const [filingStatus, setFilingStatus] = useState<"married_filing_jointly" | "single" | "head_of_household">("married_filing_jointly");
  const update = (key: NumericKey, value: string) => {
    setValues((current) => ({ ...current, [key]: value === "" ? 0 : Math.max(0, Number(value) || 0) }));
  };
  const paystubValidation = useMemo(() => {
    const taxableWagesCents = MOST_RECENT_PAYSTUB.grossPayCents - MOST_RECENT_PAYSTUB.pretaxDeductionsCents;
    const referenceCalculation = calculatePayroll({
      regularHours: 0,
      flatGrossEntries: [{ id: "paystub-reference-gross", label: "Paystub reference gross", amountCents: MOST_RECENT_PAYSTUB.grossPayCents }],
      pretaxDeductionsCents: MOST_RECENT_PAYSTUB.pretaxDeductionsCents,
      postTaxDeductionsCents: MOST_RECENT_PAYSTUB.postTaxDeductionsCents,
      taxConfig: {
        federalWithholdingRate: MOST_RECENT_PAYSTUB.federalWithholdingCents / taxableWagesCents,
        georgiaWithholdingRate: MOST_RECENT_PAYSTUB.georgiaWithholdingCents / taxableWagesCents,
      },
      ficaTaxableWageAdjustmentCents: 8,
    });
    return validatePayrollAgainstPaystub(referenceCalculation);
  }, []);
  const result = useMemo(() => calculatePayroll({
    baseHourlyRateCents: Math.round(values.baseRate * 100),
    regularHours: values.regularHours, overtimeHours: values.overtimeHours, doubleTimeHours: values.doubleTimeHours,
    ptoHours: values.ptoHours, paidHolidayHours: values.paidHolidayHours, holidayBankHoursUsed: values.holidayBankHoursUsed,
    bankedWeekdayHolidayCount: Math.floor(values.bankedWeekdayHolidayCount),
    bonuses: values.bonusDollars > 0 ? [{ id: "bonus", label: "Bonus", amountCents: Math.round(values.bonusDollars * 100) }] : [],
    flatGrossEntries: values.flatGrossDollars > 0 ? [{ id: "flat-gross", label: "Flat gross entry", amountCents: Math.round(values.flatGrossDollars * 100) }] : [],
    pretaxDeductionsCents: Math.round(values.pretaxDollars * 100),
    postTaxDeductionsCents: Math.round(values.postTaxDollars * 100),
    ficaTaxableWageAdjustmentCents: Math.round(values.ficaAdjustmentDollars * 100),
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
          <a href="/payroll/forecast" style={{ display: "inline-block", marginTop: 12, border: "1px solid rgba(0,229,255,.35)", borderRadius: 10, padding: "9px 12px", color: "#00e5ff", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>Open Payroll Forecast →</a>
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
              {numberField("overtimeHours", "Overtime premium hours (extra 0.5×)", "0.25", "Only the additional half-time premium; straight-time pay for these hours is already included in regular hours.")}
              {numberField("doubleTimeHours", "Double-time hours (2×)", "0.25")}
              {numberField("ptoHours", "PTO hours paid", "0.25")}
              {numberField("paidHolidayHours", "Paid holiday hours", "0.25", "Holiday pay is separate from hours banked for future use.")}
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
              {numberField("ficaAdjustmentDollars", "FICA taxable wage adjustment ($)", "0.01", "Usually $0. Use only to reconcile taxable fringe benefits or payroll-specific FICA rounding from a paystub.")}
            </div>
            <p style={{ color: "#74839c", fontSize: 11, lineHeight: 1.5, marginBottom: 0 }}>Federal and Georgia rates are editable flat-rate estimates, not official withholding calculations. Match these to a recent paystub for a closer planning estimate.</p>
          </section>
        </div>
        <section style={{ ...cardStyle, marginTop: 14 }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Paycheck estimate</h2>
          {line("Regular pay", result.regularPayCents)}
          {line("Overtime premium (extra 0.5×)", result.overtimePayCents)}
          {line("Double-time pay", result.doubleTimePayCents)}
          {line("Paid holiday pay", result.paidHolidayPayCents)}
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
          <p style={{ color: "#74839c", fontSize: 11, lineHeight: 1.5, margin: "14px 0 0" }}>Planning tool only. Estimates currently use flat federal and Georgia rates; FICA wage-base caps and detailed W-4 / Georgia G-4 tables are not yet modeled. Overtime premium hours are hours over 40 in the Monday–Saturday workweek; their straight-time pay is included in regular hours. Sunday/eligible holiday double-time is entered separately.</p>
        </section>
        <section aria-labelledby="paystub-validation-title" style={{ ...cardStyle, marginTop: 14, borderColor: paystubValidation.passed ? "rgba(0,229,255,.3)" : "rgba(255,106,0,.45)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <h2 id="paystub-validation-title" style={{ margin: 0, fontSize: 18 }}>Previous paystub validation</h2>
            <span style={{ borderRadius: 8, padding: "7px 10px", fontSize: 12, fontWeight: 700, color: paystubValidation.passed ? "#00e5ff" : "#ffb36b", background: paystubValidation.passed ? "rgba(0,229,255,.08)" : "rgba(255,106,0,.10)" }}>
              {paystubValidation.passed ? "REFERENCE MATCH" : "MISMATCH DETECTED"}
            </span>
          </div>
          <p style={{ color: "#aab6cb", fontSize: 12, lineHeight: 1.5, margin: "9px 0 12px" }}>Reference: your September 29, 2026 paystub. This isolates the previous-check calibration from the editable estimate above, so a reference match does not falsely imply the next check is guaranteed.</p>
          {paystubValidation.lines.map((item) => (
            <div key={item.field} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto auto", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,.06)", fontSize: 12 }}>
              <span style={{ color: "#aab6cb" }}>{item.label}</span>
              <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{money(item.actualCents)}</span>
              <span style={{ minWidth: 52, textAlign: "right", color: item.withinTolerance ? "#00e5ff" : "#ffb36b", fontVariantNumeric: "tabular-nums" }}>{item.differenceCents === 0 ? "Match" : (item.differenceCents > 0 ? "+" : "−") + money(Math.abs(item.differenceCents))}</span>
            </div>
          ))}
          <p style={{ color: "#74839c", fontSize: 11, lineHeight: 1.5, margin: "12px 0 0" }}>Tolerance: {money(paystubValidation.toleranceCents)} per field. Federal and Georgia rates are calibrated to this check, and the 8¢ FICA wage adjustment models the observed rounding difference. Actual future withholding can differ.</p>
        </section>
      </div>
    </main>
  );
}
