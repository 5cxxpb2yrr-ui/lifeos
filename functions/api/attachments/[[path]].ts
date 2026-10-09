type AttachmentEnv = {
  ATTACHMENTS: { fetch: (request: Request) => Promise<Response> };
};

type AttachmentContext = {
  request: Request;
  env: AttachmentEnv;
};

type AccessJwtPayload = {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
};

const PREFIX = "/api/attachments/";
const UPSTREAM = "https://lifeos-attachments.phillipstg.workers.dev";
const ACCESS_ISSUER = "https://phoenix-65w-pages.cloudflareaccess.com";
const ACCESS_AUDIENCE = "68d8678f9ee7cac7e819bc369b154512b6f6b3ce2a97cdf38c95290825b45806";
const ACCESS_JWKS_URL = `${ACCESS_ISSUER}/cdn-cgi/access/certs`;

let cachedJwks: { expiresAt: number; keys: JsonWebKey[] } | null = null;

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function decodeJsonPart<T>(value: string): T {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as T;
}

async function accessKeys(): Promise<JsonWebKey[]> {
  if (cachedJwks && cachedJwks.expiresAt > Date.now()) return cachedJwks.keys;
  const response = await fetch(ACCESS_JWKS_URL, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Could not retrieve Cloudflare Access signing keys.");
  const data = await response.json() as { keys?: JsonWebKey[] };
  if (!Array.isArray(data.keys) || data.keys.length === 0) throw new Error("Cloudflare Access returned no signing keys.");
  cachedJwks = { keys: data.keys, expiresAt: Date.now() + 5 * 60 * 1000 };
  return data.keys;
}

async function hasValidLifeOSAccessJwt(token: string): Promise<boolean> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const header = decodeJsonPart<{ alg?: string; kid?: string }>(parts[0]);
    const payload = decodeJsonPart<AccessJwtPayload>(parts[1]);
    if (header.alg !== "RS256" || !header.kid) return false;
    if (payload.iss !== ACCESS_ISSUER) return false;
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audiences.includes(ACCESS_AUDIENCE)) return false;
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== "number" || payload.exp <= now) return false;
    if (typeof payload.nbf === "number" && payload.nbf > now) return false;

    const key = (await accessKeys()).find((candidate) => (candidate as JsonWebKey & { kid?: string }).kid === header.kid);
    if (!key) return false;
    const publicKey = await crypto.subtle.importKey(
      "jwk",
      key,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      publicKey,
      decodeBase64Url(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
  } catch {
    return false;
  }
}

function errorResponse(status: number, message: string): Response {
  return Response.json({ error: message }, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

export async function onRequest({ request, env }: AttachmentContext): Promise<Response> {
  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "PUT" && method !== "DELETE") {
    return errorResponse(405, "Method not allowed.");
  }

  // The Access edge protects the Pages hostname; the function also validates
  // the signed JWT itself because a same-origin request can be forged outside
  // a browser. Only a valid token minted for this exact LifeOS Access app may
  // reach the private Worker through the service binding.
  const accessJwt = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!accessJwt || !(await hasValidLifeOSAccessJwt(accessJwt))) {
    return errorResponse(401, "LifeOS sign-in is required.");
  }

  const url = new URL(request.url);
  if (!url.pathname.startsWith(PREFIX)) return errorResponse(404, "Not found.");

  const rawPath = url.pathname.slice(PREFIX.length);
  if (!rawPath) return errorResponse(400, "Attachment path is required.");

  let encodedPath: string;
  try {
    const segments = rawPath.split("/");
    const decoded = segments.map((segment) => decodeURIComponent(segment));
    if (decoded.some((segment) =>
      !segment || segment === "." || segment === ".." ||
      segment.includes("/") || segment.includes("\\") ||
      /[\u0000-\u001f\u007f]/.test(segment)
    )) {
      return errorResponse(400, "Invalid attachment path.");
    }
    encodedPath = decoded.map(encodeURIComponent).join("/");
  } catch {
    return errorResponse(400, "Invalid attachment path encoding.");
  }

  const headers = new Headers();
  headers.set("Cf-Access-Jwt-Assertion", accessJwt);
  const contentType = request.headers.get("Content-Type");
  if (contentType) headers.set("Content-Type", contentType);
  const origin = request.headers.get("Origin");
  if (origin) headers.set("Origin", origin);

  let upstreamRequest: Request;
  try {
    upstreamRequest = new Request(`${UPSTREAM}/${encodedPath}`, {
      method,
      headers,
      body: method === "PUT" ? request.body : undefined,
      // Stream uploads rather than buffering the file in memory.
      duplex: method === "PUT" ? "half" : undefined,
    } as RequestInit);
  } catch {
    return errorResponse(400, "Invalid attachment request.");
  }

  let upstream: Response;
  try {
    upstream = await env.ATTACHMENTS.fetch(upstreamRequest);
  } catch {
    return errorResponse(502, "Secure attachment storage is temporarily unavailable.");
  }

  const responseHeaders = new Headers();
  for (const name of ["Content-Type", "Content-Length", "ETag", "Content-Disposition"]) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  responseHeaders.set("Cache-Control", "private, no-store");
  responseHeaders.set("X-Content-Type-Options", "nosniff");
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}
