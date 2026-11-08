import { importP8, signDeveloperToken } from "./jwt";

export interface Env {
  APPLE_PRIVATE_KEY: string; // contents of the .p8 file (secret)
  APPLE_TEAM_ID: string; // secret or var
  APPLE_KEY_ID: string; // secret or var
  TOKEN_TTL_SECONDS?: string; // default 86400 (24 h)
  ALLOWED_ORIGINS?: string; // e.g. "http://localhost:7531,http://127.0.0.1:7531"
}

// Per-isolate cache: we don't re-sign on every request.
let cached: { token: string; expiresAt: number } | null = null;
let keyPromise: Promise<CryptoKey> | null = null;

function cors(origin: string | null, allowed: string[]): Record<string, string> {
  const ok = origin && (allowed.length === 0 || allowed.includes(origin));
  return ok
    ? {
        "Access-Control-Allow-Origin": origin!,
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Vary": "Origin",
      }
    : {};
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const allowed = (env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const headers = cors(req.headers.get("Origin"), allowed);

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });

    if (url.pathname === "/health") return Response.json({ ok: true }, { headers });

    if (url.pathname !== "/token" || req.method !== "GET") {
      return new Response("Not found", { status: 404, headers });
    }

    const missing = ["APPLE_PRIVATE_KEY", "APPLE_TEAM_ID", "APPLE_KEY_ID"].filter(
      (k) => !(env as any)[k],
    );
    if (missing.length) {
      return Response.json({ error: `Missing secrets: ${missing.join(", ")}` }, { status: 500, headers });
    }

    const now = Math.floor(Date.now() / 1000);
    // Re-sign when less than an hour is left.
    if (!cached || cached.expiresAt - now < 3600) {
      keyPromise ??= importP8(env.APPLE_PRIVATE_KEY);
      cached = await signDeveloperToken({
        key: await keyPromise,
        teamId: env.APPLE_TEAM_ID,
        keyId: env.APPLE_KEY_ID,
        ttlSeconds: Number(env.TOKEN_TTL_SECONDS ?? 86400),
        origins: allowed.length ? allowed : undefined,
      });
    }

    return Response.json(cached, {
      headers: { ...headers, "Cache-Control": "no-store" },
    });
  },
};
