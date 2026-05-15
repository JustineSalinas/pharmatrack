"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth-client";
import {
  Loader2, User, Lock, Mail, Hash, BookOpen,
  Layers, Save, CheckCircle2, ShieldCheck, AlertCircle,
  TrendingUp, ChevronRight,
} from "lucide-react";

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ full_name: "", email: "", student_id_number: "", section: "", current_year: "" });
  const [passForm, setPassForm] = useState({ newPassword: "", confirmPassword: "" });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"profile" | "security">("profile");

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
              .from("student_attendance_summary").select("*").eq("student_id", u.id).single();
            setStats(data);
          }
        }
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const setF = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const setP = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setPassForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSaveProfile = async () => {
    setSaving(true); setError("");
    try {
      if (!user) return;
      const { error: e1 } = await supabase.from("users").update({ full_name: form.full_name }).eq("id", user.id);
      if (e1) throw e1;
      if (user.account_type === "student" && user.student_profiles?.[0]) {
        const { error: e2 } = await supabase.from("student_profiles")
          .update({ section: form.section, current_year: form.current_year })
          .eq("id", user.student_profiles[0].id);
        if (e2) throw e2;
      }
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch (err: any) { setError(err.message || "Failed to save changes"); }
    finally { setSaving(false); }
  };

  const handleSavePassword = async () => {
    setError("");
    if (passForm.newPassword !== passForm.confirmPassword) { setError("Passwords do not match"); return; }
    if (passForm.newPassword.length < 8) { setError("Password must be at least 8 characters"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: passForm.newPassword });
      if (error) throw error;
      setSaved(true);
      setPassForm({ newPassword: "", confirmPassword: "" });
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) { setError(err.message || "Failed to update password"); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="sp-center-screen"><Loader2 className="sp-spinner" size={36} /></div>;

  const initials = form.full_name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase() || "U";
  const isStudent = user?.account_type === "student";

  return (
    <div className="fade-in sd-root">
      {/* ── Header ── */}
      <header className="sd-header">
        <div>
          <p className="sd-header-eyebrow">Account · Settings</p>
          <h1 className="sd-header-title">My Profile</h1>
        </div>
      </header>

      {/* ── Tab Bar ── */}
      <div className="sp-tab-bar">
        <button className={`sp-tab-btn ${tab === "profile" ? "active" : ""}`} onClick={() => setTab("profile")}>
          <User size={14} /> Account Details
        </button>
        <button className={`sp-tab-btn ${tab === "security" ? "active" : ""}`} onClick={() => setTab("security")}>
          <ShieldCheck size={14} /> Security
        </button>
      </div>

      {/* ── Profile Layout ── */}
      <div className="sp-profile-grid">
        {/* Avatar / Stats Sidebar */}
        <div className="sp-avatar-panel">
          <div className="sp-avatar-circle">{initials}</div>
          <h2 className="sp-avatar-name">{form.full_name || "—"}</h2>
          <p className="sp-avatar-email">{form.email}</p>

          <div className="sp-avatar-tags">
            <span className="sp-avatar-tag sp-tag-gold">
              {user?.account_type ? user.account_type.charAt(0).toUpperCase() + user.account_type.slice(1) : ""}
            </span>
            {isStudent && form.section && <span className="sp-avatar-tag">{form.section}</span>}
            {isStudent && form.current_year && <span className="sp-avatar-tag">{form.current_year}</span>}
          </div>

          {isStudent && stats && (
            <div className="sp-avatar-stats">
              <div className="sp-avatar-stats-title">
                <TrendingUp size={12} /> Attendance Summary
              </div>
              {[
                { label: "Total Events", value: stats.total_records || 0, color: "var(--white-shade)" },
                { label: "Present", value: stats.present_count || 0, color: "var(--success)" },
                { label: "Late", value: stats.late_count || 0, color: "var(--gold)" },
                { label: "Absent", value: stats.absent_count || 0, color: "var(--danger)" },
                { label: "Rate", value: `${stats.attendance_rate || 0}%`, color: stats.attendance_rate >= 75 ? "var(--success)" : "var(--gold)" },
              ].map((s) => (
                <div key={s.label} className="sp-stat-row">
                  <span className="sp-stat-row-label">{s.label}</span>
                  <span className="sp-stat-row-val" style={{ color: s.color }}>{s.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Form Panel */}
        <div className="sp-form-panel">
          {error && (
            <div className="sp-form-error">
              <AlertCircle size={15} /> {error}
            </div>
          )}
          {saved && (
            <div className="sp-form-success">
              <CheckCircle2 size={15} /> {tab === "profile" ? "Profile saved successfully!" : "Password updated!"}
            </div>
          )}

          {tab === "profile" ? (
            <div className="sp-form-body">
              <div className="sp-form-section-title">
                <User size={15} color="var(--gold)" /> Account Details
              </div>

              <div className="sp-input-group">
                <label className="sp-input-label">Full Display Name</label>
                <div className="sp-input-wrap">
                  <User size={15} className="sp-input-icon" />
                  <input className="sp-input" value={form.full_name} onChange={setF("full_name")} placeholder="Enter your full name" />
                </div>
              </div>

              <div className="sp-input-group">
                <label className="sp-input-label">Institutional Email</label>
                <div className="sp-input-wrap">
                  <Mail size={15} className="sp-input-icon" />
                  <input className="sp-input" type="email" value={form.email} disabled style={{ opacity: 0.5 }} />
                </div>
                <p className="sp-input-hint">Email is managed by the institution and cannot be changed.</p>
              </div>

              {isStudent && (
                <>
                  <div className="sp-two-col">
                    <div className="sp-input-group">
                      <label className="sp-input-label">Student ID</label>
                      <div className="sp-input-wrap">
                        <Hash size={15} className="sp-input-icon" />
                        <input className="sp-input" value={form.student_id_number} disabled style={{ opacity: 0.5 }} />
                      </div>
                    </div>
                    <div className="sp-input-group">
                      <label className="sp-input-label">Year Level</label>
                      <div className="sp-input-wrap">
                        <Layers size={15} className="sp-input-icon" />
                        <select className="sp-input sp-select" value={form.current_year} onChange={setF("current_year")}>
                          {["1st Year", "2nd Year", "3rd Year", "4th Year"].map((y) => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="sp-input-group">
                    <label className="sp-input-label">Block / Section</label>
                    <div className="sp-input-wrap">
                      <BookOpen size={15} className="sp-input-icon" />
                      <input className="sp-input" value={form.section} onChange={setF("section")} placeholder="e.g. PharmA" />
                    </div>
                  </div>
                </>
              )}

              <button className="sp-save-btn" onClick={handleSaveProfile} disabled={saving}>
                {saving ? <><Loader2 size={15} className="sp-spinner-sm" /> Saving…</> : saved ? <><CheckCircle2 size={15} /> Saved!</> : <><Save size={15} /> Save Changes</>}
              </button>
            </div>
          ) : (
            <div className="sp-form-body">
              <div className="sp-form-section-title">
                <Lock size={15} color="var(--gold)" /> Change Password
              </div>

              <div className="sp-input-group">
                <label className="sp-input-label">New Password</label>
                <div className="sp-input-wrap">
                  <Lock size={15} className="sp-input-icon" />
                  <input className="sp-input" type="password" placeholder="Min. 8 characters" value={passForm.newPassword} onChange={setP("newPassword")} />
                </div>
              </div>
              <div className="sp-input-group">
                <label className="sp-input-label">Confirm New Password</label>
                <div className="sp-input-wrap">
                  <Lock size={15} className="sp-input-icon" />
                  <input className="sp-input" type="password" placeholder="Repeat new password" value={passForm.confirmPassword} onChange={setP("confirmPassword")} />
                </div>
              </div>

              <div className="sp-security-hint">
                <ShieldCheck size={14} color="var(--teal)" />
                <p>Use at least 8 characters. Changing your password will sign you out of other devices.</p>
              </div>

              <button className="sp-save-btn" onClick={handleSavePassword} disabled={saving}>
                {saving ? <><Loader2 size={15} className="sp-spinner-sm" /> Updating…</> : saved ? <><CheckCircle2 size={15} /> Updated!</> : <><Lock size={15} /> Update Password</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
