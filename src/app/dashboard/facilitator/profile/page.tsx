"use client";

import { useState, useEffect } from "react";
import { getCurrentUser } from "@/lib/auth-client";
import {
  Loader2, User, Mail, Building2,
  ShieldCheck, Calendar, Clock,
} from "lucide-react";
import ChangePassword from "@/components/ChangePassword";

export default function FacilitatorProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"profile" | "security">("profile");

  useEffect(() => {
    async function load() {
      try {
        const u = await getCurrentUser();
        if (u) setUser(u);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const formatDate = (dateStr: string | undefined | null) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  if (loading) return <div className="sp-center-screen"><Loader2 className="sp-spinner" size={36} /></div>;

  const fullName = user?.full_name || "—";
  const initials = fullName.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase() || "F";
  const department = user?.facilitator_profiles?.department || "Pharmacy";

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
          <h2 className="sp-avatar-name">{fullName}</h2>
          <p className="sp-avatar-email">{user?.email}</p>
          <div className="sp-avatar-tags">
            <span className="sp-avatar-tag sp-tag-gold">Facilitator</span>
            <span className="sp-avatar-tag sp-tag-active">
              <span className="sp-active-dot"></span>
              Active
            </span>
            <span className="sp-avatar-tag sp-tag-purple">{department}</span>
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

              <div className="sp-input-group">
                <label className="sp-input-label">Department</label>
                <div className="sp-input-wrap">
                  <Building2 size={15} className="sp-input-icon" />
                  <input className="sp-input" value={department} disabled style={{ opacity: 0.5 }} />
                </div>
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
