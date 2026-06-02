export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { UpdateProfileSchema } from "@/lib/schema";
import { getBackendUser } from "@/lib/auth";

const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("Supabase credentials missing");
  return createClient(url, key);
};

export async function GET(req: NextRequest) {
  console.log("[Student Profile API] GET request received");
  const supabase = getSupabase();

  const user = await getBackendUser(req);
  if (!user) {
    console.warn("[Student Profile API] Unauthorized GET request - no valid session");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log(`[Student Profile API] Fetching profile data for user ${user.id} (${user.email})`);

  const [profileResult, studentProfileResult] = await Promise.all([
    supabase.from("users").select("*").eq("id", user.id).single(),
    supabase.from("student_profiles").select("*").eq("user_id", user.id).single(),
  ]);

  if (profileResult.error) {
    console.error(`[Student Profile API] Error fetching users profile for ${user.id}:`, profileResult.error);
    return NextResponse.json({ error: "Profile not found or fetch error" }, { status: 404 });
  }

  // Attendance summary
  const { data: records, error: recordsError } = await supabase
    .from("attendance_records")
    .select("*")
    .eq("student_id", user.id)
    .order("created_at", { ascending: false });

  if (recordsError) {
    console.error(`[Student Profile API] Error fetching attendance records for student ${user.id}:`, recordsError);
  }

  const summary = {
    total: records?.length ?? 0,
    present: records?.filter((r) => r.status === "present").length ?? 0,
    absent: records?.filter((r) => r.status === "absent").length ?? 0,
    late: records?.filter((r) => r.status === "late").length ?? 0,
  };

  console.log(`[Student Profile API] Successfully loaded profile & summary for student ${user.id}`);

  return NextResponse.json({ 
    profile: profileResult.data, 
    studentProfile: studentProfileResult.data || null, 
    records: records || [], 
    summary 
  });
}

export async function PATCH(req: NextRequest) {
  console.log("[Student Profile API] PATCH request received");
  const supabase = getSupabase();

  const user = await getBackendUser(req);
  if (!user) {
    console.warn("[Student Profile API] Unauthorized PATCH request - no valid session");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const validatedData = UpdateProfileSchema.parse(body);

    console.log(`[Student Profile API] Updating full_name for user ${user.id} to "${validatedData.full_name}"`);

    const { error } = await supabase.from("users").update({ full_name: validatedData.full_name }).eq("id", user.id);
    if (error) {
      console.error(`[Student Profile API] Database update error for user ${user.id}:`, error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.log(`[Student Profile API] Profile successfully updated for user ${user.id}`);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err.name === "ZodError") {
      console.warn(`[Student Profile API] Validation failed for PATCH by user ${user.id}:`, err.errors);
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    console.error(`[Student Profile API] Error processing PATCH for user ${user.id}:`, err);
    return NextResponse.json({ error: "Invalid JSON Payload" }, { status: 400 });
  }
}

