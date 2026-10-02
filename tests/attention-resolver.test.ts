import assert from "node:assert/strict";
import test from "node:test";
import {resolveAttention,resolveAttentionDetailed} from "../domain/resolvers/attention.ts";
import type {Event,OpenLoop} from "../domain/contracts/database.ts";

const now=new Date("2026-10-02T12:00:00.000Z");
function event(overrides:Partial<Event>={}):Event{
 return {id:"evt-1",entityType:"event",createdAt:now.toISOString(),updatedAt:now.toISOString(),eventType:"task",title:"Test",status:"planned",...overrides};
}
function loop(overrides:Partial<OpenLoop>={}):OpenLoop{
 return {id:"loop-1",entityType:"open_loop",createdAt:now.toISOString(),updatedAt:now.toISOString(),title:"Loop",type:"task",status:"open",...overrides};
}

test("attention resolver orders deadline states deterministically",()=>{
 assert.equal(resolveAttention(event({dueAt:"2026-10-01T12:00:00.000Z"}),now),"overdue");
 assert.equal(resolveAttention(event({dueAt:"2026-10-02T20:00:00.000Z"}),now),"due_today");
 assert.equal(resolveAttention(event({dueAt:"2026-10-06T12:00:00.000Z"}),now),"due_soon");
 assert.equal(resolveAttention(event({dueAt:"2026-10-20T12:00:00.000Z"}),now),"none");
});
test("closed work has no attention and blocked/waiting are explicit",()=>{
 assert.equal(resolveAttention(event({status:"completed"}),now),"none");
 assert.equal(resolveAttention(loop({status:"cancelled"}),now),"none");
 assert.equal(resolveAttention(loop({status:"blocked"}),now),"blocked");
 assert.equal(resolveAttention(loop({status:"waiting"}),now),"waiting");
});
test("decision work and critical loops surface operational attention",()=>{
 assert.equal(resolveAttention(event({eventType:"decision"}),now),"needs_decision");
 assert.equal(resolveAttention(loop({type:"decision"}),now),"needs_decision");
 const critical=resolveAttentionDetailed(loop({priority:"critical"}),now);
 assert.equal(critical.state,"at_risk");
 assert.equal(critical.priority,4);
});
test("open work without a deadline remains visible as unresolved",()=>{
 const result=resolveAttentionDetailed(event(),now);
 assert.equal(result.state,"unresolved");
 assert.match(result.reason,/No due date/);
});
