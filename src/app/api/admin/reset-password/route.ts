import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  // Uses the service role key — server-side only, never exposed to the client
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"
  );
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const { data, error } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email,
    });

    if (error) throw error;

    // In production you'd send this via email — here we return the link
    // so the admin can share it manually or it can be emailed via Supabase's
    // built-in email (depending on your SMTP config).
    return NextResponse.json({
      success: true,
      message: `Password reset link generated for ${email}`,
      link: data?.properties?.action_link ?? null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
