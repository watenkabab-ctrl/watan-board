const CACHE='watan3-v7';
const FONTS=[
  './fonts/0QIhMX1D_JOuMw_LIftL.woff2',
  './fonts/0QIhMX1D_JOuMw_LL_tLp_A.woff2',
  './fonts/0QIvMX1D_JOuMwr7Iw.woff2',
  './fonts/0QIvMX1D_JOuMwT7I-NP.woff2',
  './fonts/1Ptug8zYS_SKggPNyC0ITw.woff2',
  './fonts/1Ptug8zYS_SKggPNyCMIT5lu.woff2'
];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FONTS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  if(e.request.url.includes('/video/')) return;
  // HTML: immer vom Netz holen (kein Cache) — verhindert alte Version
  if(e.request.url.includes('board3.html')||e.request.url.includes('.html')){
    e.respondWith(fetch(e.request,{cache:'no-store'}).catch(()=>caches.match(e.request)));
    return;
  }
  // Fonts: Cache-First
  if(e.request.url.includes('/fonts/')){
    e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{
      if(res.ok){const c=res.clone();caches.open(CACHE).then(ca=>ca.put(e.request,c));}
      return res;
    })));
    return;
  }
  // Images: Network-First mit Cache-Fallback
  e.respondWith(fetch(e.request,{cache:'no-store'}).catch(()=>caches.match(e.request)).then(r=>r||fetch(e.request)));
});
