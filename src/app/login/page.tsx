"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { loginUser, getCurrentUser, getAuthUser, resendVerificationEmail } from "@/lib/auth-client";
import { Suspense } from "react";
import { Eye, EyeOff, Clock, CheckCircle2 } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [resending, setResending] = useState(false);
  const [showResend, setShowResend] = useState(false);

  // Pending approval state for facilitators
  const [isPendingApproval, setIsPendingApproval] = useState(false);
  const [pendingUserName, setPendingUserName] = useState("");
  const [pendingAccountType, setPendingAccountType] = useState<"student" | "facilitator" | "admin">("student");
  const [showPassword, setShowPassword] = useState(false);

  // Check for verification success from email callback
  useEffect(() => {
    const verified = searchParams.get("verified");
    const err = searchParams.get("error");
    const reset = searchParams.get("reset");
    const pending = searchParams.get("pending");

    if (verified === "true") {
      setSuccessMsg("Email verified successfully! You can now log in.");
    }
    if (pending === "true") {
      setSuccessMsg("Registration complete! Your account is pending approval by the System Administrator.");
    }
    if (reset === "success") {
      setSuccessMsg("Password updated successfully! Please log in with your new password.");
    }
    if (err) {
      if (err === "link_already_used") {
        setSuccessMsg("Your email is already verified! You can log in below.");
      } else if (err.startsWith("code_exchange_failed:")) {
        setError(`Google login failed: ${err.replace("code_exchange_failed:", "")}`);
      } else if (err.startsWith("verification_failed:")) {
        setError(`Email verification failed: ${err.replace("verification_failed:", "")}`);
      } else if (err.startsWith("oauth_error:")) {
        setError(`OAuth Error: ${err.replace("oauth_error:", "")}`);
      } else if (err === "verification_failed") {
        setError("Email verification failed. The link may have expired. Please try registering again.");
      }
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessMsg("");
    setShowResend(false);
    setIsPendingApproval(false);

    try {
      // Step 1: Authenticate with Supabase
      await loginUser({ email, password });

      // Step 2: Check if email is verified
      const authUser = await getAuthUser();
      if (!authUser) {
        setError("Authentication failed. Please try again.");
        setLoading(false);
        return;
      }

      if (!authUser.email_confirmed_at) {
        // Email not verified — show message. Not signing out: RLS/allow_own_read
        // and requireAuth() both gate on status/verification independent of
        // session validity, so holding the session costs nothing and avoids
        // a full sessions/refresh_tokens churn cycle on every repeat check.
        setError("Please verify your email first. Check your inbox for the verification link.");
        setShowResend(true);
        setLoading(false);
        return;
      }

      // Step 3: Fetch profile to check role and status
      const user = await getCurrentUser() as any;

      if (!user) {
        // Profile row missing — happens when a Google OAuth user
        // authenticated but never completed onboarding. Send them there
        // so they can finish setting up their account.
        router.push("/onboarding");
        return;
      }

      // Step 4: Check account status and redirect based on role
      if (user.account_type === "admin") {
        router.push("/dashboard/admin");
        return;
      }

      if (user.account_type === "facilitator") {
        if (user.status === "pending") {
          // Show pending approval screen. Not signing out — see note above.
          setIsPendingApproval(true);
          setPendingUserName(user.full_name);
          setPendingAccountType("facilitator");
          setLoading(false);
          return;
        }
        if (user.status === "rejected") {
          setError("Your facilitator account has been rejected by the administrator. Please contact support for more information.");
          setLoading(false);
          return;
        }
        // Approved facilitator
        router.push("/dashboard/facilitator");
        return;
      }

      if (user.account_type === "student") {
        if (user.status === "pending") {
          setIsPendingApproval(true);
          setPendingUserName(user.full_name);
          setPendingAccountType("student");
          setLoading(false);
          return;
        }
        if (user.status === "rejected") {
          setError("Your student account has been rejected by the administrator. Please contact support for more information.");
          setLoading(false);
          return;
        }

        // Approved Student
        const redirect = searchParams.get("redirect");
        if (redirect === "checkin") {
          router.push("/dashboard?checkin=true");
        } else {
          router.push("/dashboard");
        }
        return;
      }

    } catch (err: any) {
      const message = err.message || "An unexpected error occurred. Please check your credentials.";
      setError(message);
      if (message.toLowerCase().includes("email not confirmed")) {
        setShowResend(true);
      }
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      setError("Enter your email above first, then tap Resend.");
      return;
    }
    setResending(true);
    setError("");
    setSuccessMsg("");
    try {
      await resendVerificationEmail(email);
      setSuccessMsg("Verification email sent. Check your inbox (and spam folder).");
      setShowResend(false);
    } catch (err: any) {
      setError(err.message || "Failed to resend verification email. Please try again.");
    } finally {
      setResending(false);
    }
  };

  const handleBackToLogin = () => {
    setIsPendingApproval(false);
    setPendingUserName("");
    setEmail("");
    setPassword("");
  };

  return (
    <div className="page-wrapper">
      {/* ANIMATED BACKGROUND (DARKER) */}
      <div className="animated-bg darker">
        <div className="hero-watermark"></div>
        <div className="blob blob-1 darker"></div>
        <div className="blob blob-2 darker"></div>
        <div className="blob blob-3 darker"></div>
      </div>

      <div className="auth-page fade-in">
        <div className="auth-card">
          {isPendingApproval ? (
            /* ========== PENDING APPROVAL SCREEN ========== */
            <>
              <div className="auth-header">
                <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
                  <img src="/usa.png" alt="University Logo" style={{ height: "85px", objectFit: "contain", filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.5))" }} />
                </div>
                <h2 style={{ color: "#FBBF24", fontSize: "clamp(1.3rem, 5vw, 1.8rem)", lineHeight: 1.2 }}>Pending Approval</h2>
                <p style={{ marginTop: "8px" }}>Hello, <strong>{pendingUserName}</strong></p>
              </div>

              <div className="fade-in" style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{
                  width: "80px", height: "80px", borderRadius: "50%",
                  background: "rgba(251, 191, 36, 0.1)", border: "2px solid rgba(251, 191, 36, 0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 20px"
                }}>
                  <Clock size={32} color="#FBBF24" strokeWidth={1.5} />
                </div>

                <p style={{ color: "var(--white)", marginBottom: "16px", lineHeight: "1.6", fontSize: "0.95rem" }}>
                  Your {pendingAccountType === "student" ? "Student" : "Facilitator"} account has been created and your email is verified.
                </p>
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.85rem", marginBottom: "10px", lineHeight: "1.6" }}>
                  However, it must be <strong style={{ color: "var(--gold)" }}>approved by the System Administrator</strong> before you can access the portal.
                </p>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8rem", marginBottom: "30px" }}>
                  You will be able to log in once your account is approved. Please check back later.
                </p>

                <button
                  onClick={handleBackToLogin}
                  className="btn btn-gold"
                  style={{ width: "100%", padding: "14px", fontSize: "1rem", border: "none" }}
                >
                  Back to Login
                </button>
              </div>
            </>
          ) : (
            /* ========== NORMAL LOGIN FORM ========== */
            <>
              <div className="auth-header">
                <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
                  <img src="/usa.png" alt="University Logo" style={{ height: "85px", objectFit: "contain", filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.5))" }} />
                </div>
                <h2 style={{ fontSize: "clamp(1.5rem, 5vw, 2.2rem)", lineHeight: 1.2 }}>Welcome back</h2>
                <p>Access your official Pharmatrack portal.</p>
              </div>

              <form className="auth-form" onSubmit={handleLogin}>
                {/* Success message (e.g., after email verification) */}
                {successMsg && (
                  <div style={{
                    background: "rgba(74, 222, 128, 0.1)",
                    border: "1px solid rgba(74, 222, 128, 0.3)",
                    color: "#4ADE80",
                    textAlign: "center",
                    fontSize: "0.85rem",
                    padding: "12px",
                    borderRadius: "10px",
                    marginBottom: "10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px"
                  }}>
                    <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
                    <span>{successMsg}</span>
                  </div>
                )}

                {/* Error message */}
                {error && (
                  <div style={{
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    color: "#fca5a5",
                    textAlign: "center",
                    fontSize: "0.85rem",
                    padding: "12px",
                    borderRadius: "10px",
                    marginBottom: "10px"
                  }}>
                    {error}
                  </div>
                )}

                {/* Resend verification email — shown when login fails due to an unconfirmed account */}
                {showResend && (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resending}
                    style={{
                      width: "100%",
                      background: "rgba(232, 184, 75, 0.1)",
                      border: "1px solid rgba(232, 184, 75, 0.4)",
                      color: "#E8B84B",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      padding: "10px",
                      borderRadius: "10px",
                      marginBottom: "10px",
                      cursor: resending ? "wait" : "pointer",
                      opacity: resending ? 0.6 : 1,
                    }}
                  >
                    {resending ? "Sending…" : "Resend verification email"}
                  </button>
                )}


                <div className="input-group">
                  <label>USA Email</label>
                  <input
                    type="email"
                    className="input-field"
                    placeholder="student@usa.edu.ph"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
                <div className="input-group">
                  <label>Password</label>
                  <div style={{ position: "relative", width: "100%" }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      className="input-field"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                      style={{ paddingRight: "45px" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: "absolute",
                        right: "12px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "rgba(255, 255, 255, 0.4)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "4px",
                      }}
                      tabIndex={-1}
                    >
                      {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>
                  </div>
                </div>

                <div style={{ textAlign: "right", marginTop: "-8px" }}>
                  <Link href="/forgot-password" className="auth-link" style={{ fontSize: "0.85rem" }}>
                    Forgot password?
                  </Link>
                </div>

                <button
                  type="submit"
                  className="btn btn-gold pulse-btn"
                  style={{ width: "100%", padding: "16px", marginTop: "4px", fontSize: "1.1rem", border: "none" }}
                  disabled={loading}
                >
                  {loading ? "Logging in..." : "Secure Log In"}
                </button>
              </form>

              <div className="auth-footer">
                Don&apos;t have an account? <Link href="/register" className="auth-link">Register here</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="page-wrapper">
        <div className="animated-bg darker">
          <div className="hero-watermark"></div>
          <div className="blob blob-1 darker"></div>
          <div className="blob blob-2 darker"></div>
          <div className="blob blob-3 darker"></div>
        </div>
        <div className="auth-page fade-in">
          <div className="auth-card" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "300px" }}>
            <p style={{ color: "var(--muted)" }}>Loading...</p>
          </div>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
