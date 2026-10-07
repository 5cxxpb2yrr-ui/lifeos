import assert from "node:assert/strict";
import test from "node:test";
import {resolveCashPressure,resolveCashPressureAttention} from "../domain/resolvers/cash-pressure.ts";
import type {CashForecastView} from "../domain/resolvers/cash-forecast.ts";

const forecast=(lowest:number,lowestDate="2026-10-12",firstNegativeDate?:string):CashForecastView=>({
 startDate:"2026-10-07",endDate:"2026-10-20",startingBalanceMinor:50000,endingBalanceMinor:lowest,
 lowestBalanceMinor:lowest,lowestBalanceDate:lowestDate,firstNegativeDate,
 totalInflowsMinor:100000,totalOutflowsMinor:100000,points:[]
});

test("healthy stays out of attention",()=>{
 const view=resolveCashPressure(forecast(60000),{reserveMinor:25000,watchBufferMinor:25000});
 assert.equal(view.state,"healthy");
 assert.equal(view.attention,"none");
 assert.equal(view.priority,0);
});

test("watch means balance is above reserve but inside the watch buffer",()=>{
 const view=resolveCashPressure(forecast(40000),{reserveMinor:25000,watchBufferMinor:25000});
 assert.equal(view.state,"watch");
 assert.equal(view.attention,"at_risk");
 assert.equal(view.priority,3);
 assert.equal(view.watchThresholdMinor,50000);
});

test("constrained means balance drops below reserve but remains non-negative",()=>{
 const view=resolveCashPressure(forecast(15000),{reserveMinor:25000,watchBufferMinor:25000});
 assert.equal(view.state,"constrained");
 assert.equal(view.attention,"at_risk");
 assert.equal(view.priority,4);
});

test("negative takes highest priority and points attention at the first negative date",()=>{
 const view=resolveCashPressure(forecast(-5000,"2026-10-13","2026-10-13"),{reserveMinor:25000,watchBufferMinor:25000});
 assert.equal(view.state,"negative");
 assert.equal(view.attention,"at_risk");
 assert.equal(view.priority,5);
 const attention=resolveCashPressureAttention(forecast(-5000,"2026-10-13","2026-10-13"),{reserveMinor:25000,watchBufferMinor:25000,sourceId:"household-cash",title:"Household cash pressure"});
 assert.equal(attention.id,"cash-pressure:household-cash");
 assert.equal(attention.dueAt,"2026-10-13T00:00:00.000Z");
 assert.equal(attention.priority,5);
 assert.equal(attention.context?.state,"negative");
});

test("watch/constrained attention points at the forecast low rather than inventing a negative date",()=>{
 const attention=resolveCashPressureAttention(forecast(15000,"2026-10-12"),{reserveMinor:25000,watchBufferMinor:25000});
 assert.equal(attention.dueAt,"2026-10-12T00:00:00.000Z");
 assert.equal(attention.priority,4);
});
