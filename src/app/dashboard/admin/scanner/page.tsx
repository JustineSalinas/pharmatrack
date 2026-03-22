"use client";

import { useEffect, useState, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth-client";
import { 
  ScanLine, 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Camera,
  CalendarDays
} from "lucide-react";
import Link from "next/link";

export default function ScannerPage() {
  const [activeEvents, setActiveEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [admin, setAdmin] = useState<any>(null);
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string; submessage?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  // Load events and admin profile
  useEffect(() => {
    async function init() {
      const user = await getCurrentUser();
      setAdmin(user);
      
      const { data: events } = await supabase
        .from("events")
        .select("*")
        .order("date", { ascending: false });
      
      setActiveEvents(events || []);
      if (events && events.length > 0) setSelectedEventId(events[0].id);
      setLoading(false);
    }
    init();
  }, []);

  // Initialize/Stop Scanner
  useEffect(() => {
    if (isScanning && selectedEventId) {
      scannerRef.current = new Html5QrcodeScanner(
        "reader", 
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      );

      scannerRef.current.render(onScanSuccess, onScanFailure);
    } else {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(error => console.error("Failed to clear scanner", error));
        scannerRef.current = null;
      }
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(error => console.error("Scanner cleanup failed", error));
      }
    };
  }, [isScanning, selectedEventId]);

  async function onScanSuccess(decodedText: string) {
    if (!selectedEventId || !admin) return;

    // Pause scanning to process
    setIsScanning(false);
    setScanResult({ success: true, message: "Processing scan...", submessage: decodedText });

    try {
      // 1. Find the student by QR Code ID
      const { data: student, error: studentErr } = await supabase
        .from("student_profiles")
        .select("*, users(full_name)")
        .eq("qr_code_id", decodedText)
        .single();

      if (studentErr || !student) {
        setScanResult({ success: false, message: "Invalid QR Code", submessage: "Student not found in database." });
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

      // Simple time check (simplified for now, can be hardened later)
      if (now > new Date(event.check_in_late)) {
        status = "late";
      }
      if (now > new Date(event.check_in_end)) {
         setScanResult({ success: false, message: "Window Closed", submessage: `Check-in for this event ended at ${new Date(event.check_in_end).toLocaleTimeString()}`});
         return;
      }

      // Check if already checked in
      const { data: existingRecord } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("student_id", studentUserId)
        .eq("event_id", selectedEventId)
        .single();

      if (existingRecord) {
        // Handle Check-out if needed
        if (!existingRecord.time_out) {
           const { error: outErr } = await supabase
             .from("attendance_records")
             .update({ time_out: now.toISOString() })
             .eq("id", existingRecord.id);
           
           if (outErr) throw outErr;
           setScanResult({ success: true, message: "Check-out Success!", submessage: `${studentName} has checked out.` });
        } else {
           setScanResult({ success: false, message: "Already Logged", submessage: `${studentName} has already completed attendance.` });
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
    } catch (err: any) {
      console.error(err);
      setScanResult({ success: false, message: "Scan Error", submessage: err.message });
    }
  }

  function onScanFailure(error: any) {
    // Silently continue
  }

  if (loading) return <div className="dash-content-loader">Loading Scanner...</div>;

  return (
    <div className="fade-in">
      <header style={{ marginBottom: "30px", display: "flex", alignItems: "center", gap: "20px" }}>
        <Link href="/dashboard" className="btn btn-outline" style={{ padding: "8px" }}>
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 style={{ fontSize: "1.8rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "10px" }}>
             <ScanLine color="var(--gold)" /> Admin Scanner
          </h1>
          <p style={{ color: "var(--muted)" }}>Log attendance for council activities.</p>
        </div>
      </header>

      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        {/* EVENT SELECTION CARD */}
        <div className="card" style={{ marginBottom: "24px", padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "15px", marginBottom: "15px" }}>
             <CalendarDays color="var(--gold)" size={20} />
             <span style={{ fontWeight: "600" }}>Active Event</span>
          </div>
          <select 
            className="input-field select-field"
            value={selectedEventId}
            onChange={(e) => { setSelectedEventId(e.target.value); setIsScanning(false); setScanResult(null); }}
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

        {/* SCANNER VIEWPORT */}
        <div className="card" style={{ textAlign: "center", padding: "40px", position: "relative" }}>
          {!isScanning && !scanResult && (
            <div style={{ padding: "60px 0" }}>
               <div style={{ marginBottom: "30px", opacity: 0.1 }}>
                  <ScanLine size={120} />
               </div>
               <button 
                onClick={() => setIsScanning(true)} 
                className="btn btn-gold pulse-btn" 
                style={{ padding: "16px 40px", fontSize: "1.1rem" }}
               >
                 <Camera size={20} style={{ marginRight: "10px" }} /> Start Camera
               </button>
            </div>
          )}

          {isScanning && (
            <div id="reader" style={{ width: "100%", overflow: "hidden", borderRadius: "12px", border: "2px solid var(--gold)" }}></div>
          )}

          {scanResult && (
            <div className="fade-in" style={{ padding: "40px 0" }}>
               {scanResult.success ? (
                 <CheckCircle2 size={80} color="#10b981" style={{ margin: "0 auto 20px" }} />
               ) : (
                 <XCircle size={80} color="#ef4444" style={{ margin: "0 auto 20px" }} />
               )}
               <h2 style={{ fontSize: "2rem", color: scanResult.success ? "#10b981" : "#ef4444" }}>{scanResult.message}</h2>
               <p style={{ color: "var(--muted)", fontSize: "1.1rem", marginTop: "10px" }}>{scanResult.submessage}</p>
               
               <div style={{ marginTop: "40px" }}>
                 <button 
                  onClick={() => { setScanResult(null); setIsScanning(true); }} 
                  className="btn btn-gold"
                  style={{ padding: "12px 30px" }}
                 >
                   Scan Next Student
                 </button>
               </div>
            </div>
          )}

          {isScanning && (
            <button 
              onClick={() => setIsScanning(false)} 
              className="btn btn-outline" 
              style={{ marginTop: "30px", width: "200px" }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        .dash-content-loader {
          height: 60vh;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--gold);
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
