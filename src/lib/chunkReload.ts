/**
 * After a new deployment, page chunks get new file names. A browser that still has the
 * previous version loaded will try to import chunks that no longer exist and fail with
 * "Failed to fetch dynamically imported module". The fix is simply to load the new version,
 * so we reload the page once - guarded so it can never loop.
 */

const RELOAD_KEY = 'niza:chunk-reload-at';
const RELOAD_GUARD_MS = 30_000;

const CHUNK_ERROR_PATTERNS = [
  'failed to fetch dynamically imported module',
  'error loading dynamically imported module',
  'importing a module script failed',
  'loading chunk',
  'loading css chunk',
  'unable to preload css',
  "'text/html' is not a valid javascript mime type",
];

export function isChunkLoadError(error: unknown): boolean {
  const message = String((error as any)?.message ?? error ?? '').toLowerCase();
  const name = String((error as any)?.name ?? '').toLowerCase();
  return name === 'chunkloaderror' || CHUNK_ERROR_PATTERNS.some((p) => message.includes(p));
}

/** Reload once to pick up the latest deployment. Returns false if we already tried recently. */
export function reloadForNewVersion(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < RELOAD_GUARD_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // storage unavailable (private mode etc.) - still reload once for this page view
    if ((window as any).__nizaChunkReloaded) return false;
    (window as any).__nizaChunkReloaded = true;
  }
  window.location.reload();
  return true;
}

/** Install global listeners so stale-chunk errors recover before any error screen shows. */
export function installChunkReloadHandler() {
  // Vite fires this when a dynamic import's preload fails
  window.addEventListener('vite:preloadError', (event) => {
    if (reloadForNewVersion()) event.preventDefault();
  });
  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkLoadError(event.reason) && reloadForNewVersion()) event.preventDefault();
  });
}
