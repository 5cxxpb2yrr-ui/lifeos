# LifeOS attachment storage

## Storage contract

- File bytes for files uploaded in LifeOS belong in the private `lifeos-attachments` R2 bucket.
- Attachment metadata remains in the LifeOS database contract, including a deterministic `storagePath` and the returned R2 object key in `storageReference`.
- The canonical database adapter is browser IndexedDB. This survives reloads in that browser profile but does not synchronize records to another device or browser profile.
- iCloud Drive references are user-owned pointers; a path or share URL does not mean LifeOS has uploaded or verified the file.
- A temporary `blob:` preview URL is never a storage reference and must never be treated as durable.

## Authentication and request path

- The LifeOS Pages hostname and all enabled preview hostnames must be protected by Cloudflare Access with an explicit owner-only allow policy.
- The browser calls the same-origin `/api/attachments/<storagePath>` Pages Function; it does not call the Worker cross-origin.
- The Pages Function requires the Cloudflare Access JWT assertion and forwards it only to the bound `lifeos-attachments` Worker. The Worker must independently validate the signed JWT before any R2 operation. A header's mere presence is not authentication.
- The Function uses a private service binding to the Worker. It does not expose R2 credentials or a public bucket URL. Do not add a public fallback, bypass JWT validation, or accept a client-supplied owner identity.
- Keep the Worker Access app and private R2 bucket in place. The Worker remains responsible for signed-JWT validation and object operations.
- The Wrangler/Pages deployment must include the `ATTACHMENTS` service binding. If the Pages deployment has not applied that binding, fail closed with a storage error.

## Upload behavior

A file is not added to the canonical attachment collection until the R2 upload succeeds. If upload fails, LifeOS shows the error and keeps the selected file available for retry. It must not silently downgrade a failed upload to browser-session storage or claim the file is permanently stored.

Preview loading happens after the successful upload and record save. A preview failure does not reverse a successful upload; opening the attachment can retry preview retrieval. Attachment responses are marked `private, no-store`.

## Required deployment and verification checklist

1. Create an owner-only Cloudflare Access application for `finance-trackerzip.pages.dev` and every production/preview hostname that will serve the protected app. Verify login before enabling the proxy.
2. Configure the Pages `ATTACHMENTS` service binding to the existing `lifeos-attachments` Worker for preview and production.
3. Upload a small PDF or image. Confirm the same-origin Function forwards the Access JWT, the Worker validates it, the Worker returns success, and the R2 key is persisted in the attachment record.
4. Reload the same browser profile and reopen the file; confirm preview is fetched from R2 rather than a cached blob URL.
5. Request GET, PUT, and DELETE without a valid Access JWT; each must be denied. A forged JWT must also be denied by the Worker.
6. Verify a user who is not included in the Access allow policy cannot open LifeOS or invoke the proxy.
7. Block or misconfigure the R2 request; confirm LifeOS saves no attachment record and offers retry.
8. Delete an attachment and confirm the R2 object and metadata record are both removed; failures must be visible rather than silently leaving one side behind.
9. Verify access from a second device only after remote metadata sync and identity checks are implemented. IndexedDB alone cannot provide cross-device sync.
