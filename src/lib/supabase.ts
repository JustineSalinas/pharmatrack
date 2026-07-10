import { createBrowserClient } from "@supabase/ssr";
import type { PharmaUser, StudentProfile, FacilitatorProfile, QRSession, AttendanceRecord } from "./schema";

const supabaseUrl = typeof window !== "undefined"
  ? `${window.location.origin}/supabase-api`
  : (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co");
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";

export type Database = {
  public: {
    Tables: {
      users: {
        Row: { id: string; email: string; full_name: string; account_type: string; status: string; created_at: string; updated_at?: string };
        Insert: { id: string; email: string; full_name: string; account_type: string; status?: string; created_at?: string };
        Update: { id?: string; email?: string; full_name?: string; account_type?: string; status?: string; updated_at?: string };
      };
      student_profiles: {
        Row: { user_id: string; student_id_number: string; section: string; current_year: string; qr_code_id?: any; created_at: string };
        Insert: { user_id: string; student_id_number: string; section: string; current_year: string; qr_code_id?: any; created_at?: string };
        Update: { student_id_number?: string; section?: string; current_year?: string; qr_code_id?: any };
      };
      facilitator_profiles: {
        Row: { user_id: string; department: string; created_at: string };
        Insert: { user_id: string; department: string; created_at?: string };
        Update: { department?: string };
      };
      qr_sessions: {
        Row: { id: string; facilitator_id: string; subject: string; section: string; date: string; expires_at: string; code: string; created_at: string };
        Insert: { id?: string; facilitator_id: string; subject: string; section: string; date: string; expires_at: string; code: string; created_at?: string };
        Update: { facilitator_id?: string; subject?: string; section?: string; date?: string; expires_at?: string; code?: string };
      };
      attendance_records: {
        Row: { id: string; student_id: string; session_id: string; status: string; time_in: string | null; time_out: string | null; date: string; subject: string; section: string; remarks: string | null; created_at: string };
        Insert: { id?: string; student_id: string; session_id: string; status: string; time_in?: string | null; time_out?: string | null; date: string; subject: string; section: string; remarks?: string | null; created_at?: string };
        Update: { status?: string; time_in?: string | null; time_out?: string | null; remarks?: string | null };
      };
    };
  };
};

// createBrowserClient (from @supabase/ssr) stores the PKCE code verifier in
// cookies instead of localStorage, so the server-side /auth/callback route can
// read it during the code-exchange step — fixing the "PKCE verifier not found"
// error that occurs when a confirmation link is opened in Gmail or a new tab.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

/**
 * Parses a YYYY-MM-DD date string as LOCAL midnight, avoiding the UTC-offset
 * bug where `new Date("YYYY-MM-DD")` is treated as UTC midnight and renders
 * one day behind in timezones ahead of UTC (e.g. Asia/Manila = UTC+8).
 *
 * ✅ Correct: parseDateLocal("2026-06-03") → June 3 @ 00:00 local time
 * ❌ Wrong:   new Date("2026-06-03")       → June 2 @ 16:00 local (UTC-8 offset)
 */
export function parseDateLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d); // month is 0-indexed; no timezone offset applied
}

/**
 * Formats a YYYY-MM-DD date string to a locale-aware string, correctly
 * treating the date as local time rather than UTC.
 */
export function formatDateLocal(
  dateStr: string,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }
): string {
  return parseDateLocal(dateStr).toLocaleDateString("en-US", options);
}

/**
 * Produces a YYYY-MM-DD key from a local-timezone Date object without
 * using .toISOString() (which converts to UTC and can shift the date).
 */
export function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * All of the above (parseDateLocal/formatDateLocal/toLocalDateKey) — and
 * event check-in/check-out time handling elsewhere in the app — used to
 * assume "the browser's local timezone" and "Asia/Manila" are the same
 * thing. That broke in production: a device with its system clock/timezone
 * set to anything other than Philippine time silently created and displayed
 * event windows hours off from what was actually entered, without any error.
 *
 * These helpers make Manila explicit and independent of the viewing
 * device's own clock — Manila is a fixed UTC+8 offset with no DST, so this
 * is safe to hardcode rather than relying on Intl/timezone detection.
 */
const MANILA_TIME_ZONE = "Asia/Manila";
const MANILA_UTC_OFFSET = "+08:00";

/**
 * Converts a wall-clock date + time (as entered by an admin, always meant
 * as Manila local time) into the correct UTC ISO timestamp for storage —
 * regardless of what timezone the entering device's system clock reports.
 *
 * ✅ manilaWallClockToISO("2026-07-10", "11:30") → "2026-07-10T03:30:00.000Z"
 *    (correct, always, on any device)
 * ❌ new Date("2026-07-10T11:30:00").toISOString() → correct ONLY if the
 *    device's own system timezone happens to be Asia/Manila
 */
export function manilaWallClockToISO(dateStr: string, timeStr: string): string {
  return new Date(`${dateStr}T${timeStr}:00${MANILA_UTC_OFFSET}`).toISOString();
}

/**
 * Formats a stored UTC timestamp as Manila wall-clock time for display,
 * regardless of the viewing device's own system timezone.
 */
export function formatManilaTime(
  isoString: string,
  options: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", hour12: true }
): string {
  return new Date(isoString).toLocaleTimeString("en-US", { ...options, timeZone: MANILA_TIME_ZONE });
}

/** Same as formatManilaTime, for the date portion. */
export function formatManilaDate(
  isoString: string,
  options: Intl.DateTimeFormatOptions = { weekday: "long", month: "long", day: "numeric", year: "numeric" }
): string {
  return new Date(isoString).toLocaleDateString("en-US", { ...options, timeZone: MANILA_TIME_ZONE });
}

/**
 * Returns a 24-hour "HH:MM" string in Manila time, suitable for pre-filling
 * an <input type="time"> when editing an existing event — regardless of the
 * viewing device's own system timezone.
 */
export function manilaTimeInputValue(isoString: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(isoString));
  const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
  // Intl's 24h formatting can return "24" for midnight in some environments.
  return `${hh === "24" ? "00" : hh}:${mm}`;
}
