import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Auth callback. Handles two cases:
 *  1. Email verification links (token_hash + type) — verify the OTP, then
 *     bounce to /login so the user signs in.
 *  2. OAuth / PKCE links (code) — exchange the code for a *cookie-backed*
 *     session so the browser stays signed in, then send them to /dashboard
 *     (which routes to the correct role-specific dashboard).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");

  const loginUrl = new URL("/login", origin);

  // ── Case 1: email verification (token_hash) ──────────────────────────
  if (token_hash && type) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error } = await supabase.auth.verifyOtp({ token_hash, type: type as any });

    if (!error) {
      // Recovery links should land on the reset form, not the login screen.
      if (type === "recovery") {
        return NextResponse.redirect(new URL("/reset-password", origin));
      }
      loginUrl.searchParams.set("verified", "true");
      return NextResponse.redirect(loginUrl);
    }
    console.error("Email verification failed:", error.message);
  }

  // ── Case 2: OAuth / PKCE code exchange (cookie-backed session) ────────
  if (code) {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      // New OAuth users have no profile row yet — send them to onboarding
      // to pick a role; returning users go straight to their dashboard.
      const { data: profile } = await supabase
        .from("users")
        .select("id")
        .eq("id", data.user.id)
        .maybeSingle();

      const dest = profile ? "/dashboard" : "/onboarding";
      return NextResponse.redirect(new URL(dest, origin));
    }
    if (error) {
      console.error("Code exchange failed:", error.message);
      const errUrl = new URL("/login", origin);
      errUrl.searchParams.set("error", `code_exchange_failed:${error.message}`);
      return NextResponse.redirect(errUrl);
    }
  }

  // ── Fallback ──────────────────────────────────────────────────────────
  loginUrl.searchParams.set("error", "verification_failed");
  return NextResponse.redirect(loginUrl);
}
