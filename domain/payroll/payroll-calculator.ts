/**
 * LifeOS Payroll Calculator — deterministic gross-pay and configurable net-pay estimate.
 * All money inputs/outputs are integer cents. Tax percentages are planning estimates,
 * not payroll-provider calculations or tax advice.
 */
export type FilingStatus = "single" | "married_filing_jointly" | "head_of_household";
export interface PayrollTaxConfig {
  federalWithholdingRate: number;
  georgiaWithholdingRate: number;
  socialSecurityRate: number;
  medicareRate: number;
  additionalMedicareRate: number;
  additionalMedicareThresholdCents: number;
}
export interface PayrollEntry {
  id: string;
  label: string;
  amountCents: number;
  taxable?: boolean;
}
export interface PayrollPeriodInput {
  baseHourlyRateCents?: number;
  regularHours: number;
  overtimeHours?: number;
  doubleTimeHours?: number;
  ptoHours?: number;
  holidayBankHoursUsed?: number;
  bankedWeekdayHolidayCount?: number;
  bonuses?: PayrollEntry[];
  flatGrossEntries?: PayrollEntry[];
  pretaxDeductionsCents?: number;
  postTaxDeductionsCents?: number;
  filingStatus?: FilingStatus;
  qualifyingChildrenUnder17?: number;
  taxConfig?: Partial<PayrollTaxConfig>;
  yearToDateSocialSecurityWagesCents?: number;
  yearToDateMedicareWagesCents?: number;
}
export interface PayrollCalculation {
  baseHourlyRateCents: number;
  regularPayCents: number;
  overtimePayCents: number;
  doubleTimePayCents: number;
  ptoPayCents: number;
  holidayBankPayCents: number;
  bonusPayCents: number;
  flatGrossPayCents: number;
  grossPayCents: number;
  pretaxDeductionsCents: number;
  taxableWagesCents: number;
  federalWithholdingCents: number;
  georgiaWithholdingCents: number;
  socialSecurityCents: number;
  medicareCents: number;
  additionalMedicareCents: number;
  postTaxDeductionsCents: number;
  estimatedNetPayCents: number;
  holidayBankHoursAdded: number;
  holidayBankHoursUsed: number;
  holidayBankNetChangeHours: number;
  assumptions: string[];
}
const DEFAULT_BASE_RATE_CENTS = 4164;
export const DEFAULT_PAYROLL_TAX_CONFIG: PayrollTaxConfig = {
  federalWithholdingRate: 0.10,
  georgiaWithholdingRate: 0.05,
  socialSecurityRate: 0.062,
  medicareRate: 0.0145,
  additionalMedicareRate: 0.009,
  additionalMedicareThresholdCents: 200_000_000,
};
function centsForHours(hours: number, rateCents: number, multiplier = 1): number {
  return Math.round(hours * rateCents * multiplier);
}
function validNonNegative(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(name + " must be a finite non-negative number");
}
function sumEntries(entries: PayrollEntry[] = []): number {
  return entries.reduce((sum, entry) => {
    validNonNegative("entry amount", entry.amountCents);
    return sum + Math.round(entry.amountCents);
  }, 0);
}
function withheld(wagesCents: number, rate: number): number {
  return Math.round(wagesCents * Math.max(0, Math.min(1, rate)));
}
export function calculatePayroll(input: PayrollPeriodInput): PayrollCalculation {
  const rate = input.baseHourlyRateCents ?? DEFAULT_BASE_RATE_CENTS;
  const regularHours = input.regularHours;
  const overtimeHours = input.overtimeHours ?? 0;
  const doubleTimeHours = input.doubleTimeHours ?? 0;
  const ptoHours = input.ptoHours ?? 0;
  const holidayBankHoursUsed = input.holidayBankHoursUsed ?? 0;
  const bankedWeekdayHolidayCount = input.bankedWeekdayHolidayCount ?? 0;
  for (const [name, value] of Object.entries({ rate, regularHours, overtimeHours, doubleTimeHours, ptoHours, holidayBankHoursUsed, bankedWeekdayHolidayCount })) validNonNegative(name, value);
  if (!Number.isInteger(rate)) throw new RangeError("baseHourlyRateCents must be an integer");
  const tax = { ...DEFAULT_PAYROLL_TAX_CONFIG, ...input.taxConfig };
  for (const [name, value] of Object.entries(tax)) {
    if (!Number.isFinite(value) || value < 0) throw new RangeError(name + " must be finite and non-negative");
  }
  const regularPayCents = centsForHours(regularHours, rate);
  const overtimePayCents = centsForHours(overtimeHours, rate, 1.5);
  const doubleTimePayCents = centsForHours(doubleTimeHours, rate, 2);
  const ptoPayCents = centsForHours(ptoHours, rate);
  const holidayBankPayCents = centsForHours(holidayBankHoursUsed, rate);
  const bonusPayCents = sumEntries(input.bonuses);
  const flatGrossPayCents = sumEntries(input.flatGrossEntries);
  const grossPayCents = regularPayCents + overtimePayCents + doubleTimePayCents + ptoPayCents + holidayBankPayCents + bonusPayCents + flatGrossPayCents;
  const pretaxDeductionsCents = Math.min(grossPayCents, Math.round(input.pretaxDeductionsCents ?? 0));
  const taxableWagesCents = grossPayCents - pretaxDeductionsCents;
  validNonNegative("pretaxDeductionsCents", input.pretaxDeductionsCents ?? 0);
  validNonNegative("postTaxDeductionsCents", input.postTaxDeductionsCents ?? 0);
  const ytdSS = input.yearToDateSocialSecurityWagesCents ?? 0;
  const ytdMedicare = input.yearToDateMedicareWagesCents ?? 0;
  validNonNegative("yearToDateSocialSecurityWagesCents", ytdSS);
  validNonNegative("yearToDateMedicareWagesCents", ytdMedicare);
  // The 2026 Social Security wage base is deliberately not hard-coded here;
  // users may supply year-to-date wages, while the estimate remains configurable.
  const socialSecurityCents = withheld(taxableWagesCents, tax.socialSecurityRate);
  const medicareCents = withheld(taxableWagesCents, tax.medicareRate);
  const threshold = tax.additionalMedicareThresholdCents;
  const additionalMedicareCents = withheld(Math.max(0, ytdMedicare + taxableWagesCents - threshold) - Math.max(0, ytdMedicare - threshold), tax.additionalMedicareRate);
  const federalWithholdingCents = withheld(taxableWagesCents, tax.federalWithholdingRate);
  const georgiaWithholdingCents = withheld(taxableWagesCents, tax.georgiaWithholdingRate);
  const postTaxDeductionsCents = Math.round(input.postTaxDeductionsCents ?? 0);
  const estimatedNetPayCents = grossPayCents - pretaxDeductionsCents - federalWithholdingCents - georgiaWithholdingCents - socialSecurityCents - medicareCents - additionalMedicareCents - postTaxDeductionsCents;
  const holidayBankHoursAdded = bankedWeekdayHolidayCount * 12;
  const assumptions = [
    "Federal and Georgia withholding are flat-rate planning estimates; configure them to match a recent paystub.",
    "FICA estimates use the configured rates and taxable wages; Social Security wage-base limits are not automatically applied.",
    "Filing status and qualifying-child count are recorded for future withholding refinement but do not alter these flat-rate estimates.",
    "Double-time hours are counted only in the double-time line; do not also include those hours in regular hours.",
  ];
  return {
    baseHourlyRateCents: rate, regularPayCents, overtimePayCents, doubleTimePayCents, ptoPayCents,
    holidayBankPayCents, bonusPayCents, flatGrossPayCents, grossPayCents, pretaxDeductionsCents,
    taxableWagesCents, federalWithholdingCents, georgiaWithholdingCents, socialSecurityCents,
    medicareCents, additionalMedicareCents, postTaxDeductionsCents, estimatedNetPayCents,
    holidayBankHoursAdded, holidayBankHoursUsed, holidayBankNetChangeHours: holidayBankHoursAdded - holidayBankHoursUsed,
    assumptions,
  };
}
/** Standard paycheck baseline: 72 regular hours + 12 double-time hours. */
export function calculateStandardBiweeklyPayroll(overrides: Partial<PayrollPeriodInput> = {}): PayrollCalculation {
  return calculatePayroll({ regularHours: 72, doubleTimeHours: 12, ...overrides });
}
/** Biweekly cycle anchored to 2025-12-29. Returns true when a date is in the anchored 14-day window. */
export function isInBiweeklyPayPeriod(date: string, periodStart = "2025-12-29"): boolean {
  const day = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RangeError("Dates must use YYYY-MM-DD");
    const parsed = new Date(value + "T00:00:00.000Z");
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new RangeError("Invalid calendar date: " + value);
    return Math.floor(parsed.getTime() / 86_400_000);
  };
  const offset = day(date) - day(periodStart);
  return offset >= 0 && offset % 14 < 14;
}
/** Sundays and explicitly listed weekday holidays qualify for double time when worked. */
export function qualifiesForDoubleTime(date: string, weekdayHolidayDates: string[] = []): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new RangeError("Date must use YYYY-MM-DD");
  const day = new Date(date + "T00:00:00.000Z").getUTCDay();
  return day === 0 || (day >= 1 && day <= 5 && weekdayHolidayDates.includes(date));
}
