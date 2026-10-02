import type {FinancialTransaction,LifeOSDatabase,LoanPayment} from "@/domain/contracts/database";

const now=()=>new Date().toISOString();
const id=(p:string)=>p+"-"+crypto.randomUUID();

function audit(db:LifeOSDatabase,target:Record<string,unknown>,action:"create"|"update"){const t=now();return {...db,auditEntries:[...db.auditEntries,{id:id("audit"),entityType:"audit",createdAt:t,updatedAt:t,action,targetId:String(target.id),targetType:String(target.entityType),timestamp:t,after:target,source:"financial-operations"}],metadata:{...db.metadata,updatedAt:t}}}

export function createTransaction(db:LifeOSDatabase,input:Pick<FinancialTransaction,"transactionType"|"transactionDate"|"amountMinor"|"currency"|"accountId">&Partial<FinancialTransaction>):LifeOSDatabase{
 const t=now(); const tx:FinancialTransaction={...input,id:id("txn"),entityType:"financial_transaction",createdAt:t,updatedAt:t,transactionType:input.transactionType,transactionDate:input.transactionDate,amountMinor:input.amountMinor,currency:input.currency,accountId:input.accountId};
 return audit({...db,transactions:[...db.transactions,tx]},tx,"create");
}

export function createLoanPayment(db:LifeOSDatabase,input:Pick<LoanPayment,"loanId"|"scheduledDate"|"scheduledAmountMinor">&Partial<LoanPayment>):LifeOSDatabase{
 const t=now(); const payment:LoanPayment={...input,id:id("loanpay"),entityType:"loan_payment",createdAt:t,updatedAt:t,loanId:input.loanId,scheduledDate:input.scheduledDate,scheduledAmountMinor:input.scheduledAmountMinor,status:input.status??"scheduled"};
 return audit({...db,loanPayments:[...db.loanPayments,payment]},payment,"create");
}

export function recordLoanPayment(db:LifeOSDatabase,paymentId:string,paidAmountMinor:number,paidDate:string):LifeOSDatabase{
 const t=now(); let target:LoanPayment|undefined;
 const loanPayments=db.loanPayments.map(p=>{if(p.id!==paymentId)return p; target={...p,paidAmountMinor,paidDate,updatedAt:t,status:paidAmountMinor>=p.scheduledAmountMinor?"paid":"partial"};return target});
 return target?audit({...db,loanPayments},target,"update"):db;
}
