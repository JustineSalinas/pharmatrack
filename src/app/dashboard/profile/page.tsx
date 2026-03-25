"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth-client";
import { Loader2 } from "lucide-react";

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
    return <div style={{ display: "flex", justifyContent: "center", padding: "100px" }}><Loader2 className="animate-spin" size={48} color="var(--gold)" /></div>;
  }

  const initials = form.full_name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() || "U";
  const isStudent = user?.account_type === "student";

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="breadcrumb"><span>Dashboard</span><span>›</span><span>Profile</span></div>
          <h2>My Profile</h2>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {(["profile", "password"] as const).map((t) => (
          <button key={t} className={`btn ${tab === t ? "btn-gold" : "btn-outline"}`} style={{ width: "auto", padding: "7px 18px", fontSize: 13 }} onClick={() => setTab(t)}>
            {t === "profile" ? "👤 Account Details" : "🔒 Change Password"}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 20 }}>
        {/* Avatar panel */}
        <div className="panel" style={{ textAlign: "center" }}>
          <div className="avatar" style={{ width: 80, height: 80, fontSize: 32, margin: "0 auto 14px" }}>{initials}</div>
          <strong style={{ fontSize: 17 }}>{form.full_name}</strong>
          {isStudent && <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>{form.student_id_number}</p>}
          
          <div style={{ marginTop: 12, display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
            {isStudent && <span className="tag">{form.section}</span>}
            {isStudent && <span className="tag">{form.current_year}</span>}
            <span className="tag" style={{ background: "rgba(255,255,255,0.1)", color: "var(--white)" }}>
              {user?.account_type ? user.account_type.charAt(0).toUpperCase() + user.account_type.slice(1) : ""}
            </span>
          </div>

          {/* Attendance summary (Students only) */}
          {isStudent && stats && (
            <div style={{ marginTop: 24, borderTop: "1px solid var(--border)", paddingTop: 20 }}>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12, fontWeight: 700, letterSpacing: "0.06em" }}>SEMESTER STATS</div>
              {[
                ["Total Events", stats.total_events || 0], 
                ["Present", stats.present_count || 0], 
                ["Rate", `${stats.attendance_rate || 0}%`]
              ].map(([l, v]) => (
                <div key={l as string} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <span style={{ color: "var(--muted)" }}>{l as string}</span>
                  <strong>{v}</strong>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Form panel */}
        <div className="panel">
          {error && <div style={{ color: "var(--danger)", padding: "10px", backgroundColor: "rgba(239, 68, 68, 0.1)", borderRadius: "8px", marginBottom: "20px", fontSize: "0.9rem" }}>{error}</div>}
          
          {tab === "profile" ? (
            <>
              <h3 style={{ marginBottom: 20 }}>Account Details</h3>
              <div className="input-group">
                <label>Full Name</label>
                <div className="input-wrap"><span className="icon">👤</span>
                  <input className="inp" value={form.full_name} onChange={setF("full_name")} />
                </div>
              </div>
              
              <div className="input-group">
                <label>Email Address</label>
                <div className="input-wrap"><span className="icon">✉️</span>
                  <input className="inp" type="email" value={form.email} disabled style={{ opacity: 0.5 }} />
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "4px" }}>Email cannot be changed online. Contact admin.</div>
              </div>

              {isStudent && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div className="input-group">
                      <label>Student ID Number</label>
                      <div className="input-wrap"><span className="icon">🪪</span>
                        <input className="inp" value={form.student_id_number} disabled style={{ opacity: 0.5 }} />
                      </div>
                    </div>
                    <div className="input-group">
                      <label>Current Year</label>
                      <div className="input-wrap select-wrap">
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
                    <label>Section</label>
                    <div className="input-wrap select-wrap">
                      <input className="inp" value={form.section} onChange={setF("section")} placeholder="e.g. PharmA" />
                    </div>
                  </div>
                </>
              )}

              <button className={`btn btn-gold ${saving ? "opacity-50" : ""}`} onClick={handleSaveProfile} disabled={saving}>
                {saving ? "Saving..." : saved ? "✅ Saved!" : "💾 Save Changes"}
              </button>
            </>
          ) : (
            <>
              <h3 style={{ marginBottom: 20 }}>Change Password</h3>
              <div className="input-group">
                <label>New Password</label>
                <div className="input-wrap"><span className="icon">🔑</span>
                  <input className="inp" type="password" placeholder="••••••••" value={passForm.newPassword} onChange={setP("newPassword")} />
                </div>
              </div>
              <div className="input-group">
                <label>Confirm New Password</label>
                <div className="input-wrap"><span className="icon">🔑</span>
                  <input className="inp" type="password" placeholder="••••••••" value={passForm.confirmPassword} onChange={setP("confirmPassword")} />
                </div>
              </div>
              <div style={{ padding: "12px 14px", background: "var(--surface)", borderRadius: "var(--radius-sm)", fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>
                🔐 Password must be at least 8 characters. You will be logged out on other devices.
              </div>
              <button className={`btn btn-gold ${saving ? "opacity-50" : ""}`} onClick={handleSavePassword} disabled={saving}>
                {saving ? "Updating..." : saved ? "✅ Updated!" : "Update Password"}
              </button>
            </>
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
