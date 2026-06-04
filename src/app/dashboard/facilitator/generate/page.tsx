"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth-client";
import { downloadQRPng } from "@/lib/downloadQR";
import { QRCodeSVG } from "qrcode.react";
import {
  Loader2, QrCode, PlusCircle, ArrowLeft, Calendar,
  Clock, Users, BarChart2, Info, Sparkles, CheckCircle2,
  XCircle, Download as DownloadIcon, RefreshCw, Trash2
} from "lucide-react";
import { useRouter } from "next/navigation";

const SUBJECTS = [
  "PH-CHEM 101 (Pharmaceutical Chemistry I)",
  "PH-COG 201 (Pharmacognosy)",
  "PH-CEUT 302 (Pharmaceutics II)",
  "PH-COL 401 (Pharmacology & Therapeutics)",
  "PH-CLIN 402 (Clinical Pharmacy)",
  "PH-PHYS 102 (Human Anatomy & Physiology)",
  "PH-TOX 304 (Toxicology)"
];

const SECTIONS = [
  "PH 1A", "PH 1B", "PH 1C", "PH 1D", "PH 1E",
  "PH 2A", "PH 2B", "PH 2C", "PH 2D", "PH 2E",
  "PH 3A", "PH 3B", "PH 3C", "PH 3D",
  "PH 4A", "PH 4B", "PH 4C", "PH 4D"
];

const EXPIRIES = [
  { label: "5 minutes", value: 5 },
  { label: "10 minutes", value: 10 },
  { label: "15 minutes", value: 15 },
  { label: "30 minutes", value: 30 }
];

interface SessionRow {
  id: string;
  subject: string;
  section: string;
  date: string;
  expires_at: string;
  code: string;
}

interface ScanRow {
  id: string;
  name: string;
  idNumber: string;
  timeIn: string;
  status: string;
}

export default function QRGeneratorPage() {
  const router = useRouter();
  const [facilitator, setFacilitator] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [subject, setSubject] = useState("");
  const [section, setSection] = useState("");
  const [duration, setDuration] = useState(10); // Default minutes
  const [formError, setFormError] = useState("");

  // Active Session State
  const [activeSession, setActiveSession] = useState<SessionRow | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isExpired, setIsExpired] = useState(false);
  const [recentScans, setRecentScans] = useState<ScanRow[]>([]);
  const [fetchingScans, setFetchingScans] = useState(false);
  const qrWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        const user = await getCurrentUser();
        if (!user) {
          router.push("/login");
          return;
        }
        if (user.account_type !== "facilitator" && user.account_type !== "admin") {
          router.push("/dashboard");
          return;
        }
        setFacilitator(user);

        // Fetch defaults from system configuration if available
        const { data: config } = await supabase
          .from("system_config")
          .select("key, value");
        if (config) {
          const expiryConfig = config.find(c => c.key === "qrExpiry");
          if (expiryConfig?.value) {
            const parsedMin = parseInt(expiryConfig.value, 10);
            if (!isNaN(parsedMin)) setDuration(parsedMin);
          }
        }

        // Load active session from storage if it hasn't expired yet
        const savedSession = sessionStorage.getItem("active_qr_session");
        if (savedSession) {
          const parsed: SessionRow = JSON.parse(savedSession);
          if (new Date(parsed.expires_at) > new Date()) {
            setActiveSession(parsed);
            fetchScans(parsed.id);
          } else {
            sessionStorage.removeItem("active_qr_session");
          }
        }
      } catch (err) {
        console.error("Error loading generator:", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router]);

  // Live countdown timer hook
  useEffect(() => {
    if (!activeSession) return;
    setIsExpired(false);

    const updateTimer = () => {
      const difference = new Date(activeSession.expires_at).getTime() - new Date().getTime();
      if (difference <= 0) {
        setTimeLeft("EXPIRED");
        setIsExpired(true);
        clearInterval(interval);
        return;
      }

      const minutes = Math.floor(difference / 60000);
      const seconds = Math.floor((difference % 60000) / 1000);
      setTimeLeft(`${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [activeSession]);

  // Real-time Postgres subscriptions hook
  useEffect(() => {
    if (!activeSession) return;

    fetchScans(activeSession.id);

    const channel = supabase
      .channel(`session-att-${activeSession.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance_records" },
        () => {
          fetchScans(activeSession.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeSession]);

  const fetchScans = async (sessionId: string) => {
    try {
      setFetchingScans(true);
      const { data, error } = await supabase
        .from("attendance_records")
        .select(`
          id,
          time_in,
          status,
          users!student_id (
            full_name,
            student_profiles (
              student_id_number
            )
          )
        `)
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formatted: ScanRow[] = (data || []).map(r => {
        const u = r.users as any;
        const profile = u?.student_profiles || {};
        return {
          id: r.id,
          name: u?.full_name || "Unknown Student",
          idNumber: profile.student_id_number || "—",
          timeIn: r.time_in ? new Date(r.time_in).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "—",
          status: r.status
        };
      });

      setRecentScans(formatted);
    } catch (err) {
      console.error("Error fetching scans:", err);
    } finally {
      setFetchingScans(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facilitator) return;
    setFormError("");

    if (!subject) { setFormError("Please select a subject."); return; }
    if (!section) { setFormError("Please select a target section."); return; }

    setIsSubmitting(true);
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + duration * 60000);

      const { data: session, error } = await supabase
        .from("qr_sessions")
        .insert({
          facilitator_id: facilitator.id,
          subject,
          section,
          date: now.toISOString().split("T")[0],
          expires_at: expiresAt.toISOString(),
          code
        })
        .select()
        .single();

      if (error) throw error;

      const newSession: SessionRow = {
        id: session.id,
        subject: session.subject,
        section: session.section,
        date: session.date,
        expires_at: session.expires_at,
        code: session.code
      };

      setActiveSession(newSession);
      sessionStorage.setItem("active_qr_session", JSON.stringify(newSession));
    } catch (err: any) {
      setFormError(err.message || "Failed to create QR session. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTerminate = () => {
    if (!confirm("Are you sure you want to terminate this active QR session? Students will no longer be able to scan it.")) return;
    setActiveSession(null);
    setRecentScans([]);
    sessionStorage.removeItem("active_qr_session");
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
        <Loader2 className="animate-spin" size={24} color="#4f46e5" />
      </div>
    );
  }

  return (
    <div className="fade-in sd-root qr-generator-page">
      {/* HEADER */}
      <header className="sd-header">
        <div>
          <p className="sd-header-eyebrow">Class Attendance Generator</p>
          <h1 className="sd-header-title">Generate Session QR</h1>
        </div>
        <div>
          <button onClick={() => router.push("/dashboard/facilitator")} className="btn-back">
            <ArrowLeft size={15} />
            <span>Return to Dashboard</span>
          </button>
        </div>
      </header>

      {/* ACTIVE SESSION WORKSPACE */}
      {activeSession ? (
        <div className="generator-active-grid">
          
          {/* LEFT: QR Display card */}
          <div className="qr-panel-card">
            <div className="qr-panel-header">
              <span className={`status-pill ${isExpired ? "expired" : "live"}`}>
                <span className="pulse-dot" />
                {isExpired ? "EXPIRED" : "LIVE ATTENDANCE"}
              </span>
              {!isExpired && (
                <button onClick={handleTerminate} className="btn-terminate">
                  <Trash2 size={13} /> Terminate
                </button>
              )}
            </div>

            <div className="qr-body">
              <div className="qr-meta-top">
                <h3 className="subject-heading">{activeSession.subject}</h3>
                <span className="section-badge">{activeSession.section}</span>
              </div>

              {/* QR Box Wrapper */}
              <div className="qr-box-outer" ref={qrWrapRef}>
                <QRCodeSVG value={activeSession.code} size={220} level="H" includeMargin={false} />
              </div>

              <div className="code-display">
                <span className="code-lbl">MANUAL SESSION CODE</span>
                <span className="code-val">{activeSession.code}</span>
              </div>

              <div className="timer-display">
                <Clock size={16} color="var(--gold)" />
                <span>Expires in: <strong className={isExpired ? "text-red" : "text-gold"}>{timeLeft}</strong></span>
              </div>

              <button
                type="button"
                className="btn-download-qr"
                onClick={() => downloadQRPng(qrWrapRef.current, `PH_${activeSession.section.replace(/\s+/g, "")}_${activeSession.code}.png`).catch((e) => alert("Download failed: " + e.message))}
              >
                <DownloadIcon size={13} /> Download Session QR
              </button>
            </div>
          </div>

          {/* RIGHT: Live Scan Logs Feed */}
          <div className="live-scans-panel">
            <div className="panel-header">
              <Users size={16} color="#4f46e5" />
              <span>Real-Time Check-In logs ({recentScans.length} Students)</span>
              {fetchingScans && <Loader2 className="animate-spin" size={13} color="var(--dimmed)" />}
            </div>

            <div className="scans-table-wrap">
              <table className="logs-table">
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Student ID</th>
                    <th>Check-in Time</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentScans.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="empty-state-logs">
                        <Sparkles size={24} color="var(--gold)" style={{ opacity: 0.7, marginBottom: 12 }} />
                        <p>No check-ins logged for this session yet.</p>
                        <span>Instruct students to scan the QR code above.</span>
                      </td>
                    </tr>
                  ) : (
                    recentScans.map((r) => (
                      <tr key={r.id} className="fade-in">
                        <td className="font-semibold text-white">{r.name}</td>
                        <td className="monospace">{r.idNumber}</td>
                        <td>{r.timeIn}</td>
                        <td>
                          <span className={`status-badge ${r.status}`}>
                            {r.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      ) : (
        /* SETUP / CREATE SESSION PANEL */
        <div className="setup-container">
          <div className="setup-card">
            <div className="setup-card-header">
              <PlusCircle size={20} color="#4f46e5" />
              <div>
                <h2>Setup Class Session</h2>
                <p>Configure a single attendance target for a subject and section.</p>
              </div>
            </div>

            <form onSubmit={handleGenerate} className="setup-form">
              {formError && (
                <div className="form-error-banner">
                  <XCircle size={15} />
                  <span>{formError}</span>
                </div>
              )}

              <div className="form-group">
                <label className="field-lbl">Subject Course</label>
                <div className="select-wrapper">
                  <select
                    className="custom-select"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                  >
                    <option value="" disabled>Select subject...</option>
                    {SUBJECTS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="field-lbl">Target Section</label>
                <div className="select-wrapper">
                  <select
                    className="custom-select"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    required
                  >
                    <option value="" disabled>Select section...</option>
                    {SECTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="field-lbl">QR Expiry Session Duration</label>
                <div className="select-wrapper">
                  <select
                    className="custom-select"
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value, 10))}
                  >
                    {EXPIRIES.map((e) => (
                      <option key={e.value} value={e.value}>{e.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button type="submit" className="btn-generate-submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <><Loader2 className="animate-spin" size={16} /> Generating...</>
                ) : (
                  <><QrCode size={16} /> Generate Class QR Code</>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOM STYLE DECLARATIONS */}
      <style>{`
        .qr-generator-page {
          width: 100%;
        }

        .qr-generator-page .sd-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding-bottom: 20px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.08);
          margin-bottom: 24px;
        }

        .qr-generator-page .sd-header-eyebrow {
          font-size: 11px;
          font-weight: 600;
          color: #6b7280 !important;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 4px;
        }

        .qr-generator-page .sd-header-title {
          font-size: 22px;
          font-weight: 700;
          color: #111827 !important;
          letter-spacing: -0.03em;
          line-height: 1.2;
        }

        .qr-generator-page .btn-back {
          background: #ffffff !important;
          border: 1px solid #d1d5db !important;
          border-radius: 6px !important;
          color: #374151 !important;
          font-size: 13px;
          font-weight: 500;
          padding: 8px 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.15s ease;
        }

        .qr-generator-page .btn-back:hover {
          background: #f9fafb !important;
          border-color: #4f46e5 !important;
          color: #4f46e5 !important;
        }

        /* ── SETUP SESSION SCREEN ── */
        .qr-generator-page .setup-container {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 24px 0 60px;
        }

        .qr-generator-page .setup-card {
          background: #ffffff !important;
          border: 1px solid rgba(79, 70, 229, 0.12) !important;
          border-radius: 12px !important;
          width: 100%;
          max-width: 520px;
          padding: 32px !important;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
        }

        .qr-generator-page .setup-card-header {
          display: flex;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 28px;
        }

        .qr-generator-page .setup-card-header h2 {
          font-size: 18px;
          font-weight: 700;
          color: #111827 !important;
          margin: 0 0 4px;
        }

        .qr-generator-page .setup-card-header p {
          font-size: 13px;
          color: #6b7280 !important;
          margin: 0;
          line-height: 1.45;
        }

        .qr-generator-page .setup-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .qr-generator-page .form-error-banner {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.25);
          color: #b91c1c;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 13px;
        }

        .qr-generator-page .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .qr-generator-page .field-lbl {
          font-size: 12px;
          font-weight: 600;
          color: #374151 !important;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .qr-generator-page .custom-select {
          width: 100% !important;
          height: 42px !important;
          padding: 0 16px !important;
          border-radius: 6px !important;
          border: 1px solid #d1d5db !important;
          background: #f9fafb !important;
          color: #111827 !important;
          font-size: 14px !important;
          font-weight: 500 !important;
          outline: none !important;
          cursor: pointer !important;
          appearance: none !important;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(79,70,229,0.7)'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2.5' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E") !important;
          background-repeat: no-repeat !important;
          background-position: right 14px center !important;
          background-size: 15px !important;
          padding-right: 40px !important;
          transition: all 0.15s ease !important;
        }

        .qr-generator-page .custom-select:focus {
          border-color: #4f46e5 !important;
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1) !important;
        }

        .qr-generator-page .btn-generate-submit {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: #4f46e5 !important;
          color: #ffffff !important;
          border: none !important;
          height: 44px !important;
          border-radius: 8px !important;
          font-size: 14px !important;
          font-weight: 700 !important;
          cursor: pointer !important;
          transition: all 0.15s ease !important;
          margin-top: 8px !important;
        }

        .qr-generator-page .btn-generate-submit:hover {
          background: #4338ca !important;
          transform: translateY(-1px);
        }

        .qr-generator-page .btn-generate-submit:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        /* ── ACTIVE QR SESSION SCREEN ── */
        .qr-generator-page .generator-active-grid {
          display: grid;
          grid-template-columns: 1.1fr 1.3fr;
          gap: 24px;
        }

        @media (max-width: 900px) {
          .qr-generator-page .generator-active-grid {
            grid-template-columns: 1fr;
          }
        }

        .qr-generator-page .qr-panel-card {
          background: #ffffff !important;
          border: 1px solid rgba(79, 70, 229, 0.12) !important;
          border-radius: 12px !important;
          padding: 28px !important;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .qr-generator-page .qr-panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 16px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.05);
          margin-bottom: 20px;
        }

        .qr-generator-page .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 99px;
          letter-spacing: 0.04em;
        }

        .qr-generator-page .status-pill.live {
          background: rgba(22, 163, 74, 0.08);
          color: #16a34a;
          border: 1px solid rgba(22, 163, 74, 0.2);
        }

        .qr-generator-page .status-pill.expired {
          background: rgba(220, 38, 38, 0.08);
          color: #dc2626;
          border: 1px solid rgba(220, 38, 38, 0.2);
        }

        .qr-generator-page .pulse-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
          animation: pulseFade 1.8s infinite ease-in-out;
        }

        @keyframes pulseFade {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }

        .qr-generator-page .btn-terminate {
          background: transparent !important;
          border: 1px solid rgba(220, 38, 38, 0.3) !important;
          border-radius: 6px !important;
          color: #dc2626 !important;
          font-size: 12px;
          font-weight: 600;
          padding: 5px 10px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.15s ease;
        }

        .qr-generator-page .btn-terminate:hover {
          background: rgba(220, 38, 38, 0.08) !important;
          border-color: #ef4444 !important;
          color: #ef4444 !important;
        }

        .qr-generator-page .qr-body {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .qr-generator-page .qr-meta-top {
          margin-bottom: 24px;
        }

        .qr-generator-page .subject-heading {
          font-size: 16px;
          font-weight: 700;
          color: #111827 !important;
          margin: 0 0 6px;
        }

        .qr-generator-page .qr-box-outer {
          background: #ffffff !important;
          padding: 20px !important;
          border-radius: 12px !important;
          border: 1px solid #e5e7eb !important;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
          margin-bottom: 24px;
        }

        .qr-generator-page .code-display {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 20px;
        }

        .qr-generator-page .code-lbl {
          font-size: 10px;
          font-weight: 700;
          color: #6b7280 !important;
          letter-spacing: 0.06em;
        }

        .qr-generator-page .code-val {
          font-family: monospace;
          font-size: 24px;
          font-weight: 800;
          color: #E8B84B !important;
          letter-spacing: 4px;
          text-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }

        .qr-generator-page .timer-display {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13.5px;
          color: #374151 !important;
          background: #f9fafb !important;
          border: 1px solid #e5e7eb !important;
          padding: 8px 16px;
          border-radius: 99px;
          margin-bottom: 24px;
        }

        .qr-generator-page .text-gold {
          color: #E8B84B !important;
        }

        .qr-generator-page .text-red {
          color: #dc2626 !important;
        }

        .qr-generator-page .btn-download-qr {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: rgba(232, 184, 75, 0.06) !important;
          border: 1px solid #E8B84B !important;
          color: #E8B84B !important;
          font-size: 13px !important;
          font-weight: 600 !important;
          height: 38px !important;
          padding: 0 20px !important;
          border-radius: 999px !important;
          cursor: pointer !important;
          transition: all 0.15s ease !important;
          width: 100% !important;
        }

        .qr-generator-page .btn-download-qr:hover {
          background: rgba(232, 184, 75, 0.15) !important;
          color: #F0C96B !important;
          border-color: #F0C96B !important;
        }

        /* ── LIVE SCANS PANEL ── */
        .qr-generator-page .live-scans-panel {
          background: #ffffff !important;
          border: 1px solid rgba(79, 70, 229, 0.12) !important;
          border-radius: 12px !important;
          padding: 0 !important;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .qr-generator-page .panel-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 18px 24px !important;
          background: rgba(79, 70, 229, 0.03) !important;
          border-bottom: 1px solid rgba(79, 70, 229, 0.08) !important;
          font-size: 14px;
          font-weight: 600;
          color: #4f46e5 !important;
        }

        .qr-generator-page .scans-table-wrap {
          flex: 1;
          overflow-y: auto;
          min-height: 380px;
          max-height: 520px;
        }

        .qr-generator-page .logs-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        .qr-generator-page .logs-table th {
          font-size: 11px;
          font-weight: 600;
          color: #6b7280 !important;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 12px 24px;
          border-bottom: 1px solid #f3f4f6;
          background: #fafafa;
        }

        .qr-generator-page .logs-table td {
          font-size: 13.5px;
          padding: 14px 24px;
          border-bottom: 1px solid #f3f4f6;
          color: #374151 !important;
        }

        .qr-generator-page .logs-table tr:hover td {
          background: #fafafa;
        }

        .qr-generator-page .empty-state-logs {
          padding: 80px 24px !important;
          text-align: center;
        }

        .qr-generator-page .empty-state-logs p {
          font-size: 14px;
          font-weight: 600;
          color: #374151 !important;
          margin: 0 0 4px;
        }

        .qr-generator-page .empty-state-logs span {
          font-size: 12px;
          color: #9ca3af !important;
        }

        .qr-generator-page .monospace {
          font-family: monospace;
          font-size: 12.5px;
          color: #4b5563 !important;
        }

        /* Status Badge classes */
        .qr-generator-page .status-badge {
          display: inline-block;
          font-size: 10px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 4px;
          letter-spacing: 0.02em;
        }

        .qr-generator-page .status-badge.present {
          background: rgba(22, 163, 74, 0.08);
          color: #16a34a;
          border: 1px solid rgba(22, 163, 74, 0.15);
        }

        .qr-generator-page .status-badge.late {
          background: rgba(217, 119, 6, 0.08);
          color: #d97706;
          border: 1px solid rgba(217, 119, 6, 0.15);
        }
      `}</style>
    </div>
  );
}
