import { z } from "zod";

export type AccountType = "student" | "facilitator" | "admin";
export type AttendanceStatus = "present" | "absent" | "late" | "incomplete";

export interface PharmaUser {
  id: string;
  email: string;
  full_name: string;
  account_type: AccountType;
  status: string;
  created_at: string;
}

export interface StudentProfile {
  id: string;
  user_id: string;
  student_id_number: string;
  section: string;
  current_year: string;
  qr_code_id: string;
}

export interface FacilitatorProfile {
  id: string;
  user_id: string;
  department: string;
}

export interface Event {
  id: string;
  name: string;
  description: string | null;
  location: string;
  date: string;
  check_in_start: string;
  check_in_late: string;
  check_in_end: string;
  check_out_start: string | null;
  check_out_end: string | null;
  created_by: string;
  created_at: string;
}

export interface QRSession {
  id: string;
  facilitator_id: string;
  subject: string;
  section: string;
  date: string;
  expires_at: string;
  code: string;
  duration_minutes?: number;
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  student_id: string;
  event_id?: string;
  session_id?: string;
  status: AttendanceStatus;
  time_in: string | null;
  time_out: string | null;
  date?: string;
  subject?: string;
  section?: string;
  scanned_by?: string | null;
  remarks?: string | null;
  created_at: string;
}

export const UpdateProfileSchema = z.object({
  full_name: z.string().min(2, "Full name must be at least 2 characters"),
});
