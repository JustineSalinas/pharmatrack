"use client";
import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Loader2, AlertCircle } from "lucide-react";

interface ScannerProps {
  /** Called with the decoded QR text (an event/session code). */
  onSuccess: (code: string) => void;
}

const READER_ID = "student-qr-reader";

/**
 * Real camera QR scanner for the student self check-in modal. Uses
 * html5-qrcode to read an event/session QR code and hands the decoded text to
 * `onSuccess`. If the camera can't start (permission denied, no device), it
 * falls back to a manual code entry so students can still check in.
 */
export default function Scanner({ onSuccess }: ScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);
  const [status, setStatus] = useState<"starting" | "scanning" | "error">("starting");
  const [manualCode, setManualCode] = useState("");

  useEffect(() => {
    let cancelled = false;
    const qr = new Html5Qrcode(READER_ID, /* verbose */ false);
    scannerRef.current = qr;

    // Safety net: if the camera never comes up (device busy, slow hardware, a
    // getUserMedia call that hangs without resolving), fall back to manual
    // entry after 12s instead of leaving the student stuck on "Starting…".
    const timeout = setTimeout(() => {
      if (!cancelled) {
        setStatus((s) => (s === "starting" ? "error" : s));
      }
    }, 12000);

    qr.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: (w, h) => {
          const size = Math.min(w, h) * 0.7;
          return { width: size, height: size };
        },
      },
      (decoded) => {
        if (handledRef.current) return;
        handledRef.current = true;
        finish(decoded);
      },
      () => {
        /* per-frame decode misses are normal — ignore */
      }
    )
      .then(() => {
        clearTimeout(timeout);
        // If the component unmounted while the camera was starting (React
        // Strict Mode double-invoke), shut it back down immediately.
        if (cancelled) {
          qr.stop().then(() => qr.clear()).catch(() => {});
        } else {
          setStatus("scanning");
        }
      })
      .catch(() => {
        clearTimeout(timeout);
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      if (qr.isScanning) {
        qr.stop().then(() => qr.clear()).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function stopCamera() {
    const qr = scannerRef.current;
    scannerRef.current = null;
    if (qr) {
      try {
        if (qr.isScanning) await qr.stop();
        qr.clear();
      } catch {
        /* ignore */
      }
    }
  }

  function finish(code: string) {
    const trimmed = code.trim();
    stopCamera().finally(() => onSuccess(trimmed));
  }

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const code = manualCode.trim();
    if (!code || handledRef.current) return;
    handledRef.current = true;
    finish(code);
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#08080c" }}>
      {/* html5-qrcode injects the <video> into this element */}
      <div id={READER_ID} style={{ width: "100%", height: "100%" }} />

      {status === "starting" && (
        <div style={OVERLAY}>
          <Loader2 className="sp-spinner" size={26} style={{ color: "#E8B84B" }} />
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 8 }}>
            Starting camera…
          </span>
        </div>
      )}

      {status === "error" && (
        <div style={{ ...OVERLAY, padding: "16px" }}>
          <AlertCircle size={24} color="var(--danger)" />
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", textAlign: "center", margin: "8px 0 12px", lineHeight: 1.4 }}>
            Camera unavailable. Enter the event code manually.
          </p>
          <form onSubmit={submitManual} style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
            <input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Event code"
              autoFocus
              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)", color: "#fff", fontSize: 13, textAlign: "center" }}
            />
            <button
              type="submit"
              style={{ width: "100%", padding: "8px", borderRadius: 8, border: "none", background: "#E8B84B", color: "#000", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
            >
              Submit Code
            </button>
          </form>
        </div>
      )}

      <style>{`
        #${READER_ID} video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
        }
        #${READER_ID} img { display: none; }
      `}</style>
    </div>
  );
}

const OVERLAY: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(8, 4, 22, 0.85)",
  zIndex: 5,
};
