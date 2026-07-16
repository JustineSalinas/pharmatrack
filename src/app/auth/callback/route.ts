import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Auth callback. Handles three cases:
 *  1. Recovery links (token_hash + type=recovery) — forwarded to /reset-password
 *     *unverified*; the browser verifies them itself. See the block below.
 *  2. Email verification links (token_hash + type) — verify the OTP, then
 *     bounce to /login so the user signs in.
 *  3. OAuth / PKCE links (code) — exchange the code for a *cookie-backed*
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

  // Validate next param — must be a local path, never an external URL.
  const rawNext = searchParams.get("next") ?? "";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : null;

  const loginUrl = new URL("/login", origin);

  // ── Case 0: Google / Supabase returned an OAuth error directly ────────
  if (oauthError) {
    console.error("OAuth callback error:", oauthError, oauthErrorDesc);
    const errUrl = new URL("/login", origin);
    // Email scanners (Gmail, Outlook) auto-follow links and consume the one-time
    // token before the user clicks it. The email IS confirmed; guide them to log in.
    if (oauthError === "access_denied" && oauthErrorDesc?.toLowerCase().includes("email link is invalid or has expired")) {
      errUrl.searchParams.set("error", "link_already_used");
    } else {
      errUrl.searchParams.set("error", `oauth_error:${oauthError}${oauthErrorDesc ? ` - ${oauthErrorDesc}` : ""}`);
    }
    return NextResponse.redirect(errUrl);
  }

  // ── Case 1: password recovery — forward, don't verify ─────────────────
  // Verifying here would consume the one-time token and put the resulting
  // session in a cookie the browser client cannot read: it is built against
  // the /supabase-api proxy (src/lib/supabase.ts), so it derives a different
  // auth cookie name than the server client below. The reset page would then
  // find no session and report the link as expired — for a token that had
  // just verified successfully. Let the browser verify it instead, so the
  // session is created by the same client that reads it.
  //
  // This also makes recovery links survive email scanners (Gmail, Outlook),
  // which prefetch links and would otherwise burn the token: a prefetch now
  // gets only a redirect, and the token is spent when a real browser runs JS.
  if (token_hash && type === "recovery") {
    const resetUrl = new URL("/reset-password", origin);
    resetUrl.searchParams.set("token_hash", token_hash);
    resetUrl.searchParams.set("type", "recovery");
    return NextResponse.redirect(resetUrl);
  }

  // ── Case 2: email verification (token_hash) ──────────────────────────
  if (token_hash && type) {
    const cookieStore = await cookies();
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
      const response = NextResponse.redirect(new URL("/login?verified=true", origin));
      if (data.session) {
        response.cookies.set("pharmatrack_token", data.session.access_token, {
          httpOnly: true, secure: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 7,
        });
      }
      return response;
    }
    // Email scanners (Gmail, Outlook) auto-follow links and consume the one-time
    // token before the user clicks it. For signup this is actually a success
    // (the email IS confirmed) — guide them to log in.
    const errCode = (error as { code?: string }).code;
    const msg = error.message.toLowerCase();
    if (errCode === "otp_expired" || msg.includes("expired") || msg.includes("invalid")) {
      const linkUsedUrl = new URL("/login", origin);
      linkUsedUrl.searchParams.set("error", "link_already_used");
      return NextResponse.redirect(linkUsedUrl);
    }

    console.error("Email verification failed:", error.message);
    const errUrl = new URL("/login", origin);
    errUrl.searchParams.set("error", `verification_failed:${error.message}`);
    return NextResponse.redirect(errUrl);
  }

  // ── Case 3: OAuth / PKCE code exchange (cookie-backed session) ────────
  if (code) {
    const cookieStore = await cookies();
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
      // Honour an explicit next param (e.g. /reset-password for recovery flow).
      // Otherwise fall back: returning users → dashboard, new users → onboarding.
      let dest = next;
      if (!dest) {
        const { data: profile } = await supabase
          .from("users")
          .select("id")
          .eq("id", data.user.id)
          .maybeSingle();
        dest = profile ? "/dashboard" : "/onboarding";
      }

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
