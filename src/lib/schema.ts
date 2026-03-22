export type AccountType = "student" | "faculty" | "admin";
export type AttendanceStatus = "present" | "absent" | "late";

export interface User {
  id: string;
  email: string;
  full_name: string;
  account_type: AccountType;
  created_at: string;
}

export interface StudentProfile {
  id: string;
  user_id: string;
  student_id_number: string;
  section: string;
  current_year: string;
}

export interface FacultyProfile {
  id: string;
  user_id: string;
  department: string;
}

export interface QRSession {
  id: string;
  faculty_id: string;
  subject: string;
  section: string;
  date: string;
  expires_at: string;
  code: string;
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  student_id: string;
  session_id: string;
  status: AttendanceStatus;
  time_in: string | null;
  time_out: string | null;
  date: string;
  subject: string;
  section: string;
  remarks: string;
}
