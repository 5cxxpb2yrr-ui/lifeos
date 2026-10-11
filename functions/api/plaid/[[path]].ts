type D1Database = {
  prepare(sql: string): { bind(...values: unknown[]): { first<T = Record<string, unknown>>(): Promise<T | null>; all<T = Record<string, unknown>>(): Promise<{ results: T[] }>; run(): Promise<unknown> } };
  batch<T = unknown>(statements: unknown[]): Promise<T[]>;
};
type PlaidEnv = {
  PLAID_DB?: D1Database;
  PLAID_CLIENT_ID?: string;
  PLAID_SECRET?: string;
  PLAID_ENV?: string;
  PLAID_TOKEN_ENCRYPTION_KEY?: string;
};
type PlaidContext = { request: Request; env: PlaidEnv };
type AccessPayload = { iss?: string; aud?: string | string[]; exp?: number; nbf?: number };
type PlaidAccount = { account_id: string; name: string; official_name?: string | null; mask?: string | null; type?: string; subtype?: string | null; balances?: { iso_currency_code?: string | null } };
type PlaidTransaction = {
  transaction_id: string; account_id: string; date: string; authorized_date?: string | null;
  name: string; merchant_name?: string | null; amount: number; iso_currency_code?: string | null;
  pending?: boolean; personal_finance_category?: { primary?: string; detailed?: string };
};
const ACCESS_ISSUER = "https://phoenix-65w-pages.cloudflareaccess.com";
const ACCESS_AUDIENCE = "68d8678f9ee7cac7e819bc369b154512b6f6b3ce2a97cdf38c95290825b45806";
const ACCESS_JWKS_URL = `${ACCESS_ISSUER}/cdn-cgi/access/certs`;
const PLAID_HOSTS: Record<string, string> = {
  sandbox: "https://sandbox.plaid.com",
  development: "https://development.plaid.com",
  production: "https://production.plaid.com",
};
let jwksCache: { expiresAt: number; keys: JsonWebKey[] } | null = null;

function b64url(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
function jsonPart<T>(value: string): T { return JSON.parse(new TextDecoder().decode(b64url(value))) as T; }
async function accessKeys(): Promise<JsonWebKey[]> {
  if (jwksCache && jwksCache.expiresAt > Date.now()) return jwksCache.keys;
  const response = await fetch(ACCESS_JWKS_URL, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Access signing keys unavailable");
  const data = await response.json() as { keys?: JsonWebKey[] };
  if (!Array.isArray(data.keys) || !data.keys.length) throw new Error("No Access signing keys");
  jwksCache = { keys: data.keys, expiresAt: Date.now() + 300_000 };
  return data.keys;
}
async function validAccess(token: string): Promise<boolean> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const header = jsonPart<{ alg?: string; kid?: string }>(parts[0]);
    const payload = jsonPart<AccessPayload>(parts[1]);
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    const now = Math.floor(Date.now() / 1000);
    if (header.alg !== "RS256" || !header.kid || payload.iss !== ACCESS_ISSUER ||
        !audiences.includes(ACCESS_AUDIENCE) || !payload.exp || payload.exp <= now ||
        (payload.nbf !== undefined && payload.nbf > now)) return false;
    const jwk = (await accessKeys()).find((key) => (key as JsonWebKey & { kid?: string }).kid === header.kid);
    if (!jwk) return false;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    return crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64url(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]));
  } catch { return false; }
}
function response(status: number, body: Record<string, unknown>): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
function isPreviewDeployment(request: Request): boolean {
  const hostname = new URL(request.url).hostname.toLowerCase();
  // Fail closed: the production Pages hostname and custom production domains are not allowed.
  // Cloudflare branch and commit preview deployments use non-root subdomains of this Pages hostname.
  return hostname.endsWith(".finance-trackerzip.pages.dev") &&
    hostname !== "finance-trackerzip.pages.dev";
}
function config(env: PlaidEnv): { host: string; clientId: string; secret: string } | null {
  // No default: Sandbox must be explicitly selected in the deployment configuration.
  const environment = env.PLAID_ENV;
  // Production is deliberately disabled in this foundation until Sandbox acceptance and explicit approval.
  if (environment !== "sandbox" || !env.PLAID_CLIENT_ID || !env.PLAID_SECRET) return null;
  return { host: PLAID_HOSTS[environment], clientId: env.PLAID_CLIENT_ID, secret: env.PLAID_SECRET };
}
async function plaidPost<T>(cfg: { host: string; clientId: string; secret: string }, path: string, data: Record<string, unknown>): Promise<T> {
  const res = await fetch(cfg.host + path, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: cfg.clientId, secret: cfg.secret, ...data }),
  });
  const body = await res.json() as T & { error_message?: string };
  if (!res.ok) throw new Error(body.error_message || "Plaid request failed");
  return body;
}
function base64(bytes: Uint8Array): string {
  let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
function decodeBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value); const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}
async function encryptionKey(env: PlaidEnv): Promise<CryptoKey> {
  if (!env.PLAID_TOKEN_ENCRYPTION_KEY) throw new Error("Token encryption is not configured");
  const raw = decodeBase64(env.PLAID_TOKEN_ENCRYPTION_KEY);
  if (raw.length !== 32) throw new Error("Token encryption key must be 32 bytes, base64 encoded");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function encryptToken(token: string, env: PlaidEnv): Promise<{ ciphertext: string; nonce: string }> {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, await encryptionKey(env), new TextEncoder().encode(token));
  return { ciphertext: base64(new Uint8Array(encrypted)), nonce: base64(nonce) };
}
async function decryptToken(ciphertext: string, nonce: string, env: PlaidEnv): Promise<string> {
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decodeBase64(nonce) }, await encryptionKey(env), decodeBase64(ciphertext));
  return new TextDecoder().decode(plaintext);
}
async function bodyObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value = await request.json();
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch { return null; }
}
function isoNow(): string { return new Date().toISOString(); }
function dbOrNull(env: PlaidEnv): D1Database | null { return env.PLAID_DB || null; }

export async function onRequest({ request, env }: PlaidContext): Promise<Response> {
  if (request.method !== "POST") return response(405, { error: "Method not allowed." });
  if (!isPreviewDeployment(request)) {
    return response(404, { error: "Plaid Sandbox is available only on a Cloudflare Pages Preview deployment." });
  }
  const assertion = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!assertion || !(await validAccess(assertion))) return response(401, { error: "LifeOS sign-in is required." });
  const url = new URL(request.url);
  const route = url.pathname.replace(/^\/api\/plaid\/?/, "").replace(/\/$/, "");
  const cfg = config(env);
  if (!cfg) return response(503, { error: "Plaid Sandbox server configuration is incomplete." });

  if (route === "link-token") {
    try {
      const result = await plaidPost<{ link_token: string; expiration: string }>(cfg, "/link/token/create", {
        user: { client_user_id: "lifeos-local-user" },
        client_name: "LifeOS", products: ["transactions"], country_codes: ["US"], language: "en",
        transactions: { days_requested: 90 },
      });
      return response(200, { link_token: result.link_token, expiration: result.expiration });
    } catch { return response(502, { error: "Could not create a Plaid Link token." }); }
  }

  if (route === "exchange") {
    const body = await bodyObject(request);
    if (typeof body?.public_token !== "string" || body.public_token.length > 4096) return response(400, { error: "A valid public_token is required." });
    const db = dbOrNull(env);
    if (!db) return response(503, { error: "Plaid database is not configured." });
    try {
      const exchanged = await plaidPost<{ access_token: string; item_id: string }>(cfg, "/item/public_token/exchange", { public_token: body.public_token });
      const encrypted = await encryptToken(exchanged.access_token, env);
      const now = isoNow();
      const institutionId = typeof body.institution_id === "string" ? body.institution_id.slice(0, 256) : null;
      const institutionName = typeof body.institution_name === "string" ? body.institution_name.slice(0, 256) : null;
      await db.prepare(`INSERT INTO plaid_items (item_id, institution_id, institution_name, access_token_ciphertext, access_token_nonce, token_key_version, status, consented_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, 'active', ?, ?, ?)
        ON CONFLICT(item_id) DO UPDATE SET institution_id=excluded.institution_id, institution_name=excluded.institution_name, access_token_ciphertext=excluded.access_token_ciphertext, access_token_nonce=excluded.access_token_nonce, status='active', updated_at=excluded.updated_at`)
        .bind(exchanged.item_id, institutionId, institutionName, encrypted.ciphertext, encrypted.nonce, now, now, now).run();
      const accounts = await plaidPost<{ accounts: PlaidAccount[] }>(cfg, "/accounts/get", { access_token: exchanged.access_token });
      for (const account of accounts.accounts || []) {
        await db.prepare(`INSERT INTO plaid_accounts (account_id, item_id, name, official_name, mask, type, subtype, iso_currency_code, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(account_id) DO UPDATE SET name=excluded.name, official_name=excluded.official_name, mask=excluded.mask, type=excluded.type, subtype=excluded.subtype, iso_currency_code=excluded.iso_currency_code, updated_at=excluded.updated_at`)
          .bind(account.account_id, exchanged.item_id, account.name, account.official_name ?? null, account.mask ?? null, account.type ?? null, account.subtype ?? null, account.balances?.iso_currency_code ?? null, now, now).run();
      }
      return response(200, { item_id: exchanged.item_id, accounts: (accounts.accounts || []).map(({ account_id, name, official_name, mask, type, subtype }) => ({ account_id, name, official_name, mask, type, subtype })) });
    } catch { return response(502, { error: "Could not securely save the Plaid connection. Please retry in Sandbox." }); }
  }

  if (route === "sync") {
    const body = await bodyObject(request);
    if (typeof body?.item_id !== "string" || body.item_id.length > 256) return response(400, { error: "A valid item_id is required." });
    const db = dbOrNull(env);
    if (!db) return response(503, { error: "Plaid database is not configured." });
    const item = await db.prepare("SELECT item_id, access_token_ciphertext, access_token_nonce, sync_cursor FROM plaid_items WHERE item_id = ? AND status = 'active'").bind(body.item_id).first<{ item_id: string; access_token_ciphertext: string; access_token_nonce: string; sync_cursor: string | null }>();
    if (!item) return response(404, { error: "Active Plaid connection not found." });
    try {
      const accessToken = await decryptToken(item.access_token_ciphertext, item.access_token_nonce, env);
      let cursor = item.sync_cursor || undefined;
      let hasMore = true; let pages = 0; let added = 0; let modified = 0; let removed = 0;
      while (hasMore && pages < 20) {
        const data = await plaidPost<{ added: PlaidTransaction[]; modified: PlaidTransaction[]; removed: { transaction_id: string }[]; next_cursor: string; has_more: boolean }>(cfg, "/transactions/sync", { access_token: accessToken, cursor, count: 500 });
        const now = isoNow();
        for (const tx of data.added || []) {
          await db.prepare(`INSERT INTO plaid_transactions (transaction_id,item_id,account_id,date,authorized_date,name,merchant_name,amount,iso_currency_code,pending,removed,personal_finance_category_primary,personal_finance_category_detailed,raw_json,first_seen_at,last_seen_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,0,?,?,?,?,?)
            ON CONFLICT(transaction_id) DO UPDATE SET account_id=excluded.account_id,date=excluded.date,authorized_date=excluded.authorized_date,name=excluded.name,merchant_name=excluded.merchant_name,amount=excluded.amount,iso_currency_code=excluded.iso_currency_code,pending=excluded.pending,removed=0,personal_finance_category_primary=excluded.personal_finance_category_primary,personal_finance_category_detailed=excluded.personal_finance_category_detailed,raw_json=excluded.raw_json,last_seen_at=excluded.last_seen_at`)
            .bind(tx.transaction_id,item.item_id,tx.account_id,tx.date,tx.authorized_date ?? null,tx.name,tx.merchant_name ?? null,tx.amount,tx.iso_currency_code ?? null,tx.pending ? 1 : 0,tx.personal_finance_category?.primary ?? null,tx.personal_finance_category?.detailed ?? null,JSON.stringify(tx),now,now).run();
          added++;
        }
        for (const tx of data.modified || []) {
          await db.prepare("UPDATE plaid_transactions SET account_id=?,date=?,authorized_date=?,name=?,merchant_name=?,amount=?,iso_currency_code=?,pending=?,removed=0,personal_finance_category_primary=?,personal_finance_category_detailed=?,raw_json=?,last_seen_at=? WHERE transaction_id=? AND item_id=?")
            .bind(tx.account_id,tx.date,tx.authorized_date ?? null,tx.name,tx.merchant_name ?? null,tx.amount,tx.iso_currency_code ?? null,tx.pending ? 1 : 0,tx.personal_finance_category?.primary ?? null,tx.personal_finance_category?.detailed ?? null,JSON.stringify(tx),now,tx.transaction_id,item.item_id).run();
          modified++;
        }
        for (const tx of data.removed || []) {
          await db.prepare("UPDATE plaid_transactions SET removed=1,last_seen_at=? WHERE transaction_id=? AND item_id=?").bind(now,tx.transaction_id,item.item_id).run();
          removed++;
        }
        cursor = data.next_cursor; hasMore = data.has_more; pages++;
      }
      if (hasMore) return response(503, { error: "Sync is larger than this request window; retry to continue safely.", pages, added, modified, removed });
      await db.prepare("UPDATE plaid_items SET sync_cursor=?,last_synced_at=?,updated_at=? WHERE item_id=?").bind(cursor ?? null,isoNow(),isoNow(),item.item_id).run();
      return response(200, { item_id: item.item_id, added, modified, removed, synced_at: isoNow() });
    } catch { return response(502, { error: "Plaid sync failed. Connection remains saved; retry after checking Sandbox status." }); }
  }

  return response(404, { error: "Unknown Plaid endpoint." });
}
