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
}

export type SubmitOutcome =
  | { queued: true }
  | { queued: false; ok: boolean; status: number; data: any };

const DB_NAME = "pharmatrack-offline";
const STORE = "scan-queue";
const DB_VERSION = 1;
const SUBMIT_TIMEOUT_MS = 12_000;

function hasIDB(): boolean {
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
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const store = t.objectStore(STORE);
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

export async function enqueue(scan: { qrCodeId: string; eventId: string; scannedAt: string }): Promise<void> {
  if (!hasIDB()) return;
  const record: QueuedScan = {
    localId: genId(),
    qrCodeId: scan.qrCodeId,
    eventId: scan.eventId,
    scannedAt: scan.scannedAt,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  await tx("readwrite", (store) => store.add(record));
}

export async function allQueued(): Promise<QueuedScan[]> {
  if (!hasIDB()) return [];
  const result = await tx<QueuedScan[]>("readonly", (store) => store.getAll() as IDBRequest<QueuedScan[]>);
  return (result || []).sort((a, b) => a.scannedAt.localeCompare(b.scannedAt));
}

export async function queueCount(): Promise<number> {
  if (!hasIDB()) return 0;
  return tx<number>("readonly", (store) => store.count());
}

async function removeQueued(localId: string): Promise<void> {
  if (!hasIDB()) return;
  await tx("readwrite", (store) => store.delete(localId));
}

async function putQueued(record: QueuedScan): Promise<void> {
  if (!hasIDB()) return;
  await tx("readwrite", (store) => store.put(record));
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
 * Tries to submit a scan online. On a clear "backend unreachable" signal
 * (network error, timeout, 5xx/52x/504) it captures the scan offline and
 * returns `{ queued: true }`. A normal HTTP response (including business 4xx
 * like "window closed") is returned as-is for the caller to handle.
 */
export async function submitScanOrQueue(params: {
  qrCodeId: string;
  eventId: string;
  authHeader: Record<string, string>;
}): Promise<SubmitOutcome> {
  const { qrCodeId, eventId, authHeader } = params;
  const scannedAt = new Date().toISOString();
  try {
    const res = await fetchWithTimeout(
      "/api/scan",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ qr_code_id: qrCodeId, event_id: eventId }),
      },
      SUBMIT_TIMEOUT_MS,
    );
    if (isBackendDownStatus(res.status)) {
      await enqueue({ qrCodeId, eventId, scannedAt });
      return { queued: true };
    }
    const data = await res.json().catch(() => ({}));
    return { queued: false, ok: res.ok, status: res.status, data };
  } catch {
    // Network error or timeout → backend unreachable → capture offline.
    await enqueue({ qrCodeId, eventId, scannedAt });
    return { queued: true };
  }
}

// ── Sync ───────────────────────────────────────────────────────────────────

export type SyncClassification = "synced" | "duplicate" | "unmatched" | "retry";

/**
 * Decides what to do with a queued scan given the replay response. Pure and
 * exported so it can be unit-tested without IndexedDB or a real backend.
 * - 200 → recorded (includes the 23505 dedup race, which returns 200).
 * - 409 → already fully recorded / check-in-only duplicate → reconciled.
 * - 5xx/52x/504 → backend still down → retry later.
 * - other 4xx (unknown QR, window closed, not approved) → permanent rejection.
 */
export function classifySyncResult(status: number): SyncClassification {
  if (status === 200) return "synced";
  if (status === 409) return "duplicate";
  if (isBackendDownStatus(status)) return "retry";
  return "unmatched";
}

/**
 * Flushes the queue to `/api/scan`, replaying each scan with its original
 * `scanned_at`. Stops early (keeping the rest) if the backend goes unreachable
 * again mid-run. Removes synced/duplicate/unmatched from the queue; unmatched
 * are surfaced in the report for manual handling.
 */
export async function syncQueue(authHeader: Record<string, string>): Promise<SyncReport> {
  const report: SyncReport = { synced: 0, duplicates: 0, unmatched: [], remaining: 0, backendDown: false };
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
      report.unmatched.push({
        qrCodeId: scan.qrCodeId,
        eventId: scan.eventId,
        scannedAt: scan.scannedAt,
        reason: (data && data.error) || `Rejected (HTTP ${status})`,
      });
      await removeQueued(scan.localId);
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
