import assert from "node:assert/strict";
import test from "node:test";
import { buildTransactionRecommendations, parseConnectedTransactions } from "../domain/resolvers/transaction-intelligence.ts";

test("flags expense categories classified as inflows without exposing transaction details in counts", () => {
  const parsed = parseConnectedTransactions([
    { transaction_id: "synthetic-1", date: "2026-10-01", amount: -500, name: "Synthetic refund", personal_finance_category: { primary: "TRAVEL", detailed: "TRAVEL_FLIGHTS" } }
  ]);
  assert.equal(parsed.length, 1);
  assert.ok(parsed[0].signals.includes("category-direction-mismatch"));
  const recommendations = buildTransactionRecommendations(parsed);
  assert.equal(recommendations.length, 1);
  assert.equal(recommendations[0].kind, "review");
  assert.equal(recommendations[0].title, "Review category and money direction");
  assert.match(recommendations[0].explanation, /verify it before using it in a forecast/i);
});

test("flags income categories classified as outflows", () => {
  const parsed = parseConnectedTransactions([
    { transaction_id: "synthetic-2", date: "2026-10-02", amount: 1200, name: "Synthetic payroll", personal_finance_category: { primary: "INCOME", detailed: "INCOME_PAYROLL" } }
  ]);
  assert.equal(parsed.length, 1);
  assert.ok(parsed[0].signals.includes("category-direction-mismatch"));
  assert.equal(buildTransactionRecommendations(parsed)[0].title, "Review category and money direction");
});

test("does not flag a normal coffee expense", () => {
  const parsed = parseConnectedTransactions([
    { transaction_id: "synthetic-3", date: "2026-10-03", amount: 4.5, name: "Synthetic coffee", personal_finance_category: { primary: "FOOD_AND_DRINK", detailed: "FOOD_AND_DRINK_COFFEE" } }
  ]);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].signals.includes("category-direction-mismatch"), false);
  assert.equal(buildTransactionRecommendations(parsed).length, 0);
});
