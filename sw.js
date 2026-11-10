// Change VERSION whenever app-shell files change.
const VERSION = "v3";
const PREFIX = `nasa-explorer-${self.registration.scope}-`;
const SHELL = `${PREFIX}shell-${VERSION}`;
const API = `${PREFIX}api-${VERSION}`;
const IMAGES = `${PREFIX}images-${VERSION}`;
const APP_URL = new URL("./", self.registration.scope).href;
const SHELL_URLS = [
  "./", "index.html", "style.css", "pwa.css", "manifest.json",
  "js/dateRange.js", "js/script.js", "js/pwa.js",
  "img/nasa-worm-logo.png", "img/icon-192.png", "img/icon-512.png"
].map((path) => new URL(path, APP_URL).href);

self.addEventListener("install", (event) => {
  // Keep an existing version active until its open tabs are closed.
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(SHELL_URLS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) =>
      name.startsWith(PREFIX) && ![SHELL, API, IMAGES].includes(name)
    ).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function save(cache, request, response, limit) {
  try {
    await cache.put(request, response);
    const keys = await cache.keys();
    await Promise.all(keys.slice(0, Math.max(0, keys.length - limit))
      .map((key) => cache.delete(key)));
  } catch {
    // A full cache must not prevent a successful online response.
  }
}

async function tellPage(clientId, type, cached = false) {
  const client = clientId ? await self.clients.get(clientId) : null;
  client?.postMessage({ type, cached });
}

async function networkFirst(event) {
  const cache = await caches.open(API);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let response;
  try {
    response = await fetch(event.request, {
      signal: controller.signal,
      cache: "no-store"
    });
    if (!response.ok) throw new Error("NASA request failed");
    await save(cache, event.request, response.clone(), 60);
    await tellPage(event.clientId, "NASA_NETWORK_OK");
    return response;
  } catch {
    const cached = await cache.match(event.request);
    await tellPage(event.clientId, "NASA_CACHE_FALLBACK", Boolean(cached));
    return cached || response || new Response(
      JSON.stringify({ error: "This date range is not saved offline." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function cacheFirst(request, cacheName, limit) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || (cacheName === IMAGES && response.type === "opaque")) {
    await save(cache, request, response.clone(), limit);
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const nasaFeed = url.origin === "https://science.nasa.gov" &&
    url.pathname.replace(/\/$/, "") === "/wp-json/wp/v2/apod-basic";
  const nasaApi = url.origin === "https://api.nasa.gov";
  if (nasaFeed || nasaApi) {
    event.respondWith(networkFirst(event));
  } else if (event.request.mode === "navigate" &&
             url.href.startsWith(APP_URL)) {
    event.respondWith(cacheFirst(new Request(new URL("index.html", APP_URL)), SHELL, 20));
  } else if (SHELL_URLS.includes(url.href)) {
    event.respondWith(cacheFirst(event.request, SHELL, 20));
  } else if (event.request.destination === "image" &&
             (url.hostname === "nasa.gov" || url.hostname.endsWith(".nasa.gov"))) {
    event.respondWith(cacheFirst(event.request, IMAGES, 30));
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true
    });
    const existing = windows.find((client) => client.url.startsWith(APP_URL));
    if (existing) return existing.focus();
    return self.clients.openWindow(APP_URL);
  })());
});