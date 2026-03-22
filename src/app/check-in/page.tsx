"use client";
import { useState } from "react";
import Scanner from "@/components/Scanner";
import { supabase } from "@/lib/supabase";

export default function CheckInPage() {
  const [success, setSuccess] = useState(false);
  const [checkInTime, setCheckInTime] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSuccess = async (code: string) => {
    setLoading(true);
    try {
      // 1. Look up the QR session by code
      const { data: session, error: sessionErr } = await supabase
        .from("qr_sessions")
        .select("*")
        .eq("code", code)
        .single();

      if (sessionErr || !session) throw new Error("Invalid or expired QR code");

      const now = new Date();
      if (new Date(session.expires_at) < now) throw new Error("This QR code has expired");

      // 2. Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // 3. Check for duplicate
      const { data: existing } = await supabase
        .from("attendance_records")
        .select("id")
        .eq("student_id", user.id)
        .eq("session_id", session.id)
        .single();

      if (existing) throw new Error("Already checked in for this session");

      // 4. Determine status
      const sessionStart = new Date(session.date + "T07:30:00");
      const lateThreshold = new Date(session.date + "T07:35:00");
      const status = now <= lateThreshold ? "present" : "late";

      // 5. Record attendance
      const { error: attErr } = await supabase.from("attendance_records").insert({
        student_id: user.id,
        session_id: session.id,
        status,
        time_in: now.toISOString(),
        time_out: null,
        date: session.date,
        subject: session.subject,
        section: session.section,
        remarks: status === "late" ? "Late arrival" : "On time",
      });

      if (attErr) throw new Error(attErr.message);

      setCheckInTime(now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));
      setSuccess(true);
    } catch (err: any) {
      alert("⚠️ " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <div className="breadcrumb"><span>Student</span><span>›</span><span>Check-In</span></div>
          <h2>QR Check-In</h2>
          <p>Scan your class QR code to mark attendance</p>
        </div>
      </div>

      {!success ? (
        <Scanner onSuccess={handleSuccess} />
      ) : (
        <div className="modal" style={{ margin: "0 auto", maxWidth: 340, textAlign: "center" }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
          <h3>Check-In Successful!</h3>
          <p style={{ color: "var(--muted)", marginBottom: 24 }}>
            Your attendance has been recorded for <strong>Pharmacology 301</strong>
            <br />at <strong>{checkInTime}</strong>
          </p>
          <button className="btn btn-gold" onClick={() => setSuccess(false)}>
            ← Scan Another
          </button>
        </div>
      )}
    </div>
  );
}
