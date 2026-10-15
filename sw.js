const CACHE = 'watan-v15';
const STATIC = [
  '/',
  '/index.html',
  '/menu.html',
  '/bestellen.html',
  '/offline.html',
  '/menu-translations.json',
  '/fonts/fonts.css',
  '/fonts/fonts-menu.css',
  '/hero-mixgrill.jpg',
  '/hero-mixgrill-mobile.jpg',
  '/favicon.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // NUR GET abfangen — POST/PATCH/DELETE (Bestellung/Reservierung/Storno) durchlassen
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // NUR Same-Origin — die Railway-API (cross-origin) NICHT cachen (sonst veraltete Verfügbarkeit)
  if (url.origin !== self.location.origin) return;

  // Cache-first NUR für Schriften (wirklich immutable)
  if (url.pathname.startsWith('/fonts/')) {
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => r))
    );
    return;
  }
  // Stale-while-revalidate für Dish-Bilder — schnell, aktualisiert sich aber selbst
  // (sonst blieben ausgetauschte Gerichtsfotos dauerhaft alt im Browser-Cache)
  if (url.pathname.startsWith('/dishes/')) {
    e.respondWith(
      caches.open(CACHE).then(c =>
        c.match(e.request).then(cached => {
          const fresh = fetch(e.request).then(res => { c.put(e.request, res.clone()); return res; }).catch(() => cached);
          return cached || fresh;
        })
      )
    );
    return;
  }
  // Network-first für HTML/JSON (immer frisch), mit Cache- und Offline-Fallback
  if (url.pathname.endsWith('.html') || url.pathname.endsWith('.json') || url.pathname === '/') {
    e.respondWith(
      fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request).then(r => r || caches.match('/offline.html')))
    );
    return;
  }
  // Stale-while-revalidate für sonstige Same-Origin-GETs
  e.respondWith(
    caches.open(CACHE).then(c =>
      c.match(e.request).then(cached => {
        const fresh = fetch(e.request).then(res => {
          c.put(e.request, res.clone());
          return res;
        }).catch(() => cached);
        return cached || fresh;
      })
    )
  );
});
