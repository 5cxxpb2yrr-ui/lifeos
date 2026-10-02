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
  assert.equal(db.events[0].completedAt!==undefined,true);
  db=createOpenLoop(db,{title:"Test loop",type:"task"});
  const loop=db.openLoops[0];
  db=updateOpenLoopStatus(db,loop.id,"resolved");
  assert.equal(db.openLoops[0].status,"resolved");
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
