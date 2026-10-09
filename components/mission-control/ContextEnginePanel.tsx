"use client";

import { useState } from "react";
import type { LifeOSDatabase } from "@/domain/contracts/database";
import { resolveContextEngine, type ContextReference } from "@/domain/resolvers/context-engine";

type ContextItem = { id: string; type: string; label: string; meta: string };
type ContextGroup = { title: string; items: ContextItem[] };
type Props = { db: LifeOSDatabase; centerId: string; onNavigate?: (id: string, type: string) => void };

export default function ContextEnginePanel({ db, centerId, onNavigate }: Props) {
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const context = resolveContextEngine(db, centerId);
  if (!context.center) return null;
  const openReference = (item: ContextReference) => {
    if (onNavigate) onNavigate(item.id, item.type);
    else {
      const kind = item.type === "event" ? "event" : item.type === "open_loop" ? "loop" : item.type === "loan_payment" ? "payment" : ["account", "loan", "vehicle", "property"].includes(item.type) ? item.type : "graph";
      window.dispatchEvent(new CustomEvent("lifeos:navigate", { detail: { kind, id: item.id, type: item.type } }));
    }
  };
  const nextDue = context.nextDueAt ? new Date(context.nextDueAt).toLocaleString() : null;
  const groups: ContextGroup[] = [
    { title: "Related events", items: context.relatedEvents.map((x) => ({ id: x.id, type: "event", label: x.title, meta: x.dueAt ?? x.startAt ?? x.status })) },
    { title: "Open loops", items: context.openLoops.map((x) => ({ id: x.id, type: "open_loop", label: x.title, meta: [x.status, x.dueAt ? "Due " + new Date(x.dueAt).toLocaleDateString() : ""].filter(Boolean).join(" · ") })) },
    { title: "Decisions", items: context.decisions.map((x) => ({ id: x.id, type: "decision", label: "question" in x && typeof x.question === "string" ? x.question : "title" in x && typeof x.title === "string" ? x.title : "Decision", meta: "Decision" })) },
    { title: "Projects", items: context.projects.map((x) => ({ id: x.id, type: "project", label: "name" in x && typeof x.name === "string" ? x.name : "title" in x && typeof x.title === "string" ? x.title : "Project", meta: "Project" })) },
    { title: "Documents", items: context.documents.map((x) => ({ id: x.id, type: "document", label: "name" in x && typeof x.name === "string" ? x.name : "title" in x && typeof x.title === "string" ? x.title : "Document", meta: "Document" })) },
  ].map((group) => ({ ...group, items: group.items.filter((item) => item.id !== centerId) }));
  const representedIds = new Set(groups.flatMap((group) => group.items.map((item) => item.id)));
  const otherReferences: ContextItem[] = context.references
    .filter((reference) => reference.id !== centerId && !representedIds.has(reference.id))
    .filter((reference, index, all) => all.findIndex((candidate) => candidate.id === reference.id) === index)
    .map((reference) => ({
      id: reference.id,
      type: reference.type,
      label: reference.label?.trim() || reference.type.replaceAll("_", " "),
      meta: [reference.type.replaceAll("_", " "), reference.relationship.replaceAll("_", " "), reference.direction === "incoming" ? "Links to this record" : "Linked from this record"].join(" · "),
    }));
  if (otherReferences.length) groups.push({ title: "Other linked records", items: otherReferences });
  return <section className="context-engine-panel card">
    <div className="section-title"><h3>Context from the graph</h3><span className="badge">Derived</span></div>
    <p className="row-meta">Read-only context assembled from linked LifeOS records. Canonical records are unchanged.</p>
    {nextDue && <div className="row"><div className="row-main"><div className="row-title">Next due</div><div className="row-meta">{nextDue}</div></div></div>}
    {groups.map((group) => group.items.length > 0 && <div className="context-engine-group" key={group.title}>
      <div className="section-title"><div className="kicker">{group.title} · {group.items.length}</div>{group.items.length > 4 && <button type="button" className="mini-action" aria-expanded={expandedGroups.includes(group.title)} onClick={() => setExpandedGroups((current) => current.includes(group.title) ? current.filter((title) => title !== group.title) : [...current, group.title])}>{expandedGroups.includes(group.title) ? "Show less" : "Show all " + group.items.length}</button>}</div>
      {(expandedGroups.includes(group.title) ? group.items : group.items.slice(0, 4)).map((item) => <button className="row context-engine-item" key={item.id} onClick={() => openReference({ id: item.id, type: item.type, label: item.label, relationship: "context", direction: "outgoing" })}>
        <span className="row-main"><span className="row-title">{item.label}</span><span className="row-meta">{item.meta}</span></span><span aria-hidden="true">›</span>
      </button>)}
    </div>)}
    {groups.every((group) => group.items.length === 0) && <div className="row"><div className="row-meta">No directly linked records yet.</div></div>}
  </section>;
}
