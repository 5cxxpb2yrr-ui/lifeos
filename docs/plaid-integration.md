# Plaid integration foundation

## Scope and rollout

This integration starts in Plaid Sandbox. It must not connect to a real financial institution or alter the production cash forecast until Sandbox validation is complete and the owner explicitly approves Production access.

LifeOS remains the source of truth for canonical financial transactions, Events, obligations, and forecast rules. Plaid is an external observation feed. Imported transactions are evidence of posted activity, not new forecast income: never add a historical transaction to projected cash a second time.

## Implemented API foundation

The Pages Function at `functions/api/plaid/[[path]].ts` defines these authenticated POST endpoints:

- `/api/plaid/link-token` creates a short-lived Plaid Link token on the server.
- `/api/plaid/exchange` exchanges a temporary public token, encrypts the access token with AES-GCM, and stores the Item plus account metadata in D1.
- `/api/plaid/sync` decrypts the stored token server-side, uses `/transactions/sync`, upserts additions, updates modified transactions, marks removed transactions, and saves the cursor after a completed sync.

Every route verifies the signed Cloudflare Access JWT, not merely the presence of an Access header. Plaid credentials and access tokens are not returned to the browser. Plaid error bodies and tokens are intentionally not forwarded to callers.

**This is not deploy-ready yet.** The Access issuer/audience are copied from the existing LifeOS attachment proxy and must be verified against the current Cloudflare Access application. The D1 database and tables are provisioned, but Pages bindings/secrets are not yet deployed. There is no Plaid Link UI, and webhook verification/processing is not implemented. No real account has been connected.

## D1 database

The existing Cloudflare D1 database `financetracker-db` is used for the integration foundation:

- Database ID: `23666e35-57e4-4b8f-97a7-7bef8fdd6750`
- Binding name in Wrangler: `PLAID_DB`
- Migration file: `migrations/0001_plaid.sql`

The four Plaid tables were applied and verified in D1. The migration uses `IF NOT EXISTS` so Wrangler migration application remains repeatable. Do not drop or repurpose these tables without reviewing existing data first.

## Required Pages secrets and bindings

- D1 binding named `PLAID_DB`, attached to `financetracker-db`.
- `PLAID_CLIENT_ID` and `PLAID_SECRET` stored as server-side secrets.
- `PLAID_ENV=sandbox` explicitly for initial testing. The API fails closed if this value is missing or not `sandbox`.
- `PLAID_TOKEN_ENCRYPTION_KEY`: base64 encoding of exactly 32 cryptographically random bytes, stored as a server-side secret. Never commit it or send it in chat.
- Confirm the Pages Function runtime has the same Cloudflare Access issuer and audience as the deployed LifeOS Access app.

Do not put API secrets, access tokens, webhook secrets, account numbers, or real bank data in source control, issue comments, build logs, or ChatGPT messages.

## Preview-only guard

The Plaid API is restricted to non-root subdomains of `finance-trackerzip.pages.dev` (Cloudflare Pages branch/commit Preview URLs). The root Pages hostname and custom production domains are rejected before Access authentication. This is a defense-in-depth guard, not a replacement for configuring secrets separately by environment. Keep the Preview deployment behind Cloudflare Access. If the Pages project name changes, update the hostname guard and its tests together.

## Known follow-up work

1. Add the Pages secrets and validate Access issuer/audience against the real application.
2. Add Plaid Link UI that calls the Link-token endpoint and posts the returned public token plus institution metadata to the exchange endpoint.
3. Add verified webhook handling. Webhooks should request a sync; do not treat webhook payloads as transaction truth.
4. Add UI/reconciliation into canonical LifeOS ledger records. Synced history must not automatically alter forecast balances or duplicate scheduled payroll.
5. Add tests for auth, encryption configuration, pagination, retry, duplicate delivery, pending-to-posted changes, removed transactions, and safe error responses.
6. Run typecheck, tests, production build, and Wrangler validation before requesting merge.

## Sandbox acceptance checklist

- Create Link tokens server-side and exchange a Sandbox public token server-side.
- Verify access tokens are encrypted at rest and never returned to the browser.
- Sync using the cursor API; transaction updates are idempotent and cursor advancement happens only after a complete sync.
- Handle added, modified, and removed records.
- Test pagination, retry behavior, pending-to-posted changes, and currency/amount conversion.
- Confirm synced transactions are not included in the cash balance until reconciled to canonical ledger records.
- Keep Production linking disabled until Sandbox tests pass and the owner approves the live-account connection.

## Current status

The server-side API foundation and D1 schema are committed to the draft PR, and the four Plaid tables exist in the finance D1 database. Pages secrets, verified Access configuration, Link UI, webhook verification, and Sandbox acceptance testing remain incomplete. No bank connection is active.


## Source-independent transaction intake and retention

The Finance view includes a Transaction Import & Archive panel that accepts manual JSON or CSV without requiring Plaid Link or a connected bank. Parsing and classification happen in the browser; the persisted LifeOS record contains the aggregate summary, import label/source, status, and a non-cryptographic duplicate fingerprint only. It does not contain raw transaction rows or source transaction identifiers.

Saving an analysis summary does not create canonical financial transactions, alter account balances, or feed the cash forecast. Payroll deposit import remains a separate reviewed workflow. Full backups/restores include the optional `transactionImports` collection, Data Control Center can export summary records separately, and the integrity resolver checks retention flags and import metadata. Legacy database snapshots without this optional collection remain readable.

Individual-transaction archives are not implemented by this panel. If added later, they must be an explicit user choice and stored only in private encrypted storage with an archive manifest and retention/deletion metadata.
