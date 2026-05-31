"use client";

import { useState, useEffect } from "react";
import {
  Bell, Mail, Clock, Calendar, Timer, BarChart2,
  Shield, Save, AlertTriangle, Loader2, CheckCircle,
  UserCheck, Lock, Database, RefreshCw,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { backfillEventStatuses } from "@/lib/attendance";

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
  lateThreshold: "07:35",
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
        options: ["50%", "55%", "60%", "65%", "70%", "75%", "80%", "85%"],
      },
      {
        id: "lateThreshold" as ConfigKey,
        icon: Clock,
        title: "Late Check-In Threshold",
        desc: "Students arriving after this time are marked late",
        type: "time",
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
  const [tableMissing, setTableMissing] = useState(false);

  const isDirty = JSON.stringify(settings) !== JSON.stringify(initial);

  // Load from Supabase on mount
  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase
          .from("system_config")
          .select("key, value");

        if (error) {
          // Table doesn't exist yet — detect by error code or message
          if (
            error.code === "42P01" ||
            error.message?.toLowerCase().includes("does not exist") ||
            error.message?.toLowerCase().includes("relation") ||
            error.code === "PGRST116"
          ) {
            setTableMissing(true);
          } else {
            setError("Failed to load settings: " + error.message);
          }
          return;
        }

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
        setError("Unexpected error: " + err.message);
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
    if (tableMissing) {
      setError("Run the system_config SQL migration in Supabase first.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const upserts = (Object.keys(settings) as ConfigKey[]).map((key) => ({
        key,
        value: settings[key],
        updated_at: new Date().toISOString(),
      }));

      const { error: upsertError } = await supabase
        .from("system_config")
        .upsert(upserts, { onConflict: "key" });

      if (upsertError) {
        throw new Error(upsertError.message || JSON.stringify(upsertError));
      }

      // Verify the save actually worked by reading back one key
      const { data: check, error: checkError } = await supabase
        .from("system_config")
        .select("value")
        .eq("key", "academicPeriod")
        .single();

      if (checkError || !check) {
        throw new Error(
          "Save appeared to succeed but verification failed. Check RLS policies — the admin policy on system_config may not be applied yet."
        );
      }

      setInitial({ ...settings });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (
      !confirm(
        "This will permanently delete ALL attendance records. This cannot be undone.\n\nType OK to confirm."
      )
    )
      return;
    const { error } = await supabase
      .from("attendance_records")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) alert("Error: " + error.message);
    else alert("All attendance records deleted.");
  };

  const [recomputing, setRecomputing] = useState(false);
  const handleRecompute = async () => {
    if (!confirm("Scan past events and auto-mark missing scans as 'Absent' (and stale time-ins as 'Incomplete')? Safe to re-run.")) return;
    setRecomputing(true);
    try {
      const r = await backfillEventStatuses();
      const lines = [
        `Events processed: ${r.eventsProcessed}`,
        `Absent records inserted: ${r.absentInserted}`,
        `Incomplete records updated: ${r.incompleteUpdated}`,
      ];
      if (r.errors.length) lines.push("", "Errors:", ...r.errors.slice(0, 5));
      alert(lines.join("\n"));
    } catch (err: any) {
      alert("Recompute failed: " + (err?.message ?? err));
    } finally {
      setRecomputing(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "80vh",
        }}
      >
        <Loader2
          size={20}
          color="var(--dimmed)"
          style={{ animation: "spin 1s linear infinite" }}
        />
      </div>
    );
  }

  return (
    <div className="fade-in">
      {/* ── Table-missing banner ── */}
      {tableMissing && (
        <div
          style={{
            background: "rgba(234, 179, 8, 0.08)",
            border: "1px solid rgba(234, 179, 8, 0.35)",
            borderRadius: "var(--radius)",
            padding: "16px 20px",
            marginBottom: "24px",
            display: "flex",
            gap: "14px",
            alignItems: "flex-start",
          }}
        >
          <Database size={16} color="var(--gold)" style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <strong style={{ fontSize: "13px", color: "var(--gold)", fontWeight: 600 }}>
              Database migration required
            </strong>
            <p style={{ fontSize: "13px", color: "var(--dimmed)", margin: "4px 0 0 0", lineHeight: 1.6 }}>
              The <code style={{ background: "var(--surface2)", padding: "1px 5px", borderRadius: 4 }}>system_config</code> table doesn't exist yet.
              Go to <strong style={{ color: "var(--white-shade)" }}>Supabase → SQL Editor</strong> and run the
              block at the bottom of your <code style={{ background: "var(--surface2)", padding: "1px 5px", borderRadius: 4 }}>schema.sql</code> file
              (the SYSTEM CONFIGURATION section). Settings will not save until this is done.
            </p>
          </div>
        </div>
      )}

      {/* ── Error banner ── */}
      {error && (
        <div
          style={{
            background: "rgba(255, 59, 48, 0.08)",
            border: "1px solid rgba(255, 59, 48, 0.3)",
            borderRadius: "var(--radius)",
            padding: "14px 18px",
            marginBottom: "20px",
            display: "flex",
            gap: "12px",
            alignItems: "center",
          }}
        >
          <AlertTriangle size={15} color="var(--danger)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: "13px", color: "var(--danger)", lineHeight: 1.5 }}>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--dimmed)", fontSize: 18, lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      )}

      {/* ── Header ── */}
      <div
        className="page-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: "28px",
        }}
      >
        <div>
          <div
            className="breadcrumb"
            style={{
              fontSize: "11px",
              textTransform: "uppercase",
              fontWeight: 600,
              color: "var(--dimmed)",
              letterSpacing: "0.06em",
              marginBottom: "8px",
            }}
          >
            <span>Admin Control</span>
            <span style={{ margin: "0 8px" }}>/</span>
            <span>Settings</span>
          </div>
          <h2
            style={{
              fontSize: "28px",
              fontWeight: 700,
              margin: 0,
              letterSpacing: "-0.03em",
              color: "var(--white)",
            }}
          >
            System Settings
          </h2>
          <p
            style={{
              color: "var(--dimmed)",
              fontSize: "13px",
              marginTop: "4px",
              margin: 0,
            }}
          >
            Platform-wide configuration — changes take effect immediately on save
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {savedFlash && (
            <span
              style={{
                fontSize: "12px",
                color: "var(--success)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <CheckCircle size={13} /> Saved successfully
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            style={{
              display: "flex",
              alignItems: "center",
              height: "36px",
              padding: "0 16px",
              borderRadius: "var(--radius-sm)",
              border: isDirty
                ? "1px solid var(--success)"
                : "1px solid var(--border)",
              background: isDirty
                ? "rgba(22, 163, 74, 0.1)"
                : "var(--surface)",
              color: isDirty ? "var(--success)" : "var(--dimmed)",
              fontSize: "13px",
              fontWeight: 600,
              cursor: isDirty ? "pointer" : "not-allowed",
              gap: "8px",
              transition: "all 0.15s ease",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? (
              <>
                <Loader2
                  size={13}
                  style={{ animation: "spin 1s linear infinite" }}
                />
                Saving…
              </>
            ) : (
              <>
                <Save size={13} />
                {isDirty ? "Save Changes" : "No Changes"}
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Two-column grid ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "24px",
          alignItems: "start",
        }}
      >
        {/* LEFT column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {LEFT_GROUPS.map((group) => (
            <SettingGroup
              key={group.title}
              group={group}
              settings={settings}
              onUpdate={update}
            />
          ))}

          {/* Danger Zone */}
          <div>
            <h3
              style={{
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--danger)",
                marginBottom: "12px",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <AlertTriangle size={12} /> Danger Zone
            </h3>

            {/* Recompute attendance statuses (non-destructive maintenance) */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "20px",
                marginBottom: "12px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "24px",
              }}
            >
              <div>
                <strong style={{ fontSize: "14px", fontWeight: 500, color: "var(--white)" }}>
                  Recompute Attendance Statuses
                </strong>
                <p style={{ fontSize: "13px", color: "var(--dimmed)", margin: "4px 0 0 0", lineHeight: 1.5 }}>
                  Scans completed events and auto-marks missing scans as <strong>Absent</strong>,
                  and time-ins without a time-out as <strong>Incomplete</strong>. Idempotent —
                  safe to re-run.
                </p>
              </div>
              <button
                onClick={handleRecompute}
                disabled={recomputing}
                style={{
                  whiteSpace: "nowrap", padding: "0 16px", height: "36px",
                  fontSize: "13px", fontWeight: 600, borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--gold)", background: "rgba(232,184,75,0.08)",
                  color: "var(--gold)", cursor: recomputing ? "wait" : "pointer",
                  display: "flex", alignItems: "center", gap: "8px",
                  fontFamily: "var(--font-sans)",
                  opacity: recomputing ? 0.6 : 1,
                }}
              >
                {recomputing
                  ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Working…</>
                  : <><RefreshCw size={13} /> Recompute</>}
              </button>
            </div>

            <div
              style={{
                background:
                  "linear-gradient(180deg, var(--surface) 0%, rgba(255, 59, 48, 0.05) 100%)",
                border: "1px solid rgba(255, 59, 48, 0.3)",
                borderRadius: "var(--radius)",
                padding: "20px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "24px",
                }}
              >
                <div>
                  <strong
                    style={{
                      fontSize: "14px",
                      fontWeight: 500,
                      color: "var(--white)",
                    }}
                  >
                    Reset All Attendance Data
                  </strong>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "var(--dimmed)",
                      margin: "4px 0 0 0",
                    }}
                  >
                    Permanently delete all attendance records for this semester.
                  </p>
                </div>
                <button
                  onClick={handleReset}
                  style={{
                    whiteSpace: "nowrap",
                    padding: "0 16px",
                    height: "36px",
                    fontSize: "13px",
                    fontWeight: 600,
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid rgba(255, 59, 48, 0.4)",
                    background: "transparent",
                    color: "var(--danger)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    flexShrink: 0,
                    fontFamily: "var(--font-sans)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "rgba(255,59,48,0.1)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "transparent";
                  }}
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
            <SettingGroup
              key={group.title}
              group={group}
              settings={settings}
              onUpdate={update}
            />
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
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
        select.settings-input {
          cursor: pointer;
        }
        input[type="time"].settings-input::-webkit-calendar-picker-indicator {
          filter: invert(0.6);
          cursor: pointer;
        }
        .settings-input:focus {
          border-color: var(--gold);
          box-shadow: 0 0 0 2px rgba(212, 175, 55, 0.12);
        }
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
      <h3
        style={{
          fontSize: "11px",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--dimmed)",
          marginBottom: "12px",
          fontWeight: 600,
        }}
      >
        {group.title}
      </h3>
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          overflow: "hidden",
        }}
      >
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
                borderBottom:
                  i < group.items.length - 1
                    ? "1px solid var(--border)"
                    : "none",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: "14px",
                  alignItems: "flex-start",
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    background: "rgba(79, 70, 229, 0.08)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    border: "1px solid rgba(79, 70, 229, 0.18)",
                  }}
                >
                  <Icon size={18} strokeWidth={2.5} color="var(--gold)" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <strong
                    style={{
                      fontSize: "14px",
                      fontWeight: 500,
                      color: "var(--white)",
                    }}
                  >
                    {s.title}
                  </strong>
                  <p
                    style={{
                      fontSize: "12px",
                      color: "var(--dimmed)",
                      margin: "3px 0 0 0",
                      lineHeight: 1.5,
                    }}
                  >
                    {s.desc}
                  </p>
                </div>
              </div>

              <div style={{ flexShrink: 0 }}>
                {/* Toggle */}
                {s.type === "toggle" && (
                  <div
                    role="switch"
                    aria-checked={val === "true"}
                    onClick={() =>
                      onUpdate(s.id, val === "true" ? "false" : "true")
                    }
                    style={{
                      width: "36px",
                      height: "20px",
                      borderRadius: "99px",
                      cursor: "pointer",
                      background:
                        val === "true" ? "var(--gold)" : "var(--surface2)",
                      border: "1px solid var(--border)",
                      position: "relative",
                      transition: "background 0.2s ease",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: "2px",
                        width: "14px",
                        height: "14px",
                        borderRadius: "50%",
                        background:
                          val === "true" ? "#16161D" : "var(--dimmed)",
                        transition: "left 0.2s ease",
                        left: val === "true" ? "18px" : "2px",
                      }}
                    />
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
                    {s.options?.map((o: string) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                )}

                {/* Free-form text input */}
                {s.type === "input" && (
                  <input
                    className="settings-input"
                    style={{ minWidth: "180px" }}
                    placeholder="e.g. 2025-2026"
                    value={val}
                    onChange={(e) => onUpdate(s.id, e.target.value)}
                  />
                )}

                {/* Time picker — editable, 24h → display as 12h */}
                {s.type === "time" && (
                  <input
                    type="time"
                    className="settings-input"
                    style={{ minWidth: "130px", colorScheme: "light" }}
                    value={val}
                    onChange={(e) => onUpdate(s.id, e.target.value)}
                  />
                )}

                {/* Registration mode — pill toggle */}
                {s.type === "regmode" && (
                  <div
                    style={{
                      display: "flex",
                      background: "var(--surface2)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                      overflow: "hidden",
                    }}
                  >
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
                          background:
                            val === mode
                              ? mode === "approval"
                                ? "rgba(232,184,75,0.15)"
                                : "rgba(74,222,128,0.1)"
                              : "transparent",
                          color:
                            val === mode
                              ? mode === "approval"
                                ? "var(--gold)"
                                : "var(--success)"
                              : "var(--dimmed)",
                          transition: "all 0.15s ease",
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                        }}
                      >
                        {mode === "approval" ? (
                          <>
                            <Lock size={11} /> Approval-only
                          </>
                        ) : (
                          <>
                            <UserCheck size={11} /> Open
                          </>
                        )}
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
