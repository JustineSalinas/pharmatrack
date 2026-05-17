"use client";

const weeklyData = [
  { week: "W1", rate: 82 }, { week: "W2", rate: 88 }, { week: "W3", rate: 85 },
  { week: "W4", rate: 91 }, { week: "W5", rate: 87 }, { week: "W6", rate: 89 },
];

const subjectData = [
  { name: "Pharmacology 301", rate: 92, sessions: 12, students: 124 },
  { name: "Pharmacognosy", rate: 88, sessions: 10, students: 84 },
  { name: "Clinical Pharmacy", rate: 84, sessions: 11, students: 84 },
  { name: "Pharmaceutical Chem", rate: 91, sessions: 10, students: 42 },
];

const atRisk = [
  { name: "Clara Tan", id: "2026-003", section: "PharmB", rate: 72 },
  { name: "Felix Go", id: "2026-006", section: "PharmC", rate: 65 },
  { name: "Mark Bautista", id: "2026-018", section: "PharmB", rate: 71 },
];

/* ── Design tokens ── */
const T = {
  bg:        "#0d0e14",
  surface:   "#111318",
  surface2:  "#1a1d2a",
  border:    "rgba(255,255,255,0.07)",
  border2:   "rgba(255,255,255,0.12)",
  gold:      "#e2c84a",
  goldDim:   "rgba(226,200,74,0.15)",
  green:     "#5ad88a",
  greenDim:  "rgba(90,216,138,0.12)",
  red:       "#e2564a",
  redDim:    "rgba(226,86,74,0.12)",
  amber:     "#e2a84a",
  amberDim:  "rgba(226,168,74,0.12)",
  muted:     "#4a4f6a",
  mutedMid:  "#6b7090",
  text:      "#e2e4ec",
  textSub:   "#9096b0",
  mono:      "'JetBrains Mono', 'Fira Mono', monospace",
  sans:      "'Space Grotesk', system-ui, sans-serif",
  radius:    12,
  radiusSm:  8,
  radiusXs:  6,
};

const card: React.CSSProperties = {
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderRadius: T.radius,
  overflow: "hidden",
};

const sectionLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.1em",
  textTransform: "uppercase" as const,
  color: T.muted,
  marginBottom: 16,
  fontFamily: T.sans,
};

export default function FacultyReports() {
  const maxRate = Math.max(...weeklyData.map(d => d.rate));

  return (
    <div style={{ fontFamily: T.sans, color: T.text, minHeight: "100vh", padding: "28px 32px", background: T.bg }}>

      {/* ── Page Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.06em", marginBottom: 6 }}>
            Faculty <span style={{ margin: "0 4px", opacity: 0.4 }}>›</span> Reports
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: "0 0 4px", letterSpacing: "-0.01em" }}>
            Reports & Analytics
          </h2>
          <p style={{ fontSize: 12, color: T.mutedMid, margin: 0 }}>
            Semester overview · 2025–2026 2nd Sem
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: T.radiusSm,
            background: "transparent", border: `1px solid ${T.border2}`,
            color: T.textSub, fontSize: 12, fontWeight: 500, cursor: "pointer",
            fontFamily: T.sans,
          }}>
            <span style={{ fontSize: 13 }}>⬇</span> Export CSV
          </button>
          <button style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: T.radiusSm,
            background: T.gold, border: `1px solid ${T.gold}`,
            color: "#0d0e14", fontSize: 12, fontWeight: 600, cursor: "pointer",
            fontFamily: T.sans,
          }}>
            <span style={{ fontSize: 13 }}>⬇</span> Export PDF
          </button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
        {[
          { label: "Avg Attendance Rate", value: "87.3%", color: T.green, bg: T.greenDim, border: "rgba(90,216,138,0.2)" },
          { label: "Total Sessions",       value: "48",    color: "#fff",   bg: T.surface,  border: T.border },
          { label: "Perfect Attendance",   value: "18",    color: T.gold,   bg: T.goldDim,  border: "rgba(226,200,74,0.2)", sub: "students" },
          { label: "At-Risk Students",     value: `${atRisk.length}`, color: T.red, bg: T.redDim, border: "rgba(226,86,74,0.2)", sub: "below 75%" },
        ].map(s => (
          <div key={s.label} style={{
            background: s.bg, border: `1px solid ${s.border}`,
            borderRadius: T.radius, padding: "18px 20px",
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: T.muted, marginBottom: 8, fontFamily: T.sans }}>
              {s.label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color, lineHeight: 1, fontFamily: T.mono, marginBottom: s.sub ? 4 : 0 }}>
              {s.value}
            </div>
            {s.sub && <div style={{ fontSize: 11, color: T.mutedMid }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* ── Weekly Trend + Section Comparison ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>

        {/* Weekly Trend */}
        <div style={{ ...card, padding: "20px 22px" }}>
          <div style={sectionLabel}>Weekly Attendance Trend</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120, padding: "0 4px" }}>
            {weeklyData.map(d => {
              const isTop = d.rate === maxRate;
              return (
                <div key={d.week} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: isTop ? T.green : T.mutedMid, fontFamily: T.mono }}>
                    {d.rate}%
                  </span>
                  <div style={{
                    width: "100%",
                    height: `${(d.rate / maxRate) * 90}px`,
                    background: isTop
                      ? `linear-gradient(180deg, #1d9e75 0%, #0f6e56 100%)`
                      : `linear-gradient(180deg, ${T.gold} 0%, #8a6e1a 100%)`,
                    borderRadius: "4px 4px 0 0",
                    minHeight: 6,
                    transition: "height 0.4s ease",
                  }} />
                  <span style={{ fontSize: 10, color: T.muted, letterSpacing: "0.04em" }}>{d.week}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section Comparison */}
        <div style={{ ...card, padding: "20px 22px" }}>
          <div style={sectionLabel}>Section Comparison</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 4 }}>
            {([["PharmA", 95], ["PharmB", 87], ["PharmC", 80]] as [string, number][]).map(([name, rate]) => (
              <div key={name}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                  <span style={{ fontSize: 12, color: T.textSub }}>{name}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.text, fontFamily: T.mono }}>{rate}%</span>
                </div>
                <div style={{ background: T.surface2, borderRadius: 99, height: 7, overflow: "hidden" }}>
                  <div style={{
                    width: `${rate}%`, height: "100%",
                    background: "linear-gradient(90deg, #4cd890, #1d9e75)",
                    borderRadius: 99,
                    transition: "width 0.6s ease",
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Subject Breakdown ── */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}` }}>
          <div style={sectionLabel}>Subject Breakdown</div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.border}` }}>
              {["Subject", "Sessions", "Enrolled", "Avg Rate", "Trend"].map(h => (
                <th key={h} style={{
                  padding: "10px 20px", textAlign: "left",
                  fontSize: 10, color: T.muted,
                  textTransform: "uppercase", letterSpacing: "0.08em",
                  fontWeight: 600, fontFamily: T.sans,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {subjectData.map(s => (
              <tr key={s.name} style={{ borderBottom: `1px solid rgba(255,255,255,0.03)` }}>
                <td style={{ padding: "12px 20px", fontWeight: 500, color: T.text }}>{s.name}</td>
                <td style={{ padding: "12px 20px", color: T.mutedMid, fontFamily: T.mono, fontSize: 12 }}>{s.sessions}</td>
                <td style={{ padding: "12px 20px", color: T.mutedMid, fontFamily: T.mono, fontSize: 12 }}>{s.students}</td>
                <td style={{ padding: "12px 20px" }}>
                  <span style={{
                    padding: "3px 10px", borderRadius: T.radiusXs,
                    fontSize: 11, fontWeight: 600, fontFamily: T.mono,
                    background: s.rate >= 85 ? T.greenDim : T.amberDim,
                    color: s.rate >= 85 ? T.green : T.amber,
                    border: `1px solid ${s.rate >= 85 ? "rgba(90,216,138,0.2)" : "rgba(226,168,74,0.2)"}`,
                  }}>{s.rate}%</span>
                </td>
                <td style={{ padding: "12px 20px" }}>
                  <div style={{ display: "flex", gap: 2, alignItems: "flex-end" }}>
                    {[6, 8, 7, 10].map((h, i) => (
                      <div key={i} style={{
                        width: 6, height: h,
                        background: s.rate >= 85 ? T.green : T.amber,
                        borderRadius: 2, opacity: 0.7 + i * 0.1,
                      }} />
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── At-Risk Students ── */}
      <div style={card}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: `1px solid ${T.border}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14, color: T.amber }}>⚠</span>
            <div style={sectionLabel}>At-Risk Students</div>
          </div>
          <span style={{
            fontSize: 11, fontWeight: 500,
            padding: "3px 10px", borderRadius: T.radiusXs,
            background: T.redDim, color: T.red,
            border: `1px solid rgba(226,86,74,0.2)`,
          }}>Below 75% attendance</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.border}` }}>
              {["Student", "ID", "Section", "Rate", "Action"].map(h => (
                <th key={h} style={{
                  padding: "10px 20px", textAlign: "left",
                  fontSize: 10, color: T.muted,
                  textTransform: "uppercase", letterSpacing: "0.08em",
                  fontWeight: 600, fontFamily: T.sans,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {atRisk.map(s => (
              <tr key={s.id} style={{ borderBottom: `1px solid rgba(255,255,255,0.03)` }}>
                <td style={{ padding: "12px 20px", fontWeight: 500, color: T.text }}>{s.name}</td>
                <td style={{ padding: "12px 20px", fontFamily: T.mono, fontSize: 11, color: T.muted }}>{s.id}</td>
                <td style={{ padding: "12px 20px" }}>
                  <span style={{
                    padding: "3px 10px", borderRadius: T.radiusXs,
                    fontSize: 11, fontWeight: 600,
                    background: T.surface2, color: T.textSub,
                    border: `1px solid ${T.border2}`,
                  }}>{s.section}</span>
                </td>
                <td style={{ padding: "12px 20px" }}>
                  <span style={{
                    padding: "3px 10px", borderRadius: T.radiusXs,
                    fontSize: 11, fontWeight: 700, fontFamily: T.mono,
                    background: T.redDim, color: T.red,
                    border: `1px solid rgba(226,86,74,0.2)`,
                  }}>{s.rate}%</span>
                </td>
                <td style={{ padding: "12px 20px" }}>
                  <button style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "5px 12px", borderRadius: T.radiusXs,
                    background: "transparent", border: `1px solid ${T.border2}`,
                    color: T.textSub, fontSize: 11, fontWeight: 500,
                    cursor: "pointer", fontFamily: T.sans,
                    transition: "all 0.15s",
                  }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = T.gold;
                      e.currentTarget.style.color = T.gold;
                      e.currentTarget.style.background = T.goldDim;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = T.border2;
                      e.currentTarget.style.color = T.textSub;
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    📧 Notify
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
