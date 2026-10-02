import type {LifeOSDatabase,VehicleMaintenance,Relationship,Event} from "@/domain/contracts/database";
const now=()=>new Date().toISOString(); const id=(p:string)=>p+"-"+crypto.randomUUID();
const audit=(db:LifeOSDatabase,target:Record<string,unknown>,action:"create")=>{const t=now();return {...db,auditEntries:[...db.auditEntries,{id:id("audit"),entityType:"audit",createdAt:t,updatedAt:t,action,targetId:String(target.id),targetType:String(target.entityType),timestamp:t,after:target,source:"asset-operations"}],metadata:{...db.metadata,updatedAt:t}}};

export function createVehicleMaintenance(db:LifeOSDatabase,input:Pick<VehicleMaintenance,"vehicleId"|"date"|"serviceType">&Partial<VehicleMaintenance>):LifeOSDatabase{
 const t=now(); const m:VehicleMaintenance={...input,id:id("maint"),entityType:"vehicle_maintenance",createdAt:t,updatedAt:t,vehicleId:input.vehicleId,date:input.date,serviceType:input.serviceType};
 let next={...db,vehicleMaintenance:[...db.vehicleMaintenance,m]};
 const e:Event={id:id("evt"),entityType:"event",createdAt:t,updatedAt:t,eventType:"maintenance",title:input.description??input.serviceType,status:"completed",occurredAt:input.date,metadata:{vehicleId:input.vehicleId,maintenanceId:m.id}};
 next={...next,events:[...next.events,e]};
 return audit(next,m,"create");
}

export function createRelationship(db:LifeOSDatabase,input:Pick<Relationship,"fromId"|"fromType"|"toId"|"toType"|"relationshipType">&Partial<Relationship>):LifeOSDatabase{
 const t=now(); const r:Relationship={...input,id:id("rel"),entityType:"relationship",createdAt:t,updatedAt:t,fromId:input.fromId,fromType:input.fromType,toId:input.toId,toType:input.toType,relationshipType:input.relationshipType};
 return audit({...db,relationships:[...db.relationships,r]},r,"create");
}
