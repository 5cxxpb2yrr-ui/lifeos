"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import type { LifeOSDatabase, BaseEntity } from "@/domain/contracts/database";
import { deleteEntityRecord, updateEntityRecord } from "@/domain/services/operations";
import EntityAttachments from "@/components/mission-control/EntityAttachments";

type Editable = { key: string; value: unknown; original: unknown };

function findRecord(db: LifeOSDatabase, type: string, id: string): BaseEntity | undefined {
  if (!db || !id) return undefined;

  const aliases: Record<string, string> = {
    account: "financial_account",
    transaction: "financial_transaction",
    maintenance: "vehicle_maintenance",
  };
  const resolvedType = aliases[type] ?? type;

  const collections = [
    "entities",
    "events",
    "openLoops",
    "people",
    "assets",
    "accounts",
    "transactions",
    "loans",
    "loanPayments",
    "vehicles",
    "vehicleMaintenance",
    "properties",
    "rooms",
    "homeSystems",
    "electricalDevices",
    "projects",
    "goals",
    "decisions",
    "documents",
    "recurringRules",
    "relationships",
  ] as const;

  for (const name of collections) {
    const list = db[name] as BaseEntity[] | undefined;
    if (Array.isArray(list)) {
      const item = list.find((x) => x?.id === id);
      if (item && (resolvedType === "record" || item.entityType === resolvedType || name === resolvedType)) {
        return item;
      }
    }
  }

  const attachment = db.attachments?.find((x) => x?.id === id);
  if (attachment && (!resolvedType || resolvedType === "attachment")) return attachment;

  return undefined;
}

function formatLabel(key: string): string {
  if (!key) return "";
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/^./, (x) => x.toUpperCase());
}

function parseValue(value: string, original: unknown): unknown {
  if (value === "") return undefined;

  if (typeof original === "number") {
    const n = Number(value);
    return Number.isFinite(n) ? n : original;
  }

  if (typeof original === "boolean") {
    return value === "true";
  }

  if (typeof original === "object" && original !== null) {
    try {
      return JSON.parse(value);
    } catch {
      // Throw explicit error so save caller can handle validation state
      throw new Error("Invalid JSON format");
    }
  }

  return value;
}

export default function EntityEditor({
  db,
  onPersist,
}: {
  db: LifeOSDatabase;
  onPersist: (next: LifeOSDatabase, message: string) => Promise<void> | void;
}) {
  const [target, setTarget] = useState<{ type: string; id: string } | null>(null);
  const [draft, setDraft] = useState<Editable[]>([]);
  const [jsonErrors, setJsonErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    setTarget(null);
    setJsonErrors({});
    setActionError(null);
    setIsSubmitting(false);
  }, []);

  // Listen for custom edit events
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as { id?: string; type?: string };
      if (!detail?.id) return;
      setTarget({ id: detail.id, type: detail.type ?? "record" });
    };

    window.addEventListener("lifeos:edit", handler);
    return () => window.removeEventListener("lifeos:edit", handler);
  }, []);

  // Keyboard accessibility (Escape key to close modal)
  useEffect(() => {
    if (!target) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [target, handleClose]);

  const record = useMemo(
    () => (target ? findRecord(db, target.type, target.id) : undefined),
    [db, target]
  );

  useEffect(() => {
    if (!record) {
      if (target) setTarget(null);
      return;
    }
    const protectedFields = ["id", "entityType", "createdAt", "updatedAt", "archivedAt"];
    setDraft(
      Object.entries(record)
        .filter(([key]) => !protectedFields.includes(key))
        .map(([key, value]) => ({ key, value, original: value }))
    );
    setJsonErrors({});
    setActionError(null);
  }, [record]);

  if (!target || !record) return null;

  const fields = record as unknown as Record<string, unknown>;
  const entityTypeLabel = (record.entityType ?? "record").replaceAll("_", " ");
  const vehicle = record.entityType === "vehicle";

  const handleTextareaChange = (fieldKey: string, rawValue: string) => {
    setDraft((v) =>
      v.map((x) => (x.key === fieldKey ? { ...x, value: rawValue } : x))
    );

    // Live validation for JSON objects
    try {
      JSON.parse(rawValue);
      setJsonErrors((prev) => {
        const next = { ...prev };
        delete next[fieldKey];
        return next;
      });
    } catch (err) {
      setJsonErrors((prev) => ({
        ...prev,
        [fieldKey]: (err as Error).message || "Invalid JSON syntax",
      }));
    }
  };

  const save = async () => {
    if (Object.keys(jsonErrors).length > 0) {
      setActionError("Please fix invalid JSON fields before saving.");
      return;
    }

    setIsSubmitting(true);
    setActionError(null);

    try {
      const changes: Record<string, unknown> = {};
      for (const field of draft) {
        changes[field.key] = parseValue(String(field.value ?? ""), field.original);
      }

      const next = updateEntityRecord(db, record.entityType, record.id, changes);
      await onPersist(next, `Updated ${entityTypeLabel} and recorded the change.`);
      handleClose();
    } catch (err) {
      setActionError((err as Error).message || "Failed to save changes.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const remove = async () => {
    const confirmed = window.confirm(
      `Delete this ${entityTypeLabel} record? This removes the record from the active database and preserves a deletion entry in audit history.`
    );
    if (!confirmed) return;

    setIsSubmitting(true);
    setActionError(null);

    try {
      const next = deleteEntityRecord(db, record.entityType, record.id);
      await onPersist(next, `Deleted ${entityTypeLabel} record.`);
      handleClose();
    } catch (err) {
      setActionError((err as Error).message || "Failed to delete record.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = vehicle
    ? `${fields.year ?? ""} ${fields.make ?? ""} ${fields.model ?? ""}`.trim()
    : String(
        fields.name ??
          fields.title ??
          fields.displayName ??
          (fields.legacyType === "inventory" ? "Part" : entityTypeLabel)
      );

  const hasJsonErrors = Object.keys(jsonErrors).length > 0;

  return (
    <div
      className="modal-backdrop entity-editor-backdrop"
      onMouseDown={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="entity-editor-title"
    >
      <div className="entity-editor-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="entity-detail-header">
          <div>
            <div className="kicker">Edit Entity</div>
            <h2 id="entity-editor-title">{title || "Untitled Record"}</h2>
            <div className="row-meta">
              {entityTypeLabel} · {record.id}
            </div>
          </div>
          <button
            type="button"
            className="mini-action"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Close
          </button>
        </div>

        {actionError && (
          <div className="entity-editor-error-banner" style={{ padding: "8px 12px", color: "var(--danger, #d9383a)", background: "rgba(217, 56, 58, 0.1)", borderRadius: "4px", margin: "12px 0 0" }}>
            {actionError}
          </div>
        )}

        <div className="entity-editor-grid">
          {draft.map((field) => {
            const complex = typeof field.original === "object" && field.original !== null;
            const inputValue = complex
              ? typeof field.value === "string"
                ? field.value
                : JSON.stringify(field.value ?? null, null, 2)
              : String(field.value ?? "");

            const isArray = Array.isArray(field.original);
            const arrayOptions = isArray ? Array.from(new Set([...(field.original as unknown[]).map(String), ...(Array.isArray(field.value) ? (field.value as unknown[]).map(String) : [])])) : [];
            const isVin = vehicle && field.key === "vin";
            const jsonError = jsonErrors[field.key];

            return (
              <label className={`field-label ${isVin ? "entity-editor-vin" : ""}`} key={field.key}>
                <span>
                  {formatLabel(field.key)}
                  {isVin && <strong> EDITABLE</strong>}
                </span>

                {isArray && arrayOptions.every((x) => typeof x === "string") ? (
                  <select
                    className="command-input"
                    multiple
                    size={Math.min(Math.max(arrayOptions.length, 2), 5)}
                    value={Array.isArray(field.value) ? field.value.map(String) : []}
                    onChange={(e) => setDraft((v) => v.map((x) => x.key === field.key ? { ...x, value: Array.from(e.target.selectedOptions, (o) => o.value) } : x))}
                    disabled={isSubmitting}
                  >
                    {arrayOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                ) : complex ? (
                  <>
                    <textarea
                      className={`command-input entity-editor-textarea ${jsonError ? "input-error" : ""}`}
                      value={inputValue}
                      onChange={(e) => handleTextareaChange(field.key, e.target.value)}
                      disabled={isSubmitting}
                      style={jsonError ? { borderColor: "var(--danger, #d9383a)" } : undefined}
                    />
                    {jsonError && (
                      <span className="field-error-text" style={{ color: "var(--danger, #d9383a)", fontSize: "0.8rem", marginTop: "4px" }}>
                        {jsonError}
                      </span>
                    )}
                  </>
                ) : typeof field.original === "boolean" ? (
                  <select
                    className="command-input"
                    value={String(field.value)}
                    onChange={(e) =>
                      setDraft((v) =>
                        v.map((x) => (x.key === field.key ? { ...x, value: e.target.value } : x))
                      )
                    }
                    disabled={isSubmitting}
                  >
                    <option value="true">True</option>
                    <option value="false">False</option>
                  </select>
                ) : (
                  <input
                    className="command-input"
                    type={typeof field.original === "number" ? "number" : "text"}
                    value={inputValue}
                    onChange={(e) =>
                      setDraft((v) =>
                        v.map((x) => (x.key === field.key ? { ...x, value: e.target.value } : x))
                      )
                    }
                    disabled={isSubmitting}
                  />
                )}
              </label>
            );
          })}
        </div>

        <EntityAttachments db={db} entity={record} onPersist={onPersist} />

        <div className="entity-editor-footer">
          <span className="row-meta">System identity fields stay protected. All other fields are editable.</span>
          <button
            type="button"
            className="action danger"
            onClick={remove}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Deleting..." : "Delete Record"}
          </button>
          <button
            type="button"
            className="action"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="action primary"
            onClick={save}
            disabled={isSubmitting || hasJsonErrors}
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
