import type {Event,FinancialTransaction,LifeOSDatabase,LoanPayment,Relationship} from "@/domain/contracts/database";
import {appendAudit} from "@/domain/services/audit";

const now=()=>new Date().toISOString();
const id=(p:string)=>p+"-"+crypto.randomUUID();

function relationship(from:BaseEntity,to:BaseEntity,relationshipType:Relationship["relationshipType"]):Relationship{
 const t=now();
 return {id:id("rel"),entityType:"relationship",createdAt:t,updatedAt:t,fromId:from.id,fromType:from.entityType,toId:to.id,toType:to.entityType,relationshipType};
}
function addRelationships(db:LifeOSDatabase,rows:Relationship[]):LifeOSDatabase{
 const relationships=[...db.relationships];
 for(const row of rows){
  if(!relationships.some(x=>x.fromId===row.fromId&&x.toId===row.toId&&x.relationshipType===row.relationshipType)) relationships.push(row);
 }
 return {...db,relationships};
}

export function createTransaction(db:LifeOSDatabase,input:Pick<FinancialTransaction,"transactionType"|"transactionDate"|"amountMinor"|"currency"|"accountId">&Partial<FinancialTransaction>):LifeOSDatabase{
 const t=now();
 const tx:FinancialTransaction={...input,id:id("txn"),entityType:"financial_transaction",createdAt:t,updatedAt:t,transactionType:input.transactionType,transactionDate:input.transactionDate,amountMinor:input.amountMinor,currency:input.currency,accountId:input.accountId};
 return appendAudit({...db,transactions:[...db.transactions,tx]},tx,"create","financial-operations");
}

export function createLoanPayment(db:LifeOSDatabase,input:Pick<LoanPayment,"loanId"|"scheduledDate"|"scheduledAmountMinor">&Partial<LoanPayment>):LifeOSDatabase{
 const t=now();
 const payment:LoanPayment={...input,id:id("loanpay"),entityType:"loan_payment",createdAt:t,updatedAt:t,loanId:input.loanId,scheduledDate:input.scheduledDate,scheduledAmountMinor:input.scheduledAmountMinor,status:input.status??"scheduled"};
 return appendAudit({...db,loanPayments:[...db.loanPayments,payment]},payment,"create","financial-operations");
}

export function recordLoanPayment(db:LifeOSDatabase,paymentId:string,paidAmountMinor:number,paidDate:string):LifeOSDatabase{
 const t=now();
 const source=db.loanPayments.find(p=>p.id===paymentId);
 if(!source||paidAmountMinor<=0)return db;
 const loan=db.loans.find(l=>l.id===source.loanId);
 if(!loan)return db;

 const status:LoanPayment["status"]=paidAmountMinor>=source.scheduledAmountMinor?"paid":"partial";
 let payment:LoanPayment={...source,paidAmountMinor,paidDate,updatedAt:t,status};

 const accountId=loan.linkedAccountId;
 let transactions=db.transactions;
 let events=db.events;
 let relationships=db.relationships;
 let transaction:FinancialTransaction|undefined;
 let event:Event|undefined;
 const existingTransaction=source.transactionId?db.transactions.find(x=>x.id===source.transactionId):undefined;
 const existingEvent=existingTransaction?.eventId?db.events.find(x=>x.id===existingTransaction.eventId):undefined;

 if(existingTransaction){
  transaction={...existingTransaction,updatedAt:t,amountMinor:paidAmountMinor,transactionDate:paidDate,metadata:{...existingTransaction.metadata,loanPaymentId:payment.id}};
  event=existingEvent?{...existingEvent,updatedAt:t,occurredAt:paidDate,metadata:{...existingEvent.metadata,loanId:loan.id,loanPaymentId:payment.id,paidAmountMinor}}:undefined;
 }

 if(!transaction && accountId){
  const account=db.accounts.find(a=>a.id===accountId);
  if(account){
   transaction={
    id:id("txn"),entityType:"financial_transaction",createdAt:t,updatedAt:t,
    transactionType:"payment",transactionDate:paidDate,amountMinor:paidAmountMinor,currency:loan.currency,
    accountId,description:`Payment for ${loan.name}`,loanId:loan.id,metadata:{loanPaymentId:payment.id}
   };
   transaction.eventId=undefined;
   transactions=[...transactions,transaction];
  }
 }

 if(!event) event={
  id:id("evt"),entityType:"event",createdAt:t,updatedAt:t,eventType:"payment",
  title:`Payment: ${loan.name}`,status:"completed",occurredAt:paidDate,
  financialTransactionIds:transaction?[transaction.id]:[],
  metadata:{loanId:loan.id,loanPaymentId:payment.id,paidAmountMinor}
 };

 if(transaction && !transaction.eventId) transaction={...transaction,eventId:event!.id};
 if(transaction) transactions=transactions.some(x=>x.id===transaction!.id)?transactions.map(x=>x.id===transaction!.id?transaction!:x):[...transactions,transaction];

 payment=transaction?{...payment,transactionId:transaction.id}:payment;
 events=events.some(x=>x.id===event!.id)?events.map(x=>x.id===event!.id?event!:x):[...events,event];
 const links=[
  relationship(payment,loan,"payment_for"),
  relationship(event,loan,"payment_for"),
  ...(transaction?[relationship(transaction,loan,"payment_for"),relationship(event,transaction,"linked_to")]:[])
 ];
 const linked=addRelationships({...db,relationships},links);
 relationships=linked.relationships;

 const next:LifeOSDatabase={...db,loanPayments:db.loanPayments.map(p=>p.id===paymentId?payment:p),transactions,events,relationships,metadata:{...db.metadata,updatedAt:t}};
 let result=appendAudit(next,payment,"update","financial-operations",source);
 if(transaction) result=appendAudit(result,transaction,existingTransaction? "update":"create","financial-operations",existingTransaction);
 result=appendAudit(result,event,existingEvent?"update":"create","financial-operations",existingEvent);
 return result;
}
