"use client";
import {useEffect,useState} from "react";
import type {LifeOSDatabase} from "@/domain/contracts/database";
import {backupReminder} from "@/domain/services/backup";
import {getStorageStatus,requestPersistentStorage} from "@/storage/persistence";
import type {StorageStatus} from "@/storage/persistence";
const mb=(bytes?:number)=>bytes===undefined?"unknown":(bytes/1048576).toFixed(1)+" MB";
export default function StoragePanel({db,onBackup}:{db:LifeOSDatabase;onBackup:()=>void}){
 const [status,setStatus]=useState<StorageStatus|null>(null);
 useEffect(()=>{let live=true;getStorageStatus().then(s=>{if(live)setStatus(s)});return()=>{live=false}},[]);
 const reminder=backupReminder(db),last=db.metadata.lastBackupAt;
 return <div className="storage-panel"><div className="row"><div className="row-main"><div className="row-title">Last full backup</div><div className="row-meta">{last?new Date(last).toLocaleString()+(reminder.ageDays!==null?` · ${reminder.ageDays} day${reminder.ageDays===1?"":"s"} ago`:""):"Never"}</div></div><button className="mini-action" onClick={onBackup}>Back up now</button></div><div className="row"><div className="row-main"><div className="row-title">Browser storage protection</div><div className="row-meta">{status===null?"Checking…":!status.supported?"Not reported by this browser":status.persisted?"Persistent: protected from automatic clearing":"Not protected: the browser may clear data if the site goes unused"} · {mb(status?.usageBytes)} used</div></div>{status?.supported&&!status.persisted&&<button className="mini-action" onClick={()=>requestPersistentStorage().then(setStatus)}>Request protection</button>}</div></div>;
}
