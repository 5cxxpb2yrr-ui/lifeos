import type {AttentionState,Event,OpenLoop} from "@/domain/contracts/database";
export function resolveAttention(item:Event|OpenLoop):AttentionState{
  if("status" in item&&(item.status==="completed"||item.status==="cancelled"||item.status==="resolved"))return"none";
  if("status" in item&&item.status==="blocked")return"blocked";if("status" in item&&item.status==="waiting")return"waiting";
  const due="dueAt" in item?item.dueAt:undefined;if(!due)return"unresolved";
  const delta=new Date(due).getTime()-Date.now();if(delta<0)return"overdue";if(delta<=86400000)return"due_today";if(delta<=604800000)return"due_soon";return"none";
}