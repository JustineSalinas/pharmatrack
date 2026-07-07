"use client";

import { useEffect } from "react";

// After a deployment, a browser tab that's been open/backgrounded since the
// previous build can still reference JS chunk files that no longer exist on
// the server — the request for one gets back an HTML 404 page instead of
// JS, which throws as "Unexpected token '<'" when the browser tries to
// parse it. This disproportionately hits iOS Safari, which keeps tabs alive
// across the app switcher far longer than other browsers do, so users are
// more likely to still have a pre-deploy tab open when this happens.
//
// Rather than leave the user stuck on a broken page, detect this specific
// failure signature and force a single reload to pick up the current build.
const CHUNK_FAILURE_PATTERN =
  /Unexpected token '<'|Loading chunk \d+ failed|Loading CSS chunk|Failed to fetch dynamically imported module|ChunkLoadError/i;

const RELOAD_FLAG_KEY = "pt_chunk_reload_at";
const RELOAD_COOLDOWN_MS = 60_000; // avoid a reload loop if this keeps failing

function reloadOnce() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_FLAG_KEY) || "0");
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return; // already tried recently — don't loop
    sessionStorage.setItem(RELOAD_FLAG_KEY, String(Date.now()));
  } catch {
    // sessionStorage unavailable (e.g. private browsing) — fall through and reload anyway
  }
  window.location.reload();
}

export default function ChunkErrorReload() {
  useEffect(() => {
    function handleError(event: ErrorEvent) {
      const message = event.message || event.error?.message || "";
      if (CHUNK_FAILURE_PATTERN.test(message)) reloadOnce();
    }

    function handleRejection(event: PromiseRejectionEvent) {
      const message = event.reason?.message || String(event.reason ?? "");
      if (CHUNK_FAILURE_PATTERN.test(message)) reloadOnce();
    }

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}
