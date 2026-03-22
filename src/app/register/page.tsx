"use client";

import { registerStudent, registerAdmin } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<"student" | "admin">("student");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [studentId, setStudentId] = useState("");
  const [year, setYear] = useState("");
  const [section, setSection] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const sectionsByYear: Record<string, string[]> = {
    "1st Year": ["PH 1A", "PH 1B", "PH 1C", "PH 1D", "PH 1E"],
    "2nd Year": ["PH 2A", "PH 2B", "PH 2C", "PH 2D", "PH 2E"],
    "3rd Year": ["PH 3A", "PH 3B", "PH 3C", "PH 3D"],
    "4th Year": ["PH 4A", "PH 4B", "PH 4C", "PH 4D"]
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      if (role === "admin") {
        await registerAdmin({
          full_name: fullName,
          email,
          password,
          confirm_password: confirmPassword,
          account_type: "admin"
        });
        setIsPending(true);
      } else {
        await registerStudent({
          full_name: fullName,
          email,
          password,
          confirm_password: confirmPassword,
          account_type: "student",
          student_id_number: studentId,
          section: section,
          current_year: year
        });
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
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
          {isPending ? (
            <>
              <h2 style={{ color: "#FBBF24" }}>Pending Approval</h2>
              <p>Your Admin account has been created successfully.</p>
            </>
          ) : (
            <>
              <h2>Create Account</h2>
              <p>Register for your secure University profile.</p>
            </>
          )}
        </div>

        {isPending ? (
          <div className="pending-box fade-in" style={{ textAlign: "center", padding: "20px 0" }}>
            <div className="pending-icon" style={{ fontSize: "3rem", marginBottom: "15px" }}>⏳</div>
            <p style={{ color: "var(--white)", marginBottom: "20px", lineHeight: "1.6" }}>
              To maintain security, all Admin profiles must be verified by the <strong>Department Head</strong> before access is granted.
            </p>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9rem", marginBottom: "30px" }}>
              You will receive an email notification once your account has been approved.
            </p>
            <Link href="/login" className="btn btn-gold" style={{ display: "inline-block", width: "100%", textDecoration: "none" }}>
              Return to Login
            </Link>
          </div>
        ) : (
          <>
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

            {error && (
              <div style={{ backgroundColor: "rgba(239, 68, 68, 0.2)", color: "#fca5a5", padding: "12px", borderRadius: "8px", marginBottom: "20px", textAlign: "center", fontSize: "0.9rem", border: "1px solid rgba(239, 68, 68, 0.3)" }}>
                {error}
              </div>
            )}

            <form className="auth-form" onSubmit={handleRegister}>
              <div className="input-group">
                <label>Full Name</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Juan Dela Cruz" 
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required 
                />
              </div>
              
              <div className="input-group">
                <label>USA Email</label>
                <input 
                  type="email" 
                  className="input-field" 
                  placeholder="juan@usa.edu.ph" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                />
              </div>

              {role === "student" && (
                <>
                  <div className="input-group">
                    <label>Student ID Number</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="USA-2026-0001" 
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      required 
                    />
                  </div>
                  <div className="two-col-grid">
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
                <input 
                  type="password" 
                  className="input-field" 
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                />
              </div>

              <div className="input-group">
                <label>Confirm Password</label>
                <input 
                  type="password" 
                  className="input-field" 
                  placeholder="••••••••" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required 
                />
              </div>
              
              <button 
                type="submit" 
                className={`btn btn-gold pulse-btn ${loading ? 'opacity-50' : ''}`} 
                style={{ width: "100%", padding: "16px", marginTop: "10px", fontSize: "1.1rem" }}
                disabled={loading}
              >
                {loading ? "Creating Account..." : `Create ${role === "student" ? "Student" : "Admin"} Account`}
              </button>
            </form>

            <div className="auth-footer">
              Already have an account? <Link href="/login" className="auth-link">Log In</Link>
            </div>
          </>
        )}
      </div>
    </div>
    </>
  );
}
