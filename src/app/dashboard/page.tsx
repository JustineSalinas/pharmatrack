"use client";

import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Activity,
  CheckCircle,
  Clock,
  AlertCircle,
  Download,
  Maximize2,
  Calendar,
  ClipboardList,
  ChevronRight,
  MapPin,
  TrendingUp,
  Award,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { getCurrentUser, ensureStudentProfile } from "@/lib/auth-client";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import type { AttendanceSummary, PharmaUser, StudentProfile, Event } from "@/lib/schema";

export default function StudentDashboard() {
  const [user, setUser] = useState<(PharmaUser & { student_profiles: StudentProfile | null }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AttendanceSummary | null>(null);
  const [upcomingEvent, setUpcomingEvent] = useState<Event | null>(null);
  const [isRepairing, setIsRepairing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function loadDashboard() {
      try {
        const u = await getCurrentUser();
        if (!u) {
          router.push("/login");
          return;
        }
        if (u.account_type === "admin") { router.push("/dashboard/admin"); return; }
        if (u.account_type === "facilitator") { router.push("/dashboard/facilitator"); return; }
        setUser(u);

        if (u.account_type === "student") {
          const { data } = await supabase
            .from("student_attendance_summary")
            .select("*")
            .eq("student_id", u.id)
            .single();
          setStats(data);

          const today = new Date().toISOString().split("T")[0];
          const { data: upcoming } = await supabase
            .from("events")
            .select("*")
            .gte("date", today)
            .order("date", { ascending: true })
            .limit(1)
            .single();

          if (upcoming) setUpcomingEvent(upcoming);
        }
      } catch (err) {
        console.error("Error loading student dashboard", err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, [router]);

  async function handleRepairQR() {
    if (!user || user.account_type !== "student") return;
    try {
      setIsRepairing(true);
      const studentId = prompt("Please confirm your Student ID Number (e.g. USA-2026-XXXX):");
      if (!studentId) return;
      const year = prompt("Enter your Year Level (e.g. 1st Year):");
      const section = prompt("Enter your Section (e.g. PH 1A):");
      await ensureStudentProfile(user.id, {
        student_id_number: studentId,
        year: year || "Unknown",
        section: section || "Unknown",
      } as any);
      window.location.reload();
    } catch (err: any) {
      alert("Repair failed: " + err.message);
    } finally {
      setIsRepairing(false);
    }
  }

  if (loading) return null;

  const isStudent = user?.account_type === "student";
  const studentProfile = user?.student_profiles ?? null;
  const qrCodeValue = studentProfile?.qr_code_id || "NOT-FOUND";
  const attendanceRate = stats?.attendance_rate ?? 0;
  const firstName = user?.full_name?.split(" ")[0] ?? "Student";

  // Standing logic
  const getStanding = (rate: number) => {
    if (rate >= 90) return { label: "Excellent Standing", color: "var(--success)", icon: <Award size={13} /> };
    if (rate >= 75) return { label: "Good Standing", color: "var(--teal)", icon: <CheckCircle size={13} /> };
    if (rate >= 60) return { label: "At Risk", color: "var(--gold)", icon: <AlertCircle size={13} /> };
    return { label: "Poor Standing", color: "var(--danger)", icon: <AlertCircle size={13} /> };
  };
  const standing = getStanding(attendanceRate);

  // Donut circle params
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (attendanceRate / 100) * circumference;

  // Compute days until event
  const daysUntil = upcomingEvent
    ? Math.ceil((new Date(upcomingEvent.date).getTime() - new Date().setHours(0,0,0,0)) / 86400000)
    : null;

  return (
    <div className="fade-in sd-root">

      {/* ── PAGE HEADER ─────────────────────────────────────────── */}
      <header className="sd-header">
        <div>
          <p className="sd-header-eyebrow">{isStudent ? "Student Portal" : "Facilitator Portal"}</p>
          <h1 className="sd-header-title">Good {getGreeting()}, <span className="sd-header-name">{firstName}</span> 👋</h1>
        </div>
        <div className="sd-header-date">
          <Calendar size={13} />
          {new Date().toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric" })}
        </div>
      </header>

      {/* ── TOP ROW: Attendance Overview + Stat Trio ────────────── */}
      <div className="sd-top-row">

        {/* LEFT: Big Attendance Overview */}
        <div className="sd-overview-card">
          <div className="sd-overview-ring-wrap">
            <svg className="sd-donut" viewBox="0 0 140 140" width="140" height="140">
              {/* Track */}
              <circle cx="70" cy="70" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
              {/* Progress */}
              <circle
                cx="70" cy="70" r={radius}
                fill="none"
                stroke="var(--gold)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                transform="rotate(-90 70 70)"
                style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)" }}
              />
            </svg>
            <div className="sd-donut-center">
              <span className="sd-donut-rate">{attendanceRate}%</span>
              <span className="sd-donut-lbl">attendance</span>
            </div>
          </div>

          <div className="sd-overview-info">
            <div className="sd-overview-label">
              <Activity size={14} color="var(--gold)" />
              Overall Attendance Rate
            </div>
            <div className="sd-standing-badge" style={{ color: standing.color, borderColor: standing.color, background: `${standing.color}18` }}>
              {standing.icon}
              {standing.label}
            </div>
            <p className="sd-overview-sub">
              {stats?.total_records
                ? `Based on ${stats.total_records} recorded session${stats.total_records > 1 ? "s" : ""}`
                : "No sessions recorded yet."}
            </p>
          </div>
        </div>

        {/* RIGHT: 3 Stat Tiles */}
        <div className="sd-stat-tiles">
          <div className="sd-stat-tile sd-tile-present">
            <div className="sd-tile-icon-wrap" style={{ background: "rgba(74,222,128,0.12)", color: "var(--success)" }}>
              <CheckCircle size={18} />
            </div>
            <div className="sd-tile-number">{stats?.present_count ?? 0}</div>
            <div className="sd-tile-label">Present</div>
            <div className="sd-tile-bar">
              <div className="sd-tile-bar-fill" style={{ width: `${stats?.total_records ? (stats.present_count / stats.total_records) * 100 : 0}%`, background: "var(--success)" }} />
            </div>
          </div>

          <div className="sd-stat-tile sd-tile-late">
            <div className="sd-tile-icon-wrap" style={{ background: "rgba(232,184,75,0.12)", color: "var(--gold)" }}>
              <Clock size={18} />
            </div>
            <div className="sd-tile-number">{stats?.late_count ?? 0}</div>
            <div className="sd-tile-label">Late</div>
            <div className="sd-tile-bar">
              <div className="sd-tile-bar-fill" style={{ width: `${stats?.total_records ? (stats.late_count / stats.total_records) * 100 : 0}%`, background: "var(--gold)" }} />
            </div>
          </div>

          <div className="sd-stat-tile sd-tile-absent">
            <div className="sd-tile-icon-wrap" style={{ background: "rgba(248,113,113,0.12)", color: "var(--danger)" }}>
              <AlertCircle size={18} />
            </div>
            <div className="sd-tile-number">{stats?.absent_count ?? 0}</div>
            <div className="sd-tile-label">Absent</div>
            <div className="sd-tile-bar">
              <div className="sd-tile-bar-fill" style={{ width: `${stats?.total_records ? (stats.absent_count / stats.total_records) * 100 : 0}%`, background: "var(--danger)" }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM ROW: QR Card + Upcoming Event + Quick Actions ─── */}
      <div className="sd-bottom-row">

        {/* COL A: QR Access Pass */}
        <div className="sd-qr-panel">
          <div className="sd-qr-panel-header">
            <div>
              <p className="sd-panel-label">Access Pass</p>
              <h2 className="sd-panel-title">Student ID</h2>
            </div>
            <div className="sd-qr-status-dot" title="QR Active" />
          </div>

          <div className="sd-qr-body">
            {qrCodeValue === "NOT-FOUND" ? (
              <div className="sd-qr-error">
                <AlertCircle color="var(--danger)" size={32} />
                <p className="sd-qr-error-title">ID Data Missing</p>
                <p className="sd-qr-error-sub">Your QR code could not be generated.</p>
                <button className="sd-repair-btn" onClick={handleRepairQR} disabled={isRepairing}>
                  {isRepairing ? "Repairing…" : "Repair QR Code"}
                </button>
              </div>
            ) : (
              <>
                <div className="sd-qr-code-wrap">
                  <QRCodeSVG value={qrCodeValue} size={160} level="H" includeMargin={false} />
                </div>
                <p className="sd-qr-id">{qrCodeValue}</p>
                <p className="sd-qr-hint">Present to any Council Member for scanning</p>
              </>
            )}
          </div>

          <div className="sd-qr-footer">
            <Link href="/check-in" className="sd-present-btn">
              <Maximize2 size={14} />
              Open Full-Screen
            </Link>
          </div>
        </div>

        {/* COL B: Upcoming Event + Quick Links */}
        <div className="sd-right-col">

          {/* Upcoming Event */}
          <div className="sd-event-panel">
            <div className="sd-event-panel-header">
              <div>
                <p className="sd-panel-label">Up Next</p>
                <h2 className="sd-panel-title">Upcoming Activity</h2>
              </div>
              <Link href="/dashboard/schedule" className="sd-see-all">
                See all <ChevronRight size={13} />
              </Link>
            </div>

            {upcomingEvent ? (
              <div className="sd-event-card">
                <div className="sd-event-date-block">
                  <span className="sd-event-month">
                    {new Date(upcomingEvent.date).toLocaleDateString("en-US", { month: "short" })}
                  </span>
                  <span className="sd-event-day">
                    {new Date(upcomingEvent.date).toLocaleDateString("en-US", { day: "numeric" })}
                  </span>
                  {daysUntil !== null && (
                    <span className="sd-event-days-pill">
                      {daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `In ${daysUntil}d`}
                    </span>
                  )}
                </div>
                <div className="sd-event-detail">
                  <h3 className="sd-event-name">{upcomingEvent.name}</h3>
                  <div className="sd-event-meta">
                    <span className="sd-event-meta-item">
                      <Clock size={12} />
                      {new Date(upcomingEvent.check_in_start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {" – "}
                      {new Date(upcomingEvent.check_in_end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="sd-event-meta-item">
                      <MapPin size={12} />
                      {upcomingEvent.location}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="sd-event-empty">
                <Calendar size={28} color="var(--dimmed)" />
                <p>No upcoming events right now.</p>
                <span>Check back later or enjoy your free time!</span>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="sd-quick-links">
            <p className="sd-panel-label" style={{ marginBottom: 10 }}>Quick Actions</p>
            <div className="sd-quick-grid">
              <Link href="/check-in" className="sd-quick-card">
                <div className="sd-quick-icon" style={{ background: "rgba(45,212,191,0.12)", color: "var(--teal)" }}>
                  <Zap size={16} />
                </div>
                <span className="sd-quick-label">Check In</span>
                <ChevronRight size={14} className="sd-quick-arrow" />
              </Link>
              <Link href="/dashboard/records" className="sd-quick-card">
                <div className="sd-quick-icon" style={{ background: "rgba(232,184,75,0.12)", color: "var(--gold)" }}>
                  <ClipboardList size={16} />
                </div>
                <span className="sd-quick-label">My Records</span>
                <ChevronRight size={14} className="sd-quick-arrow" />
              </Link>
              <Link href="/dashboard/schedule" className="sd-quick-card">
                <div className="sd-quick-icon" style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa" }}>
                  <Calendar size={16} />
                </div>
                <span className="sd-quick-label">Schedule</span>
                <ChevronRight size={14} className="sd-quick-arrow" />
              </Link>
              <Link href="/dashboard/records" className="sd-quick-card">
                <div className="sd-quick-icon" style={{ background: "rgba(74,222,128,0.12)", color: "var(--success)" }}>
                  <TrendingUp size={16} />
                </div>
                <span className="sd-quick-label">Progress</span>
                <ChevronRight size={14} className="sd-quick-arrow" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}
