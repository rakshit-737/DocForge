/// <reference lib="webworker" />
/* The studio's service worker — full offline after first load (§5.3: the
   studio works with the network cable cut). Serwist is used as a runtime
   library and this file is compiled to public/sw.js by scripts/sync-assets
   (the @serwist/next plugin is webpack-only; the app builds on Turbopack),
   so there is no injected precache manifest: the caches fill as you visit,
   and every studio asset is same-origin, so one full load = offline forever.
   sw-register.tsx registers it in production. */
import { CacheFirst, NetworkFirst, Serwist, StaleWhileRevalidate } from "serwist";

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // pages: fresh when the wire is up, cached when it is cut
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkFirst({ cacheName: "docforge-pages", networkTimeoutSeconds: 4 }),
    },
    {
      // hashed build assets are immutable
      matcher: ({ url }) => url.pathname.startsWith("/_next/static/"),
      handler: new CacheFirst({ cacheName: "docforge-build" }),
    },
    {
      // the embedded faces — immutable cuts
      matcher: ({ url }) => url.pathname.startsWith("/fonts/"),
      handler: new CacheFirst({ cacheName: "docforge-fonts" }),
    },
    {
      // everything else same-origin (doc.css, fonts.css, icons, manifest)
      matcher: ({ url }) => url.origin === self.location.origin,
      handler: new StaleWhileRevalidate({ cacheName: "docforge-surface" }),
    },
  ],
});

serwist.addEventListeners();
