"use client";
import {useEffect,useMemo,useState} from "react";
import type {LifeOSDatabase} from "@/domain/contracts/database";
import {resolveCashForecast} from "@/domain/resolvers/cash-forecast";

function money(minor:number){return (minor/100).toLocaleString(undefined,{style:"currency",currency:"USD"});}
function dateLabel(date:string){return new Date(date+"T12:00:00").toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"});}
function monthLabel(date:string){return new Date(date+"T12:00:00").toLocaleDateString(undefined,{month:"long",year:"numeric"});}
function weekday(date:string){return new Date(date+"T12:00:00").getDay();}

export default function CashForecastCalendar({db}:{db:LifeOSDatabase}){
 const [selectedDate,setSelectedDate]=useState<string|null>(null);
 const [baseline,setBaseline]=useState<{date:string;closingBalanceMinor:number}|null>(null);
 const forecast=useMemo(()=>resolveCashForecast(db,{horizonDays:30}),[db]);
 useEffect(()=>{
  const handler=(event:Event)=>{
   const detail=(event as CustomEvent).detail as {date?:string};
   if(detail?.date)setSelectedDate(detail.date);
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
 },[db]);
 const selected=forecast.points.find(point=>point.date===selectedDate);
 const firstOffset=forecast.points.length?weekday(forecast.points[0].date):0;
 const calendarCells:Array<{key:string;point:(typeof forecast.points)[number]|null}>=[...Array.from({length:firstOffset},(_,i)=>({key:"empty-"+i,point:null})),...forecast.points.map(point=>({key:point.date,point}))];
 return <section className="card cash-forecast-calendar">
  <div className="section-title"><div><div className="kicker">Finance / Cash Forecast</div><h2>Daily Cash Calendar</h2></div><span className="badge">{forecast.points.length} days</span></div>
  <div className="row-meta">Tap any day to inspect opening cash, projected activity, closing balance, and the underlying obligations.</div>
  <div className="cash-calendar-summary">
   <div><span className="kicker">Starting</span><strong>{money(forecast.startingBalanceMinor)}</strong></div>
   <div><span className="kicker">Lowest</span><strong>{money(forecast.lowestBalanceMinor)}</strong><small>{dateLabel(forecast.lowestBalanceDate)}</small></div>
   <div><span className="kicker">Ending</span><strong>{money(forecast.endingBalanceMinor)}</strong></div>
  </div>
  <div className="cash-calendar-month">{forecast.points.length?monthLabel(forecast.points[0].date)+" · "+monthLabel(forecast.points[forecast.points.length-1].date):"Forecast"}</div>
  <div className="cash-calendar-grid" role="grid" aria-label="Daily cash forecast calendar">
   {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(day=><div className="cash-calendar-weekday" key={day}>{day}</div>)}
   {calendarCells.map(({key,point})=>point?<button type="button" role="gridcell" aria-label={dateLabel(point.date)+", closing "+money(point.closingBalanceMinor)} key={key} className={"cash-calendar-cell "+(point.closingBalanceMinor<0?"negative":"")+(selectedDate===point.date?" selected":"")} onClick={()=>{setSelectedDate(point.date);if(baseline?.date!==point.date)setBaseline(null);}}>
    <span className="cash-calendar-cell-date">{new Date(point.date+"T12:00:00").getDate()}</span>
    <strong>{money(point.closingBalanceMinor)}</strong>
    <span className="cash-calendar-cell-markers">{forecast.paydays.some(payday=>payday.date===point.date)&&<span className="cash-calendar-payday">Payday</span>}{point.sources.length>0&&<span className="cash-calendar-activity">{point.sources.length} item{point.sources.length===1?"":"s"}</span>}</span>
   </button>:<div className="cash-calendar-cell empty" key={key} aria-hidden="true"/> )}
  </div>
  <div className="cash-calendar-legend"><span><i className="cash-calendar-legend-dot payday"/> Payday</span><span>Tap a date for details</span></div>
  {selected&&<div className="cash-calendar-modal-backdrop" role="presentation" onClick={()=>setSelectedDate(null)}>
   <section className="cash-calendar-modal" role="dialog" aria-modal="true" aria-labelledby="cash-calendar-modal-title" onClick={event=>event.stopPropagation()}>
    <div className="cash-calendar-modal-header"><div><div className="kicker">Daily cash details</div><h3 id="cash-calendar-modal-title">{dateLabel(selected.date)}</h3></div><button type="button" className="cash-calendar-close" aria-label="Close day details" onClick={()=>setSelectedDate(null)}>×</button></div>
    <div className="cash-calendar-balance-row"><span>Opening balance</span><strong>{money(selected.openingBalanceMinor)}</strong></div>
    <div className="cash-calendar-balance-row closing"><span>Projected closing</span><strong>{money(selected.closingBalanceMinor)}</strong></div>
    {baseline?.date===selected.date&&<div className="row-meta">Change since edit: {money(selected.closingBalanceMinor-baseline.closingBalanceMinor)}</div>}
    <div className="cash-calendar-flow-grid">
     <div><span>Income</span><strong>{money(selected.incomeMinor)}</strong></div>
     <div><span>Bills</span><strong>{money(selected.billMinor)}</strong></div>
     <div><span>Loan payments</span><strong>{money(selected.loanPaymentMinor)}</strong></div>
     <div><span>Other</span><strong>{money(selected.otherExpenseMinor)}</strong></div>
    </div>
    {forecast.paydays.filter(payday=>payday.date===selected.date).map(payday=><div className="cash-calendar-payday-detail" key={payday.sourceId}>Payday · {payday.title} · {money(payday.amountMinor)}</div>)}
    <div className="cash-calendar-obligations"><div className="kicker">Underlying obligations</div>
     {selected.sources.length===0?<p className="row-meta">No scheduled income or expenses on this date.</p>:selected.sources.map(source=><button type="button" className="row entity-row" key={source.type+source.id} onClick={()=>{
       if(source.type==="bill"||source.type==="loan_payment"){window.dispatchEvent(new CustomEvent("lifeos:edit",{detail:{id:source.id,type:source.type==="bill"?"recurring_rule":"loan_payment",forecastDate:selected.date,amountMinor:source.amountMinor}}));}else{window.dispatchEvent(new CustomEvent("lifeos:navigate",{detail:{kind:"event",id:source.id}}));}
      }}>
       <div className="row-main"><div className="row-title">{source.label}</div><div className="row-meta">{source.type.replaceAll("_"," ")} · {money(source.amountMinor)}</div></div><span className="queue-count">›</span>
      </button>)}
    </div>
   </section>
  </div>}
 </section>;
}
