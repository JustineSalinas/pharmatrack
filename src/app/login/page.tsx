"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { loginUser, getCurrentUser, getAuthUser, logoutUser } from "@/lib/auth-client";
import { Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Pending approval state for facilitators
  const [isPendingApproval, setIsPendingApproval] = useState(false);
  const [pendingUserName, setPendingUserName] = useState("");

  // Check for verification success from email callback
  useEffect(() => {
    const verified = searchParams.get("verified");
    const err = searchParams.get("error");

    if (verified === "true") {
      setSuccessMsg("Email verified successfully! You can now log in.");
    }
    if (err === "verification_failed") {
      setError("Email verification failed. The link may have expired. Please try registering again.");
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessMsg("");
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
        // Email not verified — sign them out and show message
        await logoutUser();
        setError("Please verify your email first. Check your inbox for the verification link.");
        setLoading(false);
        return;
      }

      // Step 3: Fetch profile to check role and status
      const user = await getCurrentUser() as any;

      if (!user) {
        setError("Your account was found, but your profile record is missing. Please contact the administrator.");
        await logoutUser();
        setLoading(false);
        return;
      }

      // Step 4: Check account status and redirect based on role
      if (user.account_type === "admin") {
        router.push("/dashboard/admin");
        return;
      }

      if (user.account_type === "facilitator") {
        if (user.status === "pending") {
          // Sign them out and show pending approval screen
          await logoutUser();
          setIsPendingApproval(true);
          setPendingUserName(user.full_name);
          setLoading(false);
          return;
        }
        if (user.status === "rejected") {
          await logoutUser();
          setError("Your facilitator account has been rejected by the administrator. Please contact support for more information.");
          setLoading(false);
          return;
        }
        // Approved facilitator
        router.push("/dashboard/facilitator");
        return;
      }

      // Student (auto-approved)
      router.push("/dashboard");

    } catch (err: any) {
      setError(err.message || "An unexpected error occurred. Please check your credentials.");
      setLoading(false);
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
                  margin: "0 auto 20px", fontSize: "2rem"
                }}>
                  ⏳
                </div>

                <p style={{ color: "var(--white)", marginBottom: "16px", lineHeight: "1.6", fontSize: "0.95rem" }}>
                  Your Facilitator account has been created and your email is verified.
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
                <h2 style={{ fontSize: "clamp(1.5rem, 5vw, 2.2rem)", lineHeight: 1.2 }}>Welcome, pharmacists!</h2>
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
                    marginBottom: "10px"
                  }}>
                    ✓ {successMsg}
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

                <div className="input-group">
                  <label>USA Email</label>
                  <input
                    type="email"
                    className="input-field"
                    placeholder="Student@usa.edu.ph"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="input-group">
                  <label>Password</label>
                  <input
                    type="password"
                    className="input-field"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-gold pulse-btn"
                  style={{ width: "100%", padding: "16px", marginTop: "10px", fontSize: "1.1rem", border: "none" }}
                  disabled={loading}
                >
                  {loading ? "Authenticating..." : "Secure log in"}
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
