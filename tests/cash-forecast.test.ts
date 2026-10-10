import assert from "node:assert/strict";
import test from "node:test";
import {createEmptyDatabase} from "../domain/services/empty-database.ts";
import {resolveCashForecast} from "../domain/resolvers/cash-forecast.ts";
import {resolveCashPressure} from "../domain/resolvers/cash-pressure.ts";

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
 const result=resolveCashPressure(db,{startDate:"2026-10-07",horizonDays:3});
 assert.equal(result.lowestBalanceDate,"2026-10-08");
 const item=result.attention[0];
 assert.equal(item.context?.forecastDate,"2026-10-08");
 assert.equal((item.context?.obligations as unknown[]).length,2);
});

test("cash forecast accepts source-aware external financial flows without mutating canonical data",()=>{
 const db=createEmptyDatabase("2026-10-07T00:00:00.000Z");
 const view=resolveCashForecast(db,{
  startDate:"2026-10-07",
  horizonDays:3,
  startingCashMinor:28345,
  externalFlows:[
   {date:"2026-10-08",amountMinor:2500,direction:"outflow",sourceId:"affirm-1",title:"Affirm — Streaming Bundle"},
   {date:"2026-10-09",amountMinor:341033,direction:"inflow",sourceId:"payroll-1",title:"Payroll"}
  ]
 });
 assert.equal(view.points[1].outflowMinor,2500);
 assert.equal(view.points[2].inflowMinor,341033);
 assert.equal(view.points[2].closingBalanceMinor,366878);
 assert.deepEqual(view.points[1].entries[0],{
  date:"2026-10-08",amountMinor:2500,direction:"outflow",sourceType:"external",
  sourceId:"affirm-1",title:"Affirm — Streaming Bundle",priority:undefined
 });
 assert.equal(db.events.length,0);
 assert.equal(db.recurringRules.length,0);
});

test("cash forecast exposes recurring income as payday metadata",()=>{
 const db=createEmptyDatabase("2026-10-07T00:00:00.000Z");
 db.recurringRules.push({id:"payday-rule",entityType:"recurring_rule",createdAt:"2026-01-01T00:00:00.000Z",updatedAt:"2026-01-01T00:00:00.000Z",name:"Biweekly payday",eventType:"income",frequency:"biweekly",startDate:"2026-10-08",nextOccurrence:"2026-10-08",enabled:true,template:{amountMinor:125000,direction:"income"}});
 const view=resolveCashForecast(db,{startDate:"2026-10-07",horizonDays:4,startingCashMinor:0});
 assert.deepEqual(view.paydays,[{date:"2026-10-08",amountMinor:125000,sourceType:"recurring_rule",sourceId:"payday-rule",title:"Biweekly payday"}]);
});

test("cash forecast recognizes explicit income direction as payday even when event type is generic",()=>{
 const db=createEmptyDatabase("2026-10-07T00:00:00.000Z");
 db.recurringRules.push({id:"payday-direction",entityType:"recurring_rule",createdAt:"2026-01-01T00:00:00.000Z",updatedAt:"2026-01-01T00:00:00.000Z",name:"Payday by direction",eventType:"other",frequency:"biweekly",startDate:"2026-10-08",nextOccurrence:"2026-10-08",enabled:true,template:{amountMinor:125000,direction:"income"}});
 const view=resolveCashForecast(db,{startDate:"2026-10-07",horizonDays:4,startingCashMinor:0});
 assert.deepEqual(view.paydays,[{date:"2026-10-08",amountMinor:125000,sourceType:"recurring_rule",sourceId:"payday-direction",title:"Payday by direction"}]);
});

test("cash forecast keeps same-day income and expenses separate instead of netting categories",()=>{
 const db=createEmptyDatabase("2026-10-07T00:00:00.000Z");
 db.recurringRules.push({id:"payday-same-day",entityType:"recurring_rule",createdAt:"2026-01-01T00:00:00.000Z",updatedAt:"2026-01-01T00:00:00.000Z",name:"Payday",eventType:"income",frequency:"weekly",startDate:"2026-10-08",nextOccurrence:"2026-10-08",enabled:true,template:{amountMinor:100000,direction:"income"}});
 db.recurringRules.push({id:"bill-same-day",entityType:"recurring_rule",createdAt:"2026-01-01T00:00:00.000Z",updatedAt:"2026-01-01T00:00:00.000Z",name:"Rent",eventType:"expense",frequency:"weekly",startDate:"2026-10-08",nextOccurrence:"2026-10-08",enabled:true,template:{amountMinor:80000,direction:"expense"}});
 db.events.push({id:"income-event",entityType:"event",createdAt:"2026-01-01T00:00:00.000Z",updatedAt:"2026-01-01T00:00:00.000Z",eventType:"income",title:"Reimbursement",status:"planned",dueAt:"2026-10-08T12:00:00.000Z",metadata:{amountMinor:5000}});
 db.events.push({id:"expense-event",entityType:"event",createdAt:"2026-01-01T00:00:00.000Z",updatedAt:"2026-01-01T00:00:00.000Z",eventType:"expense",title:"Groceries",status:"planned",dueAt:"2026-10-08T12:00:00.000Z",metadata:{amountMinor:12000}});
 const point=resolveCashForecast(db,{startDate:"2026-10-08",horizonDays:1,startingCashMinor:50000}).points[0];
 assert.equal(point.inflowMinor,105000);
 assert.equal(point.outflowMinor,92000);
 assert.equal(point.closingBalanceMinor,63000);
 assert.equal(point.incomeMinor,105000);
 assert.equal(point.billMinor,80000);
 assert.equal(point.otherExpenseMinor,12000);
});

test("cash pressure includes external outflows in the lowest-day obligation explanation",()=>{
 const db=createEmptyDatabase("2026-10-07T00:00:00.000Z");
 db.accounts.push({id:"acct-1",entityType:"financial_account",createdAt:"2026-01-01T00:00:00.000Z",updatedAt:"2026-01-01T00:00:00.000Z",name:"Checking",accountType:"checking",currency:"USD",openingBalanceMinor:10000});
 const result=resolveCashPressure(db,{
  startDate:"2026-10-08",
  horizonDays:1,
  externalFlows:[{date:"2026-10-08",amountMinor:25000,direction:"outflow",sourceId:"affirm-payment-1",title:"Affirm installment",priority:1}]
 } as Parameters<typeof resolveCashPressure>[1]);
 const pressure=result.attention[0];
 assert.equal(result.state,"negative");
 assert.ok(result.forecast.points[0].entries.some(entry=>entry.sourceId==="affirm-payment-1"));
 assert.ok((pressure.context?.obligations as Array<{id:string}>).some(item=>item.id==="affirm-payment-1"));
});
