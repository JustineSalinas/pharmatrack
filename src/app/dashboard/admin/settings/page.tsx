"use client";

import { useState, useEffect } from "react";
import {
  Bell, Mail, Clock, Calendar, Timer, BarChart2,
  Shield, Save, AlertTriangle, Loader2, CheckCircle,
  UserCheck, Lock
} from "lucide-react";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────
type ConfigKey =
  | "absenceNotifications"
  | "weeklyReports"
  | "lateThreshold"
  | "academicPeriod"
  | "qrExpiry"
  | "minAttendance"
  | "twoFactorAuth"
  | "registrationMode";

type Settings = Record<ConfigKey, string>;

const DEFAULTS: Settings = {
  absenceNotifications: "true",
  weeklyReports: "true",
  lateThreshold: "7:35 AM",
  academicPeriod: "2025–2026 · 2nd Semester",
  qrExpiry: "10 min",
  minAttendance: "75%",
  twoFactorAuth: "false",
  registrationMode: "approval",
};

// ─── Column definitions ───────────────────────────────────
const LEFT_GROUPS = [
  {
    title: "System Configuration",
    items: [
      {
        id: "academicPeriod" as ConfigKey,
        icon: Calendar,
        title: "Academic Period",
        desc: "Current semester label shown across the platform",
        type: "input",
      },
      {
        id: "minAttendance" as ConfigKey,
        icon: BarChart2,
        title: "Minimum Attendance Rate",
        desc: "At-risk threshold — students below this are flagged",
        type: "select",
        options: ["70%", "75%", "80%", "85%"],
      },
      {
        id: "lateThreshold" as ConfigKey,
        icon: Clock,
        title: "Late Check-In Threshold",
        desc: "Students arriving after this time are marked late",
        type: "select",
        options: ["7:30 AM", "7:35 AM", "7:40 AM", "7:45 AM"],
      },
      {
        id: "qrExpiry" as ConfigKey,
        icon: Timer,
        title: "QR Code Expiry",
        desc: "Default session duration when not explicitly set",
        type: "select",
        options: ["5 min", "10 min", "15 min", "30 min"],
      },
    ],
  },
];

const RIGHT_GROUPS = [
  {
    title: "Notifications",
    items: [
      {
        id: "absenceNotifications" as ConfigKey,
        icon: Bell,
        title: "Absence Notifications",
        desc: "Automated alerts sent to absent students after each event",
        type: "toggle",
      },
      {
        id: "weeklyReports" as ConfigKey,
        icon: Mail,
        title: "Weekly Email Reports",
        desc: "Attendance digest sent to facilitators every Monday",
        type: "toggle",
      },
    ],
  },
  {
    title: "Security",
    items: [
      {
        id: "twoFactorAuth" as ConfigKey,
        icon: Shield,
        title: "Two-Factor Authentication",
        desc: "Require 2FA for admin and facilitator logins",
        type: "toggle",
      },
      {
        id: "registrationMode" as ConfigKey,
        icon: UserCheck,
        title: "Facilitator Registration Mode",
        desc: "Controls whether new facilitators need admin approval",
        type: "regmode",
      },
    ],
  },
];

// ─── Component ────────────────────────────────────────────
export default function AdminSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [initial, setInitial] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirty = JSON.stringify(settings) !== JSON.stringify(initial);

  // Load from Supabase on mount
  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase
          .from("system_config")
          .select("key, value");

        if (error) throw error;

        if (data && data.length > 0) {
          const loaded: Partial<Settings> = {};
          data.forEach((row: { key: string; value: string }) => {
            loaded[row.key as ConfigKey] = row.value;
          });
          const merged = { ...DEFAULTS, ...loaded } as Settings;
          setSettings(merged);
          setInitial(merged);
        }
      } catch (err: any) {
        setError("Failed to load settings: " + err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const update = (id: ConfigKey, val: string) => {
    setSettings((prev) => ({ ...prev, [id]: val }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const upserts = (Object.keys(settings) as ConfigKey[]).map((key) => ({
        key,
        value: settings[key],
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("system_config")
        .upsert(upserts, { onConflict: "key" });

      if (error) throw error;

      setInitial({ ...settings });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
    } catch (err: any) {
      setError("Save failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("This will permanently delete all attendance records for the current semester. This cannot be undone.")) return;
    const { error } = await supabase.from("attendance_records").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) alert("Error: " + error.message);
    else alert("All attendance records deleted.");
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
        <Loader2 size={20} color="var(--dimmed)" style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <div className="fade-in">
      {/* ── Header ── */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "28px" }}>
        <div>
          <div className="breadcrumb" style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: 600, color: "var(--dimmed)", letterSpacing: "0.06em", marginBottom: "8px" }}>
            <span>Admin Control</span><span style={{ margin: "0 8px" }}>/</span><span>Settings</span>
          </div>
          <h2 style={{ fontSize: "28px", fontWeight: 700, margin: 0, letterSpacing: "-0.03em", color: "var(--white)" }}>System Settings</h2>
          <p style={{ color: "var(--dimmed)", fontSize: "13px", marginTop: "4px", margin: 0 }}>Platform-wide configuration — changes take effect immediately on save</p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {error && (
            <span style={{ fontSize: "12px", color: "var(--danger)", display: "flex", alignItems: "center", gap: 6 }}>
              <AlertTriangle size={12} /> {error}
            </span>
          )}
          {savedFlash && (
            <span style={{ fontSize: "12px", color: "var(--success)", display: "flex", alignItems: "center", gap: 6 }}>
              <CheckCircle size={12} /> Saved
            </span>
          )}
          {isDirty && !saving && (
            <button
              onClick={handleSave}
              style={{ display: "flex", alignItems: "center", height: "36px", padding: "0 16px", borderRadius: "var(--radius-sm)", border: "1px solid var(--gold)", background: "rgba(212, 175, 55, 0.1)", color: "var(--gold)", fontSize: "13px", fontWeight: 600, cursor: "pointer", gap: "8px", transition: "all 0.15s ease" }}
            >
              <Save size={14} /> Save Changes
            </button>
          )}
          {saving && (
            <button disabled style={{ display: "flex", alignItems: "center", height: "36px", padding: "0 16px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "transparent", color: "var(--dimmed)", fontSize: "13px", fontWeight: 600, gap: "8px", cursor: "not-allowed" }}>
              <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Saving…
            </button>
          )}
        </div>
      </div>

      {/* ── Two-column grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" }}>

        {/* LEFT column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {LEFT_GROUPS.map((group) => (
            <SettingGroup key={group.title} group={group} settings={settings} onUpdate={update} />
          ))}

          {/* Danger Zone */}
          <div>
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
                  onClick={handleReset}
                  style={{ whiteSpace: "nowrap", padding: "0 16px", height: "36px", fontSize: "13px", fontWeight: 600, borderRadius: "var(--radius-sm)", border: "1px solid rgba(255, 59, 48, 0.4)", background: "transparent", color: "var(--danger)", cursor: "pointer", transition: "all 0.15s ease", flexShrink: 0 }}
                >
                  Reset Data
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {RIGHT_GROUPS.map((group) => (
            <SettingGroup key={group.title} group={group} settings={settings} onUpdate={update} />
          ))}
        </div>

      </div>

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
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
          width: 100%;
          box-sizing: border-box;
        }
        select.settings-input { cursor: pointer; }
        .settings-input:focus { border-color: var(--gold); }
      `}</style>
    </div>
  );
}

// ─── Reusable group renderer ──────────────────────────────
function SettingGroup({
  group,
  settings,
  onUpdate,
}: {
  group: { title: string; items: any[] };
  settings: Settings;
  onUpdate: (id: ConfigKey, val: string) => void;
}) {
  return (
    <div>
      <h3 style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--dimmed)", marginBottom: "12px", fontWeight: 600 }}>
        {group.title}
      </h3>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
        {group.items.map((s, i) => {
          const Icon = s.icon;
          const val = settings[s.id as ConfigKey];

          return (
            <div
              key={s.id}
              style={{
                padding: "18px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "20px",
                borderBottom: i < group.items.length - 1 ? "1px solid var(--border)" : "none",
              }}
            >
              <div style={{ display: "flex", gap: "14px", alignItems: "flex-start", flex: 1, minWidth: 0 }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "1px solid var(--border)" }}>
                  <Icon size={15} color="var(--dimmed)" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: "14px", fontWeight: 500, color: "var(--white)" }}>{s.title}</strong>
                  <p style={{ fontSize: "12px", color: "var(--dimmed)", margin: "3px 0 0 0", lineHeight: 1.5 }}>{s.desc}</p>
                </div>
              </div>

              <div style={{ flexShrink: 0 }}>
                {/* Toggle */}
                {s.type === "toggle" && (
                  <div
                    onClick={() => onUpdate(s.id, val === "true" ? "false" : "true")}
                    style={{ width: "36px", height: "20px", borderRadius: "99px", cursor: "pointer", background: val === "true" ? "var(--gold)" : "var(--surface2)", border: "1px solid var(--border)", position: "relative", transition: "all 0.2s ease" }}
                  >
                    <div style={{ position: "absolute", top: "2px", width: "14px", height: "14px", borderRadius: "50%", background: val === "true" ? "#16161D" : "var(--dimmed)", transition: "left 0.2s ease", left: val === "true" ? "18px" : "2px" }} />
                  </div>
                )}

                {/* Select */}
                {s.type === "select" && (
                  <select
                    className="settings-input"
                    style={{ minWidth: "130px" }}
                    value={val}
                    onChange={(e) => onUpdate(s.id, e.target.value)}
                  >
                    {s.options?.map((o: string) => <option key={o}>{o}</option>)}
                  </select>
                )}

                {/* Text input */}
                {s.type === "input" && (
                  <input
                    className="settings-input"
                    style={{ minWidth: "180px" }}
                    value={val}
                    onChange={(e) => onUpdate(s.id, e.target.value)}
                  />
                )}

                {/* Registration mode — pill toggle */}
                {s.type === "regmode" && (
                  <div style={{ display: "flex", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
                    {(["approval", "open"] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => onUpdate(s.id, mode)}
                        style={{
                          padding: "6px 14px",
                          fontSize: "12px",
                          fontWeight: 500,
                          border: "none",
                          cursor: "pointer",
                          fontFamily: "var(--font-sans)",
                          background: val === mode ? (mode === "approval" ? "rgba(232,184,75,0.15)" : "rgba(74,222,128,0.1)") : "transparent",
                          color: val === mode ? (mode === "approval" ? "var(--gold)" : "var(--success)") : "var(--dimmed)",
                          transition: "all 0.15s ease",
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                        }}
                      >
                        {mode === "approval" ? <><Lock size={11} /> Approval-only</> : <><UserCheck size={11} /> Open</>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
