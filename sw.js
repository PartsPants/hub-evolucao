/* Hub de Evolução · service worker
   Guarda o "esqueleto" do site no aparelho para abrir rápido e funcionar sem internet.
   Os dados NÃO passam por aqui: eles vão direto para o Supabase (ou para a fila offline do site).
   Ao publicar uma versão nova, mude o número abaixo. */
const VERSAO = 'hub-v1';
const ESQUELETO = [
  './', './index.html', './app.js', './nucleo.js', './config.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => Promise.all(ESQUELETO.map(u => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

/* rede primeiro (para pegar atualizações), cópia do aparelho se a rede falhar ou demorar */
async function redePrimeiro(req, chaveCache) {
  const cache = await caches.open(VERSAO);
  try {
    const resp = await Promise.race([fetch(req), new Promise((_, no) => setTimeout(() => no(new Error('lento')), 4000))]);
    if (resp && resp.ok) cache.put(chaveCache || req, resp.clone());
    return resp;
  } catch (_) {
    const c = await cache.match(chaveCache || req, { ignoreSearch: true });
    if (c) return c;
    if (req.mode === 'navigate') { const i = await cache.match('./index.html'); if (i) return i; }
    return Response.error();
  }
}
async function cachePrimeiro(req) {
  const cache = await caches.open(VERSAO);
  const c = await cache.match(req);
  if (c) return c;
  const resp = await fetch(req);
  if (resp && (resp.ok || resp.type === 'opaque')) cache.put(req, resp.clone());
  return resp;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    e.respondWith(redePrimeiro(req, req.mode === 'navigate' ? './index.html' : undefined));
    return;
  }
  if (url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(cachePrimeiro(req));
  }
  /* Supabase, Strava, Notion: sempre direto pela rede */
});
