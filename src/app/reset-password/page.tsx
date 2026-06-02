"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { updatePassword } from "@/lib/auth-client";

type Phase = "verifying" | "ready" | "done" | "invalid";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<Phase>("verifying");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Establish the recovery session from the email link.
  useEffect(() => {
    let active = true;

    async function init() {
      const code = searchParams.get("code");
      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }
        // Hash-based recovery tokens are auto-detected by the client on load.
        const { data } = await supabase.auth.getSession();
        if (active && data.session) {
          setPhase("ready");
          return;
        }
      } catch {
        /* fall through to listener / invalid */
      }
    }

    init();

    // Catches the PASSWORD_RECOVERY event when the session is parsed from the URL hash.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || session) setPhase("ready");
    });

    // If nothing established a session in time, treat the link as invalid/expired.
    const timer = setTimeout(() => {
      if (active) setPhase((p) => (p === "verifying" ? "invalid" : p));
    }, 4000);

    return () => {
      active = false;
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setSaving(true);
    try {
      await updatePassword(password);
      setPhase("done");
      await supabase.auth.signOut();
      setTimeout(() => router.push("/login?reset=success"), 2200);
    } catch (err: any) {
      setError(err.message || "Could not update your password. The link may have expired.");
      setSaving(false);
    }
  };

  return (
    <div className="page-wrapper">
      <div className="animated-bg darker">
        <div className="hero-watermark"></div>
        <div className="blob blob-1 darker"></div>
        <div className="blob blob-2 darker"></div>
        <div className="blob blob-3 darker"></div>
      </div>

      <div className="auth-page fade-in">
        <div className="auth-card">
          <div className="auth-header">
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
              <img src="/usa.png" alt="University Logo" style={{ height: "85px", objectFit: "contain", filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.5))" }} />
            </div>
            <h2 style={{ fontSize: "clamp(1.5rem, 5vw, 2.2rem)", lineHeight: 1.2 }}>Set New Password</h2>
            <p>Choose a strong password for your account.</p>
          </div>

          {phase === "verifying" && (
            <div style={{ textAlign: "center", padding: "30px 0" }}>
              <Loader2 size={32} className="sp-spinner" style={{ color: "var(--gold)" }} />
              <p style={{ marginTop: "16px", color: "var(--muted)", fontSize: "0.9rem" }}>Verifying your reset link…</p>
            </div>
          )}

          {phase === "invalid" && (
            <div className="fade-in" style={{ textAlign: "center", padding: "10px 0 20px" }}>
              <div style={{
                width: "72px", height: "72px", borderRadius: "50%",
                background: "rgba(248, 113, 113, 0.1)", border: "2px solid rgba(248, 113, 113, 0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 22px", color: "var(--danger)",
              }}>
                <AlertCircle size={34} />
              </div>
              <p style={{ color: "var(--white)", marginBottom: "10px", lineHeight: 1.6, fontSize: "0.95rem" }}>
                This reset link is invalid or has expired.
              </p>
              <Link href="/forgot-password" className="btn btn-gold" style={{ width: "100%", padding: "14px", border: "none", display: "inline-block", textAlign: "center", marginTop: "10px" }}>
                Request a New Link
              </Link>
            </div>
          )}

          {phase === "done" && (
            <div className="fade-in" style={{ textAlign: "center", padding: "10px 0 20px" }}>
              <div style={{
                width: "72px", height: "72px", borderRadius: "50%",
                background: "rgba(74, 222, 128, 0.1)", border: "2px solid rgba(74, 222, 128, 0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 22px", color: "var(--success)",
              }}>
                <CheckCircle2 size={34} />
              </div>
              <p style={{ color: "var(--white)", marginBottom: "8px", lineHeight: 1.6, fontSize: "0.95rem" }}>
                Password updated successfully!
              </p>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.85rem" }}>Redirecting you to login…</p>
            </div>
          )}

          {phase === "ready" && (
            <form className="auth-form" onSubmit={handleSubmit}>
              {error && (
                <div style={{
                  background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)",
                  color: "#fca5a5", textAlign: "center", fontSize: "0.85rem",
                  padding: "12px", borderRadius: "10px", marginBottom: "10px",
                }}>
                  {error}
                </div>
              )}

              <div className="input-group">
                <label>New Password</label>
                <div style={{ position: "relative", width: "100%" }}>
                  <Lock size={16} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
                  <input
                    type={showPassword ? "text" : "password"}
                    className="input-field"
                    placeholder="Min. 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                    style={{ paddingLeft: "42px", paddingRight: "42px" }}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 0, display: "flex" }}>
                    {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                </div>
              </div>

              <div className="input-group">
                <label>Confirm New Password</label>
                <div style={{ position: "relative", width: "100%" }}>
                  <Lock size={16} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
                  <input
                    type={showPassword ? "text" : "password"}
                    className="input-field"
                    placeholder="Repeat new password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    required
                    style={{ paddingLeft: "42px" }}
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-gold" style={{ width: "100%", padding: "16px", marginTop: "6px" }} disabled={saving}>
                {saving ? "Updating…" : "Update Password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="auth-page"><div className="auth-card">Loading…</div></div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
