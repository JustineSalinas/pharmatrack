"use client";

import { Wifi, WifiOff, RefreshCw, AlertTriangle, CheckCircle, X } from "lucide-react";
import type { OfflineSyncState } from "@/lib/useOfflineScanSync";
import { useState } from "react";

function formatOffset(ms: number): string {
  const abs = Math.abs(ms);
  const mins = Math.round(abs / 60000);
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"}`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `${hrs}h ${rem}m` : `${hrs} hour${hrs === 1 ? "" : "s"}`;
}

/**
 * Renders the scanner's online/offline status, queued-scan count, a "Sync now"
 * button, the wrong-clock confirmation prompt, and the last sync report. Purely
 * presentational — the scanner page owns the `useOfflineScanSync()` instance and
 * passes it in, so the same queue count/refresh is shared with the scan handler.
 */
export function OfflineScanIndicator({ state }: { state: OfflineSyncState }) {
  const { online, pending, syncing, lastReport, clockWarning, syncNow, confirmClockCorrection, dismissClockWarning } = state;
  const [reportDismissed, setReportDismissed] = useState(false);

  const offline = !online;
  const showReport = lastReport && !reportDismissed && (lastReport.synced > 0 || lastReport.unmatched.length > 0 || lastReport.duplicates > 0);

  return (
    <>
      {/* Status pill */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap",
          padding: "8px 12px", borderRadius: "10px",
          background: offline ? "rgba(220,38,38,0.08)" : "rgba(16,185,129,0.08)",
          border: `1px solid ${offline ? "rgba(220,38,38,0.25)" : "rgba(16,185,129,0.25)"}`,
          fontSize: "13px", fontWeight: 500,
        }}
      >
        {offline ? <WifiOff size={15} color="var(--danger)" /> : <Wifi size={15} color="#10b981" />}
        <span style={{ color: offline ? "var(--danger)" : "#10b981" }}>
          {offline ? "Offline" : "Online"}
          {pending > 0 && ` — ${pending} scan${pending === 1 ? "" : "s"} queued`}
        </span>
        {pending > 0 && online && (
          <button
            onClick={() => { setReportDismissed(false); void syncNow(); }}
            disabled={syncing}
            style={{
              marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: "6px",
              padding: "5px 12px", borderRadius: "8px", border: "1px solid var(--border)",
              background: "var(--surface2)", color: "var(--white)", cursor: syncing ? "default" : "pointer",
              fontSize: "12px", fontWeight: 600, opacity: syncing ? 0.6 : 1,
            }}
          >
            <RefreshCw size={13} className={syncing ? "animate-spin" : undefined} />
            {syncing ? "Syncing…" : "Sync now"}
          </button>
        )}
      </div>

      {/* Sync report */}
      {showReport && (
        <div
          style={{
            marginTop: "8px", padding: "10px 12px", borderRadius: "10px",
            background: "var(--surface2)", border: "1px solid var(--border)",
            fontSize: "13px", display: "flex", alignItems: "flex-start", gap: "10px",
          }}
        >
          <CheckCircle size={15} color="#10b981" style={{ marginTop: "2px", flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ color: "var(--white)", fontWeight: 600 }}>
              {lastReport!.synced} synced
              {lastReport!.duplicates > 0 && ` · ${lastReport!.duplicates} already recorded`}
              {lastReport!.unmatched.length > 0 && ` · ${lastReport!.unmatched.length} need attention`}
            </div>
            {lastReport!.unmatched.length > 0 && (
              <div style={{ color: "var(--dimmed)", marginTop: "4px", fontSize: "12px" }}>
                Couldn&apos;t match {lastReport!.unmatched.length} scan{lastReport!.unmatched.length === 1 ? "" : "s"} —
                {" "}add these manually via Attendance → Add Manual Record.
              </div>
            )}
          </div>
          <button
            onClick={() => setReportDismissed(true)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--dimmed)", flexShrink: 0 }}
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Wrong-clock confirmation */}
      {clockWarning && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px" }}>
          <div style={{ maxWidth: "420px", width: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
              <AlertTriangle size={20} color="var(--gold)" />
              <h3 style={{ margin: 0, fontSize: "16px", color: "var(--white)" }}>This device&apos;s clock looks wrong</h3>
            </div>
            <p style={{ fontSize: "13px", color: "var(--white-shade)", lineHeight: 1.5 }}>
              This device&apos;s clock is <strong>{formatOffset(clockWarning.offsetMs)} {clockWarning.offsetMs > 0 ? "ahead of" : "behind"}</strong> the
              server. The scans captured offline were timestamped with this clock, so their times may be wrong.
              Correct them before syncing?
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "16px" }}>
              <button
                onClick={() => { setReportDismissed(false); void dismissClockWarning(); }}
                style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--white)", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}
              >
                Clock is fine — sync as-is
              </button>
              <button
                onClick={() => { setReportDismissed(false); void confirmClockCorrection(); }}
                style={{ padding: "8px 14px", borderRadius: "8px", border: "none", background: "var(--gold)", color: "#1a1a1a", cursor: "pointer", fontSize: "13px", fontWeight: 700 }}
              >
                Correct times &amp; sync
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
