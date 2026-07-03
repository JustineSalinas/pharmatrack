import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getBackendUser } from "@/lib/auth";
import { getSystemConfigServer } from "@/lib/systemConfig";
import { sendAbsenceNotifications } from "@/lib/email";

export const dynamic = "force-dynamic";

const getAdminClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
};

// Formats a YYYY-MM-DD date column as a display string without crossing a
// UTC boundary — mirrors parseDateLocal/formatDateLocal in src/lib/supabase.ts,
// reimplemented here so this server route doesn't import the browser client.
function formatEventDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export async function POST(req: NextRequest) {
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

    if (
      !["admin", "facilitator"].includes(callerProfile.account_type) ||
      callerProfile.status !== "approved"
    ) {
      return NextResponse.json({ error: "Forbidden: Council only" }, { status: 403 });
    }

    const { entries } = await req.json();
    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ success: true, sent: 0 });
    }

    const config = await getSystemConfigServer(adminClient);
    if (config.absenceNotifications !== "true") {
      return NextResponse.json({ success: true, sent: 0, skipped: "absence notifications disabled" });
    }

    const studentIds = Array.from(new Set(entries.map((e: any) => e.studentId).filter(Boolean)));
    const eventIds = Array.from(new Set(entries.map((e: any) => e.eventId).filter(Boolean)));

    const [{ data: students }, { data: events }] = await Promise.all([
      adminClient.from("users").select("id, email, full_name").in("id", studentIds),
      adminClient.from("events").select("id, name, date").in("id", eventIds),
    ]);

    const studentMap = new Map((students ?? []).map((s: any) => [s.id, s]));
    const eventMap = new Map((events ?? []).map((e: any) => [e.id, e]));

    const notifications = entries
      .map((e: any) => {
        const student = studentMap.get(e.studentId);
        const event = eventMap.get(e.eventId);
        if (!student?.email || !event?.name || !event?.date) return null;
        return {
          studentName: student.full_name ?? "Student",
          studentEmail: student.email as string,
          eventName: event.name as string,
          eventDateDisplay: formatEventDate(event.date),
        };
      })
      .filter((n: any): n is NonNullable<typeof n> => n !== null);

    await sendAbsenceNotifications(notifications);

    return NextResponse.json({ success: true, sent: notifications.length });
  } catch (err: any) {
    console.error("[Notify Absences API] Internal server error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
