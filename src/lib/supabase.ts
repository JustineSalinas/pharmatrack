import { createClient } from "@supabase/supabase-js";
import type { PharmaUser, StudentProfile, FacilitatorProfile, QRSession, AttendanceRecord } from "./schema";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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
    Views: {
      student_attendance_summary: { Row: any };
    };
  };
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
    lock: async (name, acquireTimeout, fn) => {
      return await fn();
    },
  },
});

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
