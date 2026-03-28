export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { UpdateProfileSchema } from "@/lib/schema";

const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("Supabase credentials missing");
  return createClient(url, key);
};

export async function GET(req: NextRequest) {
  const supabase = getSupabase();
  const cookieStore = cookies();
  const token = cookieStore.get("pharmatrack_token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [profileResult, studentProfileResult] = await Promise.all([
    supabase.from("users").select("*").eq("id", user.id).single(),
    supabase.from("student_profiles").select("*").eq("user_id", user.id).single(),
  ]);

  if (profileResult.error) {
    return NextResponse.json({ error: "Profile not found or fetch error" }, { status: 404 });
  }

  // Attendance summary
  const { data: records, error: recordsError } = await supabase
    .from("attendance_records")
    .select("*")
    .eq("student_id", user.id)
    .order("created_at", { ascending: false });

  if (recordsError) {
    console.error("Attendance fetch error:", recordsError);
  }

  const summary = {
    total: records?.length ?? 0,
    present: records?.filter((r) => r.status === "present").length ?? 0,
    absent: records?.filter((r) => r.status === "absent").length ?? 0,
    late: records?.filter((r) => r.status === "late").length ?? 0,
  };

  return NextResponse.json({ 
    profile: profileResult.data, 
    studentProfile: studentProfileResult.data || null, 
    records: records || [], 
    summary 
  });
}

export async function PATCH(req: NextRequest) {
  const supabase = getSupabase();
  const cookieStore = cookies();
  const token = cookieStore.get("pharmatrack_token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const validatedData = UpdateProfileSchema.parse(body);

    const { error } = await supabase.from("users").update({ full_name: validatedData.full_name }).eq("id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid JSON Payload" }, { status: 400 });
  }
}
