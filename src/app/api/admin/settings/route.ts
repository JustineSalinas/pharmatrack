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
  smtpHost: "smtp.gmail.com",
  smtpPort: "587",
  smtpSecure: "false",
  smtpUser: "",
  smtpPass: "",
  smtpFrom: "PharmaTrack <your-email@gmail.com>",
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

    // 5. Check if environment variables for SMTP are configured
    const envHost = process.env.SMTP_HOST;
    const envPort = process.env.SMTP_PORT;
    const envSecure = process.env.SMTP_SECURE;
    const envUser = process.env.SMTP_USER;
    const envPass = process.env.SMTP_PASS;
    const envFrom = process.env.SMTP_FROM;

    const isSMTPManagedByEnv = !!(envHost && envUser && envPass);

    // 6. Merge configurations safely
    const settings: Record<string, string> = {};

    Object.keys(DEFAULTS).forEach((key) => {
      // For SMTP variables, prioritize environment variables if isSMTPManagedByEnv is true
      if (isSMTPManagedByEnv && ["smtpHost", "smtpPort", "smtpSecure", "smtpUser", "smtpPass", "smtpFrom"].includes(key)) {
        if (key === "smtpPass") {
          settings[key] = "••••••••";
        } else if (key === "smtpHost") {
          settings[key] = envHost || "";
        } else if (key === "smtpPort") {
          settings[key] = envPort || "587";
        } else if (key === "smtpSecure") {
          settings[key] = envSecure || "false";
        } else if (key === "smtpUser") {
          settings[key] = envUser || "";
        } else if (key === "smtpFrom") {
          settings[key] = envFrom || "";
        }
      } else {
        // Fall back to database config or defaults
        const dbVal = dbMap.get(key);
        if (key === "smtpPass") {
          // If password exists, return a mask value instead of plaintext
          settings[key] = dbVal || envPass ? "••••••••" : "";
        } else {
          settings[key] = dbVal !== undefined ? dbVal : DEFAULTS[key];
        }
      }
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

    // 4. Fetch current configurations to resolve masked passwords
    const { data: dbConfigs, error: fetchErr } = await adminClient
      .from("system_config")
      .select("key, value");

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    const dbMap = new Map((dbConfigs || []).map((item) => [item.key, item.value]));

    // Check env values for backup
    const isSMTPManagedByEnv = !!(
      process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
    );

    // 5. Prepare upsert records
    const upserts = Object.keys(DEFAULTS).map((key) => {
      let value = settings[key];

      // Handle sensitive fields (like smtpPass)
      if (key === "smtpPass") {
        if (value === "••••••••") {
          // If the password is still masked, don't overwrite it. Keep the DB value or default.
          value = dbMap.get("smtpPass") || "";
        }
      }

      // If SMTP is managed by environment variables, prevent saving SMTP settings to database
      if (isSMTPManagedByEnv && ["smtpHost", "smtpPort", "smtpSecure", "smtpUser", "smtpPass", "smtpFrom"].includes(key)) {
        return null; // Skip DB write
      }

      return {
        key,
        value: String(value !== undefined ? value : DEFAULTS[key]),
        updated_at: new Date().toISOString(),
      };
    }).filter(Boolean) as Array<{ key: string; value: string; updated_at: string }>;

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
