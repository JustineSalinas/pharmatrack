import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getBackendUser } from "@/lib/auth";

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

    console.log(`[ResetPassword API] Password reset link successfully generated for target ${email}`);

    // In production you'd send this via email — here we return the link
    // so the admin can share it manually or it can be emailed via Supabase's
    // built-in email (depending on your SMTP config).
    return NextResponse.json({
      success: true,
      message: `Password reset link generated for ${email}`,
      link: data?.properties?.action_link ?? null,
    });
  } catch (err: any) {
    console.error("[ResetPassword API] Internal server error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
