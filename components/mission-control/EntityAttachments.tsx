"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import type {BaseEntity,LifeOSDatabase,AttachmentEntityType} from "@/domain/contracts/database";
import {addAttachment,attachmentsForEntity,createAttachmentRecord,removeAttachment} from "@/domain/services/attachments";
import {deleteR2Attachment,loadR2AttachmentPreview,uploadR2Attachment} from "@/storage/attachments/r2";
import {externalUrlAttachmentAdapter} from "@/storage/attachments/adapter";

export default function EntityAttachments({db,entity,onPersist}:{db:LifeOSDatabase;entity:BaseEntity;onPersist:(next:LifeOSDatabase,message:string)=>void}){
 const entityType=entity.entityType as AttachmentEntityType;
 const attachments=useMemo(()=>attachmentsForEntity(db,entity.id,entityType),[db,entity.id,entityType]);
 const [file,setFile]=useState<File|null>(null); const [url,setUrl]=useState(""); const [name,setName]=useState("");
 const [documentType,setDocumentType]=useState<NonNullable<LifeOSDatabase["attachments"]>[number]["documentType"]>("other");
 const [uploading,setUploading]=useState(false); const [selected,setSelected]=useState<string|null>(null); const [previewZoom,setPreviewZoom]=useState<number|null>(null);
 const [previewUrls,setPreviewUrls]=useState<Record<string,string>>({}); const previewRef=useRef<Record<string,string>>({});
 useEffect(()=>{previewRef.current=previewUrls},[previewUrls]);
 useEffect(()=>{let cancelled=false;const item=attachments.find(x=>x.id===selected);if(!item||item.storageProvider!=="cloudflare-r2"||previewUrls[item.id])return;loadR2AttachmentPreview(item).then(preview=>{if(!cancelled&&preview)setPreviewUrls(current=>current[item.id]?current:{...current,[item.id]:preview})}).catch(()=>undefined);return()=>{cancelled=true}},[selected,attachments,previewUrls]);
 useEffect(()=>()=>{Object.values(previewRef.current).forEach(x=>{if(x.startsWith("blob:"))URL.revokeObjectURL(x)})},[]);
 const add=async()=>{
  if(!file&&!url.trim())return;
  const title=name.trim()||file?.name||(entity.entityType.replaceAll("_"," ")+" attachment");
  const inferredMime=file?(file.type||(file.name.toLowerCase().endsWith(".pdf")?"application/pdf":/\.(png|jpe?g)$/i.test(file.name)?"image/jpeg":/\.gif$/i.test(file.name)?"image/gif":/\.webp$/i.test(file.name)?"image/webp":/\.heic$/i.test(file.name)?"image/heic":/\.avif$/i.test(file.name)?"image/avif":undefined)):undefined;
  const attachment=createAttachmentRecord({name:title,mimeType:inferredMime,sizeBytes:file?.size,storageProvider:file?"cloudflare-r2":"external-url",storageReference:file?undefined:url.trim()||undefined,documentType,tags:[entity.entityType,documentType||"other"],description:"Attachment linked to "+entity.entityType.replaceAll("_"," "),linkedEntities:[{entityId:entity.id,entityType}]});
  if(!file){onPersist(addAttachment(db,attachment),(documentType==="receipt"?"Receipt":"Attachment")+" linked to "+entity.entityType.replaceAll("_"," ")+".");setUrl("");setName("");return;}
  setUploading(true);
  let uploaded:{key:string;etag?:string};
  try{
   uploaded=await uploadR2Attachment(file,attachment);
  }catch(error){
   const rawMessage=error instanceof Error?error.message:"Attachment upload failed.";
   const message=rawMessage==="Failed to fetch"||rawMessage==="Load failed"?"LifeOS could not reach secure attachment storage. This can happen when Cloudflare Access authentication is missing or the storage request is blocked. No attachment record was saved.":rawMessage+" No attachment record was saved.";
   window.alert(message+" Your selected file is still available to retry.");
   setUploading(false);
   return;
  }
  try{
   onPersist(addAttachment(db,{...attachment,storageReference:uploaded.key}), (documentType==="receipt"?"Receipt":"Attachment")+" uploaded to permanent R2 storage and linked.");
   setFile(null);setName("");
  }catch(error){
   window.alert("The file was uploaded to permanent storage, but LifeOS could not confirm that its attachment record was saved. Keep this file selected and retry only after checking the record.");
   setUploading(false);
   return;
  }
  try{const preview=await loadR2AttachmentPreview({...attachment,storageReference:uploaded.key});if(preview)setPreviewUrls(current=>({...current,[attachment.id]:preview}));}catch{/* The upload is already durable; preview recovery can retry when opened. */}
  setUploading(false);
 };
 const del=async(id:string)=>{const item=attachments.find(x=>x.id===id);if(!item)return;if(!window.confirm("Delete “"+item.name+"” from this "+entity.entityType.replaceAll("_"," ")+"?"))return;try{if(item.storageProvider==="cloudflare-r2")await deleteR2Attachment(item);const preview=previewUrls[id];if(preview)URL.revokeObjectURL(preview);setPreviewUrls(v=>{const n={...v};delete n[id];return n});setSelected(null);onPersist(removeAttachment(db,id),"Attachment deleted.");}catch(error){window.alert(error instanceof Error?error.message:"Unable to delete attachment.");}};
 const selectedItem=attachments.find(x=>x.id===selected); const selectedUrl=selectedItem?previewUrls[selectedItem.id]||externalUrlAttachmentAdapter.resolveUrl(selectedItem):null;
 const selectedMime=selectedItem?.mimeType||(selectedItem?.name.toLowerCase().endsWith(".pdf")?"application/pdf":/\.(png|jpe?g|gif|webp|heic|avif)$/i.test(selectedItem?.name??"")?"image/unknown":"");
 return <section className="event-edit-section entity-attachments-section">
  <div className="event-edit-section-heading"><span className="kicker">Attachments</span><span className="row-meta">{attachments.length?attachments.length+" attached":"Add files, receipts, photos, or documents"}</span></div>
  <div className="field-grid">
   <label className="field-label">File<input className="command-input" type="file" disabled={uploading} onChange={e=>{const selectedFile=e.target.files?.[0]??null;setFile(selectedFile);if(selectedFile&&!name.trim())setName(selectedFile.name)}}/></label>
   <label className="field-label">Name<input className="command-input" value={name} onChange={e=>setName(e.target.value)} placeholder="Receipt, photo, document…"/></label>
   <label className="field-label">Type<select className="command-input" value={documentType??"other"} onChange={e=>setDocumentType(e.target.value as typeof documentType)}><option value="receipt">Receipt</option><option value="photo">Photo</option><option value="contract">Contract</option><option value="statement">Statement</option><option value="insurance">Insurance</option><option value="warranty">Warranty</option><option value="manual">Manual</option><option value="service_record">Service record</option><option value="plan">Plan</option><option value="other">Other</option></select></label>
   <label className="field-label">Existing link<input className="command-input" value={url} onChange={e=>setUrl(e.target.value)} placeholder="iCloud / shared URL"/></label>
  </div>
  <div className="attachment-actions"><button type="button" className="action primary" disabled={uploading||(!file&&!url.trim())} onClick={add}>{uploading?"Uploading…":"＋ Attach"}</button></div>
  {attachments.length?<div className="attachment-grid">{attachments.map(item=><button type="button" className="attachment-card" key={item.id} onClick={()=>{setSelected(item.id);setPreviewZoom(null)}}><div className="attachment-thumb"><span className="attachment-icon">{item.mimeType==="application/pdf"?"PDF":(item.documentType??"FILE").toUpperCase()}</span></div><div className="attachment-card-body"><strong>{item.name}</strong><span>{item.storageProvider==="cloudflare-r2"?"Secure R2":item.storageProvider} · {item.documentType??"other"}</span></div></button>)}</div>:<div className="row"><div className="row-meta">No attachments yet.</div></div>}
  {selectedItem&&<div className="attachment-lightbox" role="dialog" aria-modal="true" onMouseDown={()=>setSelected(null)}><div className="attachment-viewer" onMouseDown={e=>e.stopPropagation()}><div className="attachment-viewer-head"><div><div className="kicker">{selectedItem.documentType??"Attachment"}</div><h3>{selectedItem.name}</h3></div><div className="row-actions"><button type="button" className="mini-action danger-action" onClick={()=>del(selectedItem.id)}>Delete</button><button type="button" className="mini-action" onClick={()=>setSelected(null)}>Close</button></div></div>{selectedUrl&&selectedMime.startsWith("image/")?<><div className="attachment-preview-toolbar"><button type="button" className="mini-action" onClick={()=>setPreviewZoom(null)}>Fit page</button><button type="button" className="mini-action" aria-label="Zoom out" onClick={()=>setPreviewZoom(current=>current===null?75:Math.max(25,current-25))}>−</button><span>{previewZoom===null?"Fit":`${previewZoom}%`}</span><button type="button" className="mini-action" aria-label="Zoom in" onClick={()=>setPreviewZoom(current=>current===null?125:Math.min(200,current+25))}>＋</button></div><div className={`attachment-preview ${previewZoom===null?"attachment-fit-page":"attachment-zoomed"}`}><img className="attachment-document-image" style={previewZoom===null?undefined:{width:`${previewZoom}%`}} src={selectedUrl} alt={selectedItem.name}/></div></>:selectedUrl&&selectedMime==="application/pdf"?<><div className="attachment-preview-toolbar"><button type="button" className="mini-action" onClick={()=>setPreviewZoom(null)}>Fit page</button><button type="button" className="mini-action" aria-label="Zoom out" onClick={()=>setPreviewZoom(current=>current===null?75:Math.max(25,current-25))}>−</button><span>{previewZoom===null?"Fit":`${previewZoom}%`}</span><button type="button" className="mini-action" aria-label="Zoom in" onClick={()=>setPreviewZoom(current=>current===null?125:Math.min(200,current+25))}>＋</button></div><div className="attachment-preview attachment-pdf-preview"><div className="attachment-pdf-frame" style={{width:`${previewZoom??100}%`,height:`${previewZoom??100}%`}}><iframe title={selectedItem.name} src={`${selectedUrl}#view=Fit`} style={previewZoom===null?undefined:{width:`${10000/previewZoom}%`,height:`${10000/previewZoom}%`,transform:`scale(${previewZoom/100})`,transformOrigin:"top left"}}/></div></div></>:<div className="attachment-open-card"><p>Preview is not available for this file type. You can still open or download the original file.</p>{selectedUrl&&<a href={selectedUrl} target="_blank" rel="noreferrer" className="action primary">Open attachment</a>}</div>}</div></div>}
 </section>;
}