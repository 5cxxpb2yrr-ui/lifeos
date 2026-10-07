import assert from "node:assert/strict";
import test from "node:test";
import {createOpenLoopFromEvent,linkEventToOpenLoop,resolveOpenLoop} from "../domain/services/operations.ts";
import type {Event,LifeOSDatabase,OpenLoop} from "../domain/contracts/database.ts";

function db():LifeOSDatabase{
 const t="2026-10-06T12:00:00.000Z";
 const event:Event={id:"evt-1",entityType:"event",createdAt:t,updatedAt:t,eventType:"maintenance",title:"Brake inspection",status:"planned",dueAt:"2026-10-10T12:00:00.000Z"};
 return {schemaVersion:"1",seedVersion:"1",appVersion:"test",entities:[],relationships:[],events:[event],openLoops:[],people:[],assets:[],accounts:[],transactions:[],loans:[],loanPayments:[],vehicles:[],vehicleMaintenance:[],properties:[],rooms:[],homeSystems:[],electricalDevices:[],projects:[],goals:[],decisions:[],documents:[],recurringRules:[],auditEntries:[],metadata:{databaseId:"test",schemaVersion:"1",seedVersion:"1",appVersion:"test",createdAt:t,updatedAt:t}};
}
test("creating a loop from an event links both canonical records",()=>{
 const next=createOpenLoopFromEvent(db(),"evt-1");
 assert.equal(next.openLoops.length,1);
 const loop=next.openLoops[0];
 assert.deepEqual(loop.relatedEventIds,["evt-1"]);
 assert.deepEqual(next.events[0].openLoopIds,[loop.id]);
 assert.equal(loop.title,"Brake inspection");
 assert.equal(loop.dueAt,"2026-10-10T12:00:00.000Z");
});
test("linking an existing loop is idempotent",()=>{
 const base=db();
 const loop:OpenLoop={id:"loop-1",entityType:"open_loop",createdAt:"2026-10-06T12:00:00.000Z",updatedAt:"2026-10-06T12:00:00.000Z",title:"Order parts",type:"follow_up",status:"open"};
 base.openLoops=[loop];
 const once=linkEventToOpenLoop(base,"evt-1","loop-1");
 const twice=linkEventToOpenLoop(once,"evt-1","loop-1");
 assert.deepEqual(twice.events[0].openLoopIds,["loop-1"]);
 assert.deepEqual(twice.openLoops[0].relatedEventIds,["evt-1"]);
});

test("resolving a loop clears its operational attention without changing the linked event",()=>{
 const base=db();
 const linked=createOpenLoopFromEvent(base,"evt-1");
 const loop=linked.openLoops[0];
 const next=resolveOpenLoop(linked,loop.id);
 assert.equal(next.openLoops[0].status,"resolved");
 assert.ok(next.openLoops[0].resolvedAt);
 assert.deepEqual(next.events[0],linked.events[0]);
 const audit=next.auditEntries.at(-1);
 assert.equal(audit?.targetId,loop.id);
 assert.equal(audit?.targetType,"open_loop");
 assert.equal(audit?.source,"open-loop-engine");
 assert.equal(audit?.before?.status,"open");
 assert.equal(audit?.after?.status,"resolved");
});

test("resolving an already closed loop is idempotent",()=>{
 const base=db();
 const linked=createOpenLoopFromEvent(base,"evt-1");
 const loop=linked.openLoops[0];
 const resolved=resolveOpenLoop(linked,loop.id);
 const again=resolveOpenLoop(resolved,loop.id);
 assert.equal(again.auditEntries.length,resolved.auditEntries.length);
 assert.equal(again.openLoops[0].resolvedAt,resolved.openLoops[0].resolvedAt);
});
