import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyDatabase } from "../domain/services/empty-database.ts";
import { calculateStandardBiweeklyPayroll } from "../domain/payroll/payroll-calculator.ts";
import { reconcileExpectedPaycheckEvent, upsertExpectedPaycheckEvent } from "../domain/payroll/payroll-cashflow.ts";

test("reconciliation rejects a second deposit link and leaves the second transaction untouched", () => {
  const input = {
    id: "paycheck-2026-10-13",
    payDate: "2026-10-13",
    payPeriodStart: "2026-09-20",
    payPeriodEnd: "2026-10-04",
    calculation: calculateStandardBiweeklyPayroll(),
    createdAt: "2026-10-10T00:00:00.000Z",
  };
  const db = createEmptyDatabase("2026-10-10T00:00:00.000Z");
  const withExpected = upsertExpectedPaycheckEvent(db, input);
  const withTransactions = {
    ...withExpected,
    transactions: [
      ...withExpected.transactions,
      {
        id: "txn-paycheck-first",
        entityType: "financial_transaction" as const,
        createdAt: "2026-10-13T13:00:00.000Z",
        updatedAt: "2026-10-13T13:00:00.000Z",
        transactionType: "income" as const,
        transactionDate: "2026-10-13",
        amountMinor: 313335,
        currency: "USD",
        accountId: "checking-1",
        description: "Payroll deposit",
      },
      {
        id: "txn-paycheck-second",
        entityType: "financial_transaction" as const,
        createdAt: "2026-10-13T13:05:00.000Z",
        updatedAt: "2026-10-13T13:05:00.000Z",
        transactionType: "income" as const,
        transactionDate: "2026-10-16",
        amountMinor: 313335,
        currency: "USD",
        accountId: "checking-1",
        description: "Duplicate payroll deposit candidate",
      },
    ],
  };

  const reconciled = reconcileExpectedPaycheckEvent(
    withTransactions,
    "paycheck-2026-10-13",
    "txn-paycheck-first",
    "2026-10-13T14:00:00.000Z",
  );

  assert.throws(
    () => reconcileExpectedPaycheckEvent(
      reconciled,
      "paycheck-2026-10-13",
      "txn-paycheck-second",
      "2026-10-13T14:05:00.000Z",
    ),
    /already been reconciled|second deposit link/,
  );
  assert.equal(reconciled.events[0].status, "completed");
  assert.deepEqual(reconciled.events[0].financialTransactionIds, ["txn-paycheck-first"]);
  assert.equal(reconciled.transactions.find((item) => item.id === "txn-paycheck-first")?.eventId, "paycheck-2026-10-13");
  assert.equal(reconciled.transactions.find((item) => item.id === "txn-paycheck-second")?.eventId, undefined);
  assert.equal(withTransactions.transactions.every((item) => item.eventId === undefined), true, "input database remains unchanged");
});
