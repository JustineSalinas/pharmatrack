import { z } from "zod";

/**
 * PHARMATRACK VALIDATION SCHEMAS
 * Standardizing the data format for the University of San Agustin CPMT.
 */

// 1. Student ID Validator (Format: 2024-00001-USA)
export const studentIdSchema = z
  .string()
  .regex(/^\d{4}-\d{5}-USA$/, {
    message: "ID must follow the format: YYYY-XXXXX-USA",
  });

// 2. Profile Schema (For Registration/Updates)
export const profileSchema = z.object({
  student_id: studentIdSchema,
  full_name: z.string().min(3, "Full name is too short"),
  year_level: z.enum(["1", "2", "3", "4"]),
  section: z.string().min(1, "Section is required"),
  qr_code_string: z.string(),
});

// 3. Scan Schema (For Week 2: Turning a scan into a record)
export const scanSchema = z.object({
  student_id: studentIdSchema,
  event_id: z.string().uuid("Invalid Event ID"),
  location_lat: z.number().optional(),
  location_long: z.number().optional(),
});

// Types for TypeScript intellisense
export type StudentProfile = z.infer<typeof profileSchema>;
export type AttendanceScan = z.infer<typeof scanSchema>;