import assert from "node:assert/strict";
import test from "node:test";
import { calculatePayroll, calculateStandardBiweeklyPayroll, qualifiesForDoubleTime, getBiweeklyPeriodStart, isBiweeklyPayPeriodStart } from "../domain/payroll/payroll-calculator.ts";

test("standard biweekly gross is 72 regular plus 12 double-time hours", () => {
  const result = calculateStandardBiweeklyPayroll();
  assert.equal(result.regularPayCents, 299808);
  assert.equal(result.doubleTimePayCents, 99936);
  assert.equal(result.grossPayCents, 399744);
  assert.equal(result.estimatedNetPayCents, 399744 - result.federalWithholdingCents - result.georgiaWithholdingCents - result.socialSecurityCents - result.medicareCents);
});

test("overtime line is the additional half-time premium; double time is separate", () => {
  const result = calculatePayroll({ regularHours: 10, overtimeHours: 2, doubleTimeHours: 3 });
  assert.equal(result.regularPayCents, 41640);
  assert.equal(result.overtimePayCents, 4164); // 2 hours × $20.82 premium
  assert.equal(result.doubleTimePayCents, 24984);
  assert.equal(result.grossPayCents, 70788);
});

test("PTO, holiday-bank pay, bonuses, flat gross, and deductions are included", () => {
  const result = calculatePayroll({
    regularHours: 72, doubleTimeHours: 12, ptoHours: 8, holidayBankHoursUsed: 4,
    bankedWeekdayHolidayCount: 1, bonuses: [{ id: "b1", label: "Bonus", amountCents: 50000 }],
    flatGrossEntries: [{ id: "f1", label: "Manual gross adjustment", amountCents: 10000 }],
    pretaxDeductionsCents: 20000, postTaxDeductionsCents: 5000,
  });
  assert.equal(result.ptoPayCents, 33312);
  assert.equal(result.holidayBankPayCents, 16656);
  assert.equal(result.holidayBankHoursAdded, 12);
  assert.equal(result.holidayBankNetChangeHours, 8);
  assert.equal(result.grossPayCents, 399744 + 33312 + 16656 + 50000 + 10000);
  assert.equal(result.taxableWagesCents, result.grossPayCents - 20000);
  assert.equal(result.estimatedNetPayCents, result.grossPayCents - 20000 - result.federalWithholdingCents - result.georgiaWithholdingCents - result.socialSecurityCents - result.medicareCents - result.additionalMedicareCents - 5000);
});

test("withholding rates are configurable and estimates are clearly labeled", () => {
  const result = calculatePayroll({ regularHours: 40, taxConfig: { federalWithholdingRate: 0, georgiaWithholdingRate: 0 } });
  assert.equal(result.federalWithholdingCents, 0);
  assert.equal(result.georgiaWithholdingCents, 0);
  assert.ok(result.assumptions.some((line) => line.includes("planning estimates")));
});

test("negative hours and deductions are rejected", () => {
  assert.throws(() => calculatePayroll({ regularHours: -1 }), RangeError);
  assert.throws(() => calculatePayroll({ regularHours: 1, postTaxDeductionsCents: -10 }), RangeError);
});

test("Sunday and weekday holidays qualify for double time, Saturday does not by itself", () => {
  assert.equal(qualifiesForDoubleTime("2026-10-11"), true);
  assert.equal(qualifiesForDoubleTime("2026-10-12", ["2026-10-12"]), true);
  assert.equal(qualifiesForDoubleTime("2026-10-10", ["2026-10-10"]), false);
  assert.equal(qualifiesForDoubleTime("2026-10-09"), false);
});

test("biweekly cycle uses the Dec 29, 2025 anchor", () => {
  assert.equal(getBiweeklyPeriodStart("2025-12-29"), "2025-12-29");
  assert.equal(getBiweeklyPeriodStart("2026-01-15"), "2026-01-12");
  assert.equal(getBiweeklyPeriodStart("2025-12-28"), "2025-12-15");
  assert.equal(isBiweeklyPayPeriodStart("2025-12-29"), true);
  assert.equal(isBiweeklyPayPeriodStart("2026-01-12"), true);
  assert.equal(isBiweeklyPayPeriodStart("2026-01-15"), false);
});

test("paystub calibration reconciles FICA wage rounding and net pay", () => {
  const result = calculatePayroll({
    baseHourlyRateCents: 4164, regularHours: 60, overtimeHours: 16, paidHolidayHours: 8, ptoHours: 20,
    flatGrossEntries: [{ id: "gtli", label: "EE GTLI taxable", amountCents: 858 }],
    pretaxDeductionsCents: 25578, postTaxDeductionsCents: 11032, ficaTaxableWageAdjustmentCents: 8,
    taxConfig: { federalWithholdingRate: 12849 / 375024, georgiaWithholdingRate: 9118 / 375024 },
  });
  assert.equal(result.grossPayCents, 400602);
  assert.equal(result.federalWithholdingCents, 12849);
  assert.equal(result.georgiaWithholdingCents, 9118);
  assert.equal(result.socialSecurityCents, 23252);
  assert.equal(result.medicareCents, 5438);
  assert.equal(result.estimatedNetPayCents, 313335);
});

test("additional Medicare estimate applies only to wages above the $200,000 threshold", () => {
  const result = calculatePayroll({
    regularHours: 0, flatGrossEntries: [{ id: "gross", label: "Gross", amountCents: 100000 }],
    yearToDateMedicareWagesCents: 19_999_000,
    taxConfig: { federalWithholdingRate: 0, georgiaWithholdingRate: 0, socialSecurityRate: 0, medicareRate: 0 },
  });
  assert.equal(result.additionalMedicareCents, 891);
});
