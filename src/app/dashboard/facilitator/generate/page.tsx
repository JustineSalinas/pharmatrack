"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import {
  ScanLine, Clock, CheckCircle, XCircle, Calendar, BookOpen, Users, Wifi, WifiOff,
} from "lucide-react";

const SUBJECTS = ["Pharmacology 301", "Pharmacognosy", "Clinical Pharmacy", "Pharmaceutical Chemistry", "Pharmacy Law & Ethics"];
const SECTIONS = ["All Sections", "PharmA", "PharmB", "PharmC"];

export default function ScannerPage() {
  const [form, setForm] = useState({
    subject: SUBJECTS[0],
    section: SECTIONS[0],
    date: new Date().toISOString().slice(0, 10),
  });
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string; student?: string } | null>(null);
  const [recentScans, setRecentScans] = useState<{ student: string; section: string; time: string; status: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const scanLineAnim = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (scanLineAnim.current) clearInterval(scanLineAnim.current); }, []);

  const handleStartScanning = () => {
    setScanning(true);
    setScanResult(null);
  };

  const handleStopScanning = () => {
    setScanning(false);
    setScanResult(null);
  };

  // Simulate a scan (replace with real camera/QR logic)
  const handleSimulateScan = () => {
    const mockStudents = ["Juan dela Cruz", "Maria Santos", "Carlo Reyes", "Ana Lim"];
    const student = mockStudents[Math.floor(Math.random() * mockStudents.length)];
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    setScanResult({ success: true, message: "Student successfully checked in.", student });
    setRecentScans((prev) => [
      { student, section: form.section === "All Sections" ? "PharmA" : form.section, time: timeStr, status: "checked-in" },
      ...prev.slice(0, 9),
    ]);

    setTimeout(() => setScanResult(null), 3000);
  };

  /* ── Shared styles ── */
  const cardStyle: React.CSSProperties = {
    background: "var(--card, #13152a)",
    border: "1px solid var(--border, rgba(255,255,255,0.07))",
    borderRadius: 12,
    overflow: "hidden",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--muted)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 6,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    color: "var(--foreground, #fff)",
    fontSize: 13,
    outline: "none",
    appearance: "none" as const,
    WebkitAppearance: "none" as const,
  };

  const scanLineKeyframes = `
    @keyframes scanLine {
      0%   { top: 8%; opacity: 0; }
      10%  { opacity: 1; }
      90%  { opacity: 1; }
      100% { top: 88%; opacity: 0; }
    }
    @keyframes pulse-ring {
      0%   { transform: scale(0.95); opacity: 0.6; }
      50%  { transform: scale(1.03); opacity: 1; }
      100% { transform: scale(0.95); opacity: 0.6; }
    }
    .qr-scan-line {
      position: absolute;
      left: 12%;
      right: 12%;
      height: 2px;
      background: linear-gradient(90deg, transparent, rgba(200,146,42,0.9), transparent);
      animation: scanLine 2.2s ease-in-out infinite;
      border-radius: 2px;
    }
    .scanner-frame-active {
      animation: pulse-ring 2s ease-in-out infinite;
    }
  `;

  return (
    <>
      <style>{scanLineKeyframes}</style>

      {/* Page Header */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "var(--muted)", textTransform: "uppercase", marginBottom: 4 }}>
          Facilitator
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>QR Scanner</h2>
      </div>

      {/* Main 2-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 32 }}>

        {/* ── Session Details Card ── */}
        <div style={{ ...cardStyle, padding: "24px 28px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "var(--muted)", textTransform: "uppercase", marginBottom: 24 }}>
            Session Details
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Subject */}
            <div>
              <div style={labelStyle}>Subject</div>
              <div style={{ position: "relative" }}>
                <BookOpen size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }} />
                <select
                  style={{ ...inputStyle, paddingLeft: 34 }}
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  disabled={scanning}
                >
                  {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Section */}
            <div>
              <div style={labelStyle}>Section</div>
              <div style={{ position: "relative" }}>
                <Users size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }} />
                <select
                  style={{ ...inputStyle, paddingLeft: 34 }}
                  value={form.section}
                  onChange={(e) => setForm({ ...form, section: e.target.value })}
                  disabled={scanning}
                >
                  {SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Date */}
            <div>
              <div style={labelStyle}>Date</div>
              <div style={{ position: "relative" }}>
                <Calendar size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }} />
                <input
                  type="date"
                  style={{ ...inputStyle, paddingLeft: 34 }}
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  disabled={scanning}
                />
              </div>
            </div>

            {/* Start / Stop Scanner Button */}
            {!scanning ? (
              <button
                onClick={handleStartScanning}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "12px 24px",
                  background: "var(--gold, #f0c040)",
                  border: "none",
                  borderRadius: 8,
                  color: "#000",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "opacity 0.15s",
                }}
              >
                <ScanLine size={15} />
                Open Scanner
              </button>
            ) : (
              <button
                onClick={handleStopScanning}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "12px 24px",
                  background: "rgba(248,113,113,0.15)",
                  border: "1px solid rgba(248,113,113,0.35)",
                  borderRadius: 8,
                  color: "#f87171",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "opacity 0.15s",
                }}
              >
                <XCircle size={15} />
                Stop Scanning
              </button>
            )}
          </div>

          {/* Session Info */}
          <div style={{
            marginTop: 20,
            padding: "16px 20px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 10,
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
              Session Info
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
              <div><span style={{ color: "var(--muted)" }}>Subject: </span>{form.subject}</div>
              <div><span style={{ color: "var(--muted)" }}>Section: </span>{form.section}</div>
              <div><span style={{ color: "var(--muted)" }}>Date: </span>{form.date}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: "var(--muted)" }}>Status: </span>
                {scanning ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "#4ade80", fontWeight: 600, fontSize: 12 }}>
                    <Wifi size={13} /> Live
                  </span>
                ) : (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--muted)", fontSize: 12 }}>
                    <WifiOff size={13} /> Idle
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Scanner Preview Card ── */}
        <div style={{ ...cardStyle, padding: "24px 28px", textAlign: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "var(--muted)", textTransform: "uppercase", marginBottom: 24 }}>
            Scanner Preview
          </div>

          {/* Scan viewport */}
          <div
            className={scanning ? "scanner-frame-active" : ""}
            style={{
              width: 200,
              height: 200,
              margin: "0 auto 20px",
              borderRadius: 14,
              position: "relative",
              background: scanning ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.02)",
              border: scanning
                ? "1.5px solid rgba(200,146,42,0.5)"
                : "1.5px dashed rgba(255,255,255,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              transition: "border-color 0.3s",
            }}
          >
            {/* Corner brackets */}
            {[
              { top: 8, left: 8, borderWidth: "2px 0 0 2px" },
              { top: 8, right: 8, borderWidth: "2px 2px 0 0" },
              { bottom: 8, left: 8, borderWidth: "0 0 2px 2px" },
              { bottom: 8, right: 8, borderWidth: "0 2px 2px 0" },
            ].map((style, i) => (
              <span key={i} style={{
                position: "absolute",
                width: 18,
                height: 18,
                borderColor: scanning ? "rgba(200,146,42,0.8)" : "rgba(255,255,255,0.25)",
                borderStyle: "solid",
                transition: "border-color 0.3s",
                ...style,
              }} />
            ))}

            {/* Scan line (only when active) */}
            {scanning && <div className="qr-scan-line" />}

            {/* Center content */}
            {!scanning ? (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", lineHeight: 1.5 }}>
                Configure and<br />open scanner
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <ScanLine size={28} style={{ color: "rgba(200,146,42,0.6)" }} />
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.04em" }}>
                  Waiting for QR…
                </span>
              </div>
            )}
          </div>

          {/* Status indicator */}
          <div style={{ marginBottom: 16 }}>
            {scanning ? (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 14px", background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.25)", borderRadius: 99, fontSize: 12, color: "#4ade80", fontWeight: 500 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", display: "inline-block", animation: "pulse-ring 1.5s ease-in-out infinite" }} />
                Scanner Active
              </div>
            ) : (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 99, fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "inline-block" }} />
                Scanner Idle
              </div>
            )}
          </div>

          {/* Scan result feedback */}
          {scanResult && (
            <div style={{
              margin: "0 0 16px",
              padding: "12px 16px",
              background: scanResult.success ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)",
              border: `1px solid ${scanResult.success ? "rgba(74,222,128,0.25)" : "rgba(248,113,113,0.25)"}`,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              gap: 10,
              textAlign: "left",
            }}>
              {scanResult.success
                ? <CheckCircle size={16} style={{ color: "#4ade80", flexShrink: 0 }} />
                : <XCircle size={16} style={{ color: "#f87171", flexShrink: 0 }} />}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: scanResult.success ? "#4ade80" : "#f87171" }}>
                  {scanResult.student}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{scanResult.message}</div>
              </div>
            </div>
          )}

          {/* Simulate scan button (dev/demo only — replace with real camera integration) */}
          {scanning && (
            <button
              onClick={handleSimulateScan}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 18px",
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: 8,
                color: "rgba(255,255,255,0.65)",
                fontSize: 12,
                cursor: "pointer",
                transition: "background 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <ScanLine size={13} />
              Simulate Scan
            </button>
          )}
        </div>
      </div>

      {/* ── Recent Scans Card ── */}
      <div style={{ ...cardStyle, marginTop: 16 }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: "1px solid var(--border, rgba(255,255,255,0.07))",
        }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Recent Scans</span>
          <a style={{ color: "var(--gold, #f0c040)", fontSize: 12, cursor: "pointer" }}>View all →</a>
        </div>

        {recentScans.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border, rgba(255,255,255,0.07))" }}>
                {["Student", "Section", "Time", "Status"].map(h => (
                  <th key={h} style={{ padding: "10px 20px", textAlign: "left", fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentScans.map((s, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid var(--border, rgba(255,255,255,0.04))" }}>
                  <td style={{ padding: "12px 20px" }}>{s.student}</td>
                  <td style={{ padding: "12px 20px" }}>
                    <span style={{ padding: "3px 10px", background: "rgba(255,255,255,0.06)", borderRadius: 6, fontSize: 11, fontWeight: 500 }}>{s.section}</span>
                  </td>
                  <td style={{ padding: "12px 20px", color: "var(--muted)", fontSize: 12 }}>{s.time}</td>
                  <td style={{ padding: "12px 20px" }}>
                    <span style={{ padding: "3px 10px", background: "rgba(74,222,128,0.1)", color: "#4ade80", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                      Checked In
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
            No scans recorded yet. Start scanning to see results here.
          </div>
        )}
      </div>
    </>
  );
}
