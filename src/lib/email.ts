import nodemailer from "nodemailer";

export function getTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: SMTP_SECURE === "true",
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

export interface EventBroadcastInput {
  name: string;
  location: string;
  date: string;
  checkInStart: string;
  checkInLate: string;
  checkInEnd: string;
  eventType?: string | null;
  targetYearLevels?: string[] | null;
  recipients: Array<{ email: string; full_name: string }>;
}

export async function sendEventBroadcast(event: EventBroadcastInput) {
  const transporter = getTransporter();

  if (!transporter) {
    console.warn("[Email Service] SMTP not configured — skipping broadcast.");
    return;
  }

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

  const displayEventType = event.eventType ?? "Department";
  const eventTypeColorMap: Record<string, string> = {
    "University Wide": "#ef4444",
    "Pharmacy": "#a78bfa",
    "Department": "#D4AF37",
  };
  const eventTypeColor = eventTypeColorMap[displayEventType] ?? "#D4AF37";

  const displayYearLevels =
    event.targetYearLevels && event.targetYearLevels.length > 0
      ? event.targetYearLevels.join(", ")
      : "All Year Levels";

  const fromAddress = process.env.SMTP_FROM || "PharmaTrack <notifications@usa.edu.ph>";

  const buildHtml = (studentName: string) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px; background-color: #ffffff; color: #333333;">
      <div style="text-align: center; border-bottom: 2px solid #E8B84B; padding-bottom: 15px; margin-bottom: 20px;">
        <h2 style="color: #1e1432; margin: 0;">PharmaTrack Portal</h2>
        <span style="color: #666666; font-size: 14px;">University of San Agustin Pharmacy Department</span>
      </div>

      <p>Dear <strong>${studentName}</strong>,</p>

      <p>A new <strong style="color: ${eventTypeColor};">${displayEventType}</strong> event has been scheduled for <strong>${displayYearLevels}</strong>. Please find the details below:</p>

      <div style="background-color: #f7f7f9; border-left: 4px solid ${eventTypeColor}; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; font-weight: bold; color: #666666; width: 130px;">Event Name:</td>
            <td style="padding: 6px 0; font-weight: bold; color: #1e1432;">${event.name}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #666666;">Event Type:</td>
            <td style="padding: 6px 0;">
              <span style="display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: bold; background-color: ${eventTypeColor}20; color: ${eventTypeColor}; border: 1px solid ${eventTypeColor}40;">
                ${displayEventType}
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #666666;">For Year Levels:</td>
            <td style="padding: 6px 0; font-weight: bold; color: #1e1432;">${displayYearLevels}</td>
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
  `;

  console.log(`[Email Service] Preparing Gmail SMTP broadcast for "${event.name}" to ${event.recipients.length} students.`);

  const BATCH_SIZE = 100;
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < event.recipients.length; i += BATCH_SIZE) {
    const batch = event.recipients.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map((student) =>
        transporter.sendMail({
          from: fromAddress,
          to: student.email,
          subject: `[${displayEventType}] New Event Scheduled: ${event.name}`,
          html: buildHtml(student.full_name),
        })
      )
    );

    results.forEach((result, idx) => {
      if (result.status === "fulfilled") {
        sent += 1;
      } else {
        failed += 1;
        console.error(`[Email Service] Failed to send to ${batch[idx].email}:`, result.reason);
      }
    });
  }

  console.log(`[Email Service] Broadcast complete — sent: ${sent}, failed: ${failed}`);
}
