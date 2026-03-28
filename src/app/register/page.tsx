"use client";

import { registerStudent, registerFacilitator, registerAdmin } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<"student" | "facilitator">("student");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [studentId, setStudentId] = useState("");
  const [year, setYear] = useState("");
  const [section, setSection] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Auto-redirect countdown after successful student registration
  useEffect(() => {
    if (!isSuccess) return;
    if (countdown <= 0) {
      router.push("/login");
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [isSuccess, countdown, router]);

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
      if (role === "facilitator") {
        await registerFacilitator({
          full_name: fullName,
          email,
          password,
          confirm_password: confirmPassword,
          account_type: "facilitator"
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
        setIsSuccess(true);
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
                <p>Your Facilitator account has been created successfully.</p>
              </>
            ) : isSuccess ? (
              <>
                <h2 style={{ color: "#4ADE80" }}>Account Created!</h2>
                <p>Redirecting you to login...</p>
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
                To maintain security, all Facilitator profiles must be verified by the <strong>Admin</strong> before access is granted.
              </p>
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9rem", marginBottom: "30px" }}>
                You will receive an email notification once your account has been approved.
              </p>
              <Link href="/login" className="btn btn-gold" style={{ display: "inline-block", width: "100%", textDecoration: "none" }}>
                Return to Login
              </Link>
            </div>
          ) : isSuccess ? (
            <div className="congratulations-screen fade-in">
              <div className="confetti-container">
                {[...Array(20)].map((_, i) => (
                  <div key={i} className="confetti-piece" style={{
                    left: `${Math.random() * 100}%`,
                    backgroundColor: ['#FFD700', '#4ADE80', '#38BDF8', '#F472B6'][Math.floor(Math.random() * 4)],
                    animationDelay: `${Math.random() * 3}s`,
                    width: `${Math.random() * 10 + 5}px`,
                    height: `${Math.random() * 15 + 10}px`
                  }} />
                ))}
              </div>

              <div className="success-icon-wrapper">
                <div className="success-icon pulse-success">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
              </div>

              <div className="success-content fadeInUp">
                <h2 className="congrats-title">Congratulations!</h2>
                <p className="welcome-msg">Welcome to PharmaTrack, <span className="highlight">{fullName || "User"}</span>!</p>
                
                <div className="status-badge" style={{ display: 'inline-block', backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '8px 20px', borderRadius: '99px', fontSize: '0.85rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.6)', marginBottom: '40px' }}>
                  {role === "facilitator" ? "Role: Facilitator (Pending Approval)" : "Role: Student Account Active"}
                </div>

                <div className="redirect-info">
                  <p>Establishing your secure connection...</p>
                  <div className="progress-bar-container">
                    <div className="progress-bar-fill" style={{ width: `${(3 - countdown) * 33.33}%` }}></div>
                  </div>
                  <p className="countdown-text">Redirecting to Login in <strong>{countdown}s</strong></p>
                </div>

                <Link href="/login" className="btn btn-gold glass-btn" style={{ width: "100%", marginTop: "20px" }}>
                  Go to Login Now
                </Link>
              </div>
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
                  className={`role-btn ${role === "facilitator" ? "active" : ""}`}
                  onClick={() => setRole("facilitator")}
                >
                  Facilitator
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
                    placeholder="name@usa.edu.ph" 
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
                    <div className="two-col-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                      <div className="input-group">
                        <label>Current Year</label>
                        <select 
                          className="input-field select-field" 
                          value={year} 
                          onChange={(e) => { setYear(e.target.value); setSection(""); }}
                          required
                          style={{ appearance: 'none' }}
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
                          style={{ appearance: 'none' }}
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
                  {loading ? "Creating Account..." : `Create ${role === "student" ? "Student" : "Facilitator"} Account`}
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
