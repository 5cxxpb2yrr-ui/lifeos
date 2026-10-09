"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import type {LifeOSDatabase} from "@/domain/contracts/database";
import {resolveCashForecast} from "@/domain/resolvers/cash-forecast";

function money(minor:number){return (minor/100).toLocaleString(undefined,{style:"currency",currency:"USD"});}
function dateLabel(date:string){return new Date(date+"T12:00:00").toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"});}

export default function CashForecastCalendar({db}:{db:LifeOSDatabase}){
 const [selectedDate,setSelectedDate]=useState<string|null>(null);
 const [baseline,setBaseline]=useState<{date:string;closingBalanceMinor:number}|null>(null);
 const dayRefs=useRef<Record<string,HTMLDivElement|null>>({});
 const forecast=useMemo(()=>resolveCashForecast(db,{horizonDays:30}),[db]);
 useEffect(()=>{
  const handler=(event:Event)=>{
   const detail=(event as CustomEvent).detail as {date?:string};
   if(!detail?.date)return;
   setSelectedDate(detail.date);
   setTimeout(()=>dayRefs.current[detail.date!]?.scrollIntoView({behavior:"smooth",block:"center"}),50);
  };
  const baselineHandler=(event:Event)=>{
   const detail=(event as CustomEvent).detail as {date?:string};
   if(!detail?.date)return;
   const point=resolveCashForecast(db,{horizonDays:30}).points.find(p=>p.date===detail.date);
   if(point)setBaseline({date:detail.date,closingBalanceMinor:point.closingBalanceMinor});
  };
  window.addEventListener("lifeos:cash-forecast-day",handler);
  window.addEventListener("lifeos:cash-forecast-baseline",baselineHandler);
  return()=>{
   window.removeEventListener("lifeos:cash-forecast-day",handler);
   window.removeEventListener("lifeos:cash-forecast-baseline",baselineHandler);
  };
 },[]);
 const selected=forecast.points.find(point=>point.date===selectedDate);
 return <section className="card cash-forecast-calendar">
  <div className="section-title"><div><div className="kicker">Finance / Cash Forecast</div><h2>Daily Cash Calendar</h2></div><span className="badge">{forecast.points.length} days</span></div>
  <div className="row-meta">Opening cash → income → bills → loan payments → other expenses → closing cash. Pressure alerts land on the exact forecast day.</div>
  <div className="cash-calendar-summary">
   <div><span className="kicker">Starting</span><strong>{money(forecast.startingBalanceMinor)}</strong></div>
   <div><span className="kicker">Lowest</span><strong>{money(forecast.lowestBalanceMinor)}</strong><small>{dateLabel(forecast.lowestBalanceDate)}</small></div>
   <div><span className="kicker">Ending</span><strong>{money(forecast.endingBalanceMinor)}</strong></div>
  </div>
  {selected&&<div className="notice"><strong>{dateLabel(selected.date)}</strong> · closing {money(selected.closingBalanceMinor)}{selected.sources.length?" · "+selected.sources[0].label:""}{baseline?.date===selected.date ? <>{" · "}change since edit {money(selected.closingBalanceMinor-baseline.closingBalanceMinor)}</> : null}</div>}
  <div className="cash-calendar-list">
   {forecast.points.map(point=><div key={point.date} ref={el=>{dayRefs.current[point.date]=el}} className={"cash-calendar-day "+(selectedDate===point.date?"selected ":"")+(point.closingBalanceMinor<0?"negative":"")}>
    <button type="button" className="cash-calendar-day-head" onClick={()=>{setSelectedDate(point.date);if(baseline?.date!==point.date)setBaseline(null);}}>
     <div><strong>{dateLabel(point.date)} {forecast.paydays.some(payday=>payday.date===point.date)&&<span className="badge" title={forecast.paydays.filter(payday=>payday.date===point.date).map(payday=>payday.title).join(", ")}>Payday</span>}</strong><span>Opening {money(point.openingBalanceMinor)}</span></div>
     <div><span>Closing</span><strong>{money(point.closingBalanceMinor)}</strong></div>
    </button>
    <div className="cash-calendar-flow-grid">
     <div><span>Income</span><strong>{money(point.incomeMinor)}</strong></div>
     <div><span>Bills</span><strong>{money(point.billMinor)}</strong></div>
     <div><span>Loan Payments</span><strong>{money(point.loanPaymentMinor)}</strong></div>
     <div><span>Other</span><strong>{money(point.otherExpenseMinor)}</strong></div>
    </div>
    {selectedDate===point.date&&point.sources.length>0&&<div className="cash-calendar-obligations">
      <div className="kicker">Underlying obligations</div>
      {point.sources.map(source=><button type="button" className="row entity-row" key={source.type+source.id} onClick={()=>{
       if(source.type==="bill"||source.type==="loan_payment"){window.dispatchEvent(new CustomEvent("lifeos:edit",{detail:{id:source.id,type:source.type==="bill"?"recurring_rule":"loan_payment",forecastDate:point.date,amountMinor:source.amountMinor}}));}else{window.dispatchEvent(new CustomEvent("lifeos:navigate",{detail:{kind:source.type==="income"?"event":"event",id:source.id}}));}
      }}>
       <div className="row-main"><div className="row-title">{source.label}</div><div className="row-meta">{source.type.replaceAll("_"," ")} · {money(source.amountMinor)}</div></div><span className="queue-count">›</span>
      </button>)}
    </div>}
   </div>)}
  </div>
 </section>;
}
