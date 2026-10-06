import type {AttentionState,Event,OpenLoop} from "@/domain/contracts/database";

export interface AttentionResolution {
  state: AttentionState;
  priority: number;
  reason: string;
}

function time(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : undefined;
}

function resolveDue(dueAt: string | undefined, nowMs: number): AttentionResolution {
  const dueMs = time(dueAt);
  if (dueMs === undefined) return {state:"unresolved",priority:1,reason:"No due date is recorded."};
  const delta = dueMs - nowMs;
  if (delta < 0) return {state:"overdue",priority:5,reason:"Due date has passed."};
  if (delta <= 86_400_000) return {state:"due_today",priority:4,reason:"Due within 24 hours."};
  if (delta <= 7 * 86_400_000) return {state:"due_soon",priority:3,reason:"Due within 7 days."};
  return {state:"none",priority:0,reason:"No immediate attention required."};
}

export function resolveAttentionDetailed(item: Event | OpenLoop, now = new Date()): AttentionResolution {
  const nowMs = now.getTime();
  if ("status" in item) {
    if (item.status === "completed" || item.status === "cancelled" || item.status === "resolved") {
      return {state:"none",priority:0,reason:"Item is closed."};
    }
    if (item.status === "blocked") return {state:"blocked",priority:5,reason:"Item is blocked."};
    if (item.status === "waiting") return {state:"waiting",priority:3,reason:"Item is waiting."};
  }

  const dueAt = "dueAt" in item ? item.dueAt : undefined;
  const due = resolveDue(dueAt, nowMs);

  if (due.state !== "none" && due.state !== "unresolved") return due;

  if ("type" in item && item.type === "decision") {
    return {state:"needs_decision",priority:4,reason:"Open decision requires resolution."};
  }

  if ("eventType" in item && item.eventType === "decision" && item.status !== "completed") {
    return {state:"needs_decision",priority:4,reason:"Decision event requires resolution."};
  }

  if ("priority" in item && item.priority === "critical") {
    return {state:"at_risk",priority:4,reason:"Critical open loop is at risk."};
  }

  if ("status" in item && (item.status === "planned" || item.status === "scheduled" || item.status === "in_progress" || item.status === "open")) {
    return {state:"unresolved",priority:1,reason:"Open work has no immediate deadline."};
  }

  return {state:"none",priority:0,reason:"No attention required."};
}

export function resolveAttention(item: Event | OpenLoop, now = new Date()): AttentionState {
  return resolveAttentionDetailed(item, now).state;
}

export const AttentionResolver = {resolveAttention,resolveAttentionDetailed};
