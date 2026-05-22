"use client";
import {
  TrendingUp, CalendarCheck, Star, AlertTriangle, Download, FileDown, X, ChevronDown, Table,
} from "lucide-react";
import { useState } from "react";
import * as XLSX from "xlsx";

// ── Data ──────────────────────────────────────────────────────────────────────

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

// NEW: most attended events data
const topEvents = [
  { event: "Pharmacology 301 – Lec 04", date: "Feb 12, 2026", subject: "Pharmacology 301", attended: 122, enrolled: 124 },
  { event: "Pharma Chemistry – Lec 07", date: "Mar 3, 2026", subject: "Pharma Chemistry", attended: 41, enrolled: 42 },
  { event: "Pharmacognosy – Lec 02", date: "Jan 28, 2026", subject: "Pharmacognosy", attended: 82, enrolled: 84 },
  { event: "Clinical Pharmacy – Lec 05", date: "Feb 20, 2026", subject: "Clinical Pharmacy", attended: 79, enrolled: 84 },
  { event: "Pharmacology 301 – Lec 09", date: "Mar 18, 2026", subject: "Pharmacology 301", attended: 118, enrolled: 124 },
];

// NEW: all students attendance data
const allStudents = [
  { name: "Ana Reyes",     id: "2026-001", section: "PharmA", rate: 95 },
  { name: "Bea Santos",    id: "2026-002", section: "PharmA", rate: 90 },
  { name: "Clara Tan",     id: "2026-003", section: "PharmB", rate: 72 },
  { name: "Dan Cruz",      id: "2026-004", section: "PharmA", rate: 88 },
  { name: "Ella Lim",      id: "2026-005", section: "PharmC", rate: 100 },
  { name: "Felix Go",      id: "2026-006", section: "PharmC", rate: 65 },
  { name: "Grace Uy",      id: "2026-007", section: "PharmB", rate: 91 },
  { name: "Hans Dela Cruz",id: "2026-008", section: "PharmA", rate: 84 },
  { name: "Iris Flores",   id: "2026-009", section: "PharmC", rate: 79 },
  { name: "Jay Mendoza",   id: "2026-010", section: "PharmB", rate: 100 },
  { name: "Kira Pascual",  id: "2026-011", section: "PharmA", rate: 93 },
  { name: "Leo Ramos",     id: "2026-012", section: "PharmC", rate: 87 },
  { name: "Mia Torres",    id: "2026-013", section: "PharmB", rate: 76 },
  { name: "Noel Aquino",   id: "2026-014", section: "PharmA", rate: 82 },
  { name: "Pia Villanueva",id: "2026-015", section: "PharmC", rate: 95 },
  { name: "Quinn Bondoc",  id: "2026-016", section: "PharmB", rate: 88 },
  { name: "Rosa Garcia",   id: "2026-017", section: "PharmA", rate: 100 },
  { name: "Mark Bautista", id: "2026-018", section: "PharmB", rate: 71 },
];

// ── Design Tokens ─────────────────────────────────────────────────────────────

const T = {
  surface2: "#1a1d2a",
  border: "rgba(255,255,255,0.07)",
  border2: "rgba(255,255,255,0.12)",
  gold: "#e2c84a",
  goldDim: "rgba(226,200,74,0.15)",
  green: "#5ad88a",
  greenDim: "rgba(90,216,138,0.12)",
  red: "#e2564a",
  redDim: "rgba(226,86,74,0.12)",
  amber: "#e2a84a",
  amberDim: "rgba(226,168,74,0.12)",
  muted: "#4a4f6a",
  mutedMid: "#6b7090",
  text: "#e2e4ec",
  textSub: "#9096b0",
  mono: "'JetBrains Mono', 'Fira Mono', monospace",
  radiusXs: 6,
};

const card: React.CSSProperties = {
  background: "var(--card, #13152a)",
  border: "1px solid var(--border, rgba(255,255,255,0.07))",
  borderRadius: 12,
  overflow: "hidden",
};

const sectionLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.1em",
  textTransform: "uppercase" as const,
  color: "var(--muted)",
  marginBottom: 16,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getRateColor(rate: number) {
  if (rate >= 85) return { bg: T.greenDim, color: T.green, border: "rgba(90,216,138,0.2)" };
  if (rate >= 75) return { bg: T.amberDim, color: T.amber, border: "rgba(226,168,74,0.2)" };
  return { bg: T.redDim, color: T.red, border: "rgba(226,86,74,0.2)" };
}

// ── Export Helpers ────────────────────────────────────────────────────────────

function exportCSV() {
  const rows = [
    ["Student Name", "ID", "Section", "Attendance Rate (%)"],
    ...allStudents.map(s => [s.name, s.id, s.section, s.rate]),
  ];
  const csv = rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "attendance_report_2025-2026_2nd_sem.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function exportPDF() {
  const win = window.open("", "_blank")!;
  win.document.write(`
    <html><head><title>Attendance Report – 2025–2026 2nd Sem</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 32px; color: #111; }
      h1 { font-size: 20px; margin-bottom: 4px; }
      p { color: #666; font-size: 13px; margin: 0 0 24px; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th { background: #f3f4f6; text-align: left; padding: 8px 12px; font-weight: 600; border-bottom: 2px solid #e5e7eb; }
      td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; }
      .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 600; }
      .green { background: #d1fae5; color: #065f46; }
      .amber { background: #fef3c7; color: #92400e; }
      .red { background: #fee2e2; color: #991b1b; }
    </style></head><body>
    <h1>Attendance Report</h1>
    <p>Semester: 2025–2026 2nd Sem &nbsp;|&nbsp; Generated: \${new Date().toLocaleDateString()}</p>
    <h2 style="font-size:15px;margin-bottom:8px;">Per-Student Attendance</h2>
    <table>
      <thead><tr><th>Student</th><th>ID</th><th>Section</th><th>Rate</th></tr></thead>
      <tbody>
        \${allStudents.map(s => {
          const cls = s.rate >= 85 ? "green" : s.rate >= 75 ? "amber" : "red";
          return \`<tr><td>\${s.name}</td><td>\${s.id}</td><td>\${s.section}</td><td><span class="badge \${cls}">\${s.rate}%</span></td></tr>\`;
        }).join("")}
      </tbody>
    </table>
    <br/>
    <h2 style="font-size:15px;margin-bottom:8px;">Subject Breakdown</h2>
    <table>
      <thead><tr><th>Subject</th><th>Sessions</th><th>Enrolled</th><th>Avg Rate</th></tr></thead>
      <tbody>
        \${subjectData.map(s => {
          const cls = s.rate >= 85 ? "green" : "amber";
          return \`<tr><td>\${s.name}</td><td>\${s.sessions}</td><td>\${s.students}</td><td><span class="badge \${cls}">\${s.rate}%</span></td></tr>\`;
        }).join("")}
      </tbody>
    </table>
    <script>window.onload = () => window.print();<\/script>
    </body></html>
  `);
  win.document.close();
}

function exportExcel() {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Per-Student Attendance
  const studentRows = [
    ["Student Name", "ID", "Section", "Attendance Rate (%)", "Status"],
    ...allStudents.map(s => [
      s.name, s.id, s.section, s.rate,
      s.rate >= 85 ? "Good" : s.rate >= 75 ? "At Risk" : "Critical",
    ]),
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(studentRows);
  ws1["!cols"] = [{ wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 22 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Student Attendance");

  // Sheet 2: Subject Breakdown
  const subjectRows = [
    ["Subject", "Sessions", "Enrolled", "Avg Attendance Rate (%)"],
    ...subjectData.map(s => [s.name, s.sessions, s.students, s.rate]),
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(subjectRows);
  ws2["!cols"] = [{ wch: 24 }, { wch: 10 }, { wch: 10 }, { wch: 26 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Subject Breakdown");

  // Sheet 3: Top Events
  const eventRows = [
    ["Event", "Subject", "Date", "Attended", "Enrolled", "Rate (%)"],
    ...[...topEvents]
      .sort((a, b) => (b.attended / b.enrolled) - (a.attended / a.enrolled))
      .map(e => [
        e.event, e.subject, e.date, e.attended, e.enrolled,
        Math.round((e.attended / e.enrolled) * 100),
      ]),
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(eventRows);
  ws3["!cols"] = [{ wch: 30 }, { wch: 20 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws3, "Top Events");

  // Sheet 4: At-Risk Students
  const riskRows = [
    ["Student Name", "ID", "Section", "Attendance Rate (%)"],
    ...atRisk.map(s => [s.name, s.id, s.section, s.rate]),
  ];
  const ws4 = XLSX.utils.aoa_to_sheet(riskRows);
  ws4["!cols"] = [{ wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, ws4, "At-Risk Students");

  XLSX.writeFile(wb, "attendance_report_2025-2026_2nd_sem.xlsx");
}

// ── Modal: All Students ───────────────────────────────────────────────────────

function StudentModal({ onClose }: { onClose: () => void }) {
  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("All");

  const filtered = allStudents.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.id.includes(search);
    const matchSection = sectionFilter === "All" || s.section === sectionFilter;
    return matchSearch && matchSection;
  });

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
    }}>
      <div style={{
        ...card,
        width: "100%", maxWidth: 680,
        maxHeight: "80vh", display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Modal Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: `1px solid ${T.border}`,
          flexShrink: 0,
        }}>
          <div>
            <div style={sectionLabel}>Per-Student Attendance</div>
            <div style={{ fontSize: 14, color: T.textSub, marginTop: -10 }}>
              {filtered.length} of {allStudents.length} students
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent", border: `1px solid ${T.border2}`,
              borderRadius: 6, padding: "4px 8px", color: T.textSub,
              cursor: "pointer", display: "flex", alignItems: "center",
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Filters */}
        <div style={{
          display: "flex", gap: 10, padding: "12px 20px",
          borderBottom: `1px solid ${T.border}`, flexShrink: 0,
        }}>
          <input
            placeholder="Search by name or ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1, background: T.surface2, border: `1px solid ${T.border2}`,
              borderRadius: 8, padding: "7px 12px", color: T.text,
              fontSize: 12, outline: "none",
            }}
          />
          <div style={{ position: "relative" }}>
            <select
              value={sectionFilter}
              onChange={e => setSectionFilter(e.target.value)}
              style={{
                appearance: "none", background: T.surface2,
                border: `1px solid ${T.border2}`, borderRadius: 8,
                padding: "7px 32px 7px 12px", color: T.text,
                fontSize: 12, cursor: "pointer", outline: "none",
              }}
            >
              {["All", "PharmA", "PharmB", "PharmC"].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <ChevronDown size={11} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: T.muted, pointerEvents: "none" }} />
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ position: "sticky", top: 0, background: "var(--card, #13152a)", zIndex: 1 }}>
              <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                {["Student", "ID", "Section", "Attendance Rate"].map(h => (
                  <th key={h} style={{
                    padding: "10px 20px", textAlign: "left",
                    fontSize: 10, color: T.muted,
                    textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const rc = getRateColor(s.rate);
                return (
                  <tr key={s.id} style={{ borderBottom: `1px solid rgba(255,255,255,0.03)` }}>
                    <td style={{ padding: "11px 20px", fontWeight: 500, color: T.text }}>{s.name}</td>
                    <td style={{ padding: "11px 20px", fontFamily: T.mono, fontSize: 11, color: T.muted }}>{s.id}</td>
                    <td style={{ padding: "11px 20px" }}>
                      <span style={{
                        padding: "3px 10px", borderRadius: T.radiusXs,
                        fontSize: 11, fontWeight: 600,
                        background: T.surface2, color: T.textSub,
                        border: `1px solid ${T.border2}`,
                      }}>{s.section}</span>
                    </td>
                    <td style={{ padding: "11px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ flex: 1, background: T.surface2, borderRadius: 99, height: 5, overflow: "hidden", minWidth: 60 }}>
                          <div style={{ width: `${s.rate}%`, height: "100%", background: rc.color, borderRadius: 99 }} />
                        </div>
                        <span style={{
                          padding: "2px 8px", borderRadius: T.radiusXs,
                          fontSize: 11, fontWeight: 700, fontFamily: T.mono,
                          background: rc.bg, color: rc.color, border: `1px solid ${rc.border}`,
                          minWidth: 42, textAlign: "center",
                        }}>{s.rate}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: "32px 20px", textAlign: "center", color: T.muted, fontSize: 13 }}>
                    No students match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function FacultyReports() {
  const maxRate = Math.max(...weeklyData.map(d => d.rate));
  const [showStudentModal, setShowStudentModal] = useState(false);

  return (
    <>
      {showStudentModal && <StudentModal onClose={() => setShowStudentModal(false)} />}

      {/* ── Page Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "var(--muted)", textTransform: "uppercase", marginBottom: 4 }}>
            Facilitator › Reports
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 4px" }}>Reports & Analytics</h2>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>Semester overview · 2025–2026 2nd Sem</p>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
          <button
            onClick={exportCSV}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 16px", borderRadius: 8,
              background: "transparent", border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 500, cursor: "pointer",
              transition: "background 0.15s, border-color 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}
          >
            <Download size={13} /> Export CSV
          </button>
          <button
            onClick={exportExcel}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 16px", borderRadius: 8,
              background: "transparent", border: "1px solid rgba(90,216,138,0.35)",
              color: "#5ad88a", fontSize: 12, fontWeight: 500, cursor: "pointer",
              transition: "background 0.15s, border-color 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(90,216,138,0.08)"; e.currentTarget.style.borderColor = "rgba(90,216,138,0.6)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "rgba(90,216,138,0.35)"; }}
          >
            <Table size={13} /> Export Excel
          </button>
          <button
            onClick={exportPDF}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 16px", borderRadius: 8,
              background: "var(--gold, #f0c040)", border: "1px solid var(--gold, #f0c040)",
              color: "#000", fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}
          >
            <FileDown size={13} /> Export PDF
          </button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { icon: <TrendingUp size={16} />, label: "Avg Attendance Rate", value: "87.3%", color: "#4ade80", bg: "rgba(74,222,128,0.08)", border: "rgba(74,222,128,0.18)" },
          { icon: <CalendarCheck size={16} />, label: "Total Sessions", value: "48", color: "rgba(255,255,255,0.85)", bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.1)" },
          { icon: <Star size={16} />, label: "Perfect Attendance", value: "18", color: "var(--gold, #f0c040)", bg: "rgba(240,192,64,0.08)", border: "rgba(240,192,64,0.18)" },
          { icon: <AlertTriangle size={16} />, label: "At-Risk Students", value: `${atRisk.length}`, color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.18)" },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ color: s.color, opacity: 0.85, flexShrink: 0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 4 }}>{s.label}</div>
            </div>
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

      {/* ── NEW: Most Attended Events ── */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: `1px solid ${T.border}`,
        }}>
          <div style={sectionLabel}>Most Attended Events</div>
          <span style={{
            fontSize: 11, color: T.textSub,
            padding: "3px 10px", borderRadius: T.radiusXs,
            background: T.surface2, border: `1px solid ${T.border2}`,
          }}>Top 5 by attendance rate</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.border}` }}>
              {["Rank", "Event", "Subject", "Date", "Attended", "Rate"].map(h => (
                <th key={h} style={{
                  padding: "10px 20px", textAlign: "left",
                  fontSize: 10, color: T.muted,
                  textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...topEvents]
              .sort((a, b) => (b.attended / b.enrolled) - (a.attended / a.enrolled))
              .map((e, i) => {
                const rate = Math.round((e.attended / e.enrolled) * 100);
                const rc = getRateColor(rate);
                const medals = ["🥇", "🥈", "🥉"];
                return (
                  <tr key={e.event} style={{ borderBottom: `1px solid rgba(255,255,255,0.03)` }}>
                    <td style={{ padding: "12px 20px", fontFamily: T.mono, fontSize: 13, color: T.muted }}>
                      {i < 3 ? medals[i] : `#${i + 1}`}
                    </td>
                    <td style={{ padding: "12px 20px", fontWeight: 500, color: T.text }}>{e.event}</td>
                    <td style={{ padding: "12px 20px", fontSize: 12, color: T.textSub }}>{e.subject}</td>
                    <td style={{ padding: "12px 20px", fontFamily: T.mono, fontSize: 11, color: T.muted }}>{e.date}</td>
                    <td style={{ padding: "12px 20px", fontFamily: T.mono, fontSize: 12, color: T.textSub }}>
                      {e.attended}<span style={{ color: T.muted }}>/{e.enrolled}</span>
                    </td>
                    <td style={{ padding: "12px 20px" }}>
                      <span style={{
                        padding: "3px 10px", borderRadius: T.radiusXs,
                        fontSize: 11, fontWeight: 600, fontFamily: T.mono,
                        background: rc.bg, color: rc.color, border: `1px solid ${rc.border}`,
                      }}>{rate}%</span>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
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
                  textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600,
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

      {/* ── Per-Student Attendance (preview + expand) ── */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: `1px solid ${T.border}`,
        }}>
          <div style={sectionLabel}>Attendance per Student</div>
          <button
            onClick={() => setShowStudentModal(true)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "5px 12px", borderRadius: T.radiusXs,
              background: "transparent", border: `1px solid ${T.border2}`,
              color: T.textSub, fontSize: 11, fontWeight: 500,
              cursor: "pointer", transition: "all 0.15s",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = "var(--gold, #f0c040)";
              e.currentTarget.style.color = "var(--gold, #f0c040)";
              e.currentTarget.style.background = T.goldDim;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = T.border2;
              e.currentTarget.style.color = T.textSub;
              e.currentTarget.style.background = "transparent";
            }}
          >
            View All {allStudents.length} Students
          </button>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.border}` }}>
              {["Student", "ID", "Section", "Attendance Rate"].map(h => (
                <th key={h} style={{
                  padding: "10px 20px", textAlign: "left",
                  fontSize: 10, color: T.muted,
                  textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allStudents.slice(0, 5).map(s => {
              const rc = getRateColor(s.rate);
              return (
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
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ flex: 1, background: T.surface2, borderRadius: 99, height: 5, overflow: "hidden", minWidth: 60 }}>
                        <div style={{ width: `${s.rate}%`, height: "100%", background: rc.color, borderRadius: 99 }} />
                      </div>
                      <span style={{
                        padding: "2px 8px", borderRadius: T.radiusXs,
                        fontSize: 11, fontWeight: 700, fontFamily: T.mono,
                        background: rc.bg, color: rc.color, border: `1px solid ${rc.border}`,
                        minWidth: 42, textAlign: "center",
                      }}>{s.rate}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{
          padding: "10px 20px", borderTop: `1px solid ${T.border}`,
          fontSize: 11, color: T.muted, textAlign: "center",
        }}>
          Showing 5 of {allStudents.length} students —{" "}
          <span
            onClick={() => setShowStudentModal(true)}
            style={{ color: T.gold, cursor: "pointer", textDecoration: "underline" }}
          >
            view all
          </span>
        </div>
      </div>

      {/* ── At-Risk Students ── */}
      <div style={card}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: `1px solid ${T.border}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={14} style={{ color: T.amber }} />
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
                  textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600,
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
                  <button
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "5px 12px", borderRadius: T.radiusXs,
                      background: "transparent", border: `1px solid ${T.border2}`,
                      color: T.textSub, fontSize: 11, fontWeight: 500,
                      cursor: "pointer", transition: "all 0.15s",
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = "var(--gold, #f0c040)";
                      e.currentTarget.style.color = "var(--gold, #f0c040)";
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
    </>
  );
}
