"use client";
import {useState} from "react";
import type {LifeOSDatabase} from "@/domain/contracts/database";
import {backupReminder} from "@/domain/services/backup";
import {isPlaceholderSeedVersion} from "@/domain/services/seed";
import type {StorageStatus} from "@/storage/persistence";
type Props={db:LifeOSDatabase;storage:StorageStatus|null;onBackup:()=>void;onOpenData:()=>void};
function isInstalledApp(){if(typeof window==="undefined")return false;return window.matchMedia?.("(display-mode: standalone)").matches===true||(navigator as Navigator&{standalone?:boolean}).standalone===true}
export default function StatusBanners({db,storage,onBackup,onOpenData}:Props){
 const [dismissed,setDismissed]=useState<Record<string,boolean>>({});
 const noSeed=isPlaceholderSeedVersion(db.seedVersion), reminder=backupReminder(db);
 const unprotected=!noSeed&&storage!==null&&storage.supported&&!storage.persisted&&!isInstalledApp();
 const dismiss=(key:string)=>setDismissed(x=>({...x,[key]:true}));
 return <>{noSeed&&<div className="status-banner info" role="status"><span>No Full Life Control seed is loaded. Import your seed file to begin; it stays on this device.</span><span className="status-banner-actions"><button className="mini-action" onClick={onOpenData}>Import seed</button></span></div>}
 {reminder.due&&!dismissed.backup&&<div className="status-banner" role="status"><span>{reminder.neverBackedUp?"This data has never been backed up.":`Last backup was ${reminder.ageDays} day${reminder.ageDays===1?"":"s"} ago.`} It is stored only in this browser.</span><span className="status-banner-actions"><button className="mini-action" onClick={onBackup}>Back up now</button><button className="mini-action" onClick={()=>dismiss("backup")}>Later</button></span></div>}
 {unprotected&&!dismissed.storage&&<div className="status-banner" role="status"><span>This browser may clear LifeOS data if the site goes unused. On iPhone: Share → Add to Home Screen, then open LifeOS from its icon.</span><span className="status-banner-actions"><button className="mini-action" onClick={()=>dismiss("storage")}>Dismiss</button></span></div>}</>;
}
