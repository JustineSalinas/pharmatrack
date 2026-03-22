"use client";
import { FileText, Download } from "lucide-react";

export default function ReportsPage() {
  return (
    <div className="fade-in">
      <header style={{ marginBottom: "40px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: "2rem", fontWeight: "700" }}>Attendance Reports</h1>
          <p style={{ color: "var(--muted)" }}>Generate and download participation data.</p>
        </div>
        <button className="btn btn-outline">
          <Download size={20} style={{ marginRight: "8px" }} /> Export All (CSV)
        </button>
      </header>

      <div className="card">
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <FileText size={48} color="var(--border)" style={{ marginBottom: "20px" }} />
          <h3 style={{ color: "var(--muted)" }}>No reports available</h3>
          <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.3)" }}>Attendance records will appear here after events are scanned.</p>
        </div>
      </div>
    </div>
  );
}
