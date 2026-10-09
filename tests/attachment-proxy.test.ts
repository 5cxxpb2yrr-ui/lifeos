import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/attachments/[[path]]";

test("attachment proxy rejects reads, uploads, and deletes without an Access JWT", async () => {
  for (const method of ["GET", "PUT", "DELETE"]) {
    let calls = 0;
    const response = await onRequest({
      request: new Request("https://lifeos.example/api/attachments/Attachments/vehicle/v1/manual.pdf", {
        method,
        body: method === "PUT" ? "file bytes" : undefined,
      }),
      env: { ATTACHMENTS: { fetch: async () => { calls += 1; return new Response("unexpected"); } } },
    });
    assert.equal(response.status, 401, method + " should require an Access JWT");
    assert.equal(calls, 0, method + " must not reach storage when unauthenticated");
  }
});

test("attachment proxy rejects malformed JWTs before calling storage", async () => {
  let calls = 0;
  const response = await onRequest({
    request: new Request("https://lifeos.example/api/attachments/Attachments/vehicle/v1/manual.pdf", {
      headers: { "Cf-Access-Jwt-Assertion": "not.a.valid-jwt" },
    }),
    env: { ATTACHMENTS: { fetch: async () => { calls += 1; return new Response("unexpected"); } } },
  });
  assert.equal(response.status, 401);
  assert.equal(calls, 0);
});

test("attachment proxy rejects unsupported methods before calling storage", async () => {
  let calls = 0;
  const response = await onRequest({
    request: new Request("https://lifeos.example/api/attachments/Attachments/vehicle/v1/manual.pdf", { method: "POST" }),
    env: { ATTACHMENTS: { fetch: async () => { calls += 1; return new Response("unexpected"); } } },
  });
  assert.equal(response.status, 405);
  assert.equal(calls, 0);
});
