import type {LifeOSDatabase,VehicleMaintenance,Relationship,Event} from "@/domain/contracts/database";
import {appendAudit} from "@/domain/services/audit";
const now=()=>new Date().toISOString(); const id=(p:string)=>p+"-"+crypto.randomUUID();

export function createVehicleMaintenance(db:LifeOSDatabase,input:Pick<VehicleMaintenance,"vehicleId"|"date"|"serviceType">&Partial<VehicleMaintenance>):LifeOSDatabase{
 const t=now(); const m:VehicleMaintenance={...input,id:id("maint"),entityType:"vehicle_maintenance",createdAt:t,updatedAt:t,vehicleId:input.vehicleId,date:input.date,serviceType:input.serviceType};
 const e:Event={id:id("evt"),entityType:"event",createdAt:t,updatedAt:t,eventType:"maintenance",title:input.description??input.serviceType,status:"completed",occurredAt:input.date,metadata:{vehicleId:input.vehicleId,maintenanceId:m.id}};
 let next={...db,vehicleMaintenance:[...db.vehicleMaintenance,m],events:[...db.events,e]};
 next=appendAudit(next,m,"create","asset-operations");
 return appendAudit(next,e,"create","asset-operations");
}
export function updateVehicleMaintenance(db:LifeOSDatabase,maintenanceId:string,patch:Partial<Omit<VehicleMaintenance,"id"|"entityType"|"createdAt">>):LifeOSDatabase{
 const before=db.vehicleMaintenance.find(x=>x.id===maintenanceId); if(!before)return db;
 const updated:VehicleMaintenance={...before,...patch,updatedAt:now()};
 return appendAudit({...db,vehicleMaintenance:db.vehicleMaintenance.map(x=>x.id===maintenanceId?updated:x)},updated,"update","asset-operations",before);
}
export function createRelationship(db:LifeOSDatabase,input:Pick<Relationship,"fromId"|"fromType"|"toId"|"toType"|"relationshipType">&Partial<Relationship>):LifeOSDatabase{
 const t=now(); const r:Relationship={...input,id:id("rel"),entityType:"relationship",createdAt:t,updatedAt:t,fromId:input.fromId,fromType:input.fromType,toId:input.toId,toType:input.toType,relationshipType:input.relationshipType};
 return appendAudit({...db,relationships:[...db.relationships,r]},r,"create","asset-operations");
}