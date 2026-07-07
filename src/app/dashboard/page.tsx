"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { downloadQRPng } from "@/lib/downloadQR";
import {
  Activity,
  CheckCircle,
  Clock,
  AlertCircle,
  Download as DownloadIcon,
  Maximize2,
  Calendar,
  ClipboardList,
  ChevronRight,
  MapPin,
  TrendingUp,
  Award,
  Zap,
  X,
  Info,
  History,
} from "lucide-react";


const SECTIONS_BY_YEAR: Record<string, string[]> = {
  "1st Year": ["PH 1A", "PH 1B", "PH 1C", "PH 1D", "PH 1E", "PH 1F"],
  "2nd Year": ["PH 2A", "PH 2B", "PH 2C", "PH 2D"],
  "3rd Year": ["PH 3A", "PH 3B", "PH 3C", "PH 3D", "PH 3E"],
  "4th Year": ["PH 4A", "PH 4B", "PH 4C", "PH 4D"],
};
import Link from "next/link";
import { getCurrentUser, ensureStudentProfile } from "@/lib/auth-client";
import { supabase, parseDateLocal } from "@/lib/supabase";
import { debounce } from "@/lib/debounce";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import type { AttendanceSummary, PharmaUser, StudentProfile, Event } from "@/lib/schema";
import { getEventTypeStyle } from "@/lib/event-type";

function StudentDashboardContent() {
  const searchParams = useSearchParams();
  const [user, setUser] = useState<(PharmaUser & { student_profiles: StudentProfile | null }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AttendanceSummary | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const EVENTS_PREVIEW = 4;
  const [isRepairing, setIsRepairing] = useState(false);
  const qrWrapRef = useRef<HTMLDivElement>(null);
  const [showRepairModal, setShowRepairModal] = useState(false);
  const [repairStudentId, setRepairStudentId] = useState("");
  const [repairYear, setRepairYear] = useState("");
  const [repairSection, setRepairSection] = useState("");
  const [repairError, setRepairError] = useState("");
  const router = useRouter();

  // Check-In Modal state — students can only present their QR ID.
  // Scanning is restricted to Facilitators only.
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const modalQrWrapRef = useRef<HTMLDivElement>(null);

  // Fetch only the attendance stats (used on initial load and realtime refresh)
  const fetchStats = useCallback(async (studentId: string) => {
    const { data } = await supabase
      .rpc("get_student_attendance_summary")
      .eq("student_id", studentId)
      .single();
    setStats(data as AttendanceSummary | null);
  }, []);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const u = await getCurrentUser();
        if (!u) {
          const isCheckin = searchParams.get("checkin") === "true";
          router.push(isCheckin ? "/login?redirect=checkin" : "/login");
          return;
        }
        if (u.account_type === "admin") { router.push("/dashboard/admin"); return; }
        if (u.account_type === "facilitator") { router.push("/dashboard/facilitator"); return; }
        setUser(u);

        if (u.account_type === "student") {
          await fetchStats(u.id);

          // Use local date (not UTC) so that the filter matches correctly in
          // Asia/Manila (UTC+8). new Date().toISOString() returns the UTC date,
          // which can be one day behind local time and exclude today's events.
          const now = new Date();
          const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
          const { data: upcoming } = await supabase
            .from("events")
            .select("*")
            .gte("date", today)
            .order("date", { ascending: true })
            .limit(20);

          if (upcoming) {
            const studentYear = u.student_profiles?.current_year ?? null;
            const filtered = upcoming.filter(ev => {
              if (!ev.target_year_levels || ev.target_year_levels.length === 0) return true;
              if (!studentYear) return true;
              return ev.target_year_levels.includes(studentYear);
            });
            setUpcomingEvents(filtered);
          }
        }
      } catch (err) {
        console.error("Error loading student dashboard", err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, [router, fetchStats]);

  // ── Real-time: re-fetch stats whenever THIS student's attendance changes ──
  // Triggers on scan check-in AND check-out so the donut + tiles stay live.
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`student-stats-rt-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attendance_records",
          filter: `student_id=eq.${user.id}`,
        },
        debounce(() => fetchStats(user.id), 1500)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchStats]);

  useEffect(() => {
    if (searchParams.get("checkin") === "true") {
      openCheckInModal();
    }
  }, [searchParams]);

  function openRepairModal() {
    setRepairStudentId("");
    setRepairYear("");
    setRepairSection("");
    setRepairError("");
    setShowRepairModal(true);
  }

  function closeRepairModal() {
    if (isRepairing) return;
    setShowRepairModal(false);
  }

  async function submitRepair(e: React.FormEvent) {
    e.preventDefault();
    if (!user || user.account_type !== "student") return;
    setRepairError("");

    const trimmedId = repairStudentId.trim();
    if (!trimmedId) {
      setRepairError("Student ID is required.");
      return;
    }
    if (!repairYear) {
      setRepairError("Please select your year level.");
      return;
    }
    if (!repairSection) {
      setRepairError("Please select your section.");
      return;
    }

    try {
      setIsRepairing(true);
      await ensureStudentProfile(user.id, {
        student_id_number: trimmedId,
        year: repairYear,
        section: repairSection,
      } as any);
      window.location.reload();
    } catch (err: any) {
      setRepairError(err?.message || "Could not repair your profile. Please try again.");
      setIsRepairing(false);
    }
  }

  const openCheckInModal = () => {
    setShowCheckInModal(true);
  };

  const closeCheckInModal = () => {
    setShowCheckInModal(false);
    if (searchParams.get("checkin") === "true") {
      router.replace("/dashboard");
    }
  };

  // Robust parsing utility for system config time strings (12h or 24h)
  function parseConfigTime(timeStr: string): { hours: number; minutes: number } | null {
    if (!timeStr) return null;
    const match24 = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (match24) {
      return { hours: parseInt(match24[1], 10), minutes: parseInt(match24[2], 10) };
    }
    const match12 = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match12) {
      let hours = parseInt(match12[1], 10);
      const minutes = parseInt(match12[2], 10);
      const ampm = match12[3].toUpperCase();
      if (ampm === "PM" && hours < 12) hours += 12;
      if (ampm === "AM" && hours === 12) hours = 0;
      return { hours, minutes };
    }
    return null;
  }



  if (loading) return <DashboardSkeleton />;

  const isStudent = user?.account_type === "student";
  const studentProfile = user?.student_profiles ?? null;
  const qrCodeValue = studentProfile?.qr_code_id || "NOT-FOUND";
  const attendanceRate = stats?.attendance_rate ?? 0;
  const firstName = user?.full_name?.split(" ")[0] ?? "Student";

  // Standing logic — a student with no recorded sessions yet gets a neutral
  // state instead of being shown as "Poor Standing" at 0%.
  const getStanding = (rate: number, totalRecords: number) => {
    if (totalRecords === 0) return { label: "No Records Yet", color: "var(--muted)", icon: <Clock size={13} /> };
    if (rate >= 90) return { label: "Excellent Standing", color: "var(--success)", icon: <Award size={13} /> };
    if (rate >= 75) return { label: "Good Standing", color: "var(--teal)", icon: <CheckCircle size={13} /> };
    if (rate >= 60) return { label: "At Risk", color: "var(--gold)", icon: <AlertCircle size={13} /> };
    return { label: "Poor Standing", color: "var(--danger)", icon: <AlertCircle size={13} /> };
  };
  const standing = getStanding(attendanceRate, stats?.total_records ?? 0);

  // Donut circle params
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (attendanceRate / 100) * circumference;

  // Helper: compute days until an event date (local-aware).
  function daysUntilEvent(dateStr: string): number {
    return Math.ceil(
      (parseDateLocal(dateStr).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000
    );
  }

  const visibleEvents = showAllEvents ? upcomingEvents : upcomingEvents.slice(0, EVENTS_PREVIEW);

  return (
    <div className="fade-in sd-root">

      {/* ── PAGE HEADER ─────────────────────────────────────────── */}
      <header className="sd-header">
        <div>
          <p className="sd-header-eyebrow">{isStudent ? "Student Portal" : "Facilitator Portal"}</p>
          <h1 className="sd-header-title">Good {getGreeting()}, <span className="sd-header-name">{firstName}!</span></h1>
          <p className="sd-header-tagline">
            {stats?.total_records
              ? `You're in ${standing.label.toLowerCase()} — ${attendanceRate}% attendance this term.`
              : "Welcome to your Pharmacy attendance portal. Scan a QR to log your first session."}
          </p>
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
          </div>

          <div className="sd-stat-tile sd-tile-late">
            <div className="sd-tile-icon-wrap" style={{ background: "rgba(217,119,6,0.12)", color: "#d97706" }}>
              <Clock size={18} />
            </div>
            <div className="sd-tile-number">{stats?.late_count ?? 0}</div>
            <div className="sd-tile-label">Late</div>
          </div>

          <div className="sd-stat-tile sd-tile-absent">
            <div className="sd-tile-icon-wrap" style={{ background: "rgba(248,113,113,0.12)", color: "var(--danger)" }}>
              <AlertCircle size={18} />
            </div>
            <div className="sd-tile-number">{stats?.absent_count ?? 0}</div>
            <div className="sd-tile-label">Absent</div>
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
                <button className="sd-repair-btn" onClick={openRepairModal} disabled={isRepairing}>
                  Repair QR Code
                </button>
              </div>
            ) : (
              <>
                <div className="sd-idcard-banner">
                  <img src="/usa.png" alt="University of San Agustin" className="sd-idcard-seal" />
                  <div className="sd-idcard-org">
                    <span className="sd-idcard-org-name">University of San Agustin</span>
                    <span className="sd-idcard-org-sub">College of Pharmacy</span>
                  </div>
                </div>
                <div className="sd-qr-code-wrap" ref={qrWrapRef}>
                  <QRCodeSVG value={qrCodeValue} size={148} level="H" includeMargin={false} />
                </div>
                <button
                  type="button"
                  className="sd-qr-download-btn"
                  onClick={() => downloadQRPng(qrWrapRef.current, `PharmaTrack_${qrCodeValue}.png`).catch((e) => alert("Download failed: " + e.message))}
                >
                  <DownloadIcon size={12} /> Download QR
                </button>
                <h3 className="sd-idcard-name">{user?.full_name || firstName}</h3>
                <div className="sd-idcard-meta">
                  <div className="sd-idcard-meta-item">
                    <span className="sd-idcard-meta-label">ID Number</span>
                    <span className="sd-idcard-meta-val">{studentProfile?.student_id_number || "—"}</span>
                  </div>
                  <div className="sd-idcard-meta-item">
                    <span className="sd-idcard-meta-label">Year &amp; Section</span>
                    <span className="sd-idcard-meta-val">
                      {studentProfile?.current_year || "—"}{studentProfile?.section ? ` · ${studentProfile.section}` : ""}
                    </span>
                  </div>
                </div>
                <p className="sd-qr-id">{qrCodeValue}</p>
              </>
            )}
          </div>

          <div className="sd-qr-footer">
            <button
              type="button"
              onClick={openCheckInModal}
              className="sd-present-btn"
              style={{ width: "100%", border: "none", cursor: "pointer" }}
            >
              <Maximize2 size={14} />
              Open Full-Screen
            </button>
          </div>
        </div>

        {/* COL B: Upcoming Event + Quick Links */}
        <div className="sd-right-col">

          {/* Upcoming Events */}
          <div className="sd-event-panel">
            <div className="sd-event-panel-header">
              <div>
                <p className="sd-panel-label">Up Next</p>
                <h2 className="sd-panel-title">Upcoming Activities</h2>
              </div>
              <Link href="/dashboard/schedule" className="sd-see-all">
                See all <ChevronRight size={13} />
              </Link>
            </div>

            {upcomingEvents.length > 0 ? (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {visibleEvents.map((event) => {
                    const days = daysUntilEvent(event.date);
                    const ts = getEventTypeStyle(event.event_type);
                    return (
                      <div key={event.id} className="sd-event-card" style={{ padding: "10px 12px" }}>
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
                      marginTop: "10px",
                      width: "100%",
                      padding: "8px",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                      color: "var(--gold)",
                      fontSize: "12px",
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
                      <><ChevronRight size={13} style={{ transform: "rotate(-90deg)" }} /> Show Less</>
                    ) : (
                      <><ChevronRight size={13} style={{ transform: "rotate(90deg)" }} /> See {upcomingEvents.length - EVENTS_PREVIEW} More Event{upcomingEvents.length - EVENTS_PREVIEW > 1 ? "s" : ""}</>
                    )}
                  </button>
                )}
              </>
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
              <button
                type="button"
                onClick={openCheckInModal}
                className="sd-quick-card"
                style={{ width: "100%", textAlign: "left" }}
              >
                <div className="sd-quick-icon" style={{ background: "rgba(45,212,191,0.12)", color: "var(--teal)" }}>
                  <Zap size={16} />
                </div>
                <span className="sd-quick-label">Check In</span>
                <ChevronRight size={14} className="sd-quick-arrow" />
              </button>
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

      {/* ── REPAIR QR MODAL ────────────────────────────────────── */}
      {showRepairModal && (
        <div
          className="sd-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="repair-modal-title"
          onClick={closeRepairModal}
        >
          <div className="sd-modal-card" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="sd-modal-close"
              onClick={closeRepairModal}
              disabled={isRepairing}
              aria-label="Close"
            >
              <X size={18} />
            </button>

            <div className="sd-modal-header">
              <h2 id="repair-modal-title" className="sd-modal-title">Repair Your Student Profile</h2>
              <p className="sd-modal-sub">
                We couldn&apos;t find your student details. Confirm them below and we&apos;ll regenerate your QR code.
              </p>
            </div>

            <form className="sd-modal-form" onSubmit={submitRepair}>
              {repairError && (
                <div className="sd-modal-error" role="alert">
                  <AlertCircle size={14} />
                  <span>{repairError}</span>
                </div>
              )}

              <div className="input-group">
                <label htmlFor="repair-student-id">Student ID Number</label>
                <input
                  id="repair-student-id"
                  type="text"
                  className="input-field"
                  placeholder="USA-2026-0001"
                  value={repairStudentId}
                  onChange={(e) => setRepairStudentId(e.target.value)}
                  disabled={isRepairing}
                  autoFocus
                  required
                />
              </div>

              <div className="two-col-grid">
                <div className="input-group">
                  <label htmlFor="repair-year">Year Level</label>
                  <select
                    id="repair-year"
                    className="input-field select-field"
                    value={repairYear}
                    onChange={(e) => { setRepairYear(e.target.value); setRepairSection(""); }}
                    disabled={isRepairing}
                    required
                    style={{ appearance: "none" }}
                  >
                    <option value="" disabled>Year</option>
                    {Object.keys(SECTIONS_BY_YEAR).map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label htmlFor="repair-section">Section</label>
                  <select
                    id="repair-section"
                    className="input-field select-field"
                    value={repairSection}
                    onChange={(e) => setRepairSection(e.target.value)}
                    disabled={isRepairing || !repairYear}
                    required
                    style={{ appearance: "none" }}
                  >
                    <option value="" disabled>Section</option>
                    {repairYear && SECTIONS_BY_YEAR[repairYear].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="sd-modal-actions">
                <button
                  type="button"
                  className="btn btn-outline sd-modal-btn"
                  onClick={closeRepairModal}
                  disabled={isRepairing}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-gold sd-modal-btn"
                  disabled={isRepairing}
                >
                  {isRepairing ? "Repairing…" : "Repair Profile"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CHECK-IN MODAL ────────────────────────────────────── */}
      {showCheckInModal && (
        <div
          className="sd-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={closeCheckInModal}
        >
          <div
            className="sd-modal-card checkin-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <style dangerouslySetInnerHTML={{__html: `
              .checkin-modal-card {
                max-width: 500px !important;
                width: 100% !important;
                padding: 28px !important;
                background: linear-gradient(145deg, #180d32, #0d061f) !important;
                border: 1px solid rgba(255, 255, 255, 0.12) !important;
                box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4) !important;
              }
              .checkin-modal-title {
                color: #ffffff !important;
                font-size: 1.55rem !important;
                font-weight: 700 !important;
                margin: 0 0 8px !important;
                text-align: center !important;
              }
              .checkin-modal-sub {
                color: rgba(255, 255, 255, 0.75) !important;
                font-size: 0.88rem !important;
                margin: 0 !important;
                line-height: 1.5 !important;
                text-align: center !important;
              }
              .checkin-mode-toggle {
                display: flex !important;
                background: rgba(22, 22, 29, 0.5) !important;
                border: 1px solid rgba(255, 255, 255, 0.08) !important;
                padding: 4px !important;
                border-radius: 14px !important;
                gap: 4px !important;
                width: 100% !important;
                margin-bottom: 24px !important;
              }
              .checkin-mode-btn {
                flex: 1 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 8px !important;
                padding: 10px 16px !important;
                border: none !important;
                border-radius: 10px !important;
                font-size: 13px !important;
                cursor: pointer !important;
                background: transparent !important;
                color: rgba(255, 255, 255, 0.6) !important;
                font-weight: 500 !important;
                transition: all 0.2s ease !important;
              }
              .checkin-mode-btn.active {
                background: #E8B84B !important;
                color: #0F0F13 !important;
                font-weight: 700 !important;
                box-shadow: 0 4px 12px rgba(232, 184, 75, 0.25) !important;
              }
              .checkin-qr-code-label {
                font-family: monospace !important;
                font-size: 22px !important;
                font-weight: 700 !important;
                letter-spacing: 5px !important;
                color: #E8B84B !important;
                margin-bottom: 12px !important;
                text-shadow: 0 2px 4px rgba(232, 184, 75, 0.1) !important;
                text-align: center !important;
              }
              .checkin-qr-instruction {
                font-size: 14px !important;
                color: rgba(255, 255, 255, 0.85) !important;
                margin-bottom: 20px !important;
                max-width: 320px !important;
                line-height: 1.45 !important;
                text-align: center !important;
              }
              .checkin-qr-download-btn {
                display: inline-flex !important;
                align-items: center !important;
                gap: 6px !important;
                background: rgba(232, 184, 75, 0.08) !important;
                border: 1px solid #E8B84B !important;
                color: #E8B84B !important;
                font-size: 13px !important;
                font-weight: 600 !important;
                padding: 8px 18px !important;
                border-radius: 999px !important;
                cursor: pointer !important;
                transition: all 0.15s ease !important;
                margin: 0 auto 16px auto !important;
              }
              .checkin-qr-download-btn:hover {
                background: rgba(232, 184, 75, 0.18) !important;
                border-color: #F0C96B !important;
                color: #F0C96B !important;
              }
              .checkin-qr-hint-row {
                display: flex !important;
                align-items: center !important;
                gap: 6px !important;
                font-size: 12px !important;
                color: rgba(255, 255, 255, 0.5) !important;
                padding: 8px 16px !important;
                background: rgba(255, 255, 255, 0.02) !important;
                border-radius: 99px !important;
                border: 1px solid rgba(255, 255, 255, 0.08) !important;
              }
              .checkin-modal-close {
                position: absolute !important;
                top: 14px !important;
                right: 14px !important;
                width: 32px !important;
                height: 32px !important;
                border-radius: 50% !important;
                background: rgba(255, 255, 255, 0.06) !important;
                border: 1px solid rgba(255, 255, 255, 0.1) !important;
                color: rgba(255, 255, 255, 0.7) !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                cursor: pointer !important;
                transition: all 0.15s ease !important;
              }
              .checkin-modal-close:hover {
                background: rgba(255, 255, 255, 0.15) !important;
                color: #ffffff !important;
              }
              .checkin-scan-hint {
                display: flex !important;
                align-items: center !important;
                gap: 6px !important;
                font-size: 12px !important;
                color: rgba(255, 255, 255, 0.7) !important;
                justify-content: center !important;
              }
              .checkin-processing-text {
                color: rgba(255, 255, 255, 0.8) !important;
                font-size: 14px !important;
              }
              .checkin-success-title {
                font-size: 20px !important;
                font-weight: 700 !important;
                color: #ffffff !important;
                margin-bottom: 8px !important;
              }
              .checkin-success-body {
                font-size: 14px !important;
                color: rgba(255, 255, 255, 0.8) !important;
                margin-bottom: 20px !important;
              }
            `}} />

            <button
              type="button"
              className="checkin-modal-close"
              onClick={closeCheckInModal}
              aria-label="Close"
            >
              <X size={18} />
            </button>

            <div className="sd-modal-header" style={{ marginBottom: "20px" }}>
              <h2 className="checkin-modal-title">Present Your ID</h2>
              <p className="checkin-modal-sub">
                Show your QR code to a Facilitator to be scanned for attendance.
              </p>
            </div>

            {/* QR Display — present-only mode for students */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
              <div className="sp-present-panel" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", width: "100%" }}>
                {qrCodeValue !== "NOT-FOUND" ? (
                  <>
                    <div className="sp-qr-wrapper" ref={modalQrWrapRef} style={{ background: "#fff", padding: "24px", borderRadius: "20px", marginBottom: "20px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 16px 48px rgba(0, 0, 0, 0.3), 0 0 24px rgba(232, 184, 75, 0.1)" }}>
                      <QRCodeSVG value={qrCodeValue} size={200} level="H" includeMargin={false} />
                    </div>
                    <p className="checkin-qr-code-label">{qrCodeValue}</p>
                    <p className="checkin-qr-instruction">
                      Present this to a Council Admin or Facilitator for scanning
                    </p>
                    <button
                      type="button"
                      className="checkin-qr-download-btn"
                      onClick={() => downloadQRPng(modalQrWrapRef.current, `PharmaTrack_${qrCodeValue}.png`).catch((e) => alert("Download failed: " + e.message))}
                    >
                      <DownloadIcon size={12} /> Download QR
                    </button>
                    <div className="checkin-qr-hint-row">
                      <Info size={12} />
                      Keep screen brightness high for best scan results
                    </div>
                  </>
                ) : (
                  <div className="sp-qr-error-state" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div className="sp-error-icon-wrap" style={{ width: "64px", height: "64px", borderRadius: "50%", background: "rgba(248, 113, 113, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
                      <AlertCircle size={28} color="var(--danger)" />
                    </div>
                    <h3 className="sp-error-title" style={{ fontSize: "16px", fontWeight: "700", color: "var(--white)", marginBottom: "8px" }}>QR Code Unavailable</h3>
                    <p className="sp-error-body" style={{ fontSize: "13px", color: "var(--muted)" }}>
                      We couldn&apos;t link a student profile to your account.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function DashboardSkeleton() {
  return (
    <div className="sd-root sd-skeleton" aria-busy="true" aria-label="Loading dashboard">
      <header className="sd-header">
        <div>
          <div className="sk-line sk-line-sm" style={{ width: 110 }} />
          <div className="sk-line sk-line-lg" style={{ width: 280, marginTop: 10 }} />
        </div>
        <div className="sk-line sk-line-md" style={{ width: 160 }} />
      </header>

      <div className="sd-top-row">
        <div className="sd-overview-card">
          <div className="sd-overview-ring-wrap">
            <div className="sk-donut" />
          </div>
          <div className="sd-overview-info">
            <div className="sk-line sk-line-sm" style={{ width: 150 }} />
            <div className="sk-line sk-line-md" style={{ width: 130, marginTop: 12 }} />
            <div className="sk-line sk-line-sm" style={{ width: 200, marginTop: 14 }} />
          </div>
        </div>

        <div className="sd-stat-tiles">
          {[0, 1, 2].map((i) => (
            <div className="sd-stat-tile" key={i}>
              <div className="sk-icon" />
              <div className="sk-line sk-line-lg" style={{ width: 50, marginTop: 12 }} />
              <div className="sk-line sk-line-sm" style={{ width: 70, marginTop: 8 }} />
              <div className="sk-line sk-line-bar" style={{ marginTop: 14 }} />
            </div>
          ))}
        </div>
      </div>

      <div className="sd-bottom-row">
        <div className="sd-qr-panel">
          <div className="sd-qr-panel-header">
            <div>
              <div className="sk-line sk-line-sm" style={{ width: 80 }} />
              <div className="sk-line sk-line-md" style={{ width: 120, marginTop: 8 }} />
            </div>
          </div>
          <div className="sd-qr-body">
            <div className="sk-qr" />
            <div className="sk-line sk-line-md" style={{ width: 160, marginTop: 16 }} />
            <div className="sk-line sk-line-sm" style={{ width: 220, marginTop: 8 }} />
          </div>
        </div>

        <div className="sd-right-col">
          <div className="sd-event-panel">
            <div className="sd-event-panel-header">
              <div>
                <div className="sk-line sk-line-sm" style={{ width: 60 }} />
                <div className="sk-line sk-line-md" style={{ width: 150, marginTop: 8 }} />
              </div>
            </div>
            <div className="sk-event-card" />
          </div>

          <div className="sd-quick-links">
            <div className="sk-line sk-line-sm" style={{ width: 100, marginBottom: 14 }} />
            <div className="sd-quick-grid">
              {[0, 1, 2, 3].map((i) => (
                <div className="sk-quick-card" key={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StudentDashboard() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <StudentDashboardContent />
    </Suspense>
  );
}
