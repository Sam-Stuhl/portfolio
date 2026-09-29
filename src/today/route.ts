// The Today dashboard: Sam's day, pushed here by ATLAS on his Mac mini.
//
// ATLAS builds a snapshot (weather, when to leave, the day view, deadlines,
// what is waiting on him, the morning brief) every few minutes and POSTs it to
// /today/push. The page lives at /today/<view key> and reads the latest
// snapshot from a Durable Object.
//
// Two keys, both random 256-bit values made on the mini and never stored here:
// this Worker holds only their SHA-256 hashes, in wrangler.jsonc, which is why
// the repository can be public and why no secret had to be set by hand. The
// view key is the link, and only ever reaches Sam's own Telegram.

import { DurableObject } from "cloudflare:workers";
import PAGE from "./page.html";

export interface TodayEnv {
  TODAY: DurableObjectNamespace<TodayStore>;
  TODAY_VIEW_HASH: string;
  TODAY_PUSH_HASH: string;
}

const MAX_SNAPSHOT = 512 * 1024;

// One object, one key. A snapshot replaces the last; nothing accumulates.
export class TodayStore extends DurableObject {
  async read(): Promise<string | null> {
    return (await this.ctx.storage.get<string>("snapshot")) ?? null;
  }

  async write(body: string): Promise<void> {
    await this.ctx.storage.put("snapshot", body);
  }
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Compare in time that does not depend on where the strings differ. */
function same(a: string, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const PRIVATE: Record<string, string> = {
  "cache-control": "no-store",
  "x-robots-tag": "noindex, nofollow",
  // The key is in the path, so never hand it to another site as a referrer.
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
};

const CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "connect-src 'self'",
  "img-src 'self' data:",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

const notFound = () =>
  new Response("not found\n", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });

function store(env: TodayEnv) {
  return env.TODAY.get(env.TODAY.idFromName("sam"));
}

/** Everything under /today. Returns null for any other path. */
export async function today(request: Request, env: TodayEnv, pathname: string): Promise<Response | null> {
  if (pathname !== "/today" && !pathname.startsWith("/today/")) return null;
  const parts = pathname.split("/").filter(Boolean); // ["today", key, "data"?]

  if (parts.length === 2 && parts[1] === "push") {
    if (request.method !== "POST") return notFound();
    const key = request.headers.get("x-today-key") ?? "";
    if (!same(await sha256(key), env.TODAY_PUSH_HASH)) return notFound();
    const body = await request.text();
    if (body.length > MAX_SNAPSHOT) return new Response("too large\n", { status: 413 });
    try {
      JSON.parse(body);
    } catch {
      return new Response("not json\n", { status: 400 });
    }
    await store(env).write(body);
    return new Response(null, { status: 204 });
  }

  if (request.method !== "GET" && request.method !== "HEAD") return notFound();
  if (parts.length < 2 || parts.length > 3) return notFound();
  if (!same(await sha256(parts[1]), env.TODAY_VIEW_HASH)) return notFound();

  if (parts.length === 3) {
    if (parts[2] !== "data") return notFound();
    const snapshot = await store(env).read();
    return new Response(snapshot ?? "{}", {
      status: snapshot ? 200 : 404,
      headers: { ...PRIVATE, "content-type": "application/json; charset=utf-8" },
    });
  }

  return new Response(request.method === "HEAD" ? null : PAGE, {
    headers: { ...PRIVATE, "content-type": "text/html; charset=utf-8", "content-security-policy": CSP },
  });
}
