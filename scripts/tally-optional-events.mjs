// Per-student tally of OPTIONAL events attended (counts_toward_attendance =
// false) — e.g. "each student must attend 5 of the 15 intramurals sports".
//
//   node scripts/tally-optional-events.mjs            # requirement = 5
//   node scripts/tally-optional-events.mjs --need 3   # different threshold
//
// Read-only. Writes a CSV OUTSIDE the repo (Documents\PHARMA) because it
// contains student names, and prints a summary. Needs .env.local.
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const NEED = Number((process.argv.find((a) => a.startsWith("--need=")) ?? "").split("=")[1])
  || Number(process.argv[process.argv.indexOf("--need") + 1])
  || 5;

const env = Object.fromEntries(
  fs.readFileSync(path.resolve("./.env.local"), "utf8")
    .split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }),
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// PostgREST caps every query at 1,000 rows; page explicitly.
async function all(build) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

async function main() {
  // 1. Which events are optional
  let events;
  try {
    events = await all(() => db.from("events")
      .select("id,name,date").eq("counts_toward_attendance", false).order("date").order("id"));
  } catch (e) {
    if (/counts_toward_attendance/.test(String(e.message))) {
      console.log("The 'counts_toward_attendance' column doesn't exist yet.");
      console.log("Run scripts/migrate-optional-events.sql in the Supabase SQL editor first, then re-run this.");
      process.exitCode = 1;
      return;
    }
    throw e;
  }
  if (events.length === 0) {
    console.log("No events are flagged 'doesn't count toward attendance' — nothing to tally.");
    console.log("(Has the migration been applied, and were the sports events created with the box ticked?)");
    return;
  }
  const eventName = new Map(events.map((e) => [e.id, e.name]));
  console.log(`Optional events (${events.length}):`);
  for (const e of events) console.log(`  ${e.date}  ${e.name}`);

  // 2. Every present/late scan at those events
  const scans = await all(() => db.from("attendance_records")
    .select("student_id,event_id")
    .in("event_id", events.map((e) => e.id))
    .in("status", ["present", "late"])
    .order("id"));

  // 3. Every approved student
  const students = await all(() => db.from("users")
    .select("id,full_name,student_profiles(student_id_number,section,current_year)")
    .eq("account_type", "student").eq("status", "approved").order("id"));

  // 4. Tally: distinct SPORT NAMES per student, not distinct event ids.
  // A sport spanning several days (Basketball, Tue-Fri) can't be one
  // PharmaTrack event — the event form pins check_in_start/check_in_end to a
  // single calendar date — so it's created as several same-named events, one
  // per day. Counting by event.id would let a student who plays 3 of its 4
  // days count Basketball 3 times toward their 5; grouping by the normalized
  // name (matching get_optional_event_tally() in schema.sql) counts it once.
  const norm = (s) => String(s).trim().toLowerCase();
  const attended = new Map();     // student_id -> Set<normalized name>
  const displayName = new Map();  // normalized name -> first-seen display name
  for (const s of scans) {
    const name = eventName.get(s.event_id);
    if (!name) continue;
    const key = norm(name);
    if (!displayName.has(key)) displayName.set(key, name);
    if (!attended.has(s.student_id)) attended.set(s.student_id, new Set());
    attended.get(s.student_id).add(key);
  }

  const rows = students.map((u) => {
    const p = Array.isArray(u.student_profiles) ? u.student_profiles[0] : u.student_profiles;
    const set = attended.get(u.id) ?? new Set();
    const list = [...set].map((key) => displayName.get(key)).sort();
    return {
      name: u.full_name,
      idNumber: p?.student_id_number ?? "",
      year: p?.current_year ?? "",
      section: p?.section ?? "",
      count: set.size,
      met: set.size >= NEED ? "YES" : "NO",
      list: list.join("; "),
    };
  }).sort((a, b) => a.year.localeCompare(b.year) || a.section.localeCompare(b.section) || a.name.localeCompare(b.name));

  // 5. CSV — outside the repo
  const outDir = path.join(process.env.USERPROFILE ?? process.env.HOME ?? ".", "Documents", "PHARMA");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const outFile = path.join(outDir, `optional-event-tally-${stamp}.csv`);
  const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [
    ["Student", "ID Number", "Year", "Section", "Events Attended", `Met ${NEED}+`, "Events"].map(q).join(","),
    ...rows.map((r) => [r.name, r.idNumber, r.year, r.section, r.count, r.met, r.list].map(q).join(",")),
  ].join("\r\n");
  fs.writeFileSync(outFile, "﻿" + csv, "utf8"); // BOM so Excel opens it as UTF-8 (ñ etc.)

  // 6. Summary
  const met = rows.filter((r) => r.met === "YES").length;
  const dist = {};
  for (const r of rows) dist[r.count] = (dist[r.count] ?? 0) + 1;
  console.log(`\nStudents: ${rows.length}   met the ${NEED}-event requirement: ${met}   short: ${rows.length - met}`);
  console.log("Distribution (events attended -> students):");
  for (const k of Object.keys(dist).map(Number).sort((a, b) => a - b)) console.log(`  ${String(k).padStart(2)} events: ${dist[k]}`);
  console.log(`\nCSV written to: ${outFile}`);

}

await main();
