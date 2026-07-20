import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getBackendUser } from "@/lib/auth";
import { editAttendanceSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

const getAdminClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await getBackendUser(req);
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = getAdminClient();

    const { data: callerProfile, error: profileErr } = await adminClient
      .from("users")
      .select("account_type, status")
      .eq("id", caller.id)
      .single();

    if (profileErr || !callerProfile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (callerProfile.account_type !== "admin" || callerProfile.status !== "approved") {
      return NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = editAttendanceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const { status, time_in, time_out, remarks } = parsed.data;

    const { id } = await params;

    const { data: record, error: updateErr } = await adminClient
      .from("attendance_records")
      .update({
        status,
        time_in: time_in ?? null,
        time_out: time_out ?? null,
        remarks: remarks?.trim() ?? null,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateErr) {
      console.error("[Edit Attendance API] Update error:", updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    return NextResponse.json({ record }, { status: 200 });
  } catch (err: any) {
    console.error("[Edit Attendance API] Internal server error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
