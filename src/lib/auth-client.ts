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
  if (authError || !authData.user) throw new Error(authError?.message ?? "Registration failed");

  const userId = authData.user.id;
  const qrCodeId = `QR-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

  const { error: userErr } = await supabase.from("users").insert({
    id: userId,
    email: input.email,
    full_name: input.full_name,
    account_type: "student",
    status: "approved",
  });
  if (userErr) throw new Error(userErr.message);

  const { error: profileErr } = await supabase.from("student_profiles").insert({
    user_id: userId,
    student_id_number: input.student_id_number,
    section: input.section,
    current_year: input.current_year,
    qr_code_id: qrCodeId,
  });
  if (profileErr) throw new Error(profileErr.message);

  return authData;
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
  const { data: profile } = await supabase.from("users").select("*").eq("id", user.id).single();
  return profile;
}
