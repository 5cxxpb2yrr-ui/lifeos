import type {Event,OpenLoop,LifeOSDatabase} from "@/domain/contracts/database";
import {resolveAttentionDetailed} from "./attention";

export interface AttentionItem {
 id:string; sourceType:string; sourceId:string; title:string; attention:string;
 dueAt?:string; priority?:number; reason?:string;
}
export interface MissionControlViewModel {
 attention:AttentionItem[]; today:Event[]; openLoops:OpenLoop[];
 finance:{accounts:number;loans:number;upcomingPayments:number};
 assets:{vehicles:number;properties:number}; recent:Event[];
}
function localDay(date:Date):string {
 return date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0");
}
function eventDay(e:Event):string|undefined {
 const value=e.startAt??e.dueAt??e.occurredAt;
 return value ? localDay(new Date(value)) : undefined;
}
export function resolveMissionControl(db:LifeOSDatabase,now=new Date()):MissionControlViewModel {
 const attention:AttentionItem[]=[
  ...db.events.map(e=>{const r=resolveAttentionDetailed(e,now);return{id:e.id,sourceType:"event",sourceId:e.id,title:e.title,attention:r.state,dueAt:e.dueAt,priority:r.priority,reason:r.reason};}),
  ...db.openLoops.map(o=>{const r=resolveAttentionDetailed(o,now);const p=o.priority==="critical"?5:o.priority==="high"?4:o.priority==="normal"?2:1;return{id:o.id,sourceType:"open_loop",sourceId:o.id,title:o.title,attention:r.state,dueAt:o.dueAt,priority:Math.max(r.priority,p),reason:r.reason};})
 ].filter(x=>x.attention!=="none").sort((a,b)=>(b.priority??0)-(a.priority??0)||((a.dueAt??"").localeCompare(b.dueAt??"")));
 const today=db.events.filter(e=>eventDay(e)===localDay(now));
 return{
  attention,
  today,
  openLoops:db.openLoops.filter(o=>!["resolved","cancelled"].includes(o.status)),
  finance:{accounts:db.accounts.length,loans:db.loans.length,upcomingPayments:db.loanPayments.filter(p=>p.status==="scheduled").length},
  assets:{vehicles:db.vehicles.length,properties:db.properties.length},
  recent:[...db.events].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,8)
 };
}
