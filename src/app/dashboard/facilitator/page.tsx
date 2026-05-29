"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth-client";
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
  ScanLine
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

  useEffect(() => {
    async function fetchFacilitatorData() {
      try {
        const u = await getCurrentUser();
        setUser(u);

        // 1. Total Students
        const { count: studentCount } = await supabase
          .from("users")
          .select("*", { count: "exact", head: true })
          .eq("account_type", "student");

        // 2. Active Events Today
        const todayStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
        const { count: activeEventsCount } = await supabase
          .from("events")
          .select("*", { count: "exact", head: true })
          .eq("date", todayStr);

        // 3. Scans Today & Students Absent (client-side classification from attendance_records)
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
            users ( 
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
            timeIn: r.time_in ? new Date(r.time_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—",
            status: r.status || "present",
            eventName: r.events?.name || "Event"
          };
        });

        setTodayAttendance(formatted);

      } catch (err) {
        console.error("Facilitator dash error", err);
      } finally {
        setLoading(false);
      }
    }
    fetchFacilitatorData();
  }, []);

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
      href: "/dashboard/facilitator/generate",
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
    <div className="fade-in sd-root">
      {/* HEADER */}
      <header className="sd-header">
        <div>
          <p className="sd-header-eyebrow">Facilitator Portal</p>
          <h1 className="sd-header-title">
            Good {getGreeting()}, <span className="sd-header-name">{firstName}</span> 👋
          </h1>
        </div>
        <div className="sd-header-date">
          <Calendar size={13} />
          {new Date().toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric" })}
        </div>
      </header>

      {/* STATS STRIP */}
      <div className="sd-stat-tiles" style={{ gridTemplateColumns: "repeat(4, 1fr)", gridTemplateRows: "none", width: "100%", display: "grid", gap: "16px", marginBottom: "24px" }}>
        <div className="sd-stat-tile">
          <div className="sd-tile-icon-wrap" style={{ background: "rgba(107, 114, 128, 0.08)", color: "var(--muted)" }}>
            <Users size={18} />
          </div>
          <div>
            <div className="sd-tile-number">{stats.totalStudents}</div>
            <div className="sd-tile-label">Total Students</div>
          </div>
        </div>

        <div className="sd-stat-tile">
          <div className="sd-tile-icon-wrap" style={{ background: "var(--gold-dim)", color: "var(--gold)" }}>
            <CalendarCheck size={18} />
          </div>
          <div>
            <div className="sd-tile-number">{stats.activeEventsToday}</div>
            <div className="sd-tile-label">Active Events</div>
          </div>
        </div>

        <div className="sd-stat-tile">
          <div className="sd-tile-icon-wrap" style={{ background: "rgba(22, 163, 74, 0.08)", color: "var(--success)" }}>
            <LogIn size={18} />
          </div>
          <div>
            <div className="sd-tile-number">{stats.scansToday}</div>
            <div className="sd-tile-label">Scans Today</div>
          </div>
        </div>

        <div className="sd-stat-tile">
          <div className="sd-tile-icon-wrap" style={{ background: "rgba(220, 38, 38, 0.08)", color: "var(--danger)" }}>
            <LogOut size={18} />
          </div>
          <div>
            <div className="sd-tile-number">{stats.studentsAbsent}</div>
            <div className="sd-tile-label">Absent Today</div>
          </div>
        </div>
      </div>

      {/* BOTTOM LAYOUT */}
      <div className="sd-bottom-row" style={{ gridTemplateColumns: "1fr 300px" }}>
        {/* LEFT: Live Activity Feed */}
        <div className="recent-scans">
          <div className="recent-scans-header">
            <h3>Live Activity Feed</h3>
            <Link href="/dashboard/facilitator/attendance">
              View all <ArrowRight size={12} style={{ display: "inline", marginLeft: 2, verticalAlign: "middle" }} />
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
                      <Clock size={10} style={{ display: "inline", marginRight: 3, verticalAlign: "middle" }} />
                      {scan.eventName} · {scan.timeIn} · <span className="tag" style={{ border: "1px solid var(--border)", padding: "1px 4px", borderRadius: 4, fontSize: 10 }}>{scan.section}</span>
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
                  width: 48,
                  height: 48,
                  border: "1px dashed var(--border)",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ScanLine size={20} color="var(--dimmed)" />
              </div>
              <p style={{ fontSize: 13, color: "var(--dimmed)", textAlign: "center", margin: 0, lineHeight: 1.6 }}>
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
            <p className="sd-panel-label" style={{ marginBottom: 10 }}>
              Quick Actions
            </p>
            <div className="sd-quick-grid" style={{ gridTemplateColumns: "1fr" }}>
              {quickActions.map((a) => (
                <Link href={a.href as any} className="sd-quick-card" key={a.label}>
                  <div className="sd-quick-icon" style={{ background: "var(--gold-dim)", color: "var(--gold)" }}>
                    {a.icon}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1 }}>
                    <span className="sd-quick-label" style={{ fontWeight: 600 }}>
                      {a.label}
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--muted)" }}>{a.sub}</span>
                  </div>
                  <ChevronRight size={14} className="sd-quick-arrow" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
