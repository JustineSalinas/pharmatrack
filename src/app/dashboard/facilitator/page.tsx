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

  const scanLineKeyframes = `
    @keyframes scanLine {
      0%   { top: 8px; opacity: 0; }
      10%  { opacity: 1; }
      90%  { opacity: 1; }
      100% { top: calc(100% - 8px); opacity: 0; }
    }
    .scan-line-anim {
      position: absolute;
      left: 6px;
      right: 6px;
      height: 1.5px;
      background: rgba(200, 146, 42, 0.55);
      animation: scanLine 2s ease-in-out infinite;
    }
  `;

  return (
    <>
      <style>{scanLineKeyframes}</style>
      {/* Page Header */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "var(--muted)", textTransform: "uppercase", marginBottom: 4 }}>
          Facilitator
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Dashboard</h2>
      </div>

      {/* Top Banner Card — Attendance Rate */}
      <div style={{
        background: "var(--card, #13152a)",
        border: "1px solid var(--border, rgba(255,255,255,0.07))",
        borderRadius: 12,
        padding: "24px 28px",
        marginBottom: 20,
        marginTop: 32,
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "var(--muted)", textTransform: "uppercase", marginBottom: 8 }}>
          Today's Attendance Rate
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, marginBottom: 10 }}>
          <span style={{ fontSize: 48, fontWeight: 700, lineHeight: 1, color: "var(--foreground, #fff)" }}>{attendanceRate}</span>
          <span style={{ fontSize: 22, fontWeight: 600, color: "var(--muted)", marginBottom: 6 }}>%</span>
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>
          Based on students enrolled in your sessions
        </div>
        {/* Progress bar */}
        <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 99, height: 4, position: "relative" }}>
          <div style={{
            width: `${attendanceRate}%`,
            background: "rgba(255,255,255,0.3)",
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
            { icon: <Users size={16} />, label: "Total Students", value: stats.totalStudents },
            { icon: <CheckCircle size={16} />, label: "Present Today", value: stats.presentToday },
            { icon: <XCircle size={16} />, label: "Absent Today", value: stats.absentToday },
          ].map((s, i) => (
            <div key={s.label} style={{
              textAlign: "left",
              borderRight: i < 2 ? "1px solid var(--border, rgba(255,255,255,0.07))" : "none",
              padding: "0 28px",
            }}>
              <div style={{ color: "var(--muted)", marginBottom: 8 }}>{s.icon}</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: "var(--foreground, #fff)", lineHeight: 1, marginBottom: 6 }}>
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
            <span style={{ fontSize: 13, fontWeight: 600 }}>Live Activity Feed</span>
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
            /* ── Scanner Empty State ── */
            <div style={{ padding: "52px 20px", textAlign: "center" }}>
              {/* Scanner frame */}
              <div style={{
                width: 52,
                height: 52,
                border: "1.5px dashed rgba(255,255,255,0.18)",
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
                position: "relative",
                overflow: "hidden",
              }}>
                {/* Corner brackets */}
                {[
                  { top: 5, left: 5, borderWidth: "1.5px 0 0 1.5px" },
                  { top: 5, right: 5, borderWidth: "1.5px 1.5px 0 0" },
                  { bottom: 5, left: 5, borderWidth: "0 0 1.5px 1.5px" },
                  { bottom: 5, right: 5, borderWidth: "0 1.5px 1.5px 0" },
                ].map((style, i) => (
                  <span key={i} style={{
                    position: "absolute",
                    width: 9,
                    height: 9,
                    borderColor: "rgba(255,255,255,0.35)",
                    borderStyle: "solid",
                    ...style,
                  }} />
                ))}
                {/* Animated scan line */}
                <div className="scan-line-anim" />
              </div>

              <div style={{ fontSize: 13.5, color: "rgba(255,255,255,0.52)", marginBottom: 4 }}>
                No scans recorded yet.
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.28)", marginBottom: 18 }}>
                Start an event to begin tracking.
              </div>
              <Link
                href="/dashboard/facilitator/generate"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "8px 20px",
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.18)",
                  borderRadius: 8,
                  color: "rgba(255,255,255,0.72)",
                  fontSize: 13.5,
                  textDecoration: "none",
                  transition: "background 0.15s, border-color 0.15s",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.28)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)";
                }}
              >
                <QrCode size={15} style={{ opacity: 0.6 }} />
                Open Scanner
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
