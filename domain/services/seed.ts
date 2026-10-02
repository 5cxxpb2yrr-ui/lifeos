import type {LifeOSBackup,LifeOSDatabase} from "@/domain/contracts/database";
export interface SeedCheck{valid:boolean;reason:string}
function isRecord(value:unknown):value is Record<string,unknown>{return typeof value==="object"&&value!==null}
export function validateSeedBackup(input:unknown):input is LifeOSBackup{if(!isRecord(input)||input.format!=="lifeos-backup"||typeof input.seedVersion!=="string"||!isRecord(input.database))return false;if(input.seedVersion==="UNSET-REAL-SEED"||input.seedVersion==="NO_REAL_SEED_LOADED")return false;return input.database.seedVersion===input.seedVersion}
export function explainSeedValidation(input:unknown):SeedCheck{return validateSeedBackup(input)?{valid:true,reason:"Valid LifeOS seed backup."}:{valid:false,reason:"A real immutable LifeOS seed backup is required."}}
export function importSeed(input:LifeOSBackup):LifeOSDatabase{return structuredClone(input.database)}
