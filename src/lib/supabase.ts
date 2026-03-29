import { createClient } from "@supabase/supabase-js";
import type { PharmaUser, StudentProfile, FacilitatorProfile, QRSession, AttendanceRecord } from "./schema";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export type Database = {
  public: {
    Tables: {
      users: {
        Row: { id: string; email: string; full_name: string; account_type: string; status: string; created_at: string };
        Insert: { id: string; email: string; full_name: string; account_type: string; status?: string; created_at?: string };
        Update: { id?: string; email?: string; full_name?: string; account_type?: string; status?: string };
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
