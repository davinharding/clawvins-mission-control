import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCosts, getTasks, setToken, clearToken } from '@/lib/api';

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

  it('normalizes malformed cost payloads to safe numbers and arrays', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        summary: {
          totalBilledCost: { bad: true },
          totalAnthropicCost: '2.5',
          todayBilledCost: 'nan',
          weekBilledCost: 1,
          monthBilledCost: 2,
        },
        periodData: [
          {
            timestamp: Date.now(),
            billedCost: '1.2',
            coveredCost: '0.8',
            count: '3',
          },
        ],
        providerBreakdown: null,
        agentBreakdown: undefined,
      }),
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const data = await getCosts();

    expect(data.summary.totalBilledCost).toBe(0);
    expect(data.summary.totalCoveredCost).toBe(2.5);
    expect(data.summary.todayBilledCost).toBe(0);
    expect(data.periodData[0].billedCost).toBe(1.2);
    expect(data.periodData[0].coveredCost).toBe(0.8);
    expect(data.providerBreakdown).toEqual([]);
    expect(data.agentBreakdown).toEqual([]);
  });
});
