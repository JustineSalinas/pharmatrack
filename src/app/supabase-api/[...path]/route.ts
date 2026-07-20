// Explicit reverse-proxy for Supabase REST/RPC/Storage requests.
//
// Why this exists: the browser Supabase client is pointed at
// `${origin}/supabase-api` (src/lib/supabase.ts) so all traffic rides the app's
// own domain (avoids campus network filters / CORS on *.supabase.co). That path
// used to be a plain next.config `rewrites()` entry — but a Next.js rewrite to an
// EXTERNAL destination does NOT forward the `Authorization` header. The result:
// every authenticated browser read reached PostgREST as `anon` (auth.uid() null),
// so every is_council()-gated table returned an empty 200 [] — the "list pages
// show 0 rows" / "attendance rate 0%" bug.
//
// This Route Handler forwards the request verbatim — including Authorization and
// apikey — so PostgREST sees the real user JWT. Auth (/supabase-api/auth/*) and
// Realtime WebSockets (/supabase-api/realtime/*) intentionally stay on the
// next.config rewrite: auth only needs the apikey (already worked), and Route
// Handlers can't proxy WebSocket upgrades.

import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

// Hop-by-hop / host-specific request headers that must not be forwarded upstream.
const STRIP_REQ = new Set(["host", "connection", "content-length", "transfer-encoding", "keep-alive"]);
// Response headers dropped because the body is buffered+decoded here (undici
// decodes content-encoding when we read arrayBuffer), so the original framing
// headers would no longer match.
const STRIP_RES = new Set(["content-encoding", "content-length", "transfer-encoding", "connection", "keep-alive"]);

async function proxy(req: NextRequest, pathParts: string[]): Promise<Response> {
  if (!SUPABASE_URL) {
    return new Response(JSON.stringify({ error: "Supabase URL not configured" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const target = `${SUPABASE_URL}/${pathParts.join("/")}${req.nextUrl.search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!STRIP_REQ.has(key.toLowerCase())) headers.set(key, value);
  });

  const init: RequestInit = { method: req.method, headers, redirect: "manual" };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  const upstream = await fetch(target, init);
  const body = await upstream.arrayBuffer();

  const respHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!STRIP_RES.has(key.toLowerCase())) respHeaders.set(key, value);
  });

  return new Response(body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: respHeaders,
  });
}

type Ctx = { params: Promise<{ path: string[] }> };
const handler = async (req: NextRequest, ctx: Ctx) => proxy(req, (await ctx.params).path);

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
export const HEAD = handler;
