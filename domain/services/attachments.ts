import type {Attachment,AttachmentEntityType,LifeOSDatabase} from "@/domain/contracts/database";

const now=()=>new Date().toISOString();
const id=()=>`att-${crypto.randomUUID()}`;

export function createAttachmentRecord(input:Omit<Attachment,"id"|"entityType"|"createdAt"|"updatedAt">):Attachment{
 const t=now();
 return { ...input,id:id(),entityType:"attachment",createdAt:t,updatedAt:t };
}

export function addAttachment(db:LifeOSDatabase,attachment:Attachment):LifeOSDatabase{
 return {...db,attachments:[...(db.attachments??[]),attachment]};
}

export function updateAttachment(db:LifeOSDatabase,attachmentId:string,changes:Partial<Attachment>):LifeOSDatabase{
 const attachments=(db.attachments??[]).map(item=>item.id===attachmentId?{...item,...changes,updatedAt:now()}:item);
 return {...db,attachments};
}

export function removeAttachment(db:LifeOSDatabase,attachmentId:string):LifeOSDatabase{
 return {...db,attachments:(db.attachments??[]).filter(item=>item.id!==attachmentId)};
}

export function attachmentsForEntity(db:LifeOSDatabase,entityId:string,entityType?:AttachmentEntityType):Attachment[]{
 return (db.attachments??[]).filter(item=>item.linkedEntities.some(link=>link.entityId===entityId&&(!entityType||link.entityType===entityType))&&!item.archivedAt).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
}

export function createPreviewUrl(file:File):string{return URL.createObjectURL(file)};
export function revokePreviewUrl(url:string):void{if(url.startsWith("blob:"))URL.revokeObjectURL(url)};

export function attachmentKind(mimeType?:string):"image"|"pdf"|"document"|"other"{
 if(mimeType?.startsWith("image/"))return "image";
 if(mimeType==="application/pdf")return "pdf";
 if(mimeType?.startsWith("text/")||mimeType?.includes("word")||mimeType?.includes("document"))return "document";
 return "other";
}
