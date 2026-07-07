import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getBackendUser } from "@/lib/auth";
import { getEmailUsage } from "@/lib/emailUsage";
import { getMailerSendUsage } from "@/lib/mailersend";

export const dynamic = "force-dynamic";

const getAdminClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
};

export async function GET(req: NextRequest) {
  try {
    const caller = await getBackendUser(req);
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = getAdminClient();

    const { data: callerProfile, error: profileErr } = await adminClient
      .from("users")
      .select("account_type, status")
      .eq("id", caller.id)
      .single();

    if (profileErr || !callerProfile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (callerProfile.account_type !== "admin" || callerProfile.status !== "approved") {
      return NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 });
    }

    const usage = await getEmailUsage(adminClient);
    const ms = await getMailerSendUsage();

    // Prefer MailerSend's own account-wide number (the real authoritative
    // figure) when available; fall back to PharmaTrack's internal tally
    // (src/lib/emailUsage.ts) otherwise, which only counts broadcasts,
    // absence notices, and weekly digests sent through this app's own code.
    const count = ms.available && typeof ms.sent === "number" ? ms.sent : usage.count;
    const percent = usage.cap > 0 ? Math.round((count / usage.cap) * 100) : 0;

    return NextResponse.json({
      month: usage.month,
      cap: usage.cap,
      count,
      percent,
      source: ms.available ? "mailersend" : "internal",
      internalCount: usage.count,
      mailersendCount: ms.available ? ms.sent : null,
      mailersendUnavailableReason: ms.available ? null : ms.reason,
    });
  } catch (err: any) {
    console.error("[Email Usage API] Internal server error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
