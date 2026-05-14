"use client";

import { useState } from "react";
import { Bell, Mail, Clock, Calendar, Timer, BarChart2, Shield, Database, Save, AlertTriangle } from "lucide-react";

const defaultSettings = {
  absenceNotifications: true,
  weeklyReports: true,
  lateThreshold: "7:35 AM",
  academicPeriod: "2025–2026 · 2nd Semester",
  qrExpiry: "10 min",
  minAttendance: "75%",
  twoFactorAuth: false,
  autoBackup: true,
};

const settingGroups = [
  {
    title: "Notifications",
    items: [
      { id: "absenceNotifications", icon: Bell, title: "Absence Notifications", desc: "Send automated alerts to students who are absent", type: "toggle" },
      { id: "weeklyReports", icon: Mail, title: "Weekly Email Reports", desc: "Send summary reports to facilitators every Monday", type: "toggle" },
    ]
  },
  {
    title: "Scheduling",
    items: [
      { id: "lateThreshold", icon: Clock, title: "Late Check-In Threshold", desc: "Students are marked late after this time", type: "select", options: ["7:30 AM", "7:35 AM", "7:40 AM", "7:45 AM"] },
      { id: "academicPeriod", icon: Calendar, title: "Academic Period", desc: "Current semester configuration", type: "input" },
      { id: "qrExpiry", icon: Timer, title: "QR Code Expiry", desc: "Default session duration if not specified", type: "select", options: ["5 min", "10 min", "15 min", "30 min"] },
      { id: "minAttendance", icon: BarChart2, title: "Minimum Attendance Rate", desc: "Threshold below which students are flagged at-risk", type: "select", options: ["70%", "75%", "80%", "85%"] },
    ]
  },
  {
    title: "Security",
    items: [
      { id: "twoFactorAuth", icon: Shield, title: "Two-Factor Authentication", desc: "Require 2FA for admin accounts", type: "toggle" },
    ]
  },
  {
    title: "Data",
    items: [
      { id: "autoBackup", icon: Database, title: "Auto Backup", desc: "Automatically backup database daily", type: "toggle" },
    ]
  }
];

export default function AdminSettings() {
  const [initialSettings, setInitialSettings] = useState(defaultSettings);
  const [settings, setSettings] = useState(defaultSettings);
  const [saved, setSaved] = useState(false);

  const isDirty = JSON.stringify(settings) !== JSON.stringify(initialSettings);

  const update = (id: string, val: any) => {
    setSettings(prev => ({ ...prev, [id]: val }));
  };

  const handleSave = () => {
    setInitialSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="fade-in">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "32px" }}>
        <div>
          <div className="breadcrumb" style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: 600, color: "var(--dimmed)", letterSpacing: "0.06em", marginBottom: "8px" }}>
            <span>Admin Control</span><span style={{ margin: "0 8px" }}>/</span><span>Settings</span>
          </div>
          <h2 style={{ fontSize: "28px", fontWeight: 700, margin: 0, letterSpacing: "-0.03em", color: "var(--white)" }}>System Settings</h2>
          <p style={{ color: "var(--dimmed)", fontSize: "13px", marginTop: "4px", margin: 0 }}>Configure PharmaTrack for your department</p>
        </div>
        <div className="header-actions" style={{ display: "flex", gap: "12px", alignItems: "center", minHeight: "36px" }}>
          {isDirty && (
            <button 
              className="btn-ghost" 
              onClick={handleSave}
              style={{ display: "flex", alignItems: "center", height: "36px", padding: "0 16px", borderRadius: "var(--radius-sm)", border: "1px solid var(--gold)", background: "rgba(212, 175, 55, 0.1)", color: "var(--gold)", fontSize: "13px", fontWeight: 600, cursor: "pointer", gap: "8px", transition: "all 0.15s ease" }}
            >
              {saved ? "Saved" : <><Save size={14} /> Save Changes</>}
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: "680px", display: "flex", flexDirection: "column", gap: "32px" }}>
        {settingGroups.map(group => (
          <div key={group.title}>
            <h3 style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--dimmed)", marginBottom: "12px", fontWeight: 600 }}>
              {group.title}
            </h3>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
              {group.items.map((s, i) => {
                const Icon = s.icon;
                const val = (settings as any)[s.id];
                
                return (
                  <div key={s.id} style={{ padding: "20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "24px", borderBottom: i < group.items.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <div style={{ display: "flex", gap: "16px", alignItems: "flex-start", flex: 1 }}>
                      <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "1px solid var(--border)" }}>
                        <Icon size={16} color="var(--dimmed)" />
                      </div>
                      <div>
                        <strong style={{ fontSize: "14px", fontWeight: 500, color: "var(--white)" }}>{s.title}</strong>
                        <p style={{ fontSize: "13px", color: "var(--dimmed)", margin: "4px 0 0 0" }}>{s.desc}</p>
                      </div>
                    </div>
                    
                    <div style={{ flexShrink: 0 }}>
                      {s.type === "toggle" && (
                        <div
                          onClick={() => update(s.id, !val)}
                          style={{
                            width: "36px", height: "20px", borderRadius: "99px", cursor: "pointer",
                            background: val ? "var(--gold)" : "var(--surface2)",
                            border: "1px solid var(--border)", position: "relative", transition: "all 0.2s ease",
                          }}
                        >
                          <div style={{
                            position: "absolute", top: "2px", width: "14px", height: "14px", borderRadius: "50%",
                            background: val ? "#16161D" : "var(--dimmed)", transition: "left 0.2s ease",
                            left: val ? "18px" : "2px",
                          }} />
                        </div>
                      )}
                      {s.type === "select" && (
                        <select 
                          className="settings-input"
                          value={val as string} 
                          onChange={(e) => update(s.id, e.target.value)}
                        >
                          {s.options?.map((o) => <option key={o}>{o}</option>)}
                        </select>
                      )}
                      {s.type === "input" && (
                        <input 
                          className="settings-input"
                          value={val as string} 
                          onChange={(e) => update(s.id, e.target.value)} 
                          style={{ width: "200px" }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Danger zone */}
        <div style={{ marginTop: "16px" }}>
          <h3 style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--danger)", marginBottom: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
            <AlertTriangle size={12} /> Danger Zone
          </h3>
          <div style={{ background: "linear-gradient(180deg, var(--surface) 0%, rgba(255, 59, 48, 0.05) 100%)", border: "1px solid rgba(255, 59, 48, 0.3)", borderRadius: "var(--radius)", padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "24px" }}>
              <div>
                <strong style={{ fontSize: "14px", fontWeight: 500, color: "var(--white)" }}>Reset All Attendance Data</strong>
                <p style={{ fontSize: "13px", color: "var(--dimmed)", margin: "4px 0 0 0" }}>Permanently delete all attendance records for this semester.</p>
              </div>
              <button 
                className="btn-danger-ghost" 
                style={{ width: "auto", padding: "0 16px", height: "36px", fontSize: "13px", fontWeight: 600, borderRadius: "var(--radius-sm)", border: "1px solid rgba(255, 59, 48, 0.4)", background: "transparent", color: "var(--danger)", cursor: "pointer", transition: "all 0.15s ease" }}
              >
                Reset Data
              </button>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .settings-input {
          height: 36px;
          padding: 0 12px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border);
          background: var(--surface2);
          color: var(--white);
          font-size: 13px;
          outline: none;
          transition: all 0.15s ease;
          font-family: var(--font-sans);
        }
        select.settings-input {
          cursor: pointer;
          min-width: 140px;
        }
        .settings-input:focus {
          border-color: var(--gold);
        }
        .btn-ghost:hover {
          background: rgba(212, 175, 55, 0.2) !important;
        }
        .btn-danger-ghost:hover {
          background: rgba(255, 59, 48, 0.1) !important;
          border-color: var(--danger) !important;
        }
      `}</style>
    </div>
  );
}
