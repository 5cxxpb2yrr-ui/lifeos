import assert from "node:assert/strict";
import test from "node:test";
import { calculatePayroll, calculateStandardBiweeklyPayroll, qualifiesForDoubleTime, isInBiweeklyPayPeriod } from "../domain/payroll/payroll-calculator.ts";

test("standard biweekly gross is 72 regular plus 12 double-time hours", () => {
  const result = calculateStandardBiweeklyPayroll();
  assert.equal(result.regularPayCents, 299808);
  assert.equal(result.doubleTimePayCents, 99936);
  assert.equal(result.grossPayCents, 399744);
  assert.equal(result.estimatedNetPayCents, 399744 - result.federalWithholdingCents - result.georgiaWithholdingCents - result.socialSecurityCents - result.medicareCents);
});

test("overtime is 1.5x and double time is 2x; hours are not double-counted", () => {
  const result = calculatePayroll({ regularHours: 10, overtimeHours: 2, doubleTimeHours: 3 });
  assert.equal(result.regularPayCents, 41640);
  assert.equal(result.overtimePayCents, 12492);
  assert.equal(result.doubleTimePayCents, 24984);
  assert.equal(result.grossPayCents, 79116);
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
  assert.equal(isInBiweeklyPayPeriod("2025-12-29"), true);
  assert.equal(isInBiweeklyPayPeriod("2025-12-28"), false);
  assert.equal(isInBiweeklyPayPeriod("2026-01-12"), true);
});
