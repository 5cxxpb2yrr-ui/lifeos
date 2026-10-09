"use client";

import type { LifeOSDatabase } from "@/domain/contracts/database";
import { resolveContextEngine, type ContextReference } from "@/domain/resolvers/context-engine";

type Props = { db: LifeOSDatabase; centerId: string; onNavigate?: (id: string, type: string) => void };

export default function ContextEnginePanel({ db, centerId, onNavigate }: Props) {
  const context = resolveContextEngine(db, centerId);
  if (!context.center) return null;
  const openReference = (item: ContextReference) => {
    if (onNavigate) onNavigate(item.id, item.type);
    else window.dispatchEvent(new CustomEvent("lifeos:navigate", { detail: { kind: "graph", id: item.id, type: item.type } }));
  };
  const nextDue = context.nextDueAt ? new Date(context.nextDueAt).toLocaleString() : null;
  const groups = [
    { title: "Related events", items: context.relatedEvents.map((x) => ({ id: x.id, type: "event", label: x.title, meta: x.dueAt ?? x.startAt ?? x.status })) },
    { title: "Open loops", items: context.openLoops.map((x) => ({ id: x.id, type: "open_loop", label: x.title, meta: [x.status, x.dueAt ? "Due " + new Date(x.dueAt).toLocaleDateString() : ""].filter(Boolean).join(" · ") })) },
    { title: "Decisions", items: context.decisions.map((x) => ({ id: x.id, type: "decision", label: "question" in x ? x.question : x.id, meta: "Decision" })) },
    { title: "Projects", items: context.projects.map((x) => ({ id: x.id, type: "project", label: "name" in x ? x.name : x.id, meta: "Project" })) },
    { title: "Documents", items: context.documents.map((x) => ({ id: x.id, type: "document", label: "name" in x ? x.name : x.id, meta: "Document" })) },
  ].map((group) => ({ ...group, items: group.items.filter((item) => item.id !== centerId) }));
  return <section className="context-engine-panel card">
    <div className="section-title"><h3>Context from the graph</h3><span className="badge">Derived</span></div>
    <p className="row-meta">Read-only context assembled from linked LifeOS records. Canonical records are unchanged.</p>
    {nextDue && <div className="row"><div className="row-main"><div className="row-title">Next due</div><div className="row-meta">{nextDue}</div></div></div>}
    {groups.map((group) => group.items.length > 0 && <div className="context-engine-group" key={group.title}>
      <div className="kicker">{group.title} · {group.items.length}</div>
      {group.items.slice(0, 4).map((item) => <button className="row context-engine-item" key={item.id} onClick={() => openReference({ id: item.id, type: item.type, label: item.label, relationship: "context", direction: "outgoing" })}>
        <span className="row-main"><span className="row-title">{item.label}</span><span className="row-meta">{item.meta}</span></span><span aria-hidden="true">›</span>
      </button>)}
    </div>)}
    {groups.every((group) => group.items.length === 0) && <div className="row"><div className="row-meta">No directly linked events, open loops, decisions, projects, or documents yet.</div></div>}
  </section>;
}
