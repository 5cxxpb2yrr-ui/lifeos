import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyDatabase } from "../domain/services/empty-database.ts";
import { validateDatabaseIntegrity } from "../domain/resolvers/integrity.ts";
import { parseConnectedTransactions, summarizeTransactions } from "../domain/resolvers/transaction-intelligence.ts";

test("transaction import history persists aggregate summaries only", () => {
  const db = createEmptyDatabase("2026-10-15T12:00:00.000Z");
  const parsed = parseConnectedTransactions([
    { transaction_id: "raw-private-id", date: "2026-10-14", amount: -1250, name: "Example Payroll", account_name: "Checking" },
    { transaction_id: "raw-private-id-2", date: "2026-10-15", amount: 25, name: "Example Store", account_name: "Checking" }
  ]);
  const summary = summarizeTransactions(parsed, "2026-10-15T12:00:00.000Z");
  db.transactionImports = [{
    id: "txn-import-test", entityType: "transaction_import_batch", createdAt: "2026-10-15T12:00:00.000Z",
    updatedAt: "2026-10-15T12:00:00.000Z", source: "manual-json", status: "analyzed",
    summary: summary as unknown as Record<string, unknown>, sourceFingerprint: "fnv1a32-test",
    rawTransactionsPersisted: false, notes: "Manual test"
  }];
  assert.equal(db.transactions.length, 0, "analysis must not add canonical ledger rows");
  assert.equal(db.transactionImports?.[0].rawTransactionsPersisted, false);
  const serialized = JSON.stringify(db.transactionImports);
  assert.equal(serialized.includes("raw-private-id"), false);
  assert.equal(serialized.includes("Example Payroll"), false);
  assert.equal((db.transactionImports?.[0].summary.transactionCount), 2);
  assert.equal(validateDatabaseIntegrity(db).valid, true);
});

test("integrity rejects transaction import metadata that claims raw rows were retained", () => {
  const db = createEmptyDatabase("2026-10-15T12:00:00.000Z");
  db.transactionImports = [{
    id: "txn-import-bad", entityType: "transaction_import_batch", createdAt: "2026-10-15T12:00:00.000Z",
    updatedAt: "2026-10-15T12:00:00.000Z", source: "manual-csv", status: "analyzed",
    summary: { transactionCount: 1 }, sourceFingerprint: "fnv1a32-test",
    rawTransactionsPersisted: true as false
  }];
  const result = validateDatabaseIntegrity(db);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(item => item.code === "RAW_TRANSACTION_RETENTION_VIOLATION"));
});
