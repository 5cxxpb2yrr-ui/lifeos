import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/plaid/[[path]]";

test("Plaid API rejects unauthenticated Preview requests before method handling", async () => {
  const response = await onRequest({
    request: new Request("https://feat-plaid-sandbox-foundatio.finance-trackerzip.pages.dev/api/plaid/link-token", { method: "GET" }),
    env: {},
  });
  assert.equal(response.status, 401);
  assert.match((await response.json() as { error: string }).error, /sign-in is required/);
});

test("Plaid API requires a signed Cloudflare Access assertion", async () => {
  const response = await onRequest({
    request: new Request("https://feat-plaid-sandbox-foundatio.finance-trackerzip.pages.dev/api/plaid/link-token", { method: "POST" }),
    env: { PLAID_ENV: "sandbox", PLAID_CLIENT_ID: "test-client", PLAID_SECRET: "test-secret" },
  });
  assert.equal(response.status, 401);
  assert.match((await response.json() as { error: string }).error, /sign-in is required/);
});

test("Plaid API blocks the production Pages hostname before checking credentials", async () => {
  const response = await onRequest({
    request: new Request("https://finance-trackerzip.pages.dev/api/plaid/link-token", { method: "POST" }),
    env: { PLAID_ENV: "sandbox", PLAID_CLIENT_ID: "test-client", PLAID_SECRET: "test-secret" },
  });
  assert.equal(response.status, 404);
  assert.match((await response.json() as { error: string }).error, /Preview deployment/);
});

test("Plaid API permits the Pages preview host to reach Access authentication", async () => {
  const response = await onRequest({
    request: new Request("https://feat-plaid-sandbox-foundatio.finance-trackerzip.pages.dev/api/plaid/link-token", { method: "POST" }),
    env: { PLAID_ENV: "sandbox", PLAID_CLIENT_ID: "test-client", PLAID_SECRET: "test-secret" },
  });
  assert.equal(response.status, 401);
  assert.match((await response.json() as { error: string }).error, /sign-in is required/);
});
