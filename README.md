# PharmaTrack — Attendance Monitoring System

A QR-based attendance tracking system for the University of San Agustin College of Pharmacy.

---

## How it works

1. A facilitator creates an event with a check-in window (on-time cutoff, late cutoff, close time)
2. Each student has a personal QR code available on their profile
3. At the venue, a facilitator opens the scanner and scans each student's QR code
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

---

## Local development

```bash
npm install
cp .env.local.example .env.local   # fill in Supabase and SMTP credentials
npm run dev
```

Required env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Email features also need `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (optional — the app runs without them).

```bash
npm test            # run tests
npm run type-check  # TypeScript check
npm run lint        # ESLint
npm run build       # production build
```

---

## Tech stack

Next.js 15 (App Router) · Supabase (Postgres + Auth) · Zod · Vitest · nodemailer · Upstash Redis · Sentry

---

## Contact

For access requests or support, contact the system administrator.
