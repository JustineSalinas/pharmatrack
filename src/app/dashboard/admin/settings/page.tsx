"use client";
import { useState } from "react";

interface Setting {
  icon: string;
  title: string;
  desc: string;
  type: "toggle" | "input" | "select";
  value: string | boolean;
  options?: string[];
}

export default function AdminSettings() {
  const [settings, setSettings] = useState<Setting[]>([
    { icon: "🔔", title: "Absence Notifications", desc: "Send automated alerts to students who are absent", type: "toggle", value: true },
    { icon: "📧", title: "Weekly Email Reports", desc: "Send summary reports to facilitators every Monday", type: "toggle", value: true },
    { icon: "⏰", title: "Late Check-In Threshold", desc: "Students are marked late after this time", type: "select", value: "7:35 AM", options: ["7:30 AM", "7:35 AM", "7:40 AM", "7:45 AM"] },
    { icon: "📅", title: "Academic Period", desc: "Current semester configuration", type: "input", value: "2025–2026 · 2nd Semester" },
    { icon: "🔑", title: "QR Code Expiry", desc: "Default session duration if not specified", type: "select", value: "10 min", options: ["5 min", "10 min", "15 min", "30 min"] },
    { icon: "📊", title: "Minimum Attendance Rate", desc: "Threshold below which students are flagged at-risk", type: "select", value: "75%", options: ["70%", "75%", "80%", "85%"] },
    { icon: "🔐", title: "Two-Factor Authentication", desc: "Require 2FA for admin accounts", type: "toggle", value: false },
    { icon: "🗃️", title: "Auto Backup", desc: "Automatically backup database daily", type: "toggle", value: true },
  ]);

  const [saved, setSaved] = useState(false);

  const toggle = (i: number) => {
    setSettings(prev => prev.map((s, idx) => idx === i ? { ...s, value: !s.value as boolean } : s));
  };

  const update = (i: number, val: string) => {
    setSettings(prev => prev.map((s, idx) => idx === i ? { ...s, value: val } : s));
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb"><span>Admin</span><span>›</span><span>Settings</span></div>
          <h2>System Settings</h2>
          <p>Configure PharmaTrack for your department</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-gold" style={{ width: "auto", padding: "9px 18px", fontSize: 13 }} onClick={handleSave}>
            {saved ? "✅ Saved!" : "💾 Save Changes"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gap: 12, maxWidth: 680 }}>
        {settings.map((s, i) => (
          <div key={s.title} className="panel" style={{ padding: "18px 22px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flex: 1 }}>
                <span style={{ fontSize: 22, lineHeight: 1 }}>{s.icon}</span>
                <div>
                  <strong style={{ fontSize: 14 }}>{s.title}</strong>
                  <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>{s.desc}</p>
                </div>
              </div>
              <div style={{ flexShrink: 0 }}>
                {s.type === "toggle" && (
                  <div
                    onClick={() => toggle(i)}
                    style={{
                      width: 44, height: 24, borderRadius: 99, cursor: "pointer",
                      background: s.value ? "var(--gold)" : "var(--surface2)",
                      border: "1px solid var(--border)", position: "relative", transition: "background 0.2s",
                    }}
                  >
                    <div style={{
                      position: "absolute", top: 3, width: 16, height: 16, borderRadius: "50%",
                      background: s.value ? "#1a0f40" : "var(--muted)", transition: "left 0.2s",
                      left: s.value ? 24 : 3,
                    }} />
                  </div>
                )}
                {s.type === "select" && (
                  <div className="input-wrap select-wrap" style={{ width: 140 }}>
                    <select className="inp" style={{ padding: "7px 32px 7px 12px", fontSize: 13 }} value={s.value as string} onChange={(e) => update(i, e.target.value)}>
                      {s.options?.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                )}
                {s.type === "input" && (
                  <input className="inp" style={{ width: 200, padding: "7px 12px", fontSize: 13 }} value={s.value as string} onChange={(e) => update(i, e.target.value)} />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Danger zone */}
      <div style={{ marginTop: 32, maxWidth: 680 }}>
        <h3 style={{ fontSize: 15, marginBottom: 12, color: "var(--danger)" }}>⚠️ Danger Zone</h3>
        <div className="panel" style={{ border: "1px solid rgba(255,107,107,0.3)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong style={{ fontSize: 14 }}>Reset All Attendance Data</strong>
              <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>Permanently delete all attendance records for this semester</p>
            </div>
            <button className="btn btn-danger" style={{ width: "auto", padding: "9px 18px", fontSize: 13 }}>Reset Data</button>
          </div>
        </div>
      </div>
    </>
  );
}
