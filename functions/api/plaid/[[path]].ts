type PlaidWorker = Fetcher;
type PlaidEnv = { PLAID_WORKER?: PlaidWorker };
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
  if (environment !== "sandbox" || !env.PLAID_CLIENT_ID || !env.PLAID_SECRET || !env.PLAID_TOKEN_ENCRYPTION_KEY) return null;
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
  if (!isPreviewDeployment(request)) {
    return response(404, { error: "Plaid Sandbox is available only on a Cloudflare Pages Preview deployment." });
  }
  const assertion = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!assertion || !(await validAccess(assertion))) return response(401, { error: "LifeOS sign-in is required." });
  if (request.method !== "POST") return response(405, { error: "Method not allowed." });

  const route = new URL(request.url).pathname.replace(/^\\/api\\/plaid\\/?/, "").replace(/\\/$/, "");
  const workerPath: Record<string, string> = {
    "link-token": "/api/link/token/create",
    "exchange": "/api/item/public-token/exchange",
    "transactions": "/api/transactions/get",
  };
  const targetPath = workerPath[route];
  if (!targetPath) return response(404, { error: "Unknown Plaid endpoint." });
  if (!env.PLAID_WORKER) return response(503, { error: "Plaid Worker service binding is not configured for this Preview deployment." });

  try {
    // The Pages Function verifies the user's Access JWT first. The internal service binding
    // then reuses the existing Worker, its secrets, encryption format, and D1 database.
    const target = new URL(targetPath, "https://lifeos-plaid-sandbox.internal");
    const forwarded = new Request(target, request);
    return await env.PLAID_WORKER.fetch(forwarded);
  } catch {
    return response(502, { error: "Could not reach the protected Plaid Worker. Check the Preview service binding." });
  }
}
