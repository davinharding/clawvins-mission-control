const APP_PREFIX = '/mission_control/';

function isMissionControlUrl(value: string): boolean {
  try {
    return new URL(value, window.location.href).pathname.startsWith(APP_PREFIX);
  } catch {
    return false;
  }
}

function isMissionControlRegistration(registration: ServiceWorkerRegistration): boolean {
  const worker = registration.active || registration.waiting || registration.installing;
  return isMissionControlUrl(registration.scope) || Boolean(worker && isMissionControlUrl(worker.scriptURL));
}

export async function evictMissionControlCaches(): Promise<void> {
  if (!('caches' in window)) return;

  const names = await caches.keys();
  await Promise.all(names.map(async (name) => {
    if (/mission[-_ ]?control/i.test(name)) {
      await caches.delete(name);
      return;
    }

    const cache = await caches.open(name);
    const requests = await cache.keys();
    await Promise.all(
      requests
        .filter((request) => isMissionControlUrl(request.url))
        .map((request) => cache.delete(request)),
    );
  }));
}

export async function recoverMissionControlApp(): Promise<void> {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations
        .filter(isMissionControlRegistration)
        .map((registration) => registration.unregister()),
    );
  }

  await evictMissionControlCaches();
}
