const CACHE='watan-v9';
const ASSETS=[
  './board3.html',
  './fonts/0QIhMX1D_JOuMw_LIftL.woff2',
  './fonts/0QIhMX1D_JOuMw_LL_tLp_A.woff2',
  './fonts/0QIvMX1D_JOuMwr7Iw.woff2',
  './fonts/0QIvMX1D_JOuMwT7I-NP.woff2',
  './fonts/1Ptug8zYS_SKggPNyC0ITw.woff2',
  './fonts/1Ptug8zYS_SKggPNyCMIT5lu.woff2',
  './images/Loobia_v1.png','./images/Qorma.webp','./images/Bamya_Okra.webp',
  './images/Sabzi_Palak.webp','./images/Chicken_Jalfrezi_v1.png',
  './images/Reis_Beilage_Kabuli_v1.png','./images/Beryani_Palau.webp',
  './images/Molong_Palau.webp','./images/Mahicha_Palau_v1.png','./images/Mantu.webp',
  './images/Pacha_v1.png','./images/Rosh.webp','./images/Chanaki.webp',
  './images/Chicken_Karahi.webp','./images/Lamm_Karahi.webp',
  './images/Pizza_Margarita_v1.png','./images/Pizza_mit_Spinat_v1.png',
  './images/Pizza_mit_Salami_oder_Sucuk_v1.png','./images/Pizza_mit_Tunfisch_v1.png',
  './images/Pizza_mit_Gemuese_v1.png'
];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  // Video range requests must bypass SW — caching breaks streaming
  if(e.request.url.includes('/video/')) return;
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{
    if(res.ok&&res.status===200){const c=res.clone();caches.open(CACHE).then(ca=>ca.put(e.request,c));}
    return res;
  })));
});
