import type {LifeOSDatabase,RecurringRule} from "@/domain/contracts/database";
import {resolveFinancialHealth} from "./financial-health";

export type CashForecastSourceType="income"|"bill"|"loan_payment"|"other_expense";
export interface CashForecastSource{
 id:string;
 type:CashForecastSourceType;
 label:string;
 amountMinor:number;
 sourceType?:string;
}
export interface CashForecastEntry{
 date:string;
 amountMinor:number;
 direction:"inflow"|"outflow";
 sourceType:"loan_payment"|"recurring_rule"|"event"|"external";
 sourceId:string;
 title:string;
 priority?:number;
}
export interface CashForecastPayday{date:string;amountMinor:number;sourceType:"recurring_rule"|"event"|"external";sourceId:string;title:string;}
export interface CashForecastOptions{startDate?:string;horizonDays?:number;startingCashMinor?:number;externalFlows?:Array<{date:string;amountMinor:number;direction:"inflow"|"outflow";sourceId?:string;title?:string;priority?:number}>;}

export interface CashForecastPoint{
 date:string;
 openingBalanceMinor:number;
 incomeMinor:number;
 billMinor:number;
 loanPaymentMinor:number;
 otherExpenseMinor:number;
 inflowMinor:number;
 outflowMinor:number;
 closingBalanceMinor:number;
 sources:CashForecastSource[];
 entries:CashForecastEntry[];
}

export interface CashForecastView{
 startDate:string;
 endDate:string;
 startingBalanceMinor:number;
 endingBalanceMinor:number;
 lowestBalanceMinor:number;
 lowestBalanceDate:string;
 firstNegativeDate?:string;
 totalInflowsMinor:number;
 totalOutflowsMinor:number;
 paydays:CashForecastPayday[];
 points:CashForecastPoint[];
}

function day(date:Date):string{return date.toISOString().slice(0,10)}
function addDays(date:Date,n:number):Date{const next=new Date(date);next.setUTCDate(next.getUTCDate()+n);return next}
function addMonths(date:Date,n:number):Date{const next=new Date(date);next.setUTCMonth(next.getUTCMonth()+n);return next}

function recurringOccurrences(rule:RecurringRule,start:Date,end:Date):Map<string,number>{
 const amount=Number(rule.template.amountMinor??0);
 const direction=String(rule.template.direction??(rule.eventType==="income"?"income":"expense"));
 if(!Number.isFinite(amount)||amount===0)return new Map();
 const signed=direction==="income"||direction==="refund"?Math.abs(amount):-Math.abs(amount);
 const result=new Map<string,number>();
 let cursor=new Date((rule.nextOccurrence??rule.startDate)+"T00:00:00.000Z");
 const endRule=rule.endDate?new Date(rule.endDate+"T23:59:59.999Z"):undefined;
 let guard=0;
 while(cursor<=end&&guard++<5000){
  if(endRule&&cursor>endRule)break;
  if(cursor>=start){
   const key=day(cursor);
   result.set(key,(result.get(key)??0)+signed);
  }
  switch(rule.frequency){
   case "daily":cursor=addDays(cursor,rule.interval??1);break;
   case "weekly":cursor=addDays(cursor,7*(rule.interval??1));break;
   case "biweekly":cursor=addDays(cursor,14*(rule.interval??1));break;
   case "monthly":cursor=addMonths(cursor,rule.interval??1);break;
   case "quarterly":cursor=addMonths(cursor,3*(rule.interval??1));break;
   case "yearly":cursor=addMonths(cursor,12*(rule.interval??1));break;
   case "custom":{
    const customDays=Number(rule.template.intervalDays??rule.interval??1);
    cursor=addDays(cursor,Math.max(1,customDays));
    break;
   }
  }
 }
 return result;
}

export function resolveCashForecast(
 db:LifeOSDatabase,
 options:CashForecastOptions={}
):CashForecastView{
 const start=options.startDate?new Date(options.startDate+"T00:00:00.000Z"):new Date();
 start.setUTCHours(0,0,0,0);
 const horizon=Math.max(1,Math.min(365,Math.floor(options.horizonDays??30)));
 const end=addDays(start,horizon-1);
 let balance=options.startingCashMinor??resolveFinancialHealth(db).cashMinor;
 const scheduled=new Map<string,number>();
 const scheduledSources=new Map<string,CashForecastSource[]>();
 for(const payment of db.loanPayments){
  if(payment.status!=="scheduled"&&payment.status!=="partial")continue;
  const date=payment.scheduledDate;
  if(date<day(start)||date>day(end))continue;
  const remaining=Math.max(0,payment.scheduledAmountMinor-(payment.paidAmountMinor??0));
  scheduled.set(date,(scheduled.get(date)??0)+remaining);
  const loanName=db.loans.find(x=>x.id===payment.loanId)?.name??"Loan payment";
  const list=scheduledSources.get(date)??[];
  list.push({id:payment.id,type:"loan_payment",label:loanName,amountMinor:remaining,sourceType:"loan_payment"});
  scheduledSources.set(date,list);
 }
 const recurring=new Map<string,number>();
 const recurringSources=new Map<string,CashForecastSource[]>();
 const paydays:CashForecastPayday[]=[];
 for(const rule of db.recurringRules.filter(x=>x.enabled)){
  for(const [date,amount] of recurringOccurrences(rule,start,end)){
   recurring.set(date,(recurring.get(date)??0)+amount);
   const list=recurringSources.get(date)??[];
   list.push({id:rule.id,type:amount>0?"income":"bill",label:rule.name,amountMinor:Math.abs(amount),sourceType:"recurring_rule"});
   recurringSources.set(date,list);
   if(rule.eventType==="income"&&amount>0)paydays.push({date,amountMinor:amount,sourceType:"recurring_rule",sourceId:rule.id,title:rule.name});
  }
 }
 const eventFlows=new Map<string,number>();
 const eventSources=new Map<string,CashForecastSource[]>();
 for(const event of db.events){
  if(event.status==="completed"||event.status==="cancelled"||event.status==="skipped")continue;
  const date=event.dueAt??event.startAt;
  const rawAmount=Number(event.metadata?.amountMinor??0);
  if(!date||!Number.isFinite(rawAmount)||rawAmount===0)continue;
  const dateKey=day(new Date(date));
  if(dateKey<day(start)||dateKey>day(end))continue;
  const signed=event.eventType==="income"?Math.abs(rawAmount):-Math.abs(rawAmount);
  eventFlows.set(dateKey,(eventFlows.get(dateKey)??0)+signed);
  const list=eventSources.get(dateKey)??[];
  list.push({id:event.id,type:event.eventType==="income"?"income":"other_expense",label:event.title,amountMinor:Math.abs(rawAmount),sourceType:"event"});
  eventSources.set(dateKey,list);
  if(event.eventType==="income"&&signed>0)paydays.push({date:dateKey,amountMinor:signed,sourceType:"event",sourceId:event.id,title:event.title});
 }
 const externalFlows=new Map<string,CashForecastEntry[]>();
 for(const flow of options.externalFlows??[]){
  if(flow.date<day(start)||flow.date>day(end)||!Number.isFinite(flow.amountMinor)||flow.amountMinor<=0)continue;
  const entry:CashForecastEntry={date:flow.date,amountMinor:Math.abs(flow.amountMinor),direction:flow.direction,sourceType:"external",sourceId:flow.sourceId??("external:"+flow.date+":"+(flow.title??"flow")),title:flow.title??"External financial flow",priority:typeof flow.priority==="number"?Math.max(1,Math.min(5,Math.round(flow.priority))):undefined};
  externalFlows.set(flow.date,[...(externalFlows.get(flow.date)??[]),entry]);
  if(flow.direction==="inflow"&&/payroll/i.test(entry.title))paydays.push({date:flow.date,amountMinor:entry.amountMinor,sourceType:"external",sourceId:entry.sourceId,title:entry.title});
 }
 const points:CashForecastPoint[]=[];
 let lowest=balance;
 let lowestDate=day(start);
 let firstNegativeDate:string|undefined;
 let totalInflows=0,totalOutflows=0;
 for(let i=0;i<horizon;i++){
  const dateKey=day(addDays(start,i));
  const opening=balance;
  const recurringValue=recurring.get(dateKey)??0;
  const eventValue=eventFlows.get(dateKey)??0;
  const incomeMinor=Math.max(0,recurringValue)+Math.max(0,eventValue);
  const billMinor=(recurringSources.get(dateKey)??[]).filter(x=>x.type==="bill").reduce((sum,x)=>sum+x.amountMinor,0);
  const loanPaymentMinor=scheduled.get(dateKey)??0;
  const otherExpenseMinor=(eventSources.get(dateKey)??[]).filter(x=>x.type==="other_expense").reduce((sum,x)=>sum+x.amountMinor,0);
  const externalEntries=externalFlows.get(dateKey)??[];
  const externalInflow=externalEntries.filter(e=>e.direction==="inflow").reduce((sum,e)=>sum+e.amountMinor,0);
  const externalOutflow=externalEntries.filter(e=>e.direction==="outflow").reduce((sum,e)=>sum+e.amountMinor,0);
  const inflow=incomeMinor+externalInflow;
  const outflow=loanPaymentMinor+billMinor+otherExpenseMinor+externalOutflow;
  const sources=[...(recurringSources.get(dateKey)??[]),...(scheduledSources.get(dateKey)??[]),...(eventSources.get(dateKey)??[])].sort((a,b)=>b.amountMinor-a.amountMinor);
  const entries:CashForecastEntry[]=[
   ...(recurringSources.get(dateKey)??[]).map(s=>({date:dateKey,amountMinor:s.amountMinor,direction:s.type==="income"?"inflow" as const:"outflow" as const,sourceType:"recurring_rule" as const,sourceId:s.id,title:s.label})),
   ...(scheduledSources.get(dateKey)??[]).map(s=>({date:dateKey,amountMinor:s.amountMinor,direction:"outflow" as const,sourceType:"loan_payment" as const,sourceId:s.id,title:s.label})),
   ...(eventSources.get(dateKey)??[]).map(s=>({date:dateKey,amountMinor:s.amountMinor,direction:s.type==="income"?"inflow" as const:"outflow" as const,sourceType:"event" as const,sourceId:s.id,title:s.label})),
   ...externalEntries
  ];
  balance=opening+inflow-outflow;
  totalInflows+=inflow; totalOutflows+=outflow;
  if(balance<lowest){lowest=balance;lowestDate=dateKey}
  if(balance<0&&!firstNegativeDate)firstNegativeDate=dateKey;
  points.push({date:dateKey,openingBalanceMinor:opening,incomeMinor:incomeMinor+externalInflow,billMinor,outflowMinor:outflow,loanPaymentMinor,otherExpenseMinor:otherExpenseMinor+externalOutflow,inflowMinor:inflow,closingBalanceMinor:balance,sources,entries});
 }
 return{
  startDate:day(start),endDate:day(end),startingBalanceMinor:points[0]?.openingBalanceMinor??balance,
  endingBalanceMinor:balance,lowestBalanceMinor:lowest,lowestBalanceDate:lowestDate,firstNegativeDate,
  totalInflowsMinor:totalInflows,totalOutflowsMinor:totalOutflows,
  paydays:paydays.sort((a,b)=>a.date.localeCompare(b.date)),points
 };
}
