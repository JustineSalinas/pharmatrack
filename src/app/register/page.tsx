"use client";

import Link from "next/link";

export default function RegisterPage() {
  return (
    <>
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
             <img src="/pham-logo.png" alt="Pharmacy Logo" style={{ height: "60px", objectFit: "contain", filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.5))" }} />
          </div>
          <h2>Create Account</h2>
          <p>Register for your secure University profile.</p>
        </div>

        <form className="auth-form" onSubmit={(e) => e.preventDefault()}>
          <div className="input-group">
            <label>Full Name</label>
            <input type="text" className="input-field" placeholder="Juan Dela Cruz" required />
          </div>
          <div className="input-group">
            <label>Student / Faculty ID</label>
            <input type="text" className="input-field" placeholder="USA-2026-0001" required />
          </div>
          <div className="input-group">
            <label>Official Email</label>
            <input type="email" className="input-field" placeholder="juan@usa.edu.ph" required />
          </div>
          <div className="input-group">
            <label>Password</label>
            <input type="password" className="input-field" placeholder="Create a strong password" required />
          </div>
          
          <Link href="/dashboard" className="btn btn-gold pulse-btn" style={{ width: "100%", padding: "16px", marginTop: "10px", fontSize: "1.1rem", textDecoration: "none" }}>
            Register Securely
          </Link>
        </form>

        <div className="auth-footer">
          Already have an account? <Link href="/login" className="auth-link">Log In</Link>
        </div>
      </div>
    </div>
    </>
  );
}
