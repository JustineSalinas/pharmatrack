import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getBackendUser } from "@/lib/auth";
import { getTransporter, renderEmailShell, renderDetailsPanel } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );

  try {
    const caller = await getBackendUser(req);
    if (!caller) {
      console.warn("[TestEmail API] Unauthorized attempt - no valid session");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: callerProfile, error: profileErr } = await adminClient
      .from("users")
      .select("account_type, status, email, full_name")
      .eq("id", caller.id)
      .single();

    if (profileErr || !callerProfile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (callerProfile.account_type !== "admin" || callerProfile.status !== "approved") {
      return NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 });
    }

    const transporter = getTransporter();
    if (!transporter) {
      return NextResponse.json({
        error: "SMTP is not configured. Please set SMTP_HOST, SMTP_USER, and SMTP_PASS in your environment variables."
      }, { status: 400 });
    }

    const fromAddress = process.env.SMTP_FROM || "PharmaTrack <notifications@usa.edu.ph>";

    console.log(`[TestEmail API] Admin ${caller.email} sending Gmail SMTP test email.`);

    try {
      const bodyHtml = `
        <p>Dear <strong>${callerProfile.full_name}</strong>,</p>
        <p>This is a test notification confirming that your Gmail SMTP email service is connected and working correctly.</p>
        ${renderDetailsPanel([
          { label: "Status", value: "Connected" },
          { label: "Verified Timestamp", value: new Date().toLocaleString("en-US") },
          { label: "Service", value: "Gmail SMTP" },
          { label: "Sender", value: fromAddress },
        ])}
        <p>Email delivery is active and ready to broadcast to students.</p>
      `;

      await transporter.sendMail({
        from: fromAddress,
        to: callerProfile.email,
        subject: "PharmaTrack: Email Service Test Successful",
        html: renderEmailShell({ eyebrow: "System Control Center", bodyHtml }),
      });
    } catch (error: any) {
      console.error("[TestEmail API] SMTP error:", error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    console.log(`[TestEmail API] Test email sent successfully to ${callerProfile.email}`);
    return NextResponse.json({
      success: true,
      message: `Test email sent successfully to ${callerProfile.email}.`
    });

  } catch (err: any) {
    console.error("[TestEmail API] Internal server error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
