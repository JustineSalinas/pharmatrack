"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loginUser, getCurrentUser } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await loginUser({ email, password });

      // Fetch profile to check role
      const user = await getCurrentUser();

      // Check account type for redirect
      if (user?.account_type === "admin") {
        router.push("/dashboard/admin");
      } else if (user?.account_type === "facilitator") {
        router.push("/dashboard/facilitator");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred. Please check your credentials.");
      setLoading(false);
    }
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
          <div className="auth-header">
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
              <img src="/usa.png" alt="University Logo" style={{ height: "85px", objectFit: "contain", filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.5))" }} />
            </div>
            <h2 style={{ fontSize: "clamp(1.5rem, 5vw, 2.2rem)", lineHeight: 1.2 }}>Welcome, Pharmacists!</h2>
            <p>Access your official PharmaTrack portal.</p>
          </div>

          <form className="auth-form" onSubmit={handleLogin}>
            {error && <div style={{ color: "var(--danger)", textAlign: "center", fontSize: "0.85rem", marginBottom: "10px" }}>{error}</div>}

            <div className="input-group">
              <label>USA Email</label>
              <input
                type="email"
                className="input-field"
                placeholder="student@usa.edu.ph"
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
              {loading ? "Authenticating..." : "Secure Log In"}
            </button>
          </form>

          <div className="auth-footer">
            Don't have an account? <Link href="/register" className="auth-link">Register Here</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
