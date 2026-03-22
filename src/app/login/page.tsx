"use client";

import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="auth-page fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
            <img src="/usa.png" alt="University Logo" style={{ height: "70px", objectFit: "contain", filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.5))" }} />
          </div>
          <h2>Welcome Back</h2>
          <p>Access your official PharmaTrack portal.</p>
        </div>

        <form className="auth-form" onSubmit={(e) => e.preventDefault()}>
          <div className="input-group">
            <label>Official Email</label>
            <input type="email" className="input-field" placeholder="student@usa.edu.ph" required />
          </div>
          <div className="input-group">
            <label>Password</label>
            <input type="password" className="input-field" placeholder="••••••••" required />
          </div>
          
          <Link href="/dashboard" className="btn btn-gold pulse-btn" style={{ width: "100%", padding: "16px", marginTop: "10px", fontSize: "1.1rem", textDecoration: "none" }}>
            Secure Log In
          </Link>
        </form>

        <div className="auth-footer">
          Don't have an account? <Link href="/register" className="auth-link">Register Here</Link>
        </div>
      </div>
    </div>
  );
}
