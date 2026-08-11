const CACHE = "locked-inn-v12";
const CORE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./legal.html",
  "./assets/logo-book.png",
  "./assets/logo-full.png",
  "./assets/logo-word.png",
  "./icons/icon-32.png",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

function isStaticAsset(url) {
  return /\.(png|jpg|jpeg|svg|webp|ico|woff2?|css|js)$/i.test(url.pathname);
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok || res.type === "opaque") {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(request, copy));
  }
  return res;
}

async function networkFirst(request) {
  try {
    const res = await fetch(request);
    if (res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(request, copy));
    }
    return res;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") {
      const shell = await caches.match("./index.html");
      if (shell) return shell;
    }
    throw err;
  }
}

self.addEventListener("fetch", (e) => {
  const request = e.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  /* Firebase auth/Firestore and the Gemini function must always hit the network. */
  if (url.pathname.startsWith("/.netlify/") || /googleapis\.com$/.test(url.hostname)) return;

  e.respondWith(isStaticAsset(url) ? cacheFirst(request) : networkFirst(request));
});
