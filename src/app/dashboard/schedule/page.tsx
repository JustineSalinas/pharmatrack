"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-client";
import { supabase, parseDateLocal } from "@/lib/supabase";
import {
  Loader2, Calendar, AlertTriangle, Clock, MapPin, X, ChevronRight,
} from "lucide-react";
import type { StudentProfile, PharmaUser, Event } from "@/lib/schema";
import { getEventTypeStyle } from "@/lib/event-type";

interface QRSessionRow {
  id: string;
  subject: string;
  section: string;
  date: string;
  expires_at: string;
  created_at: string;
}
type DayKey = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";
const DAY_LABELS: DayKey[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];
const DAY_INDEX_MAP: Record<number, DayKey> = { 1: "MON", 2: "TUE", 3: "WED", 4: "THU", 5: "FRI", 6: "SAT", 0: "SUN" };

interface SessionBlock {
  sessionId: string;
  subject: string;
  time: string;
  type: "session" | "event";
  location?: string;
  sortTime: number;
  eventType?: string;
}

function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  catch { return iso; }
}

export default function SchedulePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [grouped, setGrouped] = useState<Record<DayKey, SessionBlock[]>>({} as Record<DayKey, SessionBlock[]>);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [studentInfo, setStudentInfo] = useState<{ section: string; current_year: string } | null>(null);
  const [dates, setDates] = useState<Record<DayKey, string>>({} as Record<DayKey, string>);
  const [weekRange, setWeekRange] = useState("");
  const [selectedDay, setSelectedDay] = useState<DayKey | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const EVENTS_PREVIEW = 4;
  const [startOfWeekDate, setStartOfWeekDate] = useState<Date>(new Date());

  useEffect(() => {
    async function load() {
      try {
        const u = await getCurrentUser();
        if (!u) { router.push("/login"); return; }
        if (u.account_type !== "student") { router.push("/dashboard"); return; }
        const profile = (u as PharmaUser & { student_profiles: StudentProfile | null }).student_profiles;
        if (!profile) { setGrouped({} as Record<DayKey, SessionBlock[]>); setLoading(false); return; }
        setStudentInfo({ section: profile.section, current_year: profile.current_year });

        // Compute active events of the current week (Monday to Sunday)
        const now = new Date();
        const dayOfWeek = now.getDay();
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() + diffToMonday);
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        setStartOfWeekDate(startOfWeek);

        // Format week range text
        const startStr = startOfWeek.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const endStr = endOfWeek.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        setWeekRange(`${startStr} – ${endStr}`);

        // Compute actual dates for MON–SAT
        const start = new Date(startOfWeek);
        const dayDatesMap: Record<DayKey, string> = {} as Record<DayKey, string>;
        const DAY_KEYS: DayKey[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];
        for (let i = 0; i < 6; i++) {
          const d = new Date(start);
          d.setDate(start.getDate() + i);
          dayDatesMap[DAY_KEYS[i]] = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        }
        setDates(dayDatesMap);

        // Fetch student schedule (QR sessions)
        const { data: raw, error: err } = await supabase
          .from("student_schedule")
          .select("id, subject, section, date, expires_at, created_at")
          .eq("section", profile.section)
          .order("date", { ascending: true });
        if (err) { setError("Failed to load events. Please try again."); return; }
        const sessions = (raw as unknown as QRSessionRow[]) ?? [];

        // Fetch school events starting from beginning of the current week
        const startOfWeekStr = `${startOfWeek.getFullYear()}-${String(startOfWeek.getMonth() + 1).padStart(2, "0")}-${String(startOfWeek.getDate()).padStart(2, "0")}`;
        const { data: eventsData, error: eventsErr } = await supabase
          .from("events")
          .select("*")
          .gte("date", startOfWeekStr)
          .order("date", { ascending: true })
          .limit(40);
        if (eventsErr) { setError("Failed to load school events. Please try again."); return; }

        const byDay: Record<DayKey, SessionBlock[]> = { MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [], SUN: [] } as Record<DayKey, SessionBlock[]>;
        const subjectSet = new Set<string>();

        // 1. Process QR Sessions
        for (const s of sessions) {
          const [y, m, d] = (s.date as string).split("-").map(Number);
          const date = new Date(y, m - 1, d);

          // Filter only for current week events
          if (date < startOfWeek || date > endOfWeek) continue;

          const key = DAY_INDEX_MAP[date.getDay()];
          if (!key || !DAY_LABELS.includes(key)) continue;

          subjectSet.add(s.subject);

          let sortTime = 0;
          try { sortTime = new Date(s.expires_at).getTime(); } catch {}

          byDay[key].push({
            sessionId: s.id,
            subject: s.subject,
            time: fmtTime(s.expires_at),
            type: "session",
            sortTime
          });
        }

        // 2. Process School Events
        const eventsList = eventsData ?? [];
        for (const ev of eventsList) {
          const [y, m, d] = (ev.date as string).split("-").map(Number);
          const date = new Date(y, m - 1, d);

          // Filter only for current week events
          if (date < startOfWeek || date > endOfWeek) continue;

          const key = DAY_INDEX_MAP[date.getDay()];
          if (!key || !DAY_LABELS.includes(key)) continue;

          const checkInStart = new Date(ev.check_in_start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          const checkInEnd = new Date(ev.check_in_end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          const timeRange = `${checkInStart} – ${checkInEnd}`;

          let sortTime = 0;
          try { sortTime = new Date(ev.check_in_start).getTime(); } catch {}

          byDay[key].push({
            sessionId: ev.id,
            subject: ev.name,
            time: timeRange,
            type: "event",
            location: ev.location,
            sortTime,
            eventType: ev.event_type ?? "Department",
          });
        }

        // 3. Sort each day's events by time
        for (const key of DAY_LABELS) {
          byDay[key].sort((a, b) => a.sortTime - b.sortTime);
        }

        setGrouped(byDay);
        setSubjects(Array.from(subjectSet));

        // 4. Update upcoming school events for the bottom panel (today & onwards)
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        const upcoming = eventsList.filter(ev => ev.date >= todayStr).slice(0, 20);
        setUpcomingEvents(upcoming);

        // Default select today
        const todayDayKey = DAY_INDEX_MAP[now.getDay()];
        const defaultSelected = (todayDayKey && DAY_LABELS.includes(todayDayKey)) ? todayDayKey : "MON";
        setSelectedDay(defaultSelected);
      } catch (e) {
        setError("An unexpected error occurred.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  const hasAny = DAY_LABELS.some((d) => (grouped[d]?.length ?? 0) > 0);
  const today = DAY_INDEX_MAP[new Date().getDay()];

  function getFullDateString(dayKey: DayKey) {
    const dayIndex = DAY_LABELS.indexOf(dayKey);
    if (dayIndex === -1) return dayKey;
    const d = new Date(startOfWeekDate);
    d.setDate(startOfWeekDate.getDate() + dayIndex);
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }

  function daysUntilEvent(dateStr: string): number {
    return Math.ceil(
      (parseDateLocal(dateStr).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000
    );
  }

  const visibleEvents = showAllEvents ? upcomingEvents : upcomingEvents.slice(0, EVENTS_PREVIEW);

  if (loading) return <div className="sp-center-screen"><Loader2 className="sp-spinner" size={36} /></div>;

  return (
    <div className="fade-in sd-root">
      {/* ── Header ── */}
      <header className="sd-header">
        <div>
          <p className="sd-header-eyebrow">Student · Events</p>
          <h1 className="sd-header-title">Weekly Event Schedule</h1>
          {studentInfo && (
            <p className="sp-sched-subtitle" style={{ fontSize: "14px", color: "var(--gold)", marginTop: "4px", fontWeight: "600" }}>
              {studentInfo.section} · {studentInfo.current_year} <span style={{ color: "var(--dimmed)", fontWeight: "normal", margin: "0 8px" }}>|</span> <span style={{ color: "var(--white-shade)" }}>Week: {weekRange}</span>
            </p>
          )}
        </div>
        <div className="sd-header-date">
          <Calendar size={13} />
          {new Date().toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric" })}
        </div>
      </header>

      {error && (
        <div className="sp-error-banner">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* ── Weekly Grid ── */}
      <div className="cal-grid-panel" style={{ marginTop: "24px" }}>
        {!hasAny ? (
          <div className="sp-empty-state" style={{ padding: "60px 20px" }}>
            <Calendar size={48} color="var(--gold)" style={{ opacity: 0.8, marginBottom: "16px" }} />
            <p style={{ fontSize: "16px", fontWeight: "700", color: "var(--white)" }}>No active events scheduled for your section this week</p>
            <span style={{ fontSize: "13px", color: "var(--dimmed)", marginTop: "6px" }}>Check back later once events are created by your facilitator.</span>
          </div>
        ) : (
          <div className="cal-grid" style={{ gridTemplateColumns: `repeat(${DAY_LABELS.length}, 1fr)` }}>
            {DAY_LABELS.map((day) => {
              const isToday = day === today;
              const isSelected = selectedDay === day;
              const dayEvents = grouped[day] ?? [];
              const hasOnlySchoolEvent = dayEvents.length > 0 && dayEvents.every((ev) => ev.type === "event");
              return (
                <button
                  key={day}
                  type="button"
                  className={[
                    "cal-cell",
                    isToday ? "today" : "",
                    isSelected ? "selected" : "",
                    dayEvents.length > 0 ? "has-events" : "",
                  ].filter(Boolean).join(" ")}
                  onClick={() => setSelectedDay(day)}
                >
                  <span className="cal-cell-num" style={{
                    display: "flex",
                    justifyContent: "space-between",
                    width: "100%",
                    alignItems: "center",
                    ...(hasOnlySchoolEvent ? {
                      color: getEventTypeStyle(dayEvents.find(e => e.type === "event")?.eventType).color
                    } : {})
                  }}>
                    <span style={{ fontSize: "12px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.05em" }}>{day}</span>
                    <span style={{ fontSize: "11px", color: isToday ? "rgba(232, 184, 75, 0.8)" : "var(--dimmed)", fontWeight: isToday ? "600" : "normal" }}>{dates[day]}</span>
                  </span>
                  {dayEvents.length > 0 && (
                    <span className="cal-cell-events" style={{ marginTop: "4px", width: "100%" }}>
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
                      {dayEvents.length > 2 && (
                        <span className="cal-cell-more">+{dayEvents.length - 2} more</span>
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Day Details (Drawer) */}
      {selectedDay && (
        <div className="cal-drawer" style={{ marginTop: "24px" }}>
          <div className="cal-drawer-header">
            <div>
              <p className="sd-panel-label">Selected Day</p>
              <h3 className="cal-drawer-title">
                {getFullDateString(selectedDay)}
              </h3>
            </div>
            <button className="cal-drawer-close" onClick={() => setSelectedDay(null)} aria-label="Close">
              <X size={16} />
            </button>
          </div>

          {(!grouped[selectedDay] || grouped[selectedDay].length === 0) ? (
            <div className="cal-drawer-empty">
              <Calendar size={22} color="var(--dimmed)" />
              <p>No events scheduled for this day.</p>
            </div>
          ) : (
            <div className="cal-drawer-list">
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
            </div>
          )}
        </div>
      )}

      {/* ── Upcoming School Events ── */}
      <div className="sd-event-panel" style={{ marginTop: "32px" }}>
        <div className="sd-event-panel-header">
          <div>
            <p className="sd-panel-label">School Events</p>
            <h2 className="sd-panel-title">Upcoming &amp; Future Events</h2>
          </div>
        </div>

        {upcomingEvents.length > 0 ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
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
                        padding: "2px 8px",
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
            </div>

            {upcomingEvents.length > EVENTS_PREVIEW && (
              <button
                type="button"
                onClick={() => setShowAllEvents(!showAllEvents)}
                style={{
                  marginTop: "16px",
                  width: "100%",
                  padding: "10px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--gold)",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(232,184,75,0.06)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
              >
                {showAllEvents ? (
                  <><ChevronRight size={14} style={{ transform: "rotate(-90deg)" }} /> Show Less</>
                ) : (
                  <><ChevronRight size={14} style={{ transform: "rotate(90deg)" }} /> See {upcomingEvents.length - EVENTS_PREVIEW} More Event{upcomingEvents.length - EVENTS_PREVIEW > 1 ? "s" : ""}</>
                )}
              </button>
            )}
          </>
        ) : (
          <div className="sd-event-empty">
            <Calendar size={28} color="var(--dimmed)" />
            <p>No upcoming school events right now.</p>
            <span>Check back later or enjoy your free time!</span>
          </div>
        )}
      </div>
    </div>
  );
}
