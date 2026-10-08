"use client";

import {useMemo,useState} from "react";
import type {LifeOSDatabase,CollectionName} from "@/domain/contracts/database";

type EditableCollection=Exclude<CollectionName,"entities"|"auditEntries">;
type Props={db:LifeOSDatabase;onPersist:(db:LifeOSDatabase,message:string)=>Promise<boolean>|boolean;onNotice:(message:string)=>void};

const collectionLabels:Record<EditableCollection,string>={
 events:"Events",openLoops:"Open Loops",people:"People",assets:"Assets",accounts:"Accounts",transactions:"Transactions",
 loans:"Loans",loanPayments:"Loan Payments",vehicles:"Vehicles",vehicleMaintenance:"Maintenance",properties:"Properties",
 rooms:"Rooms",homeSystems:"Home Systems",electricalDevices:"Electrical Devices",projects:"Projects",goals:"Goals",
 decisions:"Decisions",documents:"Documents",recurringRules:"Recurring Rules",relationships:"Relationships"
};

const collectionOrder=Object.keys(collectionLabels) as EditableCollection[];
const standardFields:Record<EditableCollection,string[]>={
 events:["title","eventType","status","description","startAt","endAt","dueAt","occurredAt","source"],
 openLoops:["title","type","status","priority","description","dueAt","waitingOnPersonId","ownerPersonId"],
 people:["displayName","firstName","middleName","lastName","organization","email","phone","notes"],
 assets:["name","assetType","description","acquisitionDate","acquisitionCostMinor","currency","status"],
 accounts:["name","institution","accountType","currency","openingBalanceMinor","closedAt"],
 transactions:["transactionType","transactionDate","amountMinor","currency","accountId","merchant","description","categoryId","loanId","vehicleId","propertyId","eventId","externalReference"],
 loans:["name","provider","loanType","merchant","purchaseDescription","originalPrincipalMinor","currency","aprBasisPoints","originationDate","firstPaymentDate","scheduledPaymentMinor","paymentFrequency","totalPayments","remainingPayments","linkedAccountId","status"],
 loanPayments:["loanId","transactionId","scheduledDate","paidDate","scheduledAmountMinor","paidAmountMinor","principalMinor","interestMinor","feeMinor","status"],
 vehicles:["assetId","year","make","model","trim","vin","licensePlate","purchaseDate","purchasePriceMinor","currentMileage","mileageUnit","status"],
 vehicleMaintenance:["vehicleId","date","mileage","serviceType","description","vendor","costMinor","currency","nextDueDate","nextDueMileage"],
 properties:["assetId","name","propertyType","address","acquisitionDate","acquisitionCostMinor","status"],
 rooms:["propertyId","name","roomType","floor","notes"],
 homeSystems:["propertyId","systemType","name","manufacturer","model","serialNumber","installedDate","warrantyExpiration","notes"],
 electricalDevices:["propertyId","roomId","deviceType","name","circuitId","panelId","location","controlsDeviceIds","notes"],
 projects:["name","description","status","startDate","targetDate","ownerPersonId"],
 goals:["name","description","level","status","parentGoalId","targetDate","targetValue","currentValue","unit"],
 decisions:["question","context","selectedOptionId","decidedAt","reviewDate","outcome","options"],
 documents:["name","documentType","mimeType","storageReference","checksum","documentDate"],
 recurringRules:["name","eventType","frequency","interval","startDate","endDate","nextOccurrence","enabled","template"],
 relationships:["fromId","fromType","toId","toType","relationshipType","validFrom","validTo"]
};

const enumOptions:Record<string,string[]>={
 eventType:["task","meeting","conversation","appointment","purchase","payment","income","expense","transfer","maintenance","repair","inspection","travel","decision","observation","milestone","document","communication","workout","learning","other"],
 status:["planned","scheduled","in_progress","completed","cancelled","skipped","failed","open","waiting","blocked","resolved","active","paused","sold","owned","inactive","disposed","paid_off","defaulted","closed","partial","missed","critical","low","normal","high"],
 type:["task","question","follow_up","waiting","decision","risk","commitment","other"],
 priority:["low","normal","high","critical"],
 assetType:["cash","investment","vehicle","property","equipment","skill","document","other"],
 accountType:["checking","savings","cash","credit_card","loan","investment","other"],
 transactionType:["income","expense","transfer","payment","refund","adjustment"],
 loanType:["installment","credit","mortgage","auto","personal","other"],
 paymentFrequency:["weekly","biweekly","monthly","quarterly","other"],
 loanPaymentStatus:["scheduled","paid","partial","missed","cancelled"],
 mileageUnit:["mi","km"],
 propertyType:["house","condo","apartment","land","other"],
 systemType:["electrical","plumbing","hvac","roof","security","appliance","other"],
 deviceType:["panel","breaker","circuit","outlet","switch","fixture","other"],
 projectStatus:["planned","active","paused","completed","cancelled"],
 level:["annual","quarterly","monthly","weekly"],
 documentType:["receipt","contract","statement","insurance","warranty","manual","plan","photo","other"],
 frequency:["daily","weekly","biweekly","monthly","quarterly","yearly","custom"],
 relationshipType:["related_to","person_for","owns","uses","belongs_to","part_of","located_in","supports","depends_on","created_by","assigned_to","linked_to","caused_by","documents","scheduled_for","paid_by","payment_for","maintenance_for","child_of","parent_of","member_of"]
};

const label=(key:string)=>key.replace(/([a-z])([A-Z])/g,"$1 $2").replace(/_/g," ").replace(/^./,x=>x.toUpperCase());

function makeId(type:string){return "rec_"+type+"_"+Math.random().toString(36).slice(2,10)+"_"+Date.now().toString(36)}
function now(){return new Date().toISOString()}
function defaultRecord(collection:EditableCollection):Record<string,unknown>{
 const id=makeId(collection); const base:Record<string,unknown>={id,entityType:collection==="openLoops"?"open_loop":collection==="loanPayments"?"loan_payment":collection==="vehicleMaintenance"?"vehicle_maintenance":collection==="accounts"?"financial_account":collection==="transactions"?"financial_transaction":collection==="homeSystems"?"home_system":collection==="electricalDevices"?"electrical_device":collection==="recurringRules"?"recurring_rule":collection==="relationships"?"relationship":collection.slice(0,-1),createdAt:now(),updatedAt:now()};
 for(const key of standardFields[collection]){if(key==="status")base[key]=collection==="events"?"planned":collection==="openLoops"?"open":collection==="loans"?"active":collection==="loanPayments"?"scheduled":collection==="vehicles"?"owned":collection==="properties"?"owned":collection==="projects"?"planned":collection==="goals"?"planned":collection==="recurringRules"?true:""; else if(key==="currency")base[key]="USD"; else if(key==="enabled")base[key]=true; else if(key==="eventType")base[key]="other"; else if(key==="type")base[key]=collection==="openLoops"?"task":""; else if(key==="priority")base[key]="normal"; else if(key==="assetType")base[key]="other"; else if(key==="accountType")base[key]="checking"; else if(key==="transactionType")base[key]="expense"; else if(key==="loanType")base[key]="installment"; else if(key==="paymentFrequency")base[key]="monthly"; else if(key==="mileageUnit")base[key]="mi"; else if(key==="propertyType")base[key]="house"; else if(key==="systemType")base[key]="other"; else if(key==="deviceType")base[key]="outlet"; else if(key==="level")base[key]="monthly"; else if(key==="frequency")base[key]="monthly"; else if(key==="relationshipType")base[key]="related_to"; else if(["email","phone","controlsDeviceIds","options"].includes(key))base[key]=[]; else if(["address","template"].includes(key))base[key]={}; else if(key==="description"||key==="notes"||key==="context"||key==="outcome")base[key]=""; else base[key]="";}
 return base;
}

function valueText(v:unknown){if(v===undefined||v===null)return "";if(typeof v==="object")return JSON.stringify(v,null,2);return String(v)}
function parseValue(text:string,original:unknown):unknown{
 if(typeof original==="number")return text.trim()===""?undefined:Number(text);
 if(typeof original==="boolean")return text==="true";
 if(Array.isArray(original)||typeof original==="object"){if(!text.trim())return Array.isArray(original)?[]:{};try{return JSON.parse(text)}catch{return original}}
 return text;
}

export default function PersonalDataEditor({db,onPersist,onNotice}:Props){
 const [collection,setCollection]=useState<EditableCollection>("people");
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [query,setQuery]=useState("");
 const [draft,setDraft]=useState<Record<string,unknown>|null>(null);
 const [showAdvanced,setShowAdvanced]=useState(false);
 const [adding,setAdding]=useState(false);
 const rows=useMemo(()=>((db[collection] as unknown as Record<string,unknown>[])||[]).filter(r=>!query.trim()||JSON.stringify(r).toLowerCase().includes(query.toLowerCase())).slice().reverse(),[db,collection,query]);
 const selected=useMemo(()=>selectedId?((db[collection] as unknown as Record<string,unknown>[]).find(r=>String(r.id)===selectedId)??null):null,[db,collection,selectedId]);
 const fields=useMemo(()=>{const source=draft??selected??{};const keys=Array.from(new Set([...standardFields[collection],...Object.keys(source)]));return keys.filter(k=>!["id","entityType","createdAt","updatedAt"].includes(k));},[draft,selected,collection]);
 const begin=(row:Record<string,unknown>)=>{setSelectedId(String(row.id));setDraft(structuredClone(row));setAdding(false);setShowAdvanced(false)};
 const beginAdd=()=>{const row=defaultRecord(collection);setSelectedId(String(row.id));setDraft(row);setAdding(true);setShowAdvanced(false)};
 const cancel=()=>{setDraft(null);setSelectedId(null);setAdding(false)};
 const update=(key:string,text:string)=>setDraft(prev=>prev?{...prev,[key]:parseValue(text,prev[key])}:prev);
 async function save(){
  if(!draft)return;
  const next=structuredClone(db);
  const list=next[collection] as unknown as Record<string,unknown>[];
  draft.updatedAt=now();
  if(adding){
   list.push(draft);
   const saved=await onPersist(next,"Added "+collectionLabels[collection].replace(/s$/,"")+".");
   if(saved!==false)cancel();
  }else{
   const i=list.findIndex(r=>String(r.id)===String(draft.id));
   if(i<0){onNotice("Record no longer exists.");return}
   list[i]=draft;
   const saved=await onPersist(next,"Updated "+collectionLabels[collection].replace(/s$/,"")+".");
   if(saved!==false)cancel();
  }
 }
 async function remove(){
  if(!draft||adding)return;
  if(!window.confirm("Delete this record from your local LifeOS database? This can affect linked graph records."))return;
  const next=structuredClone(db);
  const list=next[collection] as unknown as Record<string,unknown>[];
  const id=String(draft.id);
  const remaining=list.filter(record=>String(record.id)!==id);
  if(remaining.length===list.length){onNotice("Record no longer exists.");return}
  next[collection]=remaining as never;
  const saved=await onPersist(next,"Deleted "+collectionLabels[collection].replace(/s$/,"")+".");
  if(saved!==false){
   setDraft(null);
   setSelectedId(null);
   setAdding(false);
   onNotice("Record deleted.");
  }
 }
 return <section className="card personal-data-editor">
  <div className="section-title"><div><div className="kicker">LifeOS / Personal Data</div><h2>Personal Data Survey</h2><div className="row-meta">Review every record, replace placeholders, add missing information, or remove records you don't want LifeOS to use.</div></div><span className="badge">{rows.length}</span></div>
  <div className="pde-layout">
   <aside className="pde-nav">
    <div className="pde-search"><input className="command-input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search this section…"/></div>
    {collectionOrder.map(key=><button type="button" key={key} className={"pde-nav-item "+(collection===key?"active":"")} onClick={()=>{setCollection(key);cancel()}}><span>{collectionLabels[key]}</span><b>{(db[key] as unknown[]).length}</b></button>)}
   </aside>
   <div className="pde-main">
    <div className="pde-toolbar"><div><div className="kicker">{collectionLabels[collection]}</div><strong>Tap a record to edit</strong></div><button type="button" className="action primary" onClick={beginAdd}>＋ Add</button></div>
    <div className="pde-record-list">{rows.map(row=><button type="button" key={String(row.id)} className={"pde-record "+(selectedId===row.id?"active":"")} onClick={()=>begin(row)}><span><strong>{String(row.displayName??row.name??row.title??row.question??row.serviceType??row.id)}</strong><small>{String(row.status??row.eventType??row.relationshipType??"Record")}</small></span><b>›</b></button>)}{!rows.length&&<div className="row-meta pde-empty">No records match. Add one to start.</div>}</div>
   </div>
  </div>
  {draft&&<div className="pde-modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)cancel()}}>
   <div className="pde-modal" role="dialog" aria-modal="true" aria-labelledby="pde-modal-title" onMouseDown={event=>event.stopPropagation()}>
    <div className="pde-form">
      <div className="pde-form-head"><div><div className="kicker">{adding?"New record":"Edit record"}</div><h3 id="pde-modal-title">{String(draft.displayName??draft.name??draft.title??draft.question??draft.serviceType??"Untitled")}</h3></div><button type="button" className="mini-action" onClick={cancel}>Close</button></div>
      <div className="pde-fields">{fields.map(key=>{const original=draft[key];const options=enumOptions[key]??(key==="status"?(enumOptions.status):undefined);const isLong=Array.isArray(original)||typeof original==="object"||["description","notes","context","outcome","purchaseDescription"].includes(key);return <label className={"field-label pde-field "+(isLong?"wide":"")} key={key}><span>{label(key)}{["id","entityType"].includes(key)&&<strong>SYSTEM</strong>}</span>{options?<select className="command-input" value={String(original??"")} onChange={e=>update(key,e.target.value)}>{options.map(x=><option key={x} value={x}>{label(x)}</option>)}</select>:isLong?<textarea className="command-input pde-input pde-textarea" value={valueText(original)} onChange={e=>update(key,e.target.value)} spellCheck={false}/>:<input className="command-input pde-input" value={valueText(original)} onChange={e=>update(key,e.target.value)}/>}</label>})}</div>
      <button type="button" className="pde-advanced-toggle" onClick={()=>setShowAdvanced(v=>!v)}>{showAdvanced?"Hide":"Show"} system details</button>
      {showAdvanced&&<div className="pde-system-box"><div><span>ID</span><code>{String(draft.id)}</code></div><div><span>Type</span><code>{String(draft.entityType)}</code></div><div><span>Created</span><code>{String(draft.createdAt)}</code></div><div><span>Updated</span><code>{String(draft.updatedAt)}</code></div></div>}
      <div className="pde-footer"><button type="button" className="danger-action mini-action" onClick={remove} disabled={adding}>Delete</button><span className="row-meta">{adding?"New record is not saved until you tap Save.":"Changes are local-first and saved immediately when you tap Save."}</span><button type="button" className="action" onClick={cancel}>Cancel</button><button type="button" className="action primary" onClick={save}>Save</button></div>
    </div>
   </div>
  </div>}
 </section>;
}
