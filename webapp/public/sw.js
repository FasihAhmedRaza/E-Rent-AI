// Minimal service worker: makes the app installable (Add to Home Screen) on Android/Chrome.
// Network-first pass-through — we do NOT cache, so the app always shows fresh data
// (landData.json updates immediately after each scrape). No offline mode by design.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => { /* pass through to network */ })
