import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/plaid/[[path]]";

test("Plaid API rejects methods other than POST", async () => {
  const response = await onRequest({
    request: new Request("https://lifeos.example/api/plaid/link-token", { method: "GET" }),
    env: {},
  });
  assert.equal(response.status, 405);
  assert.match((await response.json() as { error: string }).error, /Method not allowed/);
});

test("Plaid API requires a signed Cloudflare Access assertion", async () => {
  const response = await onRequest({
    request: new Request("https://lifeos.example/api/plaid/link-token", { method: "POST" }),
    env: { PLAID_ENV: "sandbox", PLAID_CLIENT_ID: "test-client", PLAID_SECRET: "test-secret" },
  });
  assert.equal(response.status, 401);
  assert.match((await response.json() as { error: string }).error, /sign-in is required/);
});
