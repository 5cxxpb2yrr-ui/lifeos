import type {LifeOSDatabase}from"@/domain/contracts/database";const stamp=new Date().toISOString();const future=(days:number)=>new Date(Date.now()+days*86400000).toISOString();
export const demoDatabase:LifeOSDatabase={schemaVersion:"2.0.0",seedVersion:"UNSET-REAL-SEED",appVersion:"0.1.0",entities:[],relationships:[],people:[],assets:[],transactions:[],loanPayments:[],vehicleMaintenance:[],rooms:[],homeSystems:[],electricalDevices:[],projects:[],goals:[],decisions:[],documents:[],recurringRules:[],auditEntries:[],events:[
{id:"demo-event-1",entityType:"event",createdAt:stamp,updatedAt:stamp,eventType:"appointment",title:"Mission Control review",status:"scheduled",startAt:future(0),dueAt:future(0)},
{id:"demo-event-2",entityType:"event",createdAt:stamp,updatedAt:stamp,eventType:"payment",title:"Upcoming payment review",status:"planned",dueAt:future(2)},
{id:"demo-event-3",entityType:"event",createdAt:stamp,updatedAt:stamp,eventType:"maintenance",title:"Vehicle maintenance check",status:"planned",dueAt:future(6)}],
openLoops:[
{id:"demo-loop-1",entityType:"open_loop",createdAt:stamp,updatedAt:stamp,title:"Connect Full Life Control seed",type:"task",status:"open",priority:"critical",dueAt:future(1)},
{id:"demo-loop-2",entityType:"open_loop",createdAt:stamp,updatedAt:stamp,title:"Review upcoming financial commitments",type:"follow_up",status:"open",priority:"high",dueAt:future(3)}],
accounts:[{id:"demo-account",entityType:"financial_account",createdAt:stamp,updatedAt:stamp,name:"Local Financial Ledger",accountType:"checking",currency:"USD"}],loans:[],vehicles:[],properties:[],
metadata:{databaseId:"demo",schemaVersion:"2.0.0",seedVersion:"UNSET-REAL-SEED",appVersion:"0.1.0",createdAt:stamp,updatedAt:stamp}}