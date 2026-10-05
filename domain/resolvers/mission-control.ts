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
function paymentAttention(scheduledDate:string,now:Date):{state:string;priority:number;reason:string} {
 const due=new Date(scheduledDate+"T23:59:59");
 const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
 const dueDay=new Date(due.getFullYear(),due.getMonth(),due.getDate());
 const days=Math.ceil((dueDay.getTime()-today.getTime())/86400000);
 if(days<0)return{state:"overdue",priority:6,reason:"Financial payment is past due."};
 if(days===0)return{state:"due_today",priority:5,reason:"Financial payment is due today."};
 if(days<=3)return{state:"due_soon",priority:4,reason:"Financial payment is due within 3 days."};
 if(days<=7)return{state:"due_soon",priority:3,reason:"Financial payment is due within 7 days."};
 return{state:"none",priority:0,reason:""};
}
export function resolveMissionControl(db:LifeOSDatabase,now=new Date()):MissionControlViewModel {
 const attention:AttentionItem[]=[
  ...db.events.map(e=>{const r=resolveAttentionDetailed(e,now);return{id:e.id,sourceType:"event",sourceId:e.id,title:e.title,attention:r.state,dueAt:e.dueAt,priority:r.priority,reason:r.reason};}),
  ...db.openLoops.map(o=>{const r=resolveAttentionDetailed(o,now);const p=o.priority==="critical"?5:o.priority==="high"?4:o.priority==="normal"?2:1;return{id:o.id,sourceType:"open_loop",sourceId:o.id,title:o.title,attention:r.state,dueAt:o.dueAt,priority:Math.max(r.priority,p),reason:r.reason};}),
  ...db.loanPayments.filter(p=>p.status==="scheduled"||p.status==="partial").flatMap(p=>{
   const r=paymentAttention(p.scheduledDate,now);
   if(r.state==="none")return [];
   const loan=db.loans.find(l=>l.id===p.loanId);
   const remaining=Math.max(0,p.scheduledAmountMinor-(p.paidAmountMinor??0));
   const amount=(remaining/100).toLocaleString(undefined,{style:"currency",currency:loan?.currency??"USD"});
   return [{id:"financial-payment:"+p.id,sourceType:"financial_payment",sourceId:p.id,title:"Payment due · "+(loan?.name??"Loan"),attention:r.state,dueAt:p.scheduledDate+"T23:59:59",priority:r.priority,reason:r.reason+" "+amount+" remaining."}];
  })
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
