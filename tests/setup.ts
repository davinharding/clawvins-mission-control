import { afterEach, beforeEach } from 'vitest';

const originalFetch = globalThis.fetch;
const needsPolyfill =
  typeof globalThis.localStorage === 'undefined' ||
  typeof globalThis.localStorage?.getItem !== 'function' ||
  typeof globalThis.localStorage?.setItem !== 'function' ||
  typeof globalThis.localStorage?.removeItem !== 'function';

if (needsPolyfill) {
  class LocalStorageMock {
    private store: Record<string, string> = {};

    getItem(key: string): string | null {
      return this.store[key] || null;
    }

    setItem(key: string, value: string): void {
      this.store[key] = value;
    }

    removeItem(key: string): void {
      delete this.store[key];
    }

    clear(): void {
      this.store = {};
    }

    get length(): number {
      return Object.keys(this.store).length;
    }

    key(index: number): string | null {
      const keys = Object.keys(this.store);
      return keys[index] || null;
    }
  }

  globalThis.localStorage = new LocalStorageMock() as Storage;
}

beforeEach(() => {
  // Ensure a predictable baseline for localStorage and fetch between tests.
  if (typeof localStorage !== 'undefined') {
    if (typeof localStorage.clear === 'function') {
      localStorage.clear();
    } else if (typeof localStorage.removeItem === 'function') {
      while (localStorage.length > 0) {
        const key = localStorage.key(0);
        if (!key) {
          break;
        }
        localStorage.removeItem(key);
      }
    }
  }
});

afterEach(() => {
  if (originalFetch) {
    globalThis.fetch = originalFetch;
  }
});

// Happy-dom does not ship matchMedia by default in all versions.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      media: query,
      matches: false,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

if (!globalThis.crypto) {
  globalThis.crypto = {} as Crypto;
}

if (!('randomUUID' in globalThis.crypto)) {
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    value: () => `uuid-${Math.random().toString(16).slice(2)}`,
  });
}
