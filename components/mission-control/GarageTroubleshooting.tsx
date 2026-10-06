"use client";
import {useMemo,useState} from "react";
import {SCION_XB_TROUBLESHOOTING,type GarageTroubleshootingPath} from "@/domain/data/garage-troubleshooting";
import {SUBARU_CROSSTREK_2019_PROFILE,SUBARU_CROSSTREK_TROUBLESHOOTING,SUBARU_CROSSTREK_QUICK_SPECS,SUBARU_CROSSTREK_TORQUES,SUBARU_CROSSTREK_OBD_CODES} from "@/domain/data/subaru-crosstrek-troubleshooting";

export default function GarageTroubleshooting({onClose}:{onClose?:()=>void}){
 const [open,setOpen]=useState(false);
 const [vehicle,setVehicle]=useState<"scion"|"subaru">("scion");
 const [query,setQuery]=useState("");
 const [selectedId,setSelectedId]=useState(SCION_XB_TROUBLESHOOTING[0]?.id??"");
 const paths=vehicle==="subaru"?SUBARU_CROSSTREK_TROUBLESHOOTING:SCION_XB_TROUBLESHOOTING;
 const matches=useMemo(()=>{
  const q=query.trim().toLowerCase();
  if(!q)return paths;
  return paths.filter(p=>[p.symptom,p.system,...p.triggers,...p.likelyCauses].join(" ").toLowerCase().includes(q));
 },[query,paths]);
 const selected=matches.find(p=>p.id===selectedId)??matches[0];
 const select=(p:GarageTroubleshootingPath)=>setSelectedId(p.id);
 const switchVehicle=(next:"scion"|"subaru")=>{setVehicle(next);setQuery("");setSelectedId((next==="subaru"?SUBARU_CROSSTREK_TROUBLESHOOTING:SCION_XB_TROUBLESHOOTING)[0]?.id??"");};
 return <>
  <button type="button" className="action garage-guide-trigger" onClick={()=>setOpen(true)}>🧭 Factory Diagnostic Guide <span>{paths.length}</span></button>
  {open&&<div className="garage-guide-modal" role="dialog" aria-modal="true" aria-labelledby="garage-guide-title" onMouseDown={()=>setOpen(false)}>
   <section className="garage-troubleshooting garage-guide-panel" onMouseDown={e=>e.stopPropagation()}>
    <div className="garage-troubleshooting-head"><div><div className="kicker">Factory Diagnostic Guide</div><h3 id="garage-guide-title">{vehicle==="subaru"?"2019 Subaru Crosstrek · FB20 / CVT":"Symptom → Diagnostic Path"}</h3><p className="row-meta">{vehicle==="subaru"?SUBARU_CROSSTREK_2019_PROFILE.year+" "+SUBARU_CROSSTREK_2019_PROFILE.make+" "+SUBARU_CROSSTREK_2019_PROFILE.model+" · "+SUBARU_CROSSTREK_2019_PROFILE.engine+" · "+SUBARU_CROSSTREK_2019_PROFILE.transmission:"2006 Scion xB · 1NZ-FE · factory repair-manual references"}</p></div><div className="row-actions"><span className="badge">{paths.length}</span><button type="button" className="mini-action" onClick={()=>{setOpen(false);onClose?.()}}>Close</button></div></div>
    <div className="garage-guide-tabs"><button type="button" className={"mini-action "+(vehicle==="scion"?"active":"")} onClick={()=>switchVehicle("scion")}>Scion xB</button><button type="button" className={"mini-action "+(vehicle==="subaru"?"active":"")} onClick={()=>switchVehicle("subaru")}>2019 Subaru Crosstrek</button></div>
    {vehicle==="subaru"&&<div className="garage-quick-reference"><div><div className="field-label">Quick specifications</div>{SUBARU_CROSSTREK_QUICK_SPECS.map((x,i)=><span className="garage-chip" key={i}>{x}</span>)}</div><div><div className="field-label">Torque reference</div>{SUBARU_CROSSTREK_TORQUES.slice(0,8).map((x,i)=><span className="garage-chip" key={i}>{x}</span>)}</div><div><div className="field-label">OBD / severity reference</div>{SUBARU_CROSSTREK_OBD_CODES.map(([code,desc,severity])=><span className="garage-chip" key={code}>{code} · {severity} · {desc}</span>)}</div></div>}
    <input className="command-input garage-troubleshooting-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search symptoms, causes, systems…" aria-label="Search factory troubleshooting guide"/>
    <div className="garage-troubleshooting-layout"><div className="garage-troubleshooting-list" role="listbox" aria-label="Troubleshooting symptoms">{matches.map(p=><button type="button" key={p.id} className={"garage-troubleshooting-item "+(selected?.id===p.id?"active":"")} onClick={()=>select(p)}><span className="garage-troubleshooting-system">{p.system}</span><strong>{p.symptom}</strong><span>{p.likelyCauses.slice(0,2).join(" · ")}</span></button>)}{!matches.length&&<div className="row-meta">No factory troubleshooting path matches that search.</div>}</div>
     {selected&&<div className="garage-troubleshooting-detail"><div className="kicker">{selected.system}</div><h4>{selected.symptom}</h4>{vehicle==="subaru"&&<div className="garage-chip-list"><span className="garage-chip">Diagnose before replacement</span><span className="garage-chip">Subaru-specific diagnostic logic</span><span className="garage-chip">Source: sucross.com + supplied profile</span></div>}<div className="garage-troubleshooting-grid"><div className="garage-troubleshooting-block"><div className="field-label">Likely / suspected areas</div><ol>{selected.likelyCauses.map((x,i)=><li key={i}>{x}</li>)}</ol></div><div className="garage-troubleshooting-block"><div className="field-label">Factory diagnostic sequence</div><ol>{selected.sequence.map((x,i)=><li key={i}>{x}</li>)}</ol></div></div><div className="garage-troubleshooting-block"><div className="field-label">Required measurements / specifications</div><div className="garage-spec-list">{selected.measurements.map((x,i)=><div className="garage-spec" key={i}>{x}</div>)}</div></div><div className="garage-troubleshooting-block"><div className="field-label">Relevant manual sections</div><div className="garage-chip-list">{selected.sections.map((x,i)=><span className="garage-chip" key={i}>{x.section} · {x.ref}</span>)}</div></div><div className="garage-troubleshooting-block"><div className="field-label">Garage context</div><div className="garage-chip-list">{selected.garageLinks.map((x,i)=><span className="garage-chip" key={i}>{x}</span>)}</div></div></div>}
    </div>
   </section>
  </div>}
 </>;
}