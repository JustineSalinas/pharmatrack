/**
 * Offline-first scan queue.
 *
 * When a scan can't reach the backend (network drop, Supabase outage, gateway
 * timeout), it's stored locally in IndexedDB instead of failing, then flushed
 * to `/api/scan` — with its ORIGINAL capture time — once the backend is back.
 * IndexedDB (not localStorage) so a queue we can't afford to lose survives tab
 * reloads and isn't casually cleared.
 *
 * See the design + user flow in the plan; this module is the client core.
 */

export interface QueuedScan {
  localId: string;
  qrCodeId: string;
  eventId: string;
  /** ISO, from the device clock at capture time. Corrected on sync if the clock is off. */
  scannedAt: string;
  createdAt: string;
  attempts: number;
}

export interface SyncReport {
  synced: number;
  duplicates: number;
  unmatched: Array<{ qrCodeId: string; eventId: string; scannedAt: string; reason: string }>;
  /** How many scans are still queued after this run (e.g. backend went down again mid-sync). */
  remaining: number;
  /** True if the run stopped early because the backend was still unreachable. */
  backendDown: boolean;
  /**
   * True if the run stopped early because the scanner's session had expired (401).
   * The affected scans stay queued — logging back in and syncing again recovers them.
   */
  authExpired: boolean;
}

/**
 * A scan that was permanently rejected on sync (unknown QR, window closed, not
 * approved, etc.) — persisted so it survives a dismissed report/page reload
 * instead of vanishing once the in-memory `SyncReport` is gone.
 */
export interface UnmatchedScan {
  id: string;
  qrCodeId: string;
  eventId: string;
  scannedAt: string;
  reason: string;
  recordedAt: string;
}

export type SubmitOutcome =
  | { queued: true }
  | { queued: false; ok: boolean; status: number; data: any };

const DB_NAME = "pharmatrack-offline";
const STORE = "scan-queue";
const UNMATCHED_STORE = "unmatched-scans";
const DB_VERSION = 2;
const SUBMIT_TIMEOUT_MS = 12_000;

export function hasIDB(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "localId" });
      }
      if (!db.objectStoreNames.contains(UNMATCHED_STORE)) {
        db.createObjectStore(UNMATCHED_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(storeName, mode);
        const store = t.objectStore(storeName);
        const request = fn(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        t.oncomplete = () => db.close();
      }),
  );
}

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ── Queue CRUD ────────────────────────────────────────────────────────────

/**
 * Persists a scan to the offline queue. Throws if IndexedDB isn't available
 * on this device/browser (private-browsing storage restrictions, quota,
 * corruption) — callers MUST treat that as a genuine capture failure, not a
 * silent success, otherwise the UI can end up claiming "Saved Offline" for a
 * scan that was never actually stored anywhere.
 */
export async function enqueue(scan: { qrCodeId: string; eventId: string; scannedAt: string }): Promise<void> {
  if (!hasIDB()) throw new Error("IndexedDB is not available on this device/browser.");
  const record: QueuedScan = {
    localId: genId(),
    qrCodeId: scan.qrCodeId,
    eventId: scan.eventId,
    scannedAt: scan.scannedAt,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  await tx(STORE, "readwrite", (store) => store.add(record));
}

export async function allQueued(): Promise<QueuedScan[]> {
  if (!hasIDB()) return [];
  const result = await tx<QueuedScan[]>(STORE, "readonly", (store) => store.getAll() as IDBRequest<QueuedScan[]>);
  return (result || []).sort((a, b) => a.scannedAt.localeCompare(b.scannedAt));
}

export async function queueCount(): Promise<number> {
  if (!hasIDB()) return 0;
  return tx<number>(STORE, "readonly", (store) => store.count());
}

async function removeQueued(localId: string): Promise<void> {
  if (!hasIDB()) return;
  await tx(STORE, "readwrite", (store) => store.delete(localId));
}

async function putQueued(record: QueuedScan): Promise<void> {
  if (!hasIDB()) return;
  await tx(STORE, "readwrite", (store) => store.put(record));
}

// ── Unmatched (permanently-rejected) scan log ───────────────────────────────
// Kept in its own store, separate from the live queue, so a rejected scan's
// detail survives a dismissed sync-report toast or a page reload — otherwise
// the only record of "which student, which reason" was the in-memory
// SyncReport, gone the moment the component unmounts.

async function recordUnmatched(entry: Omit<UnmatchedScan, "id" | "recordedAt">): Promise<void> {
  if (!hasIDB()) return;
  const record: UnmatchedScan = { id: genId(), recordedAt: new Date().toISOString(), ...entry };
  await tx(UNMATCHED_STORE, "readwrite", (store) => store.add(record));
}

export async function allUnmatched(): Promise<UnmatchedScan[]> {
  if (!hasIDB()) return [];
  const result = await tx<UnmatchedScan[]>(UNMATCHED_STORE, "readonly", (store) => store.getAll() as IDBRequest<UnmatchedScan[]>);
  return (result || []).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
}

/** Call once a facilitator/admin has manually reconciled the student via Attendance → Add Manual Record. */
export async function clearUnmatched(id: string): Promise<void> {
  if (!hasIDB()) return;
  await tx(UNMATCHED_STORE, "readwrite", (store) => store.delete(id));
}

// ── Submit-or-queue wrapper (used by the scanner pages) ────────────────────

function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

/** Statuses that mean "backend/gateway is unreachable", so we should queue rather than surface an error. */
function isBackendDownStatus(status: number): boolean {
  return status >= 500 || status === 522 || status === 524 || status === 504;
}

/**
 * Attempts to capture a scan into the offline queue. On success returns the
 * normal `{ queued: true }` outcome; if IndexedDB itself is unavailable
 * (`enqueue` throws), returns an honest `queued: false` rejection instead of
 * letting the caller claim "Saved Offline" for a scan that was never stored
 * anywhere. `status: 0` marks this as a client-side capture failure rather
 * than a real HTTP response.
 */
async function tryEnqueue(qrCodeId: string, eventId: string, scannedAt: string): Promise<SubmitOutcome> {
  try {
    await enqueue({ qrCodeId, eventId, scannedAt });
    return { queued: true };
  } catch (err) {
    console.error("[offline-queue] failed to capture scan — IndexedDB unavailable", err);
    return {
      queued: false,
      ok: false,
      status: 0,
      data: {
        error:
          "Couldn't save this scan — local storage is unavailable on this device. Please retry on a stable connection, or record this student manually via Attendance → Add Manual Record.",
      },
    };
  }
}

/**
 * Tries to submit a scan online. On a clear "backend unreachable" signal
 * (network error, timeout, 5xx/52x/504) it captures the scan offline and
 * returns `{ queued: true }`. A normal HTTP response (including business 4xx
 * like "window closed") is returned as-is for the caller to handle.
 *
 * `scannedAt`, when provided, is the original QR-scan capture time (Phase 1
 * of the scanner UI) rather than the time this function runs (Phase 2,
 * confirm-click) — it's forwarded as `scanned_at` so the server's event
 * window checks judge the scan against when it actually happened, not
 * against however long the facilitator took to hit Confirm. Also used to
 * timestamp the offline-queue fallback below, for the same reason.
 */
export async function submitScanOrQueue(params: {
  qrCodeId: string;
  eventId: string;
  authHeader: Record<string, string>;
  scannedAt?: string;
}): Promise<SubmitOutcome> {
  const { qrCodeId, eventId, authHeader } = params;
  const scannedAt = params.scannedAt ?? new Date().toISOString();
  try {
    const res = await fetchWithTimeout(
      "/api/scan",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ qr_code_id: qrCodeId, event_id: eventId, scanned_at: scannedAt }),
      },
      SUBMIT_TIMEOUT_MS,
    );
    if (isBackendDownStatus(res.status)) {
      return await tryEnqueue(qrCodeId, eventId, scannedAt);
    }
    const data = await res.json().catch(() => ({}));
    return { queued: false, ok: res.ok, status: res.status, data };
  } catch {
    // Network error or timeout → backend unreachable → capture offline.
    return await tryEnqueue(qrCodeId, eventId, scannedAt);
  }
}

// ── Sync ───────────────────────────────────────────────────────────────────

export type SyncClassification = "synced" | "duplicate" | "unmatched" | "retry" | "auth";

/**
 * Decides what to do with a queued scan given the replay response. Pure and
 * exported so it can be unit-tested without IndexedDB or a real backend.
 * - 200 → recorded (includes the 23505 dedup race, which returns 200).
 * - 409 → already fully recorded / check-in-only duplicate → reconciled.
 * - 401 → the scanner's session expired; the scan itself is fine. Recoverable
 *   by logging back in, so it stays queued rather than being written off.
 *   (2026-07-21: a facilitator's session lapsed mid-event and 22 valid scans
 *   were classified as permanent rejections, needing manual reconciliation.)
 * - 5xx/52x/504 → backend still down → retry later.
 * - other 4xx (unknown QR, window closed, 403 not-approved) → permanent rejection.
 */
export function classifySyncResult(status: number): SyncClassification {
  if (status === 200) return "synced";
  if (status === 409) return "duplicate";
  if (status === 401) return "auth";
  if (isBackendDownStatus(status)) return "retry";
  return "unmatched";
}

/**
 * Flushes the queue to `/api/scan`, replaying each scan with its original
 * `scanned_at`. Stops early (keeping the rest) if the backend goes unreachable
 * or the session expires (401) mid-run. Removes synced/duplicate/unmatched from
 * the queue; unmatched are surfaced in the report for manual handling, while
 * session-expiry leaves everything queued for a retry after re-login.
 */
export async function syncQueue(authHeader: Record<string, string>): Promise<SyncReport> {
  const report: SyncReport = { synced: 0, duplicates: 0, unmatched: [], remaining: 0, backendDown: false, authExpired: false };
  if (!hasIDB()) return report;

  const scans = await allQueued();
  for (const scan of scans) {
    let status: number;
    let data: any = {};
    try {
      const res = await fetchWithTimeout(
        "/api/scan",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader },
          body: JSON.stringify({ qr_code_id: scan.qrCodeId, event_id: scan.eventId, scanned_at: scan.scannedAt }),
        },
        SUBMIT_TIMEOUT_MS,
      );
      status = res.status;
      data = await res.json().catch(() => ({}));
    } catch {
      // Backend went unreachable again — keep this and the remaining scans.
      report.backendDown = true;
      break;
    }

    const outcome = classifySyncResult(status);
    if (outcome === "synced") {
      report.synced++;
      await removeQueued(scan.localId);
    } else if (outcome === "duplicate") {
      report.duplicates++;
      await removeQueued(scan.localId);
    } else if (outcome === "unmatched") {
      const reason = (data && data.error) || `Rejected (HTTP ${status})`;
      report.unmatched.push({ qrCodeId: scan.qrCodeId, eventId: scan.eventId, scannedAt: scan.scannedAt, reason });
      // Persisted separately from the in-memory report so the rejection
      // detail survives a dismissed toast or a page reload — see
      // `allUnmatched`/`clearUnmatched`.
      await recordUnmatched({ qrCodeId: scan.qrCodeId, eventId: scan.eventId, scannedAt: scan.scannedAt, reason });
      await removeQueued(scan.localId);
    } else if (outcome === "auth") {
      // Session expired. The scan is valid — keep it queued so re-logging in and
      // syncing again recovers it. Stop the run: every remaining scan would 401
      // on the same dead session.
      report.authExpired = true;
      await putQueued({ ...scan, attempts: scan.attempts + 1 });
      break;
    } else {
      // retry — backend down. Bump attempt count, keep it, stop the run.
      report.backendDown = true;
      await putQueued({ ...scan, attempts: scan.attempts + 1 });
      break;
    }
  }

  report.remaining = await queueCount();
  return report;
}

// ── Clock-sanity ─────────────────────────────────────────────────────────────

/**
 * Measures how far the device clock is from the server, in ms (positive = the
 * device is ahead of the server). Returns null if the server time can't be read.
 */
export async function getClockSkewMs(): Promise<number | null> {
  try {
    const res = await fetchWithTimeout("/api/time", { method: "GET", cache: "no-store" }, SUBMIT_TIMEOUT_MS);
    if (!res.ok) return null;
    const { now } = await res.json();
    const serverMs = new Date(now).getTime();
    if (Number.isNaN(serverMs)) return null;
    return Date.now() - serverMs;
  } catch {
    return null;
  }
}

/** Shifts every queued scan's `scannedAt` by `-offsetMs` to correct a wrong device clock before syncing. */
export async function applyClockCorrection(offsetMs: number): Promise<void> {
  if (!hasIDB() || !offsetMs) return;
  const scans = await allQueued();
  for (const scan of scans) {
    const corrected = new Date(new Date(scan.scannedAt).getTime() - offsetMs).toISOString();
    await putQueued({ ...scan, scannedAt: corrected });
  }
}
