import type { BaseEntity, Event, LifeOSDatabase, OpenLoop } from "@/domain/contracts/database";
import { resolveGraph, type GraphNode } from "@/domain/resolvers/graph";

export interface ContextReference {
  id: string;
  type: string;
  label: string;
  relationship: string;
  direction: "incoming" | "outgoing";
}
export interface ContextEngineView {
  center: GraphNode | null;
  references: ContextReference[];
  relatedEvents: Event[];
  openLoops: OpenLoop[];
  decisions: BaseEntity[];
  projects: BaseEntity[];
  documents: BaseEntity[];
  nextDueAt?: string;
  generatedAt: string;
}

/**
 * Builds a read-only, graph-derived context view for a focused LifeOS record.
 * This resolver never writes to the database: canonical records remain authoritative.
 */
export function resolveContextEngine(
  db: LifeOSDatabase,
  centerId: string,
  options: { now?: Date } = {},
): ContextEngineView {
  const now = options.now ?? new Date();
  const graph = resolveGraph(db, centerId);
  const references: ContextReference[] = graph.edges.map((edge): ContextReference => {
    const outgoing = edge.from.id === centerId;
    const other = outgoing ? edge.to : edge.from;
    return {
      id: other.id,
      type: other.type,
      label: other.label,
      relationship: edge.relationship,
      direction: outgoing ? "outgoing" : "incoming",
    };
  }).filter((reference, index, all) =>
    all.findIndex((candidate) =>
      candidate.id === reference.id &&
      candidate.relationship === reference.relationship &&
      candidate.direction === reference.direction
    ) === index
  );

  const connectedIds = new Set(references.map((reference) => reference.id));
  const relatedEvents = db.events
    .filter((event) => connectedIds.has(event.id))
    .sort((a, b) => {
      const aDate = a.dueAt ?? a.startAt ?? a.occurredAt ?? "";
      const bDate = b.dueAt ?? b.startAt ?? b.occurredAt ?? "";
      return aDate.localeCompare(bDate);
    });
  const openLoops = db.openLoops
    .filter((loop) => connectedIds.has(loop.id) && loop.status !== "resolved" && loop.status !== "cancelled")
    .sort((a, b) => {
      const aDate = a.dueAt ?? "9999";
      const bDate = b.dueAt ?? "9999";
      return aDate.localeCompare(bDate);
    });
  const decisions = db.decisions.filter((item) => connectedIds.has(item.id) || item.id === centerId);
  const projects = db.projects.filter((item) => connectedIds.has(item.id) || item.id === centerId);
  const documents = db.documents.filter((item) => connectedIds.has(item.id) || item.id === centerId);
  const nowIso = now.toISOString();
  const dueCandidates = [
    ...relatedEvents.flatMap((event) => event.status === "completed" || event.status === "cancelled" || event.status === "skipped"
      ? [] : [event.dueAt ?? event.startAt].filter((value): value is string => Boolean(value))),
    ...openLoops.flatMap((loop) => loop.dueAt ? [loop.dueAt] : []),
  ].filter((value) => Number.isFinite(Date.parse(value)) && Date.parse(value) >= now.getTime()).sort();

  return {
    center: graph.center,
    references,
    relatedEvents,
    openLoops,
    decisions,
    projects,
    documents,
    nextDueAt: dueCandidates[0],
    generatedAt: nowIso,
  };
}
