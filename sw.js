/* Sand Alchemy service worker: lets the installed app open offline.
   Network first for the game's own files (so updates you upload show up right
   away when online), falling back to the saved copy when offline. Fonts come
   from the saved copy and refresh in the background. Everything else (the AI
   Worker, the on-device AI download) is left alone. */
const CACHE = 'sandalchemy-v1';
const APP_FILES = ['./', 'index.html', 'styles.css', 'materials.js', 'sim.js', 'game.js', 'manifest.webmanifest',
  'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  // Save what's there (the single-file version has no separate scripts, and that's fine).
  event.waitUntil(caches.open(CACHE).then((c) => Promise.all(APP_FILES.map((f) => c.add(f).catch(() => null)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  // Only clear out our own old copies: the on-device AI keeps its big download in other caches.
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('sandalchemy-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(caches.open(CACHE).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(async () => (await caches.match(req, { ignoreSearch: true })) ||
        (req.mode === 'navigate' ? (await caches.match('index.html')) || caches.match('./') : Response.error()))
  );
});
