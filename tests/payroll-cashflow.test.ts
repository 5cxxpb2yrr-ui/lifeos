import assert from "node:assert/strict";
import test from "node:test";
import { calculateStandardBiweeklyPayroll } from "../domain/payroll/payroll-calculator.ts";
import { createExpectedPaycheckEvent } from "../domain/payroll/payroll-cashflow.ts";

test("expected paycheck Event contributes estimated net pay, not gross, to forecast", () => {
  const calculation = calculateStandardBiweeklyPayroll();
  const event = createExpectedPaycheckEvent({
    id: "paycheck-2026-10-16",
    payDate: "2026-10-16",
    payPeriodStart: "2026-09-28",
    payPeriodEnd: "2026-10-11",
    calculation,
    createdAt: "2026-10-10T00:00:00.000Z",
  });
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
    id: "bad-date", payDate: "2026-02-30", payPeriodStart: "2026-02-16",
    payPeriodEnd: "2026-03-01", calculation,
  }), /valid YYYY-MM-DD/);
  assert.throws(() => createExpectedPaycheckEvent({
    id: "bad-pay", payDate: "2026-10-16", payPeriodStart: "2026-09-28",
    payPeriodEnd: "2026-10-11",
    calculation: { estimatedNetPayCents: -1, grossPayCents: 100 },
  }), /non-negative integer cents/);
});
