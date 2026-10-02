import type {LifeOSDatabase,CollectionName} from "@/domain/contracts/database";
export interface IntegrityIssue{severity:"error"|"warning";code:string;message:string;recordId?:string;recordType?:string}
export interface IntegrityResult{valid:boolean;errors:IntegrityIssue[];warnings:IntegrityIssue[];counts:Record<CollectionName,number>}
const entityCollections=["entities","events","openLoops","people","assets","accounts","transactions","loans","loanPayments","vehicles","vehicleMaintenance","properties","rooms","homeSystems","electricalDevices","projects","goals","decisions","documents","recurringRules"] as const;
const typedCollections=entityCollections.filter(c=>c!=="entities") as Exclude<typeof entityCollections[number],"entities">[];
function expectedEntityType(collection:string):string|undefined{const map:Record<string,string>={entities:"entity",events:"event",openLoops:"open_loop",people:"person",assets:"asset",accounts:"financial_account",transactions:"financial_transaction",loans:"loan",loanPayments:"loan_payment",vehicles:"vehicle",vehicleMaintenance:"vehicle_maintenance",properties:"property",rooms:"room",homeSystems:"home_system",electricalDevices:"electrical_device",projects:"project",goals:"goal",decisions:"decision",documents:"document",recurringRules:"recurring_rule"};return map[collection]}
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
 const refs:Array<[string,string,string,string?]> = [];\n const entityRefArrays:Array<[string,string,string[]|undefined][]> = [];
 for(const e of db.events){
  entityRefArrays.push([
   [e.id,"event.personIds",e.personIds], [e.id,"event.assetIds",e.assetIds], [e.id,"event.projectIds",e.projectIds],
   [e.id,"event.goalIds",e.goalIds], [e.id,"event.openLoopIds",e.openLoopIds], [e.id,"event.decisionIds",e.decisionIds],
   [e.id,"event.financialTransactionIds",e.financialTransactionIds], [e.id,"event.documentIds",e.documentIds]
  ]);
 }
 for(const o of db.openLoops){
  entityRefArrays.push([[o.id,"openLoop.relatedEventIds",o.relatedEventIds],[o.id,"openLoop.relatedProjectIds",o.relatedProjectIds],[o.id,"openLoop.relatedDecisionIds",o.relatedDecisionIds]]);
 }
 for(const d of db.decisions){
  entityRefArrays.push([[d.id,"decision.personIds",d.personIds],[d.id,"decision.eventIds",d.eventIds],[d.id,"decision.projectIds",d.projectIds]]);
 }
 for(const v of db.vehicleMaintenance){ if(v.eventId) entityRefArrays.push([[v.id,"maintenance.eventId",[v.eventId]]]); }
 for(const r of db.rooms){ /* propertyId is already validated below */ }
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
 for(const row of entityRefArrays) for(const [recordId,field,targets] of row) for(const target of targets??[]) refs.push(ref(recordId,target,field));
 for(const [recordId,target,field,expectedType] of refs){const targetInfo=ids.get(target);if(!targetInfo) errors.push({severity:"error",code:"BROKEN_REFERENCE",message:`${field} on ${recordId} references missing id ${target}.`,recordId});else if(expectedType&&targetInfo!==expectedType) errors.push({severity:"error",code:"REFERENCE_TYPE_MISMATCH",message:`${field} on ${recordId} references ${target}, which is ${targetInfo}; expected ${expectedType}.`,recordId});}
 for(const r of db.relationships){
 const allowed=["related_to","person_for","owns","uses","belongs_to","part_of","located_in","supports","depends_on","created_by","assigned_to","linked_to","caused_by","documents","scheduled_for","paid_by","payment_for","maintenance_for","child_of","parent_of","member_of"];
 if(!allowed.includes(r.relationshipType)) errors.push({severity:"error",code:"INVALID_RELATIONSHIP_TYPE",message:`Relationship ${r.id} has invalid type ${r.relationshipType}.`,recordId:r.id,recordType:r.entityType});
}
for(const a of db.auditEntries){
 const targetInfo=ids.get(a.targetId);
 if(!targetInfo) errors.push({severity:"error",code:"BROKEN_AUDIT_TARGET",message:`Audit entry ${a.id} targets missing id ${a.targetId}.`,recordId:a.id,recordType:a.entityType});
 if(a.action!=="create"&&a.action!=="update"&&a.action!=="delete"&&a.action!=="import"&&a.action!=="export"&&a.action!=="restore"&&a.action!=="migrate") errors.push({severity:"error",code:"INVALID_AUDIT_ACTION",message:`Audit entry ${a.id} has invalid action ${a.action}.`,recordId:a.id,recordType:a.entityType});
 if(a.action==="create"&&a.before!==undefined) warnings.push({severity:"warning",code:"CREATE_HAS_BEFORE_SNAPSHOT",message:`Create audit ${a.id} unexpectedly contains a before snapshot.`,recordId:a.id,recordType:a.entityType});
 if((a.action==="update"||a.action==="delete")&&!a.before) errors.push({severity:"error",code:"MISSING_AUDIT_BEFORE",message:`Audit entry ${a.id} is missing its before snapshot.`,recordId:a.id,recordType:a.entityType});
 if(a.action!=="delete"&&!a.after) errors.push({severity:"error",code:"MISSING_AUDIT_AFTER",message:`Audit entry ${a.id} is missing its after snapshot.`,recordId:a.id,recordType:a.entityType});
 if(a.before&&a.before.id!==a.targetId) errors.push({severity:"error",code:"AUDIT_BEFORE_ID_MISMATCH",message:`Audit entry ${a.id} before snapshot id does not match target.`,recordId:a.id,recordType:a.entityType});
 if(a.after&&a.after.id!==a.targetId) errors.push({severity:"error",code:"AUDIT_AFTER_ID_MISMATCH",message:`Audit entry ${a.id} after snapshot id does not match target.`,recordId:a.id,recordType:a.entityType});
}
if(db.schemaVersion!==db.metadata.schemaVersion) errors.push({severity:"error",code:"SCHEMA_VERSION_MISMATCH",message:"Database and metadata schema versions differ."});
 if(db.seedVersion!==db.metadata.seedVersion) errors.push({severity:"error",code:"SEED_VERSION_MISMATCH",message:"Database and metadata seed versions differ."});
 if(db.appVersion!==db.metadata.appVersion) errors.push({severity:"error",code:"APP_VERSION_MISMATCH",message:"Database and metadata app versions differ."});
 return {valid:errors.length===0,errors,warnings,counts};
}
