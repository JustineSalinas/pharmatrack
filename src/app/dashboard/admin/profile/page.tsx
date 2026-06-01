"use client";

import { useState, useEffect } from "react";
import { getCurrentUser } from "@/lib/auth-client";
import {
  Loader2, User, Mail, Crown, Calendar, Clock, ShieldCheck,
} from "lucide-react";
import ChangePassword from "@/components/ChangePassword";

export default function AdminProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [tab, setTab] = useState<"profile" | "security">("profile");

  const formatDate = (dateStr: string | undefined | null) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

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

  if (loading) return <div className="sp-center-screen"><Loader2 className="sp-spinner" size={36} /></div>;

  if (!user) {
    return (
      <div className="sp-center-screen" style={{ flexDirection: "column", gap: "12px" }}>
        <p style={{ color: "var(--dimmed)" }}>Failed to load profile details.</p>
        <button className="sp-save-btn" style={{ width: "auto", padding: "8px 20px" }} onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

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
          <div className="sp-avatar-circle" style={{ overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface2)", padding: "6px" }}>
            <img src="/usa.png" alt="USA Logo" style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "50%" }} />
          </div>
          <h2 className="sp-avatar-name">{fullName || "—"}</h2>
          <p className="sp-avatar-email">{user?.email}</p>
          <div className="sp-avatar-tags">
            <span className="sp-avatar-tag sp-tag-gold" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <Crown size={11} />Administrator
            </span>
          </div>
        </div>

        <div className="sp-form-panel">
          {tab === "profile" ? (
            <div className="sp-form-body">
              <div className="sp-form-section-title">
                <User size={15} color="var(--gold)" /> Account Details
              </div>

              <div className="sp-input-group">
                <label className="sp-input-label">Full Display Name</label>
                <div className="sp-input-wrap">
                  <User size={15} className="sp-input-icon" />
                  <input className="sp-input" value={fullName} disabled style={{ opacity: 0.5 }} />
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

              <div className="sp-date-info-row">
                <div className="sp-date-info-item">
                  <Calendar size={13} className="sp-date-info-icon" />
                  <span className="sp-date-info-label">Account Created:</span>
                  <span className="sp-date-info-value">{formatDate(user?.created_at)}</span>
                </div>
                <div className="sp-date-info-item">
                  <Clock size={13} className="sp-date-info-icon" />
                  <span className="sp-date-info-label">Last Updated:</span>
                  <span className="sp-date-info-value">{formatDate(user?.updated_at)}</span>
                </div>
              </div>
            </div>
          ) : (
            <ChangePassword />
          )}
        </div>
      </div>
    </div>
  );
}

