"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-client";
import { supabase } from "@/lib/supabase";
import {
  Loader2, Calendar, AlertTriangle, Clock, MapPin, X,
} from "lucide-react";
import type { StudentProfile, PharmaUser } from "@/lib/schema";

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

interface SessionBlock { subject: string; time: string; sessionId: string; }

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
        const { data: raw, error: err } = await supabase
          .from("student_schedule")
          .select("id, subject, section, date, expires_at, created_at")
          .eq("section", profile.section)
          .order("date", { ascending: true });
        if (err) { setError("Failed to load events. Please try again."); return; }
        const sessions = (raw as unknown as QRSessionRow[]) ?? [];
        
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

        // Compute actual dates for MON–SUN
        const start = new Date(startOfWeek);
        const dayDatesMap: Record<DayKey, string> = {} as Record<DayKey, string>;
        const DAY_KEYS: DayKey[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
        for (let i = 0; i < 7; i++) {
          const d = new Date(start);
          d.setDate(start.getDate() + i);
          dayDatesMap[DAY_KEYS[i]] = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        }
        setDates(dayDatesMap);

        const byDay: Record<DayKey, SessionBlock[]> = { MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [], SUN: [] };
        const subjectSet = new Set<string>();
        for (const s of sessions) {
          const [y, m, d] = (s.date as string).split("-").map(Number);
          const date = new Date(y, m - 1, d);

          // Filter only for current week events
          if (date < startOfWeek || date > endOfWeek) continue;

          const key = DAY_INDEX_MAP[date.getDay()];
          if (!key || !DAY_LABELS.includes(key)) continue;

          subjectSet.add(s.subject);
          byDay[key].push({ subject: s.subject, time: fmtTime(s.expires_at), sessionId: s.id });
        }
        setGrouped(byDay);
        setSubjects(Array.from(subjectSet));

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
                  <span className="cal-cell-num" style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                    <span style={{ fontSize: "12px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.05em" }}>{day}</span>
                    <span style={{ fontSize: "11px", color: isToday ? "rgba(232, 184, 75, 0.8)" : "var(--dimmed)", fontWeight: isToday ? "600" : "normal" }}>{dates[day]}</span>
                  </span>
                  {dayEvents.length > 0 && (
                    <span className="cal-cell-events" style={{ marginTop: "4px", width: "100%" }}>
                      {dayEvents.slice(0, 2).map((ev) => (
                        <span key={ev.sessionId} className="cal-cell-event-pill" title={ev.subject}>
                          {ev.subject}
                        </span>
                      ))}
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
              {grouped[selectedDay].map((ev) => (
                <div key={ev.sessionId} className="cal-event-card">
                  <h4 className="cal-event-name">{ev.subject}</h4>
                  <div className="cal-event-meta-row">
                    <span className="cal-event-meta-item">
                      <Clock size={12} /> {ev.time}
                    </span>
                    <span className="cal-event-meta-item">
                      <MapPin size={12} /> {studentInfo?.section ?? "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
