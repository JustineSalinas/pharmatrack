"use client";

import { useEffect, useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth-client";
import { 
  ScanLine, 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Camera,
  CalendarDays,
  Clock,
  MapPin,
  History,
  Users
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function ScannerPage() {
  const [activeEvents, setActiveEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [admin, setAdmin] = useState<any>(null);
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string; submessage?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [recentScans, setRecentScans] = useState<any[]>([]);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const router = useRouter();

  // Load events and admin profile
  useEffect(() => {
    async function init() {
      const user = await getCurrentUser();
      if (!user) {
        // Let root DashboardLayout handle redirect to login to avoid hydration race conditions
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
      
      const { data: events } = await supabase
        .from("events")
        .select("*")
        .order("date", { ascending: false });
      
      setActiveEvents(events || []);
      if (events && events.length > 0) {
        setSelectedEventId(events[0].id);
      } else {
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
        { event: "*", schema: "public", table: "attendance_records" },
        () => {
          fetchRecentScans(selectedEventId);
        }
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
      const { data, error } = await supabase
        .from("attendance_records")
        .select(`
          id,
          time_in,
          time_out,
          status,
          users (
            full_name,
            email,
            student_profiles (
              student_id_number,
              section
            )
          )
        `)
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      const formatted = (data || []).map(r => {
        const u = r.users as any;
        const profile = u?.student_profiles || {};
        return {
          id: r.id,
          name: u?.full_name || "Unknown Student",
          email: u?.email || "",
          idNumber: profile.student_id_number || "—",
          section: profile.section || "N/A",
          timeIn: r.time_in ? new Date(r.time_in).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "—",
          timeOut: r.time_out ? new Date(r.time_out).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "—",
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

    // Wait for DOM container reader element to render
    setTimeout(async () => {
      try {
        const qrScanner = new Html5Qrcode("reader");
        scannerRef.current = qrScanner;
        await qrScanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 }
          },
          onScanSuccess,
          onScanFailure
        );
      } catch (err: any) {
        console.error("Camera start error", err);
        setIsScanning(false);
        alert("Could not start camera: " + (err.message || "Permissions denied"));
      }
    }, 150);
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

  async function onScanSuccess(decodedText: string) {
    if (!selectedEventId || !admin) return;

    // Pause camera scanning
    await stopCamera();
    setScanResult({ success: true, message: "Processing scan...", submessage: `Code: ${decodedText}` });

    try {
      // 1. Find the student by QR Code ID
      const { data: student, error: studentErr } = await supabase
        .from("student_profiles")
        .select("*, users(full_name)")
        .eq("qr_code_id", decodedText)
        .maybeSingle();

      if (studentErr || !student) {
        setScanResult({ 
          success: false, 
          message: "Invalid QR Code", 
          submessage: "Student profile not found in database." 
        });
        return;
      }

      const studentName = (student.users as any).full_name;
      const studentUserId = student.user_id;

      // 2. Fetch the event details
      const { data: event } = await supabase.from("events").select("*").eq("id", selectedEventId).single();
      if (!event) throw new Error("Event not found");

      // 3. Logic for Posting Attendance
      const now = new Date();
      let status = "present";

      // Time threshold checks
      if (now > new Date(event.check_in_late)) {
        status = "late";
      }
      if (now > new Date(event.check_in_end)) {
         setScanResult({ 
           success: false, 
           message: "Check-in Window Closed", 
           submessage: `Attendance checks ended at ${new Date(event.check_in_end).toLocaleTimeString()}`
         });
         return;
      }

      // Check if already checked in
      const { data: existingRecord } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("student_id", studentUserId)
        .eq("event_id", selectedEventId)
        .maybeSingle();

      if (existingRecord) {
        // Handle Check-out
        if (!existingRecord.time_out) {
           const { error: outErr } = await supabase
             .from("attendance_records")
             .update({ time_out: now.toISOString() })
             .eq("id", existingRecord.id);
           
           if (outErr) throw outErr;
           setScanResult({ 
             success: true, 
             message: "Check-out Recorded!", 
             submessage: `${studentName} has checked out successfully.` 
           });
        } else {
           setScanResult({ 
             success: false, 
             message: "Already Logged", 
             submessage: `${studentName} has already checked in and checked out.` 
           });
        }
      } else {
        // Perform Check-in
        const { error: insErr } = await supabase
          .from("attendance_records")
          .insert({
            student_id: studentUserId,
            event_id: selectedEventId,
            status: status,
            time_in: now.toISOString(),
            scanned_by: admin.id
          });

        if (insErr) throw insErr;
        setScanResult({ 
          success: true, 
          message: `${status.toUpperCase()}!`, 
          submessage: `${studentName} checked in successfully.` 
        });
      }
      
      // Refresh list
      fetchRecentScans(selectedEventId);
    } catch (err: any) {
      console.error(err);
      setScanResult({ success: false, message: "Scan Error", submessage: err.message });
    }
  }

  function onScanFailure(error: any) {
    // Silently process failures (standard for html5-qrcode scans)
  }

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
        <Loader2 className="animate-spin" size={24} color="var(--gold)" />
      </div>
    );
  }

  return (
    <div className="qr-scanner-portal">
      <div className="sd-root">
        
        {/* PAGE HEADER */}
        <header className="sd-header">
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <button 
              onClick={() => router.push("/dashboard/admin")} 
              className="btn-secondary" 
              style={{ padding: "6px 12px", display: "flex", alignItems: "center", gap: "6px" }}
            >
              <ArrowLeft size={16} /> Back
            </button>
            <h1 className="sd-header-title">Admin Portal / QR Scanner</h1>
          </div>
        </header>

        {/* TWO-COLUMN LAYOUT */}
        <div className="scanner-grid">
          
          {/* LEFT COLUMN: Controls & Event Config & Metrics */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* EVENT CONFIGURATION CARD */}
            <div className="card">
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "11px", color: "var(--qr-text-muted)", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.06em" }}>Target Event</label>
                <select 
                  className="select-field"
                  value={selectedEventId}
                  onChange={(e) => { setSelectedEventId(e.target.value); stopCamera(); setScanResult(null); }}
                  disabled={isScanning}
                >
                  {activeEvents.length > 0 ? (
                    activeEvents.map(e => (
                      <option key={e.id} value={e.id}>{e.name} ({new Date(e.date).toLocaleDateString()})</option>
                    ))
                  ) : (
                    <option value="">No events scheduled</option>
                  )}
                </select>
              </div>

              {selectedEvent && (
                <div className="event-details">
                  <div className="detail-row">
                    <span className="detail-label">Location</span>
                    <span className="detail-value">{selectedEvent.location}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Late Threshold</span>
                    <span className="detail-value">{new Date(selectedEvent.check_in_late).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Closing Time</span>
                    <span className="detail-value">{new Date(selectedEvent.check_in_end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </div>
              )}
            </div>

            {/* LIVE METRICS PANEL */}
            <div className="card metrics-card">
              <div className="metric-item">
                <span className="metric-label">Scans Logged</span>
                <span className="metric-value">{recentScans.length}</span>
              </div>
              <div className="metric-divider" />
              <div className="metric-item">
                <span className="metric-label">Active Scanners</span>
                <span className="metric-value">1</span>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Viewport & Scan Results */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            
            {!isScanning && !scanResult && (
              <div className="scanner-feed-container">
                <button 
                  onClick={startCamera} 
                  className="btn-primary" 
                  disabled={!selectedEventId}
                >
                  <Camera size={16} /> Start Scan Session
                </button>
              </div>
            )}

            {isScanning && (
              <div className="scanner-feed-container">
                <div id="reader">
                  <div className="scanner-overlay-line" />
                </div>
                <button 
                  onClick={stopCamera} 
                  className="btn-secondary" 
                  style={{ marginTop: "16px" }}
                >
                  Pause Camera
                </button>
              </div>
            )}

            {scanResult && (
              <div className="scanner-feed-container">
                <div className="result-container">
                  {scanResult.success ? (
                    <CheckCircle2 size={64} color="#16a34a" />
                  ) : (
                    <XCircle size={64} color="#dc2626" />
                  )}
                  <div>
                    <h2 className={`result-title ${scanResult.success ? "success" : "error"}`}>
                      {scanResult.message}
                    </h2>
                    <p className="result-submessage">{scanResult.submessage}</p>
                  </div>
                  
                  <button 
                    onClick={() => { setScanResult(null); startCamera(); }} 
                    className="btn-primary"
                    style={{ marginTop: "8px" }}
                  >
                    Next Scan
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM ROW: RECENT SCANS TABLE */}
        <div className="table-container">
          <div className="table-header">
            Scan Logs (Live Activity Feed)
          </div>
          
          <div style={{ overflowX: "auto" }}>
            <table className="flat-table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: "24px" }}>Student</th>
                  <th>Student ID</th>
                  <th>Section</th>
                  <th>Time In</th>
                  <th>Time Out</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentScans.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: "40px 24px", textAlign: "center", color: "var(--qr-text-muted)" }}>
                      No scans logged for this activity yet.
                    </td>
                  </tr>
                ) : (
                  recentScans.map((r, i) => (
                    <tr key={i}>
                      <td style={{ paddingLeft: "24px", fontWeight: 500 }}>
                        {r.name}
                      </td>
                      <td style={{ color: "var(--qr-text-muted)", fontFamily: "var(--font-sans)" }}>{r.idNumber}</td>
                      <td>
                        <span className="tag">{r.section}</span>
                      </td>
                      <td>{r.timeIn}</td>
                      <td>{r.timeOut}</td>
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

      {/* SCOPED COMPONENT STYLES */}
      <style jsx>{`
        .qr-scanner-portal {
          --qr-bg: #f3f4f6;
          --qr-card-bg: #ffffff;
          --qr-border: #e5e7eb;
          --qr-text: #111827;
          --qr-text-muted: #4b5563;
          --qr-text-dim: #9ca3af;
          --qr-accent: #2563eb;
          --qr-accent-hover: #1d4ed8;
          --qr-accent-dim: #eff6ff;

          background-color: var(--qr-bg);
          color: var(--qr-text);
          min-height: 100vh;
          margin: -40px -48px;
          padding: 40px 48px;
          box-sizing: border-box;
        }

        @media (max-width: 768px) {
          .qr-scanner-portal {
            margin: -24px -16px -100px -16px;
            padding: 24px 16px 100px 16px;
          }
        }

        .sd-root {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .sd-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--qr-border);
        }

        .sd-header-title {
          font-size: 20px;
          font-weight: 600;
          color: var(--qr-text);
          margin: 0;
          letter-spacing: -0.02em;
        }

        .scanner-grid {
          display: grid;
          grid-template-columns: 1fr 1.2fr;
          gap: 24px;
        }

        @media (max-width: 768px) {
          .scanner-grid {
            grid-template-columns: 1fr;
          }
        }

        .card {
          background: var(--qr-card-bg);
          border: 1px solid var(--qr-border);
          border-radius: 6px;
          padding: 20px;
          box-shadow: none;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .select-field {
          width: 100%;
          height: 38px;
          padding: 0 12px;
          border-radius: 6px;
          border: 1px solid #d1d5db;
          background: #ffffff;
          color: var(--qr-text);
          font-size: 14px;
          outline: none;
          cursor: pointer;
          transition: border-color 0.15s ease;
        }

        .select-field:focus {
          border-color: var(--qr-accent);
        }

        .event-details {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          font-size: 13.5px;
        }

        .detail-label {
          color: var(--qr-text-muted);
          font-weight: 500;
        }

        .detail-value {
          color: var(--qr-text);
          font-weight: 400;
        }

        .metrics-card {
          flex-direction: row;
          justify-content: space-around;
          align-items: center;
          padding: 16px 20px;
        }

        .metric-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          flex: 1;
        }

        .metric-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--qr-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .metric-value {
          font-size: 24px;
          font-weight: 600;
          color: var(--qr-text);
        }

        .metric-divider {
          width: 1px;
          height: 36px;
          background-color: var(--qr-border);
        }

        .scanner-feed-container {
          background: #f9fafb;
          border: 1px solid var(--qr-border);
          border-radius: 6px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 320px;
          position: relative;
          padding: 24px;
          box-sizing: border-box;
        }

        .btn-primary {
          background-color: var(--qr-accent);
          color: #ffffff;
          padding: 12px 32px;
          font-size: 14px;
          font-weight: 600;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: background-color 0.15s ease;
        }

        .btn-primary:hover {
          background-color: var(--qr-accent-hover);
        }

        .btn-primary:disabled {
          background-color: var(--qr-text-dim);
          cursor: not-allowed;
        }

        .btn-secondary {
          background: #ffffff;
          border: 1px solid #d1d5db;
          color: #374151;
          padding: 8px 20px;
          font-size: 13px;
          font-weight: 500;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-secondary:hover {
          background: #f9fafb;
          border-color: #9ca3af;
        }

        #reader {
          width: 280px;
          height: 280px;
          overflow: hidden;
          border-radius: 6px;
          border: 1px solid var(--qr-border);
          position: relative;
          background: #000;
        }

        .scanner-overlay-line {
          position: absolute;
          left: 10%;
          right: 10%;
          height: 3px;
          background: var(--qr-accent);
          box-shadow: 0 0 10px var(--qr-accent);
          animation: scanVertical 2.2s linear infinite;
        }

        @keyframes scanVertical {
          0% { top: 10%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 90%; opacity: 0; }
        }

        .animate-spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .result-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          text-align: center;
        }

        .result-title {
          font-size: 18px;
          font-weight: 600;
          margin: 0 0 4px 0;
        }

        .result-title.success {
          color: #16a34a;
        }

        .result-title.error {
          color: #dc2626;
        }

        .result-submessage {
          color: var(--qr-text-muted);
          font-size: 14px;
          margin: 0;
        }

        .table-container {
          background: var(--qr-card-bg);
          border: 1px solid var(--qr-border);
          border-radius: 6px;
          overflow: hidden;
          margin-bottom: 24px;
        }

        .table-header {
          padding: 16px 24px;
          border-bottom: 1px solid var(--qr-border);
          font-weight: 600;
          font-size: 15px;
          color: var(--qr-text);
        }

        .flat-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        .flat-table th {
          padding: 12px 24px;
          font-size: 12px;
          font-weight: 600;
          color: var(--qr-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1px solid var(--qr-border);
          background: #f9fafb;
        }

        .flat-table td {
          padding: 14px 24px;
          font-size: 14px;
          color: var(--qr-text);
        }

        .flat-table tbody tr {
          border-bottom: none;
        }

        .flat-table tbody tr:nth-child(even) {
          background-color: #f9fafb;
        }

        .flat-table tbody tr:hover {
          background-color: #f3f4f6;
        }

        .tag {
          display: inline-block;
          background: #f3f4f6;
          border: 1px solid var(--qr-border);
          border-radius: 4px;
          padding: 2px 6px;
          color: var(--qr-text-muted);
          font-size: 11px;
        }

        /* Specific Status badges overrides for QR scanner page */
        .qr-scanner-portal .status-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .qr-scanner-portal .status-badge.present {
          background: rgba(22, 163, 74, 0.1);
          color: #16a34a;
          border: 1px solid rgba(22, 163, 74, 0.2);
        }

        .qr-scanner-portal .status-badge.late {
          background: rgba(217, 119, 6, 0.1);
          color: #d97706;
          border: 1px solid rgba(217, 119, 6, 0.2);
        }

        .qr-scanner-portal .status-badge.absent {
          background: rgba(220, 38, 38, 0.1);
          color: #dc2626;
          border: 1px solid rgba(220, 38, 38, 0.2);
        }
      `}</style>
    </div>
  );
}
