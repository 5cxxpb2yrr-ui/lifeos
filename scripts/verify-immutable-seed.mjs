#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const manifest=JSON.parse(readFileSync("seed/manifest.json","utf8"));
const path=manifest.sourceFile;
const actualSha=execFileSync("git",["hash-object",path],{encoding:"utf8"}).trim();
const actualSize=readFileSync(path).length;

if(actualSha!==manifest.gitBlobSha){
  console.error("IMMUTABLE SEED INTEGRITY FAILURE");
  console.error("Expected blob SHA:",manifest.gitBlobSha);
  console.error("Actual blob SHA:  ",actualSha);
  process.exit(1);
}
if(actualSize!==manifest.byteLength){
  console.error("IMMUTABLE SEED SIZE FAILURE");
  console.error("Expected bytes:",manifest.byteLength);
  console.error("Actual bytes:  ",actualSize);
  process.exit(1);
}
console.log(`Immutable seed verified: v${manifest.seedVersion} / blob ${actualSha}`);
