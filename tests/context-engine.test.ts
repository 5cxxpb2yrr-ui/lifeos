import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyDatabase } from "@/domain/services/empty-database";
import { resolveContextEngine } from "@/domain/resolvers/context-engine";

const base = (id: string, entityType: string) => ({
  id, entityType, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
});

test("context engine returns connected canonical records and nearest upcoming due date", () => {
  const db = createEmptyDatabase();
  db.vehicles.push({ ...base("vehicle-1", "vehicle"), year: 2006, make: "Scion", model: "xB", mileageUnit: "mi", status: "owned" } as never);
  db.vehicleMaintenance.push({ ...base("maintenance-1", "vehicle_maintenance"), vehicleId: "vehicle-1", date: "2026-10-01", serviceType: "Brake overhaul", nextDueDate: "2026-10-20" } as never);
  db.events.push({ ...base("event-1", "event"), eventType: "maintenance", title: "Brake inspection", status: "scheduled", dueAt: "2026-10-12T09:00:00.000Z" } as never);
  db.relationships.push({ ...base("relationship-1", "relationship"), fromId: "vehicle-1", fromType: "vehicle", toId: "event-1", toType: "event", relationshipType: "related_to" } as never);
  const result = resolveContextEngine(db, "vehicle-1", { now: new Date("2026-10-08T12:00:00.000Z") });
  assert.equal(result.center?.id, "vehicle-1");
  assert.ok(result.references.some((reference) => reference.id === "maintenance-1" && reference.relationship === "maintenance_for"));
  assert.ok(result.references.some((reference) => reference.id === "event-1" && reference.direction === "outgoing"));
  assert.deepEqual(result.relatedEvents.map((event) => event.id), ["event-1"]);
  assert.equal(result.nextDueAt, "2026-10-12T09:00:00.000Z");
});

test("context engine excludes resolved open loops and never mutates canonical data", () => {
  const db = createEmptyDatabase();
  db.projects.push({ ...base("project-1", "project"), name: "Garage refresh", status: "active" } as never);
  db.openLoops.push({ ...base("loop-open", "open_loop"), title: "Order parts", type: "task", status: "open", dueAt: "2026-10-10T12:00:00.000Z", relatedProjectIds: ["project-1"] } as never);
  db.openLoops.push({ ...base("loop-done", "open_loop"), title: "Already handled", type: "task", status: "resolved", relatedProjectIds: ["project-1"] } as never);
  const before = JSON.stringify(db);
  const result = resolveContextEngine(db, "project-1", { now: new Date("2026-10-08T12:00:00.000Z") });
  assert.deepEqual(result.openLoops.map((loop) => loop.id), ["loop-open"]);
  assert.deepEqual(result.projects.map((project) => project.id), ["project-1"]);
  assert.equal(result.nextDueAt, "2026-10-10T12:00:00.000Z");
  assert.equal(JSON.stringify(db), before);
});

test("unknown focus returns an empty context without inventing a center", () => {
  const db = createEmptyDatabase();
  const result = resolveContextEngine(db, "missing", { now: new Date("2026-10-08T12:00:00.000Z") });
  assert.equal(result.center, null);
  assert.deepEqual(result.references, []);
  assert.deepEqual(result.relatedEvents, []);
  assert.equal(result.nextDueAt, undefined);
});
