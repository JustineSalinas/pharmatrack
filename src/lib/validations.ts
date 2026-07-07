import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const studentEmailSchema = z.string().trim().email("Please use your USA email")
  .refine((val) => val.toLowerCase().endsWith("@usa.edu.ph"), "Student email must end with @usa.edu.ph");

export const universityEmailSchema = z.string().trim().email("Please use your USA email")
  .refine((val) => val.toLowerCase().endsWith(".edu.ph"), "Must be a university email");

export const registerBaseSchema = z.object({
  email: universityEmailSchema,
  full_name: z.string().min(3, "Full name is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirm_password: z.string(),
  account_type: z.enum(["student", "facilitator", "admin"]),
});

export const studentRegisterSchema = registerBaseSchema.extend({
  email: studentEmailSchema,
  account_type: z.literal("student"),
  student_id_number: z.string().min(5, "ID is required"), // e.g., USA-2026-0001
  section: z.string().min(1, "Section is required"),
  current_year: z.string().min(1, "Year is required"),
}).refine((d) => d.password === d.confirm_password, {
  message: "Passwords do not match",
  path: ["confirm_password"],
});

export const facilitatorRegisterSchema = registerBaseSchema.extend({
  account_type: z.literal("facilitator"),
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

export const manualAttendanceSchema = z.object({
  student_id: z.string().uuid("Invalid student"),
  event_id: z.string().uuid("Invalid event"),
  status: z.enum(["present", "late", "absent", "incomplete"]),
  time_in: z.string().datetime().nullish(),
  time_out: z.string().datetime().nullish(),
  remarks: z.string().trim().max(500, "Remarks are too long").optional(),
});

export const productDraftSchema = z.object({
  name: z.string().trim().min(1, "Product name is required").max(200, "Product name is too long"),
  category: z.enum(["apparel", "accessories"]),
  pricePlaceholder: z.string().trim().max(50, "Price is too long"),
  description: z.string().trim().max(2000, "Description is too long"),
  status: z.enum(["Showcase Only", "Coming Soon"]),
  material: z.string().trim().max(200, "Material is too long"),
  sizes: z.array(z.string().trim().min(1)).max(20, "Too many sizes"),
  colors: z.array(z.string().trim().min(1)).max(20, "Too many colors"),
  features: z.array(z.string().trim().min(1)).max(20, "Too many features"),
  images: z.array(z.string().trim().min(1)).max(10, "Too many images"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type StudentRegisterInput = z.infer<typeof studentRegisterSchema>;
export type FacilitatorRegisterInput = z.infer<typeof facilitatorRegisterSchema>;
export type AdminRegisterInput = z.infer<typeof adminRegisterSchema>;
export type QRSessionInput = z.infer<typeof qrSessionSchema>;
export type ManualAttendanceInput = z.infer<typeof manualAttendanceSchema>;
