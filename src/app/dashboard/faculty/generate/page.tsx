"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

const SUBJECTS = ["Pharmacology 301", "Pharmacognosy", "Clinical Pharmacy", "Pharmaceutical Chemistry", "Pharmacy Law & Ethics"];
const SECTIONS = ["All Sections", "PharmA", "PharmB", "PharmC"];
const DURATIONS = [5, 10, 15, 30, 60];

function generateCode() {
  return "PHARM-" + new Date().toISOString().slice(5,10).replace("-","") + "-" + Math.random().toString(36).substr(2,4).toUpperCase();
}

function QRPattern({ code }: { code: string }) {
  // Deterministic-ish pattern from code string
  const seed = code.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const cells = Array.from({ length: 64 }, (_, i) => (seed * (i + 1) * 2654435761) % 2 === 0);
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="180" height="180">
      <rect width="100" height="100" fill="#1a0f40" rx="8" />
      {cells.map((on, i) => on ? (
        <rect key={i} x={(i % 8) * 12 + 2} y={Math.floor(i / 8) * 12 + 2} width="10" height="10" fill="#E8C84A" rx="1" />
      ) : null)}
      {/* Corner markers */}
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
        await supabase.from("qr_sessions").insert({
          faculty_id: user.id,
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

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb"><span>Faculty</span><span>›</span><span>Generate QR</span></div>
          <h2>Generate QR Code</h2>
          <p>Create a timed session QR for attendance tracking</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Form */}
        <div className="panel">
          <h3 style={{ marginBottom: 20 }}>Session Details</h3>
          <div className="input-group">
            <label>Subject</label>
            <div className="input-wrap select-wrap">
              <select className="inp" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>
                {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="input-group">
            <label>Section</label>
            <div className="input-wrap select-wrap">
              <select className="inp" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })}>
                {SECTIONS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="input-group">
              <label>Date</label>
              <div className="input-wrap">
                <span className="icon">📅</span>
                <input className="inp" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>
            <div className="input-group">
              <label>Duration</label>
              <div className="input-wrap select-wrap">
                <select className="inp" value={form.duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}>
                  {DURATIONS.map((d) => <option key={d} value={d}>{d} min</option>)}
                </select>
              </div>
            </div>
          </div>
          <button className="btn btn-gold" onClick={handleGenerate} disabled={loading}>
            {loading ? "⏳ Generating..." : generated ? "🔄 Regenerate QR" : "📲 Generate QR Code"}
          </button>

          {generated && (
            <div style={{ marginTop: 20, padding: 16, background: "var(--surface)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>Session Info</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
                <div><span style={{ color: "var(--muted)" }}>Subject: </span>{form.subject}</div>
                <div><span style={{ color: "var(--muted)" }}>Section: </span>{form.section}</div>
                <div><span style={{ color: "var(--muted)" }}>Date: </span>{form.date}</div>
                <div><span style={{ color: "var(--muted)" }}>Code: </span><span style={{ fontFamily: "monospace", color: "var(--gold)" }}>{code}</span></div>
              </div>
            </div>
          )}
        </div>

        {/* QR Preview */}
        <div className="panel" style={{ textAlign: "center" }}>
          <h3 style={{ marginBottom: 16 }}>QR Preview</h3>
          <div style={{ width: 200, height: 200, margin: "0 auto 16px", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: generated ? "transparent" : "var(--surface2)", border: generated ? "none" : "2px dashed var(--border)", fontSize: 13, color: "var(--muted)" }}>
            {generated ? <QRPattern code={code} /> : "Configure and generate"}
          </div>

          {generated && (
            <>
              <div style={{ fontFamily: "monospace", fontSize: 14, color: "var(--gold)", marginBottom: 12 }}>{code}</div>
              <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "Syne, sans-serif", color: timeLeft > 60 ? "var(--gold)" : "var(--danger)", marginBottom: 16 }}>
                {timeLeft > 0 ? `⏱️ ${fmtTime(timeLeft)}` : "❌ Expired"}
              </div>
              {/* Progress bar */}
              <div style={{ background: "var(--surface2)", borderRadius: 99, height: 6, marginBottom: 20 }}>
                <div style={{ width: `${(timeLeft / (form.duration * 60)) * 100}%`, height: "100%", background: "linear-gradient(90deg, var(--gold), var(--success))", borderRadius: 99, transition: "width 1s linear" }} />
              </div>
            </>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button className="btn btn-outline" style={{ width: "auto", padding: "9px 16px", fontSize: 12 }} disabled={!generated}>⬇️ Download</button>
            <button className="btn btn-outline" style={{ width: "auto", padding: "9px 16px", fontSize: 12 }} disabled={!generated}>📤 Share</button>
            <button className="btn btn-outline" style={{ width: "auto", padding: "9px 16px", fontSize: 12 }} disabled={!generated} onClick={() => navigator.clipboard?.writeText(code)}>📋 Copy</button>
          </div>
        </div>
      </div>

      {/* Recent sessions */}
      <div className="panel" style={{ marginTop: 20 }}>
        <div className="panel-header"><h3>Recent Sessions</h3></div>
        <table><thead><tr><th>Subject</th><th>Section</th><th>Date</th><th>Code</th><th>Status</th></tr></thead>
          <tbody>
            {[
              ["Pharmacology 301","PharmA","Mar 22","PHARM-0322-A1","Expired"],
              ["Pharmacognosy","PharmB","Mar 21","PHARM-0321-B2","Expired"],
              ["Clinical Pharmacy","All","Mar 20","PHARM-0320-C3","Expired"],
            ].map(([subj, sec, date, c, stat]) => (
              <tr key={c}>
                <td>{subj}</td><td><span className="tag">{sec}</span></td><td>{date}</td>
                <td><span style={{ fontFamily: "monospace", fontSize: 12, color: "var(--muted)" }}>{c}</span></td>
                <td><span className="badge badge-absent">{stat}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
