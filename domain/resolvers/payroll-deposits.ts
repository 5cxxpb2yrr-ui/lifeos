import type {FinancialAccount,FinancialTransaction,LifeOSDatabase} from "@/domain/contracts/database";
import type {CashForecastOptions} from "@/domain/resolvers/cash-forecast";

export interface ConnectedTransactionRecord {
 transaction_id?:string; transactionId?:string; id?:string;
 date?:string; transactionDate?:string; posted_datetime?:string;
 amount?:number|string; amountMinor?:number;
 name?:string; merchant_name?:string; merchant?:string; description?:string;
 account_id?:string; accountId?:string; account_name?:string; institution?:string;
 category?:string|string[]; pending?:boolean; currency?:string; iso_currency_code?:string;
}
export interface DepositImportResult { transactions:FinancialTransaction[]; account?:FinancialAccount; imported:number; duplicates:number; ignored:number; accountId:string; }
const payrollPattern=/\b(payroll|payroll\s*deposit|kia georgia inc)\b/i;
const asDate=(value:unknown)=>typeof value==="string"?value.slice(0,10):"";
const asAmount=(value:unknown)=>{const n=typeof value==="string"?Number(value):Number(value);return Number.isFinite(n)?n:NaN;};
export function isLikelyPayrollDeposit(row:ConnectedTransactionRecord):boolean {
 const label=[row.name,row.merchant_name,row.merchant,row.description].filter(Boolean).join(" ");
 const amount=row.amountMinor!=null?Number(row.amountMinor):asAmount(row.amount);
 return payrollPattern.test(label)&&Number.isFinite(amount)&&amount!==0&&(row.pending!==true);
}
/** Converts connected-ledger rows (provider convention: positive=debit, negative=credit) to LifeOS transactions. */
export function importPayrollDeposits(db:LifeOSDatabase,rows:ConnectedTransactionRecord[],now=new Date().toISOString(),currentBalanceMinor?:number):DepositImportResult {
 const matched=rows.filter(isLikelyPayrollDeposit);
 let account=db.accounts.find(a=>a.accountType==="checking"&&/usaa/i.test([a.institution,a.name].join(" ")));
 const next=structuredClone(db);
 if(!account){
  account={id:"account-usaa-checking-imported",entityType:"financial_account",createdAt:now,updatedAt:now,name:"USAA Checking (imported)",institution:"USAA",accountType:"checking",currency:"USD"};
  next.accounts.push(account);
 } else {account=next.accounts.find(a=>a.id===account!.id)!;if(currentBalanceMinor!=null&&Number.isFinite(currentBalanceMinor)){account.openingBalanceMinor=currentBalanceMinor;account.updatedAt=now;}}
 const known=new Set(next.transactions.map(t=>t.externalReference).filter((x):x is string=>Boolean(x)));
 let imported=0,duplicates=0;\n const newTransactions:FinancialTransaction[]=[];
 for(const row of matched){
  const reference=String(row.transaction_id??row.transactionId??row.id??"");
  const date=asDate(row.posted_datetime??row.date??row.transactionDate);
  const raw=row.amountMinor!=null?asAmount(row.amountMinor):asAmount(row.amount);
  if(!date||!Number.isFinite(raw)||raw===0){continue;}
  const externalReference=reference? "connected-finance:"+reference : "connected-finance:"+date+":"+Math.round(Math.abs(raw)*100)+":"+String(row.name??row.merchant_name??"payroll");
  if(known.has(externalReference)){duplicates++;continue;}
  // LifeOS stores amounts as positive magnitudes and represents direction in transactionType.
  const amountMinor=row.amountMinor!=null?Math.round(Math.abs(raw)):Math.round(Math.abs(raw)*100);
  const transaction:FinancialTransaction={id:"txn-"+externalReference.replace(/[^a-zA-Z0-9_-]/g,"-"),entityType:"financial_transaction",createdAt:now,updatedAt:now,transactionType:raw<0?"income":"expense",transactionDate:date,amountMinor,currency:row.currency??row.iso_currency_code??"USD",accountId:account.id,merchant:row.merchant_name??row.merchant??row.name,description:row.name??row.description??"Payroll deposit",externalReference,metadata:{source:"connected_finance_import",payrollDeposit:true,cashBalanceExcluded:true}};\n  next.transactions.push(transaction);newTransactions.push(transaction);
  known.add(externalReference);imported++;
 }
 return {transactions:newTransactions,account,imported,duplicates,ignored:rows.length-matched.length,accountId:account.id};
}
export function payrollForecastFlows(transactions:FinancialTransaction[],startDate:string,horizonDays=30):NonNullable<CashForecastOptions["externalFlows"]> {
 const deposits=transactions.filter(t=>t.transactionType==="income"&&/\b(payroll|payroll\s*deposit|kia georgia inc)\b/i.test([t.description,t.merchant].filter(Boolean).join(" "))&&t.amountMinor>0).sort((a,b)=>a.transactionDate.localeCompare(b.transactionDate));
 if(deposits.length<3)return [];
 // Use only the dominant cadence; isolated supplemental deposits should not move the schedule.
 const gaps:number[]=[];
 for(let i=1;i<deposits.length;i++){const gap=(Date.parse(deposits[i].transactionDate+"T00:00:00Z")-Date.parse(deposits[i-1].transactionDate+"T00:00:00Z"))/86400000;if(gap>=12&&gap<=16)gaps.push(gap);}
 if(gaps.length<2)return [];
 const cadence=Math.round(gaps.reduce((s,n)=>s+n,0)/gaps.length);
 const regular=deposits.filter((t,i)=>i===0||((Date.parse(t.transactionDate+"T00:00:00Z")-Date.parse(deposits[i-1].transactionDate+"T00:00:00Z"))/86400000>=12&&(Date.parse(t.transactionDate+"T00:00:00Z")-Date.parse(deposits[i-1].transactionDate+"T00:00:00Z"))/86400000<=16));
 const amounts=regular.map(t=>t.amountMinor).sort((a,b)=>a-b);
 const median=amounts[Math.floor((amounts.length-1)/2)];
 if(!median||!Number.isFinite(median))return [];
 const last=regular[regular.length-1];
 let next=Date.parse(last.transactionDate+"T00:00:00Z")+cadence*86400000;
 const end=Date.parse(startDate+"T00:00:00Z")+Math.max(1,horizonDays)*86400000;
 while(next<Date.parse(startDate+"T00:00:00Z"))next+=cadence*86400000;
 const flows:NonNullable<CashForecastOptions["externalFlows"]>=[];
 for(let guard=0;next<end&&guard<30;guard++,next+=cadence*86400000){
  const date=new Date(next).toISOString().slice(0,10);
  if(deposits.some(t=>t.transactionDate===date))continue;
  flows.push({date,amountMinor:median,direction:"inflow",sourceId:"payroll-estimate:"+date,title:"Expected Kia Georgia payroll (historical median)",priority:1});
 }
 return flows;
}
