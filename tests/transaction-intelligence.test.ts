import assert from "node:assert/strict";
import test from "node:test";
import {
  applyForecastScenario,
  buildArchiveManifest,
  parseConnectedTransactions,
  summarizeTransactions
} from "../domain/resolvers/transaction-intelligence.ts";

const sample = [
  { transaction_id: "t1", date: "2026-10-01", amount: -2500, name: "ACME PAYROLL", account_name: "Checking", institution: "Sandbox Bank", category: "INCOME" },
  { transaction_id: "t2", date: "2026-10-02", amount: 12.99, name: "StreamMax Subscription", account_name: "Checking", institution: "Sandbox Bank", category: "ENTERTAINMENT" },
  { transaction_id: "t3", date: "2026-10-03", amount: 40, name: "Transfer to savings", account_name: "Checking", institution: "Sandbox Bank", category: "TRANSFER" },
  { transaction_id: "t4", date: "2026-10-04", amount: 5, name: "Overdraft Fee", account_name: "Checking", institution: "Sandbox Bank", category: "FEES" }
];

test("parses transactions transiently with direction, category, and source signals", () => {
  const parsed = parseConnectedTransactions(sample);
  assert.equal(parsed.length, 4);
  assert.equal(parsed[0].direction, "inflow");
  assert.equal(parsed[0].amountMinor, 250000);
  assert.equal(parsed[1].direction, "outflow");
  assert.equal(parsed[2].direction, "transfer");
  assert.equal(parsed[3].category, "FEES");
  assert.equal(parsed[0].sourceTransactionId, "t1");
});

test("summary persists aggregates and explainable recommendations, not raw rows", () => {
  const parsed = parseConnectedTransactions(sample);
  const summary = summarizeTransactions(parsed, "2026-10-05T12:00:00.000Z");
  assert.equal(summary.transactionCount, 4);
  assert.equal(summary.inflowMinor, 250000);
  assert.equal(summary.outflowMinor, 1799);
  assert.equal(summary.transferMinor, 4000);
  assert.equal(summary.netFlowMinor, 248201);
  assert.equal(summary.retention.rawTransactionsPersisted, false);
  assert.equal(summary.retention.policy, "discard-by-default");
  assert.ok(summary.recommendations.some(item => item.kind === "possible_fee"));
});

test("archive manifest summarizes an optional archive without embedding transaction details", () => {
  const summary = summarizeTransactions(parseConnectedTransactions(sample), "2026-10-05T12:00:00.000Z");
  const manifest = buildArchiveManifest(summary, "archive-2026-10");
  assert.equal(manifest.transactionCount, 4);
  assert.equal(manifest.archive.encryptionRequired, true);
  assert.equal(manifest.archive.privateStorageRequired, true);
  assert.equal("transactions" in manifest, false);
  assert.equal(manifest.totalsMinor.netFlow, 248201);
});

test("scenario adjustments change a derived forecast only and leave baseline points unchanged", () => {
  const baseline = [{ date: "2026-10-01", closingBalanceMinor: 10000 }, { date: "2026-10-02", closingBalanceMinor: 2000 }];
  const before = structuredClone(baseline);
  const result = applyForecastScenario(baseline, [
    { date: "2026-10-02", amountMinor: 5000, direction: "outflow", label: "Hypothetical repair" }
  ]);
  assert.deepEqual(baseline, before);
  assert.equal(result.baselineUnchanged, true);
  assert.equal(result.points[1].scenarioClosingBalanceMinor, -3000);
  assert.equal(result.firstNegativeDate, "2026-10-02");
});

test("flags suspicious category and direction combinations without rewriting provider category", () => {
  const parsed = parseConnectedTransactions([
    { transaction_id: "flight-in", date: "2026-10-01", amount: -500, name: "Sandbox deposit", personal_finance_category: { primary: "TRAVEL", detailed: "TRAVEL_FLIGHTS" } },
    { transaction_id: "payroll-out", date: "2026-10-02", amount: 100, name: "Store purchase", category: "INCOME_PAYROLL" },
    { transaction_id: "normal-out", date: "2026-10-03", amount: 12, name: "Coffee", category: "FOOD_AND_DRINK_COFFEE" }
  ]);
  assert.equal(parsed[0].direction, "inflow");
  assert.equal(parsed[0].category, "TRAVEL FLIGHTS");
  assert.ok(parsed[0].signals.includes("category-direction-mismatch"));
  assert.ok(parsed[1].signals.includes("category-direction-mismatch"));
  assert.ok(!parsed[2].signals.includes("category-direction-mismatch"));
  const review = summarizeTransactions(parsed).recommendations.filter(item => item.kind === "review");
  assert.equal(review.length, 2);
  assert.ok(review.every(item => item.title === "Review category and money direction"));
  assert.ok(review.every(item => item.explanation.includes("original category is preserved")));
});

test("repeated merchant on distinct dates remains a review candidate even when amounts vary", () => {
  const parsed = parseConnectedTransactions([
    { transaction_id: "coffee-1", date: "2026-09-01", amount: 4.50, name: "Corner Coffee" },
    { transaction_id: "coffee-2", date: "2026-09-08", amount: 7.25, name: "Corner Coffee" },
    { transaction_id: "coffee-3", date: "2026-09-21", amount: 5.10, name: "Corner Coffee" }
  ]);
  const candidate = summarizeTransactions(parsed).recommendations.find(item => item.kind === "recurring_candidate");
  assert.ok(candidate);
  assert.equal(candidate?.confidence, "medium");
  assert.ok(candidate?.explanation.includes("Confirm whether it is a bill or subscription"));
  assert.ok(candidate?.evidence.some(item => item === "3 separate dates"));
});
