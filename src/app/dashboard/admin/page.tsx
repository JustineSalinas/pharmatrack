"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { 
  Search, 
  Bell, 
  Users, 
  Activity,
  ArrowRight,
  Clock,
  Settings,
  UserCheck,
  Loader2,
  ScanLine,
  UserCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth-client";
import { backfillEventStatuses, runIfDue, notifyAbsences } from "@/lib/attendance";
import { triggerWeeklyReport } from "@/lib/weeklyReport";
import { useRouter } from "next/navigation";

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>({
    totalStudents: 0,
    totalFacilitators: 0,
    pendingApprovals: 0,
    attendanceRate: 0,
  });
  const [recentScans, setRecentScans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNotifs, setShowNotifs] = useState(false);
  const router = useRouter();

  const fetchDashboard = useCallback(async (silent = false) => {
    try {
      const u = await getCurrentUser();
      if (!u) return;
      if (u.account_type !== "admin") {
        if (u.account_type === "facilitator") {
          router.push("/dashboard/facilitator");
        } else {
          router.push("/dashboard");
        }
        return;
      }

      // Silently auto-mark Absent / Incomplete for past events (throttled
      // to once per hour per browser so it doesn't run on every page load).
      if (!silent) {
        runIfDue("absentBackfill", 60 * 60_000, backfillEventStatuses)
          .then((r) => r && notifyAbsences(r.absentEntries))
          .catch(() => {});
        runIfDue("weeklyReport", 7 * 24 * 60 * 60_000, triggerWeeklyReport).catch(() => {});
      }

      // Total Students
      const { count: studentCount } = await supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("account_type", "student");

      // Total Facilitators (all, approved or not)
      const { count: facilitatorCount } = await supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("account_type", "facilitator");

      // Pending Approvals (facilitators not yet approved)
      const { count: pendingCount } = await supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("account_type", "facilitator")
        .eq("status", "pending");

      // Attendance Rate — use server-side counts instead of fetching all rows
      const [{ count: totalLogs }, { count: presentLateCount }] = await Promise.all([
        supabase.from("attendance_records").select("*", { count: "exact", head: true }),
        supabase.from("attendance_records").select("*", { count: "exact", head: true }).in("status", ["present", "late"]),
      ]);
      const rate = (totalLogs ?? 0) > 0
        ? parseFloat((((presentLateCount ?? 0) / (totalLogs ?? 1)) * 100).toFixed(1))
        : 0;

      setStats({
        totalStudents: studentCount || 0,
        totalFacilitators: facilitatorCount || 0,
        pendingApprovals: pendingCount || 0,
        attendanceRate: rate,
      });

      // Live Activity Feed — join events so event name shows correctly
      const { data: recentAtt } = await supabase
        .from("attendance_records")
        .select(`id, time_in, status, events ( name ), users!student_id ( full_name )`)
        .order("created_at", { ascending: false })
        .limit(8);

      setRecentScans(recentAtt || []);
    } catch (err) {
      console.error("Dashboard error", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Initial load
  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // ── Real-time: refresh feed + stats whenever any attendance record changes ──
  useEffect(() => {
    const channel = supabase
      .channel("admin-dashboard-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance_records" },
        () => {
          fetchDashboard(true); // silent — don't reset loading state
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDashboard]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
        <Loader2 size={20} color="var(--muted)" style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <div className="fade-in sd-root">
      {/* HEADER */}
      <header className="sd-header">
        <div>
          <p className="sd-header-eyebrow">Admin Portal</p>
          <h1 className="sd-header-title">Overview</h1>
        </div>
        <div className="dash-header-right">
          <Link href="/dashboard/admin/users" className="dash-search" style={{ textDecoration: "none", color: "var(--dimmed)" }}>
            <Search size={14} /> Search Users
          </Link>
          <Link
            href="/dashboard/admin/reports"
            className="dash-search"
            style={{ textDecoration: "none", color: "var(--gold)", borderColor: "rgba(232,184,75,0.2)" }}
          >
            <Activity size={14} /> Reports
          </Link>
          <div style={{ position: "relative" }}>
            <button className="dash-notif-btn" onClick={() => setShowNotifs(!showNotifs)}>
              <Bell size={14} />
              {stats.pendingApprovals > 0 && (
                <span style={{ position: "absolute", top: "-2px", right: "-2px", background: "var(--gold)", width: "8px", height: "8px", borderRadius: "50%" }} />
              )}
            </button>
            {showNotifs && (
              <div style={{
                position: "absolute", top: "100%", right: 0, marginTop: "8px", width: "280px",
                background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)",
                boxShadow: "0 10px 40px rgba(0,0,0,0.5)", zIndex: 100, overflow: "hidden"
              }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: "13px", fontWeight: 600, color: "var(--white)" }}>
                  Notifications
                </div>
                <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                  {stats.pendingApprovals > 0 && (
                    <Link href="/dashboard/admin/users" style={{ display: "block", padding: "16px", borderBottom: "1px solid var(--border)", textDecoration: "none", transition: "background 0.2s" }} className="notif-item">
                      <div style={{ fontSize: "13px", color: "var(--gold)", fontWeight: 500, marginBottom: "4px" }}>Pending Approvals</div>
                      <div style={{ fontSize: "12px", color: "var(--dimmed)" }}>You have {stats.pendingApprovals} facilitator{stats.pendingApprovals > 1 ? 's' : ''} waiting for approval.</div>
                    </Link>
                  )}
                  {stats.attendanceRate < 75 && stats.attendanceRate > 0 && (
                    <Link href="/dashboard/admin/reports" style={{ display: "block", padding: "16px", borderBottom: "1px solid var(--border)", textDecoration: "none", transition: "background 0.2s" }} className="notif-item">
                      <div style={{ fontSize: "13px", color: "var(--danger)", fontWeight: 500, marginBottom: "4px" }}>Low Attendance Alert</div>
                      <div style={{ fontSize: "12px", color: "var(--dimmed)" }}>System-wide attendance has dropped to {stats.attendanceRate}%.</div>
                    </Link>
                  )}
                  {stats.pendingApprovals === 0 && (stats.attendanceRate >= 75 || stats.attendanceRate === 0) && (
                    <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--dimmed)", fontSize: "12px" }}>
                      You&apos;re all caught up!
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* STAT STRIP */}
      <div className="stat-cards-row">
        {/* HERO: System Attendance Rate */}
        <div
          className="admin-stat-card"
          style={{ gridColumn: "1 / -1", borderBottom: "1px solid var(--border)" }}
        >
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--dimmed)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                System Attendance Rate
              </div>
              <div style={{ fontSize: 48, fontWeight: 700, color: "var(--white)", lineHeight: 1, letterSpacing: "-0.03em" }}>
                {stats.attendanceRate}
                <span style={{ fontSize: 24, color: "var(--muted)", marginLeft: 2 }}>%</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
                Network-wide average across all events
              </div>
            </div>
            <div style={{ flex: 1, maxWidth: 280 }}>
              <div style={{ height: 2, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min(Number(stats.attendanceRate), 100)}%`,
                    background: "var(--gold)",
                    borderRadius: 2,
                    transition: "width 0.8s ease",
                  }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <span style={{ fontSize: 11, color: "var(--dimmed)" }}>0%</span>
                <span style={{ fontSize: 11, color: "var(--dimmed)" }}>100%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Total Students */}
        <div className="admin-stat-card">
          <div className="stat-icon-badge"><Users size={16} /></div>
          <div className="stat-value">{stats.totalStudents}</div>
          <div className="stat-label">Total Students</div>
        </div>

        {/* Total Facilitators */}
        <div className="admin-stat-card">
          <div className="stat-icon-badge" style={{ color: "var(--teal)", background: "rgba(45,212,191,0.08)" }}>
            <UserCheck size={16} />
          </div>
          <div className="stat-value">{stats.totalFacilitators}</div>
          <div className="stat-label">Total Facilitators</div>
        </div>

        {/* Pending Approvals */}
        <div className="admin-stat-card">
          <div
            className="stat-icon-badge"
            style={{
              color: stats.pendingApprovals > 0 ? "var(--gold)" : "var(--dimmed)",
              background: stats.pendingApprovals > 0 ? "rgba(232,184,75,0.08)" : "rgba(255,255,255,0.04)",
            }}
          >
            <Bell size={16} />
          </div>
          <div className="stat-value" style={{ color: stats.pendingApprovals > 0 ? "var(--gold)" : "var(--white)" }}>
            {stats.pendingApprovals}
          </div>
          <div className="stat-label">Pending Approvals</div>
        </div>
      </div>

      <div className="dash-content-grid" style={{ gridTemplateColumns: "1fr 240px" }}>
        {/* LEFT: LIVE FEED */}
        <div className="recent-scans">
          <div className="recent-scans-header">
            <h3>Live Activity Feed</h3>
            <Link href="/dashboard/admin/attendance">
              View all <ArrowRight size={12} style={{ display: "inline", marginLeft: 2, verticalAlign: "middle" }} />
            </Link>
          </div>

          {recentScans.length > 0 ? (
            recentScans.map(scan => {
              const fname = scan.users?.full_name || "Unknown User";
              const initials = fname.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase() || "U";
              const timeIn = scan.time_in
                ? new Date(scan.time_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                : "—";
              return (
                <div className="scan-item" key={scan.id}>
                  <div className="scan-avatar">{initials}</div>
                  <div className="scan-info">
                    <div className="scan-name">{fname}</div>
                    <div className="scan-detail">
                      <Clock size={10} style={{ display: "inline", marginRight: 3, verticalAlign: "middle" }} />
                      {scan.events?.name || "Event"} · {timeIn}
                    </div>
                  </div>
                  <div className={`status-badge ${scan.status}`}>{scan.status}</div>
                </div>
              );
            })
          ) : (
            <div style={{ padding: "52px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 48, height: 48,
                  border: "1px dashed rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <ScanLine size={20} color="var(--dimmed)" />
              </div>
              <p style={{ fontSize: 13, color: "var(--dimmed)", textAlign: "center", margin: 0, lineHeight: 1.6 }}>
                No scans recorded yet.<br />Attendance will appear here once events begin.
              </p>
            </div>
          )}
        </div>

        {/* RIGHT: QUICK ACTIONS */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--dimmed)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            Quick Actions
          </div>
          <Link href="/dashboard/admin/users" className="action-card">
            <div className="action-card-icon"><Users size={16} /></div>
            <div className="action-card-text">
              <h4>Manage Users</h4>
              <p>Review &amp; approve</p>
            </div>
          </Link>
          <Link href="/dashboard/admin/settings" className="action-card">
            <div className="action-card-icon"><Settings size={16} /></div>
            <div className="action-card-text">
              <h4>Settings</h4>
              <p>System configuration</p>
            </div>
          </Link>
        </div>
      </div>

      <style jsx>{`
        .notif-item:hover { background: var(--surface2) !important; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
