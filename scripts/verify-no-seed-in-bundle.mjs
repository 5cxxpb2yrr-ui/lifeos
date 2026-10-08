#!/usr/bin/env node
import {existsSync,readdirSync,statSync,readFileSync} from "node:fs";
import {join,extname} from "node:path";
const OUT=process.argv[2]??"out";
const forbidden=/(?:from|import\s*\(|require\s*\()\s*["'][^"']*seed\/[^"']*\.json["']/;
function walk(dir,visit){for(const name of readdirSync(dir)){if(name==="node_modules"||name.startsWith("."))continue;const p=join(dir,name),i=statSync(p);if(i.isDirectory())walk(p,visit);else visit(p)}}
if(!existsSync(OUT)){console.error(`Build output "${OUT}" not found. Run the build first.`);process.exit(2)}
const sourceOffenders=[];for(const root of ["app","components","domain","storage"]){if(existsSync(root))walk(root,p=>{if(/\.(ts|tsx|mjs)$/.test(p)&&forbidden.test(readFileSync(p,"utf8")))sourceOffenders.push(p)})}
if(sourceOffenders.length){console.error("SEED IMPORT LEAK:",sourceOffenders.join("\n"));process.exit(1)}
let bundle="";walk(OUT,p=>{if([".js",".html",".txt",".json",".css",".map"].includes(extname(p)))bundle+=readFileSync(p,"utf8")+"\n"});
if(/full-life-control-seed-backup\.json|seed\/[^"'\s]+\.json/.test(bundle)){console.error("SEED FILE REFERENCE LEAK: a private seed path appears in the public build.");process.exit(1)}
console.log("No private seed imports or seed-file references found in the public bundle.");
