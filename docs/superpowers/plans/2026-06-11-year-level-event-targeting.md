# Year-Level Event Targeting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow facilitators to restrict events to specific year levels (1st–4th Year); students outside the target years won't see the event on their dashboard.

**Architecture:** Add a `target_year_levels TEXT[]` column to the `events` table (NULL = all years). The create/edit modal gets checkboxes for year selection. The API stores the array and filters the email broadcast. The student dashboard filters fetched events client-side using the student's `current_year`.

**Tech Stack:** Next.js 14, Supabase (Postgres), TypeScript, Resend (email)

---

## File Map

| File | Change |
|------|--------|
| `schema.sql` | Add `target_year_levels TEXT[]` column definition |
| `src/app/api/events/route.ts` | Accept + store `target_year_levels`; filter broadcast recipients by year |
| `src/app/dashboard/facilitator/events/page.tsx` | Add year level checkbox UI; show badges on event rows; populate field on edit |
| `src/app/dashboard/page.tsx` | Filter `upcomingEvents` client-side by student's `current_year` |

---

## Task 1: Add `target_year_levels` column to Supabase

**Files:**
- Modify: `schema.sql` (documentation only — actual migration runs via Supabase MCP)

- [ ] **Step 1: Apply migration via Supabase MCP**

Run the following SQL migration using the `mcp__plugin_supabase_supabase__apply_migration` tool (or the Supabase MCP equivalent available in this session):

```sql
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS target_year_levels TEXT[];
```

Migration name: `add_target_year_levels_to_events`

- [ ] **Step 2: Update schema.sql to document the new column**

In `schema.sql`, inside the `CREATE TABLE IF NOT EXISTS public.events` block (around line 243), add the column after `created_at`:

```sql
  target_year_levels  TEXT[],
```

The full table block should look like:

```sql
CREATE TABLE IF NOT EXISTS public.events (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                TEXT NOT NULL,
  description         TEXT,
  location            TEXT NOT NULL,
  date                DATE NOT NULL,
  check_in_start     TIMESTAMPTZ NOT NULL,
  check_in_late      TIMESTAMPTZ NOT NULL,
  check_in_end       TIMESTAMPTZ NOT NULL,
  check_out_start    TIMESTAMPTZ,
  check_out_end      TIMESTAMPTZ,
  created_by         UUID NOT NULL REFERENCES public.users(id),
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  target_year_levels  TEXT[]
);
```

- [ ] **Step 3: Commit**

```bash
git add schema.sql
git commit -m "feat: add target_year_levels column to events table"
```

---

## Task 2: Update the Events API to store year levels and filter broadcast

**Files:**
- Modify: `src/app/api/events/route.ts`

- [ ] **Step 1: Accept `target_year_levels` in POST body**

In `src/app/api/events/route.ts`, update the destructuring on line 52:

```typescript
const { name, location, date, check_in_start, check_in_late, check_in_end, target_year_levels } = body;
```

- [ ] **Step 2: Store `target_year_levels` in the insert**

Update the `.insert()` call (around line 61) to include the new field. Pass `null` when the array is empty (means all years):

```typescript
const { data: newEvent, error: insertErr } = await supabase
  .from("events")
  .insert({
    name,
    location,
    date,
    check_in_start,
    check_in_late,
    check_in_end,
    created_by: user.id,
    target_year_levels: target_year_levels?.length ? target_year_levels : null,
  })
  .select()
  .single();
```

- [ ] **Step 3: Filter email broadcast by year level**

Update the student query (around line 82) to filter by `current_year` when `target_year_levels` is set. Replace the existing query block:

```typescript
// 5. Query approved student emails — filtered by year level if event targets specific years
let studentsQuery = supabase
  .from("users")
  .select("email, full_name, student_profiles!inner(current_year)")
  .eq("account_type", "student")
  .eq("status", "approved")
  .ilike("email", "%@usa.edu.ph");

const targetYears: string[] | null = target_year_levels?.length ? target_year_levels : null;
if (targetYears) {
  studentsQuery = studentsQuery.in("student_profiles.current_year", targetYears);
}

const { data: students, error: studentsErr } = await studentsQuery;
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/events/route.ts
git commit -m "feat: store and broadcast events by target year levels"
```

---

## Task 3: Update the Create/Edit Event modal with year level checkboxes

**Files:**
- Modify: `src/app/dashboard/facilitator/events/page.tsx`

### 3a — Add form state

- [ ] **Step 1: Add `targetYearLevels` state**

After the existing form state declarations (around line 41), add:

```typescript
const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
const [targetYearLevels, setTargetYearLevels] = useState<string[]>([]);
```

An empty array means "All Years" (no restriction).

### 3b — Reset form

- [ ] **Step 2: Clear `targetYearLevels` in `resetForm`**

Inside `resetForm()` (around line 211), add:

```typescript
setTargetYearLevels([]);
```

### 3c — Populate on edit

- [ ] **Step 3: Load `target_year_levels` when editing an event**

Inside `startEdit(event)` (around line 222), add after the existing `setFormError("")` line:

```typescript
setTargetYearLevels(event.target_year_levels ?? []);
```

### 3d — Send in create request

- [ ] **Step 4: Include `target_year_levels` in the POST body**

In `handleCreateEvent`, update the fetch body (around line 156):

```typescript
body: JSON.stringify({
  name,
  location,
  date,
  check_in_start: startTS,
  check_in_late: lateTS,
  check_in_end: endTS,
  target_year_levels: targetYearLevels.length ? targetYearLevels : null,
}),
```

### 3e — Send in update request

- [ ] **Step 5: Include `target_year_levels` in the Supabase update**

In the `editingEvent` branch (around line 132), add `target_year_levels` to the update object:

```typescript
const { error } = await supabase
  .from("events")
  .update({
    name,
    location,
    date,
    check_in_start: startTS,
    check_in_late: lateTS,
    check_in_end: endTS,
    target_year_levels: targetYearLevels.length ? targetYearLevels : null,
  })
  .eq("id", editingEvent.id);
```

### 3f — Add checkbox UI to the modal

- [ ] **Step 6: Add year level selector section to the form**

In the `<form>` inside the modal (around line 476, just before the `{formError && ...}` block), add a new section:

```tsx
<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
  <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--dimmed)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
    Target Year Levels
    <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, marginLeft: "6px", color: "var(--dimmed)", fontSize: "11px" }}>
      (leave all unchecked for All Years)
    </span>
  </label>
  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
    {YEAR_LEVELS.map(year => {
      const checked = targetYearLevels.includes(year);
      return (
        <label
          key={year}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "7px",
            padding: "7px 14px",
            borderRadius: "var(--radius-sm)",
            border: `1px solid ${checked ? "rgba(79,70,229,0.5)" : "var(--border)"}`,
            background: checked ? "rgba(79,70,229,0.1)" : "var(--surface2)",
            cursor: "pointer",
            fontSize: "13px",
            color: checked ? "#a5b4fc" : "var(--white-shade)",
            transition: "all 0.15s ease",
            userSelect: "none",
          }}
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={() => {
              setTargetYearLevels(prev =>
                prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year]
              );
            }}
            style={{ accentColor: "#4f46e5", width: "14px", height: "14px" }}
          />
          {year}
        </label>
      );
    })}
  </div>
</div>
```

- [ ] **Step 7: Commit**

```bash
git add src/app/dashboard/facilitator/events/page.tsx
git commit -m "feat: add year level targeting checkboxes to event create/edit modal"
```

---

## Task 4: Show year level badges on event rows (facilitator view)

**Files:**
- Modify: `src/app/dashboard/facilitator/events/page.tsx`

- [ ] **Step 1: Add year level badge display in the event row**

In the event row's main info column (around line 336, after the date/location metadata), add a year level indicator below the date/location line. Replace the closing `</div>` of the metadata div to include:

```tsx
{event.target_year_levels?.length > 0 && (
  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "4px" }}>
    {event.target_year_levels.map((yr: string) => (
      <span
        key={yr}
        style={{
          fontSize: "10px",
          fontWeight: 600,
          padding: "1px 7px",
          borderRadius: "10px",
          background: "rgba(79,70,229,0.12)",
          border: "1px solid rgba(79,70,229,0.3)",
          color: "#a5b4fc",
          letterSpacing: "0.03em",
        }}
      >
        {yr}
      </span>
    ))}
  </div>
)}
```

Place this snippet inside the `<div style={{ minWidth: 0, overflow: "hidden" }}>` block, right after the existing metadata row (the one with `<Calendar>` and `<MapPin>`).

- [ ] **Step 2: Commit**

```bash
git add src/app/dashboard/facilitator/events/page.tsx
git commit -m "feat: show year level badges on event rows in facilitator view"
```

---

## Task 5: Filter events on the student dashboard by year level

**Files:**
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Fetch more events to account for filtering**

In `loadDashboard` (around line 92), change `.limit(8)` to `.limit(20)` so that after filtering there are still enough events to show:

```typescript
const { data: upcoming } = await supabase
  .from("events")
  .select("*")
  .gte("date", today)
  .order("date", { ascending: true })
  .limit(20);
```

- [ ] **Step 2: Filter events by student's year level before storing**

Replace `if (upcoming) setUpcomingEvents(upcoming);` (around line 99) with:

```typescript
if (upcoming) {
  const studentYear = u.student_profiles?.current_year ?? null;
  const filtered = upcoming.filter(ev => {
    if (!ev.target_year_levels || ev.target_year_levels.length === 0) return true;
    if (!studentYear) return true;
    return ev.target_year_levels.includes(studentYear);
  });
  setUpcomingEvents(filtered);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: hide year-restricted events from students outside target year levels"
```

---

## Self-Review Notes

- Spec requirement: facilitator specifies year levels → Task 3 (modal checkboxes) ✓
- Spec requirement: stored in DB → Task 1 (migration) + Task 2 (API insert) ✓
- Spec requirement: events hidden from non-target students → Task 5 (dashboard filter) ✓
- Spec requirement: email broadcast filtered → Task 2 Step 3 ✓
- Spec requirement: year badges visible to facilitator → Task 4 ✓
- `YEAR_LEVELS` constant defined in Task 3a and used in Task 3f ✓
- `targetYearLevels` state initialized in Task 3a, reset in 3b, populated in 3c, sent in 3d/3e ✓
- Empty `target_year_levels` array → stored as `null` in DB → treated as "all years" consistently ✓
