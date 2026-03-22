"use client";
import { useState } from "react";

const names = ["Juan D.", "Ana S.", "Ben C.", "Clara T.", "Diego L.", "Eva R.", "Felix G.", "Grace Y.", "Henry P.", "Iris M.", "Jake T.", "Karla V.", "Leo B.", "Mia T.", "Nathan V.", "Olivia C."];
const subjects = ["Pharmacology 301", "Pharmacognosy", "Clinical Pharmacy", "Pharma Chem"];
const sections = ["PharmA", "PharmB", "PharmC"];
const statuses: ("present" | "absent" | "late")[] = ["present", "present", "present", "late", "absent", "present"];
const times = ["7:28", "7:31", "7:29", "7:45", "—", "7:30", "7:27", "7:33", "7:35", "—", "7:29", "7:31", "7:34", "—", "7:28", "7:40"];

const records = Array.from({ length: 16 }, (_, i) => ({
  id: i + 1,
  name: names[i],
  subject: subjects[i % 4],
  section: sections[i % 3],
  date: "Mar 22, 2026",
  timeIn: times[i],
  status: statuses[i % statuses.length],
}));

export default function AdminAttendance() {
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterSection, setFilterSection] = useState("All");
  const [selectedDate, setSelectedDate] = useState("2026-03-22");

  const filtered = records.filter(r => {
    const s = filterStatus === "All" || r.status === filterStatus.toLowerCase();
    const sec = filterSection === "All" || r.section === filterSection;
    return s && sec;
  });

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb"><span>Admin</span><span>›</span><span>Attendance Logs</span></div>
          <h2>Attendance Logs</h2>
          <p>Complete attendance record database</p>
        </div>
        <div className="header-actions">
          <input className="inp" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ width: 170, padding: "9px 14px", fontSize: 13 }} />
          <button className="btn btn-gold" style={{ width: "auto", padding: "9px 18px", fontSize: 13 }}>⬇️ Export CSV</button>
        </div>
      </div>

      {/* Summary chips */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {[["✅ Present", records.filter(r => r.status === "present").length, "var(--success)"],
          ["⏰ Late", records.filter(r => r.status === "late").length, "var(--gold)"],
          ["❌ Absent", records.filter(r => r.status === "absent").length, "var(--danger)"],
          ["📋 Total", records.length, "var(--muted)"]].map(([l, v, c]) => (
          <div key={l as string} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "10px 18px", display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ color: c as string, fontFamily: "Syne, sans-serif", fontSize: 22, fontWeight: 800 }}>{v}</span>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>{l}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {["All", "Present", "Late", "Absent"].map((f) => (
          <button key={f} className={`btn ${filterStatus === f ? "btn-gold" : "btn-outline"}`} style={{ width: "auto", padding: "6px 16px", fontSize: 12 }} onClick={() => setFilterStatus(f)}>{f}</button>
        ))}
        <div style={{ width: 1, background: "var(--border)", margin: "0 4px" }} />
        {["All", ...sections].map((s) => (
          <button key={s} className={`btn ${filterSection === s ? "btn-ghost" : "btn-outline"}`} style={{ width: "auto", padding: "6px 14px", fontSize: 12 }} onClick={() => setFilterSection(s)}>{s}</button>
        ))}
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead><tr><th>#</th><th>Student</th><th>Subject</th><th>Section</th><th>Date</th><th>Time In</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td style={{ color: "var(--muted)", fontSize: 12 }}>{r.id}</td>
                  <td>{r.name}</td>
                  <td style={{ fontSize: 13 }}>{r.subject}</td>
                  <td><span className="tag">{r.section}</span></td>
                  <td style={{ fontSize: 12, color: "var(--muted)" }}>{r.date}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 13 }}>{r.timeIn}</td>
                  <td><span className={`badge badge-${r.status}`}>{r.status.toUpperCase()}</span></td>
                  <td>
                    <button className="btn btn-ghost" style={{ width: "auto", padding: "4px 10px", fontSize: 11 }}>Edit</button>
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
