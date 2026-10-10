/* VisMat som app (PWA): alt, appen bruger, gemmes i browserens cache, så den åbner hurtigt og virker uden net.
   Byggeskriptet sætter VERSION (ændres ved hver ny udgave) og FILES (alle appens filer) ind.
   - index.html og de to workers: netværket først (så en ny udgave kommer med det samme), ellers cachen
   - alt andet (Pyodide, Python-pakker, Typst, skrifter, pdf.js): cachen først – de ændrer sig kun med en ny udgave
   - MathLive og Google Fonts (andre servere): fra cachen, og opdateres i baggrunden */
const VERSION = 'b4f59dd37aae';
const FILES = ["cas-worker.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","manifest.webmanifest","pdf-worker.js","pdfjs/pdf.min.js","pdfjs/pdf.worker.min.js","py/pkgs-1.json","py/pkgs-2.json","py/stdlib-1.json","pyodide/pyodide-lock.json","pyodide/pyodide.asm.js","pyodide/pyodide.asm.wasm","pyodide/pyodide.js","typst/compiler-1.wasm","typst/compiler-2.wasm","typst/fonts/DejaVuSansMono.ttf","typst/fonts/InstrumentSans-Regular.ttf","typst/fonts/InstrumentSans-Semibold.ttf","typst/fonts/NewCMMath-Regular.otf","typst/fonts/SourceSerif4-Italic.ttf","typst/fonts/SourceSerif4-Regular.ttf","typst/fonts/SourceSerif4-Semibold.ttf","typst/fonts/SourceSerif4-SemiboldItalic.ttf"];
const CACHE = 'vismat-' + VERSION;
const FRESH = new Set(['', 'index.html', 'cas-worker.js', 'pdf-worker.js', 'manifest.webmanifest']);

self.addEventListener('install', (e) => {
  // hele appen hentes med det samme, så den også virker uden net efter første besøg
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', ...FILES])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('vismat-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

const scope = () => new URL(self.registration.scope);
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    const rel = url.pathname.startsWith(scope().pathname) ? url.pathname.slice(scope().pathname.length) : null;
    if (rel === null) return;
    if (req.mode === 'navigate' || FRESH.has(rel)) e.respondWith(networkFirst(req, req.mode === 'navigate' ? './' : null));
    else e.respondWith(cacheFirst(req));
  } else if (/(^|\.)(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(url.hostname)) {
    e.respondWith(staleWhileRevalidate(req));
  }
});

async function networkFirst(req, fallbackKey) {
  const c = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) c.put(fallbackKey || req, res.clone());
    return res;
  } catch (err) {
    const hit = (await c.match(fallbackKey || req)) || (await c.match(req, { ignoreSearch: true }));
    if (hit) return hit;
    throw err;
  }
}
async function cacheFirst(req) {
  const c = await caches.open(CACHE);
  const hit = await c.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) c.put(req, res.clone());
  return res;
}
async function staleWhileRevalidate(req) {
  const c = await caches.open(CACHE);
  const hit = await c.match(req);
  const net = fetch(req).then((res) => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit);
  return hit || net;
}
