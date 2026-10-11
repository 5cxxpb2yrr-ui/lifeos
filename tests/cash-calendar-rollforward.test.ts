import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyDatabase } from "../domain/services/empty-database.ts";
import { resolveCashForecast } from "../domain/resolvers/cash-forecast.ts";

test("cash forecast carries each closing balance into the following day's opening balance", () => {
  const db = createEmptyDatabase("2026-10-11T00:00:00.000Z");
  db.accounts.push({
    id: "cash-grid-account",
    entityType: "financial_account",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    name: "Checking",
    accountType: "checking",
    currency: "USD",
    openingBalanceMinor: 1849750,
  });
  db.events.push({
    id: "cash-grid-payday",
    entityType: "event",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    eventType: "income",
    title: "Payday",
    status: "planned",
    dueAt: "2026-10-12T12:00:00.000Z",
    metadata: { amountMinor: 250000 },
  });
  db.events.push({
    id: "cash-grid-bill",
    entityType: "event",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    eventType: "expense",
    title: "Utility bill",
    status: "planned",
    dueAt: "2026-10-13T12:00:00.000Z",
    metadata: { amountMinor: 42500 },
  });

  const forecast = resolveCashForecast(db, { startDate: "2026-10-11", horizonDays: 4 });
  assert.equal(forecast.points[0].openingBalanceMinor, 1849750);
  assert.equal(forecast.points[1].incomeMinor, 250000);
  assert.equal(forecast.points[2].otherExpenseMinor, 42500);
  assert.equal(forecast.points[1].openingBalanceMinor, forecast.points[0].closingBalanceMinor);
  assert.equal(forecast.points[2].openingBalanceMinor, forecast.points[1].closingBalanceMinor);
  assert.equal(forecast.points[3].openingBalanceMinor, forecast.points[2].closingBalanceMinor);
  assert.equal(forecast.points[1].closingBalanceMinor, 2099750);
  assert.equal(forecast.points[2].closingBalanceMinor, 2057250);
});
