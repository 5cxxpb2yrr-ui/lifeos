import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/usaa-bridge/[[path]]";

const env = { BRIDGE_PROXY_TOKEN: "x".repeat(48), USAA_BRIDGE: { fetch: async () => new Response("unexpected") } };

test("USAA bridge proxy rejects unauthenticated requests before forwarding", async () => {
  for (const method of ["GET", "PATCH"]) {
    let calls = 0;
    const response = await onRequest({
      request: new Request("https://lifeos.example/api/usaa-bridge/v1/deposits", { method }),
      env: { ...env, USAA_BRIDGE: { fetch: async () => { calls++; return new Response("unexpected"); } } },
    });
    assert.equal(response.status, 401);
    assert.equal(calls, 0);
  }
});

test("USAA bridge proxy rejects malformed Access JWT before forwarding", async () => {
  let calls = 0;
  const response = await onRequest({
    request: new Request("https://lifeos.example/api/usaa-bridge/v1/deposits", { headers: { "Cf-Access-Jwt-Assertion": "not.a.jwt" } }),
    env: { ...env, USAA_BRIDGE: { fetch: async () => { calls++; return new Response("unexpected"); } } },
  });
  assert.equal(response.status, 401);
  assert.equal(calls, 0);
});

test("USAA bridge proxy denies unsupported methods", async () => {
  const response = await onRequest({
    request: new Request("https://lifeos.example/api/usaa-bridge/v1/deposits", { method: "POST" }),
    env,
  });
  assert.equal(response.status, 405);
});
