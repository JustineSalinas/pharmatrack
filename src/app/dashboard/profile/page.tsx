"use client";
import { useState } from "react";

export default function ProfilePage() {
  const [form, setForm] = useState({
    full_name: "Juan Dela Cruz",
    email: "j.delacruz@usa.edu.ph",
    student_id: "2026-12345",
    section: "PharmA",
    year: "2nd Year",
    phone: "+63 912 345 6789",
  });
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<"profile" | "password">("profile");

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb"><span>Student</span><span>›</span><span>Profile</span></div>
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
          <div className="avatar" style={{ width: 80, height: 80, fontSize: 32, margin: "0 auto 14px" }}>JD</div>
          <strong style={{ fontSize: 17 }}>Juan Dela Cruz</strong>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>2026-12345</p>
          <div style={{ marginTop: 12, display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
            <span className="tag">PharmA</span>
            <span className="tag">2nd Year</span>
            <span className="tag">Student</span>
          </div>
          <button className="btn btn-outline" style={{ marginTop: 16, fontSize: 13 }}>📷 Change Photo</button>

          {/* Attendance summary */}
          <div style={{ marginTop: 24, borderTop: "1px solid var(--border)", paddingTop: 20 }}>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12, fontWeight: 700, letterSpacing: "0.06em" }}>SEMESTER STATS</div>
            {[["Classes", "48"], ["Present", "43"], ["Rate", "89.6%"]].map(([l, v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <span style={{ color: "var(--muted)" }}>{l}</span>
                <strong>{v}</strong>
              </div>
            ))}
          </div>
        </div>

        {/* Form panel */}
        <div className="panel">
          {tab === "profile" ? (
            <>
              <h3 style={{ marginBottom: 20 }}>Account Details</h3>
              <div className="input-group">
                <label>Full Name</label>
                <div className="input-wrap"><span className="icon">👤</span>
                  <input className="inp" value={form.full_name} onChange={set("full_name")} />
                </div>
              </div>
              <div className="input-group">
                <label>Email Address</label>
                <div className="input-wrap"><span className="icon">✉️</span>
                  <input className="inp" type="email" value={form.email} onChange={set("email")} />
                </div>
              </div>
              <div className="input-group">
                <label>Phone Number</label>
                <div className="input-wrap"><span className="icon">📱</span>
                  <input className="inp" type="tel" value={form.phone} onChange={set("phone")} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="input-group">
                  <label>Student ID</label>
                  <div className="input-wrap"><span className="icon">🪪</span>
                    <input className="inp" value={form.student_id} disabled style={{ opacity: 0.5 }} />
                  </div>
                </div>
                <div className="input-group">
                  <label>Current Year</label>
                  <div className="input-wrap select-wrap">
                    <select className="inp" value={form.year} onChange={set("year")}>
                      {["1st Year", "2nd Year", "3rd Year", "4th Year"].map(y => <option key={y}>{y}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="input-group">
                <label>Section</label>
                <div className="input-wrap select-wrap">
                  <select className="inp" value={form.section} onChange={set("section")}>
                    {["PharmA", "PharmB", "PharmC"].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <button className="btn btn-gold" onClick={handleSave}>
                {saved ? "✅ Saved!" : "💾 Save Changes"}
              </button>
            </>
          ) : (
            <>
              <h3 style={{ marginBottom: 20 }}>Change Password</h3>
              <div className="input-group">
                <label>Current Password</label>
                <div className="input-wrap"><span className="icon">🔒</span>
                  <input className="inp" type="password" placeholder="••••••••" />
                </div>
              </div>
              <div className="input-group">
                <label>New Password</label>
                <div className="input-wrap"><span className="icon">🔑</span>
                  <input className="inp" type="password" placeholder="••••••••" />
                </div>
              </div>
              <div className="input-group">
                <label>Confirm New Password</label>
                <div className="input-wrap"><span className="icon">🔑</span>
                  <input className="inp" type="password" placeholder="••••••••" />
                </div>
              </div>
              <div style={{ padding: "12px 14px", background: "var(--surface)", borderRadius: "var(--radius-sm)", fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>
                🔐 Password must be at least 8 characters and include a number and a symbol.
              </div>
              <button className="btn btn-gold" onClick={handleSave}>
                {saved ? "✅ Updated!" : "Update Password"}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
