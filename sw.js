/* Guarda o app no iPhone para funcionar sem internet.
   Ao publicar uma versão nova, troque o número abaixo. */
const CACHE = "fitfred-v0.3";
const ARQUIVOS = ["./", "index.html", "styles.css", "app.js", "ficha.js", "corpo.js", "graficos.js", "treino.txt", "manifest.webmanifest",
  "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Abre do cache na hora (rápido e offline) e atualiza em segundo plano quando houver internet.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const salvo = await c.match(e.request, { ignoreSearch: true });
    const rede = fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => salvo);
    return salvo || rede;
  }));
});
