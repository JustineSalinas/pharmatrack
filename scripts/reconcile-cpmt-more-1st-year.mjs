/**
 * Reconciles the 7 first-year students from "More 1st Year.csv" into the
 * CPMT Orientation event (2026-07-10).
 *
 * These students were present per the paper sign-in sheet but could not be
 * QR-scanned on the day (no account / unregistered at the time). The CSV
 * provides their @usa.edu.ph emails, allowing a lookup.
 *
 * Logic per student:
 *   - absent row (time_in IS NULL) → UPDATE to present + set time_in
 *   - incomplete row (time_in set, no time_out) → UPDATE to present (check-in-only event)
 *   - present / late → skip (already correct)
 *   - no row at all → INSERT new present record
 *
 * Run (dry-run, prints what it would do):
 *   node scripts/reconcile-cpmt-more-1st-year.mjs
 *
 * Run (live):
 *   node scripts/reconcile-cpmt-more-1st-year.mjs --live
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const LIVE = process.argv.includes("--live");

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");

const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const CPMT_EVENT_ID = "215fc1f0-ea3e-4846-a4ce-f737e5863829";
const ADMIN_EMAIL = "admin@usa.edu.ph";
const REMARKS = "Reconciled from paper sign-in sheet (More 1st Year.csv) — present on the day, no account at scan time";

// Manila times (UTC+8) → UTC ISO. All times are pre-04:51Z so status = "present".
const STUDENTS = [
  { email: "mcdelarosa@usa.edu.ph",  name: "Mairah De La Rosa",           timeInUtc: "2026-07-10T03:34:00Z" },
  { email: "lpateno@usa.edu.ph",     name: "Lucia Mildred Pateño",        timeInUtc: "2026-07-10T03:43:00Z" },
  { email: "lcastor@usa.edu.ph",     name: "LEAN CASTOR",                 timeInUtc: "2026-07-10T03:59:00Z" },
  { email: "fbautista@usa.edu.ph",   name: "Freidrich Zyrus O. Bautista", timeInUtc: "2026-07-10T04:17:00Z" },
  { email: "spadios@usa.edu.ph",     name: "Shelby Cyan L. Padios",       timeInUtc: "2026-07-10T04:22:00Z" },
  { email: "nnmaguad@usa.edu.ph",    name: "Nathan Nilo F. Maguad II",    timeInUtc: "2026-07-10T04:39:00Z" },
  { email: "lgpalma@usa.edu.ph",     name: "Leolene Grace Palma",         timeInUtc: null },  // no time recorded on sheet
];

async function main() {
  console.log(`Mode: ${LIVE ? "LIVE (writing to DB)" : "DRY RUN (pass --live to apply)"}\n`);

  // Look up the admin's user ID for scanned_by.
  const { data: adminRow } = await sb.from("users").select("id").eq("email", ADMIN_EMAIL).maybeSingle();
  const adminId = adminRow?.id ?? null;
  if (!adminId) console.warn(`[WARN] Admin user (${ADMIN_EMAIL}) not found — scanned_by will be NULL`);

  let inserted = 0, updated = 0, skipped = 0, notFound = 0;

  for (const student of STUDENTS) {
    // 1. Resolve the student's user ID by email.
    const { data: userRow } = await sb.from("users").select("id, full_name").eq("email", student.email).maybeSingle();
    if (!userRow) {
      console.log(`  NOT FOUND  | ${student.name} <${student.email}> — no account with this email`);
      notFound++;
      continue;
    }

    // 2. Check for an existing attendance record for this event.
    const { data: existing } = await sb
      .from("attendance_records")
      .select("id, status, time_in")
      .eq("student_id", userRow.id)
      .eq("event_id", CPMT_EVENT_ID)
      .maybeSingle();

    if (existing) {
      if (existing.status === "present" || existing.status === "late") {
        console.log(`  SKIP       | ${userRow.full_name} — already ${existing.status}`);
        skipped++;
        continue;
      }

      // absent (no time_in) or incomplete (time_in set, no time_out) → flip to present.
      const action = existing.status === "absent" ? "absent → present" : "incomplete → present";
      console.log(`  UPDATE     | ${userRow.full_name} — ${action}, time_in=${student.timeInUtc ?? "unchanged (no paper time)"}`);

      if (LIVE) {
        const patch = {
          status: "present",
          remarks: REMARKS,
          scanned_by: adminId,
          ...(student.timeInUtc && existing.time_in === null ? { time_in: student.timeInUtc } : {}),
        };
        const { error } = await sb
          .from("attendance_records")
          .update(patch)
          .eq("id", existing.id);
        if (error) console.error(`    [ERROR] ${error.message}`);
      }
      updated++;
    } else {
      // No record at all — insert a fresh present row.
      console.log(`  INSERT     | ${userRow.full_name} — new present record, time_in=${student.timeInUtc ?? "null (no paper time)"}`);

      if (LIVE) {
        const { error } = await sb.from("attendance_records").insert({
          student_id: userRow.id,
          event_id: CPMT_EVENT_ID,
          status: "present",
          time_in: student.timeInUtc ?? null,
          time_out: null,
          scanned_by: adminId,
          remarks: REMARKS,
        });
        if (error) console.error(`    [ERROR] ${error.message}`);
      }
      inserted++;
    }
  }

  console.log(`\nSummary: ${inserted} inserted, ${updated} updated, ${skipped} skipped, ${notFound} not found`);
  if (!LIVE) console.log("\nRe-run with --live to apply.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
