import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyDatabase } from "../domain/services/empty-database.ts";
import { calculateStandardBiweeklyPayroll } from "../domain/payroll/payroll-calculator.ts";
import { createExpectedPaycheckEvent, reconcileExpectedPaycheckEvent, upsertExpectedPaycheckEvent } from "../domain/payroll/payroll-cashflow.ts";

const input = () => ({
  id: "paycheck-2026-10-16",
  payDate: "2026-10-16",
  payPeriodStart: "2026-09-28",
  payPeriodEnd: "2026-10-11",
  calculation: calculateStandardBiweeklyPayroll(),
  createdAt: "2026-10-10T00:00:00.000Z",
});

test("expected paycheck Event contributes estimated net pay, not gross, to forecast", () => {
  const calculation = calculateStandardBiweeklyPayroll();
  const event = createExpectedPaycheckEvent({ ...input(), calculation });
  assert.equal(event.eventType, "income");
  assert.equal(event.status, "planned");
  assert.equal(event.dueAt, "2026-10-16T12:00:00.000Z");
  assert.equal(event.source, "payroll_forecast");
  assert.equal(event.metadata?.amountMinor, calculation.estimatedNetPayCents);
  assert.notEqual(event.metadata?.amountMinor, calculation.grossPayCents);
  assert.equal(event.metadata?.reconciliationState, "expected");
});

test("expected paycheck Event rejects invalid dates and negative pay", () => {
  const calculation = calculateStandardBiweeklyPayroll();
  assert.throws(() => createExpectedPaycheckEvent({
    ...input(), payDate: "2026-02-30",
  }), /valid YYYY-MM-DD/);
  assert.throws(() => createExpectedPaycheckEvent({
    ...input(), calculation: { estimatedNetPayCents: -1, grossPayCents: 100 },
  }), /non-negative integer cents/);
});

test("upsert keeps a single projected paycheck for a stable ID", () => {
  const db = createEmptyDatabase("2026-10-10T00:00:00.000Z");
  const first = upsertExpectedPaycheckEvent(db, input());
  const refreshed = upsertExpectedPaycheckEvent(first, {
    ...input(),
    calculation: { estimatedNetPayCents: 250000, grossPayCents: 300000 },
    createdAt: "2026-10-11T00:00:00.000Z",
  });
  assert.equal(refreshed.events.length, 1);
  assert.equal(refreshed.events[0].metadata?.amountMinor, 250000);
  assert.equal(refreshed.events[0].createdAt, "2026-10-10T00:00:00.000Z");
  assert.equal(db.events.length, 0, "input database remains immutable");
});

test("reconciliation links actual deposit and completes projection to prevent duplicate forecast income", () => {
  const db = createEmptyDatabase("2026-10-10T00:00:00.000Z");
  const withExpected = upsertExpectedPaycheckEvent(db, input());
  const withTransaction = {
    ...withExpected,
    transactions: [...withExpected.transactions, {
      id: "txn-paycheck-1",
      entityType: "financial_transaction" as const,
      createdAt: "2026-10-16T13:00:00.000Z",
      updatedAt: "2026-10-16T13:00:00.000Z",
      transactionType: "income" as const,
      transactionDate: "2026-10-16",
      amountMinor: 313335,
      currency: "USD",
      accountId: "checking-1",
      description: "Payroll deposit",
    }],
  };
  const reconciled = reconcileExpectedPaycheckEvent(
    withTransaction, "paycheck-2026-10-16", "txn-paycheck-1", "2026-10-16T14:00:00.000Z",
  );
  assert.equal(reconciled.events[0].status, "completed");
  assert.equal(reconciled.events[0].metadata?.reconciliationState, "reconciled");
  assert.equal(reconciled.events[0].metadata?.actualAmountMinor, 313335);
  assert.equal(reconciled.transactions[0].eventId, "paycheck-2026-10-16");
  assert.deepEqual(reconciled.events[0].financialTransactionIds, ["txn-paycheck-1"]);
  assert.equal(withExpected.events[0].status, "planned");
});

test("reconciliation refuses to link non-income transactions", () => {
  const db = createEmptyDatabase("2026-10-10T00:00:00.000Z");
  const withExpected = upsertExpectedPaycheckEvent(db, input());
  const withTransaction = {
    ...withExpected,
    transactions: [...withExpected.transactions, {
      id: "txn-expense-1",
      entityType: "financial_transaction" as const,
      createdAt: "2026-10-16T13:00:00.000Z",
      updatedAt: "2026-10-16T13:00:00.000Z",
      transactionType: "expense" as const,
      transactionDate: "2026-10-16",
      amountMinor: 313335,
      currency: "USD",
      accountId: "checking-1",
    }],
  };
  assert.throws(() => reconcileExpectedPaycheckEvent(
    withTransaction, "paycheck-2026-10-16", "txn-expense-1",
  ), /income deposit/);
});

test("upsert refuses to refresh a reconciled paycheck projection", () => {
  const db = createEmptyDatabase("2026-10-10T00:00:00.000Z");
  const withExpected = upsertExpectedPaycheckEvent(db, input());
  const withTransaction = {
    ...withExpected,
    transactions: [...withExpected.transactions, {
      id: "txn-paycheck-1",
      entityType: "financial_transaction" as const,
      createdAt: "2026-10-16T13:00:00.000Z",
      updatedAt: "2026-10-16T13:00:00.000Z",
      transactionType: "income" as const,
      transactionDate: "2026-10-16",
      amountMinor: 313335,
      currency: "USD",
      accountId: "checking-1",
      description: "Payroll deposit",
    }],
  };
  const reconciled = reconcileExpectedPaycheckEvent(
    withTransaction, "paycheck-2026-10-16", "txn-paycheck-1", "2026-10-16T14:00:00.000Z",
  );
  assert.throws(() => upsertExpectedPaycheckEvent(reconciled, {
    ...input(), calculation: { estimatedNetPayCents: 250000, grossPayCents: 300000 },
  }), /reconciled paycheck/);
  assert.equal(reconciled.events[0].status, "completed");
  assert.equal(reconciled.events[0].metadata?.actualAmountMinor, 313335);
});
