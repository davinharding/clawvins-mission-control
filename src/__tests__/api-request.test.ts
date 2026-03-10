import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTasks, setToken, clearToken } from '@/lib/api';

describe('API request helper', () => {
  beforeEach(() => {
    clearToken();
  });

  it('attaches auth header when token exists', async () => {
    setToken('token-abc');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tasks: [] }),
    });
    globalThis.fetch = fetchMock as typeof fetch;

    await getTasks();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/tasks'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer token-abc' }),
      })
    );
  });

  it('throws a friendly error on 401 refresh failure', async () => {
    setToken('token-abc');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

    globalThis.fetch = fetchMock as typeof fetch;

    await expect(getTasks()).rejects.toThrow('SESSION_EXPIRED');
  });
});
