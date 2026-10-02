import type {LifeOSDatabase,Project} from "@/domain/contracts/database";
import {appendAudit} from "@/domain/services/audit";
const now=()=>new Date().toISOString();const id=(p:string)=>p+"-"+crypto.randomUUID();
export function createProject(db:LifeOSDatabase,input:Pick<Project,"name"|"status">&Partial<Project>):LifeOSDatabase{
 const t=now();const project:Project={...input,id:id("project"),entityType:"project",createdAt:t,updatedAt:t,name:input.name,status:input.status};
 return appendAudit({...db,projects:[...db.projects,project]},project,"create","project-operations");
}
export function updateProject(db:LifeOSDatabase,projectId:string,patch:Partial<Omit<Project,"id"|"entityType"|"createdAt">>):LifeOSDatabase{
 const before=db.projects.find(x=>x.id===projectId);if(!before)return db;
 const project:Project={...before,...patch,updatedAt:now()};
 return appendAudit({...db,projects:db.projects.map(x=>x.id===projectId?project:x)},project,"update","project-operations",before);
}