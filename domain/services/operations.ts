import type {BaseEntity,Event,EventStatus,LifeOSDatabase,OpenLoop,Person} from "@/domain/contracts/database";
import {appendAudit} from "@/domain/services/audit";
const now=()=>new Date().toISOString(); const id=(p:string)=>p+"-"+crypto.randomUUID();
export function createEvent(db:LifeOSDatabase,input:Pick<Event,"title"|"eventType"|"status"> & Partial<Event>):LifeOSDatabase{
 const t=now(); const event:Event={...input,id:id("evt"),entityType:"event",createdAt:t,updatedAt:t,title:input.title,eventType:input.eventType,status:input.status};
 return appendAudit({...db,events:[...db.events,event]},event,"create","mission-control");
}
export function createOpenLoop(db:LifeOSDatabase,input:Pick<OpenLoop,"title"|"type"> & Partial<OpenLoop>):LifeOSDatabase{
 const t=now(); const loop:OpenLoop={...input,id:id("loop"),entityType:"open_loop",createdAt:t,updatedAt:t,title:input.title,type:input.type,status:input.status??"open"};
 return appendAudit({...db,openLoops:[...db.openLoops,loop]},loop,"create","mission-control");
}
export function updateEventStatus(db:LifeOSDatabase,eventId:string,status:EventStatus):LifeOSDatabase{
 const before=db.events.find(e=>e.id===eventId); if(!before)return db;
 const t=now(); const target:Event={...before,status,updatedAt:t,completedAt:status==="completed"?t:before.completedAt};
 return appendAudit({...db,events:db.events.map(e=>e.id===eventId?target:e)},target,"update","mission-control",before);
}
export function updateOpenLoopStatus(db:LifeOSDatabase,loopId:string,status:OpenLoop["status"]):LifeOSDatabase{
 const before=db.openLoops.find(o=>o.id===loopId); if(!before)return db;
 const t=now(); const target:OpenLoop={...before,status,updatedAt:t,resolvedAt:status==="resolved"?t:before.resolvedAt};
 return appendAudit({...db,openLoops:db.openLoops.map(o=>o.id===loopId?target:o)},target,"update","mission-control",before);
}
export type EventUpdateInput = Partial<Pick<Event,"title"|"description"|"eventType"|"status"|"occurredAt"|"startAt"|"endAt"|"dueAt"|"source"|"personIds"|"assetIds"|"projectIds"|"goalIds"|"openLoopIds"|"decisionIds"|"financialTransactionIds"|"documentIds"|"metadata">>;

export function updateEvent(db:LifeOSDatabase,eventId:string,changes:EventUpdateInput):LifeOSDatabase{
 const before=db.events.find(e=>e.id===eventId); if(!before)return db;
 const t=now();
 const target:Event={...before,...changes,updatedAt:t,completedAt:changes.status ? (changes.status==="completed" ? t : undefined) : before.completedAt};
 return appendAudit({...db,events:db.events.map(e=>e.id===eventId?target:e)},target,"update","event-engine",before);
}

export function createPerson(db:LifeOSDatabase,input:{displayName:string;notes?:string;metadata?:Record<string,unknown>}):LifeOSDatabase{
 const t=now(); const parts=input.displayName.trim().split(/\\s+/); const firstName=parts.shift()??input.displayName.trim(); const lastName=parts.length?parts.join(" "):undefined;
 const person:Person={id:id("person"),entityType:"person",createdAt:t,updatedAt:t,firstName,lastName,displayName:input.displayName.trim(),notes:input.notes,metadata:input.metadata};
 return appendAudit({...db,people:[...db.people,person]},person,"create","universal-capture");
}


export function updateEntityRecord(db:LifeOSDatabase,entityType:string,entityId:string,changes:Record<string,unknown>):LifeOSDatabase{
 const collectionByType:Record<string,string>={event:"events",open_loop:"openLoops",person:"people",asset:"assets",financial_account:"accounts",financial_transaction:"transactions",loan:"loans",loan_payment:"loanPayments",vehicle:"vehicles",vehicle_maintenance:"vehicleMaintenance",property:"properties",room:"rooms",home_system:"homeSystems",electrical_device:"electricalDevices",project:"projects",goal:"goals",decision:"decisions",document:"documents",recurring_rule:"recurringRules",relationship:"relationships"};
 if(entityType==="audit")return db;
 const collection=collectionByType[entityType];
 const source=(entityType==="attachment"?db.attachments:collection?db[collection as keyof LifeOSDatabase]:undefined) as BaseEntity[]|undefined;
 if(!source)return db;
 const before=source.find(item=>item.id===entityId); if(!before)return db;
 const safeChanges={...changes}; delete safeChanges.id; delete safeChanges.entityType; delete safeChanges.createdAt; delete safeChanges.updatedAt; delete safeChanges.archivedAt;
 const target={...before,...safeChanges,updatedAt:now()} as BaseEntity;
 const next={...db};
 if(entityType==="attachment")next.attachments=source.map(item=>item.id===entityId?target:item) as unknown as LifeOSDatabase["attachments"];
 else (next[collection as keyof LifeOSDatabase] as BaseEntity[])=source.map(item=>item.id===entityId?target:item);
 return appendAudit(next,target,"update","entity-editor",before);
}
