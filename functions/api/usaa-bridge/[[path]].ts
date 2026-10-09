type Env = {
  USAA_BRIDGE: { fetch: (request: Request) => Promise<Response> };
  BRIDGE_PROXY_TOKEN: string;
};
type Context = { request: Request; env: Env };
type JwtPayload = { iss?: string; aud?: string | string[]; exp?: number; nbf?: number };
const PREFIX = "/api/usaa-bridge/";
const ISSUER = "https://phoenix-65w-pages.cloudflareaccess.com";
const AUDIENCE = "68d8678f9ee7cac7e819bc369b154512b6f6b3ce2a97cdf38c95290825b45806";
const JWKS_URL = `${ISSUER}/cdn-cgi/access/certs`;
let jwksCache: { expiresAt: number; keys: JsonWebKey[] } | null = null;

function decodePart<T>(part: string): T {
  const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}
async function getKeys(): Promise<JsonWebKey[]> {
  if (jwksCache && jwksCache.expiresAt > Date.now()) return jwksCache.keys;
  const response = await fetch(JWKS_URL, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Access key retrieval failed.");
  const data = await response.json() as { keys?: JsonWebKey[] };
  if (!Array.isArray(data.keys) || !data.keys.length) throw new Error("No Access signing keys.");
  jwksCache = { keys: data.keys, expiresAt: Date.now() + 5 * 60_000 };
  return data.keys;
}
async function validAccessJwt(token: string): Promise<boolean> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const header = decodePart<{ alg?: string; kid?: string }>(parts[0]);
    const payload = decodePart<JwtPayload>(parts[1]);
    if (header.alg !== "RS256" || !header.kid || payload.iss !== ISSUER) return false;
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.includes(AUDIENCE)) return false;
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== "number" || payload.exp <= now) return false;
    if (typeof payload.nbf === "number" && payload.nbf > now) return false;
    const jwk = (await getKeys()).find((key) => (key as JsonWebKey & { kid?: string }).kid === header.kid);
    if (!jwk) return false;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const normalized = parts[2].replace(/-/g, "+").replace(/_/g, "/");
    const signatureBinary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
    const signature = Uint8Array.from(signatureBinary, (char) => char.charCodeAt(0));
    return crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, new TextEncoder().encode(parts[0] + "." + parts[1]));
  } catch { return false; }
}
function error(status: number, message: string): Response {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
export async function onRequest({ request, env }: Context): Promise<Response> {
  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "PATCH") return error(405, "Method not allowed.");
  const jwt = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!jwt || !(await validAccessJwt(jwt))) return error(401, "LifeOS sign-in is required.");
  if (!constantTimeEqual(env.BRIDGE_PROXY_TOKEN, env.BRIDGE_PROXY_TOKEN) || env.BRIDGE_PROXY_TOKEN.length < 32) {
    return error(503, "Deposit bridge is not configured.");
  }
  const url = new URL(request.url);
  if (!url.pathname.startsWith(PREFIX)) return error(404, "Not found.");
  const path = url.pathname.slice(PREFIX.length);
  if (path !== "v1/deposits" && !/^v1\/deposits\/[a-f0-9]{64}\/ack$/.test(path)) return error(404, "Not found.");
  if (method === "GET" && path !== "v1/deposits") return error(405, "Method not allowed.");
  if (method === "PATCH" && !/^v1\/deposits\/[a-f0-9]{64}\/ack$/.test(path)) return error(405, "Method not allowed.");
  const headers = new Headers({
    "Authorization": "Bearer " + env.BRIDGE_PROXY_TOKEN,
    "X-LifeOS-Bridge-Proxy": "1",
    "Accept": "application/json",
  });
  let target = "https://lifeos-usaa-email-bridge/" + path + (method === "GET" ? url.search : "");
  if (method === "PATCH") headers.set("Content-Type", "application/json");
  let upstream: Response;
  try {
    upstream = await env.USAA_BRIDGE.fetch(new Request(target, {
      method, headers, body: method === "PATCH" ? await request.text() : undefined,
    }));
  } catch {
    return error(502, "Secure deposit queue is temporarily unavailable.");
  }
  const responseHeaders = new Headers({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
  const contentType = upstream.headers.get("Content-Type");
  if (contentType) responseHeaders.set("Content-Type", contentType);
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}
