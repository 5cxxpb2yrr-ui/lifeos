# USAA email-to-LifeOS bridge

## Flow

USAA deposit notification email → iPhone Shortcuts personal automation → authenticated Cloudflare Worker intake → deduplicated pending deposit → LifeOS cash forecast import.

This is a notification bridge, not a complete bank feed. It cannot discover transactions for which USAA sends no email. Email notifications may be delayed or formatted differently; review extracted amount and date during initial testing.

## Security model

- Never put USAA username, password, one-time code, full email body, account number, or routing number in the Shortcut request.
- Send only a posted date, positive amount in minor units (cents), a short description, optional opaque message ID, and optional non-sensitive account label.
- The Shortcut uses a long random bearer token kept as a Worker secret. Never put the token in a URL, screenshot, Git commit, or exported/shareable Shortcut.
- LifeOS browser reads must go through a same-origin Pages Function that validates the signed Cloudflare Access JWT and forwards through a private service binding. Do not expose the queue read token to browser JavaScript.
- Deduplicate by opaque email message ID where available; otherwise use posted date + amount + normalized description. Never treat a duplicate notification as a second deposit.
- Do not add imported records to the current cash balance. Only use them as actual-deposit history; cash balance remains independently supplied/verified.
- Keep raw email content out of KV, logs, and analytics. Apply a short retention period and provide a revoke/rotate procedure for the Shortcut token.

## iPhone Shortcut outline

1. In Shortcuts, create a personal automation for incoming email from the exact USAA sender/address used for deposit alerts. Narrow it with a stable subject phrase if USAA's alert subject supports this.
2. Set the automation to run immediately if iOS offers that option for this trigger.
3. Get the email's plain text content. Extract only the posted date, deposit amount, and short transaction description. Do not transmit the original message.
4. Convert the dollar amount to integer cents; reject missing/ambiguous dates, non-positive amounts, or messages that are not deposit notifications. Never infer an amount from unrelated account-balance text.
5. Use **Get Contents of URL** with a POST to the bridge endpoint, `Content-Type: application/json`, and `Authorization: Bearer <your bridge token>` in request headers. JSON body shape:

   `{ "postedDate": "2026-10-09", "amountMinor": 298336, "description": "KIA GEORGIA INC. PAYROLL", "currency": "USD", "sourceMessageId": "opaque-message-id" }`

6. Show a notification only when the endpoint confirms accepted or duplicate. If extraction fails or the request fails, show an error and do not mark the email as processed.
7. Test with a known alert and verify that repeating the same message is deduplicated.

## Rollout checklist

- Create the Worker and a private KV namespace; bind the namespace as `DEPOSITS`.
- Set `BRIDGE_TOKEN` as a high-entropy Cloudflare Worker secret; do not commit it.
- Set a separate `BRIDGE_PROXY_TOKEN` as a Worker secret and as a Pages secret for the same-origin Access-validated proxy. The proxy must validate the LifeOS Access JWT before forwarding list/ack requests.
- Configure the Pages `USAA_BRIDGE` service binding to this Worker for both preview and production.
- Deploy a staging version first. Test invalid token, invalid JSON, oversized payload, duplicate alert, date/amount validation, queue listing, and acknowledgement.
- Confirm the payroll resolver imports actual deposits as historical transaction records with `cashBalanceExcluded: true`; projected paydays remain separately labeled estimates.
- Rotate the bridge token if the Shortcut is shared or exposed. A new token must be deployed before updating the Shortcut.

## Important current limitation

The bridge intake and secure queue are only the first half of automation. A same-origin Access-validated Pages Function and Mission Control queue importer must be wired before queued deposits automatically appear in the cash calendar. Until then, do not describe the process as end-to-end automatic.