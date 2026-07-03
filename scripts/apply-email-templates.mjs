// Applies PharmaTrack-branded email templates to Supabase Auth.
// Usage: SUPABASE_ACCESS_TOKEN=<pat> node scripts/apply-email-templates.mjs
// Get your PAT from: https://supabase.com/dashboard/account/tokens

const PROJECT_REF = "jnklgyibjsxgotilvzyb";
const token = process.env.SUPABASE_ACCESS_TOKEN;

if (!token) {
  console.error("Error: SUPABASE_ACCESS_TOKEN is not set.");
  console.error("Get a personal access token from: https://supabase.com/dashboard/account/tokens");
  console.error("Then run: SUPABASE_ACCESS_TOKEN=<your-token> node scripts/apply-email-templates.mjs");
  process.exit(1);
}

// Uses {{ .SiteURL }} rather than {{ .RedirectTo }}: RedirectTo only renders
// if the exact emailRedirectTo URL is in Supabase's Redirect URLs allow list,
// and a mismatch there silently breaks the confirmation link (users register
// but can never confirm). Site URL is a single trusted dashboard setting with
// no allow-list dependency — simpler and more reliable for a single-domain
// production app like this one. Make sure Site URL is set to the real prod
// domain in Supabase Dashboard → Authentication → URL Configuration.
const confirmationTemplate = `<div style="background-color:#f4f4f7; padding:32px 16px; font-family:Arial, Helvetica, sans-serif;">
  <div style="max-width:560px; margin:0 auto; background-color:#ffffff; border:1px solid #e5e7eb; border-radius:10px; overflow:hidden;">

    <div style="background-color:#1e1432; padding:24px 28px;">
      <div style="font-size:20px; font-weight:800; letter-spacing:0.5px;">
        <span style="color:#ffffff;">PHARMA</span><span style="color:#E8B84B;">TRACK</span>
      </div>
      <div style="color:rgba(255,255,255,0.4); font-size:11px; margin-top:4px;">University of San Agustin Pharmacy Department</div>
      <div style="color:rgba(255,255,255,0.55); font-size:12px; margin-top:8px;">Email Verification</div>
    </div>

    <div style="padding:28px; color:#1e1432; font-size:14px; line-height:1.6;">
      <p style="margin:0 0 16px 0;">Hello, <strong>{{ .Email }}</strong>,</p>
      <p style="margin:0 0 20px 0;">Thank you for registering with PharmaTrack. Please verify your email address to activate your account.</p>

      <div style="background-color:#f7f7f9; border:1px solid #e5e7eb; border-radius:8px; padding:20px; margin:20px 0; text-align:center;">
        <p style="margin:0 0 16px 0; color:#6b7280; font-size:13px;">This link will expire in <strong style="color:#1e1432;">24 hours</strong>.</p>
        <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup"
           style="display:inline-block; padding:12px 32px; background-color:#E8B84B; color:#1e1432; text-decoration:none; border-radius:6px; font-weight:bold; font-size:15px; letter-spacing:0.02em;">
          Verify Email Address
        </a>
      </div>

      <p style="margin:20px 0 0 0; font-size:13px; color:#6b7280;">
        If you did not create a PharmaTrack account, you can safely ignore this email.
      </p>
    </div>

    <div style="padding:16px 28px; border-top:1px solid #e5e7eb; color:#6b7280; font-size:11px; text-align:center;">
      This is an automated message from PharmaTrack — University of San Agustin Pharmacy Department. Please do not reply directly to this email.
    </div>

  </div>
</div>`;

const recoveryTemplate = `<div style="background-color:#f4f4f7; padding:32px 16px; font-family:Arial, Helvetica, sans-serif;">
  <div style="max-width:560px; margin:0 auto; background-color:#ffffff; border:1px solid #e5e7eb; border-radius:10px; overflow:hidden;">

    <div style="background-color:#1e1432; padding:24px 28px;">
      <div style="font-size:20px; font-weight:800; letter-spacing:0.5px;">
        <span style="color:#ffffff;">PHARMA</span><span style="color:#E8B84B;">TRACK</span>
      </div>
      <div style="color:rgba(255,255,255,0.4); font-size:11px; margin-top:4px;">University of San Agustin Pharmacy Department</div>
      <div style="color:rgba(255,255,255,0.55); font-size:12px; margin-top:8px;">Password Reset</div>
    </div>

    <div style="padding:28px; color:#1e1432; font-size:14px; line-height:1.6;">
      <p style="margin:0 0 16px 0;">Hello, <strong>{{ .Email }}</strong>,</p>
      <p style="margin:0 0 20px 0;">We received a request to reset the password for your PharmaTrack account. Click the button below to choose a new password.</p>

      <div style="background-color:#f7f7f9; border:1px solid #e5e7eb; border-radius:8px; padding:20px; margin:20px 0; text-align:center;">
        <p style="margin:0 0 16px 0; color:#6b7280; font-size:13px;">This link will expire in <strong style="color:#1e1432;">24 hours</strong>.</p>
        <a href="{{ .ConfirmationURL }}"
           style="display:inline-block; padding:12px 32px; background-color:#E8B84B; color:#1e1432; text-decoration:none; border-radius:6px; font-weight:bold; font-size:15px; letter-spacing:0.02em;">
          Reset Password
        </a>
      </div>

      <p style="margin:20px 0 0 0; font-size:13px; color:#6b7280;">
        If you did not request a password reset, you can safely ignore this email — your password will remain unchanged.
      </p>
    </div>

    <div style="padding:16px 28px; border-top:1px solid #e5e7eb; color:#6b7280; font-size:11px; text-align:center;">
      This is an automated message from PharmaTrack — University of San Agustin Pharmacy Department. Please do not reply directly to this email.
    </div>

  </div>
</div>`;

console.log(`Applying email templates to project ${PROJECT_REF}...`);

const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
  method: "PATCH",
  headers: {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    mailer_subjects_confirmation: "Verify your PharmaTrack email address",
    mailer_templates_confirmation_content: confirmationTemplate,
    mailer_subjects_recovery: "Reset your PharmaTrack password",
    mailer_templates_recovery_content: recoveryTemplate,
    // NOTE: Site URL and redirect allow list are managed in the Supabase
    // dashboard (Authentication → URL Configuration), not here — patching
    // uri_allow_list via the API would overwrite manually-added domains.
  }),
});

if (!res.ok) {
  const err = await res.text();
  console.error(`Failed (HTTP ${res.status}):`, err);
  process.exit(1);
}

console.log("✓ Confirmation email template updated successfully.");
console.log("  Subject: \"Verify your PharmaTrack email address\"");
console.log("  Test by registering a new account at /register.");
console.log("");
console.log("✓ Password recovery email template updated successfully.");
console.log("  Subject: \"Reset your PharmaTrack password\"");
console.log("  Test by using /forgot-password with a registered email.");
