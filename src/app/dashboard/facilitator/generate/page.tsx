"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import {
  QrCode, Clock, Download, Share2, Copy, Calendar, BookOpen, Users, Timer,
} from "lucide-react";

const SUBJECTS = ["Pharmacology 301", "Pharmacognosy", "Clinical Pharmacy", "Pharmaceutical Chemistry", "Pharmacy Law & Ethics"];
const SECTIONS = ["All Sections", "PharmA", "PharmB", "PharmC"];
const DURATIONS = [5, 10, 15, 30, 60];

function generateCode() {
  return "PHARM-" + new Date().toISOString().slice(5,10).replace("-","") + "-" + Math.random().toString(36).substr(2,4).toUpperCase();
}

function QRPattern({ code }: { code: string }) {
  const seed = code.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const cells = Array.from({ length: 64 }, (_, i) => (seed * (i + 1) * 2654435761) % 2 === 0);
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="180" height="180">
      <rect width="100" height="100" fill="#1a0f40" rx="8" />
      {cells.map((on, i) => on ? (
        <rect key={i} x={(i % 8) * 12 + 2} y={Math.floor(i / 8) * 12 + 2} width="10" height="10" fill="#E8C84A" rx="1" />
      ) : null)}
      {[[2,2],[70,2],[2,70]].map(([x,y],i) => (
        <g key={i}>
          <rect x={x} y={y} width="28" height="28" fill="none" stroke="#E8C84A" strokeWidth="2" rx="3" />
          <rect x={x+6} y={y+6} width="16" height="16" fill="#E8C84A" rx="2" />
        </g>
      ))}
    </svg>
  );
}

export default function GenerateQRPage() {
  const [form, setForm] = useState({ subject: SUBJECTS[0], section: SECTIONS[0], date: new Date().toISOString().slice(0,10), duration: 10 });
  const [generated, setGenerated] = useState(false);
  const [code, setCode] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const handleGenerate = async () => {
    setLoading(true);
    const newCode = generateCode();
    const expiresAt = new Date(Date.now() + form.duration * 60 * 1000).toISOString();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await (supabase.from("qr_sessions") as any).insert({
          facilitator_id: user.id,
          subject: form.subject,
          section: form.section,
          date: form.date,
          expires_at: expiresAt,
          code: newCode,
        });
      }
    } catch (_) { /* dev mode: proceed anyway */ }

    setCode(newCode);
    setTimeLeft(form.duration * 60);
    setGenerated(true);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(timerRef.current!); return 0; }
        return t - 1;
      });
    }, 1000);
    setLoading(false);
  };

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  /* ── Shared card style ── */
  const cardStyle: React.CSSProperties = {
    background: "var(--card, #13152a)",
    border: "1px solid var(--border, rgba(255,255,255,0.07))",
    borderRadius: 12,
    overflow: "hidden",
  };

  /* ── Label style ── */
  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--muted)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 6,
  };

  /* ── Input / select style ── */
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

  return (
    <>
      {/* Page Header */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "var(--muted)", textTransform: "uppercase", marginBottom: 4 }}>
          Facilitator
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Generate QR Code</h2>
      </div>

      {/* Main 2-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 32 }}>

        {/* ── Session Details Card ── */}
        <div style={{ ...cardStyle, padding: "24px 28px" }}>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.08em",
            color: "var(--muted)",
            textTransform: "uppercase",
            marginBottom: 24,
          }}>
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
                >
                  {SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Date + Duration row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={labelStyle}>Date</div>
                <div style={{ position: "relative" }}>
                  <Calendar size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }} />
                  <input
                    type="date"
                    style={{ ...inputStyle, paddingLeft: 34 }}
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <div style={labelStyle}>Duration</div>
                <div style={{ position: "relative" }}>
                  <Timer size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }} />
                  <select
                    style={{ ...inputStyle, paddingLeft: 34 }}
                    value={form.duration}
                    onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
                  >
                    {DURATIONS.map((d) => <option key={d} value={d}>{d} min</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={loading}
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
                cursor: loading ? "wait" : "pointer",
                opacity: loading ? 0.7 : 1,
                transition: "opacity 0.15s",
              }}
            >
              <QrCode size={15} />
              {loading ? "Generating..." : generated ? "Regenerate QR" : "Generate QR Code"}
            </button>
          </div>

          {/* Session Info (after generation) */}
          {generated && (
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
                <div>
                  <span style={{ color: "var(--muted)" }}>Code: </span>
                  <span style={{ fontFamily: "monospace", color: "var(--gold, #f0c040)" }}>{code}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── QR Preview Card ── */}
        <div style={{ ...cardStyle, padding: "24px 28px", textAlign: "center" }}>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.08em",
            color: "var(--muted)",
            textTransform: "uppercase",
            marginBottom: 24,
          }}>
            QR Preview
          </div>

          {/* QR display area */}
          <div style={{
            width: 200,
            height: 200,
            margin: "0 auto 20px",
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: generated ? "transparent" : "rgba(255,255,255,0.03)",
            border: generated ? "none" : "1.5px dashed rgba(255,255,255,0.12)",
            fontSize: 13,
            color: "rgba(255,255,255,0.35)",
          }}>
            {generated ? <QRPattern code={code} /> : "Configure and generate"}
          </div>

          {generated && (
            <>
              {/* Code display */}
              <div style={{ fontFamily: "monospace", fontSize: 14, color: "var(--gold, #f0c040)", marginBottom: 12, letterSpacing: "0.05em" }}>
                {code}
              </div>

              {/* Timer */}
              <div style={{
                fontSize: 32,
                fontWeight: 700,
                color: timeLeft > 60 ? "var(--foreground, #fff)" : "#f87171",
                marginBottom: 8,
                lineHeight: 1,
              }}>
                {timeLeft > 0 ? fmtTime(timeLeft) : "Expired"}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>
                {timeLeft > 0 ? "Time Remaining" : "Session Ended"}
              </div>

              {/* Progress bar */}
              <div style={{
                background: "rgba(255,255,255,0.06)",
                borderRadius: 99,
                height: 4,
                marginBottom: 24,
                position: "relative",
              }}>
                <div style={{
                  width: `${(timeLeft / (form.duration * 60)) * 100}%`,
                  height: "100%",
                  background: timeLeft > 60 ? "rgba(255,255,255,0.3)" : "#f87171",
                  borderRadius: 99,
                  transition: "width 1s linear",
                }} />
              </div>
            </>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            {[
              { icon: <Download size={14} />, label: "Download" },
              { icon: <Share2 size={14} />, label: "Share" },
              { icon: <Copy size={14} />, label: "Copy", onClick: () => navigator.clipboard?.writeText(code) },
            ].map((btn) => (
              <button
                key={btn.label}
                disabled={!generated}
                onClick={btn.onClick}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 16px",
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 8,
                  color: generated ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.25)",
                  fontSize: 12,
                  cursor: generated ? "pointer" : "default",
                  transition: "background 0.15s, border-color 0.15s",
                }}
                onMouseEnter={e => {
                  if (generated) {
                    e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.22)";
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
                }}
              >
                {btn.icon}
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Recent Sessions Card ── */}
      <div style={{ ...cardStyle, marginTop: 16 }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: "1px solid var(--border, rgba(255,255,255,0.07))",
        }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Recent Sessions</span>
          <a style={{ color: "var(--gold, #f0c040)", fontSize: 12, cursor: "pointer" }}>View all →</a>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border, rgba(255,255,255,0.07))" }}>
              {["Subject", "Section", "Date", "Code", "Status"].map(h => (
                <th key={h} style={{
                  padding: "10px 20px",
                  textAlign: "left",
                  fontSize: 11,
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  fontWeight: 600,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ["Pharmacology 301", "PharmA", "Mar 22", "PHARM-0322-A1", "Expired"],
              ["Pharmacognosy", "PharmB", "Mar 21", "PHARM-0321-B2", "Expired"],
              ["Clinical Pharmacy", "All", "Mar 20", "PHARM-0320-C3", "Expired"],
            ].map(([subj, sec, date, c, stat]) => (
              <tr key={c} style={{ borderBottom: "1px solid var(--border, rgba(255,255,255,0.04))" }}>
                <td style={{ padding: "12px 20px" }}>{subj}</td>
                <td style={{ padding: "12px 20px" }}>
                  <span style={{
                    padding: "3px 10px",
                    background: "rgba(255,255,255,0.06)",
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 500,
                  }}>{sec}</span>
                </td>
                <td style={{ padding: "12px 20px", color: "var(--muted)", fontSize: 12 }}>{date}</td>
                <td style={{ padding: "12px 20px" }}>
                  <span style={{ fontFamily: "monospace", fontSize: 12, color: "var(--muted)" }}>{c}</span>
                </td>
                <td style={{ padding: "12px 20px" }}>
                  <span style={{
                    padding: "3px 10px",
                    background: "rgba(248,113,113,0.12)",
                    color: "#f87171",
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 600,
                  }}>{stat}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
