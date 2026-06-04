import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { getBackendUser } from "@/lib/auth";
import { getSMTPConfig } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Create a Supabase service role client to verify caller profile
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );

  try {
    // 1. Authenticate caller
    const caller = await getBackendUser(req);
    if (!caller) {
      console.warn("[TestSMTP API] Unauthorized attempt - no valid session");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Fetch and verify admin profile
    const { data: callerProfile, error: profileErr } = await adminClient
      .from("users")
      .select("account_type, status, email, full_name")
      .eq("id", caller.id)
      .single();

    if (profileErr || !callerProfile) {
      console.error(`[TestSMTP API] Failed to fetch profile for user ${caller.id}:`, profileErr);
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (callerProfile.account_type !== "admin" || callerProfile.status !== "approved") {
      console.warn(`[TestSMTP API] Forbidden access attempt by ${caller.email} (Role: ${callerProfile.account_type}, Status: ${callerProfile.status})`);
      return NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 });
    }

    // 3. Parse and validate SMTP payload
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const { smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass, smtpFrom } = body;
    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
      return NextResponse.json({ error: "Missing required SMTP connection parameters" }, { status: 400 });
    }

    let hostToTest = smtpHost;
    let portToTest = Number(smtpPort);
    let secureToTest = smtpSecure === "true" || smtpSecure === true;
    let userToTest = smtpUser;
    let passToTest = smtpPass;
    let fromToTest = smtpFrom;

    // Resolve masked password on the server
    if (passToTest === "••••••••") {
      const activeConfig = await getSMTPConfig();
      if (activeConfig.isSMTPConfigured) {
        passToTest = activeConfig.pass;
        // Fallback other values if they match active config user/host
        if (userToTest === activeConfig.user || !userToTest) {
          userToTest = activeConfig.user;
        }
        if (hostToTest === activeConfig.host || !hostToTest) {
          hostToTest = activeConfig.host;
        }
        if (Number(smtpPort) === activeConfig.port || !smtpPort) {
          portToTest = activeConfig.port;
        }
        if ((smtpSecure === "true" || smtpSecure === true) === activeConfig.secure || smtpSecure === undefined) {
          secureToTest = activeConfig.secure;
        }
        if (!fromToTest) {
          fromToTest = activeConfig.from;
        }
      } else {
        return NextResponse.json({ error: "SMTP is not configured on the server yet" }, { status: 400 });
      }
    }

    console.log(`[TestSMTP API] Admin ${caller.email} testing SMTP connection at ${hostToTest}:${portToTest} (Secure: ${secureToTest})`);

    // 4. Configure nodemailer transporter
    const transporter = nodemailer.createTransport({
      host: hostToTest,
      port: portToTest,
      secure: secureToTest,
      auth: {
        user: userToTest,
        pass: passToTest,
      },
      tls: {
        rejectUnauthorized: false, // ensures high compatibility with common networks
      },
    });

    // Verify connection configurations before attempting to send
    try {
      await transporter.verify();
    } catch (verifyErr: any) {
      console.error(`[TestSMTP API] Transporter verification failed:`, verifyErr.message);
      return NextResponse.json({
        success: false,
        error: `Connection verification failed: ${verifyErr.message}`
      }, { status: 400 });
    }

    // 5. Send a styled test HTML email to the administrator
    const testMailOptions = {
      from: fromToTest || `"PharmaTrack" <${userToTest}>`,
      to: callerProfile.email,
      subject: "PharmaTrack: SMTP Connection Test Successful",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px; background-color: #ffffff; color: #333333;">
          <div style="text-align: center; border-bottom: 2px solid #E8B84B; padding-bottom: 15px; margin-bottom: 20px;">
            <h2 style="color: #1e1432; margin: 0;">PharmaTrack Portal</h2>
            <span style="color: #666666; font-size: 14px;">System Control Center</span>
          </div>
          
          <p>Dear <strong>${callerProfile.full_name}</strong>,</p>
          
          <p>This is a test notification confirming that your SMTP connection settings have been successfully verified and authorized.</p>
          
          <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 15px; margin: 20px 0; border-radius: 4px; color: #14532d;">
            <strong style="display: block; font-size: 15px; margin-bottom: 4px;">✓ Connection Verified!</strong>
            The server successfully connected to <strong>${hostToTest}:${portToTest}</strong> and completed authentication for user <strong>${userToTest}</strong>.
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px;">
            <tr style="border-bottom: 1px solid #eaeaea;">
              <td style="padding: 8px 0; color: #666666; width: 150px;">Verified Timestamp:</td>
              <td style="padding: 8px 0; font-weight: bold; color: #1e1432;">${new Date().toLocaleString("en-US")}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eaeaea;">
              <td style="padding: 8px 0; color: #666666;">Mail Server / Host:</td>
              <td style="padding: 8px 0; color: #1e1432;">${hostToTest}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eaeaea;">
              <td style="padding: 8px 0; color: #666666;">Secure SSL/TLS:</td>
              <td style="padding: 8px 0; color: #1e1432;">${secureToTest ? "Yes (SSL/TLS)" : "No (STARTTLS)"}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eaeaea;">
              <td style="padding: 8px 0; color: #666666;">Sender Display:</td>
              <td style="padding: 8px 0; color: #1e1432;">${fromToTest || userToTest}</td>
            </tr>
          </table>
          
          <p style="margin-top: 30px; font-size: 12px; color: #777777; border-top: 1px solid #eaeaea; padding-top: 15px; text-align: center;">
            This is an automated system verification from PharmaTrack.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(testMailOptions);
    console.log(`[TestSMTP API] SMTP Test Connection email successfully sent to ${callerProfile.email}`);

    return NextResponse.json({
      success: true,
      message: `SMTP test connection successful. Test email sent to ${callerProfile.email}.`
    });

  } catch (err: any) {
    console.error("[TestSMTP API] Internal server error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
