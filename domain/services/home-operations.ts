import type {Event,LifeOSDatabase} from "@/domain/contracts/database";
import {appendAudit} from "@/domain/services/audit";
const now=()=>new Date().toISOString();const id=(p:string)=>p+"-"+crypto.randomUUID();
export function createHomeEvent(db:LifeOSDatabase,input:Pick<Event,"title"|"eventType"|"status">&Partial<Event>):LifeOSDatabase{
 const t=now(); const e:Event={...input,id:id("evt"),entityType:"event",createdAt:t,updatedAt:t,title:input.title,eventType:input.eventType,status:input.status};
 return appendAudit({...db,events:[...db.events,e]},e,"create","home-operations");
}
export function updateHomeEvent(db:LifeOSDatabase,eventId:string,patch:Partial<Omit<Event,"id"|"entityType"|"createdAt">>):LifeOSDatabase{
 const before=db.events.find(x=>x.id===eventId); if(!before)return db;
 const updated:Event={...before,...patch,updatedAt:now()};
 return appendAudit({...db,events:db.events.map(x=>x.id===eventId?updated:x)},updated,"update","home-operations",before);
}