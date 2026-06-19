import { NextRequest, NextResponse } from "next/server";

const rateMap = new Map<string, { count: number; reset: number }>();

const RULES: Array<{ path: string; limit: number; windowMs: number }> = [
  { path: "/api/scan",                   limit: 600, windowMs: 60_000 },
  { path: "/api/auth/register",          limit: 5,  windowMs: 60_000 },
  { path: "/api/admin/reset-password",   limit: 5,  windowMs: 60_000 },
  { path: "/api/events",                 limit: 20, windowMs: 60_000 },
];

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const rule = RULES.find((r) => path.startsWith(r.path));
  if (!rule) return NextResponse.next();

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const key = `${ip}:${rule.path}`;
  const now = Date.now();
  const entry = rateMap.get(key);

  if (!entry || now > entry.reset) {
    rateMap.set(key, { count: 1, reset: now + rule.windowMs });
    return NextResponse.next();
  }

  if (entry.count >= rule.limit) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((entry.reset - now) / 1000)),
        },
      }
    );
  }

  entry.count++;
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/scan",
    "/api/auth/register",
    "/api/admin/reset-password",
    "/api/events",
  ],
};
