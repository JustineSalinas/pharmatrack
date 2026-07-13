# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

PharmaTrack — a QR-based attendance tracking system for the University of San Agustin College of Pharmacy. Faculty ("facilitators") open events/sessions, students scan a personal QR code to check in/out, and attendance status (`present`/`late`/`absent`/`incomplete`) is derived automatically from event time windows.

## gstack

Install on a new machine: `bash scripts/setup-gstack.sh` (requires [bun](https://bun.sh)).

Use the `/browse` skill from gstack for all web browsing. **Never use `mcp__claude-in-chrome__*` tools.**

### Skill routing

When the user's request matches an available gstack skill, invoke it via the Skill tool. When in doubt, invoke the skill.

- Product ideas/brainstorming → `/office-hours`
- Strategy/scope → `/plan-ceo-review`
- Architecture → `/plan-eng-review`
- Design system/plan review → `/design-consultation` or `/plan-design-review`
- Full review pipeline → `/autoplan`
- Bugs/errors → `/investigate`
- QA/testing site behavior → `/qa` or `/qa-only`
- Code review/diff check → `/review`
- Visual polish → `/design-review`
- Ship/deploy/PR → `/ship` or `/land-and-deploy`
- Save progress → `/context-save`
- Resume context → `/context-restore`
- Author a backlog-ready spec/issue → `/spec`

## Commands

```bash
npm run dev          # next dev --turbo
npm run build        # next build (typescript/eslint errors are ignored at build time, see next.config.js)
npm run lint         # next lint
npm run type-check   # tsc --noEmit
npm test             # vitest run (single run, used in CI)
npm run test:watch   # vitest watch mode
```

Run a single test file or test name:

```bash
npx vitest run src/lib/__tests__/attendance.test.ts
npx vitest run -t "test name substring"
```

CI (`.github/workflows/ci.yml`) runs lint, type-check, test, and build as separate jobs on every PR and push to `main`. The build job injects placeholder Supabase env vars (same ones as `vitest.config.ts`) since no real backend is available in CI.

### Local data/admin scripts (run with `node`/`tsx`, need `.env.local`)

- `scripts/seed.ts` — seeds 50 fake students via `@faker-js/faker`
- `scripts/seed-demo-attendance.mjs`, `scripts/seed-test-accounts.mjs` — additional seed data
- `scripts/apply_rls.js` — (re)applies `schema.sql` RLS policies to Supabase
- `scripts/configure-auth-smtp.mjs`, `scripts/apply-email-templates.mjs` — configure Supabase Auth SMTP and email templates
- `scratch/check-admin.js`, `scratch/ensure-admin-password.js` — one-off admin account fixes

## Architecture

**Stack:** Next.js 15 App Router + React 18, Supabase (Postgres + Auth), Zod validation, Vitest, Sentry, Upstash Redis (rate limiting), `html5-qrcode`/`qrcode.react` for QR.

### Roles and access

Three account types: `student`, `facilitator` (faculty), `admin`. Every account also has a `status`: `pending` / `approved` / `rejected`, enforced both client-side (`src/app/dashboard/layout.tsx` blocks non-approved users with a status screen) and at the database level via Postgres RLS.

`facilitator` and `admin` are collectively "council" in the schema (`is_council()` SQL function) — both can manage events, QR sessions, and attendance; only `admin` can manage user accounts and other facilitators (`is_admin()`). These two SQL functions (`schema.sql`) gate almost every RLS policy, so when adding a new table, follow the existing `is_admin()`/`is_council()` pattern rather than inlining role checks.

Route groups under `src/app/dashboard/` mirror this: `dashboard/admin/*` and `dashboard/facilitator/*` are role-specific page trees sharing the single root `dashboard/layout.tsx` (auth/status gating + `Sidebar`) — the nested `admin/layout.tsx` and equivalent are intentionally pass-through.

### Auth

Two Supabase client entry points, used in different contexts — don't mix them up:
- `src/lib/supabase.ts` — browser client (`createBrowserClient`), used from client components and `src/lib/auth-client.ts`.
- `src/lib/server.ts` — server client (`createServerClient`, cookie-based), for use inside Server Components/Route Handlers.
- `src/lib/auth.ts` (`getBackendUser`) — the auth resolver API routes should call. It tries, in order: `Authorization: Bearer` header → `pharmatrack_token` cookie validated against the service-role client → SSR cookie client fallback. `requireAuth(accountType?)` layers on profile-status and role checks and throws `Unauthorized`/`Forbidden`.

Registration is always server-side (`/api/auth/register`) rather than calling Supabase `signUp()` directly from the browser, so GoTrue rate-limits by the Vercel server IP instead of shared campus WiFi, and so orphaned auth users get cleaned up on failure.

### Attendance state machine

The core business logic lives in `src/app/api/scan/route.ts` and `src/lib/attendance.ts`:
- **Scan API** (`POST /api/scan`, requires approved admin/facilitator): resolves a student from `qr_code_id`, then applies event time windows (`check_in_start/late/end`, `check_out_start/end`) to decide between three cases per scan — no existing record → time-in (status `present` or `late` depending on `check_in_late`); existing record with `time_in` but no `time_out` → time-out (must be within 4 hours and inside any `check_out` window); both already set → reject as duplicate.
- **Backfill** (`backfillEventStatuses` in `src/lib/attendance.ts`): a client-triggered, idempotent job (throttled via `runIfDue` + `localStorage`) that retroactively marks `absent` (no scan once `check_in_end` has passed) and `incomplete` (`time_in` with no `time_out` once `check_out_end` has passed) for events in the last 60 days. This is opportunistic — it runs when staff open a dashboard, not on a server cron.
- Reporting reads from the `student_attendance_summary` Postgres view (`schema.sql`) rather than recomputing aggregates in application code.

### Rate limiting

`src/middleware.ts` rate-limits specific API paths (`/api/scan`, `/api/auth/*`, `/api/admin/reset-password`, `/api/events`) by IP. Uses Upstash Redis when `UPSTASH_REDIS_REST_URL`/`TOKEN` are set (production), and falls back to an in-memory `Map` otherwise (local dev, and if Upstash is unreachable — a Redis outage must not block scanning).

### Local date handling

Supabase stores `date` columns as plain `YYYY-MM-DD`. Never use `new Date("YYYY-MM-DD")` or `.toISOString()` on those — both cross a UTC boundary and can shift the date by a day in timezones ahead of UTC (e.g. Manila, UTC+8). Always go through the helpers in `src/lib/supabase.ts`: `parseDateLocal`, `formatDateLocal`, `toLocalDateKey`.

### Database

`schema.sql` is the source of truth for tables, RLS policies, and the `is_admin()`/`is_council()` functions — there's no migration framework, so schema changes are applied by hand via `scripts/apply_rls.js` or the Supabase SQL editor. Key tables: `users`, `student_profiles`, `facilitator_profiles`, `events`, `qr_sessions`, `attendance_records`, `system_config`, `products` (merch). `src/lib/schema.ts` holds the TypeScript types mirroring these tables; `src/lib/supabase.ts` additionally types the Supabase `Database` generic.

### Row limits (Supabase/PostgREST)

Supabase/PostgREST enforces a **hard per-query row cap of 1,000**, confirmed empirically on this
project (2026-07 CPMT incident) — it silently overrides whatever `.limit()` the client requests
(e.g. `.limit(20000)` still returns at most 1,000 rows) and applies uniformly to both table
`.select()` calls and RPC calls that return multiple rows (`SETOF`/`TABLE`). There is no error;
the query just quietly returns a subset.

This bites any query that fetches rows and then counts/sums/tallies them **client-side** —
`.length`, `.filter().length`, `.reduce()` — once the true result set for that query exceeds
1,000 rows. It has already caused two real incidents: attendance-log stats undercounting after a
bulk backfill, and Reports pages *non-deterministically* dropping an entire event's worth of
records (no `ORDER BY` meant which rows survived the cap varied between calls).

Rules of thumb when adding a new stat, count, or dashboard tile:
- **Need a total/count?** Use `.select("*", { count: "exact", head: true })`, not
  fetch-then-`.length`. `head: true` doesn't transfer rows and is never subject to the cap.
- **Need a sum/aggregate over many rows (e.g. per-student or per-event totals)?** Aggregate
  **server-side in SQL** and return one row per *entity* (student, event), not per *record* —
  `attendance_records` grows fast (per scan) and can cross 1,000 within days for a single busy
  event; `events`/`users` grow slowly and are safe to return one-row-per-entity indefinitely. See
  `get_attendance_rate_totals()` and `get_event_attendance_stats()` in `schema.sql` for the
  pattern (both `SECURITY DEFINER`, gated by `is_council()`, `STABLE`).
- **Need a row list to display (e.g. "recent scans")?** Add an explicit, deliberate `.limit()`
  sized for genuine display purposes (e.g. 500) and treat it as a "recent activity" feed, not a
  source of truth for any count — never derive a stat from that same array.

### Tests

Vitest tests live in `src/__tests__/` (API route handlers, mocking the Supabase chain manually — see `api.scan.test.ts` for the pattern) and `src/lib/__tests__/` (pure logic: `attendance.ts`, `merch.ts`, `validations.ts`). `vitest.config.ts` injects placeholder Supabase env vars so tests never hit a real backend.
