export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS for profile inserts
const getServiceClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) throw new Error("Supabase credentials missing");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
};

// Anon-key client — used for signUp() so the confirmation email is sent
// correctly. Running this server-side means GoTrue rate-limits by the
// Vercel server IP instead of each student's shared campus WiFi IP.
const getAnonClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
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

  const { email, password, full_name, account_type, student_profile } = body;
  let { userId } = body;

  if (!email || !full_name || !account_type) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!["student", "facilitator"].includes(account_type)) {
    return NextResponse.json({ error: "Invalid account type" }, { status: 400 });
  }

  const supabase = getServiceClient();

  // ── Step 1: Create auth user (only when registering with a password) ──────
  // signUp() runs server-side so GoTrue sees the Vercel IP, not the student's
  // campus WiFi IP — bypasses the per-IP signup rate limit entirely.
  if (password && !userId) {
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
    const anonClient = getAnonClient();

    const { data: authData, error: authErr } = await anonClient.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
        data: { full_name, account_type },
      },
    });

    if (authErr) {
      const msg = authErr.message.toLowerCase();
      if (msg.includes("rate limit")) {
        return NextResponse.json(
          { error: "Too many sign-up attempts right now. Please wait a few minutes and try again." },
          { status: 429 }
        );
      }
      return NextResponse.json({ error: authErr.message }, { status: 400 });
    }

    if (!authData.user) {
      return NextResponse.json({ error: "Registration failed" }, { status: 500 });
    }

    // Supabase returns a phantom user with empty identities when the email
    // already exists (email-enumeration protection).
    if (authData.user.identities?.length === 0) {
      return NextResponse.json(
        { error: "This email is already registered. Please log in instead, or use a different email." },
        { status: 409 }
      );
    }

    userId = authData.user.id;
  }

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  // ── Step 2: Insert into public.users ──────────────────────────────────────
  const { error: userErr } = await supabase.from("users").insert({
    id: userId,
    email,
    full_name,
    account_type,
    status: "pending",
  });

  if (userErr) {
    if (userErr.code === "23503") {
      return NextResponse.json(
        { error: "This email is already registered. Please log in instead, or use a different email." },
        { status: 409 }
      );
    }
    if (!userErr.message.includes("duplicate") && !userErr.code?.includes("23505")) {
      // Clean up the auth user we just created so the student can retry
      if (password) await supabase.auth.admin.deleteUser(userId).catch(() => {});
      return NextResponse.json({ error: userErr.message }, { status: 500 });
    }
  }

  // ── Step 3: Insert role-specific profile ──────────────────────────────────
  if (account_type === "student") {
    const { student_id_number, section, current_year } = student_profile ?? {};
    if (!student_id_number || !section || !current_year) {
      return NextResponse.json({ error: "Missing student profile fields" }, { status: 400 });
    }

    const qrCodeId = `QR-${crypto.randomUUID().replace(/-/g, "").substring(0, 8).toUpperCase()}`;

    const { error: profileErr } = await supabase.from("student_profiles").upsert(
      { user_id: userId, student_id_number, section, current_year, qr_code_id: qrCodeId },
      { onConflict: "user_id" }
    );
    if (profileErr) {
      if (password) await supabase.auth.admin.deleteUser(userId).catch(() => {});
      return NextResponse.json({ error: profileErr.message }, { status: 500 });
    }
  } else {
    const { error: profileErr } = await supabase.from("facilitator_profiles").upsert(
      { user_id: userId, department: "Pharmacy" },
      { onConflict: "user_id" }
    );
    if (profileErr) {
      if (password) await supabase.auth.admin.deleteUser(userId).catch(() => {});
      return NextResponse.json({ error: profileErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, userId });
}
