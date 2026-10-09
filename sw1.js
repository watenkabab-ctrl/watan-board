const CACHE='watan-b1-v2';
const FONTS=[
  './fonts/0QIhMX1D_JOuMw_LIftL.woff2','./fonts/0QIhMX1D_JOuMw_LL_tLp_A.woff2',
  './fonts/0QIvMX1D_JOuMwr7Iw.woff2','./fonts/0QIvMX1D_JOuMwT7I-NP.woff2',
  './fonts/1Ptug8zYS_SKggPNyC0ITw.woff2','./fonts/1Ptug8zYS_SKggPNyCMIT5lu.woff2'
];
const IMGS=[
  './images/Chicken_Wings_Kebab_pr1.webp','./images/Chicken_Tikka_Kebab_pr1.webp',
  './images/Zershk_Palau_Haehnchen.webp','./images/Chapli_Kebab_pr1.webp',
  './images/Kobide_Kebab_pr1.webp','./images/Lamm_Tikka_Kebab.webp',
  './images/Lamm_Kotelett_pr1.webp','./images/Mix_Grill_1_Person_pr1.webp',
  './images/Mix_Grill_Grillplatte_pr1.webp','./images/grill_fire.jpg'
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
  // HTML: immer frisch vom Netz
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
