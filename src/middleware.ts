import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const RULES = [
  { path: "/api/scan",                 limit: 600, windowMs: 60_000 },
  { path: "/api/auth/register",        limit: 60,  windowMs: 60_000 },
  { path: "/api/auth",                 limit: 20,  windowMs: 60_000 },
  { path: "/api/admin/reset-password", limit: 5,   windowMs: 60_000 },
  { path: "/api/events",               limit: 20,  windowMs: 60_000 },
] as const;

type Rule = (typeof RULES)[number];

// ── Upstash (production) ───────────────────────────────────────────────────
const UPSTASH_URL   = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const USE_UPSTASH   = Boolean(UPSTASH_URL && UPSTASH_TOKEN);

const upstashLimiters = new Map<string, Ratelimit>();

function getUpstashLimiter(rule: Rule): Ratelimit {
  if (!upstashLimiters.has(rule.path)) {
    upstashLimiters.set(
      rule.path,
      new Ratelimit({
        redis: new Redis({ url: UPSTASH_URL!, token: UPSTASH_TOKEN! }),
        limiter: Ratelimit.slidingWindow(rule.limit, `${rule.windowMs}ms`),
        analytics: false,
        prefix: `pharmatrack:rl`,
      })
    );
  }
  return upstashLimiters.get(rule.path)!;
}

// ── In-memory fallback (local dev) ─────────────────────────────────────────
const memMap = new Map<string, { count: number; reset: number }>();

function checkMemory(key: string, limit: number, windowMs: number): boolean {
  const now   = Date.now();
  const entry = memMap.get(key);
  if (!entry || now > entry.reset) {
    memMap.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

// ── Middleware ─────────────────────────────────────────────────────────────
export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const rule = RULES.find((r) => path.startsWith(r.path));
  if (!rule) return NextResponse.next();

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const key = `${ip}:${rule.path}`;

  if (USE_UPSTASH) {
    try {
      const { success, reset } = await getUpstashLimiter(rule).limit(key);
      if (!success) {
        return NextResponse.json(
          { error: "Too many requests. Please slow down." },
          {
            status: 429,
            headers: { "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)) },
          }
        );
      }
      return NextResponse.next();
    } catch {
      // Upstash unreachable → fall through to in-memory so a Redis outage
      // doesn't block legitimate scan traffic
    }
  }

  if (!checkMemory(key, rule.limit, rule.windowMs)) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/scan",
    "/api/auth/:path*",
    "/api/admin/reset-password",
    "/api/events",
  ],
};
