import type { PayrollCalculation } from "./payroll-calculator";

export interface PaystubReference {
  grossPayCents: number;
  federalWithholdingCents: number;
  socialSecurityCents: number;
  medicareCents: number;
  georgiaWithholdingCents: number;
  totalTaxesCents: number;
  pretaxDeductionsCents: number;
  postTaxDeductionsCents: number;
  totalDeductionsCents: number;
  netPayCents: number;
}

export interface PaystubValidationLine {
  field: keyof PaystubReference;
  label: string;
  expectedCents: number;
  actualCents: number;
  differenceCents: number;
  withinTolerance: boolean;
}

export interface PaystubValidationResult {
  passed: boolean;
  toleranceCents: number;
  lines: PaystubValidationLine[];
}

/** Latest supplied paystub (dated September 29, 2026), stored as integer cents. */
export const MOST_RECENT_PAYSTUB: Readonly<PaystubReference> = Object.freeze({
  grossPayCents: 400602,
  federalWithholdingCents: 12849,
  socialSecurityCents: 23252,
  medicareCents: 5438,
  georgiaWithholdingCents: 9118,
  totalTaxesCents: 50657,
  pretaxDeductionsCents: 25578,
  postTaxDeductionsCents: 11032,
  totalDeductionsCents: 36610,
  netPayCents: 313335,
});

const LABELS: Record<keyof PaystubReference, string> = {
  grossPayCents: "Gross earnings",
  federalWithholdingCents: "Federal income tax",
  socialSecurityCents: "Social Security",
  medicareCents: "Medicare",
  georgiaWithholdingCents: "Georgia income tax",
  totalTaxesCents: "Total employee taxes",
  pretaxDeductionsCents: "Pre-tax deductions",
  postTaxDeductionsCents: "After-tax deductions",
  totalDeductionsCents: "Total deductions",
  netPayCents: "Net pay",
};

/**
 * Compare a payroll calculation with the paystub reference. Tolerance is explicit
 * and expressed in cents; this function never changes the estimate or actual values.
 */
export function validatePayrollAgainstPaystub(
  calculation: PayrollCalculation,
  paystub: PaystubReference = MOST_RECENT_PAYSTUB,
  toleranceCents = 1,
): PaystubValidationResult {
  if (!Number.isSafeInteger(toleranceCents) || toleranceCents < 0) {
    throw new RangeError("toleranceCents must be a non-negative integer");
  }
  const actual: PaystubReference = {
    grossPayCents: calculation.grossPayCents,
    federalWithholdingCents: calculation.federalWithholdingCents,
    socialSecurityCents: calculation.socialSecurityCents,
    medicareCents: calculation.medicareCents,
    georgiaWithholdingCents: calculation.georgiaWithholdingCents,
    totalTaxesCents: calculation.federalWithholdingCents + calculation.socialSecurityCents +
      calculation.medicareCents + calculation.georgiaWithholdingCents + calculation.additionalMedicareCents,
    pretaxDeductionsCents: calculation.pretaxDeductionsCents,
    postTaxDeductionsCents: calculation.postTaxDeductionsCents,
    totalDeductionsCents: calculation.pretaxDeductionsCents + calculation.postTaxDeductionsCents,
    netPayCents: calculation.estimatedNetPayCents,
  };
  const fields = Object.keys(LABELS) as (keyof PaystubReference)[];
  const lines = fields.map((field) => {
    const expectedCents = paystub[field];
    const actualCents = actual[field];
    const differenceCents = actualCents - expectedCents;
    return {
      field,
      label: LABELS[field],
      expectedCents,
      actualCents,
      differenceCents,
      withinTolerance: Math.abs(differenceCents) <= toleranceCents,
    };
  });
  return { passed: lines.every((line) => line.withinTolerance), toleranceCents, lines };
}
