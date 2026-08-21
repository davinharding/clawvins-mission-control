// Legacy Mission Control worker eviction. This worker never handles fetches or
// claims clients; it only removes app-scoped cache entries and unregisters.
const APP_PREFIX = '/mission_control/';

function isMissionControlRequest(request) {
  try {
    return new URL(request.url).pathname.startsWith(APP_PREFIX);
  } catch (_) {
    return false;
  }
}

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.map(async (name) => {
      if (/mission[-_ ]?control/i.test(name)) {
        await caches.delete(name);
        return;
      }
      const cache = await caches.open(name);
      const requests = await cache.keys();
      await Promise.all(requests.filter(isMissionControlRequest).map((request) => cache.delete(request)));
    }));
    await self.registration.unregister();
  })());
});
