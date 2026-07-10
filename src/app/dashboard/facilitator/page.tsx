"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase, formatManilaTime } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth-client";
import { debounce } from "@/lib/debounce";
import { backfillEventStatusesShared, runIfDue, notifyAbsences } from "@/lib/attendance";
import { triggerWeeklyReport } from "@/lib/weeklyReport";
import {
  Loader2,
  Users,
  LogIn,
  LogOut,
  CalendarCheck,
  QrCode,
  BarChart2,
  Calendar,
  ChevronRight,
  ArrowRight,
  Clock,
  ScanLine,
  CheckCircle,
  AlertCircle
} from "lucide-react";

export default function FacilitatorOverview() {
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState({
    totalStudents: 0,
    activeEventsToday: 0,
    scansToday: 0,
    studentsAbsent: 0,
  });
  const [todayAttendance, setTodayAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFacilitatorData = useCallback(async () => {
      try {
        const u = await getCurrentUser();
        setUser(u);

        // Silently auto-mark Absent / Incomplete for past events (throttled
        // to once per hour per browser so it doesn't run on every page load).
        runIfDue("absentBackfill", 60 * 60_000, backfillEventStatusesShared)
          .then((r) => r && notifyAbsences(r.absentEntries))
          .catch(() => {});
        runIfDue("weeklyReport", 7 * 24 * 60 * 60_000, triggerWeeklyReport).catch(() => {});

        // 1. Total Students
        const { count: studentCount } = await supabase
          .from("users")
          .select("*", { count: "exact", head: true })
          .eq("account_type", "student");

        // 2. Active Events Today — use LOCAL date (not UTC) to avoid timezone drift
        //    in UTC+8 (Philippines) where toISOString() can return yesterday's date.
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        const { count: activeEventsCount } = await supabase
          .from("events")
          .select("*", { count: "exact", head: true })
          .eq("date", todayStr);

        // 3. Scans Today & Students Absent
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);

        const { data: todayRecords } = await supabase
          .from("attendance_records")
          .select("id, status")
          .gte("created_at", startOfToday.toISOString())
          .lte("created_at", endOfToday.toISOString()) as any;

        let todayScans = 0;
        let todayAbsents = 0;
        if (todayRecords) {
          todayRecords.forEach((r: any) => {
            if (r.status === "present" || r.status === "late") {
              todayScans++;
            } else if (r.status === "absent") {
              todayAbsents++;
            }
          });
        }

        setStats({
          totalStudents: studentCount || 0,
          activeEventsToday: activeEventsCount || 0,
          scansToday: todayScans,
          studentsAbsent: todayAbsents,
        });

        // 4. Live Activity Feed (Recent Scans)
        const { data: recentAtt } = await supabase
          .from("attendance_records")
          .select(`
            id,
            time_in,
            status,
            created_at,
            events ( name ),
            users!student_id ( 
              id,
              full_name,
              student_profiles ( section )
            )
          `)
          .order("created_at", { ascending: false })
          .limit(8) as any;

        const formatted = (recentAtt || []).map((r: any) => {
          const uData = r.users as any;
          const profiles = uData?.student_profiles;
          const section = Array.isArray(profiles)
            ? profiles[0]?.section
            : (profiles?.section || "N/A");

          return {
            id: r.id,
            name: uData?.full_name || "Unknown Student",
            section: section,
            timeIn: r.time_in ? formatManilaTime(r.time_in, { hour: "2-digit", minute: "2-digit" }) : "—",
            status: r.status || "present",
            eventName: r.events?.name || "Event",
          };
        });

        setTodayAttendance(formatted);

      } catch (err) {
        console.error("Facilitator dash error", err);
      } finally {
        setLoading(false);
      }
    }, []);

  // Initial load
  useEffect(() => {
    fetchFacilitatorData();
  }, [fetchFacilitatorData]);

  // ── Real-time: refresh feed + stats whenever any attendance record changes ──
  // Intentionally unfiltered — stats here are platform-wide, not scoped to
  // this facilitator, and attendance_records/events carry no facilitator_id
  // column to filter on (only qr_sessions.facilitator_id does, and
  // postgres_changes filters can't reference a joined table).
  useEffect(() => {
    const channel = supabase
      .channel("facilitator-dashboard-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance_records" },
        debounce(() => fetchFacilitatorData(), 1500)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchFacilitatorData]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
        <Loader2 size={20} color="var(--muted)" style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  const firstName = user?.full_name?.split(" ")[0] ?? "Facilitator";

  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr < 12) return "morning";
    if (hr < 17) return "afternoon";
    return "evening";
  };

  const quickActions = [
    {
      icon: <QrCode size={16} />,
      label: "Open Scanner",
      sub: "Scan QR codes",
      href: "/dashboard/facilitator/scanner",
    },
    {
      icon: <CalendarCheck size={16} />,
      label: "Create Event",
      sub: "Schedule new activities",
      href: "/dashboard/facilitator/events",
    },
    {
      icon: <Users size={16} />,
      label: "Students",
      sub: "View students list",
      href: "/dashboard/facilitator/students",
    },
    {
      icon: <BarChart2 size={16} />,
      label: "View Reports",
      sub: "Attendance records",
      href: "/dashboard/facilitator/reports",
    },
  ];

  return (
    <div className="fade-in sd-root facilitator-overview-page">
      {/* HEADER */}
      <header className="sd-header">
        <div>
          <p className="sd-header-eyebrow">Facilitator Portal</p>
          <h1 className="sd-header-title">
            Good {getGreeting()}, <span className="sd-header-name">{firstName}!</span>
          </h1>
        </div>
        <div className="sd-header-date">
          <Calendar size={13} style={{ color: "#4f46e5" }} />
          <span>{new Date().toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric" })}</span>
        </div>
      </header>

      {/* STATS STRIP */}
      <div 
        className="summary-cards-grid" 
        style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
          gap: "16px", 
          marginBottom: "24px",
          width: "100%"
        }}
      >
        {[
          { label: "Total Students", count: stats.totalStudents, color: "#a78bfa", bg: "rgba(167, 139, 250, 0.03)", border: "rgba(167, 139, 250, 0.15)", icon: <Users size={16} color="#a78bfa" /> },
          { label: "Active Events", count: stats.activeEventsToday, color: "#38bdf8", bg: "rgba(56, 189, 248, 0.03)", border: "rgba(56, 189, 248, 0.15)", icon: <CalendarCheck size={16} color="#38bdf8" /> },
          { label: "Scans Today", count: stats.scansToday, color: "#4ade80", bg: "rgba(74, 222, 128, 0.03)", border: "rgba(74, 222, 128, 0.15)", icon: <CheckCircle size={16} color="#4ade80" /> },
          { label: "Absent Today", count: stats.studentsAbsent, color: "#f87171", bg: "rgba(248, 113, 113, 0.03)", border: "rgba(248, 113, 113, 0.15)", icon: <AlertCircle size={16} color="#f87171" /> }
        ].map((item) => (
          <div 
            key={item.label} 
            className="stat-card"
            style={{ 
              display: "flex", 
              flexDirection: "column", 
              background: item.bg, 
              border: `1px solid ${item.border}`, 
              borderRadius: "var(--radius)",
              padding: "18px 20px",
            }}
          >
             <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
               <div style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{item.label}</div>
               <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "26px", height: "26px", borderRadius: "50%", background: `${item.color}12` }}>
                 {item.icon}
               </div>
             </div>
             <div style={{ fontSize: "32px", fontWeight: 700, color: item.color, letterSpacing: "-0.02em", lineHeight: "1" }}>{item.count}</div>
          </div>
        ))}
      </div>

      {/* BOTTOM LAYOUT */}
      <div className="sd-bottom-row" style={{ gridTemplateColumns: "1fr 300px" }}>
        {/* LEFT: Live Activity Feed */}
        <div className="recent-scans">
          <div className="recent-scans-header">
            <h3>Live Activity Feed</h3>
            <Link href="/dashboard/facilitator/attendance">
              <span>View all</span>
              <ArrowRight size={12} style={{ display: "inline-block", marginLeft: 4 }} />
            </Link>
          </div>

          {todayAttendance.length > 0 ? (
            todayAttendance.map((scan) => {
              const initials = scan.name
                .split(" ")
                .map((n: string) => n[0])
                .join("")
                .substring(0, 2)
                .toUpperCase() || "U";
              return (
                <div className="scan-item" key={scan.id}>
                  <div className="scan-avatar">{initials}</div>
                  <div className="scan-info">
                    <div className="scan-name">{scan.name}</div>
                    <div className="scan-detail">
                      <Clock size={10} style={{ display: "inline-block", marginRight: 3, verticalAlign: "middle", color: "#4f46e5" }} />
                      <span>{scan.eventName} · {scan.timeIn} · </span>
                      <span className="tag" style={{ border: "1px solid rgba(79, 70, 229, 0.12)", padding: "2px 6px", borderRadius: 4, fontSize: 10, background: "rgba(79, 70, 229, 0.05)", color: "#4f46e5", fontWeight: 600 }}>{scan.section}</span>
                    </div>
                  </div>
                  <div className={`status-badge ${scan.status}`}>{scan.status.toUpperCase()}</div>
                </div>
              );
            })
          ) : (
            <div style={{ padding: "52px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  border: "1px dashed rgba(79, 70, 229, 0.3)",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(79, 70, 229, 0.04)"
                }}
              >
                <ScanLine size={20} color="#4f46e5" />
              </div>
              <p style={{ fontSize: 13, color: "#4b5563", textAlign: "center", margin: 0, lineHeight: 1.6 }}>
                No scans recorded today.
                <br />
                Attendance will appear here once events begin.
              </p>
            </div>
          )}
        </div>

        {/* RIGHT: Quick Actions */}
        <div className="sd-right-col">
          <div className="sd-quick-links">
            <p className="sd-panel-label">
              Quick Actions
            </p>
            <div className="sd-quick-grid" style={{ gridTemplateColumns: "1fr" }}>
              {quickActions.map((a) => (
                <Link href={a.href as any} className="sd-quick-card" key={a.label}>
                  <div className="sd-quick-icon">
                    {a.icon}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1 }}>
                    <span className="sd-quick-label">
                      {a.label}
                    </span>
                    <span className="sd-quick-sub">{a.sub}</span>
                  </div>
                  <ChevronRight size={14} className="sd-quick-arrow" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* NATIVE STYLE TAG FOR UNCOMPROMISED OVERRIDES PREVENTING STYLED-JSX DISCARD ERRORS */}
      <style>{`
        .facilitator-overview-page {
          width: 100%;
        }

        .facilitator-overview-page .sd-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding-bottom: 20px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.08);
          margin-bottom: 4px;
        }

        .facilitator-overview-page .sd-header-eyebrow {
          font-size: 11px;
          font-weight: 600;
          color: #6b7280 !important;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 4px;
        }

        .facilitator-overview-page .sd-header-title {
          font-size: 22px;
          font-weight: 700;
          color: #111827 !important;
          letter-spacing: -0.03em;
          line-height: 1.2;
        }

        .facilitator-overview-page .sd-header-date {
          display: flex !important;
          align-items: center !important;
          gap: 6px !important;
          font-size: 12px !important;
          color: #4f46e5 !important;
          background: rgba(79, 70, 229, 0.06) !important;
          border: 1px solid rgba(79, 70, 229, 0.12) !important;
          padding: 6px 12px !important;
          border-radius: 99px !important;
          white-space: nowrap !important;
        }

        .stat-card {
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        }

        /* ── LIVE ACTIVITY FEED ── */
        .facilitator-overview-page .recent-scans {
          background: rgba(79, 70, 229, 0.04) !important;
          border: 1px solid rgba(79, 70, 229, 0.12) !important;
          border-radius: 8px !important;
          padding: 0 !important;
          overflow: hidden !important;
        }

        .facilitator-overview-page .recent-scans-header {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          padding: 16px 20px !important;
          border-bottom: 1px solid rgba(79, 70, 229, 0.12) !important;
          background: rgba(79, 70, 229, 0.03) !important;
        }

        .facilitator-overview-page .recent-scans-header h3 {
          margin: 0 !important;
          font-size: 14px !important;
          font-weight: 600 !important;
          color: #4f46e5 !important;
        }

        .facilitator-overview-page .recent-scans-header a {
          color: #4f46e5 !important;
          font-size: 12px !important;
          font-weight: 600 !important;
          text-decoration: none !important;
          display: flex !important;
          align-items: center !important;
        }

        .facilitator-overview-page .scan-item {
          display: flex !important;
          align-items: center !important;
          gap: 12px !important;
          padding: 12px 20px !important;
          background: transparent !important;
          border-bottom: 1px solid rgba(79, 70, 229, 0.05) !important;
          transition: background 0.15s ease !important;
        }

        .facilitator-overview-page .scan-item:last-child {
          border-bottom: none !important;
        }

        .facilitator-overview-page .scan-item:hover {
          background: rgba(79, 70, 229, 0.07) !important;
        }

        .facilitator-overview-page .scan-avatar {
          width: 28px !important;
          height: 28px !important;
          border-radius: 6px !important;
          background: rgba(79, 70, 229, 0.08) !important;
          border: 1px solid rgba(79, 70, 229, 0.15) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          font-weight: 600 !important;
          font-size: 11px !important;
          color: #4f46e5 !important;
          flex-shrink: 0 !important;
        }

        .facilitator-overview-page .scan-name {
          font-weight: 600 !important;
          font-size: 13px !important;
          color: #111827 !important;
        }

        .facilitator-overview-page .scan-detail {
          font-size: 12px !important;
          color: #4b5563 !important;
          margin-top: 2px !important;
        }

        /* ── QUICK ACTIONS ── */
        .facilitator-overview-page .sd-quick-links {
          background: #ffffff !important;
          border: 1px solid rgba(79, 70, 229, 0.12) !important;
          border-radius: 12px !important;
          padding: 24px 20px !important;
          display: flex !important;
          flex-direction: column !important;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.01), 0 2px 4px -1px rgba(0, 0, 0, 0.01) !important;
        }

        .facilitator-overview-page .sd-panel-label {
          font-size: 12px !important;
          font-weight: 700 !important;
          color: #4f46e5 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.08em !important;
          margin-bottom: 16px !important;
        }

        .facilitator-overview-page .sd-quick-card {
          display: flex !important;
          align-items: center !important;
          gap: 16px !important;
          background: #ffffff !important;
          border: 1px solid rgba(79, 70, 229, 0.08) !important;
          border-radius: 12px !important;
          padding: 14px 18px !important;
          text-decoration: none !important;
          transition: all 0.2s ease !important;
          margin-bottom: 12px !important;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.01), 0 1px 3px rgba(0, 0, 0, 0.02) !important;
        }

        .facilitator-overview-page .sd-quick-card:last-child {
          margin-bottom: 0 !important;
        }

        .facilitator-overview-page .sd-quick-card:hover {
          background: #ffffff !important;
          border-color: rgba(79, 70, 229, 0.24) !important;
          transform: translateY(-2px) !important;
          box-shadow: 0 8px 16px rgba(79, 70, 229, 0.06), 0 2px 4px rgba(0, 0, 0, 0.02) !important;
        }

        .facilitator-overview-page .sd-quick-icon {
          width: 40px !important;
          height: 40px !important;
          border-radius: 10px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          flex-shrink: 0 !important;
          background: rgba(79, 70, 229, 0.06) !important;
          color: #4f46e5 !important;
        }

        .facilitator-overview-page .sd-quick-label {
          font-size: 14px !important;
          font-weight: 600 !important;
          color: #111827 !important;
        }

        .facilitator-overview-page .sd-quick-sub {
          font-size: 11px !important;
          color: #6b7280 !important;
        }

        .facilitator-overview-page .sd-quick-arrow {
          color: #4f46e5 !important;
          flex-shrink: 0 !important;
          transition: transform 0.15s ease !important;
        }

        .facilitator-overview-page .sd-quick-card:hover .sd-quick-arrow {
          transform: translateX(2px) !important;
        }

        /* ── STATUS BADGES ── */
        .facilitator-overview-page .status-badge {
          display: inline-block !important;
          padding: 2px 8px !important;
          border-radius: 4px !important;
          font-size: 11px !important;
          font-weight: 600 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.04em !important;
        }

        .facilitator-overview-page .status-badge.present {
          background: rgba(22, 163, 74, 0.1) !important;
          color: #16a34a !important;
          border: 1px solid rgba(22, 163, 74, 0.2) !important;
        }

        .facilitator-overview-page .status-badge.late {
          background: rgba(217, 119, 6, 0.1) !important;
          color: #d97706 !important;
          border: 1px solid rgba(217, 119, 6, 0.2) !important;
        }

        .facilitator-overview-page .status-badge.absent {
          background: rgba(220, 38, 38, 0.1) !important;
          color: #dc2626 !important;
          border: 1px solid rgba(220, 38, 38, 0.2) !important;
        }
      `}</style>
    </div>
  );
}
