import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";

export interface EventBroadcastInput {
  name: string;
  location: string;
  date: string;
  checkInStart: string;
  checkInLate: string;
  checkInEnd: string;
  recipients: Array<{ email: string; full_name: string }>;
}

export async function sendEventBroadcast(event: EventBroadcastInput) {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_USER,
    SMTP_PASS,
    SMTP_FROM,
  } = process.env;

  const isSMTPConfigured = !!(SMTP_HOST && SMTP_USER && SMTP_PASS);

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

  if (isSMTPConfigured) {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT || 587),
      secure: SMTP_SECURE === "true",
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    const emailPromises = event.recipients.map(async (student) => {
      const mailOptions = {
        from: SMTP_FROM || `"PharmaTrack" <${SMTP_USER}>`,
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
