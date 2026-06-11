export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const getServiceClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) throw new Error("Supabase credentials missing");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
};

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { userId, email, full_name, account_type, student_profile } = body;

  if (!userId || !email || !full_name || !account_type) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!["student", "facilitator"].includes(account_type)) {
    return NextResponse.json({ error: "Invalid account type" }, { status: 400 });
  }

  const supabase = getServiceClient();

  // Verify the auth user actually exists (prevents spoofed userId attacks)
  const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById(userId);
  if (authErr || !authUser?.user) {
    return NextResponse.json({ error: "Auth user not found" }, { status: 403 });
  }

  // Insert into public.users (service role bypasses RLS)
  const { error: userErr } = await supabase.from("users").insert({
    id: userId,
    email,
    full_name,
    account_type,
    status: "pending",
  });
  if (userErr) {
    // Ignore duplicate — user record may already exist from a retry
    if (!userErr.message.includes("duplicate") && !userErr.code?.includes("23505")) {
      return NextResponse.json({ error: userErr.message }, { status: 500 });
    }
  }

  // Insert role-specific profile
  if (account_type === "student") {
    const { student_id_number, section, current_year } = student_profile ?? {};
    if (!student_id_number || !section || !current_year) {
      return NextResponse.json({ error: "Missing student profile fields" }, { status: 400 });
    }

    // Generate a QR code ID for the student
    const qrCodeId = `QR-${userId.slice(0, 8).toUpperCase()}`;

    const { error: profileErr } = await supabase.from("student_profiles").upsert({
      user_id: userId,
      student_id_number,
      section,
      current_year,
      qr_code_id: qrCodeId,
    }, { onConflict: "user_id" });
    if (profileErr) {
      return NextResponse.json({ error: profileErr.message }, { status: 500 });
    }
  } else {
    const { error: profileErr } = await supabase.from("facilitator_profiles").upsert({
      user_id: userId,
      department: "Pharmacy",
    }, { onConflict: "user_id" });
    if (profileErr) {
      return NextResponse.json({ error: profileErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
