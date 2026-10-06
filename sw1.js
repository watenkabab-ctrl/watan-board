const CACHE='watan-b1-v1';
const ASSETS=[
  './board1.html',
  './images/Chicken_Wings_Kebab_pr1.webp',
  './images/Chicken_Tikka_Kebab_pr1.webp',
  './images/Zershk_Palau_Haehnchen.webp',
  './images/Chapli_Kebab_pr1.webp',
  './images/Kobide_Kebab_pr1.webp',
  './images/Lamm_Tikka_Kebab.webp',
  './images/Lamm_Kotelett_pr1.webp',
  './images/Mix_Grill_1_Person_pr1.webp',
  './images/Mix_Grill_Grillplatte_pr1.webp',
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
