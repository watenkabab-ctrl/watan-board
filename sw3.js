const CACHE='watan3-v8';
const FONTS=[
  './fonts/0QIhMX1D_JOuMw_LIftL.woff2','./fonts/0QIhMX1D_JOuMw_LL_tLp_A.woff2',
  './fonts/0QIvMX1D_JOuMwr7Iw.woff2','./fonts/0QIvMX1D_JOuMwT7I-NP.woff2',
  './fonts/1Ptug8zYS_SKggPNyC0ITw.woff2','./fonts/1Ptug8zYS_SKggPNyCMIT5lu.woff2'
];
const IMGS=[
  './images/Loobia_v1.webp','./images/Qorma.webp',
  './images/Bamya_Okra.webp','./images/Sabzi_Palak.webp',
  './images/Chicken_Jalfrezi_v1.webp','./images/Reis_Beilage_Kabuli_v1.webp',
  './images/Beryani_Palau.webp','./images/Molong_Palau.webp',
  './images/Mahicha_Palau_v1.webp','./images/Mantu.webp',
  './images/Pacha_v1.webp','./images/Rosh.webp',
  './images/Chanaki.webp','./images/Chicken_Karahi.webp',
  './images/Lamm_Karahi.webp','./images/Pizza_Margarita_v1.webp',
  './images/Pizza_mit_Spinat_v1.webp','./images/Pizza_mit_Salami_oder_Sucuk_v1.webp',
  './images/Pizza_mit_Tunfisch_v1.webp','./images/Pizza_mit_Gemuese_v1.webp',
  './images/grill_fire.jpg'
];
self.addEventListener('install',e=>{
  e.waitUntil(
    caches.open(CACHE).then(c=>c.addAll([...FONTS,...IMGS])).then(()=>self.skipWaiting())
  );
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  if(e.request.url.includes('/video/')) return;
  // HTML: immer frisch vom Netz — keine alte Version möglich
  if(e.request.url.includes('.html')){
    e.respondWith(fetch(e.request,{cache:'no-store'}).catch(()=>caches.match(e.request)));
    return;
  }
  // Fonts + Images: Cache-First (einmal geladen = sofort verfügbar)
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{
    if(res.ok&&res.status===200){const c=res.clone();caches.open(CACHE).then(ca=>ca.put(e.request,c));}
    return res;
  })));
});
