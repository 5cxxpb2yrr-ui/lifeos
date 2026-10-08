import type {LifeOSBackup,LifeOSDatabase} from "@/domain/contracts/database";
import {isPlaceholderSeedVersion} from "@/domain/services/seed";
export const BACKUP_REMINDER_DAYS=14; const DAY_MS=86_400_000;
export function makeBackup(db:LifeOSDatabase,exportedAt=new Date().toISOString()):LifeOSBackup{return {format:"lifeos-backup",formatVersion:"1.0",schemaVersion:db.schemaVersion,seedVersion:db.seedVersion,appVersion:db.appVersion,exportedAt,database:db};}
export function stampBackup(db:LifeOSDatabase,now=new Date().toISOString()):LifeOSDatabase{return {...db,metadata:{...db.metadata,lastBackupAt:now}};}
export interface BackupReminder{due:boolean;neverBackedUp:boolean;ageDays:number|null}
export function backupReminder(db:LifeOSDatabase,now=Date.now(),thresholdDays=BACKUP_REMINDER_DAYS):BackupReminder{if(isPlaceholderSeedVersion(db.seedVersion))return {due:false,neverBackedUp:false,ageDays:null};const last=db.metadata.lastBackupAt?Date.parse(db.metadata.lastBackupAt):NaN;if(Number.isNaN(last))return {due:true,neverBackedUp:true,ageDays:null};const ageDays=Math.max(0,Math.floor((now-last)/DAY_MS));return {due:ageDays>=thresholdDays,neverBackedUp:false,ageDays};}
