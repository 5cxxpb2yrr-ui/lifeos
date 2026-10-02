import type {LifeOSBackup,LifeOSDatabase} from "@/domain/contracts/database";
import {validateDatabaseIntegrity} from "@/domain/resolvers/integrity";
export interface SeedCheck{valid:boolean;reason:string}
function isRecord(value:unknown):value is Record<string,unknown>{return typeof value==="object"&&value!==null}
export function validateLifeOSBackup(input:unknown):input is LifeOSBackup{
 if(!isRecord(input)||input.format!=="lifeos-backup"||typeof input.formatVersion!=="string"||typeof input.schemaVersion!=="string"||typeof input.seedVersion!=="string"||!isRecord(input.database))return false;
 const db=input.database as Record<string,unknown>;
 return db.schemaVersion===input.schemaVersion&&db.seedVersion===input.seedVersion&&Array.isArray(db.events)&&Array.isArray(db.relationships)&&Array.isArray(db.loanPayments)&&Array.isArray(db.transactions)&&validateDatabaseIntegrity(input.database as unknown as LifeOSDatabase).valid;
}
export function validateSeedBackup(input:unknown):input is LifeOSBackup{
 if(!validateLifeOSBackup(input))return false;
 if(input.seedVersion==="UNSET-REAL-SEED"||input.seedVersion==="NO_REAL_SEED_LOADED")return false;
 return true;
}
export function explainSeedValidation(input:unknown):SeedCheck{
 return validateSeedBackup(input)?{valid:true,reason:"Valid LifeOS seed backup."}:{valid:false,reason:"A real immutable LifeOS seed backup is required."}
}
export function explainBackupValidation(input:unknown):SeedCheck{
 return validateLifeOSBackup(input)?{valid:true,reason:"Valid LifeOS backup."}:{valid:false,reason:"The selected file is not a valid LifeOS backup."}
}
export function importSeed(input:LifeOSBackup):LifeOSDatabase{return structuredClone(input.database)}
export function restoreBackup(input:LifeOSBackup):LifeOSDatabase{return structuredClone(input.database)}

export function isPlaceholderSeedVersion(version:string):boolean{
 return version==="UNSET-REAL-SEED"||version==="NO_REAL_SEED_LOADED";
}

export function validateSeedContinuity(current:LifeOSDatabase,candidate:LifeOSDatabase):SeedCheck{
 if(isPlaceholderSeedVersion(current.seedVersion)) return {valid:true,reason:"No immutable seed baseline has been established yet."};
 if(current.seedVersion!==candidate.seedVersion){
  return {valid:false,reason:"The candidate database belongs to a different immutable seed version and cannot replace the established seed baseline."};
 }
 return {valid:true,reason:"Immutable seed lineage preserved."};
}
