import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Handles the email verification callback from Supabase.
 * When a user clicks the verification link in their email,
 * Supabase redirects here with token_hash + type params.
 * We verify the OTP and redirect to /login with a success flag.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");

  const loginUrl = new URL("/login", origin);

  // Handle token-based verification (default Supabase email template)
  if (token_hash && type) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as any,
    });

    if (!error) {
      loginUrl.searchParams.set("verified", "true");
      return NextResponse.redirect(loginUrl);
    }

    console.error("Email verification failed:", error.message);
  }

  // Handle PKCE code exchange
  if (code) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      loginUrl.searchParams.set("verified", "true");
      return NextResponse.redirect(loginUrl);
    }

    console.error("Code exchange failed:", error.message);
  }

  // Verification failed — redirect to login with error
  loginUrl.searchParams.set("error", "verification_failed");
  return NextResponse.redirect(loginUrl);
}
