/*
 * ACLS Companion service worker - makes the app open and run with no internet.
 *
 * At build time (see the `aclsServiceWorker` plugin in vite.config.ts) the two
 * placeholders below are replaced with:
 *   - a version that changes whenever the app changes, so phones pick up updates
 *   - the full list of built files (JS, CSS, icons), so everything - including
 *     screens that load later - is saved on the first visit.
 * In development they stay as-is and the worker is not registered.
 */
const CACHE_VERSION = 'dev'; /* __ACLS_CACHE_VERSION__ */
const PRECACHE_URLS = ['/']; /* __ACLS_PRECACHE_URLS__ */

const APP_CACHE = `acls-app-${CACHE_VERSION}`;
const FONT_CACHE = 'acls-fonts-v1';
// If the network is this slow, show the saved copy instead of a blank screen.
const NAVIGATION_TIMEOUT_MS = 3500;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) =>
      // Save each file on its own, so one missing file can never break offline mode.
      Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch((err) => {
            console.warn('[sw] could not precache', url, err);
          })
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== APP_CACHE && key !== FONT_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
  // Note: we deliberately do NOT reload open pages when an update arrives.
  // A reload during an active code would wipe the running timers and log.
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Google Fonts: serve the saved copy, refresh it in the background.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(request, FONT_CACHE));
    return;
  }

  // Everything else from other sites (Firebase, Google sign-in, AI) goes straight
  // to the network and is never stored here.
  if (url.origin !== self.location.origin) return;

  // Server/AI endpoints: always live, never cached.
  if (url.pathname.startsWith('/api/')) return;

  // Opening the app: try the network for the newest version, fall back to the
  // saved copy when offline or when the connection is very slow.
  if (request.mode === 'navigate') {
    let cacheUpdate = Promise.resolve();
    const fromNetwork = fetch(request).then((response) => {
      if (response && response.ok) {
        // Every route of this single-page app is served by the same index.html.
        const copy = response.clone();
        cacheUpdate = caches.open(APP_CACHE).then((cache) => cache.put('/', copy));
      }
      return response;
    });
    // Keep the worker alive until the saved copy is updated.
    event.waitUntil(fromNetwork.then(() => cacheUpdate).catch(() => {}));
    event.respondWith(networkFirstNavigation(fromNetwork));
    return;
  }

  // Built JS/CSS files have a content hash in their name and never change.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, APP_CACHE));
    return;
  }

  // Icons, manifest and other public files.
  event.respondWith(staleWhileRevalidate(request, APP_CACHE));
});

async function networkFirstNavigation(fromNetwork) {
  const cached = await caches.match('/', { cacheName: APP_CACHE, ignoreVary: true });
  if (!cached) {
    return fromNetwork;
  }
  const timeout = new Promise((resolve) => setTimeout(() => resolve(cached), NAVIGATION_TIMEOUT_MS));
  try {
    return await Promise.race([fromNetwork, timeout]);
  } catch (err) {
    // Offline: the network request failed, so use the saved copy.
    return cached;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  // ignoreVary: module scripts are requested with an Origin header, and a
  // server "Vary" header would otherwise stop the saved copy from matching.
  const cached = await cache.match(request, { ignoreVary: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreVary: true });
  const fromNetwork = fetch(request)
    .then((response) => {
      // Opaque (status 0) responses are how cross-origin font CSS arrives; keep those too.
      if (response && (response.ok || response.type === 'opaque')) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);
  return cached || fromNetwork;
}
