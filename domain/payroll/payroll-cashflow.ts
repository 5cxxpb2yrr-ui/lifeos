import type { Event } from "@/domain/contracts/database";
import type { PayrollCalculation } from "./payroll-calculator";

export interface ExpectedPaycheckInput {
  /** Stable ID so repeated forecast refreshes update the same canonical Event. */
  id: string;
  payDate: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  calculation: Pick<PayrollCalculation, "estimatedNetPayCents" | "grossPayCents">;
  createdAt?: string;
  title?: string;
}

/**
 * Build a planned income Event for the cash forecast from the payroll resolver's
 * estimated net pay. The forecast must use net, not gross, to avoid overstating cash.
 * This is a projection, not a bank transaction. Reconcile it when the actual deposit
 * arrives; do not keep both as separate income flows for the same paycheck.
 */
export function createExpectedPaycheckEvent(input: ExpectedPaycheckInput): Event {
  for (const [name, value] of Object.entries({
    payDate: input.payDate,
    payPeriodStart: input.payPeriodStart,
    payPeriodEnd: input.payPeriodEnd,
  })) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(Date.parse(value + "T00:00:00.000Z")) ||
      new Date(value + "T00:00:00.000Z").toISOString().slice(0, 10) !== value) {
      throw new RangeError(name + " must be a valid YYYY-MM-DD date");
    }
  }
  if (input.payPeriodEnd < input.payPeriodStart) {
    throw new RangeError("payPeriodEnd must not precede payPeriodStart");
  }
  const net = input.calculation.estimatedNetPayCents;
  const gross = input.calculation.grossPayCents;
  if (!Number.isSafeInteger(net) || net < 0 || !Number.isSafeInteger(gross) || gross < 0) {
    throw new RangeError("paycheck gross and net must be non-negative integer cents");
  }
  const createdAt = input.createdAt ?? new Date().toISOString();
  return {
    id: input.id,
    entityType: "event",
    createdAt,
    updatedAt: createdAt,
    eventType: "income",
    title: input.title ?? "Expected paycheck",
    description: "Projected paycheck; reconcile against the actual bank deposit.",
    status: "planned",
    dueAt: input.payDate + "T12:00:00.000Z",
    source: "payroll_forecast",
    metadata: {
      amountMinor: net,
      currency: "USD",
      forecastKind: "expected_paycheck",
      payrollGrossMinor: gross,
      payrollNetMinor: net,
      payDate: input.payDate,
      payPeriodStart: input.payPeriodStart,
      payPeriodEnd: input.payPeriodEnd,
      reconciliationState: "expected",
    },
  };
}
