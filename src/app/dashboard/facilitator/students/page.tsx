"use client";
import { useState } from "react";

const allStudents = [
  { name: "Ana Santos", id: "2026-001", section: "PharmA", year: "2nd", rate: 95, status: "present" },
  { name: "Ben Cruz", id: "2026-002", section: "PharmA", year: "2nd", rate: 87, status: "present" },
  { name: "Clara Tan", id: "2026-003", section: "PharmB", year: "2nd", rate: 72, status: "absent" },
  { name: "Diego Lim", id: "2026-004", section: "PharmA", year: "2nd", rate: 81, status: "late" },
  { name: "Eva Reyes", id: "2026-005", section: "PharmB", year: "2nd", rate: 100, status: "present" },
  { name: "Felix Go", id: "2026-006", section: "PharmC", year: "3rd", rate: 65, status: "absent" },
  { name: "Grace Yu", id: "2026-007", section: "PharmA", year: "2nd", rate: 93, status: "present" },
  { name: "Henry Park", id: "2026-008", section: "PharmB", year: "2nd", rate: 78, status: "present" },
  { name: "Iris Mendoza", id: "2026-009", section: "PharmC", year: "3rd", rate: 88, status: "present" },
  { name: "Jake Torres", id: "2026-010", section: "PharmA", year: "2nd", rate: 91, status: "present" },
];

export default function StudentsPage() {
  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("All");
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = allStudents.filter(s =>
    (sectionFilter === "All" || s.section === sectionFilter) &&
    (s.name.toLowerCase().includes(search.toLowerCase()) || s.id.includes(search))
  );

  const selectedStudent = allStudents.find(s => s.id === selected);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb"><span>Faculty</span><span>›</span><span>Students</span></div>
          <h2>Student Management</h2>
          <p>{allStudents.length} students enrolled this semester</p>
        </div>
        <div className="header-actions">
          <input className="inp" placeholder="🔍 Search name or ID..." style={{ width: 220, padding: "9px 14px", fontSize: 13 }} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Section filter tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {["All", "PharmA", "PharmB", "PharmC"].map((s) => (
          <button key={s} className={`btn ${sectionFilter === s ? "btn-gold" : "btn-outline"}`}
            style={{ width: "auto", padding: "7px 18px", fontSize: 13 }} onClick={() => setSectionFilter(s)}>
            {s}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selected ? "1.2fr 1fr" : "1fr", gap: 20 }}>
        <div className="panel">
          <table>
            <thead><tr><th>Name</th><th>ID</th><th>Section</th><th>Year</th><th>Rate</th><th>Today</th><th></th></tr></thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} style={{ cursor: "pointer", background: selected === s.id ? "rgba(232,200,74,0.06)" : undefined }}>
                  <td>{s.name}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 12, color: "var(--muted)" }}>{s.id}</td>
                  <td><span className="tag">{s.section}</span></td>
                  <td>{s.year}</td>
                  <td><span className={s.rate >= 85 ? "tag" : "badge badge-absent"}>{s.rate}%</span></td>
                  <td><span className={`badge badge-${s.status}`}>{s.status.toUpperCase()}</span></td>
                  <td>
                    <button className="btn btn-ghost" style={{ width: "auto", padding: "5px 12px", fontSize: 12 }} onClick={() => setSelected(selected === s.id ? null : s.id)}>
                      {selected === s.id ? "Close" : "View"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Student detail panel */}
        {selectedStudent && (
          <div className="panel" style={{ animation: "slideUp 0.25s ease" }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div className="avatar" style={{ width: 64, height: 64, fontSize: 24, margin: "0 auto 12px" }}>
                {selectedStudent.name.split(" ").map(n => n[0]).join("")}
              </div>
              <strong style={{ fontSize: 17 }}>{selectedStudent.name}</strong>
              <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>{selectedStudent.id}</p>
              <div style={{ marginTop: 8, display: "flex", gap: 6, justifyContent: "center" }}>
                <span className="tag">{selectedStudent.section}</span>
                <span className="tag">{selectedStudent.year}</span>
              </div>
            </div>

            {/* Mini attendance stats */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
              {[["Present", "43", "var(--success)"], ["Absent", "3", "var(--danger)"], ["Late", "2", "var(--gold)"]].map(([l, v, c]) => (
                <div key={l} style={{ background: "var(--surface)", borderRadius: "var(--radius-sm)", padding: "12px", textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: c as string, fontFamily: "Syne, sans-serif" }}>{v}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>{l}</div>
                </div>
              ))}
            </div>

            {/* Attendance rate bar */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                <span>Attendance Rate</span><strong>{selectedStudent.rate}%</strong>
              </div>
              <div style={{ background: "var(--surface2)", borderRadius: 99, height: 8 }}>
                <div style={{ width: `${selectedStudent.rate}%`, height: "100%", background: selectedStudent.rate >= 85 ? "linear-gradient(90deg, var(--gold), var(--success))" : "var(--danger)", borderRadius: 99 }} />
              </div>
              {selectedStudent.rate < 75 && (
                <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.3)", borderRadius: "var(--radius-sm)", fontSize: 12, color: "var(--danger)" }}>
                  ⚠️ At-risk: Below 75% attendance threshold
                </div>
              )}
            </div>

            {/* Recent records */}
            <h4 style={{ fontSize: 13, marginBottom: 12 }}>Recent Records</h4>
            {[["Mar 22","Pharmacology 301","present"],["Mar 22","Pharmacognosy","present"],["Mar 21","Clinical Pharmacy","absent"],["Mar 20","Pharma Chem","late"]].map(([d,s,st]) => (
              <div key={d+s} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 13 }}>
                <div><div>{s}</div><div style={{ fontSize: 11, color: "var(--muted)" }}>{d}</div></div>
                <span className={`badge badge-${st}`}>{st.toUpperCase()}</span>
              </div>
            ))}
            <button className="btn btn-outline" style={{ marginTop: 16, fontSize: 13 }}>📋 Full Record</button>
          </div>
        )}
      </div>
    </>
  );
}
