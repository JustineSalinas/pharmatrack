"use client";
import { useState } from "react";
import {
  Search, Users, CheckCircle, XCircle, Clock, ChevronRight, X,
  BookOpen, TrendingUp, AlertTriangle, FileText,
} from "lucide-react";

const allStudents = [
  { name: "Ana Santos",    id: "2026-001", section: "PharmA", year: "2nd", rate: 95,  status: "present" },
  { name: "Ben Cruz",      id: "2026-002", section: "PharmA", year: "2nd", rate: 87,  status: "present" },
  { name: "Clara Tan",     id: "2026-003", section: "PharmB", year: "2nd", rate: 72,  status: "absent"  },
  { name: "Diego Lim",     id: "2026-004", section: "PharmA", year: "2nd", rate: 81,  status: "late"    },
  { name: "Eva Reyes",     id: "2026-005", section: "PharmB", year: "2nd", rate: 100, status: "present" },
  { name: "Felix Go",      id: "2026-006", section: "PharmC", year: "3rd", rate: 65,  status: "absent"  },
  { name: "Grace Yu",      id: "2026-007", section: "PharmA", year: "2nd", rate: 93,  status: "present" },
  { name: "Henry Park",    id: "2026-008", section: "PharmB", year: "2nd", rate: 78,  status: "present" },
  { name: "Iris Mendoza",  id: "2026-009", section: "PharmC", year: "3rd", rate: 88,  status: "present" },
  { name: "Jake Torres",   id: "2026-010", section: "PharmA", year: "2nd", rate: 91,  status: "present" },
];

const SECTIONS = ["All", "PharmA", "PharmB", "PharmC"];

function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

const statusConfig: Record<string, { color: string; bg: string; border: string; label: string }> = {
  present: { color: "#4ade80", bg: "rgba(74,222,128,0.1)",  border: "rgba(74,222,128,0.25)",  label: "Present" },
  absent:  { color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.25)", label: "Absent"  },
  late:    { color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.25)",  label: "Late"    },
};

export default function StudentsPage() {
  const [search, setSearch]               = useState("");
  const [sectionFilter, setSectionFilter] = useState("All");
  const [selected, setSelected]           = useState<string | null>(null);

  const filtered = allStudents.filter(s =>
    (sectionFilter === "All" || s.section === sectionFilter) &&
    (s.name.toLowerCase().includes(search.toLowerCase()) || s.id.includes(search))
  );

  const selectedStudent = allStudents.find(s => s.id === selected) ?? null;

  /* ── Shared card style (mirrors dashboard) ── */
  const card: React.CSSProperties = {
    background: "var(--card, #13152a)",
    border: "1px solid var(--border, rgba(255,255,255,0.07))",
    borderRadius: 12,
    overflow: "hidden",
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const cfg = statusConfig[status] ?? statusConfig.present;
    return (
      <span style={{
        padding: "3px 10px",
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: cfg.color,
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.04em",
      }}>
        {cfg.label.toUpperCase()}
      </span>
    );
  };

  return (
    <>
      {/* ── Page Header ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "var(--muted)", textTransform: "uppercase", marginBottom: 4 }}>
          Faculty › Students
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 4px" }}>Student Management</h2>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>{allStudents.length} students enrolled this semester</p>
      </div>

      {/* ── Summary strip ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { icon: <CheckCircle size={16} />, label: "Present Today",   value: allStudents.filter(s => s.status === "present").length, color: "#4ade80", bg: "rgba(74,222,128,0.08)",  border: "rgba(74,222,128,0.18)"  },
          { icon: <XCircle    size={16} />, label: "Absent Today",    value: allStudents.filter(s => s.status === "absent").length,  color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.18)" },
          { icon: <Clock      size={16} />, label: "Late Today",      value: allStudents.filter(s => s.status === "late").length,    color: "#fbbf24", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.18)"  },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ color: s.color, opacity: 0.85 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 4 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Search + Section filters ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {/* Search */}
        <div style={{ position: "relative", flex: "0 0 240px" }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }} />
          <input
            placeholder="Search name or ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "9px 14px 9px 34px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              color: "var(--foreground, #fff)",
              fontSize: 13,
              outline: "none",
            }}
          />
        </div>

        {/* Section tabs */}
        <div style={{ display: "flex", gap: 6 }}>
          {SECTIONS.map(s => (
            <button
              key={s}
              onClick={() => setSectionFilter(s)}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                border: "1px solid",
                transition: "background 0.15s, color 0.15s, border-color 0.15s",
                background: sectionFilter === s ? "var(--gold, #f0c040)" : "transparent",
                borderColor: sectionFilter === s ? "var(--gold, #f0c040)" : "rgba(255,255,255,0.12)",
                color: sectionFilter === s ? "#000" : "rgba(255,255,255,0.6)",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main grid: table + detail panel ── */}
      <div style={{ display: "grid", gridTemplateColumns: selected ? "1.3fr 1fr" : "1fr", gap: 16, alignItems: "start" }}>

        {/* ── Students Table ── */}
        <div style={card}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid var(--border, rgba(255,255,255,0.07))",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Users size={15} color="var(--gold, #f0c040)" />
              <span style={{ fontSize: 13, fontWeight: 600 }}>All Students</span>
            </div>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border, rgba(255,255,255,0.07))" }}>
                {["Name", "ID", "Section", "Year", "Rate", "Today", ""].map(h => (
                  <th key={h} style={{ padding: "10px 20px", textAlign: "left", fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr
                  key={s.id}
                  onClick={() => setSelected(selected === s.id ? null : s.id)}
                  style={{
                    borderBottom: "1px solid var(--border, rgba(255,255,255,0.04))",
                    background: selected === s.id ? "rgba(240,192,64,0.05)" : "transparent",
                    cursor: "pointer",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => { if (selected !== s.id) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = selected === s.id ? "rgba(240,192,64,0.05)" : "transparent"; }}
                >
                  {/* Name + avatar */}
                  <td style={{ padding: "12px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%",
                        background: "rgba(240,192,64,0.12)",
                        border: "1px solid rgba(240,192,64,0.2)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 700, color: "var(--gold, #f0c040)",
                        flexShrink: 0,
                      }}>
                        {initials(s.name)}
                      </div>
                      <span style={{ fontWeight: 500 }}>{s.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 20px", fontFamily: "monospace", fontSize: 11, color: "var(--muted)" }}>{s.id}</td>
                  <td style={{ padding: "12px 20px" }}>
                    <span style={{ padding: "3px 10px", background: "rgba(255,255,255,0.06)", borderRadius: 6, fontSize: 11, fontWeight: 500 }}>{s.section}</span>
                  </td>
                  <td style={{ padding: "12px 20px", color: "var(--muted)", fontSize: 12 }}>{s.year}</td>
                  <td style={{ padding: "12px 20px" }}>
                    <span style={{
                      padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                      background: s.rate >= 85 ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)",
                      color: s.rate >= 85 ? "#4ade80" : "#f87171",
                    }}>{s.rate}%</span>
                  </td>
                  <td style={{ padding: "12px 20px" }}>
                    <StatusBadge status={s.status} />
                  </td>
                  <td style={{ padding: "12px 20px" }}>
                    <button
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "5px 12px",
                        background: selected === s.id ? "rgba(240,192,64,0.12)" : "transparent",
                        border: `1px solid ${selected === s.id ? "rgba(240,192,64,0.3)" : "rgba(255,255,255,0.1)"}`,
                        borderRadius: 6,
                        color: selected === s.id ? "var(--gold, #f0c040)" : "rgba(255,255,255,0.5)",
                        fontSize: 11, fontWeight: 500, cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      {selected === s.id ? <><X size={11} /> Close</> : <>View <ChevronRight size={11} /></>}
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: "40px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                    No students match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Student Detail Panel ── */}
        {selectedStudent && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Identity card */}
            <div style={{ ...card, padding: "24px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: "50%",
                  background: "rgba(240,192,64,0.12)",
                  border: "1.5px solid rgba(240,192,64,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, fontWeight: 700, color: "var(--gold, #f0c040)", flexShrink: 0,
                }}>
                  {initials(selectedStudent.name)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 3 }}>{selectedStudent.name}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "monospace" }}>{selectedStudent.id}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    <span style={{ padding: "2px 8px", background: "rgba(255,255,255,0.06)", borderRadius: 5, fontSize: 11 }}>{selectedStudent.section}</span>
                    <span style={{ padding: "2px 8px", background: "rgba(255,255,255,0.06)", borderRadius: 5, fontSize: 11 }}>{selectedStudent.year} Year</span>
                  </div>
                </div>
                <StatusBadge status={selectedStudent.status} />
              </div>

              {/* Mini stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 18 }}>
                {[
                  { label: "Present", value: "43", color: "#4ade80", bg: "rgba(74,222,128,0.08)",  border: "rgba(74,222,128,0.18)"  },
                  { label: "Absent",  value: "3",  color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.18)" },
                  { label: "Late",    value: "2",  color: "#fbbf24", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.18)"  },
                ].map(m => (
                  <div key={m.label} style={{ background: m.bg, border: `1px solid ${m.border}`, borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: m.color, lineHeight: 1 }}>{m.value}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>{m.label}</div>
                  </div>
                ))}
              </div>

              {/* Attendance rate bar */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}><TrendingUp size={12} /> Attendance Rate</span>
                  <strong style={{ color: selectedStudent.rate >= 85 ? "#4ade80" : "#f87171" }}>{selectedStudent.rate}%</strong>
                </div>
                <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 99, height: 6, overflow: "hidden" }}>
                  <div style={{
                    width: `${selectedStudent.rate}%`, height: "100%", borderRadius: 99,
                    background: selectedStudent.rate >= 85 ? "linear-gradient(90deg, #4ade80, var(--gold, #f0c040))" : "#f87171",
                    transition: "width 0.6s ease",
                  }} />
                </div>
                {selectedStudent.rate < 75 && (
                  <div style={{ marginTop: 10, padding: "9px 12px", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 8, fontSize: 12, color: "#f87171", display: "flex", alignItems: "center", gap: 7 }}>
                    <AlertTriangle size={13} /> At-risk: Below 75% attendance threshold
                  </div>
                )}
              </div>
            </div>

            {/* Recent records card */}
            <div style={card}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 20px",
                borderBottom: "1px solid var(--border, rgba(255,255,255,0.07))",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <BookOpen size={14} color="var(--gold, #f0c040)" />
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Recent Records</span>
                </div>
              </div>

              <div style={{ padding: "4px 0" }}>
                {[
                  ["Mar 22", "Pharmacology 301",    "present"],
                  ["Mar 22", "Pharmacognosy",       "present"],
                  ["Mar 21", "Clinical Pharmacy",   "absent" ],
                  ["Mar 20", "Pharmaceutical Chem", "late"   ],
                ].map(([date, subject, st]) => (
                  <div key={date + subject} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "11px 20px",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{subject}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{date}</div>
                    </div>
                    <StatusBadge status={st} />
                  </div>
                ))}
              </div>

              <div style={{ padding: "14px 20px" }}>
                <button style={{
                  width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "9px 0",
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 8,
                  color: "rgba(255,255,255,0.6)",
                  fontSize: 12, fontWeight: 500, cursor: "pointer",
                  transition: "background 0.15s, border-color 0.15s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}
                >
                  <FileText size={13} /> Full Record
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
