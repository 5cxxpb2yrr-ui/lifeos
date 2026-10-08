import assert from "node:assert/strict";
import test from "node:test";
import {createEmptyDatabase} from "../domain/services/empty-database.ts";
import {resolveCashForecast} from "../domain/resolvers/cash-forecast.ts";

test("cash forecast combines current cash, scheduled debt, recurring flows, and future event amounts",()=>{
 const db=createEmptyDatabase("2026-10-07T00:00:00.000Z");
 db.accounts.push({id:"acct-1",entityType:"financial_account",createdAt:"2026-01-01T00:00:00.000Z",updatedAt:"2026-01-01T00:00:00.000Z",name:"Checking",accountType:"checking",currency:"USD",openingBalanceMinor:150000});
 db.loanPayments.push({id:"pay-1",entityType:"loan_payment",createdAt:"2026-01-01T00:00:00.000Z",updatedAt:"2026-01-01T00:00:00.000Z",loanId:"loan-1",scheduledDate:"2026-10-09",scheduledAmountMinor:60000,status:"scheduled"});
 db.recurringRules.push({id:"rule-1",entityType:"recurring_rule",createdAt:"2026-01-01T00:00:00.000Z",updatedAt:"2026-01-01T00:00:00.000Z",name:"Payday",eventType:"income",frequency:"weekly",startDate:"2026-10-08",nextOccurrence:"2026-10-08",enabled:true,template:{amountMinor:20000,direction:"income"}});
 db.recurringRules.push({id:"rule-2",entityType:"recurring_rule",createdAt:"2026-01-01T00:00:00.000Z",updatedAt:"2026-01-01T00:00:00.000Z",name:"Utility",eventType:"expense",frequency:"weekly",startDate:"2026-10-10",nextOccurrence:"2026-10-10",enabled:true,template:{amountMinor:10000,direction:"expense"}});
 db.events.push({id:"evt-1",entityType:"event",createdAt:"2026-01-01T00:00:00.000Z",updatedAt:"2026-01-01T00:00:00.000Z",eventType:"expense",title:"Large purchase",status:"planned",dueAt:"2026-10-11T12:00:00.000Z",metadata:{amountMinor:120000}});
 const view=resolveCashForecast(db,{startDate:"2026-10-07",horizonDays:5});
 assert.equal(view.startingBalanceMinor,150000);
 assert.equal(view.points.find(p=>p.date==="2026-10-08")?.inflowMinor,20000);
 assert.equal(view.points.find(p=>p.date==="2026-10-09")?.outflowMinor,60000);
 assert.equal(view.points.find(p=>p.date==="2026-10-10")?.outflowMinor,10000);
 assert.equal(view.points.find(p=>p.date==="2026-10-11")?.outflowMinor,120000);
 assert.equal(view.points.find(p=>p.date==="2026-10-10")?.billMinor,10000);
 assert.equal(view.points.find(p=>p.date==="2026-10-09")?.loanPaymentMinor,60000);
 assert.equal(view.endingBalanceMinor,-20000);
 assert.equal(view.firstNegativeDate,"2026-10-11");
});

test("cash forecast accepts a starting cash override and reports the first negative day",()=>{
 const db=createEmptyDatabase("2026-10-07T00:00:00.000Z");
 db.events.push({id:"evt-1",entityType:"event",createdAt:"2026-01-01T00:00:00.000Z",updatedAt:"2026-01-01T00:00:00.000Z",eventType:"expense",title:"Bill",status:"planned",dueAt:"2026-10-08T12:00:00.000Z",metadata:{amountMinor:20000}});
 const view=resolveCashForecast(db,{startDate:"2026-10-07",horizonDays:3,startingCashMinor:10000});
 assert.equal(view.startingBalanceMinor,10000);
 assert.equal(view.firstNegativeDate,"2026-10-08");
 assert.equal(view.lowestBalanceMinor,-10000);
 assert.equal(view.lowestBalanceDate,"2026-10-08");
});

test("cash pressure exposes the forecast day and all pressure-day obligations",()=>{
 const db=createEmptyDatabase("2026-10-07T00:00:00.000Z");
 db.accounts.push({id:"acct-1",entityType:"financial_account",createdAt:"2026-01-01T00:00:00.000Z",updatedAt:"2026-01-01T00:00:00.000Z",name:"Checking",accountType:"checking",currency:"USD",openingBalanceMinor:50000});
 db.loanPayments.push({id:"pay-1",entityType:"loan_payment",createdAt:"2026-01-01T00:00:00.000Z",updatedAt:"2026-01-01T00:00:00.000Z",loanId:"loan-1",scheduledDate:"2026-10-08",scheduledAmountMinor:30000,status:"scheduled"});
 db.recurringRules.push({id:"rule-1",entityType:"recurring_rule",createdAt:"2026-01-01T00:00:00.000Z",updatedAt:"2026-01-01T00:00:00.000Z",name:"Power Bill",eventType:"expense",frequency:"monthly",startDate:"2026-10-08",nextOccurrence:"2026-10-08",enabled:true,template:{amountMinor:15000,direction:"expense"}});
 const view=resolveCashForecast(db,{startDate:"2026-10-07",horizonDays:3});
 const pressure=require("../domain/resolvers/cash-pressure.ts");
 const result=pressure.resolveCashPressure(db,{startDate:"2026-10-07",horizonDays:3});
 assert.equal(result.lowestBalanceDate,"2026-10-08");
 const item=result.attention[0];
 assert.equal(item.context?.forecastDate,"2026-10-08");
 assert.equal((item.context?.obligations as unknown[]).length,2);
});
