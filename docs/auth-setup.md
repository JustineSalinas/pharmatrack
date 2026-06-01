# PharmaTrack — Auth Setup Guide

This covers the parts of authentication that must be configured **outside the code**, in
your Supabase dashboard and Google Cloud Console. The application code is already wired for
all of it.

---

## 1. "Continue with Google" (Google OAuth) [REMOVED]

> [!WARNING]
> Google OAuth has been removed from the application UI and client-side code. This documentation is preserved for reference only.


### Step A — Create a Google OAuth client
1. Go to <https://console.cloud.google.com/> and create (or pick) a project.
2. **APIs & Services → OAuth consent screen**
   - User type: **External** → Create.
   - Fill App name (e.g. *PharmaTrack*), your support email, developer email. Save.
   - Add yourself under **Test users** while developing.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Application type: **Web application**.
   - **Authorized JavaScript origins:**
     - `http://localhost:3000`
     - your production URL (e.g. `https://pharmatrack.vercel.app`)
   - **Authorized redirect URIs** — this is the Supabase callback, *not* your app:
     - `https://<YOUR-PROJECT-REF>.supabase.co/auth/v1/callback`
   - Create. Copy the **Client ID** and **Client secret**.

> Find `<YOUR-PROJECT-REF>` in your Supabase project URL
> (`https://<project-ref>.supabase.co`), already in your `.env.local`.

### Step B — Enable Google in Supabase
1. Supabase dashboard → **Authentication → Providers → Google**.
2. Toggle **Enable**, paste the **Client ID** and **Client secret** from Step A. Save.

### Step C — Allow your redirect URLs
Supabase dashboard → **Authentication → URL Configuration**:
- **Site URL:** `http://localhost:3000` (dev) — switch to your prod URL when you deploy.
- **Redirect URLs** (add both):
  - `http://localhost:3000/**`
  - `https://<your-prod-domain>/**`

That's it. New Google users are sent to `/onboarding` to choose a role; returning users go
straight to their dashboard.

---

## 2. Password reset ("Forgot password?")

Code is implemented: `/forgot-password` sends the email, `/reset-password` sets the new one.
For the email link to return to the app, the redirect URL must be allowed:

- The same **Redirect URLs** allowlist from Step C above covers `/reset-password`.
- **Email sending:** Supabase's built-in email works for low volume / testing (a few mails
  per hour). For production, configure your own SMTP under
  **Authentication → Emails → SMTP Settings** so reset emails are reliable and unbranded.
- Optionally customise the **Reset Password** email template under
  **Authentication → Emails → Templates**.

---

## 3. "Legacy API keys are disabled" (resolved)

Your `.env.local` already uses the new key format (`sb_publishable_…` / `sb_secret_…`) and
`@supabase/supabase-js` is current, so this error only appeared because an old dev server was
still running with the previous JWT keys cached. **Fix: restart the dev server** (`npm run dev`)
after any `.env.local` change — Next.js only reads env vars at startup.

If it ever recurs, confirm the keys in **Supabase dashboard → Project Settings → API Keys**
match what's in `.env.local`.

---

## Quick local test checklist
- [ ] Restart `npm run dev` after editing `.env.local`.
- [ ] Log in with an email/password account (no "Legacy API keys" error).
- [ ] Click **Forgot password?** → receive email → set a new password → log in with it.
- [ ] In **Profile → Security**, change your password (student, facilitator, admin).
- [ ] [DEPRECATED/REMOVED] After Step 1–C above, click **Continue with Google**.
