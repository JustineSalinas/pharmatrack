"use client";

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

export default function FacultyReports() {
  const maxRate = Math.max(...weeklyData.map(d => d.rate));

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb"><span>Faculty</span><span>›</span><span>Reports</span></div>
          <h2>Reports & Analytics</h2>
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

      {/* Subject breakdown */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-header"><h3>Subject Breakdown</h3></div>
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

      {/* At-risk students */}
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
    </>
  );
}
