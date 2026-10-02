import type {AuditEntry,Event,LifeOSDatabase} from "@/domain/contracts/database";
const now=()=>new Date().toISOString();const id=(p:string)=>p+"-"+crypto.randomUUID();
function commit(db:LifeOSDatabase,e:Event):LifeOSDatabase{
 const t=now();
 const entry:AuditEntry={id:id("audit"),entityType:"audit",createdAt:t,updatedAt:t,action:"create",targetId:e.id,targetType:e.entityType,timestamp:t,after:{...e},source:"home-operations"};
 return {...db,events:[...db.events,e],auditEntries:[...db.auditEntries,entry],metadata:{...db.metadata,updatedAt:t}};
}
export function createHomeEvent(db:LifeOSDatabase,input:Pick<Event,"title"|"eventType"|"status">&Partial<Event>):LifeOSDatabase{
 const t=now();const e:Event={...input,id:id("evt"),entityType:"event",createdAt:t,updatedAt:t,title:input.title,eventType:input.eventType,status:input.status};
 return commit(db,e);
}
