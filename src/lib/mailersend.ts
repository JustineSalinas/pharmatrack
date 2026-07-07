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
    const dateTo = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) / 1000) - 1;

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
