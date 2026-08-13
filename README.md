# PharmaTrack — Attendance Monitoring System

A QR-based attendance tracking system for the University of San Agustin College of Pharmacy.

---

## How it works

1. A facilitator creates an event with a check-in window (on-time cutoff, late cutoff, close time)
2. Each student has a personal QR code available on their profile
3. At the venue, a facilitator opens the scanner and scans student QR codes — or students can self-scan a displayed session QR code
4. Attendance status is derived automatically from the scan time:
   - **Present** — scanned before the late cutoff
   - **Late** — scanned after the late cutoff but before the window closes
   - **Absent** — no scan recorded after the check-in window closes
   - **Incomplete** — checked in but no check-out recorded (for events with a checkout window)
5. Facilitators and admins can view, filter, and export attendance reports

---

## Who uses it

| Role | What they can do |
|------|-----------------|
| **Student** | Download personal QR code, view own attendance records |
| **Facilitator** | Create events, scan student QR codes, view and export attendance reports, send absence notifications |
| **Admin** | Everything a facilitator can do, plus manage user accounts, approve registrations, configure system settings |

---

## Key features

- **Automatic status derivation** — present / late / absent / incomplete assigned from event time windows; no manual entry needed
- **Offline-first scanning** — scans queue to IndexedDB when the backend is unreachable and sync automatically on reconnect, preserving original scan timestamps
- **Email notifications** — event broadcasts to students when events are scheduled, absence alerts, weekly attendance digest for facilitators
- **Report exports** — PDF and Excel downloads for attendance records
- **Approval workflow** — new accounts are held as `pending` until an admin approves them
- **Manual reconciliation** — admins can correct a missed or wrong attendance entry for a past event
- **Rate limiting** — critical endpoints (`/api/scan`, `/api/auth/*`, `/api/events`) are rate-limited per IP via Upstash Redis (falls back to in-memory in dev)

---

## Local development

```bash
npm install
```

Create `.env.local` in the project root with the following variables:

```
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Email / SMTP (optional — app runs without these)
SMTP_HOST=
SMTP_PORT=
SMTP_SECURE=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=

# Upstash Redis rate limiting (optional — falls back to in-memory)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Then start the dev server:

```bash
npm run dev
```

```bash
npm test            # run tests
npm run type-check  # TypeScript check
npm run lint        # ESLint
npm run build       # production build
```

---

## Tech stack

Next.js 15 (App Router) · Supabase (Postgres + Auth) · Zod · Vitest · html5-qrcode / qrcode.react · pdfkit / xlsx · nodemailer · Upstash Redis · Sentry

---

## Contact

For access requests or support, contact the system administrator.
