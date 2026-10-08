import type {LifeOSDatabase,RecurringRule} from "@/domain/contracts/database";
import {resolveFinancialHealth} from "./financial-health";

export interface CashForecastEntry{
 date:string;
 amountMinor:number;
 direction:"inflow"|"outflow";
 sourceType:"loan_payment"|"recurring_rule"|"event"|"external";
 sourceId:string;
 title:string;
}

export interface CashForecastPoint{
 date:string;
 openingBalanceMinor:number;
 inflowMinor:number;
 outflowMinor:number;
 closingBalanceMinor:number;
 entries:CashForecastEntry[];
}

export interface CashForecastPayday{date:string;amountMinor:number;sourceType:"recurring_rule"|"event";sourceId:string;title:string;}

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

export interface CashForecastOptions{
 startDate?:string;
 horizonDays?:number;
 startingCashMinor?:number;
 externalFlows?:Array<{
  date:string;
  amountMinor:number;
  direction:"inflow"|"outflow";
  sourceId?:string;
  title?:string;
 }>;
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
 const scheduledEntries=new Map<string,CashForecastEntry[]>();
 for(const payment of db.loanPayments){
  if(payment.status!=="scheduled"&&payment.status!=="partial")continue;
  const date=payment.scheduledDate;
  if(date<day(start)||date>day(end))continue;
  const remaining=Math.max(0,payment.scheduledAmountMinor-(payment.paidAmountMinor??0));
  if(!remaining)continue;
  scheduled.set(date,(scheduled.get(date)??0)+remaining);
  const loan=db.loans.find(x=>x.id===payment.loanId);
  const entry:CashForecastEntry={date,amountMinor:remaining,direction:"outflow",sourceType:"loan_payment",sourceId:payment.id,title:loan?.name??`Loan payment ${payment.loanId}`};
  scheduledEntries.set(date,[...(scheduledEntries.get(date)??[]),entry]);
 }
 const recurring=new Map<string,number>();
 const recurringEntries=new Map<string,CashForecastEntry[]>();
 const paydays:CashForecastPayday[]=[];
 for(const rule of db.recurringRules.filter(x=>x.enabled)){
  for(const [date,amount] of recurringOccurrences(rule,start,end)){
   recurring.set(date,(recurring.get(date)??0)+amount);
   const entry:CashForecastEntry={date,amountMinor:Math.abs(amount),direction:amount>=0?"inflow":"outflow",sourceType:"recurring_rule",sourceId:rule.id,title:rule.name};
   recurringEntries.set(date,[...(recurringEntries.get(date)??[]),entry]);
   if(rule.eventType==="income"&&amount>0){paydays.push({date,amountMinor:amount,sourceType:"recurring_rule",sourceId:rule.id,title:rule.name});}
  }
 }
 const eventFlows=new Map<string,number>();
 const eventEntries=new Map<string,CashForecastEntry[]>();
 for(const event of db.events){
  if(event.status==="completed"||event.status==="cancelled"||event.status==="skipped")continue;
  const date=event.dueAt??event.startAt;
  const rawAmount=Number(event.metadata?.amountMinor??0);
  if(!date||!Number.isFinite(rawAmount)||rawAmount===0)continue;
  const dateKey=day(new Date(date));
  if(dateKey<day(start)||dateKey>day(end))continue;
  const signed=event.eventType==="income"?Math.abs(rawAmount):-Math.abs(rawAmount);
  eventFlows.set(dateKey,(eventFlows.get(dateKey)??0)+signed);
  const entry:CashForecastEntry={date:dateKey,amountMinor:Math.abs(signed),direction:signed>=0?"inflow":"outflow",sourceType:"event",sourceId:event.id,title:event.title};
  eventEntries.set(dateKey,[...(eventEntries.get(dateKey)??[]),entry]);
  if(event.eventType==="income"&&signed>0){paydays.push({date:dateKey,amountMinor:signed,sourceType:"event",sourceId:event.id,title:event.title});}
 }
 const externalFlows=new Map<string,CashForecastEntry[]>();
 for(const flow of options.externalFlows??[]){
  if(flow.date<day(start)||flow.date>day(end)||!Number.isFinite(flow.amountMinor)||flow.amountMinor<=0)continue;
  const entry:CashForecastEntry={
   date:flow.date,amountMinor:Math.abs(flow.amountMinor),direction:flow.direction,sourceType:"external",
   sourceId:flow.sourceId??`external:${flow.date}:${flow.title??"flow"}`,title:flow.title??"External financial flow"
  };
  externalFlows.set(flow.date,[...(externalFlows.get(flow.date)??[]),entry]);
 }

 const points:CashForecastPoint[]=[];
 let lowest=balance;
 let lowestDate=day(start);
 let firstNegativeDate:string|undefined;
 let totalInflows=0,totalOutflows=0;
 for(let i=0;i<horizon;i++){
  const dateKey=day(addDays(start,i));
  const opening=balance;
  const entries=[
   ...(scheduledEntries.get(dateKey)??[]),
   ...(recurringEntries.get(dateKey)??[]),
   ...(eventEntries.get(dateKey)??[]),
   ...(externalFlows.get(dateKey)??[])
  ];
  const externalInflow=entries.filter(e=>e.direction==="inflow"&&e.sourceType==="external").reduce((s,e)=>s+e.amountMinor,0);
  const externalOutflow=entries.filter(e=>e.direction==="outflow"&&e.sourceType==="external").reduce((s,e)=>s+e.amountMinor,0);
  const inflow=Math.max(0,recurring.get(dateKey)??0)+Math.max(0,eventFlows.get(dateKey)??0)+externalInflow;
  const recurringOutflow=Math.max(0,-(recurring.get(dateKey)??0));
  const eventOutflow=Math.max(0,-(eventFlows.get(dateKey)??0));
  const outflow=(scheduled.get(dateKey)??0)+recurringOutflow+eventOutflow+externalOutflow;
  balance=opening+inflow-outflow;
  totalInflows+=inflow; totalOutflows+=outflow;
  if(balance<lowest){lowest=balance;lowestDate=dateKey}
  if(balance<0&&!firstNegativeDate)firstNegativeDate=dateKey;
  points.push({date:dateKey,openingBalanceMinor:opening,inflowMinor:inflow,outflowMinor:outflow,closingBalanceMinor:balance,entries});
 }
 return{
  startDate:day(start),endDate:day(end),startingBalanceMinor:points[0]?.openingBalanceMinor??balance,
  endingBalanceMinor:balance,lowestBalanceMinor:lowest,lowestBalanceDate:lowestDate,firstNegativeDate,
  totalInflowsMinor:totalInflows,totalOutflowsMinor:totalOutflows,
  paydays:paydays.sort((a,b)=>a.date.localeCompare(b.date)),points
 };
}
