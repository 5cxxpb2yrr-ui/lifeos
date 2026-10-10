"use client";

import {useMemo} from "react";
import type {LifeOSDatabase} from "@/domain/contracts/database";
import {resolveCashPressure} from "@/domain/resolvers/cash-pressure";

function money(minor:number){return (minor/100).toLocaleString(undefined,{style:"currency",currency:"USD"});}
function dateLabel(date?:string){return date?new Date(date+"T12:00:00").toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"}):"Not available";}

const labels={healthy:"Healthy",watch:"Watch",constrained:"Constrained",negative:"Projected shortfall",unresolved:"Needs starting cash"};
const descriptions={
 healthy:"Your projected cash stays above the watch threshold across this forecast.",
 watch:"Your projected cash cushion is getting low. Review upcoming obligations.",
 constrained:"Your projected cash cushion is critically low. Review priority bills and timing.",
 negative:"The forecast shows a day when cash may fall below zero. Review the obligations below.",
 unresolved:"Add or verify a checking, savings, or cash account to establish a reliable starting balance."
};

export default function CashPressurePanel({db}:{db:LifeOSDatabase}){
 const pressure=useMemo(()=>resolveCashPressure(db,{horizonDays:30}),[db]);
 const level=pressure.state;
 const obligations=useMemo(()=>{
  const point=pressure.forecast.points.find(p=>p.date===pressure.lowestBalanceDate);
  return (point?.sources??[]).filter(source=>source.type!=="income").slice(0,4);
 },[pressure]);
 return <section className="card cash-pressure-panel" aria-labelledby="cash-pressure-title">
  <div className="section-title">
   <div><div className="kicker">Attention / Cash forecast</div><h3 id="cash-pressure-title">Cash Pressure</h3></div>
   <span className={"badge cash-pressure-"+level}>{labels[level]}</span>
  </div>
  <p>{descriptions[level]}</p>
  <div className="metric-grid">
   <div className="metric"><span>Lowest projected balance</span><strong>{money(pressure.lowestBalanceMinor)}</strong></div>
   <div className="metric"><span>Forecast date</span><strong>{dateLabel(pressure.lowestBalanceDate)}</strong></div>
  </div>
  {pressure.firstNegativeDate&&<p className="cash-pressure-warning"><strong>First projected negative day:</strong> {dateLabel(pressure.firstNegativeDate)}</p>}
  {level!=="healthy"&&<p className="row-meta">{pressure.reason}</p>}
  {obligations.length>0&&<div className="cash-pressure-obligations"><strong>Obligations on the lowest-balance day</strong><ul>{obligations.map(item=><li key={item.id}>{item.label} <span>{money(item.amountMinor)}</span></li>)}</ul></div>}
  {pressure.attention.map(item=><button type="button" className="cash-pressure-action" key={item.id} onClick={()=>window.dispatchEvent(new CustomEvent("lifeos:cash-pressure",{detail:{id:item.id,state:pressure.state,date:pressure.lowestBalanceDate}}))}>View attention details <span aria-hidden="true">→</span></button>)}
 </section>;
}
