# Plaid integration foundation

## Scope and rollout

This integration starts in Plaid Sandbox. It must not connect to a real financial institution or alter the production cash forecast until Sandbox validation is complete and the owner explicitly approves Production access.

LifeOS remains the source of truth for canonical financial transactions, Events, obligations, and forecast rules. Plaid is an external observation feed. Imported transactions are evidence of posted activity, not new forecast income: never add a historical transaction to projected cash a second time.

## Planned flow

1. LifeOS asks the server to create a short-lived Plaid Link token.
2. Plaid Link runs in the browser and returns a temporary public_token.
3. The server exchanges it for an access_token; the token is encrypted with AES-GCM using a Cloudflare Worker secret and persisted only server-side.
4. A sync endpoint calls /transactions/sync, persists the cursor and transaction changes in one idempotent flow, and handles additions, modifications, and removals.
5. Webhooks request a sync; the webhook handler verifies the Plaid verification JWT before trusting the event and does not treat webhook payloads as transaction truth.
6. LifeOS exposes synced transactions for explicit reconciliation/import into its canonical ledger. transaction_id is the idempotency key; pending-to-posted replacement and removed transactions must be handled.
7. The existing cash forecast continues to use canonical LifeOS records and its resolver. Imported history must not inflate the current cash balance or duplicate scheduled payroll.

## Required Cloudflare bindings and secrets

A later implementation commit will add and validate these before any deploy:

- D1 binding for Plaid Items, account mappings, cursors, and synced transaction records.
- PLAID_CLIENT_ID and environment-appropriate PLAID_SECRET as Worker/Pages secrets, never public variables.
- PLAID_ENV set to sandbox for the initial stage.
- PLAID_TOKEN_ENCRYPTION_KEY as a high-entropy secret used for AES-GCM encryption of access_token values before D1 persistence.
- A configured webhook URL and verification flow as required by the current Plaid webhook protocol.

Do not put API secrets, access tokens, webhook secrets, account numbers, or real bank data in source control, issue comments, build logs, or ChatGPT messages.

## Sandbox acceptance checklist

- Create Link tokens server-side and exchange a Sandbox public token server-side.
- Verify access tokens are encrypted at rest and never returned to the browser.
- Sync using the cursor API; commit transaction changes and the new cursor safely so retries cannot skip transactions.
- Handle added, modified, and removed records idempotently.
- Verify webhook signatures before processing; fetch current data through sync rather than trusting the webhook body.
- Test pagination, retry behavior, duplicate delivery, pending-to-posted changes, and currency/amount conversion.
- Confirm synced transactions are not included in the cash balance until reconciled to the canonical ledger, and that importing history never double-counts cash.
- Run typecheck, tests, production build, and Wrangler validation before requesting merge.
- Keep Production linking disabled until Sandbox tests pass and the owner approves the live-account connection.

## Current status

This document is the design contract only. The secure API routes, database binding, tests, and Plaid Link UI must be added and validated in subsequent commits. No bank connection is active.
