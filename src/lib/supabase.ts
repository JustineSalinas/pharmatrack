import { createClient } from "@supabase/supabase-js";
import type { User, StudentProfile, FacultyProfile, QRSession, AttendanceRecord } from "./schema";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export type Database = {
  public: {
    Tables: {
      users: { Row: User; Insert: Omit<User, "id" | "created_at">; Update: Partial<User> };
      student_profiles: { Row: StudentProfile; Insert: Omit<StudentProfile, "id">; Update: Partial<StudentProfile> };
      faculty_profiles: { Row: FacultyProfile; Insert: Omit<FacultyProfile, "id">; Update: Partial<FacultyProfile> };
      qr_sessions: { Row: QRSession; Insert: Omit<QRSession, "id" | "created_at">; Update: Partial<QRSession> };
      attendance_records: { Row: AttendanceRecord; Insert: Omit<AttendanceRecord, "id">; Update: Partial<AttendanceRecord> };
    };
  };
};

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient<Database>(supabaseUrl, supabaseAnonKey)
  : (null as any);
