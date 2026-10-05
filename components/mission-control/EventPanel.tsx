"use client";

import {useState} from "react";
import type {Event,EventType,EventStatus,LifeOSDatabase} from "@/domain/contracts/database";
import {resolveAttentionDetailed} from "@/domain/resolvers/attention";
import {updateEvent} from "@/domain/services/operations";

const EVENT_TYPES:EventType[]=["task","meeting","conversation","appointment","purchase","payment","income","expense","transfer","maintenance","repair","inspection","travel","decision","observation","milestone","document","communication","workout","learning","other"];
const EVENT_STATUS:EventStatus[]=["planned","scheduled","in_progress","completed","cancelled","skipped","failed"];

function toInput(value?:string){return value?value.slice(0,16):"";}

export default function EventPanel({db,eventId,onPersist,onClose,onContext}:{db:LifeOSDatabase;eventId:string;onPersist:(next:LifeOSDatabase,message:string)=>void;onClose:()=>void;onContext:(kind:"person"|"asset"|"project"|"goal"|"loop"|"decision"|"transaction"|"document"|"graph",id:string)=>void}){
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
   <label className="field-label">Title<input className="command-input" value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
   <label className="field-label">Description<textarea className="command-input" value={draft.description??""} onChange={e=>setDraft({...draft,description:e.target.value})}/></label>
   <div className="field-grid">
    <label className="field-label">Type<select className="command-input" value={draft.eventType} onChange={e=>setDraft({...draft,eventType:e.target.value as EventType})}>{EVENT_TYPES.map(x=><option key={x}>{x}</option>)}</select></label>
    <label className="field-label">Status<select className="command-input" value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value as EventStatus})}>{EVENT_STATUS.map(x=><option key={x}>{x}</option>)}</select></label>
   </div>
   <div className="field-grid">
    <label className="field-label">Start<input className="command-input" type="datetime-local" value={toInput(draft.startAt)} onChange={e=>setDraft({...draft,startAt:e.target.value?new Date(e.target.value).toISOString():undefined})}/></label>
    <label className="field-label">Due<input className="command-input" type="datetime-local" value={toInput(draft.dueAt)} onChange={e=>setDraft({...draft,dueAt:e.target.value?new Date(e.target.value).toISOString():undefined})}/></label>
   </div>
   <label className="field-label">Source<input className="command-input" value={draft.source??""} onChange={e=>setDraft({...draft,source:e.target.value||undefined})} placeholder="manual, import, email, system…"/></label>
   <div className="row-meta">Created {new Date(event.createdAt).toLocaleString()} · Updated {new Date(event.updatedAt).toLocaleString()}</div>
   </div>
   <div className="event-modal-footer"><button className="action primary full" onClick={save}>Save event</button></div>
  </div>
 </div>;
}
