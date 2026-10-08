const CACHE='watan2-v6';
const ASSETS=[
  './board2.html',
  './fonts/0QIhMX1D_JOuMw_LIftL.woff2',
  './fonts/0QIhMX1D_JOuMw_LL_tLp_A.woff2',
  './fonts/0QIvMX1D_JOuMwr7Iw.woff2',
  './fonts/0QIvMX1D_JOuMwT7I-NP.woff2',
  './fonts/1Ptug8zYS_SKggPNyC0ITw.woff2',
  './fonts/1Ptug8zYS_SKggPNyCMIT5lu.woff2',
  './images/Doener_v1.webp','./images/Lahmacun_v1.webp',
  './images/Doener_Box_neu.webp','./images/Doenerteller_Pommes.webp',
  './images/Falafel_Sandwich.webp','./images/Seitan_Sandwich.webp',
  './images/Falafel_Teller.webp','./images/Seitan_Teller.webp',
  './images/Samosa_Gemuese_v1.webp','./images/Bolani_Kachalo_Gandana_v1.webp',
  './images/Afghan_Soup.webp','./images/Shor_Nakhod_v1.webp',
  './images/Afghan_Burger.webp','./images/Burger_mit_Pommes_v1.webp',
  './images/Fry_Fish.webp','./images/Grill_Fish.webp'
];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  if(e.request.url.includes('/video/')) return;
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{
    if(res.ok&&res.status===200){const c=res.clone();caches.open(CACHE).then(ca=>ca.put(e.request,c));}
    return res;
  })));
});
