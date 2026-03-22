"use client";

const monthly = [
  { month: "Jan", rate: 80 }, { month: "Feb", rate: 85 }, { month: "Mar", rate: 87 }, { month: "Apr", rate: 0 },
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
  const maxMonthly = Math.max(...monthly.map(m => m.rate));

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb"><span>Admin</span><span>›</span><span>Analytics</span></div>
          <h2>Analytics & Reports</h2>
          <p>Department-wide performance insights</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline" style={{ width: "auto", padding: "9px 18px", fontSize: 13 }}>⬇️ Export CSV</button>
          <button className="btn btn-gold" style={{ width: "auto", padding: "9px 18px", fontSize: 13 }}>⬇️ Export PDF</button>
        </div>
      </div>

      <div className="stats-grid">
        {[
          { label: "Dept. Avg Rate", value: "87.3%", color: "var(--success)" },
          { label: "Total QR Sessions", value: "312" },
          { label: "Perfect Records", value: "18", sub: "students" },
          { label: "Flagged Students", value: "14", color: "var(--danger)", sub: "below 75%" },
        ].map((s) => (
          <div className="stat-card" key={s.label}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-val" style={{ color: s.color }}>{s.value}</div>
            {s.sub && <div className="stat-sub">{s.sub}</div>}
          </div>
        ))}
      </div>

      <div className="content-grid" style={{ marginBottom: 20 }}>
        {/* Monthly trend */}
        <div className="panel">
          <div className="panel-header"><h3>Monthly Attendance Trend</h3></div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 16, height: 140, marginTop: 24, padding: "0 16px" }}>
            {monthly.map((d) => (
              <div key={d.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                {d.rate > 0 && <span style={{ fontSize: 12, color: "var(--muted)" }}>{d.rate}%</span>}
                <div style={{
                  width: "100%",
                  height: d.rate > 0 ? `${(d.rate / maxMonthly) * 110}px` : "6px",
                  background: d.rate > 0 ? "linear-gradient(to top, var(--gold), rgba(232,200,74,0.4))" : "var(--surface2)",
                  borderRadius: "4px 4px 0 0", opacity: d.rate > 0 ? 1 : 0.4,
                }} />
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{d.month}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, padding: "12px 0 0", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span style={{ color: "var(--muted)" }}>Semester Average</span>
            <strong style={{ color: "var(--gold)" }}>84.7%</strong>
          </div>
        </div>

        {/* Section breakdown */}
        <div className="panel">
          <div className="panel-header"><h3>Section Breakdown</h3></div>
          <div style={{ marginTop: 12 }}>
            {[["PharmA", 95, 42], ["PharmB", 87, 40], ["PharmC", 80, 42]].map(([name, rate, count]) => (
              <div key={name as string} style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{name}</span>
                    <span style={{ color: "var(--muted)", marginLeft: 8, fontSize: 12 }}>{count} students</span>
                  </div>
                  <strong>{rate}%</strong>
                </div>
                <div style={{ background: "var(--surface2)", borderRadius: 99, height: 8 }}>
                  <div style={{ width: `${rate as number}%`, height: "100%", background: "linear-gradient(90deg, var(--gold), var(--success))", borderRadius: 99 }} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16, padding: "12px 0 0", borderTop: "1px solid var(--border)" }}>
            <h4 style={{ fontSize: 13, marginBottom: 12 }}>Subject Averages</h4>
            {[["Pharmacology 301", 92], ["Pharmacognosy", 88], ["Clinical Pharmacy", 84], ["Pharma Chem", 91]].map(([s, r]) => (
              <div key={s as string} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <span style={{ color: "var(--muted)" }}>{s}</span>
                <span className={Number(r) >= 85 ? "tag" : "badge badge-late"}>{r}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="content-grid">
        {/* Top performers */}
        <div className="panel">
          <div className="panel-header"><h3>🏆 Top Performers</h3></div>
          <table>
            <thead><tr><th>Rank</th><th>Student</th><th>Section</th><th>Rate</th></tr></thead>
            <tbody>
              {topStudents.map((s, i) => (
                <tr key={s.id}>
                  <td style={{ fontSize: 16 }}>{"🥇🥈🥉🏅🏅"[i]}</td>
                  <td>{s.name}</td>
                  <td><span className="tag">{s.section}</span></td>
                  <td><span className="tag">{s.rate}%</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* At risk */}
        <div className="panel">
          <div className="panel-header">
            <h3>⚠️ At-Risk Students</h3>
            <span style={{ fontSize: 12, color: "var(--danger)" }}>Needs intervention</span>
          </div>
          <table>
            <thead><tr><th>Student</th><th>Section</th><th>Rate</th><th>Action</th></tr></thead>
            <tbody>
              {bottomStudents.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div>{s.name}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "monospace" }}>{s.id}</div>
                  </td>
                  <td><span className="tag">{s.section}</span></td>
                  <td><span className="badge badge-absent">{s.rate}%</span></td>
                  <td>
                    <button className="btn btn-outline" style={{ width: "auto", padding: "5px 12px", fontSize: 11 }}>📧 Alert</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
