"use client";
import {useRef,useState} from "react";
import type {LifeOSDatabase,CollectionName} from "@/domain/contracts/database";
import {importSeed,restoreBackup,validateLifeOSBackup,validateSeedBackup,explainSeedValidation,explainBackupValidation,validateSeedContinuity} from "@/domain/services/seed";
import {validateDatabaseIntegrity} from "@/domain/resolvers/integrity";
import {parseSeedInput} from "@/domain/services/seed-file";
import {makeBackup,stampBackup} from "@/domain/services/backup";
import StoragePanel from "@/components/mission-control/StoragePanel";

type Props={db:LifeOSDatabase;onPersist:(db:LifeOSDatabase,message:string)=>Promise<void>|void;onNotice:(message:string)=>void};

const collections=["events","openLoops","people","assets","accounts","transactions","loans","loanPayments","vehicles","vehicleMaintenance","properties","rooms","homeSystems","electricalDevices","projects","goals","decisions","documents","recurringRules","relationships","auditEntries"] as const;

function download(content:string,filename:string,type="application/json"){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function csvCell(value:unknown){if(value==null)return "";const text=typeof value==="string"?value:JSON.stringify(value);return JSON.stringify(text)}
function collectionCsv(db:LifeOSDatabase,name:CollectionName){const rows=(db[name] as unknown as Record<string,unknown>[]);const keys=Array.from(new Set(rows.flatMap(r=>Object.keys(r))));return [keys.map(csvCell).join(","),...rows.map(r=>keys.map(k=>csvCell(r[k])).join(","))].join("\n")}

export default function DataControlCenter({db,onPersist,onNotice}:Props){
 const inputRef=useRef<HTMLInputElement>(null); const seedRef=useRef<HTMLInputElement>(null);
 const [mode,setMode]=useState<"import"|"export"|"integrity"|"seed"|"audit">("import");
 const [preview,setPreview]=useState<LifeOSDatabase|null>(null); const [previewKind,setPreviewKind]=useState<"restore"|"seed"|null>(null); const [fileName,setFileName]=useState("");
 const integrity=validateDatabaseIntegrity(db);
 const totalRecords=collections.reduce((n,k)=>n+(db[k] as unknown[]).length,0);
 const auditCount=db.auditEntries.length;
 function exportFull(){const stamped=stampBackup(db);download(JSON.stringify(makeBackup(stamped),null,2),"lifeos-backup.json");void onPersist(stamped,"Full LifeOS backup exported.")}
 function exportDatabase(){download(JSON.stringify(db,null,2),"lifeos-database.json");onNotice("Human-readable database export created.")}
 function exportCsv(name:CollectionName){download(collectionCsv(db,name),`lifeos-${name}.csv`,"text/csv");onNotice(`${name} CSV exported.`)}
 async function readFile(file:File,kind:"restore"|"seed"){
  let candidate:LifeOSDatabase;
  try{
   if(kind==="seed"){
    const parsed=await parseSeedInput(await file.arrayBuffer());
    if(!parsed.ok){onNotice("Seed rejected: "+parsed.reason);return}
    candidate=importSeed(parsed.backup);
   }else{
    let parsed:unknown;
    try{parsed=JSON.parse(await file.text())}catch{onNotice("Import rejected: invalid JSON.");return}
    if(!validateLifeOSBackup(parsed)){onNotice("Restore rejected: "+explainBackupValidation(parsed).reason);return}
    candidate=restoreBackup(parsed);
   }
  }catch{onNotice("Import rejected: unable to read file.");return}
  const check=validateDatabaseIntegrity(candidate);
  if(!check.valid){onNotice("Import rejected: database integrity failed.");return}
  const continuity=validateSeedContinuity(db,candidate);
  if(!continuity.valid){onNotice((kind==="seed"?"Seed":"Restore")+" rejected: "+continuity.reason);return}
  setPreview(candidate);setPreviewKind(kind);setFileName(file.name);setMode("import");
  onNotice(`${kind==="seed"?"Seed":"Backup"} loaded for review. Nothing has changed yet.`);
 }
 async function commitPreview(){if(!preview||!previewKind)return;const current=structuredClone(db);try{const continuity=validateSeedContinuity(current,preview);if(!continuity.valid){onNotice("Commit rejected: "+continuity.reason);return}const check=validateDatabaseIntegrity(preview);if(!check.valid){onNotice("Commit rejected: database integrity failed.");return}if(previewKind==="restore"){download(JSON.stringify(makeBackup(current),null,2),`lifeos-pre-restore-${new Date().toISOString().replace(/[:.]/g,"-")}.json`)}await onPersist(structuredClone(preview),previewKind==="seed"?"Immutable seed imported and verified.":"Backup restored and verified.");setPreview(null);setPreviewKind(null);setFileName("")}catch{onNotice("Commit failed. Local database was not intentionally changed.")}}
 function chooseSeedFile(){seedRef.current?.click()}

 return <section className="data-control-center card">
  <StoragePanel db={db} onBackup={exportFull}/>
  <div className="section-title"><div><div className="kicker">LifeOS / Data</div><h2>Data Control Center</h2><div className="row-meta">Controlled movement of the graph in and out of LifeOS.</div></div><span className="badge">{totalRecords} records</span></div>
  <div className="data-control-tabs"><button className={mode==="import"?"active":""} onClick={()=>setMode("import")}>Import</button><button className={mode==="export"?"active":""} onClick={()=>setMode("export")}>Export</button><button className={mode==="integrity"?"active":""} onClick={()=>setMode("integrity")}>Integrity</button><button className={mode==="seed"?"active":""} onClick={()=>setMode("seed")}>Seed</button><button className={mode==="audit"?"active":""} onClick={()=>setMode("audit")}>Audit</button></div>
  {mode==="import"&&<div className="data-control-panel"><div className="data-control-grid"><button className="data-control-action" onClick={()=>inputRef.current?.click()}><strong>Restore LifeOS backup</strong><span>Load a validated .json backup and review it before commit.</span></button><button className="data-control-action" onClick={chooseSeedFile}><strong>Import immutable seed</strong><span>Choose the original Full Life Control seed file. It is verified against the pinned SHA-256 and never bundled.</span></button></div><input ref={inputRef} hidden type="file" accept=".json,application/json" onChange={e=>{const f=e.target.files?.[0];if(f)readFile(f,"restore");e.currentTarget.value=""}}/><input ref={seedRef} hidden type="file" accept=".json,application/json" onChange={e=>{const f=e.target.files?.[0];if(f)readFile(f,"seed");e.currentTarget.value=""}}/>{preview&&<div className="data-preview"><div className="section-title"><div><div className="kicker">Preview</div><h3>{fileName}</h3></div><span className="badge">{previewKind}</span></div><p className="row-meta">Candidate contains {collections.reduce((n,k)=>n+(preview[k] as unknown[]).length,0)} records. The current database has not been changed.</p><div className="data-preview-actions"><button className="action" onClick={()=>{setPreview(null);setPreviewKind(null)}}>Discard</button><button className="action primary" onClick={commitPreview}>Commit import</button></div></div>}</div>}
  {mode==="export"&&<div className="data-control-panel"><div className="data-control-grid"><button className="data-control-action" onClick={exportFull}><strong>Full LifeOS backup</strong><span>Portable, versioned backup including schema and seed lineage.</span></button><button className="data-control-action" onClick={exportDatabase}><strong>Human-readable JSON</strong><span>Database-only export for inspection or transformation.</span></button></div><div className="data-export-list"><div className="kicker">Domain CSV exports</div><div className="data-csv-grid">{collections.map(k=><button key={k} className="mini-action" onClick={()=>exportCsv(k)}>{k}</button>)}</div></div></div>}
  {mode==="integrity"&&<div className="data-control-panel"><div className={integrity.valid?"integrity-ok":"integrity-fail"}><strong>{integrity.valid?"✓ Database integrity valid":"⚠ Integrity errors detected"}</strong><span>{integrity.errors?.length??0} error(s)</span></div><div className="row-meta">Schema {db.schemaVersion} · Seed {db.seedVersion} · App {db.appVersion}</div>{integrity.errors?.length?<div className="data-integrity-list">{integrity.errors.slice(0,20).map((e,i)=><div className="row" key={i}>{e.message}</div>)}</div>:<div className="row-meta">All indexed collections passed the current integrity resolver.</div>}</div>}
  {mode==="seed"&&<div className="data-control-panel"><div className="data-seed-card"><div><div className="kicker">Immutable baseline</div><h3>Full Life Control</h3><div className="row-meta">Current seed version: {db.seedVersion}</div></div><button className="action primary" onClick={chooseSeedFile}>Choose seed file</button></div><p className="row-meta">The original seed file is verified by SHA-256 before it can be committed.</p></div>}
  {mode==="audit"&&<div className="data-control-panel"><div className="section-title"><h3>Audit trail</h3><span className="badge">{auditCount}</span></div><div className="list">{db.auditEntries.slice().sort((a,b)=>b.timestamp.localeCompare(a.timestamp)).slice(0,30).map(a=><div className="row" key={a.id}><div className="row-main"><div className="row-title">{a.action} · {a.targetType}</div><div className="row-meta">{a.timestamp} · {a.targetId}</div></div></div>)}</div>{!auditCount&&<div className="row-meta">No audit entries recorded yet.</div>}</div>}
 </section>;
}
