"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-client";
import { supabase } from "@/lib/supabase";
import { Loader2, Calendar, BookOpen, AlertTriangle } from "lucide-react";
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
const DAY_LABELS: DayKey[] = ["MON", "TUE", "WED", "THU", "FRI"];
const DAY_INDEX_MAP: Record<number, DayKey> = { 1: "MON", 2: "TUE", 3: "WED", 4: "THU", 5: "FRI", 6: "SAT", 0: "SUN" };

const PALETTE = [
  { bg: "rgba(232,184,75,0.12)", border: "rgba(232,184,75,0.3)", dot: "var(--gold)", text: "var(--gold)" },
  { bg: "rgba(45,212,191,0.12)", border: "rgba(45,212,191,0.3)", dot: "var(--teal)", text: "var(--teal)" },
  { bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.3)", dot: "#a78bfa", text: "#a78bfa" },
  { bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.3)", dot: "#f97316", text: "#f97316" },
  { bg: "rgba(248,113,113,0.10)", border: "rgba(248,113,113,0.25)", dot: "var(--danger)", text: "var(--danger)" },
  { bg: "rgba(74,222,128,0.10)", border: "rgba(74,222,128,0.25)", dot: "var(--success)", text: "var(--success)" },
];

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
          .from("qr_sessions")
          .select("id, subject, section, date, expires_at, created_at")
          .eq("section", profile.section)
          .order("date", { ascending: true });
        if (err) { setError("Failed to load schedule. Please try again."); return; }
        const sessions = (raw as unknown as QRSessionRow[]) ?? [];
        const byDay: Record<DayKey, SessionBlock[]> = { MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [], SUN: [] };
        const subjectSet = new Set<string>();
        for (const s of sessions) {
          const [y, m, d] = (s.date as string).split("-").map(Number);
          const date = new Date(y, m - 1, d);
          const key = DAY_INDEX_MAP[date.getDay()];
          if (!key || !DAY_LABELS.includes(key)) continue;
          subjectSet.add(s.subject);
          byDay[key].push({ subject: s.subject, time: fmtTime(s.expires_at), sessionId: s.id });
        }
        const deduped: Record<DayKey, SessionBlock[]> = {} as Record<DayKey, SessionBlock[]>;
        for (const k of DAY_LABELS) {
          const seen = new Set<string>();
          deduped[k] = byDay[k].filter((b) => { if (seen.has(b.subject)) return false; seen.add(b.subject); return true; });
        }
        setGrouped(deduped);
        setSubjects(Array.from(subjectSet));
      } catch (e) {
        setError("An unexpected error occurred.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  const colorMap: Record<string, typeof PALETTE[number]> = {};
  subjects.forEach((s, i) => { colorMap[s] = PALETTE[i % PALETTE.length]; });
  const hasAny = DAY_LABELS.some((d) => (grouped[d]?.length ?? 0) > 0);
  const today = DAY_INDEX_MAP[new Date().getDay()];

  if (loading) return <div className="sp-center-screen"><Loader2 className="sp-spinner" size={36} /></div>;

  return (
    <div className="fade-in sd-root">
      {/* ── Header ── */}
      <header className="sd-header">
        <div>
          <p className="sd-header-eyebrow">Student · Schedule</p>
          <h1 className="sd-header-title">Class Schedule</h1>
          {studentInfo && (
            <p className="sp-sched-subtitle">{studentInfo.section} · {studentInfo.current_year}</p>
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

      {/* ── Legend ── */}
      {subjects.length > 0 && (
        <div className="sp-legend-row">
          {subjects.map((s) => (
            <div key={s} className="sp-legend-item">
              <div className="sp-legend-dot" style={{ background: colorMap[s]?.dot }} />
              <span>{s}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Weekly Grid ── */}
      <div className="sp-sched-grid-panel">
        {!hasAny ? (
          <div className="sp-empty-state">
            <Calendar size={32} color="var(--dimmed)" />
            <p>No scheduled sessions found for your section.</p>
            <span>Check back later once sessions are created by your facilitator.</span>
          </div>
        ) : (
          <div className="sp-weekly-grid" style={{ gridTemplateColumns: `repeat(${DAY_LABELS.length}, 1fr)` }}>
            {DAY_LABELS.map((day) => {
              const isToday = day === today;
              const hasSessions = (grouped[day]?.length ?? 0) > 0;
              return (
                <div key={day} className={`sp-day-col ${isToday ? "sp-today" : ""}`}>
                  <div className="sp-day-header">
                    <span className="sp-day-label" style={{ color: hasSessions ? (isToday ? "var(--gold)" : "var(--white-shade)") : "var(--dimmed)" }}>
                      {day}
                    </span>
                    {isToday && <span className="sp-today-pill">Today</span>}
                  </div>
                  <div className="sp-day-body">
                    {(grouped[day] ?? []).map((cls) => {
                      const c = colorMap[cls.subject] ?? PALETTE[0];
                      return (
                        <div
                          key={cls.sessionId}
                          className="sp-class-block"
                          style={{ background: c.bg, borderColor: c.border }}
                        >
                          <div className="sp-class-dot" style={{ background: c.dot }} />
                          <div>
                            <div className="sp-class-name">{cls.subject}</div>
                            <div className="sp-class-time">{cls.time}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Subject Details ── */}
      {subjects.length > 0 && (
        <div className="sp-subject-panel">
          <div className="sp-subject-panel-header">
            <BookOpen size={15} color="var(--gold)" />
            <h2 className="sp-subject-panel-title">Subject Details</h2>
          </div>
          <div className="sp-subject-list">
            {subjects.map((sub) => {
              const days = DAY_LABELS.filter((d) => (grouped[d] ?? []).some((b) => b.subject === sub));
              const c = colorMap[sub] ?? PALETTE[0];
              return (
                <div key={sub} className="sp-subject-row">
                  <div className="sp-subject-color-bar" style={{ background: c.dot }} />
                  <div className="sp-subject-info">
                    <span className="sp-subject-name">{sub}</span>
                    <span className="sp-subject-section">{studentInfo?.section ?? "—"}</span>
                  </div>
                  <div className="sp-subject-days">
                    {days.map((d) => (
                      <span key={d} className="sp-day-tag" style={{ background: c.bg, borderColor: c.border, color: c.text }}>{d}</span>
                    ))}
                    {days.length === 0 && <span className="sp-day-tag-empty">—</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
