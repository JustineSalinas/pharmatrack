import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getBackendUser } from "@/lib/auth";
import { getTransporter } from "@/lib/email";

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

    const { data, error } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email,
    });

    if (error) {
      console.error(`[ResetPassword API] Supabase auth link generation failed for target ${email}:`, error.message);
      throw error;
    }

    const actionLink = data?.properties?.action_link;
    if (!actionLink) throw new Error("Failed to generate reset link");

    const transporter = getTransporter();
    if (!transporter) {
      throw new Error("SMTP is not configured. Please set SMTP_HOST, SMTP_USER, and SMTP_PASS.");
    }
    const from = process.env.SMTP_FROM || "PharmaTrack <notifications@usa.edu.ph>";

    try {
      await transporter.sendMail({
        from,
        to: email,
        subject: "Password Reset — PharmaTrack",
        html: `
          <p>Hello,</p>
          <p>An administrator has requested a password reset for your PharmaTrack account.</p>
          <p><a href="${actionLink}" style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">Reset Password</a></p>
          <p>This link expires in 24 hours. If you did not request this, you can ignore this email.</p>
          <p style="color:#6b7280;font-size:12px;">— PharmaTrack System</p>
        `,
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
