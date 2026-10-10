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
  account={id:"account-usaa-checking-imported",entityType:"financial_account",createdAt:now,updatedAt:now,name:"USAA Checking (imported)",institution:"USAA",accountType:"checking",currency:"USD",...(currentBalanceMinor!=null&&Number.isFinite(currentBalanceMinor)?{openingBalanceMinor:currentBalanceMinor}:{})};
  next.accounts.push(account);
 } else {account=next.accounts.find(a=>a.id===account!.id)!;if(currentBalanceMinor!=null&&Number.isFinite(currentBalanceMinor)){account.openingBalanceMinor=currentBalanceMinor;account.updatedAt=now;}}
 const known=new Set(next.transactions.map(t=>t.externalReference).filter((x):x is string=>Boolean(x)));
 let imported=0,duplicates=0,invalid=0;
 const newTransactions:FinancialTransaction[]=[];
 for(const row of matched){
  const reference=String(row.transaction_id??row.transactionId??row.id??"");
  const date=asDate(row.posted_datetime??row.date??row.transactionDate);
  const raw=row.amountMinor!=null?asAmount(row.amountMinor):asAmount(row.amount);
  if(!date||!Number.isFinite(raw)||raw===0){invalid++;continue;}
  const externalReference=reference? "connected-finance:"+reference : "connected-finance:"+date+":"+Math.round(Math.abs(raw)*100)+":"+String(row.name??row.merchant_name??"payroll");
  if(known.has(externalReference)){duplicates++;continue;}
  // LifeOS stores amounts as positive magnitudes and represents direction in transactionType.
  const amountMinor=row.amountMinor!=null?Math.round(Math.abs(raw)):Math.round(Math.abs(raw)*100);
  const transaction:FinancialTransaction={id:"txn-"+externalReference.replace(/[^a-zA-Z0-9_-]/g,"-"),entityType:"financial_transaction",createdAt:now,updatedAt:now,transactionType:raw<0?"income":"expense",transactionDate:date,amountMinor,currency:row.currency??row.iso_currency_code??"USD",accountId:account.id,merchant:row.merchant_name??row.merchant??row.name,description:row.name??row.description??"Payroll deposit",externalReference,metadata:{source:"connected_finance_import",payrollDeposit:true,cashBalanceExcluded:true}};
  next.transactions.push(transaction);newTransactions.push(transaction);
  known.add(externalReference);imported++;
 }
 return {transactions:newTransactions,account,imported,duplicates,ignored:rows.length-matched.length+invalid,accountId:account.id};
}
export function payrollForecastFlows(transactions:FinancialTransaction[],startDate:string,horizonDays=30):NonNullable<CashForecastOptions["externalFlows"]> {
 const deposits=transactions.filter(t=>t.transactionType==="income"&&/\b(payroll|payroll\s*deposit|kia georgia inc)\b/i.test([t.description,t.merchant].filter(Boolean).join(" "))&&t.amountMinor>0).sort((a,b)=>a.transactionDate.localeCompare(b.transactionDate));
 if(deposits.length<3)return [];
 // Infer cadence from the most common 12–16 day gaps, then anchor to the
 // latest deposit that belongs to that cadence. Supplemental deposits should
 // neither reset the schedule nor prevent a later regular deposit from matching.
 const gapCounts=new Map<number,number>();
 for(let i=0;i<deposits.length;i++){
  for(let j=i+1;j<deposits.length;j++){
   const gap=(Date.parse(deposits[j].transactionDate+"T00:00:00Z")-Date.parse(deposits[i].transactionDate+"T00:00:00Z"))/86400000;
   if(gap>16)break;
   if(gap>=12&&gap<=16)gapCounts.set(Math.round(gap),(gapCounts.get(Math.round(gap))??0)+1);
  }
 }
 if(!gapCounts.size)return [];
 const cadence=[...gapCounts.entries()].sort((a,b)=>b[1]-a[1]||a[0]-b[0])[0][0];
 const regular:FinancialTransaction[]=[];
 for(const deposit of deposits){
  if(!regular.length){regular.push(deposit);continue;}
  const last=regular[regular.length-1];
  const gap=(Date.parse(deposit.transactionDate+"T00:00:00Z")-Date.parse(last.transactionDate+"T00:00:00Z"))/86400000;
  if(gap>=cadence-2&&gap<=cadence+2)regular.push(deposit);
 }
 if(regular.length<3)return [];
 const amounts=regular.map(t=>t.amountMinor).sort((a,b)=>a-b);
 const median=amounts.length%2?amounts[Math.floor(amounts.length/2)]:Math.round((amounts[amounts.length/2-1]+amounts[amounts.length/2])/2);
 if(!median||!Number.isFinite(median))return [];
 const last=regular[regular.length-1];
 let next=Date.parse(last.transactionDate+"T00:00:00Z")+cadence*86400000;
 const start=Date.parse(startDate+"T00:00:00Z");
 const end=start+Math.max(1,horizonDays)*86400000;
 while(next<start)next+=cadence*86400000;
 const flows:NonNullable<CashForecastOptions["externalFlows"]>=[];
 for(let guard=0;next<end&&guard<30;guard++,next+=cadence*86400000){
  const date=new Date(next).toISOString().slice(0,10);
  if(deposits.some(t=>t.transactionDate===date))continue;
  flows.push({date,amountMinor:median,direction:"inflow",sourceId:"payroll-estimate:"+date,title:"Expected Kia Georgia payroll (historical median)",priority:1});
 }
 return flows;
}
