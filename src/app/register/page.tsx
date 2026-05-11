"use client";

import { registerStudent, registerFacilitator } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { Mail } from "lucide-react";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Post-registration states
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [registeredRole, setRegisteredRole] = useState<"student" | "facilitator">("student");

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
      }
      setRegisteredRole(role);
      setRegistrationComplete(true);
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
          {registrationComplete ? (
            /* ========== EMAIL VERIFICATION SCREEN ========== */
            <>
              <div className="auth-header">
                <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
                  <img src="/usa.png" alt="University Logo" style={{ height: "85px", objectFit: "contain", filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.5))" }} />
                </div>
                <h2 style={{ color: "#4ADE80", fontSize: "clamp(1.3rem, 5vw, 1.8rem)", lineHeight: 1.2 }}>Account Created!</h2>
              </div>

              <div className="fade-in" style={{ textAlign: "center", padding: "10px 0 20px" }}>
                {/* Email icon */}
                <div style={{
                  width: "90px", height: "90px", borderRadius: "50%",
                  background: "rgba(74, 222, 128, 0.08)", border: "2px solid rgba(74, 222, 128, 0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 24px"
                }}>
                  <Mail size={40} color="#4ADE80" strokeWidth={1.5} />
                </div>

                <h3 style={{ color: "var(--white)", fontSize: "1.15rem", fontWeight: 700, marginBottom: "12px" }}>
                  Verify Your Email
                </h3>

                <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.9rem", lineHeight: "1.6", marginBottom: "8px" }}>
                  We&apos;ve sent a verification link to:
                </p>
                <p style={{
                  color: "var(--gold)", fontWeight: 700, fontSize: "1rem",
                  background: "rgba(251, 191, 36, 0.08)", padding: "10px 16px",
                  borderRadius: "10px", border: "1px solid rgba(251, 191, 36, 0.15)",
                  marginBottom: "20px", wordBreak: "break-all"
                }}>
                  {email}
                </p>

                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.85rem", lineHeight: "1.6", marginBottom: "8px" }}>
                  Please check your inbox and click the verification link to activate your account.
                </p>

                {registeredRole === "facilitator" && (
                  <div style={{
                    background: "rgba(251, 191, 36, 0.08)",
                    border: "1px solid rgba(251, 191, 36, 0.2)",
                    borderRadius: "10px",
                    padding: "14px",
                    marginTop: "16px",
                    marginBottom: "8px"
                  }}>
                    <p style={{ color: "var(--gold)", fontSize: "0.85rem", fontWeight: 600, marginBottom: "4px" }}>
                      ⚠ Facilitator Accounts Require Approval
                    </p>
                    <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.8rem", lineHeight: "1.5" }}>
                      After verifying your email, the System Administrator must approve your account before you can access the portal.
                    </p>
                  </div>
                )}

                <div style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  padding: "12px",
                  marginTop: "16px",
                  marginBottom: "24px"
                }}>
                  <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.78rem", lineHeight: "1.5" }}>
                    💡 Didn&apos;t receive the email? Check your spam folder. The link expires in 24 hours.
                  </p>
                </div>

                <Link
                  href="/login"
                  className="btn btn-gold"
                  style={{ width: "100%", display: "block", padding: "14px", fontSize: "1rem", textDecoration: "none", textAlign: "center" }}
                >
                  Go to Login
                </Link>
              </div>
            </>
          ) : (
            /* ========== REGISTRATION FORM ========== */
            <>
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
                    <div className="two-col-grid">
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
