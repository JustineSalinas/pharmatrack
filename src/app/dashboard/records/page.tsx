"use client";
import { useState } from "react";

const records = [
  { date: "Mar 22", subject: "Pharmacology 301", timeIn: "7:28 AM", timeOut: "9:30 AM", status: "present", remarks: "On time" },
  { date: "Mar 22", subject: "Pharmacognosy", timeIn: "9:31 AM", timeOut: "11:30 AM", status: "present", remarks: "On time" },
  { date: "Mar 21", subject: "Clinical Pharmacy", timeIn: "—", timeOut: "—", status: "absent", remarks: "No check-in" },
  { date: "Mar 20", subject: "Pharma Chem", timeIn: "7:45 AM", timeOut: "5:00 PM", status: "late", remarks: "7 min late" },
  { date: "Mar 19", subject: "Pharmacology 301", timeIn: "7:29 AM", timeOut: "9:30 AM", status: "present", remarks: "On time" },
  { date: "Mar 18", subject: "Pharmacognosy", timeIn: "—", timeOut: "—", status: "absent", remarks: "No check-in" },
  { date: "Mar 17", subject: "Clinical Pharmacy", timeIn: "7:30 AM", timeOut: "3:00 PM", status: "present", remarks: "On time" },
  { date: "Mar 15", subject: "Pharma Chem", timeIn: "7:28 AM", timeOut: "5:00 PM", status: "present", remarks: "On time" },
  { date: "Mar 14", subject: "Pharmacology 301", timeIn: "7:35 AM", timeOut: "9:30 AM", status: "late", remarks: "5 min late" },
  { date: "Mar 13", subject: "Pharmacognosy", timeIn: "7:30 AM", timeOut: "11:30 AM", status: "present", remarks: "On time" },
];

export default function StudentRecords() {
  const [statusFilter, setStatusFilter] = useState("All");
  const [subjectFilter, setSubjectFilter] = useState("All");

  const subjects = ["All", ...Array.from(new Set(records.map(r => r.subject)))];
  const filtered = records.filter(r => {
    const s = statusFilter === "All" || r.status === statusFilter.toLowerCase();
    const sub = subjectFilter === "All" || r.subject === subjectFilter;
    return s && sub;
  });

  const present = records.filter(r => r.status === "present").length;
  const absent = records.filter(r => r.status === "absent").length;
  const late = records.filter(r => r.status === "late").length;
  const rate = Math.round((present / records.length) * 100);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb"><span>Student</span><span>›</span><span>My Records</span></div>
          <h2>Attendance Records</h2>
          <p>Your complete attendance history this semester</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline" style={{ width: "auto", padding: "9px 18px", fontSize: 13 }}>⬇️ Export CSV</button>
        </div>
      </div>

      {/* Summary */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        {[
          { label: "Total Classes", value: records.length, color: undefined },
          { label: "Present", value: present, color: "var(--success)" },
          { label: "Absent", value: absent, color: "var(--danger)" },
          { label: "Late", value: late, color: "var(--gold)" },
          { label: "Rate", value: `${rate}%`, color: rate >= 85 ? "var(--success)" : "var(--danger)" },
        ].map((s) => (
          <div className="stat-card" key={s.label}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-val" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {["All", "Present", "Late", "Absent"].map((f) => (
          <button key={f} className={`btn ${statusFilter === f ? "btn-gold" : "btn-outline"}`} style={{ width: "auto", padding: "6px 16px", fontSize: 12 }} onClick={() => setStatusFilter(f)}>{f}</button>
        ))}
        <div style={{ width: 1, background: "var(--border)", margin: "0 4px" }} />
        <div className="input-wrap select-wrap" style={{ width: 200 }}>
          <select className="inp" style={{ padding: "7px 32px 7px 12px", fontSize: 12 }} value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
            {subjects.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Date</th><th>Subject</th><th>Time In</th><th>Time Out</th><th>Status</th><th>Remarks</th></tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={i}>
                  <td style={{ whiteSpace: "nowrap" }}>{r.date}</td>
                  <td>{r.subject}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 13 }}>{r.timeIn}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 13 }}>{r.timeOut}</td>
                  <td><span className={`badge badge-${r.status}`}>{r.status.toUpperCase()}</span></td>
                  <td style={{ fontSize: 12, color: "var(--muted)" }}>{r.remarks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--muted)", fontSize: 14 }}>
            No records found for the selected filters.
          </div>
        )}
      </div>
    </>
  );
}
