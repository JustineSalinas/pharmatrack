import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerBaseSchema = z.object({
  email: z.string().email("Please use your USA email").endsWith(".edu.ph", "Must be a university email"),
  full_name: z.string().min(3, "Full name is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirm_password: z.string(),
  account_type: z.enum(["student", "faculty", "admin"]),
});

export const studentRegisterSchema = registerBaseSchema.extend({
  account_type: z.literal("student"),
  student_id_number: z.string().min(5, "ID is required"), // e.g., USA-2026-0001
  section: z.string().min(1, "Section is required"),
  current_year: z.string().min(1, "Year is required"),
}).refine((d) => d.password === d.confirm_password, {
  message: "Passwords do not match",
  path: ["confirm_password"],
});

export const adminRegisterSchema = registerBaseSchema.extend({
  account_type: z.literal("admin"),
}).refine((d) => d.password === d.confirm_password, {
  message: "Passwords do not match",
  path: ["confirm_password"],
});

export const qrSessionSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  section: z.string().min(1, "Section is required"),
  date: z.string(),
  duration_minutes: z.number().min(1).max(60),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type StudentRegisterInput = z.infer<typeof studentRegisterSchema>;
export type AdminRegisterInput = z.infer<typeof adminRegisterSchema>;
export type QRSessionInput = z.infer<typeof qrSessionSchema>;
