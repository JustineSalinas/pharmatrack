import { z } from "zod";

// This ensures Student IDs always follow: 2024-XXXXX-USA
export const StudentIdSchema = z
  .string()
  .regex(/^\d{4}-\d{5}-USA$/, "Invalid format. Must be YYYY-XXXXX-USA");

// This ensures the Attendance Log is clean
export const AttendanceSchema = z.object({
  student_id: StudentIdSchema,
  event_id: z.string().uuid(),
  status: z.enum(["Present", "Late", "Absent", "Incomplete"]),
});

export type StudentId = z.infer<typeof StudentIdSchema>;
export type Attendance = z.infer<typeof AttendanceSchema>;

