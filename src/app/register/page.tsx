"use client";

import Link from "next/link";
import { useState } from "react";

export default function RegisterPage() {
  const [role, setRole] = useState<"student" | "admin">("student");
  const [year, setYear] = useState("");
  const [section, setSection] = useState("");

  const sectionsByYear: Record<string, string[]> = {
    "1st Year": ["PH 1A", "PH 1B", "PH 1C", "PH 1D", "PH 1E"],
    "2nd Year": ["PH 2A", "PH 2B", "PH 2C", "PH 2D", "PH 2E"],
    "3rd Year": ["PH 3A", "PH 3B", "PH 3C", "PH 3D"],
    "4th Year": ["PH 4A", "PH 4B", "PH 4C", "PH 4D"]
  };

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
             <img src="/usa.png" alt="University Logo" style={{ height: "85px", objectFit: "contain", filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.5))" }} />
          </div>
          <h2>Create Account</h2>
          <p>Register for your secure University profile.</p>
        </div>

        {/* ROLE TOGGLE */}
        <div className="role-toggle">
          <button 
            type="button"
            className={`role-btn ${role === "student" ? "active" : ""}`}
            onClick={() => setRole("student")}
          >
            Student
          </button>
          <button 
            type="button"
            className={`role-btn ${role === "admin" ? "active" : ""}`}
            onClick={() => setRole("admin")}
          >
            Admin
          </button>
        </div>

        <form className="auth-form" onSubmit={(e) => e.preventDefault()}>
          <div className="input-group">
            <label>Full Name</label>
            <input type="text" className="input-field" placeholder="Juan Dela Cruz" required />
          </div>
          
          <div className="input-group">
            <label>USA Email</label>
            <input type="email" className="input-field" placeholder="juan@usa.edu.ph" required />
          </div>

          {role === "student" && (
            <>
              <div className="input-group">
                <label>Student ID Number</label>
                <input type="text" className="input-field" placeholder="USA-2026-0001" required />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div className="input-group">
                  <label>Current Year</label>
                  <select 
                    className="input-field select-field" 
                    value={year} 
                    onChange={(e) => { setYear(e.target.value); setSection(""); }}
                    required
                  >
                    <option value="" disabled>Select Year</option>
                    {Object.keys(sectionsByYear).map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label>Section</label>
                  <select 
                    className="input-field select-field" 
                    value={section} 
                    onChange={(e) => setSection(e.target.value)}
                    disabled={!year}
                    required
                  >
                    <option value="" disabled>Select Section</option>
                    {year && sectionsByYear[year].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          <div className="input-group">
            <label>Password</label>
            <input type="password" className="input-field" placeholder="••••••••" required />
          </div>

          <div className="input-group">
            <label>Confirm Password</label>
            <input type="password" className="input-field" placeholder="••••••••" required />
          </div>
          
          <Link href="/dashboard" className="btn btn-gold pulse-btn" style={{ width: "100%", padding: "16px", marginTop: "10px", fontSize: "1.1rem", textDecoration: "none" }}>
            Create {role === "student" ? "Student" : "Admin"} Account
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
