import type {AttentionItem} from "@/domain/contracts/database";
import type {CashForecastView} from "./cash-forecast";

export type CashPressureState="healthy"|"watch"|"constrained"|"negative"|"unresolved";

export interface CashPressureOptions{
 reserveMinor?:number;
 watchBufferMinor?:number;
 sourceId?:string;
 title?:string;
}

export interface CashPressureView{
 state:CashPressureState;
 attention:"none"|"at_risk"|"unresolved";
 priority:number;
 reason:string;
 reserveMinor:number;
 watchThresholdMinor:number;
 lowestBalanceMinor:number;
 lowestBalanceDate:string;
 firstNegativeDate?:string;
 availableThroughDate:string;
 sourceId:string;
 title:string;
}

function classify(balanceMinor:number,reserveMinor:number,watchBufferMinor:number):CashPressureState{
 if(!Number.isFinite(balanceMinor)||!Number.isFinite(reserveMinor)||!Number.isFinite(watchBufferMinor))return "unresolved";
 if(balanceMinor<0)return "negative";
 if(balanceMinor<reserveMinor)return "constrained";
 if(balanceMinor<reserveMinor+watchBufferMinor)return "watch";
 return "healthy";
}

function attentionFor(state:CashPressureState):{attention:"none"|"at_risk"|"unresolved";priority:number}{
 switch(state){
  case "negative":return{attention:"at_risk",priority:5};
  case "constrained":return{attention:"at_risk",priority:4};
  case "watch":return{attention:"at_risk",priority:3};
  case "healthy":return{attention:"none",priority:0};
  default:return{attention:"unresolved",priority:1};
 }
}

export function resolveCashPressure(forecast:CashForecastView,options:CashPressureOptions={}):CashPressureView{
 const reserveMinor=Math.max(0,Math.floor(options.reserveMinor??0));
 const watchBufferMinor=Math.max(0,Math.floor(options.watchBufferMinor??25000));
 const state=classify(forecast.lowestBalanceMinor,reserveMinor,watchBufferMinor);
 const {attention,priority}=attentionFor(state);
 const title=options.title??"Cash forecast";
 const sourceId=options.sourceId??"cash-forecast";
 const reason=
  state==="negative"?"Forecasted cash falls below zero."
  :state==="constrained"?`Forecasted cash falls below the protected reserve of ${reserveMinor} minor units.`
  :state==="watch"?`Forecasted cash enters the watch zone below ${reserveMinor+watchBufferMinor} minor units.`
  :state==="healthy"?"Forecast stays above the configured cash reserve and watch buffer."
  :"Cash pressure cannot be resolved from the available forecast.";
 return{
  state,attention,priority,reason,reserveMinor,watchThresholdMinor:reserveMinor+watchBufferMinor,
  lowestBalanceMinor:forecast.lowestBalanceMinor,lowestBalanceDate:forecast.lowestBalanceDate,
  firstNegativeDate:forecast.firstNegativeDate,availableThroughDate:forecast.endDate,
  sourceId,title
 };
}

export function resolveCashPressureAttention(forecast:CashForecastView,options:CashPressureOptions={}):AttentionItem{
 const pressure=resolveCashPressure(forecast,options);
 const dueAt=pressure.state==="negative"&&pressure.firstNegativeDate
  ? `${pressure.firstNegativeDate}T00:00:00.000Z`
  : pressure.state==="constrained"||pressure.state==="watch"
   ? `${pressure.lowestBalanceDate}T00:00:00.000Z`
   : undefined;
 return{
  id:`cash-pressure:${pressure.sourceId}`,
  sourceType:"cash_pressure",
  sourceId:pressure.sourceId,
  title:pressure.title,
  attention:pressure.attention,
  dueAt,
  priority:pressure.priority,
  context:{
   state:pressure.state,
   reason:pressure.reason,
   reserveMinor:pressure.reserveMinor,
   watchThresholdMinor:pressure.watchThresholdMinor,
   lowestBalanceMinor:pressure.lowestBalanceMinor,
   lowestBalanceDate:pressure.lowestBalanceDate,
   firstNegativeDate:pressure.firstNegativeDate,
   availableThroughDate:pressure.availableThroughDate
  }
 };
}
