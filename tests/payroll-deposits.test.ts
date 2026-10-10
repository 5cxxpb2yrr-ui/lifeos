import assert from "node:assert/strict";
import test from "node:test";
import {createEmptyDatabase} from "../domain/services/empty-database.ts";
import {importPayrollDeposits,payrollForecastFlows} from "../domain/resolvers/payroll-deposits.ts";
import {resolveFinancialHealth} from "../domain/resolvers/financial-health.ts";

const history=[
 {transaction_id:"p1",date:"2026-07-17",amount:-3593.81,name:"KIA GEORGIA INC. PAYROLL"},
 {transaction_id:"p2",date:"2026-07-31",amount:-2765.84,name:"KIA GEORGIA INC. PAYROLL"},
 {transaction_id:"p3",date:"2026-08-14",amount:-2606.81,name:"KIA GEORGIA INC. PAYROLL"},
 {transaction_id:"p4",date:"2026-08-28",amount:-4040.32,name:"KIA GEORGIA INC. PAYROLL"},
 {transaction_id:"p5",date:"2026-09-11",amount:-2983.36,name:"KIA GEORGIA INC. PAYROLL"},
 {transaction_id:"p6",date:"2026-09-25",amount:-2983.35,name:"KIA GEORGIA INC. PAYROLL"},
 {transaction_id:"p7",date:"2026-09-30",amount:-904.32,name:"KIA GEORGIA INC. PAYROLL"},
 {transaction_id:"x1",date:"2026-09-20",amount:-125,name:"VENMO CASHOUT"}
];

test("imports only posted payroll deposits, deduplicates them, and does not inflate cash",()=>{
 const db=createEmptyDatabase("2026-10-09T00:00:00.000Z");
 db.accounts.push({id:"usaa",entityType:"financial_account",createdAt:"2026-01-01T00:00:00.000Z",updatedAt:"2026-01-01T00:00:00.000Z",name:"USAA Checking",institution:"USAA",accountType:"checking",currency:"USD",openingBalanceMinor:100000});
 const first=importPayrollDeposits(db,history,"2026-10-09T00:00:00.000Z");
 assert.equal(first.imported,7);
 assert.equal(first.ignored,1);
 const next=structuredClone(db);
 next.transactions.push(...first.transactions);
 assert.equal(resolveFinancialHealth(next).cashMinor,100000);
 const second=importPayrollDeposits(next,history,"2026-10-09T00:00:00.000Z");
 assert.equal(second.imported,0);
 assert.equal(second.duplicates,7);
});

test("projects next biweekly payroll from regular deposits and ignores supplemental deposit timing",()=>{
 const db=createEmptyDatabase("2026-10-09T00:00:00.000Z");
 const imported=importPayrollDeposits(db,history,"2026-10-09T00:00:00.000Z");
 const flows=payrollForecastFlows(imported.transactions,"2026-10-09",30);
 assert.equal(flows[0]?.date,"2026-10-09");
 assert.equal(flows[0]?.direction,"inflow");
 assert.equal(flows[0]?.amountMinor,298336);
 assert.match(flows[0]?.title??"",/historical median/);
});

test("does not invent a cadence from fewer than three deposits",()=>{
 const db=createEmptyDatabase("2026-10-09T00:00:00.000Z");
 const imported=importPayrollDeposits(db,history.slice(0,2),"2026-10-09T00:00:00.000Z");
 assert.deepEqual(payrollForecastFlows(imported.transactions,"2026-10-09",30),[]);
});
