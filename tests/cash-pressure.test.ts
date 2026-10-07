import assert from "node:assert/strict";
import test from "node:test";
import {createEmptyDatabase} from "../domain/services/empty-database.ts";
import {resolveCashPressure} from "../domain/resolvers/cash-pressure.ts";

function cashDb(balanceMinor:number){
 const db=createEmptyDatabase("2026-10-07T00:00:00.000Z");
 db.accounts.push({
  id:"acct-1",entityType:"financial_account",createdAt:"2026-01-01T00:00:00.000Z",
  updatedAt:"2026-01-01T00:00:00.000Z",name:"Checking",accountType:"checking",
  currency:"USD",openingBalanceMinor:balanceMinor
 });
 return db;
}

test("cash pressure is healthy when the forecast retains at least a 20% cash cushion",()=>{
 const db=cashDb(100000);
 const view=resolveCashPressure(db,{startDate:"2026-10-07",horizonDays:3});
 assert.equal(view.state,"healthy");
 assert.equal(view.priority,0);
 assert.equal(view.attention.length,0);
});

test("cash pressure becomes watch when the lowest balance falls below 20% but stays at or above 10%",()=>{
 const db=cashDb(100000);
 db.events.push({
  id:"evt-1",entityType:"event",createdAt:"2026-01-01T00:00:00.000Z",
  updatedAt:"2026-01-01T00:00:00.000Z",eventType:"expense",title:"Bill",
  status:"planned",dueAt:"2026-10-08T12:00:00.000Z",metadata:{amountMinor:85000}
 });
 const view=resolveCashPressure(db,{startDate:"2026-10-07",horizonDays:3});
 assert.equal(view.state,"watch");
 assert.equal(view.priority,3);
 assert.equal(view.attention[0]?.attention,"at_risk");
 assert.equal(view.lowestBalanceMinor,15000);
});

test("cash pressure becomes constrained when the lowest balance falls below 10% without going negative",()=>{
 const db=cashDb(100000);
 db.events.push({
  id:"evt-1",entityType:"event",createdAt:"2026-01-01T00:00:00.000Z",
  updatedAt:"2026-01-01T00:00:00.000Z",eventType:"expense",title:"Bill",
  status:"planned",dueAt:"2026-10-08T12:00:00.000Z",metadata:{amountMinor:95001}
 });
 const view=resolveCashPressure(db,{startDate:"2026-10-07",horizonDays:3});
 assert.equal(view.state,"constrained");
 assert.equal(view.priority,4);
 assert.equal(view.lowestBalanceMinor,4999);
 assert.equal(view.attention[0]?.dueAt,"2026-10-08");
});

test("cash pressure becomes negative when the forecast crosses below zero",()=>{
 const db=cashDb(100000);
 db.events.push({
  id:"evt-1",entityType:"event",createdAt:"2026-01-01T00:00:00.000Z",
  updatedAt:"2026-01-01T00:00:00.000Z",eventType:"expense",title:"Large bill",
  status:"planned",dueAt:"2026-10-08T12:00:00.000Z",metadata:{amountMinor:125000}
 });
 const view=resolveCashPressure(db,{startDate:"2026-10-07",horizonDays:3});
 assert.equal(view.state,"negative");
 assert.equal(view.priority,5);
 assert.equal(view.firstNegativeDate,"2026-10-08");
 assert.equal(view.attention[0]?.attention,"at_risk");
});

test("cash pressure reports insufficient data without a cash source",()=>{
 const db=createEmptyDatabase("2026-10-07T00:00:00.000Z");
 const view=resolveCashPressure(db,{startDate:"2026-10-07",horizonDays:3});
 assert.equal(view.state,"unresolved");
 assert.equal(view.priority,1);
 assert.equal(view.attention[0]?.attention,"unresolved");
});

test("cash pressure accepts an explicit starting cash override without a cash account",()=>{
 const db=createEmptyDatabase("2026-10-07T00:00:00.000Z");
 const view=resolveCashPressure(db,{startDate:"2026-10-07",horizonDays:3,startingCashMinor:50000});
 assert.equal(view.state,"healthy");
 assert.equal(view.attention.length,0);
});
