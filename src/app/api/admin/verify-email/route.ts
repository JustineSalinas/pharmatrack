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
      console.warn("[VerifyEmail API] Unauthorized request attempt - no valid session");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify caller is an approved admin in users table
    const { data: callerProfile, error: profileErr } = await adminClient
      .from("users")
      .select("account_type, status")
      .eq("id", caller.id)
      .single();

    if (profileErr || !callerProfile) {
      console.error(`[VerifyEmail API] Failed to fetch profile for user ${caller.id}:`, profileErr);
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (callerProfile.account_type !== "admin" || callerProfile.status !== "approved") {
      console.warn(`[VerifyEmail API] Forbidden access attempt by ${caller.email} (Role: ${callerProfile.account_type}, Status: ${callerProfile.status})`);
      return NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 });
    }

    const { userId } = await req.json();

    if (!userId) {
      console.warn(`[VerifyEmail API] Admin ${caller.email} requested verify with missing userId field`);
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    console.log(`[VerifyEmail API] Admin ${caller.email} force-verifying email for target ${userId}`);

    const { data, error } = await adminClient.auth.admin.updateUserById(userId, {
      email_confirm: true,
    });

    if (error) {
      console.error(`[VerifyEmail API] Supabase auth update failed for target ${userId}:`, error.message);
      throw error;
    }

    console.log(`[VerifyEmail API] Email verified for ${data.user?.email ?? userId}`);

    return NextResponse.json({
      success: true,
      message: `Email marked as verified for ${data.user?.email ?? userId}`,
    });
  } catch (err: any) {
    console.error("[VerifyEmail API] Internal server error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
