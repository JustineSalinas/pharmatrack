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
  const oauthError = searchParams.get("error");
  const oauthErrorDesc = searchParams.get("error_description");

  const loginUrl = new URL("/login", origin);

  // ── Case 0: Google / Supabase returned an OAuth error directly ────────
  if (oauthError) {
    console.error("OAuth callback error:", oauthError, oauthErrorDesc);
    const errUrl = new URL("/login", origin);
    errUrl.searchParams.set("error", `oauth_error:${oauthError}${oauthErrorDesc ? ` - ${oauthErrorDesc}` : ""}`);
    return NextResponse.redirect(errUrl);
  }

  // ── Case 1: email verification (token_hash) ──────────────────────────
  if (token_hash && type) {
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

    const { data, error } = await supabase.auth.verifyOtp({ token_hash, type: type as any });

    if (!error) {
      // Recovery links should land on the reset form, not the login screen.
      const targetUrl = type === "recovery"
        ? new URL("/reset-password", origin)
        : new URL("/login?verified=true", origin);

      const response = NextResponse.redirect(targetUrl);
      if (data.session) {
        response.cookies.set("pharmatrack_token", data.session.access_token, {
          httpOnly: true, secure: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 7,
        });
      }
      return response;
    }
    console.error("Email verification failed:", error.message);
    const errUrl = new URL("/login", origin);
    errUrl.searchParams.set("error", `verification_failed:${error.message}`);
    return NextResponse.redirect(errUrl);
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
      const response = NextResponse.redirect(new URL(dest, origin));
      if (data.session) {
        response.cookies.set("pharmatrack_token", data.session.access_token, {
          httpOnly: true, secure: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 7,
        });
      }
      return response;
    }
    if (error) {
      console.error("Code exchange failed:", error.message);
      const errUrl = new URL("/login", origin);
      errUrl.searchParams.set("error", `code_exchange_failed:${error.message}`);
      return NextResponse.redirect(errUrl);
    }
    if (!data.user) {
      console.error("Code exchange failed: No user returned");
      const errUrl = new URL("/login", origin);
      errUrl.searchParams.set("error", "code_exchange_failed:No user session found");
      return NextResponse.redirect(errUrl);
    }
  }

  // ── Fallback ──────────────────────────────────────────────────────────
  loginUrl.searchParams.set("error", "verification_failed");
  return NextResponse.redirect(loginUrl);
}
