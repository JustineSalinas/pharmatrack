"use client";

import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  Download,
  Maximize2
} from "lucide-react";
import Link from "next/link";
import { getCurrentUser, ensureStudentProfile } from "@/lib/auth-client";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function StudentDashboard() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [upcomingEvent, setUpcomingEvent] = useState<any>(null);
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

        if (u.account_type === "admin") {
          router.push("/dashboard/admin");
          return;
        }

        if (u.account_type === "facilitator") {
          router.push("/dashboard/facilitator");
          return;
        }

        setUser(u);

        if (u.account_type === "student") {
          // Load overall stats
          const { data } = await supabase
            .from("student_attendance_summary")
            .select("*")
            .eq("student_id", u.id)
            .single();
          setStats(data);

          // Load the next upcoming event
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
    if (!user || user.account_type !== 'student') return;
    try {
      setIsRepairing(true);
      const studentId = prompt("Please confirm your Student ID Number (e.g. USA-2026-XXXX):");
      if (!studentId) return;

      const year = prompt("Enter your Year Level (e.g. 1st Year):");
      const section = prompt("Enter your Section (e.g. PH 1A):");

      await ensureStudentProfile(user.id, {
        student_id_number: studentId,
        year: year || "Unknown",
        section: section || "Unknown"
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
  const studentProfile = user?.student_profiles?.[0];
  const qrCodeValue = studentProfile?.qr_code_id || "NOT-FOUND";

  return (
    <div className="fade-in">
      {/* HEADER */}
      <header className="dash-header">
        <div className="dash-header-left">
          <span className="breadcrumb-text">{isStudent ? "Student Portal" : "Facilitator Portal"}</span>
          <h1>Dashboard</h1>
        </div>
      </header>

      {/* STAT CARDS */}
      <div className="stat-cards-row">
        {/* HERO METRIC: Attendance Rate */}
        <div className="hero-stat-card">
          <div className="hero-stat-content">
            <div className="hero-stat-label">
              <Activity size={20} color="var(--gold)" />
              Overall Attendance
            </div>
            <div className="hero-stat-value">{stats?.attendance_rate ?? 0}%</div>
            <div className="hero-stat-sub">
              <CheckCircle size={14} /> Good standing
            </div>
          </div>
        </div>

        {/* SECONDARY METRICS */}
        <div className="secondary-stat-card">
          <div className="stat-icon-badge green"><CheckCircle size={20} /></div>
          <div>
            <div className="stat-value" style={{ color: "var(--white)" }}>{stats?.present_count ?? 0}</div>
            <div className="stat-label">Present</div>
          </div>
        </div>
        <div className="secondary-stat-card">
          <div className="stat-icon-badge orange"><Clock size={20} /></div>
          <div>
            <div className="stat-value" style={{ color: "var(--white)" }}>{stats?.late_count ?? 0}</div>
            <div className="stat-label">Late</div>
          </div>
        </div>
        <div className="secondary-stat-card">
          <div className="stat-icon-badge" style={{ background: "rgba(239,68,68,0.2)", color: "#ef4444" }}>
            <AlertCircle size={20} />
          </div>
          <div>
            <div className="stat-value" style={{ color: "var(--white)" }}>{stats?.absent_count ?? 0}</div>
            <div className="stat-label">Absent</div>
          </div>
        </div>
      </div>

      <div className="dash-content-grid" style={{ gridTemplateColumns: "320px 1fr" }}>

        {/* LEFT COL: QR CODE */}
        <div className="dash-actions-col">
          <div className="medical-id-badge">
            <div className="badge-clip"></div>
            
            <div className="badge-header">
              <h3>Student ID</h3>
              <p>PharmaTrack Access Pass</p>
            </div>

            <div className="badge-body">
              {qrCodeValue === "NOT-FOUND" ? (
                <div className="qr-error-state">
                  <AlertCircle color="#ef4444" size={36} />
                  <p>ID Data Missing</p>
                  <button
                    className="btn-repair"
                    onClick={handleRepairQR}
                    disabled={isRepairing}
                  >
                    {isRepairing ? "Repairing..." : "Repair QR Code"}
                  </button>
                </div>
              ) : (
                <>
                  <div className="badge-qr-wrapper">
                    <QRCodeSVG
                      value={qrCodeValue}
                      size={180}
                      level="H"
                      includeMargin={false}
                    />
                  </div>
                  <div className="qr-id-text" style={{ color: "inherit", fontWeight: 700, margin: "8px 0" }}>
                    {qrCodeValue}
                  </div>
                  <p className="qr-help" style={{ color: "#64748b", margin: 0, fontSize: "0.8rem", textAlign: "center", maxWidth: "200px" }}>
                    Present this to any Council Member for scanning.
                  </p>
                </>
              )}
            </div>

            <div className="badge-footer" style={{ background: "#f8fafc", padding: "16px 24px", borderTop: "1px solid #e2e8f0" }}>
              <Link href="/check-in" className="btn" style={{ width: "100%", background: "var(--teal)", color: "white", borderRadius: "12px" }}>
                <Maximize2 size={16} /> Open Presenter
              </Link>
            </div>
          </div>
        </div>

        {/* RIGHT COL: RECENT RECORDS OR UPCOMING EVENTS */}
        <div className="trend-panel">
          <div className="trend-header">
            <h3>Upcoming Activity</h3>
          </div>
          <div className="trend-subtitle">Next required attendance</div>

          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px", marginTop: "16px" }}>
            {upcomingEvent ? (
              <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                <div style={{ background: "var(--surface2)", padding: "12px", borderRadius: "12px", textAlign: "center", minWidth: "60px" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--gold)", fontWeight: 700, textTransform: "uppercase" }}>
                    {new Date(upcomingEvent.date).toLocaleDateString("en-US", { month: "short" })}
                  </div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--white)" }}>
                    {new Date(upcomingEvent.date).toLocaleDateString("en-US", { day: "numeric" })}
                  </div>
                </div>
                <div>
                  <h4 style={{ fontSize: "1.1rem", color: "var(--white)", fontWeight: 700, marginBottom: "4px" }}>{upcomingEvent.name}</h4>
                  <div style={{ fontSize: "0.85rem", color: "var(--muted)", display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                    <Clock size={12} /> {new Date(upcomingEvent.check_in_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(upcomingEvent.check_in_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "var(--muted)", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "12px" }}>📍</span> {upcomingEvent.location}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "30px 0", color: "var(--muted)", fontSize: "0.9rem" }}>
                No upcoming events scheduled. Enjoy your free time!
              </div>
            )}
          </div>

          <Link href="/dashboard/records" style={{ display: "inline-block", marginTop: "20px", color: "var(--gold)", fontSize: "0.85rem", fontWeight: 600 }}>
            View my attendance records →
          </Link>
        </div>
      </div>
    </div>
  );
}
