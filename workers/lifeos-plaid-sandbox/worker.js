const PLAID_HOSTS = {
  sandbox: "https://sandbox.plaid.com",
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

function corsResponse(request, response) {
  const origin = request.headers.get("Origin");
  const allowedPreview = typeof origin === "string" &&
    origin.startsWith("https://") &&
    origin.endsWith(".finance-trackerzip.pages.dev") &&
    origin.slice(8).split(".").length === 4;
  const allowed = origin === "https://finance-trackerzip.pages.dev" || allowedPreview;
  const headers = new Headers(response.headers);
  if (allowed) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    headers.append("Vary", "Origin");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function plaid(env, path, body) {
  if (env.PLAID_ENV !== "sandbox") {
    throw new Error("This Worker is restricted to Plaid Sandbox");
  }
  if (!env.PLAID_CLIENT_ID || !env.PLAID_SECRET) {
    throw new Error("Plaid configuration is incomplete");
  }
  const response = await fetch(PLAID_HOSTS.sandbox + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...body,
      client_id: env.PLAID_CLIENT_ID,
      secret: env.PLAID_SECRET,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    console.error("Plaid API error", {
      path,
      status: response.status,
      error_code: data.error_code,
    });
    throw new Error("Plaid API request failed");
  }
  return data;
}

async function encryptionKey(env) {
  if (!env.PLAID_TOKEN_ENCRYPTION_KEY) {
    throw new Error("Encryption key is missing");
  }
  const material = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(env.PLAID_TOKEN_ENCRYPTION_KEY)
  );
  return crypto.subtle.importKey(
    "raw", material, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]
  );
}

function toBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(normalized + "=".repeat((4 - normalized.length % 4) % 4)), c => c.charCodeAt(0));
}

async function encryptToken(env, token) {
  const key = await encryptionKey(env);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    key,
    new TextEncoder().encode(token)
  );
  return {
    ciphertext: toBase64(new Uint8Array(encrypted)),
    nonce: toBase64(nonce),
    keyVersion: 1,
  };
}

async function decryptToken(env, row) {
  if (Number(row.token_key_version) !== 1) {
    throw new Error("Unsupported token encryption key version");
  }
  const key = await encryptionKey(env);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(row.access_token_nonce) },
    key,
    fromBase64(row.access_token_ciphertext)
  );
  return new TextDecoder().decode(plaintext);
}

async function getStoredAccessToken(env, itemId) {
  const row = await env.DB.prepare(
    "SELECT access_token_ciphertext, access_token_nonce, token_key_version FROM plaid_items WHERE item_id = ? AND status != 'disconnected'"
  ).bind(itemId).first();
  if (!row) return null;
  return decryptToken(env, row);
}

async function persistAccounts(env, itemId, accounts) {
  const now = new Date().toISOString();
  for (const account of accounts || []) {
    if (!account.account_id || !account.name) continue;
    await env.DB.prepare(
      "INSERT INTO plaid_accounts (account_id, item_id, name, official_name, mask, type, subtype, iso_currency_code, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(account_id) DO UPDATE SET item_id=excluded.item_id, name=excluded.name, official_name=excluded.official_name, mask=excluded.mask, type=excluded.type, subtype=excluded.subtype, iso_currency_code=excluded.iso_currency_code, updated_at=excluded.updated_at"
    ).bind(
      account.account_id,
      itemId,
      account.name,
      account.official_name ?? null,
      account.mask ?? null,
      account.type ?? null,
      account.subtype ?? null,
      account.balances?.iso_currency_code ?? account.balances?.unofficial_currency_code ?? null,
      now,
      now
    ).run();
  }
}

async function verifyPlaidWebhook(request, env, rawBody) {
  const jwt = request.headers.get("Plaid-Verification");
  if (!jwt) return false;
  const parts = jwt.split(".");
  if (parts.length !== 3) return false;
  let header, claims;
  try {
    header = JSON.parse(new TextDecoder().decode(fromBase64(parts[0])));
    claims = JSON.parse(new TextDecoder().decode(fromBase64(parts[1])));
  } catch {
    return false;
  }
  if (header.alg !== "ES256" || !header.kid) return false;
  if (!Number.isFinite(claims.iat) ||
      Math.abs(Date.now() / 1000 - claims.iat) > 300) return false;

  const bodyHash = await crypto.subtle.digest(
    "SHA-256", new TextEncoder().encode(rawBody)
  );
  const hashHex = [...new Uint8Array(bodyHash)]
    .map(b => b.toString(16).padStart(2, "0")).join("");
  if (claims.request_body_sha256 !== hashHex) return false;

  const result = await plaid(env, "/webhook_verification_key/get", { key_id: header.kid });
  const jwk = result.key;
  if (!jwk || jwk.alg !== "ES256" || jwk.use !== "sig") return false;
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, ext: true },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"]
  );
  return crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    fromBase64(parts[2]),
    new TextEncoder().encode(parts[0] + "." + parts[1])
  );
}

async function handleRequest(request, env) {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/health") {
    try {
      await env.DB.prepare("SELECT 1 AS result").first();
      const configOk = env.PLAID_ENV === "sandbox" &&
        Boolean(env.PLAID_CLIENT_ID) &&
        Boolean(env.PLAID_SECRET) &&
        Boolean(env.PLAID_TOKEN_ENCRYPTION_KEY);
      return json({
        ok: true,
        service: "lifeos-plaid-sandbox",
        database: "ok",
        plaid_environment: env.PLAID_ENV === "sandbox" ? "sandbox" : "blocked",
        configuration_ready: configOk,
      });
    } catch {
      return json({ ok: false, service: "lifeos-plaid-sandbox", database: "error" }, 503);
    }
  }

  if (request.method === "GET" && url.pathname === "/diagnostics/plaid") {
    try {
      const result = await plaid(env, "/link/token/create", {
        user: { client_user_id: "lifeos-diagnostic-user" },
        client_name: "LifeOS",
        products: ["transactions"],
        country_codes: ["US"],
        language: "en",
      });
      return json({
        ok: true,
        service: "lifeos-plaid-sandbox",
        plaid_reachable: true,
        link_token_created: Boolean(result?.link_token),
        expiration: result?.expiration ?? null,
      });
    } catch {
      console.error("Plaid diagnostic failed");
      return json({
        ok: false,
        service: "lifeos-plaid-sandbox",
        plaid_reachable: false,
        message: "Plaid Link-token creation failed. Check Worker logs.",
      }, 502);
    }
  }

  try {
    if (request.method === "POST" && url.pathname === "/api/link/token/create") {
      const body = await request.json().catch(() => ({}));
      const result = await plaid(env, "/link/token/create", {
        user: { client_user_id: "lifeos-user" },
        client_name: "LifeOS",
        products: ["transactions"],
        country_codes: ["US"],
        language: "en",
        ...(body.redirect_uri ? { redirect_uri: body.redirect_uri } : {}),
      });
      return json({ link_token: result.link_token, expiration: result.expiration });
    }

    if (request.method === "POST" && url.pathname === "/api/item/public-token/exchange") {
      const body = await request.json();
      if (typeof body.public_token !== "string" || !body.public_token.startsWith("public-")) {
        return json({ error: "Valid public_token required" }, 400);
      }
      const exchanged = await plaid(env, "/item/public_token/exchange", {
        public_token: body.public_token,
      });
      const encrypted = await encryptToken(env, exchanged.access_token);
      const now = new Date().toISOString();
      await env.DB.prepare(
        "INSERT INTO plaid_items (item_id, institution_id, institution_name, access_token_ciphertext, access_token_nonce, token_key_version, status, consented_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?) ON CONFLICT(item_id) DO UPDATE SET institution_id=excluded.institution_id, institution_name=excluded.institution_name, access_token_ciphertext=excluded.access_token_ciphertext, access_token_nonce=excluded.access_token_nonce, token_key_version=excluded.token_key_version, status='active', updated_at=excluded.updated_at"
      ).bind(
        exchanged.item_id,
        exchanged.institution_id ?? null,
        exchanged.institution_name ?? null,
        encrypted.ciphertext,
        encrypted.nonce,
        encrypted.keyVersion,
        now,
        now,
        now
      ).run();
      return json({ item_id: exchanged.item_id });
    }

    if (request.method === "POST" && url.pathname === "/api/accounts/get") {
      const body = await request.json();
      if (typeof body.item_id !== "string" || !body.item_id) {
        return json({ error: "item_id required" }, 400);
      }
      const accessToken = await getStoredAccessToken(env, body.item_id);
      if (!accessToken) return json({ error: "Item not found" }, 404);
      const result = await plaid(env, "/accounts/get", { access_token: accessToken });
      await persistAccounts(env, body.item_id, result.accounts || []);
      return json({
        accounts: (result.accounts || []).map(a => ({
          account_id: a.account_id,
          name: a.name,
          official_name: a.official_name,
          type: a.type,
          subtype: a.subtype,
          mask: a.mask,
          balances: a.balances,
        })),
      });
    }

    if (request.method === "POST" && url.pathname === "/api/transactions/get") {
      const body = await request.json();
      if (typeof body.item_id !== "string" || !body.item_id) {
        return json({ error: "item_id required" }, 400);
      }
      const validDate = value => typeof value === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        !Number.isNaN(Date.parse(value + "T00:00:00Z"));
      if (!validDate(body.start_date) || !validDate(body.end_date) ||
          body.start_date > body.end_date) {
        return json({ error: "Valid start_date and end_date in YYYY-MM-DD format are required" }, 400);
      }
      const accessToken = await getStoredAccessToken(env, body.item_id);
      if (!accessToken) return json({ error: "Item not found" }, 404);
      const result = await plaid(env, "/transactions/get", {
        access_token: accessToken,
        start_date: body.start_date,
        end_date: body.end_date,
        options: { count: 500, offset: 0 },
      });
      const accountNames = new Map((result.accounts || []).map(a => [a.account_id, a.name]));
      const transactions = (result.transactions || []).map(t => ({
        transaction_id: t.transaction_id,
        date: t.date,
        posted_datetime: t.datetime ?? t.authorized_datetime ?? t.date,
        amount: t.amount,
        name: t.name,
        merchant_name: t.merchant_name ?? null,
        account_id: t.account_id,
        account_name: accountNames.get(t.account_id) ?? null,
        pending: Boolean(t.pending),
        currency: t.iso_currency_code ?? "USD",
        iso_currency_code: t.iso_currency_code ?? null,
        category: t.personal_finance_category?.primary ?? t.category?.[0] ?? null,
      }));
      return json({
        transactions,
        total_transactions: result.total_transactions ?? transactions.length,
        returned: transactions.length,
      });
    }

    if (request.method === "POST" && url.pathname === "/api/transactions/sync") {
      const body = await request.json();
      if (typeof body.item_id !== "string" || !body.item_id) {
        return json({ error: "item_id required" }, 400);
      }
      const accessToken = await getStoredAccessToken(env, body.item_id);
      if (!accessToken) return json({ error: "Item not found" }, 404);

      // Populate account rows first so transaction foreign keys are satisfied.
      const accountResult = await plaid(env, "/accounts/get", { access_token: accessToken });
      await persistAccounts(env, body.item_id, accountResult.accounts || []);

      const cursorRow = await env.DB.prepare(
        "SELECT cursor FROM plaid_transaction_cursors WHERE item_id = ?"
      ).bind(body.item_id).first();
      let cursor = cursorRow?.cursor ?? undefined;
      let addedCount = 0;
      let modifiedCount = 0;
      let removedCount = 0;
      let hasMore = false;
      let pages = 0;

      do {
        const syncBody = { access_token: accessToken, count: 500 };
        if (cursor) syncBody.cursor = cursor;
        const result = await plaid(env, "/transactions/sync", syncBody);
        const now = new Date().toISOString();

        for (const transaction of [...(result.added || []), ...(result.modified || [])]) {
          if (!transaction.transaction_id || !transaction.account_id ||
              !transaction.date || !transaction.name ||
              typeof transaction.amount !== "number") {
            throw new Error("Plaid returned a transaction missing required database fields");
          }
          await env.DB.prepare(
            "INSERT INTO plaid_transactions (transaction_id, item_id, account_id, date, authorized_date, name, merchant_name, amount, iso_currency_code, pending, removed, personal_finance_category_primary, personal_finance_category_detailed, raw_json, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?) ON CONFLICT(transaction_id) DO UPDATE SET item_id=excluded.item_id, account_id=excluded.account_id, date=excluded.date, authorized_date=excluded.authorized_date, name=excluded.name, merchant_name=excluded.merchant_name, amount=excluded.amount, iso_currency_code=excluded.iso_currency_code, pending=excluded.pending, removed=0, personal_finance_category_primary=excluded.personal_finance_category_primary, personal_finance_category_detailed=excluded.personal_finance_category_detailed, raw_json=excluded.raw_json, last_seen_at=excluded.last_seen_at"
          ).bind(
            transaction.transaction_id,
            body.item_id,
            transaction.account_id,
            transaction.date,
            transaction.authorized_date ?? null,
            transaction.name,
            transaction.merchant_name ?? null,
            transaction.amount,
            transaction.iso_currency_code ?? null,
            transaction.pending ? 1 : 0,
            transaction.personal_finance_category?.primary ?? null,
            transaction.personal_finance_category?.detailed ?? null,
            JSON.stringify(transaction),
            now,
            now
          ).run();
        }

        addedCount += (result.added || []).length;
        modifiedCount += (result.modified || []).length;
        for (const removed of result.removed || []) {
          if (!removed.transaction_id) continue;
          await env.DB.prepare(
            "UPDATE plaid_transactions SET removed=1, last_seen_at=? WHERE transaction_id=? AND item_id=?"
          ).bind(now, removed.transaction_id, body.item_id).run();
        }
        removedCount += (result.removed || []).length;

        cursor = result.next_cursor;
        hasMore = Boolean(result.has_more);
        if (typeof cursor !== "string" || !cursor) {
          throw new Error("Plaid sync response did not include a cursor");
        }
        await env.DB.prepare(
          "INSERT INTO plaid_transaction_cursors (item_id, cursor, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(item_id) DO UPDATE SET cursor=excluded.cursor, updated_at=CURRENT_TIMESTAMP"
        ).bind(body.item_id, cursor).run();
        await env.DB.prepare(
          "UPDATE plaid_items SET sync_cursor=?, last_synced_at=?, updated_at=? WHERE item_id=?"
        ).bind(cursor, now, now, body.item_id).run();
        pages += 1;
      } while (hasMore && pages < 10);

      return json({
        item_id: body.item_id,
        added: addedCount,
        modified: modifiedCount,
        removed: removedCount,
        pages,
        has_more: hasMore,
        complete: !hasMore,
      }, hasMore ? 202 : 200);
    }

    if (request.method === "POST" && url.pathname === "/webhook") {
      const rawBody = await request.text();
      let verified = false;
      try {
        verified = await verifyPlaidWebhook(request, env, rawBody);
      } catch {
        console.error("Webhook verification failed");
      }
      if (!verified) return json({ error: "Invalid webhook signature" }, 401);

      let event;
      try {
        event = JSON.parse(rawBody);
      } catch {
        return json({ error: "Invalid webhook payload" }, 400);
      }
      if (!event.webhook_type || !event.webhook_code) {
        return json({ error: "Invalid webhook payload" }, 400);
      }
      const digest = await crypto.subtle.digest(
        "SHA-256", new TextEncoder().encode(rawBody)
      );
      const eventId = [...new Uint8Array(digest)]
        .map(b => b.toString(16).padStart(2, "0")).join("");
      await env.DB.prepare(
        "INSERT OR IGNORE INTO plaid_webhook_events (event_key, item_id, webhook_type, webhook_code, received_at, status) VALUES (?, ?, ?, ?, ?, 'pending')"
      ).bind(
        eventId,
        event.item_id ?? null,
        event.webhook_type,
        event.webhook_code,
        new Date().toISOString()
      ).run();
      return json({ received: true });
    }

    return json({ error: "Not found" }, 404);
  } catch (error) {
    console.error("Worker request failed", {
      path: url.pathname,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return json({ error: "Internal server error" }, 500);
  }
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return corsResponse(request, new Response(null, { status: 204 }));
    }
    return corsResponse(request, await handleRequest(request, env));
  },
};