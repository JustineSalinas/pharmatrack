import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_MONTHLY_QUOTA = 5000;

/** 'YYYY-MM' in UTC — matches the primary key format on public.email_usage. */
export function currentMonthKey(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Records `count` newly-sent emails against the current month's tally via the
 * atomic `increment_email_usage` Postgres function (schema.sql) — a plain
 * read-then-write here would lose updates since broadcast batches send
 * concurrently. Best-effort: callers should not let a tracking failure block
 * the actual email send/response, same fail-open philosophy as
 * claimSharedRun() in src/lib/attendance.ts.
 */
export async function recordEmailsSent(client: SupabaseClient, count: number): Promise<void> {
  if (count <= 0) return;
  try {
    const { error } = await client.rpc("increment_email_usage", {
      p_month: currentMonthKey(),
      p_count: count,
    });
    if (error) {
      console.error("[Email Usage] Failed to record sent count:", error);
    }
  } catch (err) {
    console.error("[Email Usage] Failed to record sent count:", err);
  }
}

export interface EmailUsage {
  month: string;
  count: number;
  cap: number;
  percent: number;
}

/**
 * Reads the current month's usage against the admin-configurable
 * `emailMonthlyQuota` system_config value (defaults to 5000 — the MailerSend
 * plan's monthly cap). Does NOT include Supabase Auth's own registration
 * confirmation emails, which are sent outside application code and can't be
 * counted here.
 */
export async function getEmailUsage(client: SupabaseClient): Promise<EmailUsage> {
  const month = currentMonthKey();

  const [{ data: usageRow }, { data: configRow }] = await Promise.all([
    client.from("email_usage").select("sent_count").eq("month", month).maybeSingle(),
    client.from("system_config").select("value").eq("key", "emailMonthlyQuota").maybeSingle(),
  ]);

  const count = usageRow?.sent_count ?? 0;
  const cap = Number(configRow?.value) || DEFAULT_MONTHLY_QUOTA;
  const percent = cap > 0 ? Math.round((count / cap) * 100) : 0;

  return { month, count, cap, percent };
}
