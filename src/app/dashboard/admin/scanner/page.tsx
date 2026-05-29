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
      if (!user || user.account_type !== "admin") {
        router.push("/dashboard");
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
    <div className="fade-in sd-root">
      
      {/* PAGE HEADER */}
      <header className="sd-header">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button onClick={() => router.push("/dashboard/admin")} className="sp-back-btn" style={{ padding: "6px", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--surface)", cursor: "pointer" }}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <p className="sd-header-eyebrow">Admin Portal</p>
            <h1 className="sd-header-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <ScanLine size={20} color="var(--gold)" /> QR Scanner
            </h1>
          </div>
        </div>
      </header>

      {/* TWO-COLUMN LAYOUT */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "24px", marginBottom: "32px" }} className="scanner-grid">
        
        {/* LEFT COLUMN: Controls & Event Config */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* EVENT SELECTION CARD */}
          <div className="card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <CalendarDays size={18} color="var(--gold)" />
              <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--white)", margin: 0 }}>Configure Active Activity</h3>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.06em" }}>Target Event</label>
              <select 
                className="input-field select-field"
                value={selectedEventId}
                onChange={(e) => { setSelectedEventId(e.target.value); stopCamera(); setScanResult(null); }}
                disabled={isScanning}
                style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--white)", outline: "none", cursor: "pointer" }}
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
              <div style={{ background: "var(--surface2)", padding: "14px 16px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--white-shade)" }}>
                  <Clock size={13} color="var(--dimmed)" />
                  <span>Late threshold: {new Date(selectedEvent.check_in_late).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--white-shade)" }}>
                  <Clock size={13} color="var(--dimmed)" />
                  <span>Closing time: {new Date(selectedEvent.check_in_end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--white-shade)" }}>
                  <MapPin size={13} color="var(--dimmed)" />
                  <span>Location: {selectedEvent.location}</span>
                </div>
              </div>
            )}
          </div>

          {/* SCANNER MODES & STATS CARD */}
          <div className="card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <Users size={18} color="var(--gold)" />
              <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--white)", margin: 0 }}>Attendance Log Controls</h3>
            </div>
            <p style={{ margin: 0, fontSize: "12.5px", color: "var(--muted)", lineHeight: 1.5 }}>
              The system automatically toggles check-in and check-out logs. Scanning a student's ID for the first time registers them as **Present/Late**. Scanning a second time registers a **Check-out**.
            </p>
            
            <div style={{ display: "flex", gap: "12px", borderTop: "1px solid var(--border)", paddingTop: "14px", marginTop: "4px" }}>
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: "10px", color: "var(--dimmed)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>Scans Logged</div>
                <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--gold)" }}>{recentScans.length}</div>
              </div>
              <div style={{ width: "1px", background: "var(--border)" }}></div>
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: "10px", color: "var(--dimmed)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>Active Scanners</div>
                <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--success)" }}>1</div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Viewport & Scan Results */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          <div className="card" style={{ padding: "30px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "360px", position: "relative" }}>
            
            {!isScanning && !scanResult && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px", padding: "40px 0" }}>
                <div style={{ opacity: 0.1, color: "var(--gold)" }}>
                  <ScanLine size={96} />
                </div>
                <button 
                  onClick={startCamera} 
                  className="btn btn-gold pulse-btn" 
                  disabled={!selectedEventId}
                  style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px 32px", fontSize: "14px", fontWeight: 600, border: "none", borderRadius: "var(--radius)", background: "var(--gold)", color: "#000", cursor: "pointer" }}
                >
                  <Camera size={16} /> Start Scan Session
                </button>
              </div>
            )}

            {isScanning && (
              <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
                <div 
                  id="reader" 
                  style={{ 
                    width: "280px", 
                    height: "280px", 
                    overflow: "hidden", 
                    borderRadius: "12px", 
                    border: "2px solid var(--gold)", 
                    position: "relative",
                    background: "#000"
                  }}
                >
                  <div className="scanner-overlay-line" />
                </div>
                <button 
                  onClick={stopCamera} 
                  className="btn btn-outline" 
                  style={{ padding: "8px 24px", fontSize: "13px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--white)", cursor: "pointer" }}
                >
                  Pause Camera
                </button>
              </div>
            )}

            {scanResult && (
              <div className="fade-in" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", padding: "20px 0", textAlign: "center" }}>
                {scanResult.success ? (
                  <CheckCircle2 size={72} color="var(--success)" />
                ) : (
                  <XCircle size={72} color="var(--danger)" />
                )}
                <div>
                  <h2 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 6px", color: scanResult.success ? "var(--success)" : "var(--danger)" }}>{scanResult.message}</h2>
                  <p style={{ color: "var(--white-shade)", fontSize: "14px", margin: 0 }}>{scanResult.submessage}</p>
                </div>
                
                <button 
                  onClick={() => { setScanResult(null); startCamera(); }} 
                  className="btn btn-gold"
                  style={{ padding: "10px 24px", fontSize: "13px", fontWeight: 600, border: "none", borderRadius: "var(--radius-sm)", background: "var(--gold)", color: "#000", cursor: "pointer", marginTop: "12px" }}
                >
                  Next Scan
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM ROW: RECENT SCANS TABLE */}
      <div className="card" style={{ padding: "0", overflow: "hidden", marginBottom: "24px" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "10px" }}>
          <History size={16} color="var(--gold)" />
          <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--white)", margin: 0 }}>Scan Logs (Live Activity Feed)</h3>
        </div>
        
        <div className="table-wrap">
          <table className="attendance-table" style={{ width: "100%" }}>
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
                  <td colSpan={6} style={{ padding: "40px 24px", textAlign: "center", color: "var(--dimmed)" }}>
                    No scans logged for this activity yet.
                  </td>
                </tr>
              ) : (
                recentScans.map((r, i) => (
                  <tr key={i} className="user-row">
                    <td style={{ paddingLeft: "24px" }}>
                      <span style={{ fontWeight: 500, color: "var(--white-shade)" }}>{r.name}</span>
                    </td>
                    <td><span style={{ fontFamily: "var(--font-sans)", color: "var(--dimmed)", fontSize: "12.5px" }}>{r.idNumber}</span></td>
                    <td><span className="tag" style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--dimmed)", fontSize: "11px" }}>{r.section}</span></td>
                    <td style={{ color: "var(--white-shade)" }}>{r.timeIn}</td>
                    <td style={{ color: "var(--white-shade)" }}>{r.timeOut}</td>
                    <td>
                      <span className={`status-badge ${r.status}`} style={{ fontSize: "11px", padding: "4px 8px" }}>
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

      {/* VIEWPORT OVERLAY SCAN LINE ANIMATION STYLES */}
      <style jsx>{`
        .scanner-overlay-line {
          position: absolute;
          left: 10%;
          right: 10%;
          height: 3px;
          background: var(--gold);
          box-shadow: 0 0 10px var(--gold);
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
        .pulse-btn {
          animation: pulseShadow 2s infinite;
        }
        @keyframes pulseShadow {
          0% { box-shadow: 0 0 0 0 rgba(232, 184, 75, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(232, 184, 75, 0); }
          100% { box-shadow: 0 0 0 0 rgba(232, 184, 75, 0); }
        }
        .user-row {
          transition: background 0.15s ease;
        }
        .user-row:hover {
          background: var(--surface2);
        }
        @media (max-width: 768px) {
          .scanner-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
