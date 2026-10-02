import source from "@/seed/full-life-control-seed-backup.json";
import type {LifeOSBackup} from "@/domain/contracts/database";
import {normalizeLegacySeed,validateLegacySeedSource,IMMUTABLE_SEED_VERSION} from "@/domain/services/legacy-seed";
export function getBundledImmutableSeed():LifeOSBackup{
 if(!validateLegacySeedSource(source))throw new Error("Bundled Full Life Control seed source is invalid.");
 const seed=normalizeLegacySeed(source);
 if(seed.seedVersion!==IMMUTABLE_SEED_VERSION)throw new Error("Bundled immutable seed version mismatch.");
 return seed;
}
