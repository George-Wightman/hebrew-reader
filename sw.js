/* Service worker for the Hebrew Voice Note Reader.
   ================================================
   The app is one 750KB HTML file with no build step, and that stays true — this
   caches it, it does not bundle it.

   STRATEGY: stale-while-revalidate for the app shell.

   Cache-first alone would be wrong here. George edits hebrew-reader.html directly and
   opens it constantly; a pure cache-first worker would pin him to whatever version was
   installed first and there would be no obvious way out — the classic "I fixed it but
   the phone still shows the old one" trap, on an app with no release process to hang a
   cache-busting version on.

   Network-first alone would also be wrong: it costs a round trip on every launch, and
   the whole point of installing this is that it opens on the Underground.

   So: serve from cache immediately (instant, offline), fetch a fresh copy in the
   background, and if the bytes actually changed, tell the page. The page decides what
   to do about it — a drill session must never be interrupted by a reload. */

const CACHE = "hvr-shell-v3";

/* Cache under the path alone, never the query string.
   Found the hard way: matching with {ignoreSearch:true} but storing the full request
   meant "?selftest=1" was written as its own entry. The two then drifted — the plain
   URL kept serving a stale build while the query-string copy held the current one, and
   reloading "to take the update" served the old bytes forever.
   The query string here only ever selects behaviour INSIDE the same document, so it is
   the same resource and must be one cache entry. */
function cacheKey(request) {
  const url = new URL(request.url);
  return new Request(url.origin + url.pathname, { method: "GET" });
}

/* Everything needed to boot with no network. Deliberately short: this app has no
   dependencies, which is the one real advantage of the single-file design. */
const SHELL = [
  "./",
  "./hebrew-reader.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      /* addAll is atomic — one 404 and NOTHING is cached, leaving a worker installed
         that can serve nothing. Added individually so a missing icon costs an icon
         rather than the whole offline capability. */
      .then((cache) => Promise.all(
        SHELL.map((url) => cache.add(url).catch(() => null))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => n !== CACHE).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

/* Tell every open page that the shell changed underneath it. */
async function announceUpdate() {
  const clients = await self.clients.matchAll({ type: "window" });
  clients.forEach((c) => c.postMessage({ type: "shell-updated" }));
}

/* Has the shell actually changed?

   This used to be answered by downloading the whole file and comparing it to the cached
   copy as two strings. On a 1.3MB single-file app opened from a phone's home screen that
   is 1.3MB of traffic and ~2.6MB of string allocation on EVERY launch, to answer a
   question the response headers usually answer for free.

   So: ask conditionally. The cached copy's Last-Modified goes back as If-Modified-Since,
   and an unchanged shell comes back as a 304 with no body at all. GitHub Pages and
   python -m http.server both honour it. The text comparison is kept as the fallback for
   a server that sends no Last-Modified, because "I cannot tell" must not become "it
   changed" — that is what made the app announce a new version on every single load once
   before. */
function lastModifiedOf(resp) {
  const v = resp && resp.headers && resp.headers.get("last-modified");
  const t = v ? Date.parse(v) : NaN;
  return isNaN(t) ? null : t;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;

  /* Only GET, and only our own origin. Gemini calls, Google's speech endpoints and
     anything else cross-origin must go straight to the network untouched — caching a
     POST to an API would be meaningless, and intercepting them would put this worker
     in the path of every quota decision the app makes. */
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = cacheKey(req);
    const cached = await cache.match(key);

    /* Cloned HERE, before `cached` is handed to respondWith.
       Getting this wrong is subtle and total: once the browser starts consuming the
       returned body, cloning it throws, the comparison below lands in its catch, and
       `changed` defaults to true — so the app announced a new version on every single
       load, including immediately after taking one. Clone while the body is still
       untouched and the comparison is real. */
    const previous = cached ? cached.clone() : null;

    /* The revalidation request. Conditional when we have a Last-Modified to quote and
       nothing is waiting on the body — which is the launch case, where `cached` wins the
       race below and this response is only ever used to decide "has it changed". With
       nothing cached we need the bytes themselves, so the plain request goes out. */
    const cachedLM = lastModifiedOf(cached);
    const revalidate = (cached && cachedLM !== null)
      ? fetch(req.url, { cache: "no-store",
                         headers: { "If-Modified-Since": cached.headers.get("last-modified") } })
      : fetch(req);

    const network = revalidate.then(async (resp) => {
      /* 304: the server has just told us the cached copy is current. No body, nothing
         to store, nothing to announce — and no megabyte spent finding that out. */
      if (resp && resp.status === 304) return null;
      /* Opaque and error responses must never overwrite a good cached copy —
         that is how an offline app caches a captive-portal login page and
         becomes permanently broken. */
      if (resp && resp.ok && resp.type === "basic") {
        const forCache = resp.clone();
        const forCompare = resp.clone();
        /* Compare before storing, so "updated" means the bytes actually changed
           rather than merely that a request succeeded. Headers first: when both sides
           carry a Last-Modified the answer is a number comparison, and the bodies are
           never read. */
        let changed = true;
        if (previous) {
          const freshLM = lastModifiedOf(resp);
          if (cachedLM !== null && freshLM !== null) {
            changed = freshLM > cachedLM;
          } else {
            try {
              const [a, b] = await Promise.all([previous.text(), forCompare.text()]);
              changed = a !== b;
            } catch (e) { changed = true; }
          }
        }
        await cache.put(key, forCache);
        if (previous && changed) announceUpdate();
      }
      return resp;
    }).catch(() => null);

    /* Cached copy wins the race when there is one — that is the whole point. */
    if (cached) return cached;

    const resp = await network;
    if (resp) return resp;

    /* Nothing cached and no network. For a navigation, fall back to the app itself so
       a deep link still opens something rather than the browser's offline dinosaur. */
    if (req.mode === "navigate") {
      const shell = await cache.match("./hebrew-reader.html");
      if (shell) return shell;
    }
    return new Response("Offline, and this isn't saved on the device yet.", {
      status: 503,
      headers: { "Content-Type": "text/plain" }
    });
  })());
});

/* The page asks for this when the user chooses to take an update. */
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "skip-waiting") self.skipWaiting();
});
