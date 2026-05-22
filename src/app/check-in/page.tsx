"use client";

import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser, ensureStudentProfile } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import {
  Loader2, QrCode, AlertCircle, Scan, History,
  Info, CheckCircle2, ArrowLeft, Maximize2,
} from "lucide-react";
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
        if (!u) { router.push("/login"); return; }
        setUser(u);
        if (u.account_type === "student") {
          const profile = u.student_profiles?.[0];
          if (profile?.qr_code_id) {
            setQrCodeId(profile.qr_code_id);
          } else {
            const { data } = await supabase
              .from("student_profiles").select("qr_code_id")
              .eq("user_id", u.id).single();
            if (data) setQrCodeId((data as any).qr_code_id);
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
      const { data: session, error: sessionErr } = await supabase
        .from("qr_sessions").select("*").eq("code", code).single();
      if (sessionErr || !session) throw new Error("Invalid or expired QR code");
      const now = new Date();
      if (new Date((session as any).expires_at) < now) throw new Error("This QR code has expired");
      const { data: existing } = await supabase
        .from("attendance_records").select("id")
        .eq("student_id", user.id).eq("session_id", (session as any).id).single();
      if (existing) throw new Error("Already checked in for this session");
      const { error: attErr } = await (supabase.from("attendance_records") as any).insert({
        student_id: user.id,
        session_id: (session as any).id,
        status: "present",
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
    if (!user || user.account_type !== "student") return;
    try {
      setIsRepairing(true);
      const studentId = prompt("Confirm your Student ID Number:");
      if (!studentId) return;
      const year = prompt("Year Level (e.g. 1st Year):");
      const section = prompt("Section (e.g. PharmA):");
      await ensureStudentProfile(user.id, {
        student_id_number: studentId,
        year: year || "Unknown",
        section: section || "Unknown",
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
      <div className="sp-center-screen">
        <Loader2 className="sp-spinner" size={36} />
      </div>
    );
  }

  const isStudent = user?.account_type === "student";

  return (
    <div className="fade-in sp-checkin-root">

      {/* ── Header ── */}
      <header className="sd-header">
        <div>
          <p className="sd-header-eyebrow">Student Portal</p>
          <h1 className="sd-header-title">Check-In</h1>
        </div>
        <button className="sp-back-btn" onClick={() => router.push("/dashboard")}>
          <ArrowLeft size={14} /> Back to Dashboard
        </button>
      </header>

      {/* ── Mode Toggle ── */}
      {isStudent && (
        <div className="sp-mode-toggle">
          <button
            className={`sp-mode-btn ${mode === "present" ? "active" : ""}`}
            onClick={() => { setMode("present"); setScanSuccess(false); }}
          >
            <QrCode size={15} /> Present My ID
          </button>
          <button
            className={`sp-mode-btn ${mode === "scan" ? "active" : ""}`}
            onClick={() => setMode("scan")}
          >
            <Scan size={15} /> Scan Class Code
          </button>
        </div>
      )}

      {/* ── Main Card ── */}
      <div className="sp-main-card">
        {/* Glow accent */}
        <div className="sp-card-glow" />

        {mode === "present" ? (
          <div className="sp-present-panel">
            {qrCodeId ? (
              <>
                <div className="sp-qr-wrapper">
                  <QRCodeSVG value={qrCodeId} size={220} level="H" includeMargin={false} />
                </div>
                <p className="sp-qr-code-label">{qrCodeId}</p>
                <p className="sp-qr-instruction">
                  Present this to a Council Admin or Facilitator for scanning
                </p>
                <div className="sp-qr-hint-row">
                  <Info size={12} />
                  Keep screen brightness high for best scan results
                </div>
              </>
            ) : (
              <div className="sp-qr-error-state">
                <div className="sp-error-icon-wrap">
                  <AlertCircle size={28} color="var(--danger)" />
                </div>
                <h3 className="sp-error-title">QR Code Unavailable</h3>
                <p className="sp-error-body">
                  We couldn't link a student profile to your account. This is required for attendance tracking.
                </p>
                <button className="sp-repair-cta" onClick={handleRepairQR} disabled={isRepairing}>
                  {isRepairing ? "Repairing…" : "Repair Student Profile"}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="sp-scan-panel">
            {!scanSuccess ? (
              <>
                <div className="sp-scanner-frame">
                  <Scanner onSuccess={handleScanSuccess} />
                </div>
                <p className="sp-scan-hint">
                  <Info size={13} /> Center the class QR code in the viewport
                </p>
              </>
            ) : (
              <div className="sp-success-state fade-in">
                <div className="sp-success-icon">
                  <CheckCircle2 size={40} color="var(--success)" />
                </div>
                <h3 className="sp-success-title">Attendance Recorded!</h3>
                <p className="sp-success-body">
                  Your check-in was confirmed at <span className="sp-success-time">{checkInTime}</span>
                </p>
                <div className="sp-success-actions">
                  <button className="sp-rescan-btn" onClick={() => setScanSuccess(false)}>
                    <Scan size={14} /> Scan Another
                  </button>
                  <button className="sp-history-btn" onClick={() => router.push("/dashboard/records")}>
                    <History size={14} /> View Records
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Footer Link ── */}
      {!scanSuccess && (
        <button className="sp-footer-link" onClick={() => router.push("/dashboard/records")}>
          <History size={14} /> View attendance history
        </button>
      )}
    </div>
  );
}
