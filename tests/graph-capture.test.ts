import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyDatabase } from "@/domain/services/empty-database";
import { createRelationship } from "@/domain/services/operations";
import { resolveGraph } from "@/domain/resolvers/graph";

const base = (id: string, entityType: string) => ({
  id, entityType, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
});

test("graph-aware capture relationship is canonical and visible from both endpoints", () => {
  const db = createEmptyDatabase();
  db.vehicles.push({ ...base("vehicle-1", "vehicle"), year: 2006, make: "Scion", model: "xB", mileageUnit: "mi", status: "owned" } as never);
  db.events.push({ ...base("event-captured", "event"), eventType: "observation", title: "Brake noise noticed", status: "completed" } as never);

  const linked = createRelationship(db, {
    fromId: "event-captured", fromType: "event",
    toId: "vehicle-1", toType: "vehicle",
    relationshipType: "related_to",
  });

  assert.equal(linked.relationships.length, 1);
  assert.equal(linked.relationships[0].entityType, "relationship");
  assert.equal(linked.relationships[0].fromId, "event-captured");
  assert.equal(linked.relationships[0].toId, "vehicle-1");
  assert.ok(linked.auditEntries.some((entry) => entry.targetId === linked.relationships[0].id && entry.action === "create"));

  const eventGraph = resolveGraph(linked, "event-captured");
  const vehicleGraph = resolveGraph(linked, "vehicle-1");
  assert.ok(eventGraph.edges.some((edge) => edge.to.id === "vehicle-1" && edge.relationship === "related_to"));
  assert.ok(vehicleGraph.edges.some((edge) => edge.from.id === "event-captured" && edge.relationship === "related_to"));
  assert.equal(db.relationships.length, 0, "input database remains unchanged");
});

test("relationship creation is idempotent and rejects missing endpoints", () => {
  const db = createEmptyDatabase();
  db.events.push({ ...base("event-1", "event"), eventType: "observation", title: "Note", status: "completed" } as never);
  db.people.push({ ...base("person-1", "person"), firstName: "Alex", displayName: "Alex" } as never);
  const input = { fromId: "event-1", fromType: "event", toId: "person-1", toType: "person", relationshipType: "related_to" as const };
  const once = createRelationship(db, input);
  const twice = createRelationship(once, input);
  assert.equal(twice.relationships.length, 1);
  assert.equal(createRelationship(db, { ...input, toId: "missing" }), db);
});
