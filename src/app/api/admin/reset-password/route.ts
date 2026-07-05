import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getBackendUser } from "@/lib/auth";
import { getTransporter, renderEmailShell } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Uses the service role key — server-side only, never exposed to the client
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"
  );

  try {
    // ── Auth Check ──
    const caller = await getBackendUser(req);
    if (!caller) {
      console.warn("[ResetPassword API] Unauthorized request attempt - no valid session");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify caller is an approved admin in users table
    const { data: callerProfile, error: profileErr } = await adminClient
      .from("users")
      .select("account_type, status")
      .eq("id", caller.id)
      .single();

    if (profileErr || !callerProfile) {
      console.error(`[ResetPassword API] Failed to fetch profile for user ${caller.id}:`, profileErr);
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (callerProfile.account_type !== "admin" || callerProfile.status !== "approved") {
      console.warn(`[ResetPassword API] Forbidden access attempt by ${caller.email} (Role: ${callerProfile.account_type}, Status: ${callerProfile.status})`);
      return NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 });
    }

    const { email } = await req.json();

    if (!email) {
      console.warn(`[ResetPassword API] Admin ${caller.email} requested reset with missing email field`);
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    console.log(`[ResetPassword API] Admin ${caller.email} initiating password reset link generation for target ${email}`);

    // Without redirectTo, Supabase falls back to the bare Site URL, landing
    // the user on the homepage with the recovery tokens in the hash instead
    // of on /reset-password — mirrors the redirectTo used by the self-service
    // sendPasswordReset() flow in src/lib/auth-client.ts.
    const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
    const { data, error } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${origin}/reset-password` },
    });

    if (error) {
      console.error(`[ResetPassword API] Supabase auth link generation failed for target ${email}:`, error.message);
      throw error;
    }

    // Build our own link through /auth/callback's token_hash handling instead
    // of using data.properties.action_link — that raw link is Supabase's
    // hosted PKCE-flow verify URL, which requires a code-verifier from the
    // browser that *requested* the reset and breaks if an email scanner
    // prefetches it or the admin's target user opens it on a different
    // device. token_hash verification is server-side and stateless.
    const tokenHash = data?.properties?.hashed_token;
    if (!tokenHash) throw new Error("Failed to generate reset link");
    const actionLink = `${origin}/auth/callback?token_hash=${tokenHash}&type=recovery`;

    const transporter = getTransporter();
    if (!transporter) {
      throw new Error("SMTP is not configured. Please set SMTP_HOST, SMTP_USER, and SMTP_PASS.");
    }
    const from = process.env.SMTP_FROM || "PharmaTrack <notifications@usa.edu.ph>";

    try {
      const bodyHtml = `
        <p>Hello,</p>
        <p>An administrator has requested a password reset for your PharmaTrack account.</p>
        <p style="margin: 24px 0;">
          <a href="${actionLink}" style="background-color:#E8B84B; color:#1e1432; padding:12px 24px; border-radius:6px; text-decoration:none; font-weight:bold; display:inline-block;">Reset Password</a>
        </p>
        <p>This link expires in 24 hours. If you did not request this, you can ignore this email.</p>
      `;

      await transporter.sendMail({
        from,
        to: email,
        subject: "Password Reset — PharmaTrack",
        html: renderEmailShell({ eyebrow: "Password Reset", bodyHtml }),
      });
    } catch (emailErr: any) {
      console.error(`[ResetPassword API] SMTP email failed for ${email}:`, emailErr);
      throw new Error("Failed to send reset email: " + emailErr.message);
    }

    console.log(`[ResetPassword API] Password reset email sent to ${email}`);

    return NextResponse.json({
      success: true,
      message: `Password reset email sent to ${email}`,
    });
  } catch (err: any) {
    console.error("[ResetPassword API] Internal server error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
