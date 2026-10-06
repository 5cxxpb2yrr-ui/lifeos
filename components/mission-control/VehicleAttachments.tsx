"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import type {LifeOSDatabase} from "@/domain/contracts/database";
import {addAttachment,attachmentKind,attachmentsForEntity,createAttachmentRecord,removeAttachment} from "@/domain/services/attachments";
import {deleteR2Attachment,loadR2AttachmentPreview,uploadR2Attachment} from "@/storage/attachments/r2";
import {browserSessionAttachmentAdapter,externalUrlAttachmentAdapter} from "@/storage/attachments/adapter";
import {createICloudAttachmentPath,openICloudFiles} from "@/storage/attachments/icloud";

export default function VehicleAttachments({db,vehicle,onPersist}:{db:LifeOSDatabase;vehicle:LifeOSDatabase["vehicles"][number];onPersist:(next:LifeOSDatabase,message:string)=>void}){
 const attachments=useMemo(()=>attachmentsForEntity(db,vehicle.id,"vehicle"),[db,vehicle.id]);
 const [selected,setSelected]=useState<string|null>(null);
 const [file,setFile]=useState<File|null>(null);
 const [url,setUrl]=useState("");
 const [icloudPath,setIcloudPath]=useState("");
 const [icloudShareUrl,setIcloudShareUrl]=useState("");
 const [name,setName]=useState("");
 const [category,setCategory]=useState<"manual"|"service_record"|"receipt"|"photo"|"other">("manual");
 const [uploading,setUploading]=useState(false);
 const [previewUrls,setPreviewUrls]=useState<Record<string,string>>({});
 const previewUrlsRef=useRef<Record<string,string>>({});
 useEffect(()=>{previewUrlsRef.current=previewUrls},[previewUrls]);
 useEffect(()=>()=>{Object.values(previewUrlsRef.current).forEach(url=>{if(url.startsWith("blob:"))URL.revokeObjectURL(url)})},[]);

 const addICloudReference=()=>{
  const title=name.trim()||"Vehicle document";
  const attachment=createAttachmentRecord({
   name:title,
   mimeType:undefined,
   sizeBytes:undefined,
   storageProvider:"icloud",
   storageReference:icloudShareUrl.trim()||undefined,
   storagePath:icloudPath.trim()||undefined,
   documentType:category,
   tags:["vehicle",category,"icloud"],
   description:category==="manual"?"Vehicle manual / service reference":"Vehicle attachment stored in iCloud Drive",
   linkedEntities:[{entityId:vehicle.id,entityType:"vehicle"}],
  });
  onPersist(addAttachment(db,attachment),"iCloud Drive attachment reference added.");
  setIcloudPath("");setIcloudShareUrl("");setName("");
 };

 const add=async()=>{
  if(!file&&!url.trim())return;
  const title=name.trim()||file?.name||"Vehicle document";
  const mime=file?.type||undefined;
  const attachment=createAttachmentRecord({
   name:title,
   mimeType:mime,
   sizeBytes:file?.size,
   storageProvider:file?"cloudflare-r2":"external-url",
   storageReference:file?undefined:url.trim()||undefined,
   documentType:category,
   tags:["vehicle",category],
   description:category==="manual"?"Vehicle manual / service reference":"Vehicle attachment",
   linkedEntities:[{entityId:vehicle.id,entityType:"vehicle"}],
  });

  if(!file){
   onPersist(addAttachment(db,attachment),"Vehicle attachment added.");
   setUrl("");setName("");
   return;
  }

  setUploading(true);
  try{
   const uploaded=await uploadR2Attachment(file,attachment);
   const preview=await loadR2AttachmentPreview(attachment);
   if(preview)setPreviewUrls(current=>({...current,[attachment.id]:preview}));
   const persisted={...attachment,storageReference:uploaded.key};
   onPersist(addAttachment(db,persisted),"Vehicle attachment uploaded to secure R2 storage.");
   setFile(null);setName("");
  }catch(error){
   const message=error instanceof Error?error.message:"Attachment upload failed.";
   const fallback={...attachment,storageProvider:"browser-session" as const,storageReference:undefined};
   const objectUrl=browserSessionAttachmentAdapter.createPreview(file);
   setPreviewUrls(current=>({...current,[attachment.id]:objectUrl}));
   onPersist(addAttachment(db,fallback),`${message} Saved as a browser-session attachment instead.`);
   setFile(null);setName("");
  }finally{setUploading(false)}
 };

 const deleteAttachment=async(attachmentId:string)=>{
  const item=attachments.find(x=>x.id===attachmentId);
  if(!item)return;
  if(!window.confirm(`Delete “${item.name}” from LifeOS?`))return;
  try{
   if(item.storageProvider==="cloudflare-r2")await deleteR2Attachment(item);
   const preview=previewUrls[attachmentId];
   if(preview)URL.revokeObjectURL(preview);
   setPreviewUrls(current=>{const next={...current};delete next[attachmentId];return next});
   setSelected(null);
   onPersist(removeAttachment(db,attachmentId),"Vehicle attachment deleted.");
  }catch(error){
   window.alert(error instanceof Error?error.message:"Unable to delete the stored attachment.");
  }
 };

 const selectedAttachment=attachments.find(item=>item.id===selected);
 const selectedUrl=selectedAttachment?previewUrls[selectedAttachment.id]||externalUrlAttachmentAdapter.resolveUrl(selectedAttachment):null;

 return <section className="vehicle-attachments card">
  <div className="section-title"><div><div className="kicker">Vehicle Context</div><h3>Attachments</h3></div><span className="badge">{attachments.length}</span></div>
  <p className="row-meta attachment-note">Files stay outside the LifeOS database. R2 stores LifeOS-managed files; iCloud Drive stores user-owned files. LifeOS keeps metadata, a deterministic path, and an optional share reference.</p>
  <div className="attachment-add-grid">
   <label className="field-label">Name<input className="command-input" value={name} onChange={e=>setName(e.target.value)} placeholder="2006 Scion xB Service Manual"/></label>
   <label className="field-label">Category<select className="command-input" value={category} onChange={e=>setCategory(e.target.value as typeof category)}><option value="manual">Manual</option><option value="service_record">Service record</option><option value="receipt">Receipt</option><option value="photo">Photo</option><option value="other">Other</option></select></label>
   <label className="field-label">External storage link<input className="command-input" value={url} onChange={e=>setUrl(e.target.value)} placeholder="iCloud / shared-file URL"/></label>
   <label className="field-label">R2 upload<input className="command-input" type="file" disabled={uploading} onChange={e=>setFile(e.target.files?.[0]??null)}/></label>
   <label className="field-label">iCloud Drive path<input className="command-input" value={icloudPath} onChange={e=>setIcloudPath(e.target.value)} placeholder="Auto-generated LifeOS/Attachments path"/></label>
   <label className="field-label">iCloud share URL<input className="command-input" value={icloudShareUrl} onChange={e=>setIcloudShareUrl(e.target.value)} placeholder="Optional iCloud share link"/></label>
  </div>
  <div className="attachment-actions">
   <button type="button" className="action primary" disabled={uploading||(!file&&!url.trim())} onClick={add}>{uploading?"Uploading…":"＋ Add attachment"}</button>
   <button type="button" className="action" disabled={uploading||(!name.trim()&&!icloudPath.trim()&&!icloudShareUrl.trim())} onClick={addICloudReference}>＋ Add iCloud reference</button>
   <button type="button" className="action" onClick={openICloudFiles}>Open iCloud Drive</button>
  </div>
  {attachments.length?<div className="attachment-grid">{attachments.map(item=>{const kind=attachmentKind(item.mimeType);const preview=previewUrls[item.id];return <button type="button" className="attachment-card" key={item.id} onClick={()=>setSelected(item.id)}><div className="attachment-thumb">{preview&&kind==="image"?<img src={preview} alt=""/>:kind==="image"&&item.storageReference?.startsWith("http")?<img src={item.storageReference} alt=""/>:<span className="attachment-icon">{kind==="pdf"?"PDF":item.documentType?.toUpperCase()??"DOC"}</span>}</div><div className="attachment-card-body"><strong>{item.name}</strong><span>{item.documentType?.replaceAll("_"," ")??"document"} · {item.storageProvider==="icloud"?"iCloud Drive":item.storageProvider==="cloudflare-r2"?"Secure R2":item.storageProvider}</span></div></button>})}</div>:<div className="row"><div className="row-meta">No vehicle attachments yet.</div></div>}
  {selectedAttachment&&selectedAttachment.storageProvider==="icloud"&&<div className="attachment-lightbox" role="dialog" aria-modal="true" onMouseDown={()=>setSelected(null)}><div className="attachment-viewer" onMouseDown={e=>e.stopPropagation()}><div className="attachment-viewer-head"><div><div className="kicker">iCloud Drive</div><h3>{selectedAttachment.name}</h3></div><div className="row-actions"><button type="button" className="mini-action danger-action" onClick={()=>deleteAttachment(selectedAttachment.id)}>Delete</button><button type="button" className="mini-action" onClick={()=>setSelected(null)}>Close</button></div></div><div className="attachment-open-card"><p>LifeOS keeps this file in your iCloud Drive. Use the deterministic path below in the Files app.</p><code>{selectedAttachment.storagePath}</code>{selectedAttachment.storageReference&&<a href={selectedAttachment.storageReference} target="_blank" rel="noreferrer" className="action primary">Open iCloud share</a>}<button type="button" className="action" onClick={openICloudFiles}>Open iCloud Drive</button></div></div></div>}
  {selectedAttachment&&selectedAttachment.storageProvider!=="icloud"&&<div className="attachment-lightbox" role="dialog" aria-modal="true" onMouseDown={()=>setSelected(null)}><div className="attachment-viewer" onMouseDown={e=>e.stopPropagation()}><div className="attachment-viewer-head"><div><div className="kicker">{selectedAttachment.documentType??"Attachment"}</div><h3>{selectedAttachment.name}</h3></div><div className="row-actions"><button type="button" className="mini-action danger-action" onClick={()=>deleteAttachment(selectedAttachment.id)}>Delete</button><button type="button" className="mini-action" onClick={()=>setSelected(null)}>Close</button></div></div><div className="attachment-preview">{selectedUrl&&attachmentKind(selectedAttachment.mimeType)==="image"?<img src={selectedUrl} alt={selectedAttachment.name}/>:selectedUrl&&attachmentKind(selectedAttachment.mimeType)==="pdf"?<iframe title={selectedAttachment.name} src={selectedUrl}/>:selectedUrl?<div className="attachment-open-card"><p>Preview is not available for this file type.</p><a href={selectedUrl} target="_blank" rel="noreferrer" className="action primary">Open attachment</a></div>:<div className="attachment-open-card"><p>This attachment has metadata but no preview URL in the current session.</p></div>}</div></div></div>}
 </section>;
}
