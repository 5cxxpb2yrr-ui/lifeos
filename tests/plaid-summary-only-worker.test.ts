import assert from "node:assert/strict";
import test from "node:test";
// @ts-ignore Wrangler Worker module; bindings and upstream API are mocked below.
import worker from "../workers/lifeos-plaid-sandbox/worker.js";

test("sync failures do not commit summary or cursor", async () => {
  const writes: string[] = [];
  const db = {
    prepare(sql: string) {
      return {
        bind() { return this; },
        async first() {
          if (sql.includes("SELECT access_token_ciphertext")) return {
            access_token_ciphertext: "ciphertext-placeholder",
            access_token_nonce: "nonce-placeholder",
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
    PLAID_TOKEN_ENCRYPTION_KEY: "test-value"
  };
  const originalFetch = globalThis.fetch;
  let call = 0;
  globalThis.fetch = (async () => {
    call++;
    if (call === 1) return new Response(JSON.stringify({ accounts: [] }), { status: 200 });
    return new Response(JSON.stringify({ error_code: "MOCK_FAILURE" }), { status: 500 });
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request("https://worker.test/api/transactions/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: "mock-item" })
    }), env);
    assert.equal(response.status, 500);
    assert.equal(writes.some(sql => /plaid_sync_summaries|plaid_transaction_cursors|sync_cursor/i.test(sql)), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
