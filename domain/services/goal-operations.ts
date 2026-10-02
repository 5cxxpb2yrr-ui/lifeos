import type {Goal,LifeOSDatabase} from "@/domain/contracts/database";
import {appendAudit} from "@/domain/services/audit";
const now=()=>new Date().toISOString();const id=(p:string)=>p+"-"+crypto.randomUUID();
export function createGoal(db:LifeOSDatabase,input:Pick<Goal,"name"|"level"|"status">&Partial<Goal>):LifeOSDatabase{
 const t=now();const goal:Goal={...input,id:id("goal"),entityType:"goal",createdAt:t,updatedAt:t,name:input.name,level:input.level,status:input.status};
 return appendAudit({...db,goals:[...db.goals,goal]},goal,"create","goal-operations");
}
export function updateGoal(db:LifeOSDatabase,goalId:string,patch:Partial<Omit<Goal,"id"|"entityType"|"createdAt">>):LifeOSDatabase{
 const before=db.goals.find(x=>x.id===goalId);if(!before)return db;
 const goal:Goal={...before,...patch,updatedAt:now()};
 return appendAudit({...db,goals:db.goals.map(x=>x.id===goalId?goal:x)},goal,"update","goal-operations",before);
}