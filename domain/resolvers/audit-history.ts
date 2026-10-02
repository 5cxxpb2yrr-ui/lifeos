import type { AuditEntry, BaseEntity, LifeOSDatabase } from "@/domain/contracts/database";

export interface HistoricalEntityVersion {
  effectiveAt: string;
  action: AuditEntry["action"];
  auditId: string;
  state?: BaseEntity;
}

/** Returns one entity's audit trail in deterministic chronological order. */
export function getAuditTrail(db: LifeOSDatabase, targetId: string): AuditEntry[] {
  return db.auditEntries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry.targetId === targetId)
    .sort((a, b) => {
      const time = a.entry.timestamp.localeCompare(b.entry.timestamp);
      if (time !== 0) return time;
      const id = a.entry.id.localeCompare(b.entry.id);
      return id !== 0 ? id : a.index - b.index;
    })
    .map(({ entry }) => entry);
}

function snapshot(entry: AuditEntry, value: Record<string, unknown> | undefined): BaseEntity | undefined {
  if (!value) return undefined;
  if (value.id !== entry.targetId || value.entityType !== entry.targetType) return undefined;
  return structuredClone(value) as BaseEntity;
}

function applyEntry(current: BaseEntity | undefined, entry: AuditEntry): BaseEntity | undefined {
  if (entry.action === "delete") return undefined;

  const after = snapshot(entry, entry.after);
  if (after) return after;

  // Legacy/incomplete entries without an after snapshot can still establish
  // a safe historical anchor from their before snapshot.
  if (!current) return snapshot(entry, entry.before);

  return current;
}

/**
 * Reconstructs an entity as of a point in time. The timestamp is inclusive.
 * Returns undefined when the entity did not yet exist or was already deleted.
 */
export function reconstructEntityAt(
  db: LifeOSDatabase,
  targetId: string,
  timestamp: string,
): BaseEntity | undefined {
  const trail = getAuditTrail(db, targetId);
  let current: BaseEntity | undefined;

  for (const entry of trail) {
    if (entry.timestamp.localeCompare(timestamp) > 0) break;
    current = applyEntry(current, entry);
  }

  return current ? structuredClone(current) : undefined;
}

/** Returns each historical state immediately after its audit entry was applied. */
export function reconstructEntityHistory(
  db: LifeOSDatabase,
  targetId: string,
): HistoricalEntityVersion[] {
  let current: BaseEntity | undefined;

  return getAuditTrail(db, targetId).map((entry) => {
    current = applyEntry(current, entry);
    return {
      effectiveAt: entry.timestamp,
      action: entry.action,
      auditId: entry.id,
      state: current ? structuredClone(current) : undefined,
    };
  });
}
