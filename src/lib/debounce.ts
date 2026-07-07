/**
 * Coalesces rapid-fire calls into one, waitMs after the last call. Used on
 * Supabase Realtime callbacks so a burst of scans (e.g. continuous QR
 * check-ins during a busy event) triggers one dashboard refetch instead of
 * one per row change across every open tab.
 */
export function debounce<T extends (...args: any[]) => void>(fn: T, waitMs: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  }) as T;
}
