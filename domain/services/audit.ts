import type {AuditEntry,BaseEntity,LifeOSDatabase} from "@/domain/contracts/database";

const id=(p:string)=>p+"-"+crypto.randomUUID();

function toRecord(value: BaseEntity): Record<string, unknown> {
 return Object.fromEntries(Object.entries(value));
}

export function appendAudit(
 db:LifeOSDatabase,
 target:BaseEntity,
 action:AuditEntry["action"],
 source:string,
 before?:BaseEntity
):LifeOSDatabase{
 const t=new Date().toISOString();
 const entry:AuditEntry={
  id:id("audit"),
  entityType:"audit",
  createdAt:t,
  updatedAt:t,
  action,
  targetId:target.id,
  targetType:target.entityType,
  timestamp:t,
  before:before?toRecord(before):undefined,
  after:toRecord(target),
  source
 };
 return {...db,auditEntries:[...db.auditEntries,entry],metadata:{...db.metadata,updatedAt:t}};
}
