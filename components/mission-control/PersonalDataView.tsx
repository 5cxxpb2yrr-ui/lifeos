"use client";

import {useMemo,useState} from "react";
import type {BaseEntity,LifeOSDatabase} from "@/domain/contracts/database";
import {createPerson} from "@/domain/services/operations";
import {attachmentsForEntity} from "@/domain/services/attachments";

type Tab="overview"|"people"|"relationships"|"events"|"loops"|"goals"|"decisions"|"documents";

function labelOf(entity:BaseEntity):string{
 const e=entity as BaseEntity & Record<string,unknown>;
 return String(e.displayName??e.title??e.name??e.question??(entity.entityType.replaceAll("_"," ")));
}
function metaOf(entity:BaseEntity):string{
 const e=entity as BaseEntity & Record<string,unknown>;
 const bits=[entity.entityType.replaceAll("_"," ")];
 if(typeof e.status==="string")bits.push(e.status);
 if(typeof e.dueAt==="string")bits.push("due "+new Date(e.dueAt).toLocaleDateString());
 if(typeof e.startAt==="string")bits.push(new Date(e.startAt).toLocaleDateString());
 return bits.join(" · ");
}
function linkedToPerson(entity:BaseEntity,personId:string):boolean{
 const e=entity as BaseEntity & Record<string,unknown>;
 return Object.entries(e).some(([key,value])=>{
  if(key==="id"||key==="metadata")return false;
  if(key.endsWith("Id")&&value===personId)return true;
  if(key.endsWith("Ids")&&Array.isArray(value)&&value.includes(personId))return true;
  return false;
 });
}
function navigate(id:string,type:string){window.dispatchEvent(new CustomEvent("lifeos:navigate",{detail:{kind:"graph",id,type}}));}
function edit(id:string,type:string){window.dispatchEvent(new CustomEvent("lifeos:edit",{detail:{id,type}}));}

export default function PersonalDataView({db,onPersist}:{db:LifeOSDatabase;onPersist:(next:LifeOSDatabase,message:string)=>Promise<void>|void}){
 const [tab,setTab]=useState<Tab>("overview");
 const [selectedPerson,setSelectedPerson]=useState<string|null>(null);
 const [filter,setFilter]=useState("");
 const person=selectedPerson?db.people.find(p=>p.id===selectedPerson):undefined;
 const personEvents=useMemo(()=>person?db.events.filter(e=>linkedToPerson(e,person.id)).sort((a,b)=>(b.startAt??b.updatedAt).localeCompare(a.startAt??a.updatedAt)):[],[db,person]);
 const personLoops=useMemo(()=>person?db.openLoops.filter(e=>linkedToPerson(e,person.id)).sort((a,b)=>(a.dueAt??"9999").localeCompare(b.dueAt??"9999")):[],[db,person]);
 const personProjects=useMemo(()=>person?db.projects.filter(e=>linkedToPerson(e,person.id)):[],[db,person]);
 const personGoals=useMemo(()=>person?db.goals.filter(e=>linkedToPerson(e,person.id)):[],[db,person]);
 const personDecisions=useMemo(()=>person?db.decisions.filter(e=>linkedToPerson(e,person.id)):[],[db,person]);
 const personDocs=useMemo(()=>person?db.documents.filter(e=>linkedToPerson(e,person.id)):[],[db,person]);
 const personAttachments=useMemo(()=>person?attachmentsForEntity(db,person.id,person.entityType):[],[db,person]);
 const relationships=useMemo(()=>person?db.relationships.filter(r=>r.fromId===person.id||r.toId===person.id):db.relationships,[db,person]);
 const people=useMemo(()=>db.people.filter(p=>!filter||p.displayName.toLowerCase().includes(filter.toLowerCase())||p.email?.some(x=>x.toLowerCase().includes(filter.toLowerCase()))||p.phone?.some(x=>x.includes(filter))),[db,filter]);
 const allEvents=useMemo(()=>db.events.slice().sort((a,b)=>(b.startAt??b.updatedAt).localeCompare(a.startAt??a.updatedAt)),[db]);
 const allLoops=useMemo(()=>db.openLoops.filter(x=>x.status!=="resolved"&&x.status!=="cancelled").sort((a,b)=>(a.dueAt??"9999").localeCompare(b.dueAt??"9999")),[db]);
 const upcoming=allEvents.filter(e=>e.startAt&&new Date(e.startAt).getTime()>=Date.now()).slice(0,8);
 const recent=allEvents.filter(e=>!e.startAt||new Date(e.startAt).getTime()<Date.now()).slice(0,6);
 const addPerson=async()=>{
  const name=window.prompt("Person name");
  if(!name?.trim())return;
  const notes=window.prompt("Notes (optional)")??undefined;
  await onPersist(createPerson(db,{displayName:name.trim(),notes}),"Personal contact created.");
  setTab("people");
 };
 const tabs:Array<[Tab,string]>=[["overview","Overview"],["people","People"],["relationships","Relationships"],["events","Appointments & Events"],["loops","Open Loops"],["goals","Goals & Projects"],["decisions","Decisions"],["documents","Documents & Attachments"]];
 const Row=({entity,personRow=false}:{entity:BaseEntity;personRow?:boolean})=><button className="row entity-row" onClick={()=>personRow?(setSelectedPerson(entity.id),setTab("overview")):navigate(entity.id,entity.entityType)}><div className="row-main"><div className="row-title">{labelOf(entity)}</div><div className="row-meta">{metaOf(entity)}</div></div>{personRow&&<span className="badge">{attachmentsForEntity(db,entity.id).length} files</span>}</button>;
 const PersonContext=()=>person?<section className="card"><div className="section-title"><div><div className="kicker">Selected Person</div><h2>{person.displayName}</h2><div className="row-meta">{person.organization??"Personal contact"}{person.email?.length?" · "+person.email.join(", "):""}{person.phone?.length?" · "+person.phone.join(", "):""}</div></div><div className="section-title-actions"><button className="mini-action" onClick={()=>edit(person.id,person.entityType)}>Edit</button><button className="mini-action" onClick={()=>setSelectedPerson(null)}>Clear</button></div></div>{person.notes&&<p className="entity-detail-description">{person.notes}</p>}<div className="metric-grid"><Metric label="Events" value={String(personEvents.length)}/><Metric label="Open loops" value={String(personLoops.length)}/><Metric label="Projects / goals" value={String(personProjects.length+personGoals.length)}/><Metric label="Files" value={String(personAttachments.length+personDocs.length)}/></div><div className="personal-context-grid"><Context title="Relationships" items={relationships.map(r=>{const id=r.fromId===person.id?r.toId:r.fromId;const p=db.people.find(x=>x.id===id);return {id:r.id,label:p?.displayName??r.relationshipType.replaceAll("_"," "),meta:r.relationshipType.replaceAll("_"," "),type:r.entityType};})}/><Context title="Upcoming events" items={personEvents.slice(0,5).map(e=>({id:e.id,label:e.title,meta:e.startAt?new Date(e.startAt).toLocaleString():"Event",type:e.entityType}))}/><Context title="Open loops" items={personLoops.slice(0,5).map(e=>({id:e.id,label:e.title,meta:e.dueAt?new Date(e.dueAt).toLocaleDateString():e.priority??"open",type:e.entityType}))}/><Context title="Projects & goals" items={[...personProjects,...personGoals].slice(0,6).map(e=>({id:e.id,label:labelOf(e),meta:e.entityType,type:e.entityType}))}/><Context title="Decisions" items={personDecisions.slice(0,5).map(e=>({id:e.id,label:labelOf(e),meta:metaOf(e),type:e.entityType}))}/><Context title="Documents & attachments" items={[...personDocs,...personAttachments].slice(0,8).map(e=>({id:e.id,label:labelOf(e),meta:e.entityType==="attachment"?"Attachment":metaOf(e),type:e.entityType}))}/></div></section>:null;
 return <div className="data-view personal-data-view">
  <section className="card personal-data-header"><div><div className="kicker">Personal Graph</div><h2>Personal Data</h2><p className="row-meta">People are the center of context. Follow a person into relationships, appointments, loops, goals, decisions, documents, and attachments.</p></div><div className="tool-actions"><button className="action primary" onClick={addPerson}>＋ Add Person</button>{person&&<button className="action" onClick={()=>edit(person.id,person.entityType)}>Edit Person</button>}</div></section>
  <div className="tabs" role="tablist">{tabs.map(([id,name])=><button key={id} role="tab" aria-selected={tab===id} className={tab===id?"active":""} onClick={()=>setTab(id)}>{name}</button>)}</div>
  {person&&<PersonContext/>}
  {tab==="overview"&&<div className="mission-top-grid"><section className="card"><div className="section-title"><h2>People</h2><span className="badge">{db.people.length}</span></div><div className="list">{people.slice(0,8).map(p=><Row key={p.id} entity={p} personRow/>)}{!people.length&&<Empty text="No people yet."/>}</div></section><section className="card"><div className="section-title"><h2>Attention in Personal Graph</h2><span className="badge">{allLoops.length}</span></div><div className="list">{allLoops.slice(0,8).map(x=><Row key={x.id} entity={x}/>)}{!allLoops.length&&<Empty text="No open personal loops."/>}</div></section><section className="card"><div className="section-title"><h2>Upcoming Appointments</h2><span className="badge">{upcoming.length}</span></div><div className="list">{upcoming.map(x=><Row key={x.id} entity={x}/>)}{!upcoming.length&&<Empty text="No upcoming appointments or scheduled events."/>}</div></section><section className="card"><div className="section-title"><h2>Recent Activity</h2><span className="badge">{recent.length}</span></div><div className="list">{recent.map(x=><Row key={x.id} entity={x}/>)}</div></section></div>}
  {tab==="people"&&<section className="card"><div className="section-title"><div><h2>People & Contacts</h2><span className="row-meta">Select a person to make their entire graph the working context.</span></div><input className="command-input" style={{maxWidth:240}} value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Filter people…"/></div><div className="list">{people.map(p=><Row key={p.id} entity={p} personRow/>)}{!people.length&&<Empty text="No matching people."/>}</div></section>}
  {tab==="relationships"&&<section className="card"><div className="section-title"><h2>{person?"Relationships for "+person.displayName:"All Relationships"}</h2><span className="badge">{relationships.length}</span></div><div className="list">{relationships.map(r=><button className="row entity-row" key={r.id} onClick={()=>navigate(r.id,r.entityType)}><div className="row-main"><div className="row-title">{db.people.find(p=>p.id===r.fromId)?.displayName??r.fromId} ↔ {db.people.find(p=>p.id===r.toId)?.displayName??r.toId}</div><div className="row-meta">{r.relationshipType.replaceAll("_"," ")}</div></div></button>)}{!relationships.length&&<Empty text="No relationships recorded yet."/>}</div></section>}
  {tab==="events"&&<section className="card"><div className="section-title"><h2>{person?"Appointments & Events · "+person.displayName:"Appointments & Events"}</h2><span className="badge">{person?personEvents.length:allEvents.length}</span></div><div className="list">{(person?personEvents:allEvents).map(x=><Row key={x.id} entity={x}/>)}{!(person?personEvents:allEvents).length&&<Empty text="No events connected to this context."/>}</div></section>}
  {tab==="loops"&&<section className="card"><div className="section-title"><h2>{person?"Open Loops · "+person.displayName:"Open Loops"}</h2><span className="badge">{person?personLoops.length:allLoops.length}</span></div><div className="list">{(person?personLoops:allLoops).map(x=><Row key={x.id} entity={x}/>)}{!(person?personLoops:allLoops).length&&<Empty text="No open loops."/>}</div></section>}
  {tab==="goals"&&<div className="mission-top-grid"><section className="card"><div className="section-title"><h2>{person?"Projects · "+person.displayName:"Projects"}</h2><span className="badge">{person?personProjects.length:db.projects.length}</span></div><div className="list">{(person?personProjects:db.projects).map(x=><Row key={x.id} entity={x}/>)}{!(person?personProjects:db.projects).length&&<Empty text="No projects."/>}</div></section><section className="card"><div className="section-title"><h2>{person?"Goals · "+person.displayName:"Goals"}</h2><span className="badge">{person?personGoals.length:db.goals.length}</span></div><div className="list">{(person?personGoals:db.goals).map(x=><Row key={x.id} entity={x}/>)}{!(person?personGoals:db.goals).length&&<Empty text="No goals."/>}</div></section></div>}
  {tab==="decisions"&&<section className="card"><div className="section-title"><h2>{person?"Decisions · "+person.displayName:"Decisions"}</h2><span className="badge">{person?personDecisions.length:db.decisions.length}</span></div><div className="list">{(person?personDecisions:db.decisions).map(x=><Row key={x.id} entity={x}/>)}{!(person?personDecisions:db.decisions).length&&<Empty text="No decisions."/>}</div></section>}
  {tab==="documents"&&<div className="mission-top-grid"><section className="card"><div className="section-title"><h2>Documents</h2><span className="badge">{person?personDocs.length:db.documents.length}</span></div><div className="list">{(person?personDocs:db.documents).map(x=><Row key={x.id} entity={x}/>)}{!(person?personDocs:db.documents).length&&<Empty text="No documents."/>}</div></section><section className="card"><div className="section-title"><h2>Attachments</h2><span className="badge">{person?personAttachments.length:(db.attachments??[]).length}</span></div><div className="list">{(person?personAttachments:(db.attachments??[])).map(x=><Row key={x.id} entity={x}/>)}{!(person?personAttachments:(db.attachments??[])).length&&<Empty text="No attachments."/>}</div></section></div>}
 </div>;
}

function Metric({label,value}:{label:string;value:string}){return <div className="card metric-card"><div className="metric-label">{label}</div><div className="metric-value">{value}</div></div>}
function Context({title,items}:{title:string;items:Array<{id:string;label:string;meta:string;type:string}>}){return <section className="card"><div className="section-title"><h3>{title}</h3><span className="badge">{items.length}</span></div><div className="list">{items.slice(0,8).map(x=><button className="row entity-row" key={x.id} onClick={()=>navigate(x.id,x.type)}><div className="row-main"><div className="row-title">{x.label}</div><div className="row-meta">{x.meta}</div></div></button>)}{!items.length&&<Empty text="None connected."/>}</div></section>}
function Empty({text}:{text:string}){return <div className="row"><div className="row-meta">{text}</div></div>}
