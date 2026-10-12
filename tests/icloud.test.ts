import assert from "node:assert/strict";
import test from "node:test";
import {
 createICloudAttachmentPath,
 createICloudBridgeRequest,
 iCloudPrivateStorageConfig,
 isICloudBridgeRequest,
} from "../storage/attachments/icloud.ts";

test("iCloud storage is private-user-owned and has no share URL dependency",()=>{
 const config=iCloudPrivateStorageConfig();
 assert.equal(config.provider,"icloud");
 assert.equal(config.access,"private-user-owned");
 assert.equal(config.rootPath,"iCloud Drive/LifeOS");
 assert.equal(config.attachmentRoot,"iCloud Drive/LifeOS/Attachments");
 assert.equal(config.shortcutName,"LifeOS iCloud Bridge");
 assert.equal("shareUrl" in config,false);
});

test("iCloud bridge request is deterministic and validates without network access",()=>{
 const path=createICloudAttachmentPath({
  attachmentId:"att-1",
  entityType:"document",
  entityId:"doc-1",
  name:"2019 Subaru Manual.pdf",
 });
 const request=createICloudBridgeRequest({
  action:"retrieve",
  path,
  attachmentId:"att-1",
 });
 assert.equal(request.provider,"icloud");
 assert.equal(request.access,"private-user-owned");
 assert.equal(request.rootPath,"iCloud Drive/LifeOS");
 assert.equal(request.path,path);
 assert.equal(request.attachmentId,"att-1");
 assert.equal(isICloudBridgeRequest(request),true);
 assert.equal(isICloudBridgeRequest({...request,access:"public-share"}),false);
});
