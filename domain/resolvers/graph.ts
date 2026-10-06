import type {BaseEntity,LifeOSDatabase,Relationship} from "@/domain/contracts/database";
export interface GraphNode{id:string;type:string;label:string}
export interface GraphEdge{from:GraphNode;to:GraphNode;relationship:Relationship["relationshipType"]}
function label(entity:BaseEntity):string{
 switch(entity.entityType){
  case "event": return entity.title;
  case "open_loop": return entity.title;
  case "person": return entity.displayName;
  case "asset": return entity.name;
  case "financial_account": return entity.name;
  case "financial_transaction": return entity.description??entity.merchant??entity.transactionDate;
  case "loan": return entity.name;
  case "loan_payment": return `Loan payment · ${entity.scheduledDate}`;
  case "vehicle": return [entity.year,entity.make,entity.model].filter(Boolean).join(" ")||"Vehicle";
  case "vehicle_maintenance": return entity.serviceType;
  case "property": return entity.name;
  case "room": return entity.name;
  case "home_system": return entity.name;
  case "electrical_device": return entity.name;
  case "project": return entity.name;
  case "goal": return entity.name;
  case "decision": return entity.question;
  case "document": return entity.name;
  case "recurring_rule": return entity.name;
  case "relationship": return `${entity.relationshipType.replaceAll("_"," ")} relationship`;
  case "audit": return `${entity.action} · ${entity.targetType}`;
  default: return entity.entityType.replaceAll("_"," ");
 }
}
function collect(db:LifeOSDatabase):Map<string,GraphNode>{const map=new Map<string,GraphNode>();const collections:BaseEntity[][]=[db.entities,db.relationships,db.events,db.openLoops,db.people,db.assets,db.accounts,db.transactions,db.loans,db.loanPayments,db.vehicles,db.vehicleMaintenance,db.properties,db.rooms,db.homeSystems,db.electricalDevices,db.projects,db.goals,db.decisions,db.documents,db.recurringRules,db.auditEntries];collections.flat().forEach(entity=>map.set(entity.id,{id:entity.id,type:entity.entityType,label:label(entity)}));return map}
export function resolveGraph(db:LifeOSDatabase,centerId:string):{center:GraphNode|null;nodes:GraphNode[];edges:GraphEdge[]}{const all=collect(db);const rels=db.relationships.filter(r=>r.fromId===centerId||r.toId===centerId);const ids=new Set<string>([centerId]);rels.forEach(r=>{ids.add(r.fromId);ids.add(r.toId)});const nodes=[...ids].map(id=>all.get(id)).filter((x):x is GraphNode=>Boolean(x));const edges=rels.map(r=>{const from=all.get(r.fromId);const to=all.get(r.toId);return from&&to?{from,to,relationship:r.relationshipType}:null}).filter((x):x is GraphEdge=>Boolean(x));return{center:all.get(centerId)??null,nodes,edges}}
