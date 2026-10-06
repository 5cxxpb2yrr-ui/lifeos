"use client";

import {useState} from "react";
import type {Event,EventType,EventStatus,LifeOSDatabase} from "@/domain/contracts/database";
import {resolveAttentionDetailed} from "@/domain/resolvers/attention";
import {updateEvent} from "@/domain/services/operations";
import {resolveGraph} from "@/domain/resolvers/graph";

export const EVENT_TYPES:EventType[]=["task","meeting","conversation","appointment","purchase","payment","income","expense","transfer","maintenance","repair","inspection","travel","decision","observation","milestone","document","communication","workout","learning","other"];
export const EVENT_STATUS:EventStatus[]=["planned","scheduled","in_progress","completed","cancelled","skipped","failed"];

function toInput(value?:string){
 if(!value)return "";
 const date=new Date(value);
 if(Number.isNaN(date.getTime()))return "";
 const pad=(n:number)=>String(n).padStart(2,"0");
 return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function fromInput(value:string){return value?new Date(value).toISOString():undefined;}

export default function EventPanel({db,eventId,onPersist,onClose,onContext,graph}:{db:LifeOSDatabase;eventId:string;onPersist:(next:LifeOSDatabase,message:string)=>void;onClose:()=>void;onContext:(kind:"person"|"asset"|"project"|"goal"|"loop"|"decision"|"transaction"|"document"|"graph",id:string)=>void;graph?:ReturnType<typeof resolveGraph>}){
 const event=db.events.find(e=>e.id===eventId);
 const [draft,setDraft]=useState<Event | null>(()=>event ? {...event} : null);
 if(!event || !draft)return null;
 const connectedPeople=db.people.filter(x=>event.personIds?.includes(x.id));
 const connectedAssets=db.assets.filter(x=>event.assetIds?.includes(x.id));
 const connectedLoops=db.openLoops.filter(x=>event.openLoopIds?.includes(x.id));
 const connectedDecisions=db.decisions.filter(x=>event.decisionIds?.includes(x.id));
 const connectedProjects=db.projects.filter(x=>event.projectIds?.includes(x.id));
 const connectedGoals=db.goals.filter(x=>event.goalIds?.includes(x.id));
 const connectedTransactions=db.transactions.filter(x=>event.financialTransactionIds?.includes(x.id));
 const connectedDocuments=db.documents.filter(x=>event.documentIds?.includes(x.id));
 const relatedGraph=db.relationships.filter(r=>r.fromId===event.id||r.toId===event.id).map(r=>({
  type:r.fromId===event.id?r.toType:r.fromType,
  id:r.fromId===event.id?r.toId:r.fromId,
  label:r.relationshipType.replaceAll("_"," ")
 }));
 const hasContext=connectedPeople.length+connectedAssets.length+connectedLoops.length+connectedDecisions.length+connectedProjects.length+connectedGoals.length+connectedTransactions.length+connectedDocuments.length+relatedGraph.length>0;
 const attention=resolveAttentionDetailed(event);
 const save=()=>{
  const next=updateEvent(db,event.id,{title:draft.title,description:draft.description,eventType:draft.eventType,status:draft.status,occurredAt:draft.occurredAt,startAt:draft.startAt,endAt:draft.endAt,dueAt:draft.dueAt,source:draft.source});
  onPersist(next,"Event updated and audit history recorded.");
 };
 return <div className="modal-backdrop" onMouseDown={onClose}>
  <div className="command-modal event-panel" onMouseDown={e=>e.stopPropagation()}>
   <div className="event-modal-header"><div><div className="kicker">Event Engine</div><h2>Event detail</h2></div><button className="mini-action" onClick={onClose}>Close</button></div>
   <div className="event-modal-body">
   <div className="event-status-line"><span className={"attention "+(attention.state==="overdue"?"overdue":attention.state==="blocked"?"blocked":"")}>{attention.state.replaceAll("_"," ")}</span><span className="row-meta">{attention.reason}</span></div>
   <section className="event-context" aria-label="Connected context">
    <div className="event-context-heading"><span className="kicker">Connected context</span><span className="row-meta">{hasContext?"From the LifeOS graph":"No linked context"}</span></div>
    {hasContext&&<div className="event-context-chips">
      {connectedPeople.map(x=><button className="context-chip context-chip-button" key={"person-"+x.id} onClick={()=>onContext("person",x.id)}>Person · {x.displayName}</button>)}
      {connectedAssets.map(x=><button className="context-chip context-chip-button" key={"asset-"+x.id} onClick={()=>onContext("asset",x.id)}>Asset · {x.name}</button>)}
      {connectedProjects.map(x=><button className="context-chip context-chip-button" key={"project-"+x.id} onClick={()=>onContext("project",x.id)}>Project · {x.name}</button>)}
      {connectedGoals.map(x=><button className="context-chip context-chip-button" key={"goal-"+x.id} onClick={()=>onContext("goal",x.id)}>Goal · {x.name}</button>)}
      {connectedLoops.map(x=><button className="context-chip context-chip-button" key={"loop-"+x.id} onClick={()=>onContext("loop",x.id)}>Loop · {x.title}</button>)}
      {connectedDecisions.map(x=><button className="context-chip context-chip-button" key={"decision-"+x.id} onClick={()=>onContext("decision",x.id)}>Decision · {x.question}</button>)}
      {connectedTransactions.map(x=><button className="context-chip context-chip-button" key={"tx-"+x.id} onClick={()=>onContext("transaction",x.id)}>Transaction · {x.description??x.merchant??"Financial transaction"}</button>)}
      {connectedDocuments.map(x=><button className="context-chip context-chip-button" key={"doc-"+x.id} onClick={()=>onContext("document",x.id)}>Document · {x.name}</button>)}
      {relatedGraph.map(x=><button className="context-chip context-chip-button" key={"rel-"+x.id+"-"+x.type} onClick={()=>onContext("graph",x.id)}>Graph · {x.type} · {x.label}</button>)}
    </div>}
   </section>
   {graph&&<section className="selected-graph"><div className="section-title"><div><div className="kicker">Graph Neighborhood</div><span className="row-meta">{graph.center?.label??"Selected event"}</span></div><span className="badge">{graph.edges.length}</span></div>{graph.edges.length?<div className="selected-graph-list">{graph.edges.map((edge,i)=><div className="selected-graph-row" key={edge.from.id+edge.to.id+edge.relationship+i}><span className="graph-node-label">{edge.from.label}</span><span className="graph-relationship">→ {edge.relationship.replaceAll("_"," ")} →</span><span className="graph-node-label">{edge.to.label}</span></div>)}</div>:<div className="row-meta">No direct relationships for this event.</div>}</section>}<section className="event-edit-section">
    <div className="event-edit-section-heading"><span className="kicker">Core</span><span className="row-meta">What happened</span></div>
    <label className="field-label">Title<input className="command-input" value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
    <label className="field-label">Description<textarea className="command-input" value={draft.description??""} onChange={e=>setDraft({...draft,description:e.target.value})}/></label>
   </section>
   <section className="event-edit-section">
    <div className="event-edit-section-heading"><span className="kicker">Classification</span><span className="row-meta">How LifeOS treats it</span></div>
    <div className="field-grid">
     <label className="field-label">Type<select className="command-input" value={draft.eventType} onChange={e=>setDraft({...draft,eventType:e.target.value as EventType})}>{EVENT_TYPES.map(x=><option key={x}>{x}</option>)}</select></label>
     <label className="field-label">Status<select className="command-input" value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value as EventStatus})}>{EVENT_STATUS.map(x=><option key={x}>{x}</option>)}</select></label>
    </div>
   </section>
   <section className="event-edit-section">
    <div className="event-edit-section-heading"><span className="kicker">Timing</span><span className="row-meta">Local time</span></div>
    <div className="field-grid">
     <label className="field-label">Start<input className="command-input" type="datetime-local" value={toInput(draft.startAt)} onChange={e=>setDraft({...draft,startAt:fromInput(e.target.value)})}/></label>
     <label className="field-label">Due<input className="command-input" type="datetime-local" value={toInput(draft.dueAt)} onChange={e=>setDraft({...draft,dueAt:fromInput(e.target.value)})}/></label>
    </div>
   </section>
   <details className="event-edit-section event-edit-advanced">
    <summary><span><span className="kicker">Metadata</span><span className="row-meta">Source + audit timestamps</span></span><span>⌄</span></summary>
    <label className="field-label">Source<input className="command-input" value={draft.source??""} onChange={e=>setDraft({...draft,source:e.target.value||undefined})} placeholder="manual, import, email, system…"/></label>
    <div className="row-meta">Created {new Date(event.createdAt).toLocaleString()} · Updated {new Date(event.updatedAt).toLocaleString()}</div>
   </details>
   </div>
   <div className="event-modal-footer"><button className="action primary full" onClick={save}>Save event</button></div>
  </div>
 </div>;
}
