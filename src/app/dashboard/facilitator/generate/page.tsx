"use client";

import { useState, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth-client";
import {
  Loader2, QrCode, Plus, Trash2, Clock, BookOpen,
  Users as UsersIcon, CalendarDays, AlertCircle, CheckCircle2,
  Copy, X,
} from "lucide-react";

const EXPIRY_PRESETS = [
  { label: "10 min", minutes: 10 },
  { label: "30 min", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "2 hours", minutes: 120 },
];

const SECTION_OPTIONS = [
  "PH 1A", "PH 1B", "PH 1C", "PH 1D", "PH 1E",
  "PH 2A", "PH 2B", "PH 2C", "PH 2D", "PH 2E",
  "PH 3A", "PH 3B", "PH 3C", "PH 3D",
  "PH 4A", "PH 4B", "PH 4C", "PH 4D",
];

interface QRSessionRow {
  id: string;
  facilitator_id: string;
  subject: string;
  section: string;
  date: string;
  expires_at: string;
  code: string;
  created_at: string;
}

/** Short, human-friendly session code (A–Z 0–9, no ambiguous chars). */
function generateCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function msToCountdown(ms: number): { label: string; expired: boolean } {
  if (ms <= 0) return { label: "Expired", expired: true };
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return { label: `${h}h ${m}m`, expired: false };
  return { label: `${m}m ${s.toString().padStart(2, "0")}s`, expired: false };
}

export default function GenerateQRPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<QRSessionRow[]>([]);
  const [showActive, setShowActive] = useState<QRSessionRow | null>(null);
  const [now, setNow] = useState(Date.now());

  // Form state
  const [subject, setSubject] = useState("");
  const [section, setSection] = useState(SECTION_OPTIONS[0]);
  const [expiry, setExpiry] = useState(EXPIRY_PRESETS[1].minutes);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const u = await getCurrentUser();
        if (!active) return;
        setUser(u);
        if (u?.id) await refreshSessions(u.id);
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    }
    init();
    return () => { active = false; };
  }, []);

  // 1-second tick for the countdown chips.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const refreshSessions = useCallback(async (facilitatorId: string) => {
    const { data } = await supabase
      .from("qr_sessions")
      .select("*")
      .eq("facilitator_id", facilitatorId)
      .order("created_at", { ascending: false })
      .limit(20);
    setSessions((data as unknown as QRSessionRow[]) ?? []);
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.id) return;
    setError("");
    if (!subject.trim()) { setError("Subject is required."); return; }
    setSubmitting(true);
    try {
      const expiresAt = new Date(Date.now() + expiry * 60_000).toISOString();
      const todayDate = new Date().toISOString().split("T")[0];

      // Up to 3 attempts in case the random code collides with the unique index.
      let inserted: QRSessionRow | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const code = generateCode();
        const { data, error: insErr } = await supabase
          .from("qr_sessions")
          .insert({
            facilitator_id: user.id,
            subject: subject.trim(),
            section,
            date: todayDate,
            expires_at: expiresAt,
            code,
          })
          .select("*")
          .single();
        if (!insErr && data) {
          inserted = data as unknown as QRSessionRow;
          break;
        }
        // 23505 = unique_violation; retry on that, otherwise surface the error.
        if (insErr && (insErr as any).code !== "23505") {
          throw insErr;
        }
      }
      if (!inserted) throw new Error("Could not generate a unique code. Please try again.");

      setSubject("");
      setShowActive(inserted);
      await refreshSessions(user.id);
    } catch (err: any) {
      setError(err?.message || "Failed to create session.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!user?.id) return;
    if (!confirm("End this session? Students will no longer be able to scan in.")) return;
    const { error: delErr } = await supabase.from("qr_sessions").delete().eq("id", id);
    if (delErr) {
      alert("Failed to delete: " + delErr.message);
      return;
    }
    if (showActive?.id === id) setShowActive(null);
    await refreshSessions(user.id);
  }

  function copyCode(code: string) {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  if (loading) {
    return (
      <div className="sp-center-screen">
        <Loader2 className="sp-spinner" size={36} />
      </div>
    );
  }

  const activeCount = sessions.filter((s) => new Date(s.expires_at).getTime() > now).length;

  return (
    <div className="fade-in sd-root">
      {/* Header */}
      <header className="sd-header">
        <div>
          <p className="sd-header-eyebrow">Facilitator · QR Sessions</p>
          <h1 className="sd-header-title">Generate Class QR</h1>
          <p className="sd-header-tagline">
            Create a timed QR code your students scan to log attendance for a class or lab session.
          </p>
        </div>
        <div className="sd-header-date">
          <Clock size={13} />
          {activeCount} active
        </div>
      </header>

      <div className="gqr-grid">
        {/* LEFT: Create form */}
        <form className="gqr-form-card" onSubmit={handleCreate}>
          <div className="gqr-form-section-title">
            <Plus size={15} color="var(--gold)" /> New Session
          </div>

          {error && (
            <div className="sp-form-error">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <div className="sp-input-group">
            <label className="sp-input-label">Subject / Activity</label>
            <div className="sp-input-wrap">
              <BookOpen size={15} className="sp-input-icon" />
              <input
                className="sp-input"
                placeholder="e.g. Pharmacology Lecture"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
          </div>

          <div className="sp-input-group">
            <label className="sp-input-label">Section</label>
            <div className="sp-input-wrap">
              <UsersIcon size={15} className="sp-input-icon" />
              <select
                className="sp-input sp-select"
                value={section}
                onChange={(e) => setSection(e.target.value)}
              >
                {SECTION_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="sp-input-group">
            <label className="sp-input-label">Expires In</label>
            <div className="gqr-expiry-row">
              {EXPIRY_PRESETS.map((p) => (
                <button
                  key={p.minutes}
                  type="button"
                  className={`gqr-expiry-btn ${expiry === p.minutes ? "active" : ""}`}
                  onClick={() => setExpiry(p.minutes)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" className="sp-save-btn" disabled={submitting}>
            {submitting
              ? <><Loader2 size={15} className="sp-spinner-sm" /> Creating…</>
              : <><QrCode size={15} /> Generate QR Session</>}
          </button>
        </form>

        {/* RIGHT: Active QR or recent list */}
        <div className="gqr-right-col">
          {showActive ? (
            <div className="gqr-active-card">
              <div className="gqr-active-header">
                <div>
                  <p className="sd-panel-label">Active Session</p>
                  <h3 className="gqr-active-title">{showActive.subject}</h3>
                  <p className="gqr-active-sub">{showActive.section}</p>
                </div>
                <button
                  className="gqr-close-btn"
                  onClick={() => setShowActive(null)}
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="gqr-qr-wrap">
                <QRCodeSVG value={showActive.code} size={220} level="H" includeMargin={false} />
              </div>

              <div className="gqr-code-row">
                <span className="gqr-code-label">Session Code</span>
                <button
                  type="button"
                  className="gqr-code-pill"
                  onClick={() => copyCode(showActive.code)}
                  title="Click to copy"
                >
                  {showActive.code}
                  {copied
                    ? <CheckCircle2 size={13} color="var(--success)" />
                    : <Copy size={13} />}
                </button>
              </div>

              <CountdownChip expiresAt={showActive.expires_at} now={now} />

              <p className="gqr-active-hint">
                Project this QR code or share the session code. Students can scan it from
                their Check-In page, or enter the code manually.
              </p>
            </div>
          ) : (
            <div className="gqr-empty-card">
              <div className="gqr-empty-icon"><QrCode size={36} /></div>
              <h3 className="gqr-empty-title">No active session yet</h3>
              <p className="gqr-empty-sub">
                Fill out the form to generate a timed QR code. Active sessions appear here.
              </p>
            </div>
          )}

          {/* Recent sessions */}
          <div className="gqr-recent-panel">
            <div className="gqr-recent-header">
              <CalendarDays size={14} color="var(--gold)" />
              <h4 className="gqr-recent-title">Recent Sessions</h4>
            </div>

            {sessions.length === 0 ? (
              <div className="gqr-recent-empty">
                You haven&apos;t created any sessions yet.
              </div>
            ) : (
              <div className="gqr-recent-list">
                {sessions.map((s) => {
                  const remaining = new Date(s.expires_at).getTime() - now;
                  const cd = msToCountdown(remaining);
                  return (
                    <div key={s.id} className="gqr-recent-row">
                      <div className="gqr-recent-info">
                        <span className="gqr-recent-subject">{s.subject}</span>
                        <span className="gqr-recent-meta">
                          {s.section} · code <strong className="gqr-recent-code">{s.code}</strong>
                        </span>
                      </div>
                      <span className={`gqr-recent-pill ${cd.expired ? "expired" : "active"}`}>
                        <Clock size={11} /> {cd.label}
                      </span>
                      <div className="gqr-recent-actions">
                        {!cd.expired && (
                          <button
                            type="button"
                            className="gqr-icon-btn"
                            title="Show QR"
                            onClick={() => setShowActive(s)}
                          >
                            <QrCode size={14} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="gqr-icon-btn danger"
                          title="End session"
                          onClick={() => handleDelete(s.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CountdownChip({ expiresAt, now }: { expiresAt: string; now: number }) {
  const remaining = new Date(expiresAt).getTime() - now;
  const cd = msToCountdown(remaining);
  return (
    <div className={`gqr-countdown ${cd.expired ? "expired" : ""}`}>
      <Clock size={13} />
      {cd.expired ? "This session has expired" : `Expires in ${cd.label}`}
    </div>
  );
}
