import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { PharmaUser } from "./schema";

const getServiceClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

export async function getBackendUser(req?: NextRequest) {
  let token: string | undefined;

  // 1. Try Authorization header
  if (req) {
    const authHeader = req.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }
  }

  // 2. Try cookie
  if (!token) {
    try {
      const cookieStore = cookies();
      token = cookieStore.get("pharmatrack_token")?.value;
    } catch {
      // cookies() throws when called outside dynamic server request contexts
    }
  }

  if (token) {
    const { data: { user }, error } = await getServiceClient().auth.getUser(token);
    if (!error && user) return user;
  }

  // 3. Fallback: Try standard Supabase SSR cookies client
  try {
    const { createClient } = await import("./server");
    const serverClient = await createClient();
    const { data: { user }, error } = await serverClient.auth.getUser();
    if (!error && user) return user;
  } catch {
    // Ignore errors if context is not server-request-compatible
  }

  return null;
}

export async function getSession() {
  return getBackendUser();
}

export async function getUserProfile(userId: string): Promise<PharmaUser | null> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) return null;
  return data as PharmaUser;
}

export async function getStudentProfile(userId: string) {
  const { data, error } = await supabase
    .from("student_profiles")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (error) return null;
  return data;
}

export async function requireAuth(accountType?: "student" | "facilitator" | "admin") {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const profile = await getUserProfile(session.id);
  if (!profile || profile.status !== "approved") {
    throw new Error("Forbidden");
  }

  if (accountType && profile.account_type !== accountType) {
    throw new Error("Forbidden");
  }
  return session;
}

