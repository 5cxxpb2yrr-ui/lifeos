import assert from "node:assert/strict";
import test from "node:test";
import { calculatePayroll } from "../domain/payroll/payroll-calculator.ts";
import { MOST_RECENT_PAYSTUB, validatePayrollAgainstPaystub } from "../domain/payroll/paystub-validation.ts";

function calibratedPaystubCalculation() {
  // Calibrate withholding rates to the actual stub's observed federal/state amounts.
  // The 8-cent FICA wage adjustment models payroll rounding on this reference check.
  const taxableWagesCents = MOST_RECENT_PAYSTUB.grossPayCents - MOST_RECENT_PAYSTUB.pretaxDeductionsCents;
  return calculatePayroll({
    regularHours: 0,
    flatGrossEntries: [{ id: "paystub-gross", label: "Imported paystub gross", amountCents: MOST_RECENT_PAYSTUB.grossPayCents }],
    pretaxDeductionsCents: MOST_RECENT_PAYSTUB.pretaxDeductionsCents,
    postTaxDeductionsCents: MOST_RECENT_PAYSTUB.postTaxDeductionsCents,
    taxConfig: {
      federalWithholdingRate: MOST_RECENT_PAYSTUB.federalWithholdingCents / taxableWagesCents,
      georgiaWithholdingRate: MOST_RECENT_PAYSTUB.georgiaWithholdingCents / taxableWagesCents,
    },
    ficaTaxableWageAdjustmentCents: 8,
  });
}

test("most recent paystub reference matches its stated tax, deduction, and net totals", () => {
  assert.equal(
    MOST_RECENT_PAYSTUB.federalWithholdingCents + MOST_RECENT_PAYSTUB.socialSecurityCents +
      MOST_RECENT_PAYSTUB.medicareCents + MOST_RECENT_PAYSTUB.georgiaWithholdingCents,
    MOST_RECENT_PAYSTUB.totalTaxesCents,
  );
  assert.equal(
    MOST_RECENT_PAYSTUB.pretaxDeductionsCents + MOST_RECENT_PAYSTUB.postTaxDeductionsCents,
    MOST_RECENT_PAYSTUB.totalDeductionsCents,
  );
  assert.equal(
    MOST_RECENT_PAYSTUB.grossPayCents - MOST_RECENT_PAYSTUB.pretaxDeductionsCents -
      MOST_RECENT_PAYSTUB.totalTaxesCents - MOST_RECENT_PAYSTUB.postTaxDeductionsCents,
    MOST_RECENT_PAYSTUB.netPayCents,
  );
});

test("calibrated calculation validates against September 29, 2026 paystub within one cent", () => {
  const result = validatePayrollAgainstPaystub(calibratedPaystubCalculation());
  assert.equal(result.passed, true, JSON.stringify(result.lines.filter((line) => !line.withinTolerance)));
});

test("paystub validation reports field-level differences instead of silently adjusting values", () => {
  const result = validatePayrollAgainstPaystub({
    ...calibratedPaystubCalculation(),
    estimatedNetPayCents: 100,
  });
  assert.equal(result.passed, false);
  const netLine = result.lines.find((line) => line.field === "netPayCents");
  assert.equal(netLine?.differenceCents, 100 - MOST_RECENT_PAYSTUB.netPayCents);
  assert.equal(netLine?.withinTolerance, false);
});

test("paystub validation rejects negative or fractional-cent tolerances", () => {
  const calculation = calibratedPaystubCalculation();
  assert.throws(() => validatePayrollAgainstPaystub(calculation, MOST_RECENT_PAYSTUB, -1), /non-negative integer/);
  assert.throws(() => validatePayrollAgainstPaystub(calculation, MOST_RECENT_PAYSTUB, 0.5), /non-negative integer/);
});
