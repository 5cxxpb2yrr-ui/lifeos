"use client";

import {useMemo,useState} from "react";
import type {LifeOSDatabase} from "@/domain/contracts/database";
import {getAuditTrail,reconstructEntityAt,reconstructEntityHistory} from "@/domain/resolvers/audit-history";

type Props={db:LifeOSDatabase; targetId:string};

export default function HistoryPanel({db,targetId}:Props){
 const trail=useMemo(()=>getAuditTrail(db,targetId),[db,targetId]);
 const history=useMemo(()=>reconstructEntityHistory(db,targetId),[db,targetId]);
 const [selected,setSelected]=useState(trail.at(-1)?.timestamp??"");
 const state=useMemo(()=>selected?reconstructEntityAt(db,targetId,selected):undefined,[db,targetId,selected]);
 if(!trail.length)return <div className="history-empty">No audit history exists for this entity.</div>;
 return <div className="history-panel">
  <div className="history-toolbar">
   <div><div className="section-title"><h2>History</h2><span className="badge">{trail.length} changes</span></div><div className="row-meta">Time-travel reconstruction from the canonical audit trail.</div></div>
   <label className="history-select-label">View as of
    <select className="history-select" value={selected} onChange={e=>setSelected(e.target.value)}>
     {history.map((h,i)=><option key={h.auditId} value={h.effectiveAt}>{new Date(h.effectiveAt).toLocaleString()} · {h.action} #{i+1}</option>)}
    </select>
   </label>
  </div>
  <div className="history-timeline">{history.map(h=><button type="button" className={"history-event "+(h.effectiveAt===selected?"selected":"")} key={h.auditId} onClick={()=>setSelected(h.effectiveAt)}><span className="history-dot"/><span><strong>{h.action}</strong><small>{new Date(h.effectiveAt).toLocaleString()}</small></span></button>)}</div>
  <div className="history-state"><div className="section-title"><h2>State at selected time</h2>{state&&<span className="badge">{state.entityType}</span>}</div>{state?<pre>{JSON.stringify(state,null,2)}</pre>:<div className="history-empty">Entity did not exist at this point in time.</div>}</div>
 </div>
}
