import type {BaseEntity,LifeOSDatabase,Relationship} from "@/domain/contracts/database";
export interface GraphNode{id:string;type:string;label:string}
export interface GraphEdge{from:GraphNode;to:GraphNode;relationship:Relationship["relationshipType"]}
function label(entity:BaseEntity):string{
 const e=entity as BaseEntity & Record<string,unknown>;
 switch(entity.entityType){
  case "event": return typeof e.title==="string"?e.title:"Event";
  case "open_loop": return typeof e.title==="string"?e.title:"Open loop";
  case "person": return typeof e.displayName==="string"?e.displayName:"Person";
  case "asset": return typeof e.name==="string"?e.name:"Asset";
  case "financial_account": return typeof e.name==="string"?e.name:"Account";
  case "financial_transaction": return typeof e.description==="string"?e.description:typeof e.merchant==="string"?e.merchant:typeof e.transactionDate==="string"?e.transactionDate:"Transaction";
  case "loan": return typeof e.name==="string"?e.name:"Loan";
  case "loan_payment": return typeof e.scheduledDate==="string"?`Loan payment · ${e.scheduledDate}`:"Loan payment";
  case "vehicle": return [e.year,e.make,e.model].filter(x=>x!==undefined&&x!==null&&x!=="").join(" ")||"Vehicle";
  case "vehicle_maintenance": return typeof e.serviceType==="string"?e.serviceType:"Vehicle maintenance";
  case "property": return typeof e.name==="string"?e.name:"Property";
  case "room": return typeof e.name==="string"?e.name:"Room";
  case "home_system": return typeof e.name==="string"?e.name:"Home system";
  case "electrical_device": return typeof e.name==="string"?e.name:"Electrical device";
  case "project": return typeof e.name==="string"?e.name:"Project";
  case "goal": return typeof e.name==="string"?e.name:"Goal";
  case "decision": return typeof e.question==="string"?e.question:"Decision";
  case "document": return typeof e.name==="string"?e.name:"Document";
  case "recurring_rule": return typeof e.name==="string"?e.name:"Recurring rule";
  case "relationship": return typeof e.relationshipType==="string"?`${e.relationshipType.replaceAll("_"," ")} relationship`:"Relationship";
  case "audit": return typeof e.action==="string"?`${e.action} · ${typeof e.targetType==="string"?e.targetType:"record"}`:"Audit entry";
  default: return entity.entityType.replaceAll("_"," ");
 }
}
function collect(db:LifeOSDatabase):Map<string,GraphNode>{const map=new Map<string,GraphNode>();const collections:BaseEntity[][]=[db.entities,db.relationships,db.events,db.openLoops,db.people,db.assets,db.accounts,db.transactions,db.loans,db.loanPayments,db.vehicles,db.vehicleMaintenance,db.properties,db.rooms,db.homeSystems,db.electricalDevices,db.projects,db.goals,db.decisions,db.documents,db.recurringRules,db.auditEntries];collections.flat().forEach(entity=>map.set(entity.id,{id:entity.id,type:entity.entityType,label:label(entity)}));return map}
export function resolveGraph(db:LifeOSDatabase,centerId:string):{center:GraphNode|null;nodes:GraphNode[];edges:GraphEdge[]}{const all=collect(db);const rels=db.relationships.filter(r=>r.fromId===centerId||r.toId===centerId);const ids=new Set<string>([centerId]);rels.forEach(r=>{ids.add(r.fromId);ids.add(r.toId)});const nodes=[...ids].map(id=>all.get(id)).filter((x):x is GraphNode=>Boolean(x));const edges=rels.map(r=>{const from=all.get(r.fromId);const to=all.get(r.toId);return from&&to?{from,to,relationship:r.relationshipType}:null}).filter((x):x is GraphEdge=>Boolean(x));return{center:all.get(centerId)??null,nodes,edges}}
