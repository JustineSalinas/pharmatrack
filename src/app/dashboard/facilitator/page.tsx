"use client";
import { useState } from "react";
import Link from "next/link";

const todayStudents = [
  { name: "Ana Santos", section: "PharmA", timeIn: "7:28 AM", status: "present" },
  { name: "Ben Cruz", section: "PharmA", timeIn: "7:31 AM", status: "present" },
  { name: "Clara Tan", section: "PharmB", timeIn: "—", status: "absent" },
  { name: "Diego Lim", section: "PharmA", timeIn: "7:45 AM", status: "late" },
  { name: "Eva Reyes", section: "PharmB", timeIn: "7:29 AM", status: "present" },
  { name: "Felix Go", section: "PharmC", timeIn: "—", status: "absent" },
  { name: "Grace Yu", section: "PharmA", timeIn: "7:33 AM", status: "present" },
];

const sections = [
  { name: "PharmA", total: 42, present: 40 },
  { name: "PharmB", total: 40, present: 35 },
  { name: "PharmC", total: 42, present: 33 },
];

const stats = [
  { icon: "👥", label: "Total Students", value: "124" },
  { icon: "✅", label: "Present Today", value: "108", color: "var(--success)", trend: "↑ 87%", trendClass: "trend-up" },
  { icon: "❌", label: "Absent Today", value: "16", color: "var(--danger)", trend: "↓ 13%", trendClass: "trend-down" },
  { icon: "📚", label: "Active Sessions", value: "3" },
];

export default function FacilitatorOverview() {
  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb"><span>Facilitator</span><span>›</span><span>Overview</span></div>
          <h2>Facilitator Dashboard</h2>
          <p>Dr. Maria Reyes · Pharmacology Department</p>
        </div>
        <div className="header-actions">
          <Link href="/dashboard/facilitator/generate" className="btn btn-gold" style={{ width: "auto", padding: "9px 18px", fontSize: 13 }}>
            📲 New QR Session
          </Link>
        </div>
      </div>

      <div className="stats-grid">
        {stats.map((s) => (
          <div className="stat-card" key={s.label}>
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-label">{s.label}</div>
            <div className="stat-val" style={{ color: s.color }}>{s.value}</div>
            {s.trend && <span className={`stat-trend ${s.trendClass}`}>{s.trend}</span>}
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
            <table>
              <thead><tr><th>Student</th><th>Section</th><th>Time In</th><th>Status</th></tr></thead>
              <tbody>
                {todayStudents.map((s) => (
                  <tr key={s.name}>
                    <td>{s.name}</td>
                    <td><span className="tag">{s.section}</span></td>
                    <td>{s.timeIn}</td>
                    <td><span className={`badge badge-${s.status}`}>{s.status.toUpperCase()}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-header"><h3>Section Summary</h3></div>
            {sections.map((s) => (
              <div key={s.name} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                  <span>{s.name}</span>
                  <span style={{ color: "var(--muted)" }}>{s.present}/{s.total}</span>
                </div>
                <div style={{ background: "var(--surface2)", borderRadius: 99, height: 7 }}>
                  <div style={{
                    width: `${Math.round(s.present / s.total * 100)}%`, height: "100%",
                    background: "linear-gradient(90deg, var(--gold), var(--success))", borderRadius: 99,
                  }} />
                </div>
              </div>
            ))}
          </div>

          <div className="panel">
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
