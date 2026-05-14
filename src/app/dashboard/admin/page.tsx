"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Search, 
  Bell, 
  Plus, 
  Users, 
  Calendar, 
  ScanLine, 
  CalendarDays, 
  Loader2,
  Activity,
  ArrowRight,
  Clock
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>({ totalStudents: 0, activeEvents: 0, scansToday: 0, attendanceRate: 0 });
  const [recentScans, setRecentScans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const u = await getCurrentUser();
        if (!u || u.account_type === "student") {
          router.push("/dashboard");
          return;
        }

        const { count: studentCount } = await supabase
          .from("users")
          .select("*", { count: "exact", head: true })
          .eq("account_type", "student");

        const today = new Date().toISOString().split("T")[0];
        const { data: eventsData } = await supabase
          .from("events")
          .select("id, date, name")
          .gte("date", today);
        
        const activeEventsCount = eventsData?.length || 0;

        const { data: allAtt } = await supabase
          .from("attendance_records")
          .select("id, created_at, status");

        let scansToday = 0;
        let presentLateCount = 0;
        let totalLogs = 0;

        if (allAtt && allAtt.length > 0) {
          totalLogs = allAtt.length;
          const todayStr = new Date().toDateString();
          allAtt.forEach(att => {
            if (new Date(att.created_at).toDateString() === todayStr) scansToday++;
            if (att.status === "present" || att.status === "late") presentLateCount++;
          });
        }

        const rate = totalLogs > 0 ? parseFloat(((presentLateCount / totalLogs) * 100).toFixed(1)) : 0;
        setStats({ totalStudents: studentCount || 0, activeEvents: activeEventsCount, scansToday, attendanceRate: rate });

        const { data: recentAtt } = await supabase
          .from("attendance_records")
          .select(`id, time_in, status, events ( name ), users ( full_name )`)
          .order("created_at", { ascending: false })
          .limit(8);

        setRecentScans(recentAtt || []);
      } catch (err) {
        console.error("Dashboard error", err);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, [router]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
        <Loader2 size={20} color="var(--muted)" style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <div className="fade-in">
      {/* HEADER */}
      <header className="dash-header">
        <div className="dash-header-left">
          <span className="breadcrumb-text">Admin</span>
          <h1>Overview</h1>
        </div>
        <div className="dash-header-right">
          <button className="dash-search">
            <Search size={14} /> Search
          </button>
          <Link
            href="/dashboard/admin/reports"
            className="dash-search"
            style={{ textDecoration: "none", color: "var(--gold)", borderColor: "rgba(232,184,75,0.2)" }}
          >
            <Activity size={14} /> Reports
          </Link>
          <button className="dash-notif-btn">
            <Bell size={14} />
          </button>
        </div>
      </header>

      {/* STAT STRIP */}
      <div className="stat-cards-row">
        {/* HERO: Attendance Rate — spans full width */}
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

        {/* Secondary metrics */}
        <div className="admin-stat-card">
          <div className="stat-icon-badge"><Users size={16} /></div>
          <div className="stat-value">{stats.totalStudents}</div>
          <div className="stat-label">Total Students</div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-icon-badge"><Calendar size={16} /></div>
          <div className="stat-value">{stats.activeEvents}</div>
          <div className="stat-label">Upcoming Events</div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-icon-badge"><ScanLine size={16} /></div>
          <div className="stat-value">{stats.scansToday}</div>
          <div className="stat-label">Scans Today</div>
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
            /* Proper empty state */
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
                No scans recorded yet.<br />Start an event to begin tracking.
              </p>
              <Link
                href="/check-in"
                style={{
                  fontSize: 12, color: "var(--gold)", textDecoration: "none",
                  display: "flex", alignItems: "center", gap: 6, marginTop: 4,
                  padding: "6px 14px",
                  border: "1px solid rgba(232,184,75,0.25)",
                  borderRadius: 6,
                  transition: "background 0.15s ease",
                }}
              >
                <ScanLine size={12} /> Open Scanner
              </Link>
            </div>
          )}
        </div>

        {/* RIGHT: QUICK ACTIONS */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--dimmed)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            Quick Actions
          </div>
          <Link href="/check-in" className="action-card">
            <div className="action-card-icon"><ScanLine size={16} /></div>
            <div className="action-card-text">
              <h4>Open Scanner</h4>
              <p>Record attendance</p>
            </div>
          </Link>
          <Link href="/dashboard/admin/users" className="action-card">
            <div className="action-card-icon"><Plus size={16} /></div>
            <div className="action-card-text">
              <h4>Manage Users</h4>
              <p>Review &amp; approve</p>
            </div>
          </Link>
          <Link href="/dashboard/admin/events" className="action-card">
            <div className="action-card-icon"><CalendarDays size={16} /></div>
            <div className="action-card-text">
              <h4>Events</h4>
              <p>Schedule &amp; manage</p>
            </div>
          </Link>
          <Link href="/dashboard/admin/attendance" className="action-card">
            <div className="action-card-icon"><Activity size={16} /></div>
            <div className="action-card-text">
              <h4>Attendance Logs</h4>
              <p>All records</p>
            </div>
          </Link>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
