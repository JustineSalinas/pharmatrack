"use client";
import { useState } from "react";

const weeklyData = [
  { week: "W1", rate: 82 }, { week: "W2", rate: 88 }, { week: "W3", rate: 85 },
  { week: "W4", rate: 91 }, { week: "W5", rate: 87 }, { week: "W6", rate: 89 },
];

const subjectData = [
  { name: "Pharmacology 301", rate: 92, sessions: 12, students: 124 },
  { name: "Pharmacognosy", rate: 88, sessions: 10, students: 84 },
  { name: "Clinical Pharmacy", rate: 84, sessions: 11, students: 84 },
  { name: "Pharma Chemistry", rate: 91, sessions: 10, students: 42 },
];

const atRisk = [
  { name: "Clara Tan", id: "2026-003", section: "PharmB", rate: 72 },
  { name: "Felix Go", id: "2026-006", section: "PharmC", rate: 65 },
  { name: "Mark Bautista", id: "2026-018", section: "PharmB", rate: 71 },
];

const topEvents = [
  { name: "Pharmacology 301 – Lec 04", date: "Jan 22, 2026", attendees: 121, total: 124, section: "PharmA" },
  { name: "Pharma Chemistry – Lab 07", date: "Feb 5, 2026", attendees: 118, total: 124, section: "All" },
  { name: "Clinical Pharmacy – Lec 12", date: "Mar 10, 2026", attendees: 115, total: 124, section: "PharmB" },
  { name: "Pharmacognosy – Lec 02", date: "Jan 15, 2026", attendees: 112, total: 124, section: "PharmC" },
  { name: "Pharmacology 301 – Lab 09", date: "Mar 18, 2026", attendees: 110, total: 124, section: "PharmA" },
];

const allStudents = [
  { name: "Ana Reyes", id: "2026-001", section: "PharmA", attended: 46, total: 48, rate: 96 },
  { name: "Ben Cruz", id: "2026-002", section: "PharmA", attended: 44, total: 48, rate: 92 },
  { name: "Clara Tan", id: "2026-003", section: "PharmB", attended: 35, total: 48, rate: 72 },
  { name: "Diana Santos", id: "2026-004", section: "PharmA", attended: 47, total: 48, rate: 98 },
  { name: "Ethan Lim", id: "2026-005", section: "PharmC", attended: 42, total: 48, rate: 88 },
  { name: "Felix Go", id: "2026-006", section: "PharmC", attended: 31, total: 48, rate: 65 },
  { name: "Grace Yu", id: "2026-007", section: "PharmB", attended: 45, total: 48, rate: 94 },
  { name: "Hugo Dela Cruz", id: "2026-008", section: "PharmA", attended: 43, total: 48, rate: 90 },
  { name: "Iris Tan", id: "2026-009", section: "PharmB", attended: 40, total: 48, rate: 83 },
  { name: "Mark Bautista", id: "2026-018", section: "PharmB", attended: 34, total: 48, rate: 71 },
];

const SUB_TABS = [
  { key: "events", label: "Most Attended Events" },
  { key: "subjects", label: "Subject Breakdown" },
  { key: "students", label: "Attendance Per Student" },
  { key: "atrisk", label: "At-Risk Students" },
] as const;

type SubTab = typeof SUB_TABS[number]["key"];

export default function FacultyReports() {
  const maxRate = Math.max(...weeklyData.map(d => d.rate));
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("events");

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb"><span>Faculty</span><span>›</span><span>Reports</span></div>
          <h2>Reports &amp; Analytics</h2>
          <p>Semester overview · 2025–2026 2nd Sem</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline" style={{ width: "auto", padding: "9px 18px", fontSize: 13 }}>⬇️ Export CSV</button>
          <button className="btn btn-gold" style={{ width: "auto", padding: "9px 18px", fontSize: 13 }}>⬇️ Export PDF</button>
        </div>
      </div>

      <div className="stats-grid">
        {[
          { label: "Avg Attendance Rate", value: "87.3%", color: "var(--success)" },
          { label: "Total Sessions", value: "48" },
          { label: "Perfect Attendance", value: "18", sub: "students" },
          { label: "At-Risk Students", value: `${atRisk.length}`, color: "var(--danger)", sub: "below 75%" },
        ].map((s) => (
          <div className="stat-card" key={s.label}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-val" style={{ color: s.color }}>{s.value}</div>
            {s.sub && <div className="stat-sub">{s.sub}</div>}
          </div>
        ))}
      </div>

      <div className="content-grid" style={{ marginBottom: 20 }}>
        {/* Weekly trend */}
        <div className="panel">
          <div className="panel-header"><h3>Weekly Attendance Trend</h3></div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 140, marginTop: 20, padding: "0 8px" }}>
            {weeklyData.map((d) => (
              <div key={d.week} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>{d.rate}%</span>
                <div style={{
                  width: "100%", height: `${(d.rate / maxRate) * 100}px`,
                  background: d.rate >= 90 ? "linear-gradient(to top, var(--success), rgba(78,205,196,0.4))" : "linear-gradient(to top, var(--gold), rgba(232,200,74,0.4))",
                  borderRadius: "4px 4px 0 0", minHeight: 4,
                }} />
                <span style={{ fontSize: 11, color: "var(--muted)" }}>{d.week}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Section comparison */}
        <div className="panel">
          <div className="panel-header"><h3>Section Comparison</h3></div>
          <div style={{ marginTop: 12 }}>
            {[["PharmA", 95], ["PharmB", 87], ["PharmC", 80]].map(([name, rate]) => (
              <div key={name as string} style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                  <span>{name}</span><strong>{rate}%</strong>
                </div>
                <div style={{ background: "var(--surface2)", borderRadius: 99, height: 8 }}>
                  <div style={{ width: `${rate}%`, height: "100%", background: "linear-gradient(90deg, var(--gold), var(--success))", borderRadius: 99 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Compact inline sub-navbar ── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 8px",
        background: "var(--surface)",
        borderRadius: 10,
        border: "1px solid var(--border)",
        marginBottom: 16,
      }}>
        {SUB_TABS.map((tab) => {
          const isActive = activeSubTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveSubTab(tab.key)}
              style={{
                flex: 1,
                padding: "8px 10px",
                fontSize: 12,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "var(--bg)" : "var(--muted)",
                background: isActive
                  ? "linear-gradient(135deg, var(--gold), #d4a83a)"
                  : "transparent",
                border: "none",
                borderRadius: 7,
                cursor: "pointer",
                transition: "all 0.2s ease",
                whiteSpace: "nowrap",
                letterSpacing: "0.01em",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab: Most Attended Events ── */}
      {activeSubTab === "events" && (
        <div className="panel">
          <div className="panel-header">
            <h3>🏆 Most Attended Events</h3>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Top 5 by attendance count</span>
          </div>
          <table>
            <thead>
              <tr><th>#</th><th>Event / Session</th><th>Date</th><th>Section</th><th>Attendees</th><th>Rate</th></tr>
            </thead>
            <tbody>
              {topEvents.map((ev, i) => {
                const pct = Math.round((ev.attendees / ev.total) * 100);
                return (
                  <tr key={ev.name}>
                    <td style={{ fontWeight: 700, color: "var(--gold)", width: 32 }}>{i + 1}</td>
                    <td>{ev.name}</td>
                    <td style={{ fontSize: 12, color: "var(--muted)" }}>{ev.date}</td>
                    <td><span className="tag">{ev.section}</span></td>
                    <td style={{ fontWeight: 600 }}>{ev.attendees}/{ev.total}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ background: "var(--surface2)", borderRadius: 99, height: 6, width: 60 }}>
                          <div style={{
                            width: `${pct}%`, height: "100%",
                            background: pct >= 90
                              ? "linear-gradient(90deg, var(--success), #6ee7b7)"
                              : "linear-gradient(90deg, var(--gold), #fbbf24)",
                            borderRadius: 99,
                          }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: pct >= 90 ? "var(--success)" : "var(--gold)" }}>{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Tab: Subject Breakdown ── */}
      {activeSubTab === "subjects" && (
        <div className="panel">
          <div className="panel-header"><h3>📚 Subject Breakdown</h3></div>
          <table>
            <thead><tr><th>Subject</th><th>Sessions</th><th>Enrolled</th><th>Avg Rate</th><th>Trend</th></tr></thead>
            <tbody>
              {subjectData.map((s) => (
                <tr key={s.name}>
                  <td>{s.name}</td>
                  <td>{s.sessions}</td>
                  <td>{s.students}</td>
                  <td><span className={s.rate >= 85 ? "tag" : "badge badge-absent"}>{s.rate}%</span></td>
                  <td>
                    <div style={{ background: "var(--surface2)", borderRadius: 99, height: 6, width: 80 }}>
                      <div style={{ width: `${s.rate}%`, height: "100%", background: "linear-gradient(90deg, var(--gold), var(--success))", borderRadius: 99 }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Tab: Attendance Per Student ── */}
      {activeSubTab === "students" && (
        <div className="panel">
          <div className="panel-header">
            <h3>👥 Attendance Per Student</h3>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Showing {allStudents.length} students</span>
          </div>
          <table>
            <thead>
              <tr><th>Student</th><th>ID</th><th>Section</th><th>Attended</th><th>Rate</th><th>Status</th></tr>
            </thead>
            <tbody>
              {allStudents.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 12, color: "var(--muted)" }}>{s.id}</td>
                  <td><span className="tag">{s.section}</span></td>
                  <td style={{ fontSize: 13 }}>{s.attended}/{s.total}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ background: "var(--surface2)", borderRadius: 99, height: 6, width: 60 }}>
                        <div style={{
                          width: `${s.rate}%`, height: "100%",
                          background: s.rate >= 85
                            ? "linear-gradient(90deg, var(--success), #6ee7b7)"
                            : s.rate >= 75
                              ? "linear-gradient(90deg, var(--gold), #fbbf24)"
                              : "linear-gradient(90deg, var(--danger), #fca5a5)",
                          borderRadius: 99,
                        }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{s.rate}%</span>
                    </div>
                  </td>
                  <td>
                    {s.rate >= 90 ? (
                      <span className="badge badge-present" style={{ fontSize: 11 }}>Excellent</span>
                    ) : s.rate >= 75 ? (
                      <span className="tag" style={{ fontSize: 11 }}>Good</span>
                    ) : (
                      <span className="badge badge-absent" style={{ fontSize: 11 }}>At Risk</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Tab: At-Risk Students ── */}
      {activeSubTab === "atrisk" && (
        <div className="panel">
          <div className="panel-header">
            <h3>⚠️ At-Risk Students</h3>
            <span style={{ fontSize: 12, color: "var(--danger)" }}>Below 75% attendance</span>
          </div>
          <table>
            <thead><tr><th>Student</th><th>ID</th><th>Section</th><th>Rate</th><th>Action</th></tr></thead>
            <tbody>
              {atRisk.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 12, color: "var(--muted)" }}>{s.id}</td>
                  <td><span className="tag">{s.section}</span></td>
                  <td><span className="badge badge-absent">{s.rate}%</span></td>
                  <td>
                    <button className="btn btn-outline" style={{ width: "auto", padding: "5px 12px", fontSize: 12 }}>📧 Notify</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
