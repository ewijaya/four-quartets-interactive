/*
 * Four Quartets service worker. scripts/build-sw.ts fills in the placeholders
 * and writes dist/sw.js after each build; edit this template, not the output.
 *
 * - Pages: network first (a new deploy shows at once), then the cached copy,
 *   then the offline page.
 * - /_astro/ files are content-hashed and never change: cache first, and
 *   carried over from the previous version instead of downloaded again.
 * - Everything else of ours (icons, stills, concordance): the cached copy at
 *   once, refreshed in the background.
 * - Every visitor gets the small CORE set. When the site runs as an installed
 *   app, the page asks for READER too: all four quartets with their notes.
 */
const VERSION = "__VERSION__";
const BASE = "__BASE__";
const CORE = __CORE__;
const READER = __READER__;
const CACHE = `sp-${VERSION}`;
const OFFLINE = `${BASE}/offline/`;

self.addEventListener("install", (event) => {
  event.waitUntil(fill(CORE).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      for (const key of await caches.keys()) {
        if (key === CACHE || !key.startsWith("sp-")) continue;
        const old = await caches.open(key);
        for (const req of await old.keys()) {
          if (!new URL(req.url).pathname.startsWith(`${BASE}/_astro/`) || (await cache.match(req))) continue;
          const res = await old.match(req);
          if (res) await cache.put(req, res);
        }
        await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "cache-reader") event.waitUntil(fill(READER));
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || req.headers.has("range")) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(`${BASE}/`)) return;
  if (url.pathname === `${BASE}/sw.js` || url.pathname.startsWith(`${BASE}/pagefind/`)) return;
  if (isPage(req, url)) event.respondWith(page(event, req, url));
  else if (url.pathname.startsWith(`${BASE}/_astro/`)) event.respondWith(immutable(event, req));
  else event.respondWith(revalidate(event, req));
});

const isPage = (req, url) =>
  req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html") || /\/[^./]*$/.test(url.pathname);

/** Pages are stored under one key per address: no query, no fragment, a trailing slash. */
function pageKey(href) {
  const u = new URL(href);
  u.search = "";
  u.hash = "";
  if (!u.pathname.endsWith("/")) u.pathname += "/";
  return u.href;
}

/** A redirected response cannot answer a navigation; store a plain copy. */
const plain = (res) => (res.redirected ? new Response(res.body, { status: res.status, statusText: res.statusText, headers: res.headers }) : res);

// Cache writes run in the background (waitUntil) so a page streams in as it arrives.
async function page(event, req, url) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok && (res.headers.get("content-type") || "").includes("text/html")) {
      event.waitUntil(cache.put(pageKey(res.url || url.href), plain(res.clone())));
    }
    return res;
  } catch (err) {
    return (await cache.match(pageKey(url.href))) || (await cache.match(OFFLINE)) || Response.error();
  }
}

async function immutable(event, req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) event.waitUntil(cache.put(req, res.clone()));
  return res;
}

async function revalidate(event, req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const fresh = fetch(req)
    .then(async (res) => {
      if (res.ok && res.type === "basic") event.waitUntil(cache.put(req, res.clone()));
      return res;
    })
    .catch(() => undefined);
  if (hit) {
    event.waitUntil(fresh);
    return hit;
  }
  return (await fresh) || Response.error();
}

/** Cache whatever of `urls` is not cached yet, six requests at a time. Failures are skipped. */
async function fill(urls) {
  const cache = await caches.open(CACHE);
  const queue = [...urls];
  const worker = async () => {
    for (let u = queue.shift(); u; u = queue.shift()) {
      const key = u.endsWith("/") ? pageKey(new URL(u, self.location.href).href) : u;
      if (await cache.match(key)) continue;
      try {
        // Hashed files may come from the browser's own cache; pages are checked with the server.
        const res = await fetch(u, { cache: u.includes("/_astro/") ? "default" : "no-cache" });
        if (res.ok) await cache.put(key, plain(res));
      } catch (err) {
        /* offline or gone: try again on the next request */
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
}
