/**
 * Creates (or repairs) three confirmed test accounts — one per role — so the
 * dashboards can be viewed and verified during development.
 *
 *   Run:  node scripts/seed-test-accounts.mjs
 *
 * Idempotent: re-running updates the existing rows instead of duplicating.
 * Uses the service-role key, so it bypasses email confirmation + RLS.
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { randomUUID } from "node:crypto";

dotenv.config({ path: ".env.local" });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE_KEY) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
}

const supabase = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = "PharmaTrack#2026";

const ACCOUNTS = [
  {
    email: "student.demo@usa.edu.ph",
    full_name: "Demo Student",
    account_type: "student",
    status: "approved",
    profile: { student_id_number: "USA-2026-0001", section: "PH 2A", current_year: "2nd Year" },
  },
  {
    email: "facilitator.demo@usa.edu.ph",
    full_name: "Demo Facilitator",
    account_type: "facilitator",
    status: "approved",
    profile: { department: "Pharmacy" },
  },
  {
    email: "admin.demo@usa.edu.ph",
    full_name: "Demo Administrator",
    account_type: "admin",
    status: "approved",
    profile: null,
  },
];

/** Pages through auth users to find one by email (listUsers is paginated). */
async function findAuthUserByEmail(email) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 200) break;
  }
  return null;
}

async function upsertAccount(acct) {
  // 1. Auth user (create or reuse) — always reset password + confirm email.
  let authUser = await findAuthUserByEmail(acct.email);
  if (authUser) {
    await supabase.auth.admin.updateUserById(authUser.id, {
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: acct.full_name, account_type: acct.account_type },
    });
    console.log(`  ↻ reused auth user ${acct.email}`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: acct.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: acct.full_name, account_type: acct.account_type },
    });
    if (error) throw error;
    authUser = data.user;
    console.log(`  + created auth user ${acct.email}`);
  }

  const userId = authUser.id;

  // 2. users row
  const { error: uErr } = await supabase.from("users").upsert(
    {
      id: userId,
      email: acct.email,
      full_name: acct.full_name,
      account_type: acct.account_type,
      status: acct.status,
    },
    { onConflict: "id" }
  );
  if (uErr) throw new Error(`users upsert: ${uErr.message}`);

  // 3. role profile
  if (acct.account_type === "student") {
    const { data: existing } = await supabase
      .from("student_profiles")
      .select("qr_code_id")
      .eq("user_id", userId)
      .maybeSingle();
    const qr_code_id =
      existing?.qr_code_id || `QR-${randomUUID().replace(/-/g, "").substring(0, 8).toUpperCase()}`;
    const { error: pErr } = await supabase.from("student_profiles").upsert(
      { user_id: userId, ...acct.profile, qr_code_id },
      { onConflict: "user_id" }
    );
    if (pErr) throw new Error(`student_profiles upsert: ${pErr.message}`);
  } else if (acct.account_type === "facilitator") {
    const { error: pErr } = await supabase.from("facilitator_profiles").upsert(
      { user_id: userId, ...acct.profile },
      { onConflict: "user_id" }
    );
    if (pErr) throw new Error(`facilitator_profiles upsert: ${pErr.message}`);
  }

  return userId;
}

async function main() {
  console.log("Seeding test accounts…\n");
  for (const acct of ACCOUNTS) {
    try {
      await upsertAccount(acct);
      console.log(`  ✓ ${acct.account_type.padEnd(11)} ${acct.email}\n`);
    } catch (err) {
      console.error(`  ✗ ${acct.email}: ${err.message}\n`);
    }
  }
  console.log("Done. Log in with:");
  console.log("  Password (all):  " + PASSWORD);
  ACCOUNTS.forEach((a) => console.log(`  ${a.account_type.padEnd(11)} ${a.email}`));
}

main().then(() => process.exit(0));
