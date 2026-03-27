import { cookies } from "next/headers";
import { supabase } from "./supabase";
import type { User } from "./schema";

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("pharmatrack_token")?.value;
  if (!token) return null;

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export async function getUserProfile(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) return null;
  return data;
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

export async function requireAuth(accountType?: "student" | "faculty" | "admin") {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  if (accountType) {
    const profile = await getUserProfile(session.id);
    if (!profile || profile.account_type !== accountType) {
      throw new Error("Forbidden");
    }
  }
  return session;
}
