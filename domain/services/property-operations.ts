import type {Event,LifeOSDatabase} from "@/domain/contracts/database";
import {appendAudit} from "@/domain/services/audit";
const now=()=>new Date().toISOString();const id=(p:string)=>p+"-"+crypto.randomUUID();
export function createPropertyEvent(db:LifeOSDatabase,input:Pick<Event,"title"|"eventType"|"status">&Partial<Event>):LifeOSDatabase{
 const t=now();const event:Event={...input,id:id("evt"),entityType:"event",createdAt:t,updatedAt:t,title:input.title,eventType:input.eventType,status:input.status};
 return appendAudit({...db,events:[...db.events,event]},event,"create","property-operations");
}
export function updatePropertyEvent(db:LifeOSDatabase,eventId:string,patch:Partial<Omit<Event,"id"|"entityType"|"createdAt">>):LifeOSDatabase{
 const before=db.events.find(x=>x.id===eventId);if(!before)return db;
 const event:Event={...before,...patch,updatedAt:now()};
 return appendAudit({...db,events:db.events.map(x=>x.id===eventId?event:x)},event,"update","property-operations",before);
}