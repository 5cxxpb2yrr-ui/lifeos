import type {Attachment,AttachmentEntityType} from "@/domain/contracts/database";

/**
 * iCloud Drive is intentionally modeled as a user-owned storage provider.
 * Safari/Next.js cannot directly authenticate to or write arbitrary iCloud
 * Drive files, so LifeOS stores a deterministic destination path plus an
 * optional user/Shortcuts-provided share URL.
 */
export const ICLOUD_ATTACHMENT_ROOT="iCloud Drive/LifeOS/Attachments";

/**
 * User-provided shared LifeOS folder.
 *
 * This is operational configuration/provenance, not immutable seed data.
 * The folder remains user-owned in iCloud; LifeOS stores only the share URL.
 */
export const ICLOUD_LIFEOS_ROOT_SHARE_URL="https://www.icloud.com/iclouddrive/0c9jS3GfMmtVhCgR6vEkbidOQ";

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

export function isICloudShareUrl(value?:string):boolean{
 return Boolean(value && /^https?:\\/\\//i.test(value));
}

/** Returns the user-provided LifeOS folder share URL for UI/Shortcuts integrations. */
export function iCloudLifeOSFolderShareUrl():string{
 return ICLOUD_LIFEOS_ROOT_SHARE_URL;
}

/**
 * Opens the iCloud/Files ecosystem when the platform exposes the Files app.
 * This is best-effort only; no server-side iCloud authentication is implied.
 */
export function openICloudFiles():void{
 if(typeof window==="undefined")return;
 window.open(ICLOUD_LIFEOS_ROOT_SHARE_URL,"_blank","noopener,noreferrer");
}
