"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import type {BaseEntity,LifeOSDatabase,AttachmentEntityType} from "@/domain/contracts/database";
import {addAttachment,attachmentsForEntity,createAttachmentRecord,removeAttachment} from "@/domain/services/attachments";
import {deleteR2Attachment,loadR2AttachmentPreview,uploadR2Attachment} from "@/storage/attachments/r2";
import {browserSessionAttachmentAdapter,externalUrlAttachmentAdapter} from "@/storage/attachments/adapter";

export default function EntityAttachments({db,entity,onPersist}:{db:LifeOSDatabase;entity:BaseEntity;onPersist:(next:LifeOSDatabase,message:string)=>void}){
 const entityType=entity.entityType as AttachmentEntityType;
 const attachments=useMemo(()=>attachmentsForEntity(db,entity.id,entityType),[db,entity.id,entityType]);
 const [file,setFile]=useState<File|null>(null); const [url,setUrl]=useState(""); const [name,setName]=useState("");
 const [documentType,setDocumentType]=useState<NonNullable<LifeOSDatabase["attachments"]>[number]["documentType"]>("other");
 const [uploading,setUploading]=useState(false); const [selected,setSelected]=useState<string|null>(null);
 const [previewUrls,setPreviewUrls]=useState<Record<string,string>>({}); const previewRef=useRef<Record<string,string>>({});
 useEffect(()=>{previewRef.current=previewUrls},[previewUrls]);
 useEffect(()=>{let cancelled=false;const item=attachments.find(x=>x.id===selected);if(!item||item.storageProvider!=="cloudflare-r2"||previewUrls[item.id])return;loadR2AttachmentPreview(item).then(preview=>{if(!cancelled&&preview)setPreviewUrls(current=>current[item.id]?current:{...current,[item.id]:preview})}).catch(()=>undefined);return()=>{cancelled=true}},[selected,attachments,previewUrls]);
 useEffect(()=>()=>{Object.values(previewRef.current).forEach(x=>{if(x.startsWith("blob:"))URL.revokeObjectURL(x)})},[]);
 const add=async()=>{
  if(!file&&!url.trim())return;
  const title=name.trim()||file?.name||(entity.entityType.replaceAll("_"," ")+" attachment");
  const attachment=createAttachmentRecord({name:title,mimeType:file?.type,sizeBytes:file?.size,storageProvider:file?"cloudflare-r2":"external-url",storageReference:file?undefined:url.trim()||undefined,documentType,tags:[entity.entityType,documentType||"other"],description:"Attachment linked to "+entity.entityType.replaceAll("_"," "),linkedEntities:[{entityId:entity.id,entityType}]});
  if(!file){onPersist(addAttachment(db,attachment),(documentType==="receipt"?"Receipt":"Attachment")+" linked to "+entity.entityType.replaceAll("_"," ")+".");setUrl("");setName("");return;}
  setUploading(true);
  try{const uploaded=await uploadR2Attachment(file,attachment);const preview=await loadR2AttachmentPreview({...attachment,storageReference:uploaded.key});if(preview)setPreviewUrls(v=>({...v,[attachment.id]:preview}));onPersist(addAttachment(db,{...attachment,storageReference:uploaded.key}),(documentType==="receipt"?"Receipt":"Attachment")+" uploaded and linked.");setFile(null);setName("");}
  catch(error){const message=error instanceof Error?error.message:"Attachment upload failed.";const fallback={...attachment,storageProvider:"browser-session" as const};setPreviewUrls(v=>({...v,[attachment.id]:browserSessionAttachmentAdapter.createPreview(file)}));onPersist(addAttachment(db,fallback),message+" Saved as a browser-session attachment instead.");setFile(null);setName("");}
  finally{setUploading(false)}
 };
 const del=async(id:string)=>{const item=attachments.find(x=>x.id===id);if(!item)return;if(!window.confirm("Delete “"+item.name+"” from this "+entity.entityType.replaceAll("_"," ")+"?"))return;try{if(item.storageProvider==="cloudflare-r2")await deleteR2Attachment(item);const preview=previewUrls[id];if(preview)URL.revokeObjectURL(preview);setPreviewUrls(v=>{const n={...v};delete n[id];return n});setSelected(null);onPersist(removeAttachment(db,id),"Attachment deleted.");}catch(error){window.alert(error instanceof Error?error.message:"Unable to delete attachment.");}};
 const selectedItem=attachments.find(x=>x.id===selected); const selectedUrl=selectedItem?previewUrls[selectedItem.id]||externalUrlAttachmentAdapter.resolveUrl(selectedItem):null;
 const selectedMime=selectedItem?.mimeType||(selectedItem?.name.toLowerCase().endsWith(".pdf")?"application/pdf":/\.(png|jpe?g|gif|webp|heic|avif)$/i.test(selectedItem?.name??"")?"image/unknown":"");
 return <section className="event-edit-section entity-attachments-section">
  <div className="event-edit-section-heading"><span className="kicker">Attachments</span><span className="row-meta">{attachments.length?attachments.length+" attached":"Add files, receipts, photos, or documents"}</span></div>
  <div className="field-grid">
   <label className="field-label">File<input className="command-input" type="file" disabled={uploading} onChange={e=>setFile(e.target.files?.[0]??null)}/></label>
   <label className="field-label">Name<input className="command-input" value={name} onChange={e=>setName(e.target.value)} placeholder="Receipt, photo, document…"/></label>
   <label className="field-label">Type<select className="command-input" value={documentType??"other"} onChange={e=>setDocumentType(e.target.value as typeof documentType)}><option value="receipt">Receipt</option><option value="photo">Photo</option><option value="contract">Contract</option><option value="statement">Statement</option><option value="insurance">Insurance</option><option value="warranty">Warranty</option><option value="manual">Manual</option><option value="service_record">Service record</option><option value="plan">Plan</option><option value="other">Other</option></select></label>
   <label className="field-label">Existing link<input className="command-input" value={url} onChange={e=>setUrl(e.target.value)} placeholder="iCloud / shared URL"/></label>
  </div>
  <div className="attachment-actions"><button type="button" className="action primary" disabled={uploading||(!file&&!url.trim())} onClick={add}>{uploading?"Uploading…":"＋ Attach"}</button></div>
  {attachments.length?<div className="attachment-grid">{attachments.map(item=><button type="button" className="attachment-card" key={item.id} onClick={()=>setSelected(item.id)}><div className="attachment-thumb"><span className="attachment-icon">{item.mimeType==="application/pdf"?"PDF":(item.documentType??"FILE").toUpperCase()}</span></div><div className="attachment-card-body"><strong>{item.name}</strong><span>{item.storageProvider==="cloudflare-r2"?"Secure R2":item.storageProvider} · {item.documentType??"other"}</span></div></button>)}</div>:<div className="row"><div className="row-meta">No attachments yet.</div></div>}
  {selectedItem&&<div className="attachment-lightbox" role="dialog" aria-modal="true" onMouseDown={()=>setSelected(null)}><div className="attachment-viewer" onMouseDown={e=>e.stopPropagation()}><div className="attachment-viewer-head"><div><div className="kicker">{selectedItem.documentType??"Attachment"}</div><h3>{selectedItem.name}</h3></div><div className="row-actions"><button type="button" className="mini-action danger-action" onClick={()=>del(selectedItem.id)}>Delete</button><button type="button" className="mini-action" onClick={()=>setSelected(null)}>Close</button></div></div>{selectedUrl&&selectedMime.startsWith("image/")?<div className="attachment-preview"><img src={selectedUrl} alt={selectedItem.name}/></div>:selectedUrl&&selectedMime==="application/pdf"?<div className="attachment-preview"><iframe title={selectedItem.name} src={selectedUrl}/></div>:<div className="attachment-open-card"><p>Preview is not available for this file type. You can still open or download the original file.</p>{selectedUrl&&<a href={selectedUrl} target="_blank" rel="noreferrer" className="action primary">Open attachment</a>}</div>}</div></div>}
 </section>;
}