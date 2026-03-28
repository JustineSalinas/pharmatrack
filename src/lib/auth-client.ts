"use client";
import { supabase } from "./supabase";
import type { LoginInput, StudentRegisterInput, AdminRegisterInput } from "./validations";

export async function loginUser({ email, password }: LoginInput) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data;
}

export async function registerStudent(input: StudentRegisterInput) {
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
  });
  if (authError) {
    if (authError.message.toLowerCase().includes("user already registered")) {
      throw new Error("This email is already registered. Please try logging in instead.");
    }
    throw new Error(authError.message);
  }
  if (!authData.user) throw new Error("Registration failed");


  const userId = authData.user.id;
  
  // 1. Create User Record
  const { error: userErr } = await supabase.from("users").insert({
    id: userId,
    email: input.email,
    full_name: input.full_name,
    account_type: "student",
    status: "approved",
  });
  if (userErr) throw new Error(userErr.message);

  // 2. Create Student Profile
  await ensureStudentProfile(userId, {
    student_id_number: input.student_id_number,
    section: input.section,
    current_year: input.current_year
  });

  return authData;
}

/**
 * Ensures a student has a profile record. Creates one if it doesn't exist.
 */
export async function ensureStudentProfile(userId: string, data: { student_id_number: string, section: string, current_year: string }) {
  const qrCodeId = `QR-${crypto.randomUUID().replace(/-/g, "").substring(0, 8).toUpperCase()}`;
  
  const { error } = await supabase.from("student_profiles").upsert({
    user_id: userId,
    student_id_number: data.student_id_number,
    section: data.section,
    current_year: data.current_year,
    qr_code_id: qrCodeId,
  }, { onConflict: "user_id" });

  if (error) throw new Error("Failed to ensure student profile: " + error.message);
  return qrCodeId;
}

export async function registerAdmin(input: AdminRegisterInput) {
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
  });
  if (authError || !authData.user) throw new Error(authError?.message ?? "Registration failed");

  const { error } = await supabase.from("users").insert({
    id: authData.user.id,
    email: input.email,
    full_name: input.full_name,
    account_type: "admin",
    status: "pending", // Admins require manual approval
  });
  if (error) throw new Error(error.message);

  return authData;
}

export async function logoutUser() {
  await supabase.auth.signOut();
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  const { data: profile, error } = await supabase
    .from("users")
    .select("*, student_profiles(*)")
    .eq("id", user.id)
    .single();
    
  if (error) return null;
  return profile;
}
