"use client";

import {useState} from "react";
import type {Event,EventType,EventStatus,LifeOSDatabase} from "@/domain/contracts/database";
import {resolveAttentionDetailed} from "@/domain/resolvers/attention";
import {updateEvent} from "@/domain/services/operations";

const EVENT_TYPES:EventType[]=["task","meeting","conversation","appointment","purchase","payment","income","expense","transfer","maintenance","repair","inspection","travel","decision","observation","milestone","document","communication","workout","learning","other"];
const EVENT_STATUS:EventStatus[]=["planned","scheduled","in_progress","completed","cancelled","skipped","failed"];

function toInput(value?:string){return value?value.slice(0,16):"";}

export default function EventPanel({db,eventId,onPersist,onClose}:{db:LifeOSDatabase;eventId:string;onPersist:(next:LifeOSDatabase,message:string)=>void;onClose:()=>void}){
 const event=db.events.find(e=>e.id===eventId);
 const [draft,setDraft]=useState<Event | null>(()=>event ? {...event} : null);
 if(!event || !draft)return null;
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
