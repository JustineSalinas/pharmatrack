import { supabase } from "./supabase";

/**
 * Opportunistically fires the server-side weekly attendance digest send.
 * Just a `fetch()` — the actual aggregation and nodemailer send live in
 * /api/admin/weekly-report, which can't be imported into client bundles
 * (see notifyAbsences in src/lib/attendance.ts for the same reasoning).
 * The route itself checks system_config.weeklyReports and no-ops if it's off.
 */
export async function triggerWeeklyReport(): Promise<{ success: boolean; sent?: number } | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const res = await fetch("/api/admin/weekly-report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    return await res.json();
  } catch {
    return null;
  }
}
