"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth-client";
import { Loader2, Users, CheckCircle, XCircle, BookOpen } from "lucide-react";

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

        // Fetch today's scans for this facilitator's sessions (if any)
        // For now, we'll just show empty states since we're cleaning static data
        setTodayAttendance([]);
        setStats({
          totalStudents: 0,
          presentToday: 0,
          absentToday: 0,
          activeSessions: 0
        });

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

  const statItems = [
    { icon: <Users size={20} />, label: "Total Students", value: stats.totalStudents },
    { icon: <CheckCircle size={20} />, label: "Present Today", value: stats.presentToday, color: "var(--success)" },
    { icon: <XCircle size={20} />, label: "Absent Today", value: stats.absentToday, color: "var(--danger)" },
    { icon: <BookOpen size={20} />, label: "Active Sessions", value: stats.activeSessions },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb"><span>Facilitator</span><span>›</span><span>Overview</span></div>
          <h2>Facilitator Dashboard</h2>
          <p>{user?.full_name || "Facilitator"} · {user?.facilitator_profiles?.[0]?.department || "Pharmacy Department"}</p>
        </div>
        <div className="header-actions">
          <Link href="/dashboard/facilitator/generate" className="btn btn-gold" style={{ width: "auto", padding: "9px 18px", fontSize: 13 }}>
            📲 New QR Session
          </Link>
        </div>
      </div>

      <div className="stats-grid">
        {statItems.map((s) => (
          <div className="stat-card" key={s.label}>
            <div className="stat-icon" style={{ color: s.color || "var(--gold)" }}>{s.icon}</div>
            <div className="stat-label">{s.label}</div>
            <div className="stat-val" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="content-grid">
        <div className="panel">
          <div className="panel-header">
            <h3>Today&apos;s Attendance</h3>
            <a style={{ color: "var(--gold)", fontSize: 12, cursor: "pointer" }}>Export →</a>
          </div>
          <div className="table-wrap">
            {todayAttendance.length > 0 ? (
              <table>
                <thead><tr><th>Student</th><th>Section</th><th>Time In</th><th>Status</th></tr></thead>
                <tbody>
                  {todayAttendance.map((s, idx) => (
                    <tr key={idx}>
                      <td>{s.name}</td>
                      <td><span className="tag">{s.section}</span></td>
                      <td>{s.timeIn}</td>
                      <td><span className={`badge badge-${s.status}`}>{s.status.toUpperCase()}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>
                No attendance recorded for today yet.
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-header"><h3>Quick Actions</h3></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Link href="/dashboard/facilitator/generate" className="btn btn-gold" style={{ fontSize: 13 }}>📲 Generate QR Code</Link>
              <Link href="/dashboard/facilitator/reports" className="btn btn-outline" style={{ fontSize: 13 }}>📊 View Reports</Link>
              <Link href="/dashboard/facilitator/students" className="btn btn-outline" style={{ fontSize: 13 }}>👥 Manage Students</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
