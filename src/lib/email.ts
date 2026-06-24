import nodemailer from "nodemailer";
import { getEventTypeStyle } from "./event-type";

const BRAND = {
  bg: "#f4f4f7",
  surface: "#ffffff",
  ink: "#1e1432",
  muted: "#6b7280",
  border: "#e5e7eb",
  panel: "#f7f7f9",
  gold: "#E8B84B",
};

/**
 * Shared shell every PharmaTrack email renders inside of — keeps the
 * wordmark header, body padding, and footer disclaimer identical across
 * the event broadcast, password reset, and SMTP test emails.
 */
export function renderEmailShell(opts: { eyebrow: string; bodyHtml: string }): string {
  return `
    <div style="background-color:${BRAND.bg}; padding: 32px 16px; font-family: Arial, Helvetica, sans-serif;">
      <div style="max-width: 560px; margin: 0 auto; background-color:${BRAND.surface}; border: 1px solid ${BRAND.border}; border-radius: 10px; overflow: hidden;">
        <div style="background-color:${BRAND.ink}; padding: 24px 28px;">
          <div style="font-size: 20px; font-weight: 800; letter-spacing: 0.5px;">
            <span style="color:#ffffff;">PHARMA</span><span style="color:${BRAND.gold};">TRACK</span>
          </div>
          <div style="color: rgba(255,255,255,0.55); font-size: 12px; margin-top: 4px;">${opts.eyebrow}</div>
        </div>
        <div style="padding: 28px; color: ${BRAND.ink}; font-size: 14px; line-height: 1.6;">
          ${opts.bodyHtml}
        </div>
        <div style="padding: 16px 28px; border-top: 1px solid ${BRAND.border}; color: ${BRAND.muted}; font-size: 11px; text-align: center;">
          This is an automated message from PharmaTrack — University of San Agustin Pharmacy Department. Please do not reply directly to this email.
        </div>
      </div>
    </div>
  `;
}

/** A label/value details panel, styled identically wherever it appears. */
export function renderDetailsPanel(rows: Array<{ label: string; value: string }>): string {
  const rowsHtml = rows
    .map(
      (row) => `
        <tr>
          <td style="padding: 6px 0; color: ${BRAND.muted}; width: 130px; vertical-align: top;">${row.label}</td>
          <td style="padding: 6px 0; font-weight: bold; color: ${BRAND.ink};">${row.value}</td>
        </tr>
      `
    )
    .join("");

  return `
    <div style="background-color: ${BRAND.panel}; border: 1px solid ${BRAND.border}; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse;">${rowsHtml}</table>
    </div>
  `;
}

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
    // Reuse a small pool of connections instead of opening one TCP/TLS
    // connection per email — Gmail throttles/drops bursts of simultaneous
    // connections, which is what batches of 100 concurrent sendMail() calls
    // would otherwise trigger.
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
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
  const ts = getEventTypeStyle(displayEventType);

  const displayYearLevels =
    event.targetYearLevels && event.targetYearLevels.length > 0
      ? event.targetYearLevels.join(", ")
      : "All Year Levels";

  const fromAddress = process.env.SMTP_FROM || "PharmaTrack <notifications@usa.edu.ph>";

  const buildHtml = (studentName: string) => {
    const typeBadge = `<span style="display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: bold; background-color: ${ts.bg}; color: ${ts.color}; border: 1px solid ${ts.border};">${ts.label}</span>`;

    const bodyHtml = `
      <p>Dear <strong>${studentName}</strong>,</p>
      <p>A new ${typeBadge} event has been scheduled for <strong>${displayYearLevels}</strong>. Please find the details below:</p>
      ${renderDetailsPanel([
        { label: "Event Name", value: event.name },
        { label: "For Year Levels", value: displayYearLevels },
        { label: "Date", value: displayDate },
        { label: "Location", value: event.location },
        { label: "Check-in", value: startTimeStr },
        { label: "Mark Late At", value: lateTimeStr },
        { label: "Check-in Ends", value: endTimeStr },
      ])}
      <p>Make sure to bring your <strong>PharmaTrack Student QR Code Pass</strong> to verify your attendance at the venue.</p>
    `;

    return renderEmailShell({ eyebrow: "Event Notification", bodyHtml });
  };

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
