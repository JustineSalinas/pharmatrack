"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { sendPasswordReset } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await sendPasswordReset(email.trim());
      setSent(true);
    } catch (err: any) {
      setError(err.message || "Could not send the reset email. Please try again.");
    } finally {
      setLoading(false);
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
            <h2 style={{ fontSize: "clamp(1.5rem, 5vw, 2.2rem)", lineHeight: 1.2 }}>Reset Password</h2>
            <p>{sent ? "Check your inbox" : "We'll email you a secure reset link."}</p>
          </div>

          {sent ? (
            <div className="fade-in" style={{ textAlign: "center", padding: "10px 0 20px" }}>
              <div style={{
                width: "72px", height: "72px", borderRadius: "50%",
                background: "rgba(74, 222, 128, 0.1)", border: "2px solid rgba(74, 222, 128, 0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 22px", color: "var(--success)",
              }}>
                <CheckCircle2 size={34} />
              </div>
              <p style={{ color: "var(--white)", marginBottom: "10px", lineHeight: 1.6, fontSize: "0.95rem" }}>
                If an account exists for <strong style={{ color: "var(--gold)" }}>{email}</strong>, a password reset link is on its way.
              </p>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.85rem", marginBottom: "26px", lineHeight: 1.6 }}>
                The link expires shortly. Don&apos;t forget to check your spam folder.
              </p>
              <Link href="/login" className="btn btn-gold" style={{ width: "100%", padding: "14px", border: "none", display: "inline-block", textAlign: "center" }}>
                Back to Login
              </Link>
            </div>
          ) : (
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
                <label>USA Email</label>
                <div style={{ position: "relative", width: "100%" }}>
                  <Mail size={16} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
                  <input
                    type="email"
                    className="input-field"
                    placeholder="student@usa.edu.ph"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={{ paddingLeft: "42px" }}
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-gold" style={{ width: "100%", padding: "16px", marginTop: "6px" }} disabled={loading}>
                {loading ? "Sending…" : "Send Reset Link"}
              </button>

              <Link href="/login" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", marginTop: "20px", color: "var(--muted)", fontSize: "0.9rem", fontWeight: 500 }}>
                <ArrowLeft size={15} /> Back to Login
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
