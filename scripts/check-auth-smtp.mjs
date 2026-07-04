// Read-only companion to configure-auth-smtp.mjs.
//
// Why: the `.env.local` SMTP_* values only feed the app's OWN nodemailer
// (src/lib/email.ts). Supabase Auth/GoTrue — which sends signup confirmation,
// password-reset, and resend-verification emails — reads a SEPARATE stored
// config. The admin "test SMTP" route only exercises nodemailer, so it can't
// prove GoTrue is wired. This script queries GoTrue's live config directly and
// prints the SMTP fields (never the password) so you can confirm at a glance
// whether custom SMTP is actually enabled and what the email rate limit is.
//
// Usage: SUPABASE_ACCESS_TOKEN=<pat> node scripts/check-auth-smtp.mjs
// Get a PAT from: https://supabase.com/dashboard/account/tokens

const PROJECT_REF = "jnklgyibjsxgotilvzyb";
const token = process.env.SUPABASE_ACCESS_TOKEN;

if (!token) {
  console.error("Error: SUPABASE_ACCESS_TOKEN is not set.");
  console.error("Get a personal access token from: https://supabase.com/dashboard/account/tokens");
  console.error("Then run: SUPABASE_ACCESS_TOKEN=<your-token> node scripts/check-auth-smtp.mjs");
  process.exit(1);
}

const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
});

if (!res.ok) {
  const err = await res.text();
  console.error(`Failed (HTTP ${res.status}):`, err);
  process.exit(1);
}

const cfg = await res.json();

const customSmtpEnabled = Boolean(cfg.smtp_host);

console.log(`Supabase Auth (GoTrue) email config for project ${PROJECT_REF}:\n`);
console.log(`  Custom SMTP enabled:   ${customSmtpEnabled ? "✓ yes" : "✗ NO — using Supabase's built-in sender (low rate limit)"}`);
console.log(`  smtp_host:             ${cfg.smtp_host || "(not set)"}`);
console.log(`  smtp_port:             ${cfg.smtp_port || "(not set)"}`);
console.log(`  smtp_user:             ${cfg.smtp_user || "(not set)"}`);
console.log(`  smtp_sender_name:      ${cfg.smtp_sender_name || "(not set)"}`);
console.log(`  smtp_admin_email:      ${cfg.smtp_admin_email || "(not set)"}`);
console.log(`  smtp_max_frequency:    ${cfg.smtp_max_frequency ?? "(not set)"} s`);
console.log(`  rate_limit_email_sent: ${cfg.rate_limit_email_sent ?? "(not set)"} /hour`);
console.log(`  mailer_autoconfirm:    ${cfg.mailer_autoconfirm ?? "(not set)"}`);

if (!customSmtpEnabled) {
  console.log(`\n⚠  Custom SMTP is NOT enabled — students will hit "email rate limit exceeded".`);
  console.log(`   Fix: enable it in the dashboard, or run scripts/configure-auth-smtp.mjs.`);
  process.exit(2);
}
