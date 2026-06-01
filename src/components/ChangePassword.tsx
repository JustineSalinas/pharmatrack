"use client";

import { useState } from "react";
import { Lock, ShieldCheck, CheckCircle2, AlertCircle, Loader2, Eye, EyeOff, Pencil, X, Save } from "lucide-react";
import { updatePassword } from "@/lib/auth-client";

/**
 * Shared change-password card. Used in the Security tab of every role's
 * profile/settings page so the behaviour stays identical everywhere.
 */
export default function ChangePassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const handleSave = async () => {
    setError("");
    if (newPassword.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match"); return; }
    setSaving(true);
    try {
      await updatePassword(newPassword);
      setSaved(true);
      setNewPassword("");
      setConfirmPassword("");
      setEditing(false);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setError(err.message || "Failed to update password");
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setNewPassword("");
    setConfirmPassword("");
    setEditing(false);
    setError("");
  };

  return (
    <div className="sp-form-body">
      <div className="sp-form-section-header">
        <div className="sp-form-section-title">
          <Lock size={15} color="var(--gold)" /> Change Password
        </div>
        <div className="sp-form-header-actions">
          {!editing ? (
            <button className="sp-edit-btn" onClick={() => setEditing(true)}>
              <Pencil size={13} />
              <span>Edit</span>
            </button>
          ) : (
            <>
              <button className="sp-discard-btn" onClick={handleDiscard} disabled={saving}>
                <X size={13} />
                <span>Discard</span>
              </button>
              <button className="sp-save-btn-sm" onClick={handleSave} disabled={saving} style={{ color: "#ffffff" }}>
                {saving ? (
                  <span style={{ color: "#ffffff", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                    <Loader2 size={13} className="sp-spinner-sm" /> Updating…
                  </span>
                ) : saved ? (
                  <span style={{ color: "#ffffff", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                    <CheckCircle2 size={13} /> Updated!
                  </span>
                ) : (
                  <span style={{ color: "#ffffff", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                    <Save size={13} style={{ stroke: "#ffffff" }} /> Save Changes
                  </span>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="sp-form-error">
          <AlertCircle size={15} /> {error}
        </div>
      )}
      {saved && (
        <div className="sp-form-success">
          <CheckCircle2 size={15} /> Password updated!
        </div>
      )}

      <div className="sp-input-group">
        <label className="sp-input-label">New Password</label>
        <div className="sp-input-wrap">
          <Lock size={15} className="sp-input-icon" />
          <input
            className="sp-input"
            type={show ? "text" : "password"}
            placeholder="Min. 8 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={!editing}
            style={!editing ? { opacity: 0.5, paddingRight: "40px" } : { paddingRight: "40px" }}
          />
          <button type="button" onClick={() => setShow(!show)}
            style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 0, display: "flex" }}>
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <div className="sp-input-group">
        <label className="sp-input-label">Confirm New Password</label>
        <div className="sp-input-wrap">
          <Lock size={15} className="sp-input-icon" />
          <input
            className="sp-input"
            type={show ? "text" : "password"}
            placeholder="Repeat new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={!editing}
            style={!editing ? { opacity: 0.5 } : {}}
          />
        </div>
      </div>

      <div className="sp-security-hint">
        <ShieldCheck size={14} color="var(--teal)" />
        <p>Use at least 8 characters. Changing your password will sign you out of other devices.</p>
      </div>
    </div>
  );
}
