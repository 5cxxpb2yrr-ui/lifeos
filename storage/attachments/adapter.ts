import type {Attachment} from "@/domain/contracts/database";
import {createPreviewUrl,revokePreviewUrl} from "@/domain/services/attachments";

export interface AttachmentStorageAdapter{
 provider:Attachment["storageProvider"];
 createPreview(file:File):string;
 revokePreview(url:string):void;
 resolveUrl(attachment:Attachment):string|null;
}

export const browserSessionAttachmentAdapter:AttachmentStorageAdapter={
 provider:"browser-session",
 createPreview:createPreviewUrl,
 revokePreview:revokePreviewUrl,
 resolveUrl:attachment=>attachment.storageReference?.startsWith("http")?attachment.storageReference:null,
};

export const externalUrlAttachmentAdapter:AttachmentStorageAdapter={
 provider:"external-url",
 createPreview:()=>"",
 revokePreview:()=>undefined,
 resolveUrl:attachment=>attachment.storageReference??null,
};

export const r2AttachmentAdapter:AttachmentStorageAdapter={
 provider:"cloudflare-r2",
 createPreview:createPreviewUrl,
 revokePreview:revokePreviewUrl,
 resolveUrl:attachment=>attachment.storageReference??null,
};
