import type {Attachment} from "@/domain/contracts/database";

// Same-origin Pages Function. The private Worker remains the only component
// with direct access to the private R2 bucket.
export const LIFEOS_R2_ATTACHMENT_ENDPOINT="/api/attachments";

const endpointFor=(storagePath:string)=>`${LIFEOS_R2_ATTACHMENT_ENDPOINT}/${storagePath.split("/").map(encodeURIComponent).join("/")}`;

async function assertOk(response:Response):Promise<Response>{
 if(response.ok)return response;
 if(response.status===401||response.status===403)throw new Error("LifeOS attachment storage authentication is required. Sign in and retry.");
 throw new Error(`Attachment storage request failed (${response.status}).`);
}

export async function uploadR2Attachment(file:File,attachment:Attachment):Promise<{key:string;etag?:string}>{
 if(!attachment.storagePath)throw new Error("Attachment storage path is missing.");
 const response=await fetch(endpointFor(attachment.storagePath),{
  method:"PUT",
  credentials:"same-origin",
  headers:{"Content-Type":file.type||"application/octet-stream"},
  body:file,
  cache:"no-store",
 });
 const ok=await assertOk(response);
 return await ok.json() as {key:string;etag?:string};
}

export async function loadR2AttachmentPreview(attachment:Attachment):Promise<string|null>{
 if(!attachment.storagePath)return null;
 const response=await fetch(endpointFor(attachment.storagePath),{method:"GET",credentials:"same-origin",cache:"no-store"});
 if(response.status===404)return null;
 const ok=await assertOk(response);
 return URL.createObjectURL(await ok.blob());
}

export async function deleteR2Attachment(attachment:Attachment):Promise<void>{
 if(!attachment.storagePath)return;
 await assertOk(await fetch(endpointFor(attachment.storagePath),{method:"DELETE",credentials:"same-origin",cache:"no-store"}));
}
