import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyDatabase } from "../domain/services/empty-database";
import { createEvent, createOpenLoop, updateEventStatus, updateOpenLoopStatus } from "../domain/services/operations";
import { createVehicleMaintenance, createRelationship } from "../domain/services/asset-operations";
import { createHomeEvent } from "../domain/services/home-operations";
import { createLoanPayment, recordLoanPayment } from "../domain/services/financial-operations";
import { resolveFinancialHealth } from "../domain/resolvers/financial-health";
import { validateLifeOSBackup, validateSeedBackup, restoreBackup, importSeed } from "../domain/services/seed";
import { validateDatabaseIntegrity } from "../domain/resolvers/integrity";
import { updateVehicleMaintenance } from "../domain/services/asset-operations";
import { updateHomeEvent } from "../domain/services/home-operations";
import { createGoal, updateGoal } from "../domain/services/goal-operations";
import { createProject, updateProject } from "../domain/services/project-operations";
import { createDecision, updateDecision } from "../domain/services/decision-operations";
import { createPropertyEvent, updatePropertyEvent } from "../domain/services/property-operations";


function base() { return createEmptyDatabase("2026-10-02T12:00:00.000Z"); }
function entity(id:string, entityType:string) {
  const t="2026-10-02T12:00:00.000Z";
  return {id,entityType,createdAt:t,updatedAt:t};
}

test("empty database has all canonical collections and placeholder seed is not accepted as immutable",()=>{
  const db=base();
  for(const key of ["entities","relationships","events","openLoops","people","assets","accounts","transactions","loans","loanPayments","vehicles","vehicleMaintenance","properties","rooms","homeSystems","electricalDevices","projects","goals","decisions","documents","recurringRules","auditEntries"]) assert.ok(Array.isArray(db[key as keyof typeof db]));
  const backup={format:"lifeos-backup",formatVersion:"1",schemaVersion:db.schemaVersion,seedVersion:db.seedVersion,appVersion:db.appVersion,exportedAt:"2026-10-02T12:00:00.000Z",database:db} as const;
  assert.equal(validateLifeOSBackup(backup),true);
  assert.equal(validateSeedBackup(backup),false);
});

test("event and open-loop lifecycle writes audit history",()=>{
  let db=base();
  db=createEvent(db,{title:"Test event",eventType:"task",status:"planned"});
  const event=db.events[0];
  assert.equal(db.auditEntries.length,1);
  db=updateEventStatus(db,event.id,"completed");
  assert.equal(db.events[0].status,"completed");
  assert.equal(db.auditEntries[1].before?.status,"planned");
  assert.equal(db.auditEntries[1].after?.status,"completed");
  assert.equal(db.events[0].completedAt!==undefined,true);
  db=createOpenLoop(db,{title:"Test loop",type:"task"});
  const loop=db.openLoops[0];
  db=updateOpenLoopStatus(db,loop.id,"resolved");
  assert.equal(db.openLoops[0].status,"resolved");
  assert.equal(db.auditEntries[3].before?.status,"open");
  assert.equal(db.auditEntries[3].after?.status,"resolved");
  assert.equal(db.openLoops[0].resolvedAt!==undefined,true);
  assert.equal(db.auditEntries.length,4);
});

test("vehicle maintenance creates canonical maintenance event and audit",()=>{
  let db=base();
  db={...db,vehicles:[{...entity("veh-1","vehicle"),make:"Test",model:"Vehicle",mileageUnit:"mi",status:"owned"} as any]};
  db=createVehicleMaintenance(db,{vehicleId:"veh-1",date:"2026-10-02",serviceType:"Oil Change",costMinor:6500});
  assert.equal(db.vehicleMaintenance.length,1);
  assert.equal(db.events.length,1);
  assert.equal(db.events[0].eventType,"maintenance");
  assert.equal(db.events[0].metadata?.vehicleId,"veh-1");
  assert.equal(db.vehicleMaintenance[0].eventId,db.events[0].id);
});

test("home operation creates canonical event",()=>{
  let db=base();
  db=createHomeEvent(db,{title:"HVAC inspection",eventType:"inspection",status:"completed"});
  assert.equal(db.events.length,1);
  assert.equal(db.events[0].eventType,"inspection");
});

test("loan payment records financial transaction, event, relationships, and balance impact",()=>{
  let db=base();
  db={...db,
    accounts:[{...entity("acct-1","financial_account"),name:"Checking",accountType:"checking",currency:"USD",openingBalanceMinor:100000} as any],
    loans:[{...entity("loan-1","loan"),provider:"Test Provider",loanType:"installment",name:"Test Loan",originalPrincipalMinor:50000,currency:"USD",linkedAccountId:"acct-1",status:"active"} as any]
  };
  db=createLoanPayment(db,{loanId:"loan-1",scheduledDate:"2026-10-10",scheduledAmountMinor:10000});
  const payment=db.loanPayments[0];
  db=recordLoanPayment(db,payment.id,7500,"2026-10-02");
  assert.equal(db.loanPayments[0].status,"partial");
  assert.equal(db.loanPayments[0].paidAmountMinor,7500);
  assert.equal(db.transactions.length,1);
  assert.equal(db.transactions[0].amountMinor,7500);
  assert.equal(db.transactions[0].eventId,db.events[0].id);
  assert.equal(db.loanPayments[0].transactionId,db.transactions[0].id);
  assert.equal(db.events[0].eventType,"payment");
  assert.equal(db.relationships.filter(r=>r.relationshipType==="payment_for").length,3);
  const health=resolveFinancialHealth(db);
  assert.equal(health.cashMinor,92500);
  assert.equal(health.scheduledDebtMinor,2500);
});

test("loan payment without linked account still creates canonical payment event",()=>{
  let db=base();
  db={...db,loans:[{...entity("loan-2","loan"),provider:"Test",loanType:"installment",name:"No Account Loan",originalPrincipalMinor:10000,currency:"USD",status:"active"} as any]};
  db=createLoanPayment(db,{loanId:"loan-2",scheduledDate:"2026-10-10",scheduledAmountMinor:1000});
  db=recordLoanPayment(db,db.loanPayments[0].id,1000,"2026-10-02");
  assert.equal(db.transactions.length,0);
  assert.equal(db.events.length,1);
  assert.equal(db.loanPayments[0].status,"paid");
});

test("integrity resolver detects broken graph references",()=>{
  const db=base();
  const broken={...db,loans:[{...entity("loan-x","loan"),provider:"X",loanType:"installment",name:"Broken",originalPrincipalMinor:100,currency:"USD",status:"active"} as any],loanPayments:[{...entity("payment-x","loan_payment"),loanId:"missing-loan",scheduledDate:"2026-10-02",scheduledAmountMinor:100,status:"scheduled"} as any]};
  const result=validateDatabaseIntegrity(broken);
  assert.equal(result.valid,false);
  assert.equal(result.errors.some(x=>x.code==="BROKEN_REFERENCE"),true);
});

test("backup restore and seed import clone database without sharing object references",()=>{
  const db=base();
  const backup={format:"lifeos-backup" as const,formatVersion:"1",schemaVersion:db.schemaVersion,seedVersion:"REAL-SEED-1",appVersion:db.appVersion,exportedAt:"2026-10-02T12:00:00.000Z",database:{...db,seedVersion:"REAL-SEED-1",metadata:{...db.metadata,seedVersion:"REAL-SEED-1"}}};
  assert.equal(validateSeedBackup(backup),true);
  const restored=restoreBackup(backup);
  const imported=importSeed(backup);
  assert.notEqual(restored.metadata.databaseId,undefined);
  restored.events.push({id:"evt-x",entityType:"event",createdAt:"2026-10-02T12:00:00.000Z",updatedAt:"2026-10-02T12:00:00.000Z",eventType:"task",title:"clone",status:"planned"});
  assert.equal(imported.events.length,0);
});


test("integrity resolver detects relationship type mismatches and duplicate IDs",()=>{
  let db=base();
  db={...db,
    accounts:[{...entity("acct-1","financial_account"),name:"Checking",accountType:"checking",currency:"USD"} as any],
    loans:[{...entity("loan-1","loan"),provider:"Test",loanType:"installment",name:"Loan",originalPrincipalMinor:1000,currency:"USD",status:"active"} as any],
    relationships:[{...entity("rel-1","relationship"),fromId:"loan-1",fromType:"loan",toId:"acct-1",toType:"loan",relationshipType:"linked_to"} as any]
  };
  let result=validateDatabaseIntegrity(db);
  assert.equal(result.valid,false);
  assert.equal(result.errors.some(x=>x.code==="REFERENCE_TYPE_MISMATCH"),true);
  db={...db,events:[{...entity("loan-1","event"),eventType:"task",title:"Duplicate",status:"planned"} as any]};
  result=validateDatabaseIntegrity(db);
  assert.equal(result.valid,false);
  assert.equal(result.errors.some(x=>x.code==="DUPLICATE_ID"),true);
});

test("backup validator rejects structurally invalid graph even when envelope is valid",()=>{
  const db=base();
  const broken={...db,
    loans:[{...entity("loan-1","loan"),provider:"Test",loanType:"installment",name:"Broken",originalPrincipalMinor:1000,currency:"USD",status:"active"} as any],
    loanPayments:[{...entity("pay-1","loan_payment"),loanId:"missing",scheduledDate:"2026-10-02",scheduledAmountMinor:100,status:"scheduled"} as any]
  };
  const backup={format:"lifeos-backup" as const,formatVersion:"1",schemaVersion:broken.schemaVersion,seedVersion:broken.seedVersion,appVersion:broken.appVersion,exportedAt:"2026-10-02T12:00:00.000Z",database:broken};
  assert.equal(validateLifeOSBackup(backup),false);
});

test("repeated loan payment recording updates one canonical payment transaction and event",()=>{
  let db=base();
  db={...db,
    accounts:[{...entity("acct-1","financial_account"),name:"Checking",accountType:"checking",currency:"USD",openingBalanceMinor:50000} as any],
    loans:[{...entity("loan-1","loan"),provider:"Test",loanType:"installment",name:"Loan",originalPrincipalMinor:20000,currency:"USD",linkedAccountId:"acct-1",status:"active"} as any]
  };
  db=createLoanPayment(db,{loanId:"loan-1",scheduledDate:"2026-10-10",scheduledAmountMinor:5000});
  const payment=db.loanPayments[0];
  db=recordLoanPayment(db,payment.id,2500,"2026-10-02");
  assert.equal(db.transactions.length,1);
  assert.equal(db.events.length,1);
  db=recordLoanPayment(db,payment.id,5000,"2026-10-03");
  assert.equal(db.transactions.length,1);
  assert.equal(db.events.length,1);
  assert.equal(db.loanPayments[0].paidAmountMinor,5000);
});


test("restore candidate follows parse, validate, clone, revalidate, write, reload, verify semantics",()=>{
  const db=base();
  const backup={format:"lifeos-backup" as const,formatVersion:"1",schemaVersion:db.schemaVersion,seedVersion:db.seedVersion,appVersion:db.appVersion,exportedAt:"2026-10-02T12:00:00.000Z",database:db};
  const parsed=JSON.parse(JSON.stringify(backup)) as typeof backup;
  assert.equal(validateLifeOSBackup(parsed),true);
  const candidate=structuredClone(restoreBackup(parsed));
  assert.equal(validateDatabaseIntegrity(candidate).valid,true);
  candidate.events.push({id:"evt-runtime",entityType:"event",createdAt:"2026-10-02T12:00:00.000Z",updatedAt:"2026-10-02T12:00:00.000Z",eventType:"task",title:"Runtime",status:"planned"});
  assert.equal(validateDatabaseIntegrity(candidate).valid,true);
  const reloaded=structuredClone(candidate);
  assert.equal(validateDatabaseIntegrity(reloaded).valid,true);
  assert.equal(JSON.stringify(reloaded),JSON.stringify(candidate));
  assert.equal(JSON.stringify(db),JSON.stringify(backup.database));
});

test("corruption rejection leaves the current database unchanged",()=>{
  const current=base();
  current.events.push({id:"evt-current",entityType:"event",createdAt:"2026-10-02T12:00:00.000Z",updatedAt:"2026-10-02T12:00:00.000Z",eventType:"task",title:"Keep me",status:"planned"});
  const before=JSON.stringify(current);
  const broken={...current,loanPayments:[{...entity("pay-bad","loan_payment"),loanId:"missing",scheduledDate:"2026-10-02",scheduledAmountMinor:100,status:"scheduled"} as any]};
  assert.equal(validateDatabaseIntegrity(broken).valid,false);
  assert.equal(JSON.stringify(current),before);
});


test("vehicle maintenance preserves before and after audit snapshots",()=>{
 let db=base();
 db={...db,vehicles:[{...entity("veh-a","vehicle"),make:"Test",model:"Vehicle",mileageUnit:"mi",status:"owned"} as any]};
 db=createVehicleMaintenance(db,{vehicleId:"veh-a",date:"2026-10-02",serviceType:"Oil Change",costMinor:6500});
 const id=db.vehicleMaintenance[0].id; db=updateVehicleMaintenance(db,id,{costMinor:7500});
 const audit=db.auditEntries.find(x=>x.targetId===id&&x.action==="update")!;
 assert.equal((audit.before as any).costMinor,6500); assert.equal((audit.after as any).costMinor,7500);
});

test("home, property, goal, project, and decision updates preserve before and after snapshots",()=>{
 let db=base();
 db=createHomeEvent(db,{title:"HVAC",eventType:"inspection",status:"planned"}); const homeId=db.events[0].id; db=updateHomeEvent(db,homeId,{status:"completed"});
 db=createPropertyEvent(db,{title:"Roof",eventType:"inspection",status:"planned"}); const propertyId=db.events[1].id; db=updatePropertyEvent(db,propertyId,{status:"completed"});
 db=createGoal(db,{name:"Goal",level:"annual",status:"planned"}); const goalId=db.goals[0].id; db=updateGoal(db,goalId,{status:"active",currentValue:25});
 db=createProject(db,{name:"Project",status:"planned"}); const projectId=db.projects[0].id; db=updateProject(db,projectId,{status:"active"});
 db=createDecision(db,{question:"Choose"}); const decisionId=db.decisions[0].id; db=updateDecision(db,decisionId,{outcome:"Chosen"});
 const updates=db.auditEntries.filter(x=>x.action==="update");
 assert.equal(updates.length,5);
 assert.equal((updates.find(x=>x.targetId===homeId)!.before as any).status,"planned"); assert.equal((updates.find(x=>x.targetId===homeId)!.after as any).status,"completed");
 assert.equal((updates.find(x=>x.targetId===propertyId)!.before as any).status,"planned"); assert.equal((updates.find(x=>x.targetId===propertyId)!.after as any).status,"completed");
 assert.equal((updates.find(x=>x.targetId===goalId)!.before as any).status,"planned"); assert.equal((updates.find(x=>x.targetId===goalId)!.after as any).status,"active");
 assert.equal((updates.find(x=>x.targetId===projectId)!.before as any).status,"planned"); assert.equal((updates.find(x=>x.targetId===projectId)!.after as any).status,"active");
 assert.equal((updates.find(x=>x.targetId===decisionId)!.before as any).outcome,undefined); assert.equal((updates.find(x=>x.targetId===decisionId)!.after as any).outcome,"Chosen");
});


test("integrity resolver validates embedded graph references and audit snapshots",()=>{
 let db=base();
 db={...db,
  people:[{...entity("person-1","person"),firstName:"A",displayName:"A"} as any],
  events:[{...entity("evt-1","event"),eventType:"task",title:"Event",status:"planned",personIds:["missing-person"]} as any],
  relationships:[{...entity("rel-bad","relationship"),fromId:"evt-1",fromType:"event",toId:"person-1",toType:"person",relationshipType:"not-valid"} as any],
  auditEntries:[{...entity("audit-bad","audit"),action:"update",targetId:"missing-target",targetType:"event",timestamp:"2026-10-02T12:00:00.000Z",before:{id:"wrong"},after:{id:"missing-target"}} as any]
 };
 const result=validateDatabaseIntegrity(db);
 assert.equal(result.valid,false);
 assert.equal(result.errors.some(x=>x.code==="BROKEN_REFERENCE"&&x.recordId==="evt-1"),true);
 assert.equal(result.errors.some(x=>x.code==="INVALID_RELATIONSHIP_TYPE"),true);
 assert.equal(result.errors.some(x=>x.code==="BROKEN_AUDIT_TARGET"),true);
 assert.equal(result.errors.some(x=>x.code==="AUDIT_BEFORE_ID_MISMATCH"),true);
});
