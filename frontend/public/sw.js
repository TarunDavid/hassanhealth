/* Offline support: app shell + API data + map tiles are cached as they are used. */
const CACHE = 'hh-v4'
const M = { ignoreVary: true } // dev/prod servers send 'Vary: Origin' which breaks module-script cache hits
const SHELL = ['/', '/manifest.webmanifest', '/favicon.svg']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})
// page tells us which assets it already loaded so a first offline reload works
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'CACHE_URLS') {
    e.waitUntil(caches.open(CACHE).then((c) => Promise.all(e.data.urls.map((u) => c.add(u).catch(() => {})))))
  }
})

async function networkFirst(req, fallbackKey) {
  const c = await caches.open(CACHE)
  try {
    const res = await fetch(req)
    if (res.ok) c.put(req, res.clone())
    return res
  } catch {
    return (await c.match(req, M)) || (fallbackKey && (await c.match(fallbackKey, M))) || Response.error()
  }
}
async function staleWhileRevalidate(req) {
  const c = await caches.open(CACHE)
  const hit = await c.match(req, M)
  const net = fetch(req).then((res) => {
    const html = (res.headers.get('content-type') || '').includes('text/html') // SPA fallback for missing files (e.g. audio)
    if ((res.ok && !html) || res.type === 'opaque') c.put(req, res.clone())
    return res
  }).catch(() => hit || Response.error())
  return hit || net
}

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return // SOS POSTs always go to the network
  const url = new URL(req.url)
  if (req.headers.has('Authorization')) return // anything sent with a login token is never cached
  if (url.pathname.startsWith('/api/')) {
    // Only PUBLIC data is cached for offline use. Accounts, medical records, doctor, admin, tracking and SOS
    // responses are personal or live, so they always go straight to the network and are never stored.
    const PUBLIC_CACHEABLE = ['/api/facilities', '/api/nearest', '/api/camps']
    if (PUBLIC_CACHEABLE.some((p) => url.pathname.startsWith(p))) { e.respondWith(networkFirst(req)); return }
    return
  }
  // links from SMS carry a secret token in the path: never cache those pages
  if (url.pathname.startsWith('/s/') || url.pathname.startsWith('/r/')) return
  if (req.mode === 'navigate') { e.respondWith(networkFirst(req, '/')); return }
  if (url.origin === location.origin || url.hostname.endsWith('tile.openstreetmap.org')) e.respondWith(staleWhileRevalidate(req))
})
