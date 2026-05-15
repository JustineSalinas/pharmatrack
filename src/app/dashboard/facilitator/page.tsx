"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth-client";
import {
  Loader2, Users, CheckCircle, XCircle, BookOpen,
  QrCode, BarChart2, UserCog, Activity
} from "lucide-react";

export default function FacilitatorOverview() {
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState({
    totalStudents: 0,
    presentToday: 0,
    absentToday: 0,
    activeSessions: 0
  });
  const [todayAttendance, setTodayAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFacilitatorData() {
      try {
        const u = await getCurrentUser();
        setUser(u);

        setTodayAttendance([]);
        setStats({ totalStudents: 0, presentToday: 0, absentToday: 0, activeSessions: 0 });

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
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <Loader2 className="animate-spin" size={40} color="var(--gold)" />
      </div>
    );
  }

  const attendanceRate =
    stats.totalStudents > 0
      ? Math.round((stats.presentToday / stats.totalStudents) * 100)
      : 0;

  const quickActions = [
    {
      icon: <QrCode size={16} />,
      label: "Generate QR",
      sub: "Start a new session",
      href: "/dashboard/facilitator/generate",
    },
    {
      icon: <BarChart2 size={16} />,
      label: "View Reports",
      sub: "Attendance records",
      href: "/dashboard/facilitator/reports",
    },
    {
      icon: <UserCog size={16} />,
      label: "Manage Students",
      sub: "Review & manage",
      href: "/dashboard/facilitator/students",
    },
  ];

  return (
    <>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <span>Facilitator</span><span>›</span><span>Dashboard</span>
          </div>
          <h2>Dashboard</h2>
        </div>
        <div className="header-actions">
          <Link
            href="/dashboard/facilitator/generate"
            className="btn btn-gold"
            style={{ width: "auto", padding: "9px 18px", fontSize: 13 }}
          >
            📲 New QR Session
          </Link>
        </div>
      </div>

      {/* Top Banner Card — Attendance Rate */}
      <div style={{
        background: "var(--card, #13152a)",
        border: "1px solid var(--border, rgba(255,255,255,0.07))",
        borderRadius: 12,
        padding: "24px 28px",
        marginBottom: 20,
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "var(--muted)", textTransform: "uppercase", marginBottom: 8 }}>
          Today's Attendance Rate
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, marginBottom: 10 }}>
          <span style={{ fontSize: 48, fontWeight: 700, lineHeight: 1, color: "var(--gold)" }}>{attendanceRate}</span>
          <span style={{ fontSize: 22, fontWeight: 600, color: "var(--muted)", marginBottom: 6 }}>%</span>
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>
          Based on students enrolled in your sessions
        </div>
        {/* Progress bar */}
        <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 99, height: 6, position: "relative" }}>
          <div style={{
            width: `${attendanceRate}%`,
            background: "var(--gold)",
            borderRadius: 99,
            height: "100%",
            transition: "width 0.6s ease",
          }} />
          <span style={{ position: "absolute", right: 0, top: -18, fontSize: 11, color: "var(--muted)" }}>100%</span>
          <span style={{ position: "absolute", left: 0, top: -18, fontSize: 11, color: "var(--muted)" }}>0%</span>
        </div>

        {/* 3-col stats row */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 0,
          marginTop: 28,
          borderTop: "1px solid var(--border, rgba(255,255,255,0.07))",
          paddingTop: 20,
        }}>
          {[
            { icon: <Users size={18} />, label: "Total Students", value: stats.totalStudents },
            { icon: <CheckCircle size={18} />, label: "Present Today", value: stats.presentToday, color: "var(--success, #4ade80)" },
            { icon: <XCircle size={18} />, label: "Absent Today", value: stats.absentToday, color: "var(--danger, #f87171)" },
          ].map((s, i) => (
            <div key={s.label} style={{
              textAlign: "center",
              borderRight: i < 2 ? "1px solid var(--border, rgba(255,255,255,0.07))" : "none",
              padding: "0 16px",
            }}>
              <div style={{ color: s.color || "var(--gold)", marginBottom: 6 }}>{s.icon}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: s.color || "var(--foreground, #fff)", lineHeight: 1, marginBottom: 4 }}>
                {s.value}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom: Attendance Feed + Quick Actions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 16, alignItems: "start" }}>

        {/* Attendance Feed */}
        <div style={{
          background: "var(--card, #13152a)",
          border: "1px solid var(--border, rgba(255,255,255,0.07))",
          borderRadius: 12,
          overflow: "hidden",
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid var(--border, rgba(255,255,255,0.07))",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Activity size={15} color="var(--gold)" />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Today's Attendance</span>
            </div>
            <a style={{ color: "var(--gold)", fontSize: 12, cursor: "pointer" }}>View all →</a>
          </div>

          {todayAttendance.length > 0 ? (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border, rgba(255,255,255,0.07))" }}>
                  {["Student", "Section", "Time In", "Status"].map(h => (
                    <th key={h} style={{ padding: "10px 20px", textAlign: "left", fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {todayAttendance.map((s, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid var(--border, rgba(255,255,255,0.04))" }}>
                    <td style={{ padding: "12px 20px" }}>{s.name}</td>
                    <td style={{ padding: "12px 20px" }}><span className="tag">{s.section}</span></td>
                    <td style={{ padding: "12px 20px", color: "var(--muted)", fontSize: 12 }}>{s.timeIn}</td>
                    <td style={{ padding: "12px 20px" }}><span className={`badge badge-${s.status}`}>{s.status.toUpperCase()}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--muted)" }}>
              <Activity size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
              <div style={{ fontSize: 13 }}>No attendance recorded for today yet.</div>
              <div style={{ fontSize: 12, marginTop: 4, opacity: 0.6 }}>Start a QR session to begin tracking.</div>
              <Link href="/dashboard/facilitator/generate" className="btn btn-gold" style={{ display: "inline-block", marginTop: 16, padding: "8px 18px", fontSize: 12, width: "auto" }}>
                📲 Start Session
              </Link>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div style={{
          background: "var(--card, #13152a)",
          border: "1px solid var(--border, rgba(255,255,255,0.07))",
          borderRadius: 12,
          overflow: "hidden",
        }}>
          <div style={{
            padding: "14px 16px",
            borderBottom: "1px solid var(--border, rgba(255,255,255,0.07))",
            fontSize: 11, fontWeight: 600, color: "var(--muted)",
            textTransform: "uppercase", letterSpacing: "0.08em",
          }}>
            Quick Actions
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {quickActions.map((a, i) => (
              <Link
                key={a.label}
                href={a.href}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "14px 16px",
                  borderBottom: i < quickActions.length - 1 ? "1px solid var(--border, rgba(255,255,255,0.05))" : "none",
                  color: "var(--foreground, #fff)",
                  textDecoration: "none",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: "rgba(255,200,0,0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--gold)", flexShrink: 0,
                }}>
                  {a.icon}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{a.label}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>{a.sub}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </>
  );
}
