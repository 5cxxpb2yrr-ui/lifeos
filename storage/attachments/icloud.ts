import type {Attachment,AttachmentEntityType} from "@/domain/contracts/database";

export const ICLOUD_ATTACHMENT_ROOT="iCloud Drive/LifeOS/Attachments";
export const ICLOUD_VEHICLE_MANUAL_ROOT="iCloud Drive/LifeOS/Vehicle Manuals";

export function createICloudAttachmentPath(input:{
 attachmentId:string;
 entityType:AttachmentEntityType;
 entityId:string;
 name:string;
}):string{
 const safeName=input.name.trim()
  .replace(/[^a-zA-Z0-9._-]+/g,"-")
  .replace(/^-+|-+$/g,"")
  .slice(0,120)||"attachment";
 return `${ICLOUD_ATTACHMENT_ROOT}/${input.entityType}/${input.entityId}/${input.attachmentId}-${safeName}`;
}

export function iCloudPathForAttachment(attachment:Attachment):string{
 if(attachment.storagePath)return attachment.storagePath;
 const link=attachment.linkedEntities[0];
 return link
  ? createICloudAttachmentPath({
      attachmentId:attachment.id,
      entityType:link.entityType,
      entityId:link.entityId,
      name:attachment.name,
    })
  : `${ICLOUD_ATTACHMENT_ROOT}/other/${attachment.id}-${attachment.name}`;
}

export function iCloudVehicleManualPath(input:{
 year:number;
 make:string;
 model:string;
 archiveFileName:string;
}):string{
 const folder=`${input.year} ${input.make} ${input.model}`.trim();
 return `${ICLOUD_VEHICLE_MANUAL_ROOT}/${folder}/${input.archiveFileName}`;
}

export function isICloudShareUrl(value?:string):boolean{
 return Boolean(value && /^https?:\/\//i.test(value));
}

/**
 * Opens the iCloud/Files ecosystem when the platform exposes the Files app.
 * This is best-effort only; no server-side iCloud authentication is implied.
 */
export function openICloudFiles():void{
 if(typeof window==="undefined")return;
 window.open("https://www.icloud.com/iclouddrive/","_blank","noopener,noreferrer");
}
