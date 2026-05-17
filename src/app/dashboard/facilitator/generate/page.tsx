"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import {
  ScanLine, CheckCircle, XCircle, Calendar, BookOpen, Wifi, WifiOff,
  LogIn, LogOut, Clock, AlertTriangle,
} from "lucide-react";

const SUBJECTS = ["Pharmacology 301", "Pharmacognosy", "Clinical Pharmacy", "Pharmaceutical Chemistry", "Pharmacy Law & Ethics"];
const DURATIONS = [30, 60, 90, 120, 180]; // session duration in minutes

type ScanMode = "check-in" | "check-out";
type ScanEntry = {
  student: string;
  checkInTime: string;       // "HH:MM AM/PM"
  checkInTimestamp: number;  // Date.now()
  checkOutTime: string | null;
  duration: string | null;   // e.g. "1h 23m"
  late: boolean;
  status: "checked-in" | "checked-out";
};

function elapsed(ms: number) {
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function ScannerPage() {
  const [form, setForm] = useState({
    subject: SUBJECTS[0],
    date: new Date().toISOString().slice(0, 10),
    sessionDuration: 60, // minutes — used to detect late check-out
  });
  const [scanning, setScanning] = useState(false);
  const [mode, setMode] = useState<ScanMode>("check-in");
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string; student?: string; late?: boolean } | null>(null);
  const [entries, setEntries] = useState<ScanEntry[]>([]);
  const [tick, setTick] = useState(0); // forces re-render every minute for live duration
  const resultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    tickInterval.current = setInterval(() => setTick(t => t + 1), 60000);
    return () => {
      if (tickInterval.current) clearInterval(tickInterval.current);
      if (resultTimer.current) clearTimeout(resultTimer.current);
    };
  }, []);

  const handleStartScanning = () => { setScanning(true); setScanResult(null); };
  const handleStopScanning = () => { setScanning(false); setScanResult(null); };

  const showResult = (result: typeof scanResult) => {
    setScanResult(result);
    if (resultTimer.current) clearTimeout(resultTimer.current);
    resultTimer.current = setTimeout(() => setScanResult(null), 3500);
  };

  const handleSimulateScan = () => {
    const mockStudents = ["Juan dela Cruz", "Maria Santos", "Carlo Reyes", "Ana Lim", "Ben Torres"];
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    if (mode === "check-in") {
      const student = mockStudents[Math.floor(Math.random() * mockStudents.length)];
      const alreadyIn = entries.find(e => e.student === student && e.status === "checked-in");
      if (alreadyIn) {
        showResult({ success: false, message: "Already checked in.", student });
        return;
      }
      setEntries(prev => [{
        student,
        checkInTime: timeStr,
        checkInTimestamp: Date.now(),
        checkOutTime: null,
        duration: null,
        late: false,
        status: "checked-in",
      }, ...prev]);
      showResult({ success: true, message: "Successfully checked in.", student });

    } else {
      // check-out
      const checkedIn = entries.filter(e => e.status === "checked-in");
      if (checkedIn.length === 0) {
        showResult({ success: false, message: "No checked-in students found.", student: undefined });
        return;
      }
      const target = checkedIn[Math.floor(Math.random() * checkedIn.length)];
      const durationMs = Date.now() - target.checkInTimestamp;
      const sessionMs = form.sessionDuration * 60 * 1000;
      const isLate = durationMs > sessionMs;
      const durationStr = elapsed(durationMs);

      setEntries(prev => prev.map(e =>
        e.student === target.student && e.status === "checked-in"
          ? { ...e, checkOutTime: timeStr, duration: durationStr, late: isLate, status: "checked-out" }
          : e
      ));
      showResult({ success: true, message: `Checked out after ${durationStr}.${isLate ? " Late checkout." : ""}`, student: target.student, late: isLate });
    }
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

  const css = `
    @keyframes scanLine {
      0%   { top: 8%; opacity: 0; }
      10%  { opacity: 1; }
      90%  { opacity: 1; }
      100% { top: 88%; opacity: 0; }
    }
    @keyframes pulseGreen {
      0%, 100% { opacity: 0.6; transform: scale(0.95); }
      50%       { opacity: 1;   transform: scale(1.05); }
    }
    .qr-scan-line {
      position: absolute; left: 12%; right: 12%; height: 2px;
      background: linear-gradient(90deg, transparent, rgba(200,146,42,0.9), transparent);
      animation: scanLine 2.2s ease-in-out infinite; border-radius: 2px;
    }
    .pulse-dot { animation: pulseGreen 1.5s ease-in-out infinite; }
  `;

  const checkedInCount = entries.filter(e => e.status === "checked-in").length;
  const checkedOutCount = entries.filter(e => e.status === "checked-out").length;
  const lateCount = entries.filter(e => e.late).length;

  return (
    <>
      <style>{css}</style>

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
                <select style={{ ...inputStyle, paddingLeft: 34 }} value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} disabled={scanning}>
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Date */}
            <div>
              <div style={labelStyle}>Date</div>
              <div style={{ position: "relative" }}>
                <Calendar size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }} />
                <input type="date" style={{ ...inputStyle, paddingLeft: 34 }} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} disabled={scanning} />
              </div>
            </div>

            {/* Session Duration (for late detection) */}
            <div>
              <div style={labelStyle}>Session Duration</div>
              <div style={{ position: "relative" }}>
                <Clock size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }} />
                <select style={{ ...inputStyle, paddingLeft: 34 }} value={form.sessionDuration} onChange={e => setForm({ ...form, sessionDuration: Number(e.target.value) })} disabled={scanning}>
                  {DURATIONS.map(d => <option key={d} value={d}>{d} min</option>)}
                </select>
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 5 }}>
                Students checking out after this window are flagged as late.
              </div>
            </div>

            {/* Open / Stop */}
            {!scanning ? (
              <button onClick={handleStartScanning} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 24px", background: "var(--gold, #f0c040)", border: "none", borderRadius: 8, color: "#000", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                <ScanLine size={15} /> Open Scanner
              </button>
            ) : (
              <button onClick={handleStopScanning} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 24px", background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.35)", borderRadius: 8, color: "#f87171", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                <XCircle size={15} /> Stop Scanning
              </button>
            )}
          </div>

          {/* Session Info */}
          <div style={{ marginTop: 20, padding: "16px 20px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Session Info</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
              <div><span style={{ color: "var(--muted)" }}>Subject: </span>{form.subject}</div>
              <div><span style={{ color: "var(--muted)" }}>Date: </span>{form.date}</div>
              <div><span style={{ color: "var(--muted)" }}>Duration: </span>{form.sessionDuration} min</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: "var(--muted)" }}>Status: </span>
                {scanning
                  ? <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "#4ade80", fontWeight: 600, fontSize: 12 }}><Wifi size={13} /> Live</span>
                  : <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--muted)", fontSize: 12 }}><WifiOff size={13} /> Idle</span>}
              </div>
            </div>
          </div>
        </div>

        {/* ── Scanner Preview Card ── */}
        <div style={{ ...cardStyle, padding: "24px 28px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "var(--muted)", textTransform: "uppercase", marginBottom: 20, alignSelf: "flex-start" }}>
            Scanner Preview
          </div>

          {/* Check In / Check Out toggle — only shown when scanning */}
          {scanning && (
            <div style={{ display: "flex", gap: 0, marginBottom: 20, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9, overflow: "hidden", width: "100%" }}>
              {(["check-in", "check-out"] as ScanMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setScanResult(null); }}
                  style={{
                    flex: 1,
                    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                    padding: "10px 0",
                    background: mode === m
                      ? m === "check-in" ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)"
                      : "transparent",
                    border: "none",
                    borderRight: m === "check-in" ? "1px solid rgba(255,255,255,0.1)" : "none",
                    color: mode === m
                      ? m === "check-in" ? "#4ade80" : "#f87171"
                      : "rgba(255,255,255,0.35)",
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                    transition: "background 0.2s, color 0.2s",
                  }}
                >
                  {m === "check-in" ? <LogIn size={14} /> : <LogOut size={14} />}
                  {m === "check-in" ? "Check In" : "Check Out"}
                </button>
              ))}
            </div>
          )}

          {/* Scan viewport */}
          <div style={{
            width: 200, height: 200,
            margin: "0 auto 20px",
            borderRadius: 14,
            position: "relative",
            background: scanning ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.02)",
            border: scanning
              ? mode === "check-in" ? "1.5px solid rgba(74,222,128,0.45)" : "1.5px solid rgba(248,113,113,0.45)"
              : "1.5px dashed rgba(255,255,255,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden", transition: "border-color 0.3s",
          }}>
            {/* Corner brackets */}
            {[
              { top: 8, left: 8, borderWidth: "2px 0 0 2px" },
              { top: 8, right: 8, borderWidth: "2px 2px 0 0" },
              { bottom: 8, left: 8, borderWidth: "0 0 2px 2px" },
              { bottom: 8, right: 8, borderWidth: "0 2px 2px 0" },
            ].map((s, i) => (
              <span key={i} style={{
                position: "absolute", width: 18, height: 18,
                borderColor: scanning
                  ? mode === "check-in" ? "rgba(74,222,128,0.7)" : "rgba(248,113,113,0.7)"
                  : "rgba(255,255,255,0.25)",
                borderStyle: "solid", transition: "border-color 0.3s", ...s,
              }} />
            ))}
            {scanning && <div className="qr-scan-line" style={{ background: `linear-gradient(90deg, transparent, ${mode === "check-in" ? "rgba(74,222,128,0.8)" : "rgba(248,113,113,0.8)"}, transparent)` }} />}

            {!scanning ? (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", lineHeight: 1.5, textAlign: "center" }}>
                Configure and<br />open scanner
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                {mode === "check-in" ? <LogIn size={26} style={{ color: "rgba(74,222,128,0.6)" }} /> : <LogOut size={26} style={{ color: "rgba(248,113,113,0.6)" }} />}
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.04em" }}>
                  Waiting for QR…
                </span>
              </div>
            )}
          </div>

          {/* Status pill */}
          <div style={{ marginBottom: 16 }}>
            {scanning ? (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 14px", background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.25)", borderRadius: 99, fontSize: 12, color: "#4ade80", fontWeight: 500 }}>
                <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />
                Scanner Active — {mode === "check-in" ? "Check In" : "Check Out"} Mode
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
              width: "100%", marginBottom: 16,
              padding: "12px 16px",
              background: scanResult.success ? (scanResult.late ? "rgba(251,191,36,0.08)" : "rgba(74,222,128,0.08)") : "rgba(248,113,113,0.08)",
              border: `1px solid ${scanResult.success ? (scanResult.late ? "rgba(251,191,36,0.3)" : "rgba(74,222,128,0.25)") : "rgba(248,113,113,0.25)"}`,
              borderRadius: 10, display: "flex", alignItems: "center", gap: 10, textAlign: "left",
            }}>
              {scanResult.success
                ? scanResult.late
                  ? <AlertTriangle size={16} style={{ color: "#fbbf24", flexShrink: 0 }} />
                  : <CheckCircle size={16} style={{ color: "#4ade80", flexShrink: 0 }} />
                : <XCircle size={16} style={{ color: "#f87171", flexShrink: 0 }} />}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: scanResult.success ? (scanResult.late ? "#fbbf24" : "#4ade80") : "#f87171" }}>
                  {scanResult.student ?? "Error"}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{scanResult.message}</div>
              </div>
            </div>
          )}

          {/* Simulate scan */}
          {scanning && (
            <button
              onClick={handleSimulateScan}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 18px", background: "transparent", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 8, color: "rgba(255,255,255,0.65)", fontSize: 12, cursor: "pointer", transition: "background 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <ScanLine size={13} /> Simulate Scan
            </button>
          )}
        </div>
      </div>

      {/* ── Live Summary strip ── */}
      {entries.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginTop: 16 }}>
          {[
            { label: "Checked In", value: checkedInCount, color: "#4ade80", bg: "rgba(74,222,128,0.08)", border: "rgba(74,222,128,0.2)" },
            { label: "Checked Out", value: checkedOutCount, color: "rgba(255,255,255,0.7)", bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.1)" },
            { label: "Late Checkouts", value: lateCount, color: "#fbbf24", bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.2)" },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10, padding: "14px 20px" }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: s.color, lineHeight: 1, marginBottom: 4 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Recent Scans table ── */}
      <div style={{ ...cardStyle, marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border, rgba(255,255,255,0.07))" }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Recent Scans</span>
          <a style={{ color: "var(--gold, #f0c040)", fontSize: 12, cursor: "pointer" }}>View all →</a>
        </div>

        {entries.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border, rgba(255,255,255,0.07))" }}>
                {["Student", "Check In", "Check Out", "Duration", "Status"].map(h => (
                  <th key={h} style={{ padding: "10px 20px", textAlign: "left", fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e, idx) => {
                const liveDuration = e.status === "checked-in" ? elapsed(Date.now() - e.checkInTimestamp) : e.duration;
                const sessionMs = form.sessionDuration * 60 * 1000;
                const isCurrentlyLate = e.status === "checked-in" && (Date.now() - e.checkInTimestamp) > sessionMs;
                return (
                  <tr key={idx} style={{ borderBottom: "1px solid var(--border, rgba(255,255,255,0.04))" }}>
                    <td style={{ padding: "12px 20px", fontWeight: 500 }}>{e.student}</td>
                    <td style={{ padding: "12px 20px", color: "var(--muted)", fontSize: 12 }}>{e.checkInTime}</td>
                    <td style={{ padding: "12px 20px", color: "var(--muted)", fontSize: 12 }}>{e.checkOutTime ?? "—"}</td>
                    <td style={{ padding: "12px 20px" }}>
                      <span style={{ fontSize: 12, color: isCurrentlyLate || e.late ? "#fbbf24" : "var(--muted)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                        {(isCurrentlyLate || e.late) && <AlertTriangle size={12} style={{ color: "#fbbf24" }} />}
                        {liveDuration ?? "—"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 20px" }}>
                      {e.status === "checked-in" ? (
                        <span style={{ padding: "3px 10px", background: "rgba(74,222,128,0.1)", color: "#4ade80", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>Checked In</span>
                      ) : (
                        <span style={{ padding: "3px 10px", background: e.late ? "rgba(251,191,36,0.1)" : "rgba(255,255,255,0.06)", color: e.late ? "#fbbf24" : "rgba(255,255,255,0.6)", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                          {e.late ? "Late Out" : "Checked Out"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
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
