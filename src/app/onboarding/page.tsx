"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuthUser, completeOnboarding } from "@/lib/auth-client";

export default function OnboardingPage() {
  const router = useRouter();
  const [role, setRole] = useState<"student" | "facilitator">("student");
  const [studentId, setStudentId] = useState("");
  const [year, setYear] = useState("");
  const [section, setSection] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [authUser, setAuthUser] = useState<any>(null);

  const sectionsByYear: Record<string, string[]> = {
    "1st Year": ["PH 1A", "PH 1B", "PH 1C", "PH 1D", "PH 1E"],
    "2nd Year": ["PH 2A", "PH 2B", "PH 2C", "PH 2D", "PH 2E"],
    "3rd Year": ["PH 3A", "PH 3B", "PH 3C", "PH 3D"],
    "4th Year": ["PH 4A", "PH 4B", "PH 4C", "PH 4D"]
  };

  useEffect(() => {
    async function checkUser() {
      const u = await getAuthUser();
      if (!u) {
        router.push("/login");
        return;
      }
      setAuthUser(u);
    }
    checkUser();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser) return;
    
    setLoading(true);
    setError("");

    try {
      const fullName = authUser.user_metadata?.full_name || authUser.email?.split("@")[0] || "User";
      
      await completeOnboarding(
        authUser.id,
        authUser.email,
        fullName,
        role,
        role === "student" ? { studentId, section, year } : undefined
      );

      // Redirect based on role
      if (role === "student") {
        router.push("/dashboard");
      } else {
        router.push("/dashboard/facilitator");
      }
    } catch (err: any) {
      setError(err.message || "Failed to complete profile.");
      setLoading(false);
    }
  };

  if (!authUser) return <div style={{ minHeight: "100vh", backgroundColor: "var(--bg)" }}></div>;

  return (
    <>
      <div className="animated-bg darker">
        <div className="blob blob-1 darker"></div>
        <div className="blob blob-2 darker"></div>
        <div className="blob blob-3 darker"></div>
      </div>

      <div className="auth-page fade-in">
        <div className="auth-card">
          <div className="auth-header">
            <h2 style={{ fontSize: "1.8rem" }}>Complete Your Profile</h2>
            <p>You&apos;re almost there! We just need a few more details to set up your account.</p>
          </div>

          <div className="role-toggle" style={{ marginBottom: "20px" }}>
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

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="input-group">
              <label>Email</label>
              <input type="email" className="input-field" value={authUser.email} disabled style={{ opacity: 0.7, cursor: "not-allowed" }} />
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
                      required
                      disabled={!year}
                      style={{ appearance: 'none' }}
                    >
                      <option value="" disabled>Select Section</option>
                      {year && sectionsByYear[year]?.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              className="btn btn-gold pulse-btn"
              style={{ width: "100%", padding: "16px", marginTop: "10px", fontSize: "1.1rem", border: "none" }}
              disabled={loading}
            >
              {loading ? "Saving..." : "Complete Setup"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
