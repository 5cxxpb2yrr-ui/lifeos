"use client";
import {useEffect,useMemo,useState} from "react";
import type {LifeOSDatabase} from "@/domain/contracts/database";
import {addAttachment,attachmentKind,attachmentsForEntity,createAttachmentRecord,createPreviewUrl,revokePreviewUrl} from "@/domain/services/attachments";

export default function VehicleAttachments({db,vehicle,onPersist}:{db:LifeOSDatabase;vehicle:LifeOSDatabase["vehicles"][number];onPersist:(next:LifeOSDatabase,message:string)=>void}){
 const attachments=useMemo(()=>attachmentsForEntity(db,vehicle.id,"vehicle"),[db,vehicle.id]);
 const [selected,setSelected]=useState<string|null>(null);
 const [file,setFile]=useState<File|null>(null);
 const [url,setUrl]=useState("");
 const [name,setName]=useState("");
 const [category,setCategory]=useState<"manual"|"service_record"|"receipt"|"photo"|"other">("manual");
 const [previewUrls,setPreviewUrls]=useState<Record<string,string>>({});
 useEffect(()=>()=>Object.values(previewUrls).forEach(revokePreviewUrl),[previewUrls]);
 const add=()=>{
  if(!file&&!url.trim())return;
  const title=name.trim()||file?.name||"Vehicle document";
  const mime=file?.type||undefined;
  const attachment=createAttachmentRecord({
   name:title,mimeType:mime,sizeBytes:file?.size,storageProvider:file?"browser-session":"external-url",
   storageReference:url.trim()||undefined,documentType:category,tags:["vehicle",category],
   description:category==="manual"?"Vehicle manual / service reference":"Vehicle attachment",
   linkedEntities:[{entityId:vehicle.id,entityType:"vehicle"}],
  });
  if(file){const objectUrl=createPreviewUrl(file);setPreviewUrls(current=>({...current,[attachment.id]:objectUrl}));}
  onPersist(addAttachment(db,attachment),"Vehicle attachment added.");
  setFile(null);setUrl("");setName("");
 };
 const selectedAttachment=attachments.find(item=>item.id===selected);
 const selectedUrl=selectedAttachment?previewUrls[selectedAttachment.id]||selectedAttachment.storageReference||null:null;
 return <section className="vehicle-attachments card">
  <div className="section-title"><div><div className="kicker">Vehicle Context</div><h3>Attachments</h3></div><span className="badge">{attachments.length}</span></div>
  <p className="row-meta attachment-note">Files stay outside the LifeOS database. LifeOS stores metadata and a storage reference; browser-selected files are session previews until an external storage link is supplied.</p>
  <div className="attachment-add-grid">
   <label className="field-label">Name<input className="command-input" value={name} onChange={e=>setName(e.target.value)} placeholder="2006 Scion xB Service Manual"/></label>
   <label className="field-label">Category<select className="command-input" value={category} onChange={e=>setCategory(e.target.value as typeof category)}><option value="manual">Manual</option><option value="service_record">Service record</option><option value="receipt">Receipt</option><option value="photo">Photo</option><option value="other">Other</option></select></label>
   <label className="field-label">External storage link<input className="command-input" value={url} onChange={e=>setUrl(e.target.value)} placeholder="iCloud / shared-file URL"/></label>
   <label className="field-label">Session preview<input className="command-input" type="file" onChange={e=>setFile(e.target.files?.[0]??null)}/></label>
  </div>
  <div className="attachment-actions"><button type="button" className="action primary" disabled={!file&&!url.trim()} onClick={add}>＋ Add attachment</button></div>
  {attachments.length?<div className="attachment-grid">{attachments.map(item=>{const kind=attachmentKind(item.mimeType);const preview=previewUrls[item.id];return <button type="button" className="attachment-card" key={item.id} onClick={()=>setSelected(item.id)}><div className="attachment-thumb">{preview&&kind==="image"?<img src={preview} alt=""/>:kind==="image"&&item.storageReference?<img src={item.storageReference} alt=""/>:<span className="attachment-icon">{kind==="pdf"?"PDF":item.documentType?.toUpperCase()??"DOC"}</span>}</div><div className="attachment-card-body"><strong>{item.name}</strong><span>{item.documentType?.replaceAll("_"," ")??"document"}</span></div></button>})}</div>:<div className="row"><div className="row-meta">No vehicle attachments yet.</div></div>}
  {selectedAttachment&&<div className="attachment-lightbox" role="dialog" aria-modal="true" onMouseDown={()=>setSelected(null)}><div className="attachment-viewer" onMouseDown={e=>e.stopPropagation()}><div className="attachment-viewer-head"><div><div className="kicker">{selectedAttachment.documentType??"Attachment"}</div><h3>{selectedAttachment.name}</h3></div><button type="button" className="mini-action" onClick={()=>setSelected(null)}>Close</button></div><div className="attachment-preview">{selectedUrl&&attachmentKind(selectedAttachment.mimeType)==="image"?<img src={selectedUrl} alt={selectedAttachment.name}/>:selectedUrl&&attachmentKind(selectedAttachment.mimeType)==="pdf"?<iframe title={selectedAttachment.name} src={selectedUrl}/>:selectedUrl?<div className="attachment-open-card"><p>Preview is not available for this file type.</p><a href={selectedUrl} target="_blank" rel="noreferrer" className="action primary">Open attachment</a></div>:<div className="attachment-open-card"><p>This attachment has metadata but no preview URL in the current session.</p></div>}</div></div></div>}
 </section>;
}
