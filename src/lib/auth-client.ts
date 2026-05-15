"use client";
import { supabase } from "./supabase";
import type { AccountType } from "./schema";
import type { LoginInput, StudentRegisterInput, FacilitatorRegisterInput } from "./validations";

export async function loginUser({ email, password }: LoginInput) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data;
}

export async function signInWithGoogle() {
  const redirectTo = `${window.location.origin}/auth/callback`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
    },
  });
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Returns auth user info including email_confirmed_at for verification checks.
 */
export async function getAuthUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function registerStudent(input: StudentRegisterInput) {
  const redirectTo = `${window.location.origin}/auth/callback`;

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: redirectTo,
      data: {
        full_name: input.full_name,
        account_type: "student",
      },
    },
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
    account_type: "student" as AccountType,
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
  // Check if profile exists first to preserve existing QR code if any
  const { data: existing } = await supabase
    .from("student_profiles")
    .select("qr_code_id")
    .eq("user_id", userId)
    .single();

  const qrCodeId = (existing as any)?.qr_code_id || `QR-${crypto.randomUUID().replace(/-/g, "").substring(0, 8).toUpperCase()}`;

  // Note: This requires a UNIQUE constraint on user_id in the student_profiles table.
  // Run: ALTER TABLE public.student_profiles ADD CONSTRAINT student_profiles_user_id_key UNIQUE (user_id);
  const { error } = await supabase.from("student_profiles").upsert({
    user_id: userId,
    student_id_number: data.student_id_number,
    section: data.section,
    current_year: data.current_year,
    qr_code_id: qrCodeId,
  }, { onConflict: "user_id" });

  if (error) {
    console.error("Profile Upsert Error:", error);
    throw new Error("Failed to ensure student profile: " + error.message);
  }
  return qrCodeId;
}

export async function registerFacilitator(input: FacilitatorRegisterInput) {
  const redirectTo = `${window.location.origin}/auth/callback`;

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: redirectTo,
      data: {
        full_name: input.full_name,
        account_type: "facilitator",
      },
    },
  });

  if (authError || !authData.user) throw new Error(authError?.message ?? "Registration failed");

  const userId = authData.user.id;

  // 1. Create User Record (Pending approval)
  const { error: userErr } = await supabase.from("users").insert({
    id: userId,
    email: input.email,
    full_name: input.full_name,
    account_type: "facilitator" as AccountType,
    status: "pending",
  });
  if (userErr) throw new Error(userErr.message);

  // 2. Create Facilitator Profile
  const { error: profileErr } = await supabase.from("facilitator_profiles").insert({
    user_id: userId,
    department: "Pharmacy" // Default or allow input
  });
  if (profileErr) throw new Error(profileErr.message);

  return authData;
}

export async function completeOnboarding(
  userId: string, 
  email: string, 
  fullName: string, 
  role: "student" | "facilitator",
  studentData?: { studentId: string, section: string, year: string }
) {
  // 1. Create User Record
  const status = role === "student" ? "approved" : "pending";
  const { error: userErr } = await supabase.from("users").insert({
    id: userId,
    email: email,
    full_name: fullName,
    account_type: role as AccountType,
    status: status,
  });
  if (userErr) throw new Error("Failed to create user record: " + userErr.message);

  // 2. Create Role Profile
  if (role === "student" && studentData) {
    await ensureStudentProfile(userId, {
      student_id_number: studentData.studentId,
      section: studentData.section,
      current_year: studentData.year
    });
  } else if (role === "facilitator") {
    const { error: profileErr } = await supabase.from("facilitator_profiles").insert({
      user_id: userId,
      department: "Pharmacy"
    });
    if (profileErr) throw new Error("Failed to create facilitator profile: " + profileErr.message);
  }
}

export async function logoutUser() {
  await supabase.auth.signOut();
}

export async function getCurrentUser() {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError) {
    console.error("Auth error fetching user:", authError.message);
    return null;
  }
  
  if (!user) {
    console.log("No authenticated user session found.");
    return null;
  }

  // Fetch base user profile first
  const { data: profile, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("Profile fetch error for user", user.id, ":", error.message);
    return null;
  }

  // Fetch related profiles separately to avoid FK relationship issues
  if (profile.account_type === "student") {
    const { data: studentProfile } = await supabase
      .from("student_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();
    return { ...profile, student_profiles: studentProfile || null };
  }

  if (profile.account_type === "facilitator") {
    const { data: facilitatorProfile } = await supabase
      .from("facilitator_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();
    return { ...profile, facilitator_profiles: facilitatorProfile || null };
  }

  return profile;
}

/**
 * Resend verification email to the current user.
 */
export async function resendVerificationEmail(email: string) {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) throw new Error(error.message);
}
