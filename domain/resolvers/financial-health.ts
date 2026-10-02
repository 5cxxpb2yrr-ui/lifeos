import type {LifeOSDatabase} from "@/domain/contracts/database";
export interface FinancialHealthView{cashMinor:number;scheduledDebtMinor:number;overduePayments:number;activeLoans:number;transactionCount:number}
export function resolveFinancialHealth(db:LifeOSDatabase):FinancialHealthView{
 const cashMinor=db.accounts.filter(a=>a.accountType==="checking"||a.accountType==="savings"||a.accountType==="cash").reduce((sum,a)=>sum+(a.openingBalanceMinor??0),0);
 const scheduledDebtMinor=db.loanPayments.filter(p=>p.status==="scheduled"||p.status==="partial").reduce((sum,p)=>sum+p.scheduledAmountMinor-(p.paidAmountMinor??0),0);
 const today=new Date().toISOString().slice(0,10);
 const overduePayments=db.loanPayments.filter(p=>(p.status==="scheduled"||p.status==="partial")&&p.scheduledDate<today).length;
 return{cashMinor,scheduledDebtMinor,overduePayments,activeLoans:db.loans.filter(l=>l.status==="active").length,transactionCount:db.transactions.length};
}
