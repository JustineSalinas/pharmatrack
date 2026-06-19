"use client";
import { supabase } from "./supabase";
import type { AccountType } from "./schema";
import type { LoginInput, StudentRegisterInput, FacilitatorRegisterInput } from "./validations";

export async function loginUser({ email, password }: LoginInput) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data;
}
/**
 * Returns auth user info including email_confirmed_at for verification checks.
 */
export async function getAuthUser() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session || !session.user) {
    // Fallback to getUser() in case session is refreshing or needs validation
    const { data: { user } } = await supabase.auth.getUser();
    return user || null;
  }
  return session.user;
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
    if (authError.message.toLowerCase().includes("rate limit")) {
      throw new Error("Too many sign-up attempts right now. Please wait a few minutes and try again.");
    }
    throw new Error(authError.message);
  }
  if (!authData.user) throw new Error("Registration failed");

  // Supabase email-enumeration protection returns a "successful" signUp with a
  // phantom user id and an empty identities array when the email already exists.
  // Detect it here so we show a clear message instead of a foreign-key error.
  if (authData.user.identities && authData.user.identities.length === 0) {
    throw new Error("This email is already registered. Please log in instead, or use a different email.");
  }

  const userId = authData.user.id;

  // Create user + student profile via server route (bypasses RLS — no session yet before email confirmation)
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      email: input.email,
      full_name: input.full_name,
      account_type: "student",
      student_profile: {
        student_id_number: input.student_id_number,
        section: input.section,
        current_year: input.current_year,
      },
    }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? "Failed to create user profile");
  }

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

  if (authError) {
    if (authError.message.toLowerCase().includes("user already registered")) {
      throw new Error("This email is already registered. Please try logging in instead.");
    }
    if (authError.message.toLowerCase().includes("rate limit")) {
      throw new Error("Too many sign-up attempts right now. Please wait a few minutes and try again.");
    }
    throw new Error(authError.message);
  }
  if (!authData.user) throw new Error("Registration failed");

  // Supabase email-enumeration protection returns a "successful" signUp with a
  // phantom user id and an empty identities array when the email already exists.
  if (authData.user.identities && authData.user.identities.length === 0) {
    throw new Error("This email is already registered. Please log in instead, or use a different email.");
  }

  const userId = authData.user.id;

  // Create user + facilitator profile via server route (bypasses RLS — no session yet before email confirmation)
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      email: input.email,
      full_name: input.full_name,
      account_type: "facilitator",
    }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? "Failed to create user profile");
  }

  return authData;
}

export async function completeOnboarding(
  userId: string,
  email: string,
  fullName: string,
  role: "student" | "facilitator",
  studentData?: { studentId: string, section: string, year: string }
) {
  const body: Record<string, unknown> = {
    userId,
    email,
    full_name: fullName,
    account_type: role,
  };

  if (role === "student" && studentData) {
    body.student_profile = {
      student_id_number: studentData.studentId,
      section: studentData.section,
      current_year: studentData.year,
    };
  }

  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? "Failed to complete profile setup");
  }
}

export async function logoutUser() {
  await supabase.auth.signOut();
}

/**
 * Sends a password-reset email. The link returns the user to /reset-password
 * with a short-lived recovery session, where they can set a new password.
 */
export async function sendPasswordReset(email: string) {
  const redirectTo = `${window.location.origin}/reset-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw new Error(error.message);
}

/**
 * Updates the signed-in (or recovery-session) user's password.
 * Used by both the in-app "Change Password" settings and the reset flow.
 */
export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}

export async function getCurrentUser() {
  // getUser() validates the JWT with Supabase Auth server — more reliable than getSession()
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
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
      .maybeSingle();
    return { ...profile, student_profiles: studentProfile || null };
  }

  if (profile.account_type === "facilitator") {
    const { data: facilitatorProfile } = await supabase
      .from("facilitator_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
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
