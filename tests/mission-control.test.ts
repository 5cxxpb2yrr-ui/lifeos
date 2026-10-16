import assert from "node:assert/strict";
import test from "node:test";
import type {Event,LifeOSDatabase} from "../domain/contracts/database.ts";
import {resolveMissionControl} from "../domain/resolvers/mission-control.ts";

const now = new Date("2026-10-15T12:00:00.000Z");

function event(id:string,overrides:Partial<Event>={}):Event {
 return {
  id,entityType:"event",createdAt:now.toISOString(),updatedAt:now.toISOString(),
  eventType:"appointment",title:id,status:"planned",...overrides
 };
}

function db(events:Event[]):LifeOSDatabase {
 const timestamp=now.toISOString();
 return {
  schemaVersion:"1",seedVersion:"1",appVersion:"test",entities:[],relationships:[],
  events,openLoops:[],people:[],assets:[],accounts:[],transactions:[],loans:[],
  loanPayments:[],vehicles:[],vehicleMaintenance:[],properties:[],rooms:[],
  homeSystems:[],electricalDevices:[],projects:[],goals:[],decisions:[],documents:[],
  recurringRules:[],auditEntries:[],
  metadata:{databaseId:"test",schemaVersion:"1",seedVersion:"1",appVersion:"test",createdAt:timestamp,updatedAt:timestamp}
 };
}

test("72-hour timeline uses due date when start date is outside the window",()=>{
 const item=event("due-inside",{
  startAt:"2026-10-14T12:00:00.000Z",
  dueAt:"2026-10-16T12:00:00.000Z"
 });
 const result=resolveMissionControl(db([item]),now);
 assert.equal(result.next72Hours.length,1);
 assert.equal(result.next72Hours[0].id,"due-inside");
 assert.equal(result.next72Hours[0].timelineAt,"2026-10-16T12:00:00.000Z");
});

test("72-hour timeline prefers an in-window start date and excludes events outside the window",()=>{
 const startsSoon=event("starts-soon",{
  startAt:"2026-10-16T09:00:00.000Z",
  dueAt:"2026-10-17T09:00:00.000Z"
 });
 const outside=event("outside",{
  startAt:"2026-10-20T09:00:00.000Z",
  dueAt:"2026-10-21T09:00:00.000Z"
 });
 const result=resolveMissionControl(db([outside,startsSoon]),now);
 assert.deepEqual(result.next72Hours.map(item=>item.id),["starts-soon"]);
 assert.equal(result.next72Hours[0].timelineAt,"2026-10-16T09:00:00.000Z");
});
