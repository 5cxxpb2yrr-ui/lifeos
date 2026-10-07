import test from "node:test";
import assert from "node:assert/strict";
import {createEmptyDatabase} from "@/domain/services/empty-database";
import {resolveGraph} from "@/domain/resolvers/graph";
const base=(id:string,entityType:string)=>({id,entityType,createdAt:"2026-01-01T00:00:00.000Z",updatedAt:"2026-01-01T00:00:00.000Z"});
test("graph resolves canonical maintenance-to-vehicle foreign key",()=>{
 const db=createEmptyDatabase();
 db.vehicles.push({...base("vehicle-1","vehicle"),year:2006,make:"Scion",model:"xB",mileageUnit:"mi",status:"owned"} as never);
 db.vehicleMaintenance.push({...base("maintenance-1","vehicle_maintenance"),vehicleId:"vehicle-1",date:"2026-01-01",serviceType:"Brake overhaul"} as never);
 const graph=resolveGraph(db,"vehicle-1");
 assert.ok(graph.edges.some(e=>e.from.id==="maintenance-1"&&e.to.id==="vehicle-1"&&e.relationship==="maintenance_for"));
});
test("graph resolves maintenance references to legacy inventory parts and supports reverse navigation",()=>{
 const db=createEmptyDatabase();
 db.entities.push({...base("inventory-brake-pad","entity"),metadata:{legacyType:"inventory",name:"Front brake pads"}} as never);
 db.vehicleMaintenance.push({...base("maintenance-1","vehicle_maintenance"),vehicleId:"vehicle-1",date:"2026-01-01",serviceType:"Brake overhaul",metadata:{legacy:{record:{partIds:["inventory-brake-pad"]}}}} as never);
 const maintenanceGraph=resolveGraph(db,"maintenance-1");
 assert.ok(maintenanceGraph.edges.some(e=>e.to.id==="inventory-brake-pad"&&e.relationship==="related_to"));
 const partGraph=resolveGraph(db,"inventory-brake-pad");
 assert.ok(partGraph.edges.some(e=>e.from.id==="maintenance-1"&&e.to.id==="inventory-brake-pad"));
});
