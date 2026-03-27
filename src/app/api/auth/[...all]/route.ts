export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("Supabase credentials missing");
  return createClient(url, key);
};

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  const body = await req.json();
  const { action } = body;

  if (action === "login") {
    const { email, password } = body;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return NextResponse.json({ error: error.message }, { status: 401 });

    // Fetch user profile
    const { data: profile } = await supabase.from("users").select("*").eq("id", data.user.id).single();

    const res = NextResponse.json({ user: data.user, profile });
    res.cookies.set("pharmatrack_token", data.session?.access_token ?? "", {
      httpOnly: true, secure: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  }

  if (action === "logout") {
    const res = NextResponse.json({ ok: true });
    res.cookies.delete("pharmatrack_token");
    return res;
  }

  if (action === "register") {
    const { email, password, full_name, account_type, student_id_number, section, current_year } = body;

    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name, account_type },
    });
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 });

    const userId = authData.user.id;

    const { error: userInsertErr } = await supabase.from("users").insert({ id: userId, email, full_name, account_type });
    if (userInsertErr) {
      await supabase.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: userInsertErr.message }, { status: 500 });
    }

    if (account_type === "student") {
      const qr_code_id = `QR-${crypto.randomUUID().replace(/-/g, "").substring(0, 8).toUpperCase()}`;
      const { error: profileErr } = await supabase.from("student_profiles").insert({
        user_id: userId, student_id_number, section, current_year, qr_code_id,
      });
      if (profileErr) {
        await supabase.auth.admin.deleteUser(userId);
        return NextResponse.json({ error: profileErr.message }, { status: 500 });
      }
    } else if (account_type === "faculty") {
      const { error: profileErr } = await supabase.from("faculty_profiles").insert({ user_id: userId, department: "Pharmacy" });
      if (profileErr) {
        await supabase.auth.admin.deleteUser(userId);
        return NextResponse.json({ error: profileErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, userId });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
