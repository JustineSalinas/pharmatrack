// Points Supabase Auth at the project's custom Gmail SMTP server.
//
// Why: Supabase's built-in email sender is rate-limited to only a few
// confirmation emails per hour. Once exceeded, signUp() fails with
// "email rate limit exceeded" and new users can't register. Using your own
// SMTP server removes that limit.
//
// Reads SMTP_* credentials from .env.local automatically — you only provide
// your Supabase personal access token.
//
// Usage: SUPABASE_ACCESS_TOKEN=<pat> node scripts/configure-auth-smtp.mjs
// Get a PAT from: https://supabase.com/dashboard/account/tokens

import fs from "fs";
import path from "path";

const PROJECT_REF = "jnklgyibjsxgotilvzyb";
const token = process.env.SUPABASE_ACCESS_TOKEN;

if (!token) {
  console.error("Error: SUPABASE_ACCESS_TOKEN is not set.");
  console.error("Get a personal access token from: https://supabase.com/dashboard/account/tokens");
  console.error("Then run: SUPABASE_ACCESS_TOKEN=<your-token> node scripts/configure-auth-smtp.mjs");
  process.exit(1);
}

// --- Read SMTP_* values from .env.local ---
const envPath = path.join(process.cwd(), ".env.local");
if (!fs.existsSync(envPath)) {
  console.error(`Error: ${envPath} not found. Run this script from the project root.`);
  process.exit(1);
}
const envText = fs.readFileSync(envPath, "utf8");
const readEnv = (key) => {
  const m = envText.match(new RegExp("^\\s*" + key + "\\s*=\\s*(.*)\\s*$", "m"));
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
};

const smtpHost = readEnv("SMTP_HOST");
const smtpPort = readEnv("SMTP_PORT") || "587";
const smtpUser = readEnv("SMTP_USER");
const smtpPass = readEnv("SMTP_PASS");
const smtpFromRaw = readEnv("SMTP_FROM") || "";

if (!smtpHost || !smtpUser || !smtpPass) {
  console.error("Error: SMTP_HOST, SMTP_USER, and SMTP_PASS must all be set in .env.local.");
  process.exit(1);
}

// Derive sender name + admin email from SMTP_FROM ("Name <email>") or fall back to the user.
const fromMatch = smtpFromRaw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
const senderName = (fromMatch ? fromMatch[1].trim() : "PharmaTrack") || "PharmaTrack";
const adminEmail = fromMatch ? fromMatch[2].trim() : smtpUser;

console.log(`Configuring custom SMTP for project ${PROJECT_REF}...`);
console.log(`  Host:   ${smtpHost}:${smtpPort}`);
console.log(`  User:   ${smtpUser}`);
console.log(`  Sender: ${senderName} <${adminEmail}>`);

const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    // Enable + configure the external SMTP server
    smtp_host: smtpHost,
    smtp_port: smtpPort,
    smtp_user: smtpUser,
    smtp_pass: smtpPass,
    smtp_admin_email: adminEmail,
    smtp_sender_name: senderName,
    // Minimum seconds between two emails to the same address (1 = effectively off)
    smtp_max_frequency: 1,
    // Allow up to 300 auth emails/hour now that we're not on the built-in sender.
    // NOTE: the Supabase dashboard (Authentication → Rate Limits) is the live
    // source of truth for this value; keep this constant in sync with it so a
    // re-run of this script doesn't silently reset the configured limit.
    rate_limit_email_sent: 300,
  }),
});

if (!res.ok) {
  const err = await res.text();
  console.error(`Failed (HTTP ${res.status}):`, err);
  process.exit(1);
}

console.log("✓ Custom SMTP configured. The built-in email rate limit no longer applies.");
console.log("  Test by registering a new account at /register.");
