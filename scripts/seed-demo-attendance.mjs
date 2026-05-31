/**
 * Seeds realistic attendance data for the demo student so the dashboards show
 * populated states during development. Idempotent-ish: clears the demo
 * student's previous demo events/records first.
 *
 *   Run:  node scripts/seed-demo-attendance.mjs
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) throw new Error("Missing Supabase env vars");
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

async function findUserId(email) {
  const { data } = await sb.from("users").select("id").eq("email", email).maybeSingle();
  return data?.id || null;
}

const EVENTS = [
  { name: "Pharmacology Lecture", location: "Room PH-201", daysAgo: 1, status: "present" },
  { name: "Pharmaceutical Chemistry Lab", location: "Lab PH-Chem", daysAgo: 3, status: "present" },
  { name: "Clinical Pharmacy Seminar", location: "Auditorium A", daysAgo: 5, status: "late" },
  { name: "Pharmacognosy Lecture", location: "Room PH-105", daysAgo: 8, status: "present" },
  { name: "Dispensing Practicum", location: "Mock Pharmacy", daysAgo: 10, status: "present" },
  { name: "Department Assembly", location: "Gymnasium", daysAgo: 12, status: "absent" },
  { name: "Pharmacology Lecture", location: "Room PH-201", daysAgo: 15, status: "present" },
  { name: "Biochemistry Lab", location: "Lab PH-Bio", daysAgo: 17, status: "present" },
  { name: "Pharmaceutics Workshop", location: "Room PH-301", daysAgo: 20, status: "late" },
  { name: "Research Colloquium", location: "Conference Hall", daysAgo: 23, status: "present" },
  { name: "Pharmacology Lecture", location: "Room PH-201", daysAgo: 26, status: "present" },
  { name: "Drug Information Session", location: "Library AVR", daysAgo: 29, status: "present" },
];

function iso(daysAgo, h, m) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}
function dateOnly(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
}

async function main() {
  const studentId = await findUserId("student.demo@usa.edu.ph");
  const adminId = await findUserId("admin.demo@usa.edu.ph");
  if (!studentId) throw new Error("Demo student not found — run seed-test-accounts.mjs first");
  const creator = adminId || studentId;

  // Clean prior demo data for this student
  await sb.from("attendance_records").delete().eq("student_id", studentId);

  // Upcoming event (for the dashboard "Up Next" card)
  const upcoming = {
    name: "Pharmacy Recognition Day",
    description: "Annual recognition ceremony for the Pharmacy Department.",
    location: "USA Main Auditorium",
    date: dateOnly(-3), // 3 days in the future
    check_in_start: iso(-3, 8, 0),
    check_in_late: iso(-3, 8, 30),
    check_in_end: iso(-3, 10, 0),
    created_by: creator,
  };

  let present = 0, late = 0, absent = 0;
  for (const ev of EVENTS) {
    const { data: eventRow, error: evErr } = await sb
      .from("events")
      .insert({
        name: ev.name,
        description: `${ev.name} session.`,
        location: ev.location,
        date: dateOnly(ev.daysAgo),
        check_in_start: iso(ev.daysAgo, 7, 0),
        check_in_late: iso(ev.daysAgo, 7, 35),
        check_in_end: iso(ev.daysAgo, 9, 0),
        created_by: creator,
      })
      .select("id")
      .single();
    if (evErr) { console.error("event:", evErr.message); continue; }

    const timeIn = ev.status === "absent" ? null
      : ev.status === "late" ? iso(ev.daysAgo, 7, 48) : iso(ev.daysAgo, 7, 20);

    const { error: arErr } = await sb.from("attendance_records").insert({
      student_id: studentId,
      event_id: eventRow.id,
      status: ev.status,
      time_in: timeIn,
      scanned_by: creator,
      remarks: ev.status === "late" ? "Arrived after grace period" : "",
    });
    if (arErr) { console.error("attendance:", arErr.message); continue; }
    if (ev.status === "present") present++;
    else if (ev.status === "late") late++;
    else absent++;
  }

  const { error: upErr } = await sb.from("events").insert(upcoming);
  if (upErr) console.error("upcoming event:", upErr.message);

  const total = present + late + absent;
  const rate = Math.round(((present + late) / total) * 1000) / 10;
  console.log(`Seeded ${total} records for demo student → present ${present}, late ${late}, absent ${absent} (rate ${rate}%)`);
  console.log("Added 1 upcoming event: Pharmacy Recognition Day");
}

main().then(() => process.exit(0));
