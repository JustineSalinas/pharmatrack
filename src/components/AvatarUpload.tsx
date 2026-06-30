"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Camera, Loader2, AlertTriangle } from "lucide-react";

interface AvatarUploadProps {
  userId: string;
  avatarUrl?: string | null;
  initials: string;
  onUploaded: (url: string) => void;
}

export interface AvatarUploadRef {
  triggerUpload: () => void;
}

const AvatarUpload = forwardRef<AvatarUploadRef, AvatarUploadProps>(function AvatarUpload(
  { userId, avatarUrl, initials, onUploaded },
  ref
) {
  const [showWarning, setShowWarning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    triggerUpload: () => {
      if (!uploading) setShowWarning(true);
    },
  }));

  const handleConfirm = () => {
    setShowWarning(false);
    fileRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setUploading(true);

    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userId}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);

      const { error: updateError } = await supabase
        .from("users")
        .update({ avatar_url: data.publicUrl })
        .eq("id", userId);

      if (updateError) throw updateError;

      onUploaded(`${data.publicUrl}?t=${Date.now()}`);
    } catch (err: any) {
      setError(err.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      <div
        className={`sp-avatar-circle sp-avatar-upload-trigger${uploading ? " sp-avatar-uploading" : ""}`}
        onClick={() => !uploading && setShowWarning(true)}
        title="Click to change profile photo"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="Profile" className="sp-avatar-img" />
        ) : (
          <span>{initials}</span>
        )}
        <div className="sp-avatar-overlay">
          {uploading
            ? <Loader2 size={20} className="sp-spinner" />
            : <><Camera size={18} /><span className="sp-avatar-overlay-label">Change Photo</span></>
          }
        </div>
      </div>

      {error && (
        <p className="sp-avatar-upload-error">{error}</p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {showWarning && (
        <div className="sp-modal-backdrop" onClick={() => setShowWarning(false)}>
          <div className="sp-modal-box sp-modal-warning" onClick={(e) => e.stopPropagation()}>
            <div className="sp-modal-warning-header">
              <div className="sp-modal-warning-icon-wrap">
                <AlertTriangle size={18} />
              </div>
              <div>
                <p className="sp-modal-warning-eyebrow">PharmaTrack System Notice</p>
                <h2 className="sp-modal-warning-title">Profile Photo Upload Guidelines</h2>
              </div>
            </div>

            <div className="sp-modal-warning-divider" />

            <p className="sp-modal-warning-intro">
              Before proceeding with a profile photo upload, please carefully review the
              following institutional guidelines. Compliance is required of all system users.
            </p>

            <ol className="sp-modal-warning-list">
              <li>
                <strong>Personal Photograph Only.</strong> Your photo must be a clear, recent
                photograph of yourself taken within the past year. Group photos and non-personal
                images are not permitted.
              </li>
              <li>
                <strong>Professional Presentation.</strong> The image must be appropriate for an
                academic and professional environment. Formal or smart-casual attire is strongly
                encouraged.
              </li>
              <li>
                <strong>Prohibited Content.</strong> Photos containing offensive, inappropriate,
                misleading, or politically sensitive content are strictly prohibited and may
                constitute grounds for disciplinary action in accordance with institutional policy.
              </li>
              <li>
                <strong>Technical Requirements.</strong> The maximum permitted file size is{" "}
                <strong>2 MB</strong>. Accepted file formats: <strong>JPEG, PNG, WebP</strong>.
              </li>
              <li>
                <strong>Visibility & Consent.</strong> By uploading a profile photo, you acknowledge
                that it will be accessible to authorized personnel within the PharmaTrack Attendance
                Management System.
              </li>
            </ol>

            <div className="sp-modal-warning-footer">
              <p className="sp-modal-warning-confirm-text">
                By selecting <em>Proceed</em>, you confirm that your photo fully complies with
                the guidelines stated above.
              </p>
              <div className="sp-modal-warning-actions">
                <button className="sp-modal-cancel-btn" onClick={() => setShowWarning(false)}>
                  Cancel
                </button>
                <button className="sp-modal-confirm-btn" onClick={handleConfirm}>
                  I Understand — Proceed
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

export default AvatarUpload;
