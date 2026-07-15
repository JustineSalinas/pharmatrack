"use client";

import { useEffect, useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase, formatManilaTime } from "@/lib/supabase";
import { getCurrentUser, getAuthHeader } from "@/lib/auth-client";
import { debounce } from "@/lib/debounce";
import { submitScanOrQueue, enqueue } from "@/lib/offlineScanQueue";
import { useOfflineScanSync } from "@/lib/useOfflineScanSync";
import { OfflineScanIndicator } from "@/components/OfflineScanIndicator";
import { 
  ScanLine, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Camera,
  CalendarDays,
  Clock,
  MapPin,
  History,
  Users,
  Sparkles,
  QrCode,
  RefreshCw
} from "lucide-react";
import { useRouter } from "next/navigation";

type ScannedStudent = {
  userId: string;
  fullName: string;
  studentIdNumber: string;
  currentYear: string;
  section: string;
  qrCodeId: string;
};

export default function ScannerPage() {
  const [activeEvents, setActiveEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [admin, setAdmin] = useState<any>(null);
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string; submessage?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [recentScans, setRecentScans] = useState<any[]>([]);
  // Exact counts for the stat tiles — NOT derived from recentScans.length/.filter(), which is
  // capped at 500 for display (see fetchRecentScans) and would silently under-report once a
  // single busy event's attendance crosses that bound. head:true counts are exact regardless of
  // event volume and don't transfer rows.
  const [scanCounts, setScanCounts] = useState({ total: 0, present: 0, late: 0 });
  // Phase-1: student profile fetched on scan, shown for verification before attendance is written
  const [verifiedStudent, setVerifiedStudent] = useState<ScannedStudent | null>(null);
  const offlineSync = useOfflineScanSync();
  const [verifyingStudent, setVerifyingStudent] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const router = useRouter();

  // Load events and admin profile with robust error handling
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        const user = await getCurrentUser();
        
        if (!user) {
          console.warn("Scanner init: No session user found. Let dashboard layout redirect...");
          setLoading(false);
          return;
        }
        
        if (user.account_type !== "admin") {
          if (user.account_type === "facilitator") {
            router.push("/dashboard/facilitator");
          } else {
            router.push("/dashboard");
          }
          return;
        }
        
        setAdmin(user);
        
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        const { data: events, error } = await supabase
          .from("events")
          .select("*")
          .gte("date", sevenDaysAgo)
          .order("date", { ascending: false });
        
        if (error) throw error;
        
        setActiveEvents(events || []);
        if (events && events.length > 0) {
          setSelectedEventId(events[0].id);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error("Error initializing scanner:", err);
        setLoading(false);
      }
    }
    init();
  }, [router]);

  // Fetch event details and recent scans when event changes
  useEffect(() => {
    if (!selectedEventId) return;
    
    const ev = activeEvents.find(e => e.id === selectedEventId);
    setSelectedEvent(ev || null);
    
    fetchRecentScans(selectedEventId);
    
    // Subscribe to attendance logs channel for real-time list updates
    const channel = supabase
      .channel(`attendance-scans-${selectedEventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance_records", filter: `event_id=eq.${selectedEventId}` },
        debounce(() => fetchRecentScans(selectedEventId), 1500)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedEventId, activeEvents]);

  // Handle scanner unmount cleanup
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(err => console.error("Clean up stop failed", err));
        }
      }
    };
  }, []);

  const fetchRecentScans = async (eventId: string) => {
    try {
      const [{ data, error }, { data: countsRows, error: countsError }] = await Promise.all([
        supabase
          .from("attendance_records")
          .select(`
            id,
            time_in,
            time_out,
            status,
            users!student_id (
              full_name,
              email,
              student_profiles (
                student_id_number,
                section
              )
            )
          `)
          .eq("event_id", eventId)
          .order("created_at", { ascending: false })
          // This is a live "recent activity" feed, not the definitive attendance
          // log (that's the separate Attendance Log page) — bounding the display
          // list is both correctness-safe (a single busy event can exceed
          // Supabase/PostgREST's hard per-query row cap) and better UX for a
          // "recent" feed. The stat tiles below use exact counts instead, not
          // this array, so they stay accurate regardless of this cap.
          .limit(500),
        // Single grouped-aggregate RPC instead of 3 separate count queries —
        // halves the Postgres round-trips fired on every realtime-triggered
        // refresh (see get_scanner_event_counts in schema.sql).
        supabase.rpc("get_scanner_event_counts", { p_event_id: eventId }),
      ]);

      if (error) throw error;
      if (countsError) throw countsError;
      const counts = countsRows?.[0];
      setScanCounts({ total: counts?.total || 0, present: counts?.present || 0, late: counts?.late || 0 });

      const formatted = (data || []).map(r => {
        const u = r.users as any;
        const profile = u?.student_profiles || {};
        return {
          id: r.id,
          name: u?.full_name || "Unknown Student",
          email: u?.email || "",
          idNumber: profile.student_id_number || "—",
          section: profile.section || "N/A",
          timeIn: r.time_in ? formatManilaTime(r.time_in, { hour: "numeric", minute: "2-digit" }) : "—",
          timeOut: r.time_out ? formatManilaTime(r.time_out, { hour: "numeric", minute: "2-digit" }) : "—",
          status: r.status
        };
      });

      setRecentScans(formatted);
    } catch (err) {
      console.error("Error fetching recent scans:", err);
    } finally {
      setLoading(false);
    }
  };

  const startCamera = async () => {
    if (!selectedEventId) return;
    setScanResult(null);
    setIsScanning(true);

    // Wait for the DOM element to be painted before initialising the scanner
    requestAnimationFrame(() => requestAnimationFrame(async () => {
      try {
        const qrScanner = new Html5Qrcode("reader");
        scannerRef.current = qrScanner;
        await qrScanner.start(
          { facingMode: "environment" },
          {
            fps: 15,
            qrbox: (width, height) => {
              const size = Math.min(width, height) * 0.75;
              return { width: size, height: size };
            }
          },
          onScanSuccess,
          onScanFailure
        );
      } catch (err: any) {
        console.error("Camera start error", err);
        setIsScanning(false);
        setScanResult({ success: false, message: "Camera Error", submessage: err.message || "Camera permissions denied." });
      }
    }));
  };

  const stopCamera = async () => {
    setIsScanning(false);
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
      } catch (err) {
        console.error("Failed to stop camera stream", err);
      }
      scannerRef.current = null;
    }
  };

  // ── PHASE 1: Lookup — fetch student profile, show verification card ──
  // Captures a scan into the offline queue and shows the "Saved Offline"
  // confirmation, skipping the live verify card (which needs the backend).
  async function queueOffline(decodedText: string, submessage: string) {
    await enqueue({ qrCodeId: decodedText, eventId: selectedEventId, scannedAt: new Date().toISOString() });
    await offlineSync.refresh();
    setVerifyingStudent(false);
    setVerifiedStudent(null);
    setScanResult({ success: true, message: "Saved Offline", submessage });
  }

  async function onScanSuccess(decodedText: string) {
    if (!selectedEventId || !admin) return;

    await stopCamera();

    // Offline: skip the live student lookup entirely and queue the scan. It
    // syncs and gets validated/identified automatically when the backend is back.
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await queueOffline(decodedText, "Queued — will sync automatically when the connection returns.");
      return;
    }

    setVerifyingStudent(true);
    setVerifiedStudent(null);
    setScanResult(null);

    try {
      const { data: student, error: studentErr } = await supabase
        .from("student_profiles")
        .select("user_id, student_id_number, section, current_year, qr_code_id, users(full_name, avatar_url)")
        .eq("qr_code_id", decodedText)
        .maybeSingle();

      if (studentErr) {
        // Lookup failed while nominally online → treat the backend as
        // unreachable and queue the scan rather than losing it or showing a
        // false "invalid QR".
        await queueOffline(decodedText, "Couldn't reach the server — queued and will sync automatically.");
        return;
      }

      if (!student) {
        setVerifyingStudent(false);
        setScanResult({
          success: false,
          message: "Invalid QR Code",
          submessage: "Student record not found in the system database.",
        });
        return;
      }

      setVerifyingStudent(false);
      setVerifiedStudent({
        userId: student.user_id,
        fullName: (student.users as any)?.full_name ?? "Unknown Student",
        studentIdNumber: student.student_id_number,
        currentYear: student.current_year,
        section: student.section,
        qrCodeId: student.qr_code_id,
        avatarUrl: (student.users as any)?.avatar_url ?? null,
      } as any);
    } catch {
      // Network throw during lookup → queue rather than lose the scan.
      await queueOffline(decodedText, "Couldn't reach the server — queued and will sync automatically.");
    }
  }

  // ── PHASE 2: Confirm — admin clicks Confirm Check-In, calls /api/scan ──
  async function confirmCheckIn() {
    if (!verifiedStudent || !selectedEventId || !admin) return;
    setConfirmLoading(true);

    try {
      const outcome = await submitScanOrQueue({
        qrCodeId: verifiedStudent.qrCodeId,
        eventId: selectedEventId,
        authHeader: (await getAuthHeader()) as Record<string, string>,
      });

      // Backend was unreachable — the scan was captured offline instead of lost.
      if (outcome.queued) {
        await offlineSync.refresh();
        setScanResult({ success: true, message: "Saved Offline", submessage: `${verifiedStudent.fullName}'s scan was queued and will sync automatically.` });
        setVerifiedStudent(null);
        return;
      }

      const json = outcome.data;

      if (!outcome.ok) {
        setScanResult({ success: false, message: "Scan Failed", submessage: json.error || "An error occurred." });
        return;
      }

      if (json.action === "time_in") {
        setScanResult({
          success: true,
          message: `${(json.status || "present").toUpperCase()}!`,
          submessage: `${verifiedStudent.fullName} checked in successfully.`,
        });
        setVerifiedStudent(null);
      } else if (json.action === "time_out") {
        setScanResult({
          success: true,
          message: "Check-out Recorded!",
          submessage: `${verifiedStudent.fullName} has checked out successfully.`,
        });
        setVerifiedStudent(null);
      } else {
        // Keep verifiedStudent set so the Retry button can re-submit without
        // requiring a fresh QR scan.
        setScanResult({ success: false, message: "Scan Failed", submessage: json.message || json.error || "Unexpected response." });
      }

      fetchRecentScans(selectedEventId);
    } catch (err: any) {
      console.error(err);
      // Keep verifiedStudent set — a network blip shouldn't force a rescan.
      setScanResult({ success: false, message: "Confirmation Failed", submessage: err.message });
    } finally {
      setConfirmLoading(false);
    }
  }

  // Helper: generate initials avatar background colour from name
  function avatarColor(name: string): string {
    const palette = [
      "#4f46e5", "#0891b2", "#059669", "#d97706",
      "#dc2626", "#7c3aed", "#db2777", "#0284c7",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return palette[Math.abs(hash) % palette.length];
  }

  function initials(name: string): string {
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function onScanFailure(error: any) {
    // Silently process failures (standard for html5-qrcode scans)
  }


  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
        <Loader2 className="animate-spin" size={24} color="#4f46e5" />
      </div>
    );
  }

  return (
    <div className="fade-in sd-root qr-scanner-terminal-page">
      
      {/* PAGE HEADER */}
      <header className="sd-header">
         <div>
           <p className="sd-header-eyebrow">Real-Time Attendance Monitoring</p>
           <h1 className="sd-header-title">QR Scanner Terminal</h1>
         </div>
      </header>

      {/* TWO-COLUMN SCANNER PANEL GRID */}
      <div className="scanner-grid">
        
        {/* LEFT COLUMN: Setup details and Real-time Metrics */}
        <div className="controls-column">
          
          {/* EVENT SELECTOR & SPECS */}
          <div className="setup-card">
            <h3 className="card-section-title">Terminal Configuration</h3>
            
            <div className="form-group">
              <label className="input-label">Select Active Event</label>
              <div className="select-wrapper">
                <select 
                  className="custom-select"
                  value={selectedEventId}
                  onChange={(e) => { setSelectedEventId(e.target.value); stopCamera(); setScanResult(null); }}
                  disabled={isScanning}
                >
                  {activeEvents.length > 0 ? (
                    activeEvents.map(e => (
                      <option key={e.id} value={e.id}>{e.name} ({new Date(e.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })})</option>
                    ))
                  ) : (
                    <option value="">No events scheduled</option>
                  )}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: "14px" }}>
              <OfflineScanIndicator state={offlineSync} />
            </div>

            {selectedEvent && (
              <div className="event-info-panel">
                <div className="info-row">
                  <MapPin size={16} className="info-icon" />
                  <div>
                    <span className="info-label">Venue / Location</span>
                    <span className="info-val">{selectedEvent.location}</span>
                  </div>
                </div>
                <div className="info-row">
                  <CalendarDays size={16} className="info-icon" />
                  <div>
                    <span className="info-label">Event Date</span>
                    <span className="info-val">{new Date(selectedEvent.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</span>
                  </div>
                </div>
                <div className="info-row">
                  <Clock size={16} className="info-icon" />
                  <div style={{ width: "100%" }}>
                    <span className="info-label">Check-in Windows</span>
                    <div className="info-time-rows">
                      <div className="info-time-row">
                        <span>Opens at:</span>
                        <strong>{formatManilaTime(selectedEvent.check_in_start, { hour: "numeric", minute: "2-digit" })}</strong>
                      </div>
                      <div className="info-time-row">
                        <span>Late at:</span>
                        <strong>{formatManilaTime(selectedEvent.check_in_late, { hour: "numeric", minute: "2-digit" })}</strong>
                      </div>
                      <div className="info-time-row">
                        <span>Closes:</span>
                        <strong>{formatManilaTime(selectedEvent.check_in_end, { hour: "numeric", minute: "2-digit" })}</strong>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="info-row">
                  <Clock size={16} className="info-icon" />
                  <div style={{ width: "100%" }}>
                    <span className="info-label">Check-out Window</span>
                    {selectedEvent.check_in_only ? (
                      <span className="info-val"><strong>Check-in only — no check-out required</strong></span>
                    ) : selectedEvent.check_out_start && selectedEvent.check_out_end ? (
                      <div className="info-time-rows">
                        <div className="info-time-row">
                          <span>Opens at:</span>
                          <strong>{formatManilaTime(selectedEvent.check_out_start, { hour: "numeric", minute: "2-digit" })}</strong>
                        </div>
                        <div className="info-time-row">
                          <span>Closes:</span>
                          <strong>{formatManilaTime(selectedEvent.check_out_end, { hour: "numeric", minute: "2-digit" })}</strong>
                        </div>
                      </div>
                    ) : (
                      <span className="info-val"><strong>Not required for this event</strong></span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: Active Camera Viewport / Results Screen */}
        <div className="viewport-column">
          
          {/* CAMERA FEED PLACEHOLDER */}
          {!isScanning && !scanResult && !verifiedStudent && !verifyingStudent && (
            <div className="viewport-placeholder">
              <div className="pulse-circle">
                <QrCode size={40} className="placeholder-icon" />
              </div>
              <h3 className="placeholder-title">Scanner Standby</h3>
              <p className="placeholder-text">Please verify the selected target event details, then click below to launch the camera session.</p>
              
              <button 
                onClick={startCamera} 
                className="btn-start-scanner"
                disabled={!selectedEventId}
              >
                <Camera size={18} />
                <span>Initialize Scanner</span>
              </button>
            </div>
          )}

          {/* ACTIVE QR SCANNER */}
          {isScanning && (
            <div className="viewport-active">
              <div className="viewfinder-frame">
                <div className="corner-bracket top-left" />
                <div className="corner-bracket top-right" />
                <div className="corner-bracket bottom-left" />
                <div className="corner-bracket bottom-right" />
                
                <div id="reader" />
                <div className="laser-beam" />
              </div>
              
              <button 
                onClick={stopCamera} 
                className="btn-pause-scanner"
              >
                <span>Disconnect Stream</span>
              </button>
            </div>
          )}

          {/* PHASE 1: Brief lookup spinner between scan and card render */}
          {verifyingStudent && (
            <div className="viewport-result">
              <div className="verify-loading">
                <Loader2 className="verify-spinner" size={32} />
                <p className="verify-loading-text">Retrieving student profile…</p>
              </div>
            </div>
          )}

          {/* PHASE 1: Student Verification Card — shown before attendance is written */}
          {verifiedStudent && !confirmLoading && (
            <div className="viewport-result">
              <div className="verify-card">
                {/* Header badge */}
                <div className="verify-header-badge">
                  <Users size={13} />
                  <span>Student Identified — Please Verify</span>
                </div>

                {/* Avatar initials or uploaded profile picture */}
                <div
                  className="verify-avatar"
                  style={{
                    background: (verifiedStudent as any).avatarUrl ? "none" : avatarColor(verifiedStudent.fullName),
                    padding: 0,
                    overflow: "hidden"
                  }}
                >
                  {(verifiedStudent as any).avatarUrl ? (
                    <img
                      src={(verifiedStudent as any).avatarUrl}
                      alt={verifiedStudent.fullName}
                      style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                    />
                  ) : (
                    initials(verifiedStudent.fullName)
                  )}
                </div>

                {/* Name */}
                <h2 className="verify-name">{verifiedStudent.fullName}</h2>

                {/* ID + Section row */}
                <div className="verify-meta-row">
                  <span className="verify-id-badge">{verifiedStudent.studentIdNumber}</span>
                  <span className="verify-dot">·</span>
                  <span className="verify-section-badge">{verifiedStudent.section}</span>
                </div>

                {/* Year level */}
                <div className="verify-year-pill">
                  {verifiedStudent.currentYear} Year
                </div>

                {/* Action buttons */}
                <div className="verify-actions">
                  <button
                    className="btn-confirm-checkin"
                    onClick={confirmCheckIn}
                  >
                    <CheckCircle2 size={16} />
                    <span>Confirm Check-In</span>
                  </button>
                  <button
                    className="btn-cancel-scan"
                    onClick={() => { setVerifiedStudent(null); startCamera(); }}
                  >
                    <XCircle size={15} />
                    <span>Wrong Student</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PHASE 2: Confirm loading spinner */}
          {confirmLoading && (
            <div className="viewport-result">
              <div className="verify-loading">
                <Loader2 className="verify-spinner" size={32} />
                <p className="verify-loading-text">Recording attendance…</p>
              </div>
            </div>
          )}

          {/* SCAN OUTCOME STATUS SCREEN */}
          {scanResult && (
            <div className="viewport-result">
              <div className="result-card">
                <div className="result-top-group">
                  <div className={`status-icon-wrap ${scanResult.success ? "success" : "error"}`}>
                    {scanResult.success ? <CheckCircle2 size={44} /> : <XCircle size={44} />}
                  </div>
                  <div className="result-text-block">
                    <h2 className={`result-headline ${scanResult.success ? "success" : "error"}`}>
                      {scanResult.message}
                    </h2>
                    <p className="result-explanation">{scanResult.submessage}</p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "10px", width: "100%", justifyContent: "center" }}>
                  {!scanResult.success && verifiedStudent && (
                    <button
                      onClick={confirmCheckIn}
                      className="btn-next-scan"
                      disabled={confirmLoading}
                    >
                      <RefreshCw size={16} />
                      <span>Retry</span>
                    </button>
                  )}
                  <button
                    onClick={() => { setScanResult(null); setVerifiedStudent(null); startCamera(); }}
                    className="btn-next-scan"
                  >
                    <Sparkles size={16} />
                    <span>Resume Scanning</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* LIVE METRICS PANEL */}
      <div className="metrics-card" style={{ marginTop: "12px" }}>
        <div className="metric-box">
          <span className="metric-num-total">{scanCounts.total}</span>
          <span className="metric-title">Total Logs</span>
        </div>
        <div className="metric-sep" />
        <div className="metric-box">
          <span className="metric-num-present">{scanCounts.present}</span>
          <span className="metric-title">Punctual</span>
        </div>
        <div className="metric-sep" />
        <div className="metric-box">
          <span className="metric-num-late">{scanCounts.late}</span>
          <span className="metric-title">Tardy / Late</span>
        </div>
      </div>

      {/* BOTTOM SECTION: RECENT SCANS LOG TABLE */}
      <div className="panel indigo-table-panel" style={{ padding: 0, overflow: "hidden", marginTop: "12px" }}>
        <div className="table-header-custom">
          <History size={16} />
          <span>Real-time Activity Logs (Recent Scans)</span>
        </div>
        
        <div className="table-wrap">
          <table className="attendance-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ paddingLeft: "24px" }}>Student Profile</th>
                <th>Student ID</th>
                <th>Section</th>
                <th>Time Checked In</th>
                <th>Time Checked Out</th>
                <th>Log Status</th>
              </tr>
            </thead>
            <tbody>
              {recentScans.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "48px 24px", textAlign: "center", color: "#4b5563" }}>
                    No scans logged for this activity yet. Launch camera to start logging.
                  </td>
                </tr>
              ) : (
                recentScans.map((r, i) => (
                  <tr key={i}>
                    <td style={{ paddingLeft: "24px", fontWeight: 500, color: "#111827" }}>
                      {r.name}
                    </td>
                    <td style={{ color: "#4b5563", fontFamily: "monospace", fontSize: "13px" }}>{r.idNumber}</td>
                    <td>
                      <span className="section-badge">{r.section}</span>
                    </td>
                    <td style={{ color: "#374151" }}>{r.timeIn}</td>
                    <td style={{ color: "#374151" }}>{r.timeOut}</td>
                    <td>
                      <span className={`status-badge ${r.status === 'present' ? 'present' : r.status === 'late' ? 'late' : 'absent'}`} style={{ fontSize: "11px", padding: "4px 8px" }}>
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

      {/* NATIVE STYLE TAG FOR UNCOMPROMISED OVERRIDES PREVENTING STYLED-JSX DISCARD ERRORS */}
      <style>{`
        .qr-scanner-terminal-page {
          width: 100%;
        }

        .qr-scanner-terminal-page .sd-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding-bottom: 20px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.08);
          margin-bottom: 4px;
        }

        .qr-scanner-terminal-page .sd-header-eyebrow {
          font-size: 11px;
          font-weight: 600;
          color: #6b7280 !important;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 4px;
        }

        .qr-scanner-terminal-page .sd-header-title {
          font-size: 22px;
          font-weight: 700;
          color: #111827 !important;
          letter-spacing: -0.03em;
          line-height: 1.2;
        }

        .qr-scanner-terminal-page .btn-back {
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

        .qr-scanner-terminal-page .btn-back:hover {
          background: #f9fafb !important;
          color: #111827 !important;
          border-color: #4f46e5 !important;
        }

        .qr-scanner-terminal-page .scanner-grid {
          display: grid;
          grid-template-columns: 1fr 1.3fr;
          gap: 24px;
        }

        @media (max-width: 900px) {
          .qr-scanner-terminal-page .scanner-grid {
            grid-template-columns: 1fr;
          }
        }

        .qr-scanner-terminal-page .controls-column {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .qr-scanner-terminal-page .viewport-column {
          display: flex;
          flex-direction: column;
        }

        .qr-scanner-terminal-page .setup-card {
          background: #ffffff !important;
          border: 1px solid rgba(79, 70, 229, 0.12) !important;
          border-radius: 8px !important;
          padding: 24px !important;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .qr-scanner-terminal-page .card-section-title {
          font-size: 14px;
          font-weight: 600;
          color: #4f46e5 !important;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: 4px;
          margin-top: 0;
        }

        .qr-scanner-terminal-page .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .qr-scanner-terminal-page .input-label {
          font-size: 12px;
          font-weight: 600;
          color: #374151 !important;
        }

        .qr-scanner-terminal-page .custom-select {
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

        .qr-scanner-terminal-page .custom-select:focus:not(:disabled) {
          border-color: #4f46e5 !important;
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1) !important;
        }

        .qr-scanner-terminal-page .event-info-panel {
          background: #f9fafb !important;
          border-radius: 6px !important;
          padding: 16px !important;
          display: flex;
          flex-direction: column !important;
          gap: 16px !important;
          border: 1px solid rgba(79, 70, 229, 0.08) !important;
        }

        .qr-scanner-terminal-page .info-row {
          display: flex !important;
          align-items: flex-start !important;
          gap: 12px !important;
        }

        .qr-scanner-terminal-page .info-icon {
          color: #4f46e5 !important;
          margin-top: 3px;
          flex-shrink: 0;
        }

        .qr-scanner-terminal-page .info-label {
          display: block !important;
          font-size: 11px !important;
          color: #6b7280 !important;
          text-transform: uppercase !important;
          font-weight: 600 !important;
          letter-spacing: 0.05em !important;
          margin-bottom: 2px !important;
        }

        .qr-scanner-terminal-page .info-val {
          display: block !important;
          font-size: 13.5px !important;
          color: #111827 !important;
          line-height: 1.4 !important;
        }

        .qr-scanner-terminal-page .info-time-rows {
          display: flex !important;
          flex-direction: column !important;
          gap: 3px !important;
          width: 100% !important;
        }

        .qr-scanner-terminal-page .info-time-row {
          display: flex !important;
          align-items: baseline !important;
          justify-content: flex-start !important;
          gap: 5px !important;
          font-size: 13.5px !important;
          line-height: 1.4 !important;
        }

        .qr-scanner-terminal-page .info-time-row span {
          color: #6b7280 !important;
        }

        .qr-scanner-terminal-page .info-time-row strong {
          color: #111827 !important;
          font-weight: 600 !important;
          white-space: nowrap !important;
        }

        .qr-scanner-terminal-page .metrics-card {
          background: #ffffff !important;
          border: 1px solid rgba(79, 70, 229, 0.12) !important;
          border-radius: 8px !important;
          padding: 20px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-around !important;
          flex-direction: row !important;
        }

        .qr-scanner-terminal-page .metric-box {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          gap: 4px !important;
          flex: 1 !important;
        }

        .qr-scanner-terminal-page .metric-num-total {
          font-size: 26px !important;
          font-weight: 800 !important;
          color: #111827 !important;
          letter-spacing: -0.02em !important;
        }

        .qr-scanner-terminal-page .metric-num-present {
          font-size: 26px !important;
          font-weight: 800 !important;
          color: #16a34a !important;
          letter-spacing: -0.02em !important;
        }

        .qr-scanner-terminal-page .metric-num-late {
          font-size: 26px !important;
          font-weight: 800 !important;
          color: #d97706 !important;
          letter-spacing: -0.02em !important;
        }

        .qr-scanner-terminal-page .metric-title {
          font-size: 11px !important;
          font-weight: 600 !important;
          color: #6b7280 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
        }

        .qr-scanner-terminal-page .metric-sep {
          width: 1px !important;
          height: 36px !important;
          background: rgba(0, 0, 0, 0.08) !important;
        }

        .qr-scanner-terminal-page .viewport-placeholder {
          background: #ffffff !important;
          border: 1px solid rgba(79, 70, 229, 0.12) !important;
          border-radius: 8px !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: center !important;
          text-align: center !important;
          padding: 48px 32px !important;
          flex: 1 !important;
          min-height: 360px !important;
        }

        .qr-scanner-terminal-page .pulse-circle {
          width: 72px !important;
          height: 72px !important;
          border-radius: 50% !important;
          background: rgba(79, 70, 229, 0.06) !important;
          border: 1px solid rgba(79, 70, 229, 0.15) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          margin-bottom: 20px !important;
          animation: scanPulse 3s infinite ease-in-out !important;
        }

        @keyframes scanPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(79, 70, 229, 0.15); }
          50% { transform: scale(1.06); box-shadow: 0 0 20px 4px rgba(79, 70, 229, 0.08); }
        }

        .qr-scanner-terminal-page .placeholder-icon {
          color: #4f46e5 !important;
        }

        .qr-scanner-terminal-page .placeholder-title {
          font-size: 18px !important;
          font-weight: 700 !important;
          color: #111827 !important;
          margin-bottom: 8px !important;
          margin-top: 0;
        }

        .qr-scanner-terminal-page .placeholder-text {
          font-size: 13.5px !important;
          color: #4b5563 !important;
          max-width: 320px !important;
          line-height: 1.5 !important;
          margin-bottom: 24px !important;
          margin-top: 0;
        }

        .qr-scanner-terminal-page .btn-start-scanner {
          background: #4f46e5 !important;
          color: #ffffff !important;
          padding: 12px 28px !important;
          font-size: 14px !important;
          font-weight: 600 !important;
          border: none !important;
          border-radius: 6px !important;
          cursor: pointer !important;
          display: flex !important;
          align-items: center !important;
          gap: 10px !important;
          transition: all 0.2s ease !important;
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2) !important;
        }

        .qr-scanner-terminal-page .btn-start-scanner:hover:not(:disabled) {
          filter: brightness(1.1) !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 6px 16px rgba(79, 70, 229, 0.3) !important;
        }

        .qr-scanner-terminal-page .btn-start-scanner:disabled {
          opacity: 0.5 !important;
          cursor: not-allowed !important;
          box-shadow: none !important;
        }

        .qr-scanner-terminal-page .viewport-active {
          background: #ffffff !important;
          border: 1px solid rgba(79, 70, 229, 0.12) !important;
          border-radius: 8px !important;
          padding: 24px !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: center !important;
          flex: 1 !important;
          min-height: 360px !important;
        }

        .qr-scanner-terminal-page .viewfinder-frame {
          position: relative !important;
          width: 100% !important;
          max-width: 320px !important;
          aspect-ratio: 1 !important;
          border-radius: 16px !important;
          overflow: hidden !important;
          background: #08080c !important;
          border: 1px solid rgba(79, 70, 229, 0.2) !important;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4) !important;
          margin-bottom: 20px !important;
        }

        .qr-scanner-terminal-page .corner-bracket {
          position: absolute !important;
          width: 20px !important;
          height: 20px !important;
          border: 3px solid #4f46e5 !important;
          z-index: 10 !important;
          pointer-events: none !important;
        }

        .qr-scanner-terminal-page .top-left { top: 12px !important; left: 12px !important; border-right: none !important; border-bottom: none !important; border-top-left-radius: 6px !important; }
        .qr-scanner-terminal-page .top-right { top: 12px !important; right: 12px !important; border-left: none !important; border-bottom: none !important; border-top-right-radius: 6px !important; }
        .qr-scanner-terminal-page .bottom-left { bottom: 12px !important; left: 12px !important; border-right: none !important; border-top: none !important; border-bottom-left-radius: 6px !important; }
        .qr-scanner-terminal-page .bottom-right { bottom: 12px !important; right: 12px !important; border-left: none !important; border-top: none !important; border-bottom-right-radius: 6px !important; }

        .qr-scanner-terminal-page #reader {
          width: 100% !important;
          height: 100% !important;
          border: none !important;
          background: transparent !important;
        }

        .qr-scanner-terminal-page #reader video {
          object-fit: cover !important;
          width: 100% !important;
          height: 100% !important;
          border-radius: 12px !important;
        }

        .qr-scanner-terminal-page .laser-beam {
          position: absolute !important;
          left: 8% !important;
          right: 8% !important;
          height: 3px !important;
          background: #4f46e5 !important;
          box-shadow: 0 0 10px 2px #4f46e5 !important;
          z-index: 5 !important;
          pointer-events: none !important;
          animation: scanMotion 2s linear infinite alternate !important;
        }

        @keyframes scanMotion {
          0% { top: 12%; }
          100% { top: 88%; }
        }

        .qr-scanner-terminal-page .btn-pause-scanner {
          background: rgba(220, 38, 38, 0.08) !important;
          border: 1px solid rgba(220, 38, 38, 0.15) !important;
          color: #dc2626 !important;
          padding: 10px 24px !important;
          font-size: 13px !important;
          font-weight: 600 !important;
          border-radius: 6px !important;
          cursor: pointer !important;
          transition: all 0.15s ease !important;
        }

        .qr-scanner-terminal-page .btn-pause-scanner:hover {
          background: rgba(220, 38, 38, 0.15) !important;
          border-color: rgba(220, 38, 38, 0.3) !important;
        }

        .qr-scanner-terminal-page .viewport-result {
          background: #ffffff !important;
          border: 1px solid rgba(79, 70, 229, 0.12) !important;
          border-radius: 8px !important;
          padding: 32px !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: center !important;
          flex: 1 !important;
          min-height: 360px !important;
        }

        .qr-scanner-terminal-page .result-card {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 20px !important;
          text-align: center !important;
          height: 100% !important;
          width: 100% !important;
          animation: resultSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }

        .qr-scanner-terminal-page .result-top-group {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 20px !important;
          flex: 1 !important;
        }

        .qr-scanner-terminal-page .status-icon-wrap {
          width: 80px !important;
          height: 80px !important;
          border-radius: 50% !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }

        .qr-scanner-terminal-page .status-icon-wrap.success {
          background: rgba(22, 163, 74, 0.08) !important;
          border: 1px solid rgba(22, 163, 74, 0.2) !important;
          color: #16a34a !important;
          box-shadow: 0 0 20px rgba(22, 163, 74, 0.1) !important;
        }

        .qr-scanner-terminal-page .status-icon-wrap.error {
          background: rgba(220, 38, 38, 0.08) !important;
          border: 1px solid rgba(220, 38, 38, 0.2) !important;
          color: #dc2626 !important;
          box-shadow: 0 0 20px rgba(220, 38, 38, 0.1) !important;
        }

        .qr-scanner-terminal-page .result-headline {
          font-size: 20px !important;
          font-weight: 700 !important;
          margin-top: 0;
          margin-bottom: 0;
        }

        .qr-scanner-terminal-page .result-headline.success { color: #16a34a !important; }
        .qr-scanner-terminal-page .result-headline.error { color: #dc2626 !important; }

        .qr-scanner-terminal-page .result-explanation {
          font-size: 14px !important;
          color: #4b5563 !important;
          max-width: 280px !important;
          line-height: 1.5 !important;
          margin-top: 0;
          margin-bottom: 0;
        }

        .qr-scanner-terminal-page .btn-next-scan {
          background: #4f46e5 !important;
          color: #fff !important;
          border: none !important;
          border-radius: 6px !important;
          padding: 12px 28px !important;
          font-size: 13.5px !important;
          font-weight: 600 !important;
          cursor: pointer !important;
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
          transition: all 0.2s ease !important;
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.15) !important;
        }

        .qr-scanner-terminal-page .btn-next-scan:hover {
          filter: brightness(1.1) !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 6px 16px rgba(79, 70, 229, 0.25) !important;
        }

        .qr-scanner-terminal-page .table-header-custom {
          display: flex !important;
          align-items: center !important;
          gap: 10px !important;
          padding: 16px 24px !important;
          font-weight: 600 !important;
          font-size: 14px !important;
          color: #4f46e5 !important;
          border-bottom: 1px solid rgba(79, 70, 229, 0.12) !important;
        }

        .qr-scanner-terminal-page .section-badge {
          background: rgba(79, 70, 229, 0.05) !important;
          border: 1px solid rgba(79, 70, 229, 0.12) !important;
          border-radius: 4px !important;
          padding: 2px 6px !important;
          color: #4f46e5 !important;
          font-size: 11px !important;
          font-weight: 600 !important;
          display: inline-block !important;
        }

        /* ── TABLE THEMING ── */
        .qr-scanner-terminal-page .indigo-table-panel {
          background: rgba(79, 70, 229, 0.04) !important;
          border: 1px solid rgba(79, 70, 229, 0.12) !important;
        }
        
        .qr-scanner-terminal-page .attendance-table {
          background: transparent !important;
        }

        .qr-scanner-terminal-page .attendance-table th {
          background: rgba(79, 70, 229, 0.09) !important;
          color: #4f46e5 !important;
          font-weight: 600 !important;
          border-bottom: 1px solid rgba(79, 70, 229, 0.12) !important;
        }

        .qr-scanner-terminal-page .attendance-table td {
          border-bottom: 1px solid rgba(79, 70, 229, 0.05) !important;
        }

        /* Alternate zebra rows */
        .qr-scanner-terminal-page .attendance-table tr:nth-child(even) {
          background: rgba(79, 70, 229, 0.02) !important;
        }

        .qr-scanner-terminal-page .attendance-table tr:nth-child(odd) {
          background: rgba(79, 70, 229, 0.005) !important;
        }

        .qr-scanner-terminal-page .attendance-table tr:hover {
          background: rgba(79, 70, 229, 0.07) !important;
        }

        /* Specific Status badges overrides for scanner logs */
        .qr-scanner-terminal-page .status-badge {
          display: inline-block !important;
          padding: 2px 8px !important;
          border-radius: 4px !important;
          font-size: 11px !important;
          font-weight: 600 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.04em !important;
        }

        .qr-scanner-terminal-page .status-badge.present {
          background: rgba(22, 163, 74, 0.1) !important;
          color: #16a34a !important;
          border: 1px solid rgba(22, 163, 74, 0.2) !important;
        }

        .qr-scanner-terminal-page .status-badge.late {
          background: rgba(217, 119, 6, 0.1) !important;
          color: #d97706 !important;
          border: 1px solid rgba(217, 119, 6, 0.2) !important;
        }

        .qr-scanner-terminal-page .status-badge.absent {
          background: rgba(220, 38, 38, 0.1) !important;
          color: #dc2626 !important;
          border: 1px solid rgba(220, 38, 38, 0.2) !important;
        }

        /* ── VERIFICATION CARD ── */
        .qr-scanner-terminal-page .verify-card {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          gap: 18px !important;
          text-align: center !important;
          animation: resultSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) !important;
          width: 100% !important;
          max-width: 340px !important;
        }

        .qr-scanner-terminal-page .verify-header-badge {
          display: inline-flex !important;
          align-items: center !important;
          gap: 6px !important;
          background: rgba(79, 70, 229, 0.08) !important;
          border: 1px solid rgba(79, 70, 229, 0.18) !important;
          border-radius: 999px !important;
          padding: 5px 14px !important;
          font-size: 11.5px !important;
          font-weight: 600 !important;
          color: #4f46e5 !important;
          letter-spacing: 0.02em !important;
        }

        .qr-scanner-terminal-page .verify-avatar {
          width: 88px !important;
          height: 88px !important;
          border-radius: 50% !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          font-size: 30px !important;
          font-weight: 800 !important;
          color: #ffffff !important;
          letter-spacing: -0.02em !important;
          box-shadow: 0 8px 24px rgba(0,0,0,0.18) !important;
          flex-shrink: 0 !important;
        }

        .qr-scanner-terminal-page .verify-name {
          font-size: 22px !important;
          font-weight: 700 !important;
          color: #111827 !important;
          letter-spacing: -0.03em !important;
          margin: 0 !important;
          line-height: 1.2 !important;
        }

        .qr-scanner-terminal-page .verify-meta-row {
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
          flex-wrap: wrap !important;
          justify-content: center !important;
        }

        .qr-scanner-terminal-page .verify-id-badge {
          font-family: monospace !important;
          font-size: 13px !important;
          font-weight: 600 !important;
          color: #374151 !important;
          background: #f3f4f6 !important;
          border: 1px solid #e5e7eb !important;
          border-radius: 4px !important;
          padding: 2px 8px !important;
        }

        .qr-scanner-terminal-page .verify-dot {
          color: #9ca3af !important;
          font-size: 14px !important;
        }

        .qr-scanner-terminal-page .verify-section-badge {
          background: rgba(79, 70, 229, 0.06) !important;
          border: 1px solid rgba(79, 70, 229, 0.15) !important;
          border-radius: 4px !important;
          padding: 2px 8px !important;
          font-size: 12px !important;
          font-weight: 600 !important;
          color: #4f46e5 !important;
        }

        .qr-scanner-terminal-page .verify-year-pill {
          background: rgba(22, 163, 74, 0.07) !important;
          border: 1px solid rgba(22, 163, 74, 0.18) !important;
          border-radius: 999px !important;
          padding: 4px 16px !important;
          font-size: 12.5px !important;
          font-weight: 600 !important;
          color: #16a34a !important;
        }

        .qr-scanner-terminal-page .verify-actions {
          display: flex !important;
          flex-direction: column !important;
          gap: 10px !important;
          width: 100% !important;
          margin-top: 4px !important;
        }

        .qr-scanner-terminal-page .btn-confirm-checkin {
          width: 100% !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 8px !important;
          background: #16a34a !important;
          color: #ffffff !important;
          border: none !important;
          border-radius: 8px !important;
          padding: 13px 20px !important;
          font-size: 14px !important;
          font-weight: 700 !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
          box-shadow: 0 4px 14px rgba(22, 163, 74, 0.25) !important;
          letter-spacing: 0.01em !important;
        }

        .qr-scanner-terminal-page .btn-confirm-checkin:hover {
          filter: brightness(1.08) !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 6px 20px rgba(22, 163, 74, 0.35) !important;
        }

        .qr-scanner-terminal-page .btn-cancel-scan {
          width: 100% !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 8px !important;
          background: transparent !important;
          color: #6b7280 !important;
          border: 1px solid #e5e7eb !important;
          border-radius: 8px !important;
          padding: 11px 20px !important;
          font-size: 13px !important;
          font-weight: 600 !important;
          cursor: pointer !important;
          transition: all 0.15s ease !important;
        }

        .qr-scanner-terminal-page .btn-cancel-scan:hover {
          background: rgba(220, 38, 38, 0.05) !important;
          border-color: rgba(220, 38, 38, 0.25) !important;
          color: #dc2626 !important;
        }

        /* Lookup / confirm loading state */
        .qr-scanner-terminal-page .verify-loading {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          gap: 14px !important;
        }

        .qr-scanner-terminal-page .verify-spinner {
          color: #4f46e5 !important;
          animation: spin 0.8s linear infinite !important;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .qr-scanner-terminal-page .verify-loading-text {
          font-size: 14px !important;
          color: #6b7280 !important;
          font-weight: 500 !important;
          margin: 0 !important;
        }
      `}</style>
    </div>
  );
}
