import assert from "node:assert/strict";
import test from "node:test";
import type { AuditEntry, LifeOSDatabase } from "../domain/contracts/database.ts";
import { createEmptyDatabase } from "../domain/services/empty-database.ts";
import {
  getAuditTrail,
  reconstructEntityAt,
  reconstructEntityHistory,
} from "../domain/resolvers/audit-history.ts";

function base() {
  return createEmptyDatabase("2026-10-02T12:00:00.000Z");
}

function audit(
  id: string,
  action: AuditEntry["action"],
  targetId: string,
  timestamp: string,
  after?: Record<string, unknown>,
  before?: Record<string, unknown>,
): AuditEntry {
  return {
    id,
    entityType: "audit",
    createdAt: timestamp,
    updatedAt: timestamp,
    action,
    targetId,
    targetType: "event",
    timestamp,
    before,
    after,
  };
}

function historicalStatus(state: ReturnType<typeof eventState> | undefined): string | undefined {
  return state?.status;
}

function eventState(status: string, updatedAt: string) {
  return {
    id: "evt-time",
    entityType: "event",
    createdAt: "2026-10-01T09:00:00.000Z",
    updatedAt,
    eventType: "task",
    title: "Historical event",
    status,
  };
}

test("getAuditTrail returns only the target entity in chronological order", () => {
  let db = base();
  db = {
    ...db,
    auditEntries: [
      audit("a3", "update", "evt-time", "2026-10-03T10:00:00.000Z", eventState("completed", "2026-10-03T10:00:00.000Z"), eventState("in_progress", "2026-10-02T10:00:00.000Z")),
      audit("other", "create", "evt-other", "2026-10-01T10:00:00.000Z", { id: "evt-other", entityType: "event" }),
      audit("a1", "create", "evt-time", "2026-10-01T09:00:00.000Z", eventState("planned", "2026-10-01T09:00:00.000Z")),
      audit("a2", "update", "evt-time", "2026-10-02T10:00:00.000Z", eventState("in_progress", "2026-10-02T10:00:00.000Z"), eventState("planned", "2026-10-01T09:00:00.000Z")),
    ],
  };

  assert.deepEqual(getAuditTrail(db, "evt-time").map((x) => x.id), ["a1", "a2", "a3"]);
});

test("reconstructEntityAt returns the correct state before, between, and after updates", () => {
  let db = base();
  db = {
    ...db,
    auditEntries: [
      audit("a1", "create", "evt-time", "2026-10-01T09:00:00.000Z", eventState("planned", "2026-10-01T09:00:00.000Z")),
      audit("a2", "update", "evt-time", "2026-10-02T10:00:00.000Z", eventState("in_progress", "2026-10-02T10:00:00.000Z"), eventState("planned", "2026-10-01T09:00:00.000Z")),
      audit("a3", "update", "evt-time", "2026-10-03T10:00:00.000Z", eventState("completed", "2026-10-03T10:00:00.000Z"), eventState("in_progress", "2026-10-02T10:00:00.000Z")),
    ],
  };

  assert.equal(reconstructEntityAt(db, "evt-time", "2026-09-30T00:00:00.000Z"), undefined);
  assert.equal(historicalStatus(reconstructEntityAt(db, "evt-time", "2026-10-01T09:00:00.000Z") as ReturnType<typeof eventState> | undefined), "planned");
  assert.equal(historicalStatus(reconstructEntityAt(db, "evt-time", "2026-10-02T23:59:59.999Z") as ReturnType<typeof eventState> | undefined), "in_progress");
  assert.equal(historicalStatus(reconstructEntityAt(db, "evt-time", "2026-10-03T10:00:00.000Z") as ReturnType<typeof eventState> | undefined), "completed");
  assert.equal(historicalStatus(reconstructEntityAt(db, "evt-time", "2026-12-01T00:00:00.000Z") as ReturnType<typeof eventState> | undefined), "completed");
});

test("reconstruction honors deletion and same-timestamp audit order", () => {
  let db = base();
  db = {
    ...db,
    auditEntries: [
      audit("a1", "create", "evt-time", "2026-10-01T09:00:00.000Z", eventState("planned", "2026-10-01T09:00:00.000Z")),
      audit("a2", "update", "evt-time", "2026-10-02T10:00:00.000Z", eventState("completed", "2026-10-02T10:00:00.000Z"), eventState("planned", "2026-10-01T09:00:00.000Z")),
      audit("a3", "delete", "evt-time", "2026-10-02T10:00:00.000Z"),
    ],
  };

  assert.equal(historicalStatus(reconstructEntityAt(db, "evt-time", "2026-10-02T09:59:59.999Z") as ReturnType<typeof eventState> | undefined), "planned");
  assert.equal(reconstructEntityAt(db, "evt-time", "2026-10-02T10:00:00.000Z"), undefined);
});

test("reconstructEntityHistory returns immutable historical snapshots", () => {
  let db = base();
  const first = eventState("planned", "2026-10-01T09:00:00.000Z");
  const second = eventState("completed", "2026-10-02T10:00:00.000Z");
  db = {
    ...db,
    auditEntries: [
      audit("a1", "create", "evt-time", first.updatedAt, first),
      audit("a2", "update", "evt-time", second.updatedAt, second, first),
    ],
  };

  const history = reconstructEntityHistory(db, "evt-time");
  assert.equal(history.length, 2);
  assert.equal(historicalStatus(history[0].state as ReturnType<typeof eventState> | undefined), "planned");
  assert.equal(historicalStatus(history[1].state as ReturnType<typeof eventState> | undefined), "completed");

  (history[0].state as any).status = "corrupted";
  assert.equal(historicalStatus(reconstructEntityAt(db, "evt-time", "2026-10-01T12:00:00.000Z") as ReturnType<typeof eventState> | undefined), "planned");
  assert.equal(db.auditEntries[0].after?.status, "planned");
});

test("unknown entity has no reconstructed state or history", () => {
  const db = base();
  assert.equal(reconstructEntityAt(db, "missing", "2026-10-02T00:00:00.000Z"), undefined);
  assert.deepEqual(reconstructEntityHistory(db, "missing"), []);
});
