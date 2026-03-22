import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const cookieStore = cookies();
  const token = cookieStore.get("pharmatrack_token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [{ data: profile }, { data: studentProfile }] = await Promise.all([
    supabase.from("users").select("*").eq("id", user.id).single(),
    supabase.from("student_profiles").select("*").eq("user_id", user.id).single(),
  ]);

  // Attendance summary
  const { data: records } = await supabase
    .from("attendance_records")
    .select("*")
    .eq("student_id", user.id)
    .order("date", { ascending: false });

  const summary = {
    total: records?.length ?? 0,
    present: records?.filter((r) => r.status === "present").length ?? 0,
    absent: records?.filter((r) => r.status === "absent").length ?? 0,
    late: records?.filter((r) => r.status === "late").length ?? 0,
  };

  return NextResponse.json({ profile, studentProfile, records, summary });
}

export async function PATCH(req: NextRequest) {
  const cookieStore = cookies();
  const token = cookieStore.get("pharmatrack_token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { full_name } = body;

  const { error } = await supabase.from("users").update({ full_name }).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
