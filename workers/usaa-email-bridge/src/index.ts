type DepositKVNamespace = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{ keys: Array<{ name: string }>; list_complete?: boolean; cursor?: string }>;
};

export interface Env {
  DEPOSITS: DepositKVNamespace;
  BRIDGE_TOKEN: string;
  BRIDGE_PROXY_TOKEN: string;
}

type Deposit = {
  id: string;
  postedDate: string;
  amountMinor: number;
  description: string;
  currency: "USD";
  sourceMessageId?: string;
  accountLabel?: string;
  receivedAt: string;
  source: "usaa_email_shortcut";
  status: "pending" | "imported";
};

const json = (body: unknown, status = 200) => Response.json(body, {
  status,
  headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" },
});

function authorized(request: Request, secret: string): boolean {
  const value = request.headers.get("Authorization") ?? "";
  const match = /^Bearer ([A-Za-z0-9._~-]{32,256})$/.exec(value);
  if (!match || match[1].length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i++) diff |= match[1].charCodeAt(i) ^ secret.charCodeAt(i);
  return diff === 0;
}

async function hash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00.000Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const isShortcut = request.method === "POST" && url.pathname === "/v1/deposits";
    const isProxy = request.headers.get("X-LifeOS-Bridge-Proxy") === "1" &&
      authorized(request, env.BRIDGE_PROXY_TOKEN);

    if (isShortcut) {
      if (!authorized(request, env.BRIDGE_TOKEN)) return json({ error: "Unauthorized." }, 401);
      const declaredLength = Number(request.headers.get("Content-Length") ?? "0");
      if (declaredLength > 8192) return json({ error: "Payload too large." }, 413);
      let input: Record<string, unknown>;
      try {
        const raw = await request.text();
        if (new TextEncoder().encode(raw).byteLength > 8192) return json({ error: "Payload too large." }, 413);
        input = JSON.parse(raw) as Record<string, unknown>;
      } catch { return json({ error: "Expected a small JSON object." }, 400); }

      if (!validDate(input.postedDate) ||
          !Number.isSafeInteger(input.amountMinor) || Number(input.amountMinor) <= 0 || Number(input.amountMinor) > 100_000_000 ||
          typeof input.description !== "string" || input.description.trim().length < 2 || input.description.length > 160 ||
          (input.currency !== undefined && input.currency !== "USD") ||
          (input.sourceMessageId !== undefined && (typeof input.sourceMessageId !== "string" || !/^[A-Za-z0-9._:-]{1,180}$/.test(input.sourceMessageId))) ||
          (input.accountLabel !== undefined && (typeof input.accountLabel !== "string" || input.accountLabel.length > 80))) {
        return json({ error: "Invalid deposit fields." }, 422);
      }

      const description = input.description.trim();
      const material = typeof input.sourceMessageId === "string"
        ? "usaa-email:" + input.sourceMessageId
        : "usaa-email:" + input.postedDate + ":" + input.amountMinor + ":" + description.toLowerCase();
      const id = await hash(material);
      const key = "deposit:" + id;
      if (await env.DEPOSITS.get(key)) return json({ accepted: true, duplicate: true, id });

      const record: Deposit = {
        id,
        postedDate: input.postedDate,
        amountMinor: Number(input.amountMinor),
        description,
        currency: "USD",
        ...(typeof input.sourceMessageId === "string" ? { sourceMessageId: input.sourceMessageId } : {}),
        ...(typeof input.accountLabel === "string" ? { accountLabel: input.accountLabel.trim() } : {}),
        receivedAt: new Date().toISOString(),
        source: "usaa_email_shortcut",
        status: "pending",
      };
      await env.DEPOSITS.put(key, JSON.stringify(record), { expirationTtl: 60 * 60 * 24 * 180 });
      return json({ accepted: true, duplicate: false, id }, 201);
    }

    if (!isProxy) return json({ error: "Unauthorized." }, 401);
    if (request.method === "GET" && url.pathname === "/v1/deposits") {
      const limitValue = Number(url.searchParams.get("limit") ?? "50");
      const limit = Number.isInteger(limitValue) ? Math.min(Math.max(limitValue, 1), 100) : 50;
      const status = url.searchParams.get("status");
      if (status && status !== "pending" && status !== "imported") return json({ error: "Invalid status." }, 400);
      const listed = await env.DEPOSITS.list({ prefix: "deposit:", limit: 1000 });
      const records: Deposit[] = [];
      for (const item of listed.keys) {
        const raw = await env.DEPOSITS.get(item.name);
        if (!raw) continue;
        try {
          const record = JSON.parse(raw) as Deposit;
          if (!status || record.status === status) records.push(record);
        } catch { /* ignore corrupt records */ }
      }
      records.sort((a, b) => b.postedDate.localeCompare(a.postedDate) || b.receivedAt.localeCompare(a.receivedAt));
      return json({ deposits: records.slice(0, limit), truncated: listed.list_complete === false || records.length > limit });
    }

    const ack = /^\/v1\/deposits\/([a-f0-9]{64})\/ack$/.exec(url.pathname);
    if (request.method === "PATCH" && ack) {
      let body: { status?: unknown };
      try { body = await request.json() as { status?: unknown }; } catch { return json({ error: "Expected JSON." }, 400); }
      if (body.status !== "imported") return json({ error: "Only imported status is supported." }, 422);
      const key = "deposit:" + ack[1];
      const raw = await env.DEPOSITS.get(key);
      if (!raw) return json({ error: "Deposit not found." }, 404);
      const record = JSON.parse(raw) as Deposit;
      record.status = "imported";
      await env.DEPOSITS.put(key, JSON.stringify(record), { expirationTtl: 60 * 60 * 24 * 180 });
      return json({ acknowledged: true, id: record.id });
    }
    return json({ error: "Not found." }, 404);
  },
};
