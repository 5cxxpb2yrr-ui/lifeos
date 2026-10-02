import type {Event,OpenLoop,LifeOSDatabase} from "@/domain/contracts/database";import{resolveAttention}from"./attention";
export interface AttentionItem{id:string;sourceType:string;sourceId:string;title:string;attention:string;dueAt?:string}
export interface MissionControlViewModel{attention:AttentionItem[];today:Event[];openLoops:OpenLoop[];finance:{accounts:number;loans:number;upcomingPayments:number};assets:{vehicles:number;properties:number};recent:Event[]}
export function resolveMissionControl(db:LifeOSDatabase):MissionControlViewModel{
 const attention=[...db.events.map(e=>({id:e.id,sourceType:"event",sourceId:e.id,title:e.title,attention:resolveAttention(e),dueAt:e.dueAt})),...db.openLoops.map(o=>({id:o.id,sourceType:"open_loop",sourceId:o.id,title:o.title,attention:resolveAttention(o),dueAt:o.dueAt}))].filter(x=>x.attention!=="none");
 const day=new Date().toISOString().slice(0,10);const today=db.events.filter(e=>(e.startAt??e.dueAt??e.occurredAt??"").slice(0,10)===day);
 return{attention,today,openLoops:db.openLoops.filter(o=>!["resolved","cancelled"].includes(o.status)),finance:{accounts:db.accounts.length,loans:db.loans.length,upcomingPayments:db.loanPayments.length},assets:{vehicles:db.vehicles.length,properties:db.properties.length},recent:[...db.events].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,6)}
}