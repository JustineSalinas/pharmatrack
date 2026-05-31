"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth-client";
import {
  Loader2, User, Mail, Save, CheckCircle2,
  ShieldCheck, AlertCircle, Crown,
} from "lucide-react";
import ChangePassword from "@/components/ChangePassword";

export default function AdminProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
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
          setFullName(u.full_name || "");
        }
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const handleSaveProfile = async () => {
    setSaving(true); setError("");
    try {
      if (!user) return;
      const { error: e1 } = await supabase.from("users").update({ full_name: fullName }).eq("id", user.id);
      if (e1) throw e1;
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch (err: any) { setError(err.message || "Failed to save changes"); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="sp-center-screen"><Loader2 className="sp-spinner" size={36} /></div>;

  const initials = fullName.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase() || "A";

  return (
    <div className="fade-in sd-root">
      <header className="sd-header">
        <div>
          <p className="sd-header-eyebrow">Account · Settings</p>
          <h1 className="sd-header-title">My Profile</h1>
        </div>
      </header>

      <div className="sp-tab-bar">
        <button className={`sp-tab-btn ${tab === "profile" ? "active" : ""}`} onClick={() => setTab("profile")}>
          <User size={14} /> Account Details
        </button>
        <button className={`sp-tab-btn ${tab === "security" ? "active" : ""}`} onClick={() => setTab("security")}>
          <ShieldCheck size={14} /> Security
        </button>
      </div>

      <div className="sp-profile-grid">
        <div className="sp-avatar-panel">
          <div className="sp-avatar-circle">{initials}</div>
          <h2 className="sp-avatar-name">{fullName || "—"}</h2>
          <p className="sp-avatar-email">{user?.email}</p>
          <div className="sp-avatar-tags">
            <span className="sp-avatar-tag sp-tag-gold"><Crown size={11} style={{ marginRight: 4, verticalAlign: "middle" }} />Administrator</span>
          </div>
        </div>

        <div className="sp-form-panel">
          {tab === "profile" ? (
            <div className="sp-form-body">
              {error && <div className="sp-form-error"><AlertCircle size={15} /> {error}</div>}
              {saved && <div className="sp-form-success"><CheckCircle2 size={15} /> Profile saved successfully!</div>}

              <div className="sp-form-section-title">
                <User size={15} color="var(--gold)" /> Account Details
              </div>

              <div className="sp-input-group">
                <label className="sp-input-label">Full Display Name</label>
                <div className="sp-input-wrap">
                  <User size={15} className="sp-input-icon" />
                  <input className="sp-input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Enter your full name" />
                </div>
              </div>

              <div className="sp-input-group">
                <label className="sp-input-label">Institutional Email</label>
                <div className="sp-input-wrap">
                  <Mail size={15} className="sp-input-icon" />
                  <input className="sp-input" type="email" value={user?.email || ""} disabled style={{ opacity: 0.5 }} />
                </div>
                <p className="sp-input-hint">Email is managed by the institution and cannot be changed.</p>
              </div>

              <button className="sp-save-btn" onClick={handleSaveProfile} disabled={saving}>
                {saving ? <><Loader2 size={15} className="sp-spinner-sm" /> Saving…</> : saved ? <><CheckCircle2 size={15} /> Saved!</> : <><Save size={15} /> Save Changes</>}
              </button>
            </div>
          ) : (
            <ChangePassword />
          )}
        </div>
      </div>
    </div>
  );
}
