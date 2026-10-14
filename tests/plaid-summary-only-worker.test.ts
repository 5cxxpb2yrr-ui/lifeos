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


test("completed empty sync commits only summary and cursor metadata", async () => {
  const writes: string[] = [];
  const secret = "test-value";
  const nonce = new Uint8Array(12).fill(3);
  const material = await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  const key = await webcrypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, ["encrypt"]);
  const cipher = await webcrypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, new TextEncoder().encode("sandbox-placeholder"));
  const db = {
    prepare(sql: string) {
      return {
        sql,
        bind() { return this; },
        async first() {
          if (sql.includes("SELECT access_token_ciphertext")) return {
            access_token_ciphertext: Buffer.from(cipher).toString("base64"),
            access_token_nonce: Buffer.from(nonce).toString("base64"),
            token_key_version: 1
          };
          return null;
        },
        async run() { return {}; }
      };
    },
    async batch(statements: Array<{sql: string}>) {
      writes.push(...statements.map(statement => statement.sql));
      return [];
    }
  };
  const env = { DB: db, PLAID_ENV: "sandbox", PLAID_CLIENT_ID: "test", PLAID_SECRET: "test", PLAID_TOKEN_ENCRYPTION_KEY: secret };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const path = String(input);
    if (path.endsWith("/accounts/get")) return new Response(JSON.stringify({ accounts: [] }), { status: 200 });
    if (path.endsWith("/transactions/sync")) return new Response(JSON.stringify({
      added: [], modified: [], removed: [], next_cursor: "cursor-after", has_more: false
    }), { status: 200 });
    throw new Error("Unexpected mocked endpoint");
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request("https://worker.test/api/transactions/sync", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ item_id: "mock-item" })
    }), env);
    const body = await response.json() as { complete?: boolean; cursor_committed?: boolean; raw_transactions_persisted?: boolean; summary?: { transactionCount?: number; aggregationScope?: string; changeCounts?: { added?: number; modified?: number; removed?: number }; interpretation?: { cumulativeLedger?: boolean } } };
    assert.equal(response.status, 200);
    assert.equal(body.complete, true);
    assert.equal(body.cursor_committed, true);
    assert.equal(body.raw_transactions_persisted, false);
    assert.equal(body.summary?.transactionCount, 0);
    assert.equal(body.summary?.aggregationScope, "completed-change-batch");
    assert.deepEqual(body.summary?.changeCounts, { added: 0, modified: 0, removed: 0 });
    assert.equal(body.summary?.interpretation?.cumulativeLedger, false);
    assert.equal(writes.length, 3);
    assert.ok(writes.some(sql => sql.includes("INSERT OR IGNORE INTO plaid_sync_summaries")));
    assert.ok(writes.some(sql => sql.includes("plaid_transaction_cursors")));
    assert.ok(writes.some(sql => sql.includes("UPDATE plaid_items SET sync_cursor")));
    assert.equal(writes.some(sql => /INSERT INTO plaid_transactions/i.test(sql)), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("incomplete pagination never commits a partial summary or cursor", async () => {
  const secret = "test-value";
  const nonce = new Uint8Array(12).fill(9);
  const material = await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  const key = await webcrypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, ["encrypt"]);
  const cipher = await webcrypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, new TextEncoder().encode("sandbox-placeholder"));
  let syncPages = 0;
  let batchCalls = 0;
  const db = {
    prepare(sql: string) {
      return {
        bind() { return this; },
        async first() {
          if (sql.includes("SELECT access_token_ciphertext")) return {
            access_token_ciphertext: Buffer.from(cipher).toString("base64"),
            access_token_nonce: Buffer.from(nonce).toString("base64"),
            token_key_version: 1
          };
          return null;
        },
        async run() { return {}; }
      };
    },
    async batch() { batchCalls += 1; return []; }
  };
  const env = { DB: db, PLAID_ENV: "sandbox", PLAID_CLIENT_ID: "test", PLAID_SECRET: "test", PLAID_TOKEN_ENCRYPTION_KEY: secret };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const path = String(input);
    if (path.endsWith("/accounts/get")) return new Response(JSON.stringify({ accounts: [] }), { status: 200 });
    if (path.endsWith("/transactions/sync")) {
      syncPages += 1;
      return new Response(JSON.stringify({
        added: [], modified: [], removed: [], next_cursor: `cursor-${syncPages}`, has_more: true
      }), { status: 200 });
    }
    throw new Error("Unexpected mocked endpoint");
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request("https://worker.test/api/transactions/sync", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ item_id: "mock-item" })
    }), env);
    const body = await response.json() as { complete?: boolean; cursor_committed?: boolean };
    assert.equal(response.status, 503);
    assert.equal(syncPages, 100, "pagination should stop at the configured safety limit");
    assert.equal(body.complete, false);
    assert.equal(body.cursor_committed, false);
    assert.equal(batchCalls, 0, "partial sync must not commit summary or cursor");
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("retry resumes from the last committed cursor after a failed page", async () => {
  const secret = "test-value";
  const nonce = new Uint8Array(12).fill(11);
  const material = await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  const key = await webcrypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, ["encrypt"]);
  const cipher = await webcrypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, new TextEncoder().encode("sandbox-placeholder"));
  let syncAttempts = 0;
  const requestedCursors: Array<string | undefined> = [];
  let batchCalls = 0;
  const db = {
    prepare(sql: string) {
      return {
        bind() { return this; },
        async first() {
          if (sql.includes("SELECT access_token_ciphertext")) return {
            access_token_ciphertext: Buffer.from(cipher).toString("base64"),
            access_token_nonce: Buffer.from(nonce).toString("base64"),
            token_key_version: 1
          };
          if (sql.includes("SELECT cursor FROM plaid_transaction_cursors")) return { cursor: "last-committed" };
          return null;
        },
        async run() { return {}; }
      };
    },
    async batch() { batchCalls += 1; return []; }
  };
  const env = { DB: db, PLAID_ENV: "sandbox", PLAID_CLIENT_ID: "test", PLAID_SECRET: "test", PLAID_TOKEN_ENCRYPTION_KEY: secret };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const path = String(input);
    if (path.endsWith("/accounts/get")) return new Response(JSON.stringify({ accounts: [] }), { status: 200 });
    if (path.endsWith("/transactions/sync")) {
      const payload = JSON.parse(String(init?.body ?? "{}")) as { cursor?: string };
      requestedCursors.push(payload.cursor);
      syncAttempts += 1;
      if (syncAttempts === 1) return new Response(JSON.stringify({ error_code: "TEMPORARY_FAILURE" }), { status: 500 });
      return new Response(JSON.stringify({
        added: [], modified: [], removed: [], next_cursor: "next-committed", has_more: false
      }), { status: 200 });
    }
    throw new Error("Unexpected mocked endpoint");
  }) as typeof fetch;
  try {
    const makeRequest = () => new Request("https://worker.test/api/transactions/sync", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ item_id: "mock-item" })
    });
    const failed = await worker.fetch(makeRequest(), env);
    assert.equal(failed.status, 500);
    assert.equal(batchCalls, 0, "failed attempt must not commit the cursor or summary");

    const retried = await worker.fetch(makeRequest(), env);
    const body = await retried.json() as { complete?: boolean; cursor_committed?: boolean };
    assert.equal(retried.status, 200);
    assert.equal(body.complete, true);
    assert.equal(body.cursor_committed, true);
    assert.deepEqual(requestedCursors, ["last-committed", "last-committed"]);
    assert.equal(batchCalls, 1, "only the successful retry commits");
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("completed change batch summarizes modified records and counts removals without storing rows", async () => {
  const secret = "test-value";
  const nonce = new Uint8Array(12).fill(13);
  const material = await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  const key = await webcrypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, ["encrypt"]);
  const cipher = await webcrypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, new TextEncoder().encode("sandbox-placeholder"));
  const writes: string[] = [];
  let savedSummaryJson = "";
  const db = {
    prepare(sql: string) {
      return {
        sql,
        values: [] as unknown[],
        bind(...values: unknown[]) { this.values = values; return this; },
        async first() {
          if (sql.includes("SELECT access_token_ciphertext")) return {
            access_token_ciphertext: Buffer.from(cipher).toString("base64"),
            access_token_nonce: Buffer.from(nonce).toString("base64"),
            token_key_version: 1
          };
          return null;
        },
        async run() { writes.push(sql); return {}; }
      };
    },
    async batch(statements: Array<{ sql: string; values?: unknown[] }>) {
      writes.push(...statements.map(statement => statement.sql));
      const summaryInsert = statements.find(statement => statement.sql.includes("INSERT OR IGNORE INTO plaid_sync_summaries"));
      savedSummaryJson = String(summaryInsert?.values?.[7] ?? "");
      return [];
    }
  };
  const env = { DB: db, PLAID_ENV: "sandbox", PLAID_CLIENT_ID: "test", PLAID_SECRET: "test", PLAID_TOKEN_ENCRYPTION_KEY: secret };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const path = String(input);
    if (path.endsWith("/accounts/get")) {
      return new Response(JSON.stringify({ accounts: [{ account_id: "sandbox-account", name: "Sandbox checking" }] }), { status: 200 });
    }
    if (path.endsWith("/transactions/sync")) {
      return new Response(JSON.stringify({
        added: [{
          transaction_id: "synthetic-added-id",
          account_id: "sandbox-account",
          date: "2026-10-02",
          amount: 5.67,
          name: "Synthetic added entry",
          personal_finance_category: { primary: "GENERAL_MERCHANDISE", detailed: "GENERAL_MERCHANDISE_OTHER" }
        }],
        modified: [{
          transaction_id: "synthetic-modified-id",
          account_id: "sandbox-account",
          date: "2026-10-01",
          amount: 12.34,
          name: "Synthetic test entry",
          personal_finance_category: { primary: "GENERAL_MERCHANDISE", detailed: "GENERAL_MERCHANDISE_OTHER" }
        }],
        removed: [{ transaction_id: "synthetic-removed-id" }],
        next_cursor: "cursor-after-changes",
        has_more: false
      }), { status: 200 });
    }
    throw new Error("Unexpected mocked endpoint");
  }) as typeof fetch;
  try {
    const response = await worker.fetch(new Request("https://worker.test/api/transactions/sync", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ item_id: "mock-item" })
    }), env);
    const body = await response.json() as {
      complete?: boolean;
      raw_transactions_persisted?: boolean;
      summary?: { changeCounts?: { added?: number; modified?: number; removed?: number }; transactionCount?: number; interpretation?: { cumulativeLedger?: boolean }; retention?: { rawTransactionsPersisted?: boolean } }
    };
    assert.equal(response.status, 200);
    assert.equal(body.complete, true);
    assert.equal(body.raw_transactions_persisted, false);
    assert.deepEqual(body.summary?.changeCounts, { added: 1, modified: 1, removed: 1 });
    assert.equal(body.summary?.transactionCount, 1);
    assert.equal(body.summary?.interpretation?.cumulativeLedger, false);
    assert.equal(body.summary?.retention?.rawTransactionsPersisted, false);
    assert.ok(savedSummaryJson.length > 0, "aggregate JSON summary should be the only persisted transaction result");
    assert.equal(savedSummaryJson.includes("synthetic-added-id"), false);
    assert.equal(savedSummaryJson.includes("Synthetic added entry"), false);
    assert.equal(savedSummaryJson.includes("synthetic-modified-id"), false);
    assert.equal(savedSummaryJson.includes("Synthetic test entry"), false);
    assert.equal(writes.some(sql => /INSERT INTO plaid_transactions/i.test(sql)), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
