# Plaid integration foundation

## Scope and rollout

This integration starts in Plaid Sandbox. It must not connect to a real financial institution or alter the production cash forecast until Sandbox validation is complete and the owner explicitly approves Production access.

LifeOS remains the source of truth for canonical financial transactions, Events, obligations, and forecast rules. Plaid is an external observation feed. Imported transactions are evidence of posted activity, not new forecast income: never add a historical transaction to projected cash a second time.

## Implemented API foundation

The Pages Function at `functions/api/plaid/[[path]].ts` currently defines these authenticated POST endpoints:

- `/api/plaid/link-token` creates a short-lived Plaid Link token on the server.
- `/api/plaid/exchange` exchanges a temporary public token, encrypts the access token with AES-GCM, and stores the Item plus account metadata in D1.
- `/api/plaid/sync` decrypts the stored token server-side, uses `/transactions/sync`, upserts additions, updates modified transactions, marks removed transactions, and saves the cursor after all pages are handled.

Every route verifies the signed Cloudflare Access JWT, not merely the presence of an Access header. Plaid credentials and access tokens are not returned to the browser. Plaid error bodies and tokens are intentionally not forwarded to callers.

**This is not deploy-ready yet.** The Access issuer/audience are copied from the existing LifeOS attachment proxy and must be verified against the current Cloudflare Access application. The D1 binding and secrets are not provisioned in Wrangler, there is no Plaid Link UI, and webhook verification/processing is not implemented yet. No real account has been connected.

## Required Cloudflare bindings and secrets

- D1 binding named `PLAID_DB`, attached to the database created from `migrations/0001_plaid.sql`.
- `PLAID_CLIENT_ID` and `PLAID_SECRET` stored as server-side secrets.
- `PLAID_ENV=sandbox` for initial testing. The server only accepts known Plaid API environments.
- `PLAID_TOKEN_ENCRYPTION_KEY`: base64 encoding of exactly 32 cryptographically random bytes, stored as a server-side secret. Never commit it or send it in chat.
- Confirm the Pages Function runtime has the same Cloudflare Access issuer and audience as the deployed LifeOS Access app.

Do not put API secrets, access tokens, webhook secrets, account numbers, or real bank data in source control, issue comments, build logs, or ChatGPT messages.

## Known follow-up work

1. Provision D1 in the correct Cloudflare account, apply the migration, and add its actual database ID to Wrangler configuration. Do not guess or reuse an unrelated database ID.
2. Add the server-side secrets and validate Access issuer/audience against the real application.
3. Add Plaid Link UI that calls the Link-token endpoint and posts the returned public token plus institution metadata to the exchange endpoint.
4. Add verified webhook handling. Webhooks should request a sync; do not treat webhook payloads as transaction truth.
5. Add UI/reconciliation into canonical LifeOS ledger records. Synced history must not automatically alter forecast balances or duplicate scheduled payroll.
6. Add tests for auth, encryption configuration, pagination, retry, duplicate delivery, pending-to-posted changes, removed transactions, and safe error responses.

## Sandbox acceptance checklist

- Create Link tokens server-side and exchange a Sandbox public token server-side.
- Verify access tokens are encrypted at rest and never returned to the browser.
- Sync using the cursor API; transaction updates are idempotent and cursor advancement happens only after a complete sync.
- Handle added, modified, and removed records.
- Test pagination, retry behavior, pending-to-posted changes, and currency/amount conversion.
- Confirm synced transactions are not included in the cash balance until reconciled to canonical ledger records.
- Run typecheck, tests, production build, and Wrangler validation before requesting merge.
- Keep Production linking disabled until Sandbox tests pass and the owner approves the live-account connection.

## Current status

The API foundation is committed to the draft PR, but runtime validation, database binding, Link UI, webhook verification, and Sandbox acceptance testing remain incomplete. No bank connection is active.
