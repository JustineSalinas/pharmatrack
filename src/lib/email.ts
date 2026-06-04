import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

export interface EventBroadcastInput {
  name: string;
  location: string;
  date: string;
  checkInStart: string;
  checkInLate: string;
  checkInEnd: string;
  recipients: Array<{ email: string; full_name: string }>;
}

// Helper to fetch SMTP config from DB with env fallback
export async function getSMTPConfig() {
  // 1. Read environment variables first
  const envHost = process.env.SMTP_HOST;
  const envPort = process.env.SMTP_PORT || "587";
  const envSecure = process.env.SMTP_SECURE || "false";
  const envUser = process.env.SMTP_USER;
  const envPass = process.env.SMTP_PASS;
  const envFrom = process.env.SMTP_FROM || "";

  // Check if standard credentials are fully configured in the environment
  const isManagedByEnv = !!(envHost && envUser && envPass);

  if (isManagedByEnv) {
    return {
      host: envHost,
      port: Number(envPort),
      secure: envSecure === "true",
      user: envUser,
      pass: envPass,
      from: envFrom || (envUser ? `"PharmaTrack" <${envUser}>` : ""),
      isSMTPConfigured: true,
      isManagedByEnv: true,
    };
  }

  // 2. If not fully set in the environment, read from system_config DB table as fallback
  let host = "";
  let port = "587";
  let secure = "false";
  let user = "";
  let pass = "";
  let from = "";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceKey) {
    try {
      const supabase = createClient(supabaseUrl, serviceKey);
      const { data, error } = await supabase
        .from("system_config")
        .select("key, value")
        .in("key", ["smtpHost", "smtpPort", "smtpSecure", "smtpUser", "smtpPass", "smtpFrom"]);

      if (!error && data && data.length > 0) {
        const configMap = new Map(data.map((item) => [item.key, item.value]));
        
        host = configMap.get("smtpHost") || "";
        port = configMap.get("smtpPort") || "587";
        secure = configMap.get("smtpSecure") || "false";
        user = configMap.get("smtpUser") || "";
        pass = configMap.get("smtpPass") || "";
        from = configMap.get("smtpFrom") || "";
      }
    } catch (err: any) {
      console.error("[Email Service] Database lookup failed:", err.message);
    }
  }

  // Fallback to whatever env values exist (even partials) if database lacks settings
  const finalHost = host || envHost || "";
  const finalPort = port || envPort || "587";
  const finalSecure = secure || envSecure || "false";
  const finalUser = user || envUser || "";
  const finalPass = pass || envPass || "";
  const finalFrom = from || envFrom || "";

  return {
    host: finalHost,
    port: Number(finalPort),
    secure: finalSecure === "true",
    user: finalUser,
    pass: finalPass,
    from: finalFrom || (finalUser ? `"PharmaTrack" <${finalUser}>` : ""),
    isSMTPConfigured: !!(finalHost && finalUser && finalPass),
    isManagedByEnv: false,
  };
}

export async function sendEventBroadcast(event: EventBroadcastInput) {
  const config = await getSMTPConfig();

  const localDate = new Date(event.date);
  const displayDate = localDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const formatTime = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return isoString;
    }
  };

  const startTimeStr = formatTime(event.checkInStart);
  const lateTimeStr = formatTime(event.checkInLate);
  const endTimeStr = formatTime(event.checkInEnd);

  console.log(`[Email Service] Preparing broadcast for event "${event.name}" to ${event.recipients.length} students.`);

  if (config.isSMTPConfigured) {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    const emailPromises = event.recipients.map(async (student) => {
      const mailOptions = {
        from: config.from,
        to: student.email,
        subject: `New Event Scheduled: ${event.name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px; background-color: #ffffff; color: #333333;">
            <div style="text-align: center; border-bottom: 2px solid #E8B84B; padding-bottom: 15px; margin-bottom: 20px;">
              <h2 style="color: #1e1432; margin: 0;">PharmaTrack Portal</h2>
              <span style="color: #666666; font-size: 14px;">University of San Agustin Pharmacy Department</span>
            </div>
            
            <p>Dear <strong>${student.full_name}</strong>,</p>
            
            <p>A new department event has been scheduled. Please find the details below:</p>
            
            <div style="background-color: #f7f7f9; border-left: 4px solid #E8B84B; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; color: #666666; width: 120px;">Event Name:</td>
                  <td style="padding: 6px 0; font-weight: bold; color: #1e1432;">${event.name}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #666666;">Date:</td>
                  <td style="padding: 6px 0;">${displayDate}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #666666;">Location:</td>
                  <td style="padding: 6px 0;">${event.location}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #666666;">Check-in:</td>
                  <td style="padding: 6px 0;">${startTimeStr}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #f97316;">Mark Late At:</td>
                  <td style="padding: 6px 0; color: #f97316; font-weight: bold;">${lateTimeStr}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #dc2626;">Check-in Ends:</td>
                  <td style="padding: 6px 0; color: #dc2626; font-weight: bold;">${endTimeStr}</td>
                </tr>
              </table>
            </div>
            
            <p>Make sure to bring your <strong>PharmaTrack Student QR Code Pass</strong> to verify your attendance at the venue.</p>
            
            <p style="margin-top: 30px; font-size: 12px; color: #777777; border-top: 1px solid #eaeaea; padding-top: 15px; text-align: center;">
              This is an automated notification from PharmaTrack. Please do not reply directly to this email.
            </p>
          </div>
        `,
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log(`[Email Service] Broadcast sent successfully to ${student.email}`);
      } catch (err: any) {
        console.error(`[Email Service] Failed to send email to ${student.email}:`, err.message);
      }
    });

    await Promise.all(emailPromises);
  } else {
    const logDir = path.join(process.cwd(), "scratch");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logFilePath = path.join(logDir, "email-broadcasts.log");

    const logEntries = event.recipients.map((student) => {
      return `[${new Date().toISOString()}] BROADCAST TO: ${student.full_name} (${student.email})
Subject: New Event Scheduled: ${event.name}
Event Details:
- Location: ${event.location}
- Date: ${displayDate}
- Check-in Starts: ${startTimeStr}
- Mark Late At: ${lateTimeStr}
- Check-in Ends: ${endTimeStr}
--------------------------------------------------------------------------------\n`;
    }).join("");

    fs.appendFileSync(logFilePath, logEntries, "utf-8");
    console.log(`[Email Service] SMTP configuration missing. Appended ${event.recipients.length} mock email logs to: scratch/email-broadcasts.log`);
  }
}
