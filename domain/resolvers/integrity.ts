import type {LifeOSDatabase,CollectionName} from "@/domain/contracts/database";
export interface IntegrityIssue{severity:"error"|"warning";code:string;message:string;recordId?:string;recordType?:string}
export interface IntegrityResult{valid:boolean;errors:IntegrityIssue[];warnings:IntegrityIssue[];counts:Record<CollectionName,number>}
const entityCollections=["entities","events","openLoops","people","assets","accounts","transactions","loans","loanPayments","vehicles","vehicleMaintenance","properties","rooms","homeSystems","electricalDevices","projects","goals","decisions","documents","recurringRules"] as const;
const typedCollections=entityCollections.filter(c=>c!=="entities") as Exclude<typeof entityCollections[number],"entities">[];
function expectedEntityType(collection:string):string|undefined{const map:Record<string,string>={events:"event",openLoops:"open_loop",people:"person",assets:"asset",accounts:"financial_account",transactions:"financial_transaction",loans:"loan",loanPayments:"loan_payment",vehicles:"vehicle",vehicleMaintenance:"vehicle_maintenance",properties:"property",rooms:"room",homeSystems:"home_system",electricalDevices:"electrical_device",projects:"project",goals:"goal",decisions:"decision",documents:"document",recurringRules:"recurring_rule"};return map[collection]}
function index(db:LifeOSDatabase){const m=new Map<string,{type:string}>(); for(const c of typedCollections){for(const x of db[c]){if(m.has(x.id)) continue; m.set(x.id,{type:x.entityType})}} return m}
export function validateDatabaseIntegrity(db:LifeOSDatabase):IntegrityResult{
 const errors:IntegrityIssue[]=[]; const warnings:IntegrityIssue[]=[]; const ids=new Map<string,string>();
 const counts={} as Record<CollectionName,number>;
 for(const c of ["entities","relationships",...entityCollections,"auditEntries"] as CollectionName[]){counts[c]=db[c].length}
 for(const c of entityCollections){for(const x of db[c]){
   if(ids.has(x.id)) errors.push({severity:"error",code:"DUPLICATE_ID",message:`Duplicate id ${x.id} in ${ids.get(x.id)} and ${c}.`,recordId:x.id,recordType:x.entityType});
   else ids.set(x.id,c);
   if(x.entityType!==expectedEntityType(c)) warnings.push({severity:"warning",code:"ENTITY_TYPE_MISMATCH",message:`${c} record ${x.id} declares entityType ${x.entityType}.`,recordId:x.id,recordType:x.entityType});
 }}
 const ref=(recordId:string,target:string,field:string,expectedType?:string):[string,string,string,string?]=>[recordId,target,field,expectedType];
 const refs:Array<[string,string,string,string?]>=[
  ...db.relationships.map(r=>ref(r.id,r.fromId,"relationship.fromId",r.fromType)),
  ...db.relationships.map(r=>ref(r.id,r.toId,"relationship.toId",r.toType)),
  ...db.loanPayments.map(p=>ref(p.id,p.loanId,"loanPayment.loanId")),
  ...db.loanPayments.filter(p=>p.transactionId).map(p=>ref(p.id,p.transactionId!,"loanPayment.transactionId")),
  ...db.transactions.map(t=>ref(t.id,t.accountId,"transaction.accountId")),
  ...db.transactions.filter(t=>t.counterpartyAccountId).map(t=>ref(t.id,t.counterpartyAccountId!,"transaction.counterpartyAccountId")),
  ...db.transactions.filter(t=>t.loanId).map(t=>ref(t.id,t.loanId!,"transaction.loanId")),
  ...db.transactions.filter(t=>t.eventId).map(t=>ref(t.id,t.eventId!,"transaction.eventId")),
  ...db.vehicles.filter(v=>v.assetId).map(v=>ref(v.id,v.assetId!,"vehicle.assetId")),
  ...db.vehicleMaintenance.map(v=>ref(v.id,v.vehicleId,"maintenance.vehicleId")),
  ...db.vehicleMaintenance.filter(v=>v.eventId).map(v=>ref(v.id,v.eventId!,"maintenance.eventId")),
  ...db.rooms.map(r=>ref(r.id,r.propertyId,"room.propertyId")),
  ...db.homeSystems.map(s=>ref(s.id,s.propertyId,"homeSystem.propertyId")),
  ...db.electricalDevices.map(d=>ref(d.id,d.propertyId,"electricalDevice.propertyId")),
  ...db.electricalDevices.filter(d=>d.roomId).map(d=>ref(d.id,d.roomId!,"electricalDevice.roomId")),
  ...db.electricalDevices.filter(d=>d.panelId).map(d=>ref(d.id,d.panelId!,"electricalDevice.panelId"))
 ];
 for(const [recordId,target,field,expectedType] of refs){const targetInfo=ids.get(target);if(!targetInfo) errors.push({severity:"error",code:"BROKEN_REFERENCE",message:`${field} on ${recordId} references missing id ${target}.`,recordId});else if(expectedType&&targetInfo!==expectedType) errors.push({severity:"error",code:"REFERENCE_TYPE_MISMATCH",message:`${field} on ${recordId} references ${target}, which is ${targetInfo}; expected ${expectedType}.`,recordId});}
 if(db.schemaVersion!==db.metadata.schemaVersion) errors.push({severity:"error",code:"SCHEMA_VERSION_MISMATCH",message:"Database and metadata schema versions differ."});
 if(db.seedVersion!==db.metadata.seedVersion) errors.push({severity:"error",code:"SEED_VERSION_MISMATCH",message:"Database and metadata seed versions differ."});
 if(db.appVersion!==db.metadata.appVersion) errors.push({severity:"error",code:"APP_VERSION_MISMATCH",message:"Database and metadata app versions differ."});
 return {valid:errors.length===0,errors,warnings,counts};
}
