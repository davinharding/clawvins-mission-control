import { describe, it, expect, vi, beforeEach } from 'vitest';
import { login, getToken, setToken, clearToken, storeCredentials, getStoredCredentials } from '@/lib/api';

describe('Auth flow', () => {
  beforeEach(() => {
    clearToken();
  });

  it('logs in and stores token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'jwt-123', user: { id: 'u1', name: 'Test', role: 'Dev' } }),
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const response = await login('user', 'pass');
    setToken(response.token);

    expect(getToken()).toBe('jwt-123');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/login'),
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('stores and retrieves refresh credentials', () => {
    storeCredentials('user', 'pass');
    const creds = getStoredCredentials();
    expect(creds).toEqual({ username: 'user', password: 'pass' });
  });
});
