import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTask, updateTask, deleteTask, setToken } from '@/lib/api';

describe('Task CRUD', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined' && typeof localStorage.removeItem === 'function') {
      while (localStorage.length > 0) {
        const key = localStorage.key(0);
        if (!key) {
          break;
        }
        localStorage.removeItem(key);
      }
    }
    setToken('token-123');
  });

  it('creates a task', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        task: {
          id: 'task-1',
          title: 'New task',
          status: 'todo',
          createdAt: 1000,
          updatedAt: 1000,
          tags: [],
        },
      }),
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const response = await createTask({ title: 'New task', status: 'todo' });

    expect(response.task.id).toBe('task-1');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/tasks'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-123',
        }),
      })
    );
  });

  it('updates task status', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        task: {
          id: 'task-1',
          title: 'New task',
          status: 'testing',
          createdAt: 1000,
          updatedAt: 2000,
          tags: [],
        },
      }),
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const response = await updateTask('task-1', { status: 'testing' });

    expect(response.task.status).toBe('testing');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/tasks/task-1'),
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-123',
        }),
      })
    );
  });

  it('deletes a task', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const response = await deleteTask('task-1');

    expect(response.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/tasks/task-1'),
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({
          Authorization: 'Bearer token-123',
        }),
      })
    );
  });
});
