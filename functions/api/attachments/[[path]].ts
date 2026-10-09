type AttachmentEnv = {
  ATTACHMENTS: { fetch: (request: Request) => Promise<Response> };
};

type AttachmentContext = {
  request: Request;
  env: AttachmentEnv;
};

const PREFIX = "/api/attachments/";
const UPSTREAM = "https://lifeos-attachments.phillipstg.workers.dev";

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

  // Access must protect the entire Pages hostname. The attachment Worker also
  // validates this signed JWT, so a caller cannot authorize itself by merely
  // supplying a forged header. Never replace this with a client-provided token.
  const accessJwt = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!accessJwt) return errorResponse(401, "LifeOS sign-in is required.");

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
  // The Worker has an origin allow-list; forward the browser's real same-origin
  // Origin, but do not use Origin as an authorization signal.
  const origin = request.headers.get("Origin");
  if (origin) headers.set("Origin", origin);

  const upstreamRequest = new Request(`${UPSTREAM}/${encodedPath}`, {
    method,
    headers,
    body: method === "PUT" ? request.body : undefined,
    // Stream uploads rather than buffering the file in memory.
    duplex: method === "PUT" ? "half" : undefined,
  } as RequestInit);

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
