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

const confirmationTemplate = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px; background-color: #ffffff; color: #333333;">
  <div style="text-align: center; border-bottom: 2px solid #E8B84B; padding-bottom: 15px; margin-bottom: 20px;">
    <h2 style="color: #1e1432; margin: 0;">PharmaTrack Portal</h2>
    <span style="color: #666666; font-size: 14px;">University of San Agustin Pharmacy Department</span>
  </div>

  <p>Dear <strong>{{ .Email }}</strong>,</p>

  <p>Thank you for registering with PharmaTrack. Please verify your email address to activate your account.</p>

  <div style="background-color: #f7f7f9; border-left: 4px solid #E8B84B; padding: 20px; margin: 20px 0; border-radius: 4px;">
    <p style="margin: 0 0 16px 0; color: #555555; font-size: 14px;">
      Click the button below to confirm your email address. This link will expire in <strong>24 hours</strong>.
    </p>
    <div style="text-align: center;">
      <a href="{{ .ConfirmationURL }}"
         style="display: inline-block; padding: 12px 32px; background-color: #E8B84B; color: #1e1432; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px; letter-spacing: 0.02em;">
        Verify Email Address
      </a>
    </div>
  </div>

  <p style="font-size: 13px; color: #777777;">
    If you did not create a PharmaTrack account, you can safely ignore this email.
  </p>

  <p style="margin-top: 30px; font-size: 12px; color: #777777; border-top: 1px solid #eaeaea; padding-top: 15px; text-align: center;">
    This is an automated notification from PharmaTrack. Please do not reply directly to this email.
  </p>
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
    // Allow /auth/callback (with any query params) as a redirect target so the
    // PKCE code lands at our handler rather than the site root.
    uri_allow_list: "http://localhost:3000/auth/callback,https://*.vercel.app/auth/callback",
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
console.log("");
console.log("✓ Redirect URL allowlist updated.");
console.log("  Allowed: http://localhost:3000/auth/callback");
console.log("  Allowed: https://*.vercel.app/auth/callback");
console.log("  NOTE: Add your custom production domain manually in Supabase dashboard");
