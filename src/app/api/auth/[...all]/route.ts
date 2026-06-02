export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { loginSchema, studentRegisterSchema, facilitatorRegisterSchema } from "@/lib/validations";

const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("Supabase credentials missing");
  return createClient(url, key);
};

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  let body: any;
  try {
    body = await req.json();
  } catch (e) {
    console.error("[Auth API] Failed to parse JSON request body");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action } = body;
  console.log(`[Auth API] Action requested: "${action}"`);

  if (action === "login") {
    const { email, password } = body;
    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) {
      console.warn("[Auth API] Login validation failed:", validation.error.errors[0].message);
      return NextResponse.json({ error: validation.error.errors[0].message }, { status: 400 });
    }

    console.log(`[Auth API] Attempting user sign-in for email: ${email}`);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.warn(`[Auth API] Sign-in failed for ${email}: ${error.message}`);
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    // Fetch user profile
    const { data: profile, error: profileErr } = await supabase.from("users").select("*").eq("id", data.user.id).single();
    if (profileErr) {
      console.error(`[Auth API] Profile not found in database for authenticated user ${data.user.id}:`, profileErr);
    }

    console.log(`[Auth API] Login successful for user ${email} (${profile?.account_type || "no profile"})`);

    const res = NextResponse.json({ user: data.user, profile, session: data.session });
    res.cookies.set("pharmatrack_token", data.session?.access_token ?? "", {
      httpOnly: true, secure: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  }

  if (action === "logout") {
    console.log("[Auth API] Logging out user and clearing cookies");
    const res = NextResponse.json({ ok: true });
    res.cookies.delete("pharmatrack_token");
    return res;
  }

  if (action === "register") {
    const { email, password, full_name, account_type, student_id_number, section, current_year } = body;
    console.log(`[Auth API] Registration requested for target ${email} as ${account_type}`);

    // Validate using appropriate schemas
    if (account_type === "student") {
      const validation = studentRegisterSchema.safeParse(body);
      if (!validation.success) {
        console.warn("[Auth API] Student registration validation failed:", validation.error.errors[0].message);
        return NextResponse.json({ error: validation.error.errors[0].message }, { status: 400 });
      }
    } else if (account_type === "facilitator") {
      const validation = facilitatorRegisterSchema.safeParse(body);
      if (!validation.success) {
        console.warn("[Auth API] Facilitator registration validation failed:", validation.error.errors[0].message);
        return NextResponse.json({ error: validation.error.errors[0].message }, { status: 400 });
      }
    } else {
      console.warn(`[Auth API] Registration rejected: invalid account type "${account_type}"`);
      return NextResponse.json({ error: "Invalid registration role" }, { status: 400 });
    }

    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name, account_type },
    });
    if (authErr) {
      console.error(`[Auth API] Admin user creation failed for ${email}:`, authErr.message);
      return NextResponse.json({ error: authErr.message }, { status: 400 });
    }

    const userId = authData.user.id;
    const status = account_type === "student" ? "approved" : "pending";
    console.log(`[Auth API] Auth user successfully created: id=${userId}, initial status=${status}`);

    const { error: userInsertErr } = await supabase.from("users").insert({
      id: userId,
      email,
      full_name,
      account_type,
      status
    });

    if (userInsertErr) {
      console.error(`[Auth API] Database user profile insert failed for ${userId}, deleting auth user:`, userInsertErr.message);
      await supabase.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: userInsertErr.message }, { status: 500 });
    }

    if (account_type === "student") {
      const qr_code_id = `QR-${crypto.randomUUID().replace(/-/g, "").substring(0, 8).toUpperCase()}`;
      const { error: profileErr } = await supabase.from("student_profiles").insert({
        user_id: userId, student_id_number, section, current_year, qr_code_id,
      });
      if (profileErr) {
        console.error(`[Auth API] Student profile database insert failed for ${userId}, cleaning up user:`, profileErr.message);
        await supabase.auth.admin.deleteUser(userId);
        return NextResponse.json({ error: profileErr.message }, { status: 500 });
      }
      console.log(`[Auth API] Student registration complete for user ${userId} with QR code ID ${qr_code_id}`);
    } else if (account_type === "facilitator") {
      const { error: profileErr } = await supabase.from("facilitator_profiles").insert({ user_id: userId, department: "Pharmacy" });
      if (profileErr) {
        console.error(`[Auth API] Facilitator profile database insert failed for ${userId}, cleaning up user:`, profileErr.message);
        await supabase.auth.admin.deleteUser(userId);
        return NextResponse.json({ error: profileErr.message }, { status: 500 });
      }
      console.log(`[Auth API] Facilitator registration complete for user ${userId}`);
    }

    return NextResponse.json({ ok: true, userId });
  }

  console.warn(`[Auth API] Unknown action requested: "${action}"`);
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

