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
