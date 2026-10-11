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


/**
 * Insert or refresh one projected paycheck by stable Event ID. Returns a copied
 * database object; callers remain responsible for persisting it through LifeOS storage.
 */
export function upsertExpectedPaycheckEvent(
  db: import("@/domain/contracts/database").LifeOSDatabase,
  input: ExpectedPaycheckInput,
): import("@/domain/contracts/database").LifeOSDatabase {
  const event = createExpectedPaycheckEvent(input);
  const existingIndex = db.events.findIndex((item) => item.id === event.id);
  const events = [...db.events];
  if (existingIndex >= 0) {
    const existing = events[existingIndex];
    if (existing.source !== "payroll_forecast") {
      throw new Error("Refusing to overwrite a non-payroll Event with this ID");
    }
    if (existing.status === "completed" || existing.metadata?.reconciliationState === "reconciled") {
      throw new Error("Refusing to refresh a reconciled paycheck; the actual deposit is now authoritative");
    }
    events[existingIndex] = { ...event, createdAt: existing.createdAt };
  } else {
    events.push(event);
  }
  return { ...db, events };
}

/**
 * Reconcile a projected paycheck after the corresponding real deposit is imported.
 * The transaction becomes the canonical actual record; completing the projection
 * removes it from the cash forecast so it cannot be counted twice.
 */
export function reconcileExpectedPaycheckEvent(
  db: import("@/domain/contracts/database").LifeOSDatabase,
  eventId: string,
  transactionId: string,
  reconciledAt = new Date().toISOString(),
): import("@/domain/contracts/database").LifeOSDatabase {
  if (!transactionId.trim()) throw new RangeError("transactionId is required");
  const eventIndex = db.events.findIndex((item) => item.id === eventId);
  if (eventIndex < 0) throw new Error("Expected paycheck Event was not found");
  const event = db.events[eventIndex];
  if (event.source !== "payroll_forecast" || event.eventType !== "income") {
    throw new Error("Only expected payroll income Events can be reconciled");
  }
  const transaction = db.transactions.find((item) => item.id === transactionId);
  if (!transaction) throw new Error("Actual bank transaction was not found");
  if (transaction.transactionType !== "income" && transaction.transactionType !== "refund") {
    throw new Error("Actual transaction must be an income deposit");
  }
  if (transaction.eventId && transaction.eventId !== eventId) {
    throw new Error("Actual transaction is already linked to another Event");
  }
  const events = [...db.events];
  events[eventIndex] = {
    ...event,
    status: "completed",
    completedAt: reconciledAt,
    updatedAt: reconciledAt,
    financialTransactionIds: [...new Set([...(event.financialTransactionIds ?? []), transactionId])],
    metadata: {
      ...(event.metadata ?? {}),
      reconciliationState: "reconciled",
      reconciledTransactionId: transactionId,
      reconciledAt,
      actualAmountMinor: transaction.amountMinor,
      actualDate: transaction.transactionDate,
    },
  };
  const transactions = db.transactions.map((item) =>
    item.id === transactionId ? { ...item, eventId, updatedAt: reconciledAt } : item,
  );
  return { ...db, events, transactions };
}
