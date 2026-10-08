"use client";
import {useMemo,useState} from "react";
import type {LifeOSDatabase} from "@/domain/contracts/database";
import {resolveCashForecast,type CashForecastEntry,type CashForecastPoint,type CashForecastView} from "@/domain/resolvers/cash-forecast";
import {resolveCashPressure,type CashPressureView} from "@/domain/resolvers/cash-pressure";
import {resolveFinancialHealth} from "@/domain/resolvers/financial-health";
import CashForecastControls,{type ForecastScenarioFlow} from "@/components/mission-control/CashForecastControls";

type NavigateHandlers={
 onEvent:(id:string)=>void;
 onGraph:(id:string,type?:string)=>void;
};

export default function FinanceForecast({db,onEvent,onGraph}:{db:LifeOSDatabase}&NavigateHandlers){
 const [selectedDate,setSelectedDate]=useState<string|null>(null);
 const [startingCashMinor,setStartingCashMinor]=useState<number|undefined>(undefined);
 const [scenarioFlows,setScenarioFlows]=useState<ForecastScenarioFlow[]>([]);
 const currentCashMinor=useMemo(()=>resolveFinancialHealth(db).cashMinor,[db]);
 const forecast=useMemo(()=>resolveCashForecast(db,{startingCashMinor,externalFlows:scenarioFlows}),[db,startingCashMinor,scenarioFlows]);
 const pressure=useMemo(()=>resolveCashPressure(forecast),[forecast]);
 const obligations=useMemo(()=>{
  const seen=new Set<string>();
  return forecast.points.flatMap(point=>point.entries
   .filter(entry=>entry.direction==="outflow"&&entry.sourceType!=="external")
   .map(entry=>{
    const id=entry.sourceType+":"+entry.sourceId+":"+entry.date;
    if(seen.has(id))return null;
    seen.add(id);
    return {...entry,id};
   })
   .filter((entry):entry is NonNullable<typeof entry>=>Boolean(entry)));
 },[forecast]);

 function applyScenario(entry:CashForecastEntry,action:"pay"|"delay"|"keep",delayDays=3){
  if(entry.sourceType==="external")return;
  const same=(flow:ForecastScenarioFlow)=>flow.sourceType===entry.sourceType&&flow.sourceId===entry.sourceId;
  const retained=scenarioFlows.filter(flow=>!same(flow));
  if(action==="keep"||action==="pay"){
   setScenarioFlows(retained);
   return;
  }
  const shiftedDate=new Date(entry.date+"T00:00:00.000Z");
  shiftedDate.setUTCDate(shiftedDate.getUTCDate()+delayDays);
  const originalOffset:ForecastScenarioFlow={
   id:"scenario-offset-"+entry.sourceType+"-"+entry.sourceId,
   date:entry.date,
   amountMinor:entry.amountMinor,
   direction:"inflow",
   title:"Scenario offset · "+entry.title,
   sourceType:entry.sourceType,
   sourceId:entry.sourceId,
   priority:entry.priority,
   delayDays
  };
  const delayed:ForecastScenarioFlow={
   id:"scenario-delay-"+entry.sourceType+"-"+entry.sourceId,
   date:shiftedDate.toISOString().slice(0,10),
   amountMinor:entry.amountMinor,
   direction:"outflow",
   title:"Scenario delayed · "+entry.title,
   sourceType:entry.sourceType,
   sourceId:entry.sourceId,
   priority:entry.priority,
   delayDays
  };
  setScenarioFlows([...retained,originalOffset,delayed]);
 }

 return <section className="finance-forecast-stack">
  <div className="card">
   <div className="section-title">
    <div><div className="kicker">Finance / Forecasting</div><h2>Cash Forecast</h2></div>
    <span className={"badge "+(pressure.state==="negative"?"forecast-badge-danger":pressure.state==="healthy"?"forecast-badge-healthy":"forecast-badge-watch")}>{pressure.state}</span>
   </div>
   <p className="row-meta">Project cash, paydays, obligations, and what-if scenarios here. Mission Control only surfaces the resulting attention when cash pressure needs action.</p>
  </div>
  <CashForecastControls
   startingCashMinor={startingCashMinor}
   currentCashMinor={currentCashMinor}
   flows={scenarioFlows}
   obligations={obligations}
   onStartingCashChange={setStartingCashMinor}
   onFlowsChange={setScenarioFlows}
  />
  <CashForecastCalendar forecast={forecast} pressure={pressure} selectedDate={selectedDate} onSelectDate={setSelectedDate}/>
  <CashForecastDayModal
   points={forecast.points}
   point={selectedDate?forecast.points.find(point=>point.date===selectedDate):undefined}
   pressure={pressure}
   onClose={()=>setSelectedDate(null)}
   onDateChange={setSelectedDate}
   onNavigate={detail=>{
    setSelectedDate(null);
    if(detail.sourceType==="event")onEvent(detail.sourceId);
    else if(detail.sourceType==="loan_payment")onGraph(detail.sourceId,"loan_payment");
    else onGraph(detail.sourceId,detail.sourceType);
   }}
   onScenarioAction={applyScenario}
  />
 </section>;
}

function CashForecastCalendar({forecast,pressure,selectedDate,onSelectDate}:{forecast:CashForecastView;pressure:CashPressureView;selectedDate:string|null;onSelectDate:(date:string)=>void}){
 const money=(minor:number)=>(minor/100).toLocaleString(undefined,{style:"currency",currency:"USD"});
 const nextPayday=forecast.paydays[0];
 return <section className="card cash-calendar">
  <div className="section-title">
   <div><div className="kicker">30-Day Cash Forecast</div><h2>Cash Calendar</h2></div>
   <span className="badge">{forecast.points.length} days</span>
  </div>
  <div className="cash-calendar-summary">
   <div><span>Ending</span><strong>{money(forecast.endingBalanceMinor)}</strong></div>
   <div><span>Lowest</span><strong>{money(forecast.lowestBalanceMinor)}</strong></div>
   <div><span>Outflows</span><strong>{money(forecast.totalOutflowsMinor)}</strong></div>
   <div><span>Next Payday</span><strong>{nextPayday?nextPayday.date:"—"}</strong></div>
  </div>
  {forecast.firstNegativeDate&&<button type="button" className="cash-calendar-alert" onClick={()=>onSelectDate(forecast.firstNegativeDate!)}>
   <span>⚠</span><div><strong>Projected cash shortfall</strong><small>{forecast.firstNegativeDate} · tap to inspect the underlying obligations</small></div><b>›</b>
  </button>}
  <div className="cash-calendar-strip" role="list" aria-label="30-day cash forecast">
   {forecast.points.map(point=>{
    const state=point.closingBalanceMinor<0?"negative":point.closingBalanceMinor<pressure.reserveMinor?"constrained":point.closingBalanceMinor<pressure.watchThresholdMinor?"watch":"healthy";
    const isSelected=selectedDate===point.date;
    const isLowest=point.date===forecast.lowestBalanceDate;
    const payday=forecast.paydays.find(item=>item.date===point.date);
    return <button type="button" role="listitem" key={point.date} className={"cash-day "+state+(isSelected?" selected":"")+(isLowest?" lowest":"")} onClick={()=>onSelectDate(point.date)} aria-label={point.date+", projected closing "+money(point.closingBalanceMinor)+(payday?" with payday":"")}>
     <span className="cash-day-date">{new Date(point.date+"T12:00:00").toLocaleDateString(undefined,{weekday:"short"})}</span>
     <strong>{new Date(point.date+"T12:00:00").getDate()}</strong>
     {payday&&<span className="cash-day-payday">PAYDAY · {money(payday.amountMinor)}</span>}
     <span className="cash-day-balance">{money(point.closingBalanceMinor)}</span>
     <span className="cash-day-flow">{point.inflowMinor>0?"↑ "+money(point.inflowMinor):""}{point.outflowMinor>0?(point.inflowMinor>0?" · ":"")+"↓ "+money(point.outflowMinor):" "}</span>
     <span className="cash-day-sources">{point.entries.length} flow{point.entries.length===1?"":"s"}</span>
    </button>;
   })}
  </div>
  <div className="cash-calendar-key">
   <span><i className="healthy"/>Healthy</span><span><i className="watch"/>Watch</span><span><i className="constrained"/>Cushion</span><span><i className="negative"/>Shortfall</span><span><i className="payday"/>Payday</span>
  </div>
 </section>;
}

function CashForecastDayModal({points,point,pressure,onClose,onDateChange,onNavigate,onScenarioAction}:{points:CashForecastPoint[];point:CashForecastPoint|undefined;pressure:CashPressureView;onClose:()=>void;onDateChange:(date:string)=>void;onNavigate:(entry:{sourceType:string;sourceId:string})=>void;onScenarioAction:(entry:CashForecastEntry,action:"pay"|"delay"|"keep",delayDays?:number)=>void}){
 if(!point)return null;
 const money=(minor:number)=>(minor/100).toLocaleString(undefined,{style:"currency",currency:"USD"});
 const index=points.findIndex(item=>item.date===point.date);
 const previous=index>0?points[index-1]:undefined;
 const next=index>=0&&index<points.length-1?points[index+1]:undefined;
 const pointState=point.closingBalanceMinor<0?"negative":point.closingBalanceMinor<pressure.reserveMinor?"constrained":point.closingBalanceMinor<pressure.watchThresholdMinor?"watch":"healthy";
 const label=pointState==="negative"?"Cash shortfall":pointState==="constrained"?"Cash cushion constrained":pointState==="watch"?"Cash position needs watching":"Cash forecast";
 return <div className="modal-backdrop" onMouseDown={onClose}>
  <div className="entity-detail-modal" onMouseDown={event=>event.stopPropagation()}>
   <div className="entity-detail-header"><div><div className="kicker">Cash Forecast · {point.date}</div><h2>{label}</h2></div><button className="mini-action" onClick={onClose}>Close</button></div>
   <div className="context-tabs"><button type="button" disabled={!previous} onClick={()=>previous&&onDateChange(previous.date)}>← {previous?.date??"Previous"}</button><span>{index+1} / {points.length}</span><button type="button" disabled={!next} onClick={()=>next&&onDateChange(next.date)}>{next?.date??"Next"} →</button></div>
   <div className="entity-detail-grid">
    <div><span className="kicker">Opening</span><strong>{money(point.openingBalanceMinor)}</strong></div>
    <div><span className="kicker">Inflows</span><strong>{money(point.inflowMinor)}</strong></div>
    <div><span className="kicker">Outflows</span><strong>{money(point.outflowMinor)}</strong></div>
    <div><span className="kicker">Projected closing</span><strong>{money(point.closingBalanceMinor)}</strong></div>
   </div>
   <div className="selected-graph">
    <div className="section-title"><div><div className="kicker">Underlying obligations & flows</div><span className="row-meta">{point.entries.length} source{point.entries.length===1?"":"s"} · {pointState}</span></div></div>
    <div className="list">
     {point.entries.length?point.entries.map(entry=><div className="row entity-row cash-forecast-entry" key={entry.sourceType+entry.sourceId+entry.date}>
      <div className="row-main">
       <button type="button" className="cash-forecast-entry-main" onClick={()=>onNavigate({sourceType:entry.sourceType,sourceId:entry.sourceId})}><div className="row-title">{entry.title}</div><div className="row-meta">{entry.sourceType.replaceAll("_"," ")} · {entry.direction==="outflow"?"−":"+"}{money(entry.amountMinor)}</div></button>
       {entry.direction==="outflow"&&entry.sourceType!=="external"&&<div className="cash-forecast-actions" aria-label={"Scenario actions for "+entry.title}><button type="button" className="mini-action scenario-pay" onClick={()=>onScenarioAction(entry,"pay")}>Pay First</button><button type="button" className="mini-action scenario-delay" onClick={()=>onScenarioAction(entry,"delay",3)}>Delay 3d</button><button type="button" className="mini-action" onClick={()=>onScenarioAction(entry,"keep")}>Keep</button></div>}
      </div>
      <span className="queue-count">›</span>
     </div>):<div className="row"><div className="row-meta">No underlying scheduled flows on this date.</div></div>}
    </div>
   </div>
   <div className="entity-detail-footer"><button className="action" onClick={onClose}>Done</button></div>
  </div>
 </div>;
}
