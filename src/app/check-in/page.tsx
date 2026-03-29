"use client";

import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser, ensureStudentProfile } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Loader2, QrCode, AlertCircle, Scan, History, Info } from "lucide-react";
import Scanner from "@/components/Scanner";

export default function CheckInPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [qrCodeId, setQrCodeId] = useState<string | null>(null);
  const [isRepairing, setIsRepairing] = useState(false);
  const [mode, setMode] = useState<"present" | "scan">("present");
  const [scanSuccess, setScanSuccess] = useState(false);
  const [checkInTime, setCheckInTime] = useState("");
  const router = useRouter();

  useEffect(() => {
    async function load() {
      try {
        const u = await getCurrentUser();
        if (!u) {
          router.push("/login");
          return;
        }
        setUser(u);

        // If student, try to get their personal QR ID for the "Present" tab
        if (u.account_type === "student") {
          const profile = u.student_profiles?.[0];
          if (profile?.qr_code_id) {
            setQrCodeId(profile.qr_code_id);
          } else {
            const { data } = await supabase
              .from("student_profiles")
              .select("qr_code_id")
              .eq("user_id", u.id)
              .single();
            if (data) setQrCodeId(data.qr_code_id);
          }
        }
      } catch (err) {
        console.error("Failed to load attendance portal", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  const handleScanSuccess = async (code: string) => {
    if (!user) return;
    try {
      setLoading(true);
      // 1. Look up the QR session by code
      const { data: session, error: sessionErr } = await supabase
        .from("qr_sessions")
        .select("*")
        .eq("code", code)
        .single();

      if (sessionErr || !session) throw new Error("Invalid or expired QR code");

      const now = new Date();
      if (new Date(session.expires_at) < now) throw new Error("This QR code has expired");

      // 2. Check for duplicate
      const { data: existing } = await supabase
        .from("attendance_records")
        .select("id")
        .eq("student_id", user.id)
        .eq("session_id", session.id)
        .single();

      if (existing) throw new Error("Already checked in for this session");

      // 3. Determine status (Mock logic based on session time)
      const status = "present"; // In a real app, compare now with session.start_time

      // 4. Record attendance
      const { error: attErr } = await supabase.from("attendance_records").insert({
        student_id: user.id,
        session_id: session.id,
        status,
        time_in: now.toISOString(),
        remarks: "Self check-in via QR Scan",
      });

      if (attErr) throw attErr;

      setCheckInTime(now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));
      setScanSuccess(true);
    } catch (err: any) {
      alert("⚠️ " + (err.message || "Attendance failed"));
    } finally {
      setLoading(false);
    }
  };

  async function handleRepairQR() {
    if (!user || user.account_type !== 'student') return;
    try {
      setIsRepairing(true);
      const studentId = prompt("Confirm your Student ID Number:");
      if (!studentId) return;

      const year = prompt("Year Level (e.g. 1st Year):");
      const section = prompt("Section (e.g. PharmA):");

      await ensureStudentProfile(user.id, {
        student_id_number: studentId,
        year: year || "Unknown",
        section: section || "Unknown"
      } as any);
      
      window.location.reload();
    } catch (err: any) {
      alert("Repair failed: " + err.message);
    } finally {
      setIsRepairing(false);
    }
  }

  if (loading && !scanSuccess) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
        <Loader2 className="animate-spin" size={48} color="var(--gold)" />
      </div>
    );
  }

  const isStudent = user?.account_type === "student";

  return (
    <div className="fade-in" style={{ padding: "40px 20px", display: "flex", flexDirection: "column", alignItems: "center", minHeight: "80vh" }}>
      
      <div style={{ textAlign: "center", marginBottom: "40px" }}>
        <h2 style={{ fontSize: "2.2rem", fontWeight: 800, marginBottom: "12px", background: "linear-gradient(to right, #fff, var(--gold))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Attendance Portal
        </h2>
        <p style={{ color: "var(--muted)", maxWidth: "500px", margin: "0 auto", fontSize: "1.05rem" }}>
          Mark your attendance by presenting your ID or scanning a class session code.
        </p>
      </div>

      {isStudent && (
        <div style={{ display: "flex", gap: "12px", marginBottom: "40px", background: "rgba(255,255,255,0.05)", padding: "6px", borderRadius: "16px" }}>
          <button 
            className={`btn ${mode === "present" ? "btn-gold" : "btn-ghost"}`} 
            style={{ borderRadius: "12px", width: "auto", padding: "10px 24px", gap: "8px" }}
            onClick={() => { setMode("present"); setScanSuccess(false); }}
          >
            <QrCode size={18} /> Present ID
          </button>
          <button 
            className={`btn ${mode === "scan" ? "btn-gold" : "btn-ghost"}`} 
            style={{ borderRadius: "12px", width: "auto", padding: "10px 24px", gap: "8px" }}
            onClick={() => setMode("scan")}
          >
            <Scan size={18} /> Scan Class
          </button>
        </div>
      )}

      <div className="card" style={{ width: "100%", maxWidth: "460px", background: "var(--surface)", padding: "40px", borderRadius: "28px", border: "1px solid rgba(255,255,255,0.05)", boxShadow: "0 20px 50px rgba(0,0,0,0.3)", position: "relative", overflow: "hidden" }}>
        
        {/* Decor */}
        <div style={{ position: "absolute", top: -50, right: -50, width: 150, height: 150, background: "var(--gold)", filter: "blur(100px)", opacity: 0.1, pointerEvents: "none" }}></div>

        {mode === "present" ? (
          <div style={{ textAlign: "center" }}>
            {qrCodeId ? (
              <>
                <div style={{ background: "white", padding: "24px", borderRadius: "20px", display: "inline-block", marginBottom: "24px", boxShadow: "0 0 40px rgba(212, 175, 55, 0.15)" }}>
                  <QRCodeSVG value={qrCodeId} size={240} level="H" />
                </div>
                <div style={{ fontFamily: "monospace", fontSize: "1.4rem", letterSpacing: "4px", color: "var(--gold)", fontWeight: 700, marginBottom: "8px" }}>
                  {qrCodeId}
                </div>
                <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Present this to a Council Admin or Facilitator</p>
              </>
            ) : (
              <div style={{ padding: "40px 0" }}>
                <AlertCircle size={48} color="var(--danger)" style={{ marginBottom: "20px" }} />
                <h4 style={{ color: "var(--white)", marginBottom: "12px" }}>QR Code Unavailable</h4>
                <p style={{ color: "var(--muted)", marginBottom: "24px", fontSize: "0.9rem" }}>We couldn't link a student profile to your account. This is required for attendance.</p>
                <button className="btn btn-gold" onClick={handleRepairQR} disabled={isRepairing}>
                  {isRepairing ? "Repairing..." : "Repair Student Profile"}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: "center" }}>
            {!scanSuccess ? (
              <>
                <div style={{ marginBottom: "24px", position: "relative", borderRadius: "20px", overflow: "hidden", border: "2px solid var(--gold-dim)" }}>
                   <Scanner onSuccess={handleScanSuccess} />
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: "0.85rem" }}>
                  <Info size={14} /> Center the class QR code in the viewport
                </div>
              </>
            ) : (
              <div className="fade-in" style={{ padding: "20px 0" }}>
                <div style={{ fontSize: "64px", marginBottom: "20px" }}>✅</div>
                <h3 style={{ fontSize: "1.5rem", marginBottom: "12px" }}>Attendance Recorded!</h3>
                <p style={{ color: "var(--muted)", marginBottom: "32px", fontSize: "1rem", lineHeight: 1.6 }}>
                  Your check-in was successful<br />at <span style={{ color: "var(--gold)", fontWeight: 600 }}>{checkInTime}</span>
                </p>
                <button className="btn btn-outline" style={{ width: "auto", padding: "10px 24px" }} onClick={() => setScanSuccess(false)}>
                  Scan Another Section
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ marginTop: "40px", display: "flex", gap: "24px" }}>
         <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--muted)", fontSize: "0.9rem" }}>
           <History size={16} /> <span style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }} onClick={() => router.push("/dashboard/records")}>View History</span>
         </div>
      </div>

      <style jsx>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
