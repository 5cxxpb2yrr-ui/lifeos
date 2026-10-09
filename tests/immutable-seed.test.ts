import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {normalizeLegacySeed,validateLegacySeedSource,IMMUTABLE_SEED_VERSION} from "../domain/services/legacy-seed.ts";
import {validateDatabaseIntegrity} from "../domain/resolvers/integrity.ts";

test("Full Life Control seed normalizes into a valid canonical LifeOS database",()=>{
 const source=JSON.parse(readFileSync(new URL("../seed/full-life-control-seed-backup.json",import.meta.url),"utf8"));
 assert.equal(validateLegacySeedSource(source),true);
 const backup=normalizeLegacySeed(source);
 assert.equal(backup.format,"lifeos-backup");
 assert.equal(backup.seedVersion,IMMUTABLE_SEED_VERSION);
 assert.equal(backup.database.seedVersion,IMMUTABLE_SEED_VERSION);
 assert.equal(backup.database.events.length,15+89+6+4);
 assert.equal(backup.database.people.length,0);
 assert.equal(source.people.length,0);
 assert.equal(source.events.some((event:Record<string,unknown>)=>Object.prototype.hasOwnProperty.call(event,"people")||Object.prototype.hasOwnProperty.call(event,"personIds")),false);
 assert.equal(backup.database.vehicles.length,2);
 assert.equal(backup.database.vehicleMaintenance.length,89);
 assert.equal(backup.database.projects.length,4);
 assert.equal(backup.database.goals.length,9);
 assert.equal(backup.database.openLoops.length,11+5);
 assert.equal(backup.database.decisions.length,3);
 assert.equal(backup.database.transactions.length,1+4);
 assert.equal(backup.database.relationships.length,5+4);
 const integrity=validateDatabaseIntegrity(backup.database);
 assert.equal(integrity.valid,true,JSON.stringify(integrity.errors,null,2));
 assert.equal(backup.database.metadata.seedSource?.sha256,"d22e0386087b4d6eee4063d4d77eab29b17b6d675f0a92dc87c2bd5d546531b7");
 assert.equal(backup.database.metadata.seedSource?.format,"FLC-v5");
});

test("seed conversion preserves the original source inside seed provenance",()=>{
 const source=JSON.parse(readFileSync(new URL("../seed/full-life-control-seed-backup.json",import.meta.url),"utf8"));
 const backup=normalizeLegacySeed(source);
 const preserved=backup.database.metadata.seedSource?.legacySource as Record<string,unknown>;
 assert.equal(preserved._format,"FLC-v5");
 assert.equal(Array.isArray(preserved.events),true);
 assert.equal(Array.isArray(preserved.maintenance),true);
 assert.equal(Array.isArray(preserved.bills),true);
});
