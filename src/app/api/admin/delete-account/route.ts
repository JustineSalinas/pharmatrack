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
      console.warn("[DeleteAccount API] Unauthorized request attempt - no valid session");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify caller is an approved admin in users table
    const { data: callerProfile, error: callerErr } = await adminClient
      .from("users")
      .select("account_type, status")
      .eq("id", caller.id)
      .single();

    if (callerErr || !callerProfile) {
      console.error(`[DeleteAccount API] Failed to fetch profile for user ${caller.id}:`, callerErr);
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (callerProfile.account_type !== "admin" || callerProfile.status !== "approved") {
      console.warn(`[DeleteAccount API] Forbidden access attempt by ${caller.email} (Role: ${callerProfile.account_type}, Status: ${callerProfile.status})`);
      return NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 });
    }

    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    if (userId === caller.id) {
      return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
    }

    const { data: target, error: targetErr } = await adminClient
      .from("users")
      .select("account_type, full_name")
      .eq("id", userId)
      .single();

    if (targetErr || !target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (target.account_type === "admin") {
      return NextResponse.json({ error: "Admin accounts cannot be deleted here" }, { status: 403 });
    }

    console.log(`[DeleteAccount API] Admin ${caller.email} deleting account ${userId} (${target.full_name})`);

    const { error: deleteErr } = await adminClient.auth.admin.deleteUser(userId);

    if (deleteErr) {
      const msg = (deleteErr.message || "").toLowerCase();
      const isFkViolation =
        (deleteErr as any).code === "23503" ||
        msg.includes("foreign key") ||
        msg.includes("violates foreign key constraint");

      if (isFkViolation) {
        console.warn(`[DeleteAccount API] FK conflict deleting ${userId}:`, deleteErr.message);
        return NextResponse.json(
          {
            error: `Cannot delete ${target.full_name} — they have created events or recorded attendance. Reassign or remove those first.`,
          },
          { status: 409 }
        );
      }

      console.error(`[DeleteAccount API] Supabase deleteUser failed for target ${userId}:`, deleteErr.message);
      throw deleteErr;
    }

    console.log(`[DeleteAccount API] Deleted account ${userId} (${target.full_name})`);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[DeleteAccount API] Internal server error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
