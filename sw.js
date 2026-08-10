/* ZEM CO Fast Landed Cost — offline support.
 *
 * Network-first, cache as fallback. Deliberately not cache-first: this tool
 * produces figures people commit money against, so an online device must always
 * get the current file rather than a copy that happens to still be on disk.
 * Offline, or on a connection too poor to answer inside the timeout, it serves
 * the last good copy instead of failing to open at all.
 */
const CACHE = "zemco-landed-cost-v1";
const ASSETS = ["./", "./index.html", "./apple-touch-icon.png", "./icon-192.png", "./icon-512.png", "./manifest.webmanifest"];
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      // one bad asset must not abort the whole install
      .then(cache => Promise.allSettled(ASSETS.map(asset => cache.add(asset))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function fromNetwork(request) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), NETWORK_TIMEOUT_MS);
    fetch(request).then(response => {
      clearTimeout(timer);
      resolve(response);
    }, error => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fromNetwork(request)
      .then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() =>
        caches.match(request, { ignoreSearch: true })
          .then(hit => hit || caches.match("./index.html"))
          .then(hit => hit || Response.error())
      )
  );
});
