import assert from "node:assert/strict";
import test from "node:test";
import {createEmptyDatabase} from "../domain/services/empty-database.ts";
import {resolveMissionControl} from "../domain/resolvers/mission-control.ts";

test("Mission Control surfaces cash pressure with a forecast date and canonical source entry",()=>{
 const db=createEmptyDatabase("2026-10-07T00:00:00.000Z");
 db.accounts.push({
  id:"acct-1",entityType:"financial_account",createdAt:"2026-01-01T00:00:00.000Z",
  updatedAt:"2026-01-01T00:00:00.000Z",name:"Checking",accountType:"checking",
  currency:"USD",openingBalanceMinor:100000
 });
 db.events.push({
  id:"evt-bill",entityType:"event",createdAt:"2026-01-01T00:00:00.000Z",
  updatedAt:"2026-01-01T00:00:00.000Z",eventType:"expense",title:"Mortgage",
  status:"planned",dueAt:"2026-10-08T09:00:00.000Z",metadata:{amountMinor:97500}
 });
 const vm=resolveMissionControl(db,new Date("2026-10-07T12:00:00.000Z"));
 const attention=vm.attention.find(x=>x.sourceType==="cash_pressure");
 assert.ok(attention);
 assert.equal(attention?.attention,"at_risk");
 assert.equal(attention?.context?.forecastDate,"2026-10-08");
 const entries=attention?.context?.underlyingEntries as Array<{sourceType:string;sourceId:string;title:string;amountMinor:number}>;
 assert.equal(entries.length,1);
 assert.equal(entries[0]?.sourceType,"event");
 assert.equal(entries[0]?.sourceId,"evt-bill");
 assert.equal(entries[0]?.title,"Mortgage");
 assert.equal(entries[0]?.amountMinor,97500);
 const point=vm.cashForecast.points.find(x=>x.date==="2026-10-08");
 assert.equal(point?.closingBalanceMinor,2500);
});

test("healthy cash pressure does not create a Mission Control attention item",()=>{
 const db=createEmptyDatabase("2026-10-07T00:00:00.000Z");
 db.accounts.push({
  id:"acct-1",entityType:"financial_account",createdAt:"2026-01-01T00:00:00.000Z",
  updatedAt:"2026-01-01T00:00:00.000Z",name:"Checking",accountType:"checking",
  currency:"USD",openingBalanceMinor:100000
 });
 const vm=resolveMissionControl(db,new Date("2026-10-07T12:00:00.000Z"));
 assert.equal(vm.attention.some(x=>x.sourceType==="cash_pressure"),false);
 assert.equal(vm.cashPressure.state,"healthy");
});
