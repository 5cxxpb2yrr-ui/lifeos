import type {BaseEntity,LifeOSDatabase,Relationship,RelationshipType} from "@/domain/contracts/database";
export interface GraphNode{id:string;type:string;label:string}
export interface GraphEdge{from:GraphNode;to:GraphNode;relationship:Relationship["relationshipType"];derived?:boolean}

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

function collect(db:LifeOSDatabase):Map<string,GraphNode>{
 const map=new Map<string,GraphNode>();
 const collections:BaseEntity[][]=[
  db.entities,db.relationships,db.events,db.openLoops,db.people,db.assets,db.accounts,db.transactions,
  db.loans,db.loanPayments,db.vehicles,db.vehicleMaintenance,db.properties,db.rooms,db.homeSystems,
  db.electricalDevices,db.projects,db.goals,db.decisions,db.documents,db.recurringRules,db.auditEntries,
  ...(db.attachments??[])
 ];
 collections.flat().forEach(entity=>map.set(entity.id,{id:entity.id,type:entity.entityType,label:label(entity)}));
 return map;
}

const RELATION_BY_KEY:Record<string,RelationshipType>={
 vehicleId:"maintenance_for",
 loanId:"payment_for",
 propertyId:"located_in",
 roomId:"located_in",
 eventId:"related_to",
 accountId:"paid_by",
 categoryId:"related_to",
 projectId:"part_of",
 goalId:"supports",
 personId:"assigned_to",
 personIds:"assigned_to",
 assetId:"owns",
 assetIds:"uses",
 openLoopIds:"related_to",
 projectIds:"part_of",
 goalIds:"supports",
 documentIds:"documents",
 decisionIds:"related_to",
 financialTransactionIds:"related_to",
 relatedEventIds:"related_to",
 relatedProjectIds:"part_of",
 relatedDecisionIds:"related_to"
};

function derivedEdges(db:LifeOSDatabase,centerId:string,all:Map<string,GraphNode>):GraphEdge[]{
 const source=[...all.values()].map(node=>node.id===centerId?findEntity(db,node.id):findEntity(db,node.id)).filter((x):x is BaseEntity=>Boolean(x));
 const edges:GraphEdge[]=[];
 const push=(from:BaseEntity,toId:string,key:string)=>{
  if(!toId||toId===from.id||!all.has(toId))return;
  const to=all.get(toId);const fromNode=all.get(from.id);if(!to||!fromNode)return;
  const relationship=RELATION_BY_KEY[key]??"related_to";
  edges.push({from:fromNode,to,relationship,derived:true});
 };
 for(const entity of source){
  const e=entity as BaseEntity & Record<string,unknown>;
  for(const [key,value] of Object.entries(e)){
   if(key==="metadata"||key==="id"||key==="entityType")continue;
   if(typeof value==="string"&&/Id$/.test(key))push(entity,value,key);
   else if(Array.isArray(value)&&/Ids$/.test(key))for(const id of value)if(typeof id==="string")push(entity,id,key);
  }
 }
 return edges;
}

function findEntity(db:LifeOSDatabase,id:string):BaseEntity|undefined{
 const collections:BaseEntity[][]=[
  db.entities,db.relationships,db.events,db.openLoops,db.people,db.assets,db.accounts,db.transactions,
  db.loans,db.loanPayments,db.vehicles,db.vehicleMaintenance,db.properties,db.rooms,db.homeSystems,
  db.electricalDevices,db.projects,db.goals,db.decisions,db.documents,db.recurringRules,db.auditEntries,
  ...(db.attachments??[])
 ];
 for(const collection of collections){const found=collection.find(x=>x.id===id);if(found)return found;}
 return undefined;
}

export function resolveGraph(db:LifeOSDatabase,centerId:string):{center:GraphNode|null;nodes:GraphNode[];edges:GraphEdge[]}{
 const all=collect(db);
 const explicit=db.relationships.filter(r=>r.fromId===centerId||r.toId===centerId);
 const explicitEdges=explicit.map(r=>{const from=all.get(r.fromId);const to=all.get(r.toId);return from&&to?{from,to,relationship:r.relationshipType,derived:false}:null}).filter((x):x is GraphEdge=>Boolean(x));
 const derived=derivedEdges(db,centerId,all);
 const seen=new Set<string>();
 const edges=[...explicitEdges,...derived].filter(edge=>{const key=`${edge.from.id}|${edge.to.id}|${edge.relationship}`;if(seen.has(key))return false;seen.add(key);return true});
 const ids=new Set<string>([centerId]);edges.forEach(edge=>{ids.add(edge.from.id);ids.add(edge.to.id)});
 const nodes=[...ids].map(id=>all.get(id)).filter((x):x is GraphNode=>Boolean(x));
 return{center:all.get(centerId)??null,nodes,edges};
}
