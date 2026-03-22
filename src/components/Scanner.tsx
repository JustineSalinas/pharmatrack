"use client";
import { useState, useEffect, useRef } from "react";

interface ScannerProps {
  onSuccess: (code: string) => void;
}

export default function Scanner({ onSuccess }: ScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setCurrentDate(now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }));
    };
    update();
    tickRef.current = setInterval(update, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  const simulateScan = () => {
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      onSuccess(manualCode || "PHARM-0322-A1");
    }, 1400);
  };

  // Random QR pattern cells
  const cells = Array.from({ length: 64 }, (_, i) => ({
    show: Math.random() > 0.4,
    height: Math.floor(Math.random() * 14 + 4),
  }));

  return (
    <div className="scanner-page">
      {/* QR Frame */}
      <div className="qr-frame">
        <div className="qr-corners" />
        <div className="corner-tr" />
        <div className="corner-bl" />
        <div className="scan-line" />
        <div className="qr-inner-pattern">
          {cells.map((c, i) => (
            <div key={i} className="qr-cell" style={{ opacity: c.show ? 1 : 0, height: c.height }} />
          ))}
        </div>
        <div
          style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 13, color: "var(--gold)",
            background: scanning ? "rgba(232,200,74,0.15)" : "rgba(0,0,0,0.3)",
            backdropFilter: "blur(2px)", transition: "background 0.3s",
          }}
        >
          {scanning ? "🔍 Scanning..." : "Point camera at QR code"}
        </div>
      </div>

      <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 13, marginBottom: 20 }}>
        Or enter code manually below
      </p>

      <div className="input-group">
        <label>Session Code</label>
        <div className="input-wrap">
          <span className="icon">🔑</span>
          <input
            className="inp"
            placeholder="e.g. PHARM-0322-A1"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
          />
        </div>
      </div>

      <button className="btn btn-gold" onClick={simulateScan} disabled={scanning}>
        {scanning ? "⏳ Processing..." : "✅ Check In Now"}
      </button>

      {/* Student info card */}
      <div className="check-in-card" style={{ marginTop: 20 }}>
        <div className="ci-info">
          <div className="ci-avatar">👨‍🎓</div>
          <div className="ci-meta">
            <strong>Juan Dela Cruz</strong>
            <span>2026-12345 · PharmA · 2nd Year</span>
          </div>
        </div>
        <div className="ci-time">{currentTime || "--:--:--"}</div>
        <div className="ci-date">{currentDate}</div>
      </div>
    </div>
  );
}
