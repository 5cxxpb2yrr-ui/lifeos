import type {BaseEntity,Event,EventStatus,LifeOSDatabase,OpenLoop,Person} from "@/domain/contracts/database";
import {appendAudit} from "@/domain/services/audit";
const now=()=>new Date().toISOString(); const id=(p:string)=>p+"-"+crypto.randomUUID(); const toRecord=(value:BaseEntity):Record<string,unknown>=>Object.fromEntries(Object.entries(value));
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


export interface DeleteEntityResult{db:LifeOSDatabase;deleted:boolean;reason?:string}
export function deleteEntityRecord(db:LifeOSDatabase,entityType:string,entityId:string,source="entity-editor"):DeleteEntityResult{
 const collectionByType:Record<string,string>={event:"events",open_loop:"openLoops",person:"people",asset:"assets",financial_account:"accounts",financial_transaction:"transactions",loan:"loans",loan_payment:"loanPayments",vehicle:"vehicles",vehicle_maintenance:"vehicleMaintenance",property:"properties",room:"rooms",home_system:"homeSystems",electrical_device:"electricalDevices",project:"projects",goal:"goals",decision:"decisions",document:"documents",recurring_rule:"recurringRules",relationship:"relationships"};
 const collection=collectionByType[entityType];
 if(!collection)return {db,deleted:false,reason:"This record type cannot be deleted here."};
 const sourceList=(db[collection as keyof LifeOSDatabase] as unknown as BaseEntity[]|undefined);
 if(!sourceList)return {db,deleted:false,reason:"Record collection is unavailable."};
 const before=sourceList.find(item=>item.id===entityId);
 if(!before)return {db,deleted:false,reason:"Record no longer exists."};
 const requiredReferences:Array<{collection:string;field:string}>=[];
 if(entityType==="vehicle")for(const row of db.vehicleMaintenance)if(row.vehicleId===entityId)requiredReferences.push({collection:"Vehicle Maintenance",field:"vehicleId"});
 if(entityType==="loan")for(const row of db.loanPayments)if(row.loanId===entityId)requiredReferences.push({collection:"Loan Payments",field:"loanId"});
 if(entityType==="financial_account")for(const row of db.transactions)if(row.accountId===entityId)requiredReferences.push({collection:"Transactions",field:"accountId"});
 if(entityType==="property"){
  for(const row of db.rooms)if(row.propertyId===entityId)requiredReferences.push({collection:"Rooms",field:"propertyId"});
  for(const row of db.homeSystems)if(row.propertyId===entityId)requiredReferences.push({collection:"Home Systems",field:"propertyId"});
  for(const row of db.electricalDevices)if(row.propertyId===entityId)requiredReferences.push({collection:"Electrical Devices",field:"propertyId"});
 }
 if(requiredReferences.length)return {db,deleted:false,reason:"Cannot delete this record while required records still reference it. Remove or reassign those linked records first."};
 const next=structuredClone(db);
 (next[collection as keyof LifeOSDatabase] as unknown as BaseEntity[])=(sourceList.filter(item=>item.id!==entityId));
 next.relationships=next.relationships.filter(r=>r.fromId!==entityId&&r.toId!==entityId);
 const removeId=(values:string[]|undefined)=>values?.filter(value=>value!==entityId);
 next.events=next.events.map(row=>({...row,
  personIds:removeId(row.personIds),assetIds:removeId(row.assetIds),projectIds:removeId(row.projectIds),goalIds:removeId(row.goalIds),openLoopIds:removeId(row.openLoopIds),decisionIds:removeId(row.decisionIds),financialTransactionIds:removeId(row.financialTransactionIds),documentIds:removeId(row.documentIds)
 }));
 next.openLoops=next.openLoops.map(row=>({...row,relatedEventIds:removeId(row.relatedEventIds),relatedProjectIds:removeId(row.relatedProjectIds),relatedDecisionIds:removeId(row.relatedDecisionIds)}));
 next.decisions=next.decisions.map(row=>({...row,personIds:removeId(row.personIds),eventIds:removeId(row.eventIds),projectIds:removeId(row.projectIds)}));
 next.vehicleMaintenance=next.vehicleMaintenance.map(row=>row.eventId===entityId?{...row,eventId:undefined}:row);
 next.loanPayments=next.loanPayments.map(row=>row.transactionId===entityId?{...row,transactionId:undefined}:row);
 next.transactions=next.transactions.map(row=>({...row,counterpartyAccountId:row.counterpartyAccountId===entityId?undefined:row.counterpartyAccountId,loanId:row.loanId===entityId?undefined:row.loanId,eventId:row.eventId===entityId?undefined:row.eventId,vehicleId:row.vehicleId===entityId?undefined:row.vehicleId,propertyId:row.propertyId===entityId?undefined:row.propertyId}));
 next.vehicles=next.vehicles.map(row=>row.assetId===entityId?{...row,assetId:undefined}:row);
 next.electricalDevices=next.electricalDevices.map(row=>row.roomId===entityId?{...row,roomId:undefined}:row);
 const t=new Date().toISOString();
 next.auditEntries=[...next.auditEntries,{id:id("audit"),entityType:"audit",createdAt:t,updatedAt:t,action:"delete",targetId:before.id,targetType:before.entityType,timestamp:t,before:toRecord(before),source}];
 next.metadata={...next.metadata,updatedAt:t};
 return {db:next,deleted:true};
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
