import type {Attachment,AttachmentEntityType,LifeOSDatabase} from "@/domain/contracts/database";

const now=()=>new Date().toISOString();
const id=()=>`att-${crypto.randomUUID()}`;

export function createAttachmentStoragePath(input:{attachmentId:string;entityType:AttachmentEntityType;entityId:string;name:string}):string{
 const safeName=input.name.trim().replace(/[^a-zA-Z0-9._-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,120)||"attachment";
 return `Attachments/${input.entityType}/${input.entityId}/${input.attachmentId}-${safeName}`;
}

export function createAttachmentRecord(input:Omit<Attachment,"id"|"entityType"|"createdAt"|"updatedAt">):Attachment{
 const t=now();
 const attachmentId=id();
 const primaryLink=input.linkedEntities[0];
 return { ...input,id:attachmentId,entityType:"attachment",storagePath:input.storagePath??(primaryLink?createAttachmentStoragePath({attachmentId,entityType:primaryLink.entityType,entityId:primaryLink.entityId,name:input.name}):undefined),createdAt:t,updatedAt:t };
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
