/* Planche – service worker : fonctionne hors ligne et reçoit les photos partagées depuis la Galerie */
const V = 'planche-e9f6f6052d';
const SHELL = ['./', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith('planche-') && k !== V && k !== 'planche-partage' && k !== 'planche-polices').map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
async function receive(req) {
  try {
    const fd = await req.formData();
    const files = fd.getAll('media').filter(f => f && typeof f !== 'string');
    const c = await caches.open('planche-partage');
    for (const k of await c.keys()) await c.delete(k);
    let i = 0;
    for (const f of files) {
      const name = f.name || 'fichier';
      await c.put(new Request('./partage-fichier/' + String(i++).padStart(3, '0') + '/' + encodeURIComponent(name)),
        new Response(f, { headers: { 'Content-Type': f.type || 'application/octet-stream', 'X-Name': encodeURIComponent(name), 'X-Modified': String(f.lastModified || Date.now()) } }));
    }
  } catch (err) { /* on ouvre Planche quand même */ }
  return Response.redirect('./?partage=' + Date.now(), 303);
}
self.addEventListener('fetch', e => {
  const req = e.request, u = new URL(req.url);
  if (req.method === 'POST' && u.origin === location.origin && u.pathname.endsWith('/partage')) { e.respondWith(receive(req)); return; }
  if (req.method !== 'GET') return;
  if (/^fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) {
    e.respondWith(caches.open('planche-polices').then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const r = await fetch(req); if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r;
    }));
    return;
  }
  if (u.origin !== location.origin) return;
  e.respondWith(caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then(r => r || fetch(req).catch(() => req.mode === 'navigate' ? caches.match('./') : Response.error())));
});
