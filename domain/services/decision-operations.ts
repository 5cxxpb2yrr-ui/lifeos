import type {Decision,LifeOSDatabase} from "@/domain/contracts/database";
import {appendAudit} from "@/domain/services/audit";
const now=()=>new Date().toISOString();const id=(p:string)=>p+"-"+crypto.randomUUID();
export function createDecision(db:LifeOSDatabase,input:Pick<Decision,"question">&Partial<Decision>):LifeOSDatabase{
 const t=now();const decision:Decision={...input,id:id("decision"),entityType:"decision",createdAt:t,updatedAt:t,question:input.question};
 return appendAudit({...db,decisions:[...db.decisions,decision]},decision,"create","decision-operations");
}
export function updateDecision(db:LifeOSDatabase,decisionId:string,patch:Partial<Omit<Decision,"id"|"entityType"|"createdAt">>):LifeOSDatabase{
 const before=db.decisions.find(x=>x.id===decisionId);if(!before)return db;
 const decision:Decision={...before,...patch,updatedAt:now()};
 return appendAudit({...db,decisions:db.decisions.map(x=>x.id===decisionId?decision:x)},decision,"update","decision-operations",before);
}