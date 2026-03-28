import { createClient } from "@supabase/supabase-js";
import type { PharmaUser, StudentProfile, FacilitatorProfile, QRSession, AttendanceRecord } from "./schema";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export type Database = {
  public: {
    Tables: {
      users: {
        Row: any;
        Insert: any;
        Update: any;
      };
      student_profiles: {
        Row: any;
        Insert: any;
        Update: any;
      };
      facilitator_profiles: {
        Row: any;
        Insert: any;
        Update: any;
      };
      qr_sessions: {
        Row: any;
        Insert: any;
        Update: any;
      };
      attendance_records: {
        Row: any;
        Insert: any;
        Update: any;
      };
    };
    Views: {
      student_attendance_summary: { Row: any };
    };
  };
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
