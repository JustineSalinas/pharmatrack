import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { getBackendUser } from "@/lib/auth";

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

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || apiKey === "re_your_api_key_here") {
      return NextResponse.json({
        error: "Resend is not configured. Please set RESEND_API_KEY in your environment variables."
      }, { status: 400 });
    }

    const fromAddress = process.env.RESEND_FROM || "PharmaTrack <notifications@usa.edu.ph>";
    const resend = new Resend(apiKey);

    console.log(`[TestEmail API] Admin ${caller.email} sending Resend test email.`);

    const { error } = await resend.emails.send({
      from: fromAddress,
      to: callerProfile.email,
      subject: "PharmaTrack: Email Service Test Successful",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px; background-color: #ffffff; color: #333333;">
          <div style="text-align: center; border-bottom: 2px solid #E8B84B; padding-bottom: 15px; margin-bottom: 20px;">
            <h2 style="color: #1e1432; margin: 0;">PharmaTrack Portal</h2>
            <span style="color: #666666; font-size: 14px;">System Control Center</span>
          </div>

          <p>Dear <strong>${callerProfile.full_name}</strong>,</p>

          <p>This is a test notification confirming that your Resend email service is connected and working correctly.</p>

          <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 15px; margin: 20px 0; border-radius: 4px; color: #14532d;">
            <strong style="display: block; font-size: 15px; margin-bottom: 4px;">✓ Resend Connected!</strong>
            Email delivery is active and ready to broadcast to students.
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px;">
            <tr style="border-bottom: 1px solid #eaeaea;">
              <td style="padding: 8px 0; color: #666666; width: 150px;">Verified Timestamp:</td>
              <td style="padding: 8px 0; font-weight: bold; color: #1e1432;">${new Date().toLocaleString("en-US")}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eaeaea;">
              <td style="padding: 8px 0; color: #666666;">Service:</td>
              <td style="padding: 8px 0; color: #1e1432;">Resend</td>
            </tr>
            <tr style="border-bottom: 1px solid #eaeaea;">
              <td style="padding: 8px 0; color: #666666;">Sender:</td>
              <td style="padding: 8px 0; color: #1e1432;">${fromAddress}</td>
            </tr>
          </table>

          <p style="margin-top: 30px; font-size: 12px; color: #777777; border-top: 1px solid #eaeaea; padding-top: 15px; text-align: center;">
            This is an automated system verification from PharmaTrack.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("[TestEmail API] Resend error:", error.message);
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
