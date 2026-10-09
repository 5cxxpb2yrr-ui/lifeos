# LifeOS attachment storage

## Storage contract

- File bytes for files uploaded in LifeOS belong in the private `lifeos-attachments` R2 bucket.
- Attachment metadata remains in the LifeOS database contract, including a deterministic `storagePath` and the returned R2 object key in `storageReference`.
- The current canonical database adapter is browser IndexedDB. This survives ordinary reloads and browser restarts on that browser profile, but it does **not** synchronize records to another device or browser profile.
- iCloud Drive references are user-owned pointers; a path or share URL does not mean LifeOS has uploaded or verified the file.
- A temporary `blob:` preview URL is never a storage reference and must never be treated as durable.

## Upload behavior

A file is not added to the canonical attachment collection until the R2 upload succeeds. If upload fails, LifeOS shows the error and keeps the selected file available for retry. It must not silently downgrade a failed upload to browser-session storage or claim the file is permanently stored.

Preview loading happens after the successful upload and record save. A preview failure does not reverse a successful upload; opening the attachment can retry preview retrieval.

## Authentication and cross-device sync

The existing R2 Worker requires a Cloudflare Access JWT and binds the private R2 bucket. Do not expose bucket credentials in browser code or weaken the Worker to public unauthenticated reads/writes.

Cross-device attachment discovery requires a durable remote metadata store plus a stable user identity and authorization policy. IndexedDB alone cannot provide cross-device sync. Before enabling remote metadata writes, configure and verify the user's authentication/ownership model, then bind a dedicated D1 database or equivalent store to the Worker and add schema migrations and owner-scoped access checks. Do not reuse an unrelated database or assume a public site origin identifies the owner.

## Operational checks

1. Upload a PDF or image; confirm the Worker returns success and the R2 key is persisted in the attachment record.
2. Reload the same browser profile and reopen the file; confirm the preview is fetched from R2 rather than a cached blob URL.
3. Block or misconfigure the R2 request; confirm LifeOS saves no attachment record and offers retry.
4. Verify access from a second device only after remote metadata sync and identity checks are implemented.
5. Delete the attachment and confirm the R2 object and metadata record are both removed; failures must be visible rather than silently leaving one side behind.
