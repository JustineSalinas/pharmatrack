"use client";

import { useState } from "react";
import { FileText, Download, TrendingUp, Users, Award, AlertTriangle, Calendar, Filter } from "lucide-react";

const monthly = [
  { month: "Jan", rate: 82 }, { month: "Feb", rate: 88 }, { month: "Mar", rate: 91 }, { month: "Apr", rate: 0 },
];

const topStudents = [
  { name: "Eva Reyes", id: "2026-005", section: "PharmB", rate: 100 },
  { name: "Ana Santos", id: "2026-001", section: "PharmA", rate: 95 },
  { name: "Grace Yu", id: "2026-007", section: "PharmA", rate: 93 },
  { name: "Jake Torres", id: "2026-010", section: "PharmA", rate: 91 },
  { name: "Pharmacology Avg", id: "—", section: "All", rate: 92 },
];

const bottomStudents = [
  { name: "Felix Go", id: "2026-006", section: "PharmC", rate: 65 },
  { name: "Clara Tan", id: "2026-003", section: "PharmB", rate: 72 },
  { name: "Mark Bautista", id: "2026-018", section: "PharmB", rate: 71 },
];

export default function AdminReports() {
  const [loading, setLoading] = useState(false);
  const maxMonthly = Math.max(...monthly.map(m => m.rate));

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: "32px" }}>
        <div>
          <div className="breadcrumb" style={{ fontSize: "0.85rem", color: "var(--muted)", letterSpacing: "0.5px", marginBottom: "4px" }}>
            <span>Admin Control</span><span style={{ margin: "0 6px" }}>·</span><span>Analytics</span>
          </div>
          <h2 style={{ fontSize: "2rem", fontWeight: 800, margin: 0, letterSpacing: "-0.5px" }}>Analytics & Reports</h2>
          <p style={{ color: "var(--muted)", marginTop: "4px" }}>Department-wide participation and performance insights</p>
        </div>
        <div className="header-actions">
           <button className="btn btn-outline" style={{ width: "auto", padding: "0 20px", height: "44px", borderRadius: "12px", gap: "8px" }}>
             <Download size={18} /> Export CSV
           </button>
           <button className="btn btn-gold" style={{ width: "auto", padding: "0 20px", height: "44px", borderRadius: "12px", gap: "8px" }}>
             <FileText size={18} /> Export PDF
           </button>
        </div>
      </div>

      <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "20px", marginBottom: "32px" }}>
        {[
          { label: "Dept. Avg Rate", value: "87.3%", color: "var(--success)", icon: <TrendingUp size={24} /> },
          { label: "Total QR Sessions", value: "312", icon: <Calendar size={24} /> },
          { label: "Perfect Records", value: "18", sub: "students", icon: <Award size={24} /> },
          { label: "Flagged Students", value: "14", color: "var(--danger)", sub: "below 75%", icon: <AlertTriangle size={24} /> },
        ].map((s) => (
          <div className="stat-card" key={s.label} style={{ position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: "15px", right: "15px", opacity: 0.1, color: "var(--white)" }}>{s.icon}</div>
            <div className="stat-label" style={{ fontSize: "0.85rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "12px" }}>{s.label}</div>
            <div className="stat-val" style={{ fontSize: "1.8rem", fontWeight: 800, color: s.color || "var(--white)" }}>{s.value}</div>
            {s.sub && <div className="stat-sub" style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "4px" }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      <div className="content-grid" style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "24px", marginBottom: "32px" }}>
        {/* Monthly Trend Chart */}
        <div className="panel" style={{ padding: "30px" }}>
          <div className="panel-header" style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700 }}>Monthly Attendance Trend</h3>
            <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Academic Year 2026</span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "20px", height: "160px", marginTop: "32px", padding: "0 20px" }}>
            {monthly.map((d) => (
              <div key={d.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                {d.rate > 0 && <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--gold)" }}>{d.rate}%</span>}
                <div style={{
                  width: "100%",
                  height: d.rate > 0 ? `${(d.rate / maxMonthly) * 120}px` : "8px",
                  background: d.rate > 0 ? "linear-gradient(to top, var(--gold), rgba(212, 175, 55, 0.2))" : "rgba(255,255,255,0.05)",
                  borderRadius: "6px 6px 2px 2px", 
                  transition: "height 0.3s ease",
                  boxShadow: d.rate > 0 ? "0 4px 15px rgba(212, 175, 55, 0.1)" : "none"
                }} />
                <span style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 500 }}>{d.month}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: "24px", padding: "16px 0 0", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.9rem", color: "var(--muted)" }}>Semester Average Participation</span>
            <strong style={{ size: "1rem", color: "var(--gold)" }}>84.7%</strong>
          </div>
        </div>

        {/* Section breakdown */}
        <div className="panel" style={{ padding: "30px" }}>
          <div className="panel-header" style={{ marginBottom: "24px" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700 }}>Section Breakdown</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {[["PharmA", 95, 42], ["PharmB", 87, 40], ["PharmC", 80, 42]].map(([name, rate, count]) => (
              <div key={name as string}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", marginBottom: "8px" }}>
                  <div style={{ fontWeight: 600 }}>
                    {name} <span style={{ color: "var(--muted)", fontWeight: 400, marginLeft: "8px", fontSize: "0.8rem" }}>{count} students</span>
                  </div>
                  <strong style={{ color: "var(--white)" }}>{rate}%</strong>
                </div>
                <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: "10px", height: "8px", overflow: "hidden" }}>
                  <div style={{ width: `${rate as number}%`, height: "100%", background: "linear-gradient(90deg, var(--gold), #10b981)", borderRadius: "10px" }} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: "24px", padding: "16px 0 0", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <h4 style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "1px", color: "var(--muted)", marginBottom: "16px" }}>Subject Performance</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[["Pharmacology 301", 92], ["Pharmacognosy", 88], ["Clinical Pharmacy", 84], ["Pharma Chem", 91]].map(([s, r]) => (
                <div key={s as string} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem" }}>
                  <span style={{ color: "var(--muted)" }}>{s}</span>
                  <span className={`tag ${Number(r) >= 90 ? "present" : "late"}`} style={{ fontSize: "0.75rem", padding: "2px 8px" }}>{r}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="content-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        {/* Top performers */}
        <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
          <div className="panel-header" style={{ padding: "24px 30px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "10px" }}>
               🏆 Top Performance Indicators
            </h3>
          </div>
          <div className="table-wrap">
            <table style={{ width: "100%" }}>
              <thead><tr><th>Rank</th><th>Student/Group</th><th>Track</th><th>Rate</th></tr></thead>
              <tbody>
                {topStudents.map((s, i) => (
                  <tr key={s.id}>
                    <td style={{ fontSize: "14px" }}>{"🥇🥈🥉🏅🏅"[i]}</td>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td><span className="tag" style={{ background: "rgba(255,255,255,0.03)" }}>{s.section}</span></td>
                    <td><span className="status-badge present" style={{ fontSize: "0.75rem" }}>{s.rate}%</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* At risk */}
        <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
          <div className="panel-header" style={{ padding: "24px 30px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "10px" }}>
               ⚠️ Attendance Risk List
            </h3>
            <span style={{ fontSize: "0.75rem", color: "var(--danger)", fontWeight: 600 }}>INTERVENTION REQ.</span>
          </div>
          <div className="table-wrap">
            <table style={{ width: "100%" }}>
              <thead><tr><th>Student</th><th>Section</th><th>Rate</th><th style={{ textAlign: "right", paddingRight: "30px" }}>Action</th></tr></thead>
              <tbody>
                {bottomStudents.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{s.name}</div>
                      <div style={{ fontSize: "0.7rem", color: "var(--muted)", fontFamily: "monospace" }}>{s.id}</div>
                    </td>
                    <td><span className="tag" style={{ background: "rgba(255,255,255,0.03)" }}>{s.section}</span></td>
                    <td><span className="status-badge absent" style={{ fontSize: "0.75rem" }}>{s.rate}%</span></td>
                    <td style={{ textAlign: "right", paddingRight: "30px" }}>
                      <button className="btn btn-outline" style={{ width: "auto", padding: "6px 12px", fontSize: "0.75rem", borderRadius: "8px" }}>Notify Agent</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
