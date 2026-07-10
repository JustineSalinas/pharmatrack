/**
 * Reads the account's real monthly email volume directly from MailerSend's
 * Analytics API (https://developers.mailersend.com/api/v1/analytics.html)
 * rather than relying solely on PharmaTrack's own internal tally in
 * src/lib/emailUsage.ts. This requires a MailerSend API token — a different
 * credential than the SMTP_USER/SMTP_PASS used for actually sending mail —
 * set as MAILERSEND_API_KEY. Without it, callers should fall back to the
 * internal count.
 *
 * Note: MailerSend's docs don't explicitly state whether the "sent" analytics
 * event counts SMTP-relayed mail (which is how this app sends) in addition to
 * HTTP Email API sends. If the number here looks off vs. MailerSend's own
 * dashboard, that's the first thing to check.
 */
export interface MailerSendUsageResult {
  available: boolean;
  sent?: number;
  reason?: string;
}

export async function getMailerSendUsage(): Promise<MailerSendUsageResult> {
  const apiKey = process.env.MAILERSEND_API_KEY;
  if (!apiKey) {
    return { available: false, reason: "MAILERSEND_API_KEY not configured" };
  }

  try {
    const now = new Date();
    const dateFrom = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000);
    // Not just "now" — MailerSend's analytics data lags several hours behind
    // real time, and date_to landing inside that unprocessed window also
    // 422s (same symptom as an actually-future date, confirmed by hitting
    // this live: a date_to only 2 hours in the past still failed, 6 hours
    // back succeeded). Back off by a safety margin so this doesn't
    // intermittently fail and silently fall back to the internal-only count.
    const ANALYTICS_LAG_SAFETY_MARGIN_MS = 6 * 60 * 60 * 1000;
    // Clamp to dateFrom: in the first 6 hours of a new month, subtracting the
    // margin would otherwise push date_to before the 1st, an invalid range.
    const dateTo = Math.max(dateFrom, Math.floor((now.getTime() - ANALYTICS_LAG_SAFETY_MARGIN_MS) / 1000));

    const url = new URL("https://api.mailersend.com/v1/analytics/date");
    url.searchParams.set("date_from", String(dateFrom));
    url.searchParams.set("date_to", String(dateTo));
    url.searchParams.set("group_by", "months");
    url.searchParams.append("event[]", "sent");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });

    if (!res.ok) {
      return { available: false, reason: `MailerSend API returned HTTP ${res.status}` };
    }

    const json = await res.json();
    const stats: Array<{ sent?: number }> = json?.data?.stats ?? [];
    const sent = stats.reduce((sum, s) => sum + (Number(s.sent) || 0), 0);

    return { available: true, sent };
  } catch (err: any) {
    return { available: false, reason: err?.message ?? "MailerSend API request failed" };
  }
}
