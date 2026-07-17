"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  queueCount,
  syncQueue,
  getClockSkewMs,
  applyClockCorrection,
  allUnmatched,
  clearUnmatched as clearUnmatchedScan,
  type SyncReport,
  type UnmatchedScan,
} from "@/lib/offlineScanQueue";
import { getAuthHeader } from "@/lib/auth-client";

// A device clock more than this far from the server is treated as "wrong" and
// the operator is warned before syncing (offline scan times come from this clock).
const CLOCK_SKEW_THRESHOLD_MS = 2 * 60 * 1000;
const POLL_INTERVAL_MS = 20_000;

export interface OfflineSyncState {
  /** Browser connectivity (navigator.onLine), refreshed on online/offline events. */
  online: boolean;
  /** Number of scans currently held in the offline queue. */
  pending: number;
  /** True while a sync run is in flight. */
  syncing: boolean;
  /** The most recent sync report, for surfacing "N synced / M unmatched" to the operator. */
  lastReport: SyncReport | null;
  /**
   * Permanently-rejected scans awaiting manual reconciliation, persisted in
   * IndexedDB — unlike `lastReport`, this survives a dismissed toast or a
   * page reload, so a rejection is never silently lost from view.
   */
  unmatchedScans: UnmatchedScan[];
  /** Set when a wrong device clock is detected before a sync; the UI prompts the operator. */
  clockWarning: { offsetMs: number } | null;
  /** Re-read the queue count (call after enqueuing a scan). */
  refresh: () => Promise<void>;
  /** Manually trigger a sync ("Sync now"). */
  syncNow: () => Promise<void>;
  /** Operator confirmed the clock is wrong: correct queued times, then sync. */
  confirmClockCorrection: () => Promise<void>;
  /** Operator says the clock is fine: dismiss the warning and sync as-is. */
  dismissClockWarning: () => Promise<void>;
  /** Mark an unmatched scan as reconciled (e.g. after adding it via Attendance → Add Manual Record) and remove it from the list. */
  clearUnmatched: (id: string) => Promise<void>;
}

export function useOfflineScanSync(): OfflineSyncState {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastReport, setLastReport] = useState<SyncReport | null>(null);
  const [unmatchedScans, setUnmatchedScans] = useState<UnmatchedScan[]>([]);
  const [clockWarning, setClockWarning] = useState<{ offsetMs: number } | null>(null);
  const syncingRef = useRef(false);

  const refresh = useCallback(async () => {
    setPending(await queueCount());
  }, []);

  const refreshUnmatched = useCallback(async () => {
    setUnmatchedScans(await allUnmatched());
  }, []);

  const clearUnmatched = useCallback(async (id: string) => {
    await clearUnmatchedScan(id);
    await refreshUnmatched();
  }, [refreshUnmatched]);

  const runSync = useCallback(async () => {
    if (syncingRef.current) return;
    if (await queueCount() === 0) {
      await refresh();
      return;
    }
    syncingRef.current = true;
    setSyncing(true);
    try {
      // getAuthHeader() refreshes the Supabase session, which is a network call
      // that throws "Failed to fetch" if the backend is unreachable. Catch it
      // (and any syncQueue failure) so it never becomes an unhandled rejection —
      // the scans just stay queued and retry on the next trigger.
      const authHeader = await getAuthHeader();
      const report = await syncQueue(authHeader as Record<string, string>);
      setLastReport(report);
      if (report.unmatched.length > 0) await refreshUnmatched();
    } catch (err) {
      console.warn("[offline-sync] sync attempt failed; scans stay queued for retry", err);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
      await refresh();
    }
  }, [refresh, refreshUnmatched]);

  // Public sync entry point: check the device clock first, and if it looks
  // wrong, surface a warning instead of silently syncing bad timestamps.
  const syncNow = useCallback(async () => {
    if (syncingRef.current) return;
    // Don't attempt clock-check/sync fetches while the browser knows it's
    // offline — avoids failed requests cluttering the console. (The catch in
    // runSync is the real safety net, since navigator.onLine can be a false
    // positive.)
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    if (await queueCount() === 0) {
      await refresh();
      return;
    }
    const skew = await getClockSkewMs();
    if (skew !== null && Math.abs(skew) > CLOCK_SKEW_THRESHOLD_MS) {
      setClockWarning({ offsetMs: skew });
      return; // wait for the operator to confirm/dismiss
    }
    await runSync();
  }, [refresh, runSync]);

  const confirmClockCorrection = useCallback(async () => {
    const warning = clockWarning;
    setClockWarning(null);
    try {
      if (warning) await applyClockCorrection(warning.offsetMs);
    } catch (err) {
      console.warn("[offline-sync] clock correction failed", err);
    }
    await runSync();
  }, [clockWarning, runSync]);

  const dismissClockWarning = useCallback(async () => {
    setClockWarning(null);
    await runSync();
  }, [runSync]);

  // Track connectivity. Fire-and-forget calls swallow rejections so a failed
  // IndexedDB/network op can never surface as an unhandled promise rejection.
  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      void syncNow().catch(() => {});
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [syncNow]);

  // Initial count + a gentle poll that flushes anything queued while online
  // (covers cases the 'online' event misses, e.g. the backend recovered but the
  // network never technically dropped).
  useEffect(() => {
    void refresh().catch(() => {});
    void refreshUnmatched().catch(() => {});
    const id = setInterval(() => {
      if (typeof navigator !== "undefined" && navigator.onLine) void syncNow().catch(() => {});
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh, refreshUnmatched, syncNow]);

  return {
    online,
    pending,
    syncing,
    lastReport,
    unmatchedScans,
    clockWarning,
    refresh,
    syncNow,
    confirmClockCorrection,
    dismissClockWarning,
    clearUnmatched,
  };
}
