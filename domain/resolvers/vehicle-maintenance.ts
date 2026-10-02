import type {LifeOSDatabase} from "@/domain/contracts/database";
export interface VehicleMaintenanceView{vehicleId:string;lastService?:string;nextDueDate?:string;nextDueMileage?:number;historyCount:number;totalCostMinor:number;overdue:boolean}
export function resolveVehicleMaintenance(db:LifeOSDatabase,vehicleId:string):VehicleMaintenanceView{
 const rows=db.vehicleMaintenance.filter(m=>m.vehicleId===vehicleId).sort((a,b)=>b.date.localeCompare(a.date));
 const latest=rows[0];const today=new Date().toISOString().slice(0,10);
 return{vehicleId,lastService:latest?.date,nextDueDate:latest?.nextDueDate,nextDueMileage:latest?.nextDueMileage,historyCount:rows.length,totalCostMinor:rows.reduce((s,m)=>s+(m.costMinor??0),0),overdue:!!latest?.nextDueDate&&latest.nextDueDate<today};
}
