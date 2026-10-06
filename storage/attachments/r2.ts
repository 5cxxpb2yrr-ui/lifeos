import type {Attachment} from "@/domain/contracts/database";

export const LIFEOS_R2_ATTACHMENT_ENDPOINT="https://lifeos-attachments.phillipstg.workers.dev";

const endpointFor=(storagePath:string)=>`${LIFEOS_R2_ATTACHMENT_ENDPOINT}/${storagePath.split("/").map(encodeURIComponent).join("/")}`;

async function assertOk(response:Response):Promise<Response>{
 if(response.ok)return response;
 if(response.status===401||response.status===403)throw new Error("LifeOS attachment storage authentication is required.");
 throw new Error(`Attachment storage request failed (${response.status}).`);
}

export async function uploadR2Attachment(file:File,attachment:Attachment):Promise<{key:string;etag?:string}>{
 if(!attachment.storagePath)throw new Error("Attachment storage path is missing.");
 const response=await fetch(endpointFor(attachment.storagePath),{
  method:"PUT",
  credentials:"include",
  headers:{"Content-Type":file.type||"application/octet-stream"},
  body:file,
 });
 const ok=await assertOk(response);
 return await ok.json() as {key:string;etag?:string};
}

export async function loadR2AttachmentPreview(attachment:Attachment):Promise<string|null>{
 if(!attachment.storagePath)return null;
 const response=await fetch(endpointFor(attachment.storagePath),{method:"GET",credentials:"include"});
 if(response.status===404)return null;
 const ok=await assertOk(response);
 return URL.createObjectURL(await ok.blob());
}

export async function deleteR2Attachment(attachment:Attachment):Promise<void>{
 if(!attachment.storagePath)return;
 await assertOk(await fetch(endpointFor(attachment.storagePath),{method:"DELETE",credentials:"include"}));
}
