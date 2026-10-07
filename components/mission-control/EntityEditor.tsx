"use client";

import {useEffect,useMemo,useState} from "react";
import type {LifeOSDatabase,BaseEntity} from "@/domain/contracts/database";
import {updateEntityRecord} from "@/domain/services/operations";

type Editable={key:string;value:unknown;original:unknown};

function findRecord(db:LifeOSDatabase,type:string,id:string):BaseEntity|undefined{
 const aliases:Record<string,string>={account:"financial_account",transaction:"financial_transaction",maintenance:"vehicle_maintenance"}; type=aliases[type]??type;
 const collections=["events","openLoops","people","assets","accounts","transactions","loans","loanPayments","vehicles","vehicleMaintenance","properties","rooms","homeSystems","electricalDevices","projects","goals","decisions","documents","recurringRules","relationships"] as const;
 for(const name of collections){const item=(db[name] as BaseEntity[]).find(x=>x.id===id);if(item&&(type==="record"||item.entityType===type||name===type))return item}
 const attachment=db.attachments?.find(x=>x.id===id); if(attachment&&(!type||type==="attachment"))return attachment;
 return undefined;
}
function formatLabel(key:string){return key.replace(/([a-z])([A-Z])/g,"$1 $2").replaceAll("_"," ").replace(/^./,x=>x.toUpperCase())}
function parseValue(value:string,original:unknown){if(value==="")return undefined;if(typeof original==="number"){const n=Number(value);return Number.isFinite(n)?n:original}if(typeof original==="boolean")return value==="true";if(typeof original==="object"){try{return JSON.parse(value)}catch{return original}}return value}

export default function EntityEditor({db,onPersist}:{db:LifeOSDatabase;onPersist:(next:LifeOSDatabase,message:string)=>Promise<void>|void}){
 const [target,setTarget]=useState<{type:string;id:string}|null>(null); const [draft,setDraft]=useState<Editable[]>([]);
 useEffect(()=>{const handler=(event:Event)=>{const detail=(event as CustomEvent).detail as {id:string;type?:string};if(!detail?.id)return;setTarget({id:detail.id,type:detail.type??"record"})};window.addEventListener("lifeos:edit",handler);return()=>window.removeEventListener("lifeos:edit",handler)},[]);
 const record=useMemo(()=>target?findRecord(db,target.type,target.id):undefined,[db,target]);
 useEffect(()=>{if(!record){if(target)setTarget(null);return}setDraft(Object.entries(record).filter(([key])=>![ "id","entityType","createdAt","updatedAt","archivedAt"].includes(key)).map(([key,value])=>({key,value,original:value})))},[record]);
 if(!target||!record)return null;
 const vehicle=record.entityType==="vehicle";
 const save=async()=>{const changes:Record<string,unknown>={};for(const field of draft)changes[field.key]=parseValue(String(field.value??""),field.original);const next=updateEntityRecord(db,record.entityType,record.id,changes);await onPersist(next,"Updated "+record.entityType.replaceAll("_"," ")+" and recorded the change.");setTarget(null)};
 const title=vehicle?String(record.year??"")+" "+String(record.make??"")+" "+String(record.model??""):String((record as Record<string,unknown>).name??(record as Record<string,unknown>).title??(record as Record<string,unknown>).displayName??record.entityType);
 return <div className="modal-backdrop entity-editor-backdrop" onMouseDown={()=>setTarget(null)}>
  <div className="entity-editor-modal" onMouseDown={e=>e.stopPropagation()}>
   <div className="entity-detail-header"><div><div className="kicker">Edit Entity</div><h2>{title.trim()}</h2><div className="row-meta">{record.entityType.replaceAll("_"," ")} · {record.id}</div></div><button className="mini-action" onClick={()=>setTarget(null)}>Close</button></div>
   <div className="entity-editor-grid">
    {draft.map(field=>{const complex=typeof field.original==="object"&&field.original!==null;const inputValue=complex?(typeof field.value==="string"?field.value:JSON.stringify(field.value??null,null,2)):String(field.value??"");const isVin=vehicle&&field.key==="vin";return <label className={"field-label "+(isVin?"entity-editor-vin":"")} key={field.key}><span>{formatLabel(field.key)}{isVin&&<strong> EDITABLE</strong>}</span>{complex?<textarea className="command-input entity-editor-textarea" value={inputValue} onChange={e=>setDraft(v=>v.map(x=>x.key===field.key?{...x,value:e.target.value}:x))}/>:typeof field.original==="boolean"?<select className="command-input" value={String(field.value)} onChange={e=>setDraft(v=>v.map(x=>x.key===field.key?{...x,value:e.target.value}:x))}><option value="true">True</option><option value="false">False</option></select>:<input className="command-input" type={typeof field.original==="number"?"number":"text"} value={inputValue} onChange={e=>setDraft(v=>v.map(x=>x.key===field.key?{...x,value:e.target.value}:x))}/>}</label>})}
   </div>
   <div className="entity-editor-footer"><span className="row-meta">System identity fields stay protected. All other fields are editable.</span><button className="action" onClick={()=>setTarget(null)}>Cancel</button><button className="action primary" onClick={save}>Save Changes</button></div>
  </div>
 </div>;
}
