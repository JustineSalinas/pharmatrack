import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getBackendUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const getAdminClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
};

// Default system configurations as a fallback
const DEFAULTS: Record<string, string> = {
  absenceNotifications: "true",
  weeklyReports: "true",
  lateThreshold: "07:35",
  academicPeriod: "2025–2026 · 2nd Semester",
  qrExpiry: "10 min",
  minAttendance: "75%",
  twoFactorAuth: "false",
  registrationMode: "approval",
};

export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate caller
    const caller = await getBackendUser(req);
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = getAdminClient();

    // 2. Fetch and verify admin profile
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

    // 3. Load all database configs
    const { data: dbConfigs, error: fetchErr } = await adminClient
      .from("system_config")
      .select("key, value");

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    // 4. Map DB configurations
    const dbMap = new Map((dbConfigs || []).map((item) => [item.key, item.value]));

    // 5. Check if Resend is configured
    const resendKey = process.env.RESEND_API_KEY;
    const isSMTPManagedByEnv = !!(resendKey && resendKey !== "re_your_api_key_here");

    // 6. Merge configurations safely
    const settings: Record<string, string> = {};

    Object.keys(DEFAULTS).forEach((key) => {
      const dbVal = dbMap.get(key);
      settings[key] = dbVal !== undefined ? dbVal : DEFAULTS[key];
    });

    return NextResponse.json({
      success: true,
      settings,
      isSMTPManagedByEnv,
    });
  } catch (err: any) {
    console.error("[Settings API GET] Internal server error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate caller
    const caller = await getBackendUser(req);
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = getAdminClient();

    // 2. Fetch and verify admin profile
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

    // 3. Parse input
    const body = await req.json();
    const { settings } = body;
    if (!settings) {
      return NextResponse.json({ error: "Missing settings payload" }, { status: 400 });
    }

    // 4. Fetch current configurations
    const { data: dbConfigs, error: fetchErr } = await adminClient
      .from("system_config")
      .select("key, value");

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    // 5. Prepare upsert records
    const upserts = Object.keys(DEFAULTS).map((key) => {
      const value = settings[key];
      return {
        key,
        value: String(value !== undefined ? value : DEFAULTS[key]),
        updated_at: new Date().toISOString(),
      };
    });

    // 6. Perform database update
    if (upserts.length > 0) {
      const { error: upsertErr } = await adminClient
        .from("system_config")
        .upsert(upserts, { onConflict: "key" });

      if (upsertErr) {
        return NextResponse.json({ error: upsertErr.message }, { status: 500 });
      }
    }

    console.log(`[Settings API POST] Admin ${caller.email} successfully updated system settings.`);

    return NextResponse.json({
      success: true,
      message: "Settings saved successfully",
    });
  } catch (err: any) {
    console.error("[Settings API POST] Internal server error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
