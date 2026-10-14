import assert from "node:assert/strict";
import test from "node:test";
import { webcrypto } from "node:crypto";
// @ts-ignore Wrangler Worker module; bindings and upstream API are mocked below.
import worker from "../workers/lifeos-plaid-sandbox/worker.js";

test("sync failures do not commit summary or cursor", async () => {
  const writes: string[] = [];
  const encryptionSecret = "test-value";
  const nonce = new Uint8Array(12).fill(7);
  const keyMaterial = await webcrypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(encryptionSecret)
  );
  const key = await webcrypto.subtle.importKey("raw", keyMaterial, { name: "AES-GCM" }, false, ["encrypt"]);
  const encrypted = await webcrypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    key,
    new TextEncoder().encode("access-sandbox-token")
  );
  const db = {
    prepare(sql: string) {
      return {
        bind() { return this; },
        async first() {
          if (sql.includes("SELECT access_token_ciphertext")) return {
            access_token_ciphertext: Buffer.from(encrypted).toString("base64"),
            access_token_nonce: Buffer.from(nonce).toString("base64"),
            token_key_version: 1
          };
          if (sql.includes("SELECT cursor FROM plaid_transaction_cursors")) return { cursor: "before" };
          return null;
        },
        async run() { writes.push(sql); return {}; }
      };
    },
    async batch() { throw new Error("batch must not run after a failed sync"); }
  };
  const env = {
    DB: db,
    PLAID_ENV: "sandbox",
    PLAID_CLIENT_ID: "test-client",
    PLAID_SECRET: "test-value",
    PLAID_TOKEN_ENCRYPTION_KEY: encryptionSecret
  };
  const originalFetch = globalThis.fetch;
  const requestedPaths: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    requestedPaths.push(String(input));
    if (String(input).endsWith("/accounts/get")) {
      return new Response(JSON.stringify({ accounts: [] }), { status: 200 });
    }
    return new Response(JSON.stringify({ error_code: "MOCK_FAILURE" }), { status: 500 });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request("https://worker.test/api/transactions/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: "mock-item" })
    }), env);
    assert.equal(requestedPaths.length, 2, "test must reach the mocked transaction-sync request");
    assert.ok(requestedPaths[0].endsWith("/accounts/get"));
    assert.ok(requestedPaths[1].endsWith("/transactions/sync"));
    assert.equal(response.status, 500);
    assert.equal(writes.some(sql => /plaid_sync_summaries|plaid_transaction_cursors|sync_cursor/i.test(sql)), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
