import type {BaseEntity,Event,EventStatus,LifeOSDatabase,OpenLoop,Person} from "@/domain/contracts/database";
import {appendAudit} from "@/domain/services/audit";
const now=()=>new Date().toISOString(); const id=(p:string)=>p+"-"+crypto.randomUUID();
export function createEvent(db:LifeOSDatabase,input:Pick<Event,"title"|"eventType"|"status"> & Partial<Event>):LifeOSDatabase{const t=now();const event:Event={...input,id:id("evt"),entityType:"event",createdAt:t,updatedAt:t,title:input.title,eventType:input.eventType,status:input.status};return appendAudit({...db,events:[...db.events,event]},event,"create","mission-control");}
export function createOpenLoop(db:LifeOSDatabase,input:Pick<OpenLoop,"title"|"type"> & Partial<OpenLoop>):LifeOSDatabase{const t=now();const loop:OpenLoop={...input,id:id("loop"),entityType:"open_loop",createdAt:t,updatedAt:t,title:input.title,type:input.type,status:input.status??"open"};return appendAudit({...db,openLoops:[...db.openLoops,loop]},loop,"create","mission-control");}
export function updateEventStatus(db:LifeOSDatabase,eventId:string,status:EventStatus):LifeOSDatabase{const before=db.events.find(e=>e.id===eventId);if(!before)return db;const t=now();const target:Event={...before,status,updatedAt:t,completedAt:status==="completed"?t:before.completedAt};return appendAudit({...db,events:db.events.map(e=>e.id===eventId?target:e)},target,"update","mission-control",before);}
export function updateOpenLoopStatus(db:LifeOSDatabase,loopId:string,status:OpenLoop["status"]):LifeOSDatabase{const before=db.openLoops.find(o=>o.id===loopId);if(!before)return db;const t=now();const target:OpenLoop={...before,status,updatedAt:t,resolvedAt:status==="resolved"?t:before.resolvedAt};return appendAudit({...db,openLoops:db.openLoops.map(o=>o.id===loopId?target:o)},target,"update","mission-control",before);}
export type EventUpdateInput=Partial<Pick<Event,"title"|"description"|"eventType"|"status"|"occurredAt"|"startAt"|"endAt"|"dueAt"|"source"|"personIds"|"assetIds"|"projectIds"|"goalIds"|"openLoopIds"|"decisionIds"|"financialTransactionIds"|"documentIds"|"metadata">>;
export function updateEvent(db:LifeOSDatabase,eventId:string,changes:EventUpdateInput):LifeOSDatabase{const before=db.events.find(e=>e.id===eventId);if(!before)return db;const t=now();const target:Event={...before,...changes,updatedAt:t,completedAt:changes.status?(changes.status==="completed"?t:undefined):before.completedAt};return appendAudit({...db,events:db.events.map(e=>e.id===eventId?target:e)},target,"update","event-engine",before);}
export function createPerson(db:LifeOSDatabase,input:{displayName:string;notes?:string;metadata?:Record<string,unknown>}):LifeOSDatabase{const t=now();const parts=input.displayName.trim().split(/\s+/);const firstName=parts.shift()??input.displayName.trim();const lastName=parts.length?parts.join(" "):undefined;const person:Person={id:id("person"),entityType:"person",createdAt:t,updatedAt:t,firstName,lastName,displayName:input.displayName.trim(),notes:input.notes,metadata:input.metadata};return appendAudit({...db,people:[...db.people,person]},person,"create","universal-capture");}
export function updateEntityRecord(db:LifeOSDatabase,entityType:string,entityId:string,changes:Record<string,unknown>):LifeOSDatabase{
 const collectionByType:Record<string,string>={event:"events",open_loop:"openLoops",person:"people",asset:"assets",financial_account:"accounts",financial_transaction:"transactions",loan:"loans",loan_payment:"loanPayments",vehicle:"vehicles",vehicle_maintenance:"vehicleMaintenance",property:"properties",room:"rooms",home_system:"homeSystems",electrical_device:"electricalDevices",project:"projects",goal:"goals",decision:"decisions",document:"documents",recurring_rule:"recurringRules",relationship:"relationships",entity:"entities"};
 if(entityType==="audit")return db;
 const collection=collectionByType[entityType];const source=(entityType==="attachment"?db.attachments:collection?db[collection as keyof LifeOSDatabase]:undefined) as BaseEntity[]|undefined;
 if(!source)return db;const before=source.find(item=>item.id===entityId);if(!before)return db;
 const safeChanges={...changes};delete safeChanges.id;delete safeChanges.entityType;delete safeChanges.createdAt;delete safeChanges.updatedAt;delete safeChanges.archivedAt;
 const target={...before,...safeChanges,updatedAt:now()} as BaseEntity;const next={...db};
 if(entityType==="attachment")next.attachments=source.map(item=>item.id===entityId?target:item) as unknown as LifeOSDatabase["attachments"];else(next[collection as keyof LifeOSDatabase] as BaseEntity[])=source.map(item=>item.id===entityId?target:item);
 return appendAudit(next,target,"update","entity-editor",before);
}

export function deleteEntityRecord(db:LifeOSDatabase,entityType:string,entityId:string):LifeOSDatabase{
 const collectionByType:Record<string,string>={entity:"entities",event:"events",open_loop:"openLoops",person:"people",asset:"assets",financial_account:"accounts",financial_transaction:"transactions",loan:"loans",loan_payment:"loanPayments",vehicle:"vehicles",vehicle_maintenance:"vehicleMaintenance",property:"properties",room:"rooms",home_system:"homeSystems",electrical_device:"electricalDevices",project:"projects",goal:"goals",decision:"decisions",document:"documents",recurring_rule:"recurringRules",relationship:"relationships"};
 if(entityType==="audit")return db;
 const collection=collectionByType[entityType];
 const source=(entityType==="attachment"?db.attachments:collection?db[collection as keyof LifeOSDatabase]:undefined) as BaseEntity[]|undefined;
 if(!source)return db;
 const before=source.find(item=>item.id===entityId); if(!before)return db;
 const next={...db};
 if(entityType==="attachment") next.attachments=source.filter(item=>item.id!==entityId) as unknown as LifeOSDatabase["attachments"];
 else (next[collection as keyof LifeOSDatabase] as BaseEntity[])=source.filter(item=>item.id!==entityId);
 next.relationships=next.relationships.filter(r=>r.fromId!==entityId&&r.toId!==entityId);
 next.events=next.events.map(e=>({...e,personIds:e.personIds?.filter(id=>id!==entityId),assetIds:e.assetIds?.filter(id=>id!==entityId),projectIds:e.projectIds?.filter(id=>id!==entityId),goalIds:e.goalIds?.filter(id=>id!==entityId),openLoopIds:e.openLoopIds?.filter(id=>id!==entityId),decisionIds:e.decisionIds?.filter(id=>id!==entityId),financialTransactionIds:e.financialTransactionIds?.filter(id=>id!==entityId),documentIds:e.documentIds?.filter(id=>id!==entityId)}));
 next.openLoops=next.openLoops.map(o=>({...o,relatedEventIds:o.relatedEventIds?.filter(id=>id!==entityId),relatedProjectIds:o.relatedProjectIds?.filter(id=>id!==entityId),relatedDecisionIds:o.relatedDecisionIds?.filter(id=>id!==entityId)}));
 next.decisions=next.decisions.map(d=>({...d,personIds:d.personIds?.filter(id=>id!==entityId),eventIds:d.eventIds?.filter(id=>id!==entityId),projectIds:d.projectIds?.filter(id=>id!==entityId)}));
 if(entityType==="loan")next.loanPayments=next.loanPayments.filter(p=>p.loanId!==entityId);
 if(entityType==="financial_account")next.transactions=next.transactions.filter(t=>t.accountId!==entityId&&t.counterpartyAccountId!==entityId);
 if(entityType==="vehicle")next.vehicleMaintenance=next.vehicleMaintenance.filter(v=>v.vehicleId!==entityId);
 if(entityType==="property"){next.rooms=next.rooms.filter(r=>r.propertyId!==entityId);next.homeSystems=next.homeSystems.filter(s=>s.propertyId!==entityId);next.electricalDevices=next.electricalDevices.filter(d=>d.propertyId!==entityId);}
 return appendAudit(next,before,"delete","entity-editor",before);
}

export function createOpenLoopFromEvent(db:LifeOSDatabase,eventId:string,input?:Partial<Pick<OpenLoop,"title"|"description"|"type"|"status"|"priority"|"dueAt">>):LifeOSDatabase{
 const event=db.events.find(e=>e.id===eventId); if(!event)return db;
 const t=now(); const loop:OpenLoop={id:id("loop"),entityType:"open_loop",createdAt:t,updatedAt:t,title:input?.title??event.title,description:input?.description??event.description,type:input?.type??"follow_up",status:input?.status??"open",priority:input?.priority??"normal",dueAt:input?.dueAt??event.dueAt,relatedEventIds:[event.id]};
 const linkedEvent:Event={...event,openLoopIds:Array.from(new Set([...(event.openLoopIds??[]),loop.id])),updatedAt:t};
 const next={...db,events:db.events.map(e=>e.id===event.id?linkedEvent:e),openLoops:[...db.openLoops,loop]};
 return appendAudit(appendAudit(next,linkedEvent,"update","event-engine",event),loop,"create","event-engine");
}
export function resolveOpenLoop(db:LifeOSDatabase,loopId:string):LifeOSDatabase{
 const before=db.openLoops.find(o=>o.id===loopId); if(!before)return db;
 if(before.status==="resolved"||before.status==="cancelled")return db;
 const t=now();
 const target:OpenLoop={...before,status:"resolved",resolvedAt:t,updatedAt:t};
 return appendAudit({...db,openLoops:db.openLoops.map(o=>o.id===loopId?target:o)},target,"update","open-loop-engine",before);
}
export function linkEventToOpenLoop(db:LifeOSDatabase,eventId:string,loopId:string):LifeOSDatabase{
 const event=db.events.find(e=>e.id===eventId), loop=db.openLoops.find(o=>o.id===loopId); if(!event||!loop)return db;
 const t=now(); const linkedEvent:Event={...event,openLoopIds:Array.from(new Set([...(event.openLoopIds??[]),loop.id])),updatedAt:t};
 const linkedLoop:OpenLoop={...loop,relatedEventIds:Array.from(new Set([...(loop.relatedEventIds??[]),event.id])),updatedAt:t};
 let next={...db,events:db.events.map(e=>e.id===event.id?linkedEvent:e),openLoops:db.openLoops.map(o=>o.id===loop.id?linkedLoop:o)};
 next=appendAudit(next,linkedEvent,"update","event-engine",event); return appendAudit(next,linkedLoop,"update","event-engine",loop);
}
