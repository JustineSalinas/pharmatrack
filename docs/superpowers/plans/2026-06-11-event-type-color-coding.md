# Event Type Color Coding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a required `event_type` field (Department / University Wide / Pharmacy) to events, color-coded gold / red / purple across the facilitator panel, calendar, weekly schedule, and student dashboard.

**Architecture:** A shared `getEventTypeStyle()` helper in `src/lib/event-type.ts` owns all color tokens so no view duplicates them. A DB migration adds the column (NULL = Department). The facilitator modal gets a single-select pill UI. All four student/facilitator views read `event.event_type` and call the helper for colors.

**Tech Stack:** Next.js 14, Supabase (Postgres), TypeScript

---

## File Map

| File | Change |
|------|--------|
| `src/lib/event-type.ts` | **Create** — shared color helper + type constants |
| `src/lib/schema.ts` | Add `event_type` field to `Event` interface |
| `schema.sql` | Document new column |
| Supabase (migration) | `ALTER TABLE events ADD COLUMN event_type TEXT` |
| `src/app/api/events/route.ts` | Accept + store `event_type` |
| `src/app/dashboard/facilitator/events/page.tsx` | Type selector in modal; type badge on event rows |
| `src/app/dashboard/calendar/page.tsx` | Color pills on grid; type badge + colored border in drawer |
| `src/app/dashboard/schedule/page.tsx` | Color pills on weekly grid; type badge on day-detail cards; type badge on upcoming cards |
| `src/app/dashboard/page.tsx` | Type badge + colored left border on upcoming event cards |

---

## Task 1: Create shared color helper and update Event type

**Files:**
- Create: `src/lib/event-type.ts`
- Modify: `src/lib/schema.ts`

- [ ] **Step 1: Create `src/lib/event-type.ts`**

```typescript
export type EventType = "Department" | "University Wide" | "Pharmacy";

export const EVENT_TYPES: EventType[] = ["Department", "University Wide", "Pharmacy"];

export interface EventTypeStyle {
  color: string;
  bg: string;
  border: string;
  label: string;
}

export function getEventTypeStyle(type: string | null | undefined): EventTypeStyle {
  switch (type) {
    case "University Wide":
      return {
        color: "#ef4444",
        bg: "rgba(239, 68, 68, 0.1)",
        border: "rgba(239, 68, 68, 0.25)",
        label: "University Wide",
      };
    case "Pharmacy":
      return {
        color: "#a78bfa",
        bg: "rgba(167, 139, 250, 0.1)",
        border: "rgba(167, 139, 250, 0.25)",
        label: "Pharmacy",
      };
    default:
      return {
        color: "#D4AF37",
        bg: "rgba(212, 175, 55, 0.1)",
        border: "rgba(212, 175, 55, 0.25)",
        label: "Department",
      };
  }
}
```

- [ ] **Step 2: Add `event_type` to the `Event` interface in `src/lib/schema.ts`**

The `Event` interface currently ends at line 43. Add `event_type` after `created_at`:

```typescript
export interface Event {
  id: string;
  name: string;
  description: string | null;
  location: string;
  date: string;
  check_in_start: string;
  check_in_late: string;
  check_in_end: string;
  check_out_start: string | null;
  check_out_end: string | null;
  created_by: string;
  created_at: string;
  event_type: string | null;
  target_year_levels: string[] | null;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/event-type.ts src/lib/schema.ts
git commit -m "feat: add event_type color helper and update Event interface"
```

---

## Task 2: Database migration

**Files:**
- Supabase (apply migration via CLI)
- Modify: `schema.sql`

- [ ] **Step 1: Apply migration via Supabase CLI**

```bash
npx supabase db query "ALTER TABLE public.events ADD COLUMN IF NOT EXISTS event_type TEXT;" \
  --db-url "postgresql://postgres.jnklgyibjsxgotilvzyb:SXZzN11tAL4Ut65B@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres"
```

Expected output: `ALTER TABLE`

- [ ] **Step 2: Update `schema.sql` to document the column**

Inside the `CREATE TABLE IF NOT EXISTS public.events` block, add `event_type` after `target_year_levels`:

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
  target_year_levels  TEXT[],
  event_type          TEXT
);
```

- [ ] **Step 3: Commit**

```bash
git add schema.sql
git commit -m "feat: add event_type column to events table"
```

---

## Task 3: Update Events API to store event_type

**Files:**
- Modify: `src/app/api/events/route.ts`

- [ ] **Step 1: Destructure `event_type` from the request body**

Find the destructuring line (currently around line 52):

```typescript
const { name, location, date, check_in_start, check_in_late, check_in_end, target_year_levels, event_type } = body;
```

- [ ] **Step 2: Add `event_type` to the insert payload**

In the `.insert()` call, add the field:

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
    event_type: event_type ?? null,
  })
  .select()
  .single();
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/events/route.ts
git commit -m "feat: store event_type on event creation"
```

---

## Task 4: Facilitator event modal — type selector + row badges

**Files:**
- Modify: `src/app/dashboard/facilitator/events/page.tsx`

- [ ] **Step 1: Import the helper**

Add to the top imports:

```typescript
import { EVENT_TYPES, getEventTypeStyle } from "@/lib/event-type";
```

- [ ] **Step 2: Add `eventType` form state**

After the existing `const YEAR_LEVELS = ...` line (around line 36), add:

```typescript
const [eventType, setEventType] = useState<string>("Department");
```

- [ ] **Step 3: Reset `eventType` in `resetForm`**

Add inside `resetForm()`:

```typescript
setEventType("Department");
```

- [ ] **Step 4: Populate `eventType` in `startEdit`**

Add inside `startEdit(event)` before `setShowModal(true)`:

```typescript
setEventType(event.event_type ?? "Department");
```

- [ ] **Step 5: Send `event_type` in the POST body**

In the fetch body (create path):

```typescript
body: JSON.stringify({
  name,
  location,
  date,
  check_in_start: startTS,
  check_in_late: lateTS,
  check_in_end: endTS,
  target_year_levels: targetYearLevels.length ? targetYearLevels : null,
  event_type: eventType,
}),
```

- [ ] **Step 6: Send `event_type` in the Supabase update**

In the `.update()` call (edit path), add `event_type: eventType` to the update object:

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
    event_type: eventType,
  })
  .eq("id", editingEvent.id);
```

- [ ] **Step 7: Add event type selector UI to the modal**

Place this new section ABOVE the existing year level checkboxes section in the form (just after the date/time grid row, before the year level section):

```tsx
<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
  <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--dimmed)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
    Event Type
  </label>
  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
    {EVENT_TYPES.map(type => {
      const style = getEventTypeStyle(type);
      const selected = eventType === type;
      return (
        <button
          key={type}
          type="button"
          onClick={() => setEventType(type)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "7px",
            padding: "7px 16px",
            borderRadius: "var(--radius-sm)",
            border: `1px solid ${selected ? style.border : "var(--border)"}`,
            background: selected ? style.bg : "var(--surface2)",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: selected ? 600 : 400,
            color: selected ? style.color : "var(--white-shade)",
            transition: "all 0.15s ease",
          }}
        >
          <span style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: selected ? style.color : "var(--border)",
            flexShrink: 0,
            transition: "all 0.15s ease",
          }} />
          {type}
        </button>
      );
    })}
  </div>
</div>
```

- [ ] **Step 8: Add event type badge to each event row**

In the event row's main info column, next to the existing status badge (the `<span>` with `status.label` inside the `<h3>` row, around line 322), add the type badge right after the status badge:

```tsx
{(() => {
  const ts = getEventTypeStyle(event.event_type);
  return (
    <span style={{
      fontSize: "10px",
      fontWeight: 600,
      padding: "2px 8px",
      borderRadius: "12px",
      color: ts.color,
      background: ts.bg,
      border: `1px solid ${ts.border}`,
      textTransform: "uppercase",
      letterSpacing: "0.05em",
      flexShrink: 0,
    }}>
      {ts.label}
    </span>
  );
})()}
```

- [ ] **Step 9: Commit**

```bash
git add src/app/dashboard/facilitator/events/page.tsx
git commit -m "feat: add event type selector to facilitator modal and type badges on rows"
```

---

## Task 5: Color-code the Calendar page

**Files:**
- Modify: `src/app/dashboard/calendar/page.tsx`

- [ ] **Step 1: Import the helper**

```typescript
import { getEventTypeStyle } from "@/lib/event-type";
```

- [ ] **Step 2: Color event pills on the grid cells**

Find the `cal-cell-event-pill` span (around line 164). Replace it with:

```tsx
{dayEvents.slice(0, 2).map((ev) => {
  const ts = getEventTypeStyle(ev.event_type);
  return (
    <span
      key={ev.id}
      className="cal-cell-event-pill"
      style={{
        background: ts.bg,
        color: ts.color,
        border: `1px solid ${ts.border}`,
      }}
      title={ev.name}
    >
      {ev.name}
    </span>
  );
})}
```

- [ ] **Step 3: Add type badge and colored border to drawer event cards**

Find the `cal-event-card` div inside the drawer (around line 202). Replace the card rendering with:

```tsx
{selectedEvents.map((ev) => {
  const ts = getEventTypeStyle(ev.event_type);
  return (
    <div
      key={ev.id}
      className="cal-event-card"
      style={{ borderLeftColor: ts.color }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "6px" }}>
        <h4 className="cal-event-name">{ev.name}</h4>
        <span style={{
          fontSize: "9px",
          fontWeight: 700,
          padding: "2px 6px",
          borderRadius: "4px",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          background: ts.bg,
          color: ts.color,
          border: `1px solid ${ts.border}`,
          flexShrink: 0,
        }}>
          {ts.label}
        </span>
      </div>
      {ev.description && <p className="cal-event-desc">{ev.description}</p>}
      <div className="cal-event-meta-row">
        <span className="cal-event-meta-item">
          <MapPin size={12} /> {ev.location}
        </span>
        <span className="cal-event-meta-item">
          <Clock size={12} /> {fmtTime(ev.check_in_start)} – {fmtTime(ev.check_in_end)}
        </span>
      </div>
    </div>
  );
})}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/calendar/page.tsx
git commit -m "feat: color-code calendar events by type"
```

---

## Task 6: Color-code the Schedule (weekly) page

**Files:**
- Modify: `src/app/dashboard/schedule/page.tsx`

- [ ] **Step 1: Import the helper**

```typescript
import { getEventTypeStyle } from "@/lib/event-type";
```

- [ ] **Step 2: Add `eventType` to the `SessionBlock` interface**

The `SessionBlock` interface (around line 24) becomes:

```typescript
interface SessionBlock {
  sessionId: string;
  subject: string;
  time: string;
  type: "session" | "event";
  location?: string;
  sortTime: number;
  eventType?: string;
}
```

- [ ] **Step 3: Pass `eventType` when pushing school events into `byDay`**

In the "2. Process School Events" loop (around line 159), update the push to include `eventType`:

```typescript
byDay[key].push({
  sessionId: ev.id,
  subject: ev.name,
  time: timeRange,
  type: "event",
  location: ev.location,
  sortTime,
  eventType: ev.event_type ?? "Department",
});
```

- [ ] **Step 4: Color weekly grid pills by event type**

Find the pill inside the weekly grid (around line 283, the `cal-cell-event-pill` span for school events). Replace the style logic:

```tsx
{dayEvents.slice(0, 2).map((ev) => {
  const isSchoolEvent = ev.type === "event";
  const ts = isSchoolEvent ? getEventTypeStyle(ev.eventType) : null;
  return (
    <span
      key={ev.sessionId}
      className="cal-cell-event-pill"
      style={isSchoolEvent && ts ? {
        background: ts.bg,
        color: ts.color,
        border: `1px solid ${ts.border}`,
      } : undefined}
      title={ev.subject}
    >
      {ev.subject}
    </span>
  );
})}
```

- [ ] **Step 5: Update the day header color for school-event-only days**

Find the `hasOnlySchoolEvent` logic that sets `color: "var(--teal)"` on the day label (around line 272). Replace the color with the first event's type color:

```tsx
<span className="cal-cell-num" style={{
  display: "flex",
  justifyContent: "space-between",
  width: "100%",
  alignItems: "center",
  ...(hasOnlySchoolEvent ? {
    color: getEventTypeStyle(dayEvents.find(e => e.type === "event")?.eventType).color
  } : {})
}}>
```

- [ ] **Step 6: Color selected-day drawer cards by event type**

Find the drawer cards (around line 334, the `cal-event-card` div). Replace the school-event style logic:

```tsx
{grouped[selectedDay].map((ev) => {
  const isSchoolEvent = ev.type === "event";
  const ts = isSchoolEvent ? getEventTypeStyle(ev.eventType) : null;
  return (
    <div
      key={ev.sessionId}
      className="cal-event-card"
      style={isSchoolEvent && ts ? { borderLeftColor: ts.color } : undefined}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "6px" }}>
        <h4 className="cal-event-name">{ev.subject}</h4>
        <span style={{
          fontSize: "9px",
          fontWeight: "700",
          padding: "2px 6px",
          borderRadius: "4px",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          background: isSchoolEvent && ts ? ts.bg : "rgba(232, 184, 75, 0.1)",
          color: isSchoolEvent && ts ? ts.color : "var(--gold)",
          border: isSchoolEvent && ts ? `1px solid ${ts.border}` : "1px solid rgba(232, 184, 75, 0.2)",
          flexShrink: 0,
        }}>
          {isSchoolEvent ? (ts?.label ?? "School Event") : "Class Session"}
        </span>
      </div>
      <div className="cal-event-meta-row">
        <span className="cal-event-meta-item">
          <Clock size={12} /> {ev.time}
        </span>
        <span className="cal-event-meta-item">
          <MapPin size={12} /> {isSchoolEvent ? (ev.location || "—") : (studentInfo?.section ?? "—")}
        </span>
      </div>
    </div>
  );
})}
```

- [ ] **Step 7: Color upcoming events cards at the bottom**

Find the `sd-event-card` div in the upcoming events panel at the bottom (around line 387). Add a colored left border and type badge. The card currently shows `event.name`, `check_in_start/end`, `location`. Update the card:

```tsx
{visibleEvents.map((event) => {
  const days = daysUntilEvent(event.date);
  const ts = getEventTypeStyle(event.event_type);
  return (
    <div key={event.id} className="sd-event-card" style={{ borderLeftColor: ts.color }}>
      <div className="sd-event-date-block" style={{ minWidth: "44px" }}>
        <span className="sd-event-month">
          {parseDateLocal(event.date).toLocaleDateString("en-US", { month: "short" })}
        </span>
        <span className="sd-event-day">
          {parseDateLocal(event.date).toLocaleDateString("en-US", { day: "numeric" })}
        </span>
        <span className="sd-event-days-pill" style={{
          fontSize: "9px",
          padding: "2px 5px",
          background: days === 0 ? "rgba(74,222,128,0.15)" : days === 1 ? "rgba(232,184,75,0.15)" : "rgba(255,255,255,0.06)",
          color: days === 0 ? "var(--success)" : days === 1 ? "var(--gold)" : "var(--dimmed)",
          border: days === 0 ? "1px solid rgba(74,222,128,0.25)" : days === 1 ? "1px solid rgba(232,184,75,0.25)" : "1px solid rgba(255,255,255,0.08)",
        }}>
          {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days}d`}
        </span>
      </div>
      <div className="sd-event-detail">
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
          <h3 className="sd-event-name" style={{ fontSize: "13px", margin: 0 }}>{event.name}</h3>
          <span style={{
            fontSize: "9px",
            fontWeight: 700,
            padding: "1px 5px",
            borderRadius: "4px",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            background: ts.bg,
            color: ts.color,
            border: `1px solid ${ts.border}`,
            flexShrink: 0,
          }}>
            {ts.label}
          </span>
        </div>
        <div className="sd-event-meta">
          <span className="sd-event-meta-item">
            <Clock size={11} />
            {new Date(event.check_in_start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            {" – "}
            {new Date(event.check_in_end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          <span className="sd-event-meta-item">
            <MapPin size={11} />
            {event.location}
          </span>
        </div>
      </div>
    </div>
  );
})}
```

- [ ] **Step 8: Commit**

```bash
git add src/app/dashboard/schedule/page.tsx
git commit -m "feat: color-code weekly schedule events by type"
```

---

## Task 7: Color-code the Student Dashboard upcoming events

**Files:**
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Import the helper**

Add at the top of the file with the other imports:

```typescript
import { getEventTypeStyle } from "@/lib/event-type";
```

- [ ] **Step 2: Apply colored border and type badge to each event card**

Find the `sd-event-card` div in the upcoming events section (around line 457). The card currently renders name, time, location. Update it to include the type color and badge:

```tsx
{visibleEvents.map((event) => {
  const days = daysUntilEvent(event.date);
  const ts = getEventTypeStyle(event.event_type);
  return (
    <div key={event.id} className="sd-event-card" style={{ padding: "10px 12px", borderLeftColor: ts.color }}>
      <div className="sd-event-date-block" style={{ minWidth: "44px" }}>
        <span className="sd-event-month">
          {parseDateLocal(event.date).toLocaleDateString("en-US", { month: "short" })}
        </span>
        <span className="sd-event-day">
          {parseDateLocal(event.date).toLocaleDateString("en-US", { day: "numeric" })}
        </span>
        <span className="sd-event-days-pill" style={{
          fontSize: "9px",
          padding: "2px 5px",
          background: days === 0 ? "rgba(74,222,128,0.15)" : days === 1 ? "rgba(232,184,75,0.15)" : "rgba(255,255,255,0.06)",
          color: days === 0 ? "var(--success)" : days === 1 ? "var(--gold)" : "var(--dimmed)",
          border: days === 0 ? "1px solid rgba(74,222,128,0.25)" : days === 1 ? "1px solid rgba(232,184,75,0.25)" : "1px solid rgba(255,255,255,0.08)",
        }}>
          {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days}d`}
        </span>
      </div>
      <div className="sd-event-detail">
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
          <h3 className="sd-event-name" style={{ fontSize: "13px", margin: 0 }}>{event.name}</h3>
          <span style={{
            fontSize: "9px",
            fontWeight: 700,
            padding: "1px 5px",
            borderRadius: "4px",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            background: ts.bg,
            color: ts.color,
            border: `1px solid ${ts.border}`,
            flexShrink: 0,
          }}>
            {ts.label}
          </span>
        </div>
        <div className="sd-event-meta">
          <span className="sd-event-meta-item">
            <Clock size={11} />
            {new Date(event.check_in_start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            {" – "}
            {new Date(event.check_in_end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          <span className="sd-event-meta-item">
            <MapPin size={11} />
            {event.location}
          </span>
        </div>
      </div>
    </div>
  );
})}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: color-code student dashboard event cards by type"
```

---

## Self-Review

- Spec: type selector in modal → Task 4 Steps 7 ✓
- Spec: gold/red/purple colors → Task 1 (helper) used by all views ✓
- Spec: color calendar → Task 5 ✓
- Spec: color weekly view → Task 6 ✓
- Spec: color dashboard → Task 7 ✓
- Spec: DB column → Task 2 ✓
- Spec: API stores type → Task 3 ✓
- `getEventTypeStyle` defined in Task 1, imported in Tasks 4–7 ✓
- `EventType`, `EVENT_TYPES` defined in Task 1, used in Task 4 ✓
- `eventType` state initialized in Task 4 Step 2, reset Step 3, populated on edit Step 4 ✓
- `SessionBlock.eventType` added in Task 6 Step 2, populated Step 3, read in Steps 4–7 ✓
- No placeholders or TBDs found ✓
