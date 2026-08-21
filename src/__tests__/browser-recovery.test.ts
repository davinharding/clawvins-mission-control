import { afterEach, describe, expect, it, vi } from 'vitest';
import { evictMissionControlCaches, recoverMissionControlApp } from '@/lib/browserRecovery';

type CacheDouble = {
  keys: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

function request(url: string): Request {
  return { url } as Request;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Mission Control browser recovery', () => {
  it('deletes app caches and only app entries from shared caches', async () => {
    const shared: CacheDouble = {
      keys: vi.fn().mockResolvedValue([
        request('https://example.test/mission_control/assets/old.js'),
        request('https://example.test/file_explorer/assets/current.js'),
      ]),
      delete: vi.fn().mockResolvedValue(true),
    };
    const cacheStorage = {
      keys: vi.fn().mockResolvedValue(['mission-control-v1', 'shared-origin-cache']),
      delete: vi.fn().mockResolvedValue(true),
      open: vi.fn().mockResolvedValue(shared),
    };
    vi.stubGlobal('caches', cacheStorage);

    await evictMissionControlCaches();

    expect(cacheStorage.delete).toHaveBeenCalledExactlyOnceWith('mission-control-v1');
    expect(shared.delete).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ url: 'https://example.test/mission_control/assets/old.js' }),
    );
    expect(shared.delete).not.toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://example.test/file_explorer/assets/current.js' }),
    );
  });

  it('unregisters only Mission Control workers and preserves browser storage', async () => {
    const appUnregister = vi.fn().mockResolvedValue(true);
    const otherUnregister = vi.fn().mockResolvedValue(true);
    const registrations = [
      { scope: 'https://example.test/mission_control/', active: null, waiting: null, installing: null, unregister: appUnregister },
      { scope: 'https://example.test/file_explorer/', active: null, waiting: null, installing: null, unregister: otherUnregister },
    ] as unknown as ServiceWorkerRegistration[];
    const serviceWorker = { getRegistrations: vi.fn().mockResolvedValue(registrations) };
    vi.stubGlobal('navigator', { ...navigator, serviceWorker });
    vi.stubGlobal('caches', {
      keys: vi.fn().mockResolvedValue([]),
      delete: vi.fn(),
      open: vi.fn(),
    });
    localStorage.setItem('auth-token', 'keep-me');

    await recoverMissionControlApp();

    expect(appUnregister).toHaveBeenCalledOnce();
    expect(otherUnregister).not.toHaveBeenCalled();
    expect(localStorage.getItem('auth-token')).toBe('keep-me');
  });
});
