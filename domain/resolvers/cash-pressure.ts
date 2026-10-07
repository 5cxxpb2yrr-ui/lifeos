import type {AttentionItem,LifeOSDatabase} from "@/domain/contracts/database";
import {resolveCashForecast,type CashForecastView} from "./cash-forecast";

export type CashPressureState="healthy"|"watch"|"constrained"|"negative"|"unresolved";

export interface CashPressureView{
 state:CashPressureState;
 priority:number;
 reason:string;
 lowestBalanceMinor:number;
 lowestBalanceDate:string;
 firstNegativeDate?:string;
 forecast:CashForecastView;
 attention:AttentionItem[];
}

function hasCashSource(db:LifeOSDatabase):boolean{
 return db.accounts.some(account=>
  account.accountType==="checking"||
  account.accountType==="savings"||
  account.accountType==="cash"
 );
}

export function resolveCashPressure(
 db:LifeOSDatabase,
 options:{startDate?:string;horizonDays?:number;startingCashMinor?:number}={}
):CashPressureView{
 const forecast=resolveCashForecast(db,options);
 const explicitStartingCash=options.startingCashMinor!==undefined;
 const cashSourceAvailable=explicitStartingCash||hasCashSource(db);

 if(!cashSourceAvailable){
  return{
   state:"unresolved",
   priority:1,
   reason:"No cash account is available to establish a starting cash position.",
   lowestBalanceMinor:forecast.lowestBalanceMinor,
   lowestBalanceDate:forecast.lowestBalanceDate,
   firstNegativeDate:forecast.firstNegativeDate,
   forecast,
   attention:[{
    id:"cash-pressure:unresolved",
    sourceType:"cash_pressure",
    sourceId:"cash-forecast",
    title:"Cash forecast needs a starting cash source",
    attention:"unresolved",
    priority:1,
    context:{reason:"No checking, savings, or cash account is available."}
   }]
  };
 }

 const starting=Math.max(0,forecast.startingBalanceMinor);
 const lowest=forecast.lowestBalanceMinor;
 let state:CashPressureState;
 let priority:number;
 let reason:string;

 if(lowest<0){
  state="negative";
  priority=5;
  reason=`Projected cash becomes negative on ${forecast.firstNegativeDate??forecast.lowestBalanceDate}.`;
 }else if(starting===0){
  state=lowest===0?"constrained":"negative";
  priority=state==="negative"?5:4;
  reason=state==="negative"
   ?"Projected cash falls below zero during the forecast."
   :"Starting cash is zero and the forecast has no positive cash cushion.";
 }else{
  const cushionRatio=lowest/starting;
  if(cushionRatio<0.10){
   state="constrained";
   priority=4;
   reason="Projected cash cushion falls below 10% of starting cash.";
  }else if(cushionRatio<0.20){
   state="watch";
   priority=3;
   reason="Projected cash cushion falls below 20% of starting cash.";
  }else{
   state="healthy";
   priority=0;
   reason="Projected cash remains above the 20% starting-cash cushion.";
  }
 }

 const attention:AttentionItem[]=[];
 if(state!=="healthy"){
  const attentionState=state==="unresolved"?"unresolved":"at_risk";
  attention.push({
   id:`cash-pressure:${state}:${forecast.lowestBalanceDate}`,
   sourceType:"cash_pressure",
   sourceId:"cash-forecast",
   title:state==="negative"?"Projected cash shortfall":state==="constrained"?"Cash cushion is constrained":"Cash position needs watching",
   attention:attentionState,
   priority,
   dueAt:forecast.firstNegativeDate??forecast.lowestBalanceDate,
   context:{
    state,
    reason,
    lowestBalanceMinor:forecast.lowestBalanceMinor,
    lowestBalanceDate:forecast.lowestBalanceDate,
    firstNegativeDate:forecast.firstNegativeDate
   }
  });
 }

 return{
  state,
  priority,
  reason,
  lowestBalanceMinor:forecast.lowestBalanceMinor,
  lowestBalanceDate:forecast.lowestBalanceDate,
  firstNegativeDate:forecast.firstNegativeDate,
  forecast,
  attention
 };
}
