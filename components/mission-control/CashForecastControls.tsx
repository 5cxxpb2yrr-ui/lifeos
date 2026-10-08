"use client";

import {useMemo,useState} from "react";

export interface ForecastScenarioFlow{
 id:string;
 date:string;
 amountMinor:number;
 direction:"inflow"|"outflow";
 title:string;
}

export default function CashForecastControls({
 startingCashMinor,
 currentCashMinor,
 flows,
 onStartingCashChange,
 onFlowsChange,
}:{
 startingCashMinor:number|undefined;
 currentCashMinor:number;
 flows:ForecastScenarioFlow[];
 onStartingCashChange:(value:number|undefined)=>void;
 onFlowsChange:(flows:ForecastScenarioFlow[])=>void;
}){
 const [amount,setAmount]=useState("");
 const [date,setDate]=useState("");
 const [title,setTitle]=useState("");
 const [direction,setDirection]=useState<"outflow"|"inflow">("outflow");
 const displayStarting=startingCashMinor??currentCashMinor;
 const scenarioTotal=useMemo(()=>flows.reduce((sum,x)=>sum+(x.direction==="inflow"?x.amountMinor:-x.amountMinor),0),[flows]);
 const money=(minor:number)=>(minor/100).toLocaleString(undefined,{style:"currency",currency:"USD"});
 function addFlow(){
  const dollars=Number(amount);
  if(!date||!title.trim()||!Number.isFinite(dollars)||dollars<=0)return;
  onFlowsChange([...flows,{id:"scenario-"+Date.now(),date,amountMinor:Math.round(dollars*100),direction,title:title.trim()}]);
  setAmount("");setDate("");setTitle("");
 }
 return <section className="card forecast-controls">
  <div className="section-title">
   <div><div className="kicker">Scenario Planning</div><h2>Forecast Mode</h2></div>
   <span className="badge">What-if</span>
  </div>
  <p className="row-meta">Test a starting cash position and temporary future bills without changing canonical LifeOS data.</p>
  <div className="field-grid">
   <label className="field-label">Starting cash
    <input className="command-input" inputMode="decimal" value={(displayStarting/100).toFixed(2)} onChange={e=>{const n=Number(e.target.value);onStartingCashChange(Number.isFinite(n)?Math.round(n*100):undefined)}}/>
   </label>
   <div className="field-label">Scenario delta<strong className="forecast-scenario-total">{scenarioTotal>=0?"+":"−"}{money(Math.abs(scenarioTotal))}</strong></div>
  </div>
  <div className="forecast-scenario-form">
   <label className="field-label">Date<input className="command-input" type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
   <label className="field-label">Amount<input className="command-input" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00"/></label>
   <label className="field-label">Direction<select className="command-input" value={direction} onChange={e=>setDirection(e.target.value as "outflow"|"inflow")}><option value="outflow">Bill / outflow</option><option value="inflow">Income / inflow</option></select></label>
   <label className="field-label">Description<input className="command-input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Mortgage, registration, utility…"/></label>
   <button type="button" className="action primary" onClick={addFlow}>Add scenario flow</button>
  </div>
  {flows.length>0&&<div className="list">{flows.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(flow=><button type="button" className="row entity-row" key={flow.id} onClick={()=>onFlowsChange(flows.filter(x=>x.id!==flow.id))}><div className="row-main"><div className="row-title">{flow.title}</div><div className="row-meta">{flow.date} · {flow.direction==="outflow"?"−":"+"}{money(flow.amountMinor)} · tap to remove</div></div><span className="queue-count">×</span></button>)}</div>}
  {(startingCashMinor!==undefined||flows.length>0)&&<button type="button" className="action" onClick={()=>{onStartingCashChange(undefined);onFlowsChange([])}}>Reset scenario</button>}
 </section>;
}
