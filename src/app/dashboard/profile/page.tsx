"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth-client";
import { Loader2, User, Lock, Camera, Save, Mail, Hash, BookOpen, Layers } from "lucide-react";

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    student_id_number: "",
    section: "",
    current_year: "",
  });

  const [passForm, setPassForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"profile" | "password">("profile");

  useEffect(() => {
    async function load() {
      try {
        const u = await getCurrentUser();
        if (u) {
          setUser(u);
          const sp = u.student_profiles?.[0] || {};
          setForm({
            full_name: u.full_name || "",
            email: u.email || "",
            student_id_number: sp.student_id_number || "",
            section: sp.section || "",
            current_year: sp.current_year || "",
          });

          if (u.account_type === "student") {
            const { data } = await supabase
              .from("student_attendance_summary")
              .select("*")
              .eq("student_id", u.id)
              .single();
            setStats(data);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const setF = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const setP = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setPassForm(f => ({ ...f, [k]: e.target.value }));

  const handleSaveProfile = async () => {
    setSaving(true);
    setError("");
    try {
      if (!user) return;
      
      const { error: err1 } = await supabase
        .from("users")
        .update({ full_name: form.full_name })
        .eq("id", user.id);
      if (err1) throw err1;

      if (user.account_type === "student" && user.student_profiles?.[0]) {
        const pId = user.student_profiles[0].id;
        const { error: err2 } = await supabase
          .from("student_profiles")
          .update({ section: form.section, current_year: form.current_year })
          .eq("id", pId);
        if (err2) throw err2;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleSavePassword = async () => {
    setError("");
    if (passForm.newPassword !== passForm.confirmPassword) {
      setError("New passwords do not match");
      return;
    }
    if (passForm.newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passForm.newPassword
      });
      if (error) throw error;
      
      setSaved(true);
      setPassForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err.message || "Failed to update password");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
        <Loader2 className="animate-spin" size={48} color="var(--gold)" />
      </div>
    );
  }

  const initials = form.full_name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() || "U";
  const isStudent = user?.account_type === "student";

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: "24px" }}>
        <div>
          <div className="breadcrumb" style={{ fontSize: "0.85rem", color: "var(--muted)", letterSpacing: "0.5px", marginBottom: "4px" }}>
            <span>Account</span><span style={{ margin: "0 6px" }}>·</span><span>Settings</span>
          </div>
          <h2 style={{ fontSize: "2rem", fontWeight: 800, margin: 0, letterSpacing: "-0.5px" }}>My Profile</h2>
        </div>
      </div>

      <div style={{ display: "flex", gap: "12px", marginBottom: "32px" }}>
        <button 
          className={`btn ${tab === "profile" ? "btn-gold" : "btn-outline"}`} 
          style={{ width: "auto", padding: "8px 20px", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "8px" }}
          onClick={() => setTab("profile")}
        >
          <User size={16} /> Account Details
        </button>
        <button 
          className={`btn ${tab === "password" ? "btn-gold" : "btn-outline"}`} 
          style={{ width: "auto", padding: "8px 20px", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "8px" }}
          onClick={() => setTab("password")}
        >
          <Lock size={16} /> Security
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "24px" }}>
        {/* Avatar Panel */}
        <div className="panel" style={{ textAlign: "center", padding: "32px 24px" }}>
          <div className="avatar" style={{ width: "100px", height: "100px", fontSize: "40px", margin: "0 auto 20px", background: "var(--surface2)", border: "2px solid var(--gold-dim)" }}>
            {initials}
          </div>
          <h3 style={{ fontSize: "1.25rem", color: "var(--white)", marginBottom: "4px" }}>{form.full_name}</h3>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: "20px" }}>{form.email}</p>
          
          <div style={{ display: "flex", justifyContent: "center", gap: "8px", flexWrap: "wrap", marginBottom: "24px" }}>
            <span className="tag" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--gold-dim)", color: "var(--gold)" }}>
              {user?.account_type ? user.account_type.charAt(0).toUpperCase() + user.account_type.slice(1) : ""}
            </span>
            {isStudent && <span className="tag" style={{ background: "rgba(255,255,255,0.05)" }}>{form.section}</span>}
            {isStudent && <span className="tag" style={{ background: "rgba(255,255,255,0.05)" }}>{form.current_year}</span>}
          </div>

          <button className="btn btn-outline" style={{ fontSize: "0.85rem", padding: "6px 12px", width: "auto", gap: "6px" }}>
            <Camera size={14} /> Update Photo
          </button>

          {/* Student Stats */}
          {isStudent && stats && (
            <div style={{ marginTop: "32px", borderTop: "1px solid var(--border)", paddingTop: "24px", textAlign: "left" }}>
              <div style={{ fontSize: "0.7rem", color: "var(--muted)", fontWeight: 800, letterSpacing: "2px", marginBottom: "16px", textAlign: "center" }}>STUDENT STATS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Total Events</span>
                  <span style={{ fontWeight: 600 }}>{stats.total_events || 0}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Present</span>
                  <span style={{ fontWeight: 600, color: "var(--success)" }}>{stats.present_count || 0}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Attendance Rate</span>
                  <span style={{ fontWeight: 600, color: "var(--gold)" }}>{stats.attendance_rate || 0}%</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Form Panel */}
        <div className="panel" style={{ padding: "32px" }}>
          {error && (
            <div style={{ color: "var(--danger)", padding: "12px 16px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "12px", marginBottom: "24px", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "10px" }}>
              <Lock size={16} /> {error}
            </div>
          )}

          {tab === "profile" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <h3 style={{ fontSize: "1.1rem", marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}><User size={18} color="var(--gold)" /> Account Details</h3>
              
              <div className="input-group">
                <label>Full Display Name</label>
                <div className="input-wrap">
                  <span className="icon"><User size={18} /></span>
                  <input className="inp" value={form.full_name} onChange={setF("full_name")} placeholder="Enter your full name" />
                </div>
              </div>

              <div className="input-group">
                <label>Institutional Email</label>
                <div className="input-wrap">
                  <span className="icon"><Mail size={18} /></span>
                  <input className="inp" type="email" value={form.email} disabled style={{ opacity: 0.6 }} />
                </div>
                <p style={{ fontSize: "0.75rem", color: "var(--muted)", fontStyle: "italic", marginTop: "4px" }}>Email is managed by the institution and cannot be changed.</p>
              </div>

              {isStudent && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div className="input-group">
                      <label>Student ID</label>
                      <div className="input-wrap">
                        <span className="icon"><Hash size={18} /></span>
                        <input className="inp" value={form.student_id_number} disabled style={{ opacity: 0.6 }} />
                      </div>
                    </div>
                    <div className="input-group">
                      <label>Year Level</label>
                      <div className="input-wrap select-wrap">
                        <span className="icon"><Layers size={18} /></span>
                        <select className="inp" value={form.current_year} onChange={setF("current_year")}>
                          <option value="1st Year">1st Year</option>
                          <option value="2nd Year">2nd Year</option>
                          <option value="3rd Year">3rd Year</option>
                          <option value="4th Year">4th Year</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  
                  <div className="input-group">
                    <label>Block / Section</label>
                    <div className="input-wrap">
                      <span className="icon"><BookOpen size={18} /></span>
                      <input className="inp" value={form.section} onChange={setF("section")} placeholder="e.g. PharmA" />
                    </div>
                  </div>
                </>
              )}

              <button className={`btn btn-gold ${saving ? "opacity-50" : ""}`} style={{ marginTop: "12px", width: "100%", height: "48px", borderRadius: "14px", gap: "10px" }} onClick={handleSaveProfile} disabled={saving}>
                {saving ? "Saving Changes..." : saved ? <><Save size={18} /> Profile Saved!</> : <><Save size={18} /> Save Changes</>}
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <h3 style={{ fontSize: "1.1rem", marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}><Lock size={18} color="var(--gold)" /> Security Settings</h3>
              
              <div className="input-group">
                <label>New Password</label>
                <div className="input-wrap">
                  <span className="icon"><Lock size={18} /></span>
                  <input className="inp" type="password" placeholder="••••••••" value={passForm.newPassword} onChange={setP("newPassword")} />
                </div>
              </div>

              <div className="input-group">
                <label>Confirm New Password</label>
                <div className="input-wrap">
                  <span className="icon"><Lock size={18} /></span>
                  <input className="inp" type="password" placeholder="••••••••" value={passForm.confirmPassword} onChange={setP("confirmPassword")} />
                </div>
              </div>

              <div style={{ padding: "16px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: "12px", fontSize: "0.85rem", color: "var(--muted)", lineHeight: 1.6 }}>
                💡 <strong>Security Hint:</strong> Use at least 8 characters. Changing your password will invalidate existing sessions on other devices for security.
              </div>

              <button className={`btn btn-gold ${saving ? "opacity-50" : ""}`} style={{ marginTop: "12px", width: "100%", height: "48px", borderRadius: "14px" }} onClick={handleSavePassword} disabled={saving}>
                {saving ? "Updating Password..." : saved ? "✅ Password Updated!" : "Update Password"}
              </button>
            </div>
          )}
        </div>
      </div>
      
      <style jsx>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
