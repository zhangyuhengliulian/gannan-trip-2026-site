/* 甘南同行 PWA Service Worker
 * 页面与构建资源采用 network-first，避免新版 HTML 命中旧版 CSS/JS 后出现“无样式页面”。
 * 无信号时仍能打开最近访问过的行程、清单、地图简图与应急资料。
 */
const CACHE = "gannan-trip-v5-premium-260828";
const BASE = new URL(self.registration.scope).pathname.replace(/\/$/, "");
const CORE = [`${BASE}/`, `${BASE}/manifest.webmanifest`, `${BASE}/icon.svg`];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_TRIP_IMAGES" || !Array.isArray(event.data.urls)) return;
  event.waitUntil(caches.open(CACHE).then(async (cache) => {
    await Promise.all(event.data.urls.map(async (url) => {
      try {
        const response = await fetch(url, { mode: "no-cors" });
        await cache.put(url, response);
      } catch {}
    }));
  }));
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;
  if (url.hostname.includes("open-meteo.com") || url.hostname.includes("supabase.co")) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }
  if (url.origin !== self.location.origin) {
    if (event.request.destination === "image") {
      event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })));
    }
    return;
  }
  const isAppShell = event.request.mode === "navigate" ||
    url.pathname.includes("/_next/static/") ||
    ["style", "script", "worker"].includes(event.request.destination);

  if (isAppShell) {
    event.respondWith(fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(event.request, copy));
      return response;
    }).catch(async () => (await caches.match(event.request)) || caches.match(`${BASE}/`)));
    return;
  }

  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    return response;
  })));
});
