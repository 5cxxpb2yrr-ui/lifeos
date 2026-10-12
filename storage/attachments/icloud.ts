import type {Attachment,AttachmentEntityType} from "@/domain/contracts/database";

export const ICLOUD_ATTACHMENT_ROOT="iCloud Drive/LifeOS/Attachments";
export const ICLOUD_LIFEOS_ROOT="iCloud Drive/LifeOS";
export const ICLOUD_SHORTCUT_NAME="LifeOS iCloud Bridge";
export const ICLOUD_BRIDGE_VERSION="1";

export type ICloudBridgeAction="open"|"store"|"retrieve";

export interface ICloudBridgeRequest{
 version:string;
 provider:"icloud";
 access:"private-user-owned";
 action:ICloudBridgeAction;
 rootPath:string;
 path?:string;
 attachmentId?:string;
}

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

export function createICloudBridgeRequest(input:{
 action:ICloudBridgeAction;
 path?:string;
 attachmentId?:string;
}):ICloudBridgeRequest{
 return {
  version:ICLOUD_BRIDGE_VERSION,
  provider:"icloud",
  access:"private-user-owned",
  action:input.action,
  rootPath:ICLOUD_LIFEOS_ROOT,
  ...(input.path?{path:input.path}:{}),
  ...(input.attachmentId?{attachmentId:input.attachmentId}:{}),
 };
}

export function isICloudBridgeRequest(value:unknown):value is ICloudBridgeRequest{
 if(!value||typeof value!=="object")return false;
 const request=value as Partial<ICloudBridgeRequest>;
 return request.version===ICLOUD_BRIDGE_VERSION
  && request.provider==="icloud"
  && request.access==="private-user-owned"
  && ["open","store","retrieve"].includes(request.action)
  && request.rootPath===ICLOUD_LIFEOS_ROOT;
}

export function openICloudFiles(request=createICloudBridgeRequest({action:"open"})):void{
 if(typeof window==="undefined")return;
 const input=encodeURIComponent(JSON.stringify(request));
 const shortcutUrl=`shortcuts://run-shortcut?name=${encodeURIComponent(ICLOUD_SHORTCUT_NAME)}&input=text&text=${input}`;
 window.location.href=shortcutUrl;
}

/**
 * LifeOS never needs an iCloud share URL for private storage.
 * The Apple Shortcut owns authentication/access to the user's iCloud Drive.
 */
export function iCloudPrivateStorageConfig(){
 return {
  provider:"icloud" as const,
  access:"private-user-owned" as const,
  rootPath:ICLOUD_LIFEOS_ROOT,
  attachmentRoot:ICLOUD_ATTACHMENT_ROOT,
  shortcutName:ICLOUD_SHORTCUT_NAME,
  bridgeVersion:ICLOUD_BRIDGE_VERSION,
 };
}
