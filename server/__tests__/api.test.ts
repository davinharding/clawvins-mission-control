// @vitest-environment node
import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';

const state = {
  tasks: [] as any[],
  agents: [] as any[],
  events: [] as any[],
};

const resetState = () => {
  state.tasks = [];
  state.agents = [];
  state.events = [];
};

vi.mock('../db.js', () => {
  const makeId = (prefix: string) => `${prefix}-${Math.random().toString(16).slice(2)}`;
  const now = () => Date.now();

  const formatTask = (task: any) => ({
    ...task,
    tags: JSON.stringify(task.tags ?? []),
    comment_count: task.comment_count ?? 0,
  });

  return {
    getAllTasks: (filters: { status?: string; assignedAgent?: string } = {}) => {
      return state.tasks.filter((task) => {
        if (filters.status && task.status !== filters.status) return false;
        if (filters.assignedAgent && task.assigned_agent !== filters.assignedAgent) return false;
        return task.status !== 'archived';
      });
    },
    getArchivedTasks: () => state.tasks.filter((task) => task.status === 'archived'),
    getArchivedCount: () => state.tasks.filter((task) => task.status === 'archived').length,
    getTaskStatusCounts: () => ({
      backlog: state.tasks.filter((t) => t.status === 'backlog').length,
      todo: state.tasks.filter((t) => t.status === 'todo').length,
      'in-progress': state.tasks.filter((t) => t.status === 'in-progress').length,
      testing: state.tasks.filter((t) => t.status === 'testing').length,
      done: state.tasks.filter((t) => t.status === 'done').length,
    }),
    getWeeklyCompletionStats: () => ({
      dailyCompletions: [],
      thisWeekTotal: 0,
      prevWeekTotal: 0,
    }),
    getTaskById: (id: string) => state.tasks.find((task) => task.id === id) ?? null,
    createTask: (data: any) => {
      const task = formatTask({
        id: makeId('task'),
        title: data.title,
        description: data.description ?? null,
        status: data.status ?? 'backlog',
        assigned_agent: data.assignedAgent ?? null,
        priority: data.priority ?? null,
        created_at: now(),
        updated_at: now(),
        created_by: data.createdBy ?? null,
        tags: data.tags ?? [],
        done_at: null,
        comment_count: 0,
      });
      state.tasks.push(task);
      return task;
    },
    updateTask: (id: string, data: any) => {
      const task = state.tasks.find((t) => t.id === id);
      if (!task) return null;
      const newStatus = data.status ?? task.status;
      let doneAt = task.done_at;
      if (newStatus === 'done' && task.status !== 'done') {
        doneAt = now();
      } else if (newStatus !== 'done' && newStatus !== 'archived') {
        doneAt = null;
      }
      Object.assign(task, {
        title: data.title ?? task.title,
        description: data.description ?? task.description,
        status: newStatus,
        assigned_agent: data.assignedAgent ?? task.assigned_agent,
        priority: data.priority ?? task.priority,
        updated_at: now(),
        tags: data.tags ?? JSON.parse(task.tags || '[]'),
        done_at: doneAt,
      });
      task.tags = JSON.stringify(task.tags ?? []);
      return task;
    },
    deleteTask: (id: string) => {
      const before = state.tasks.length;
      state.tasks = state.tasks.filter((task) => task.id !== id);
      return before !== state.tasks.length;
    },
    getAllAgents: () => state.agents,
    getAgentById: (id: string) => state.agents.find((agent) => agent.id === id) ?? null,
    createAgent: (data: any) => {
      const agent = {
        id: data.id,
        name: data.name,
        role: data.role ?? 'Dev',
        status: data.status ?? 'online',
        last_active: data.lastActive ?? now(),
        avatar_color: data.avatarColor ?? null,
      };
      state.agents.push(agent);
      return agent;
    },
    updateAgent: (id: string, data: any) => {
      const agent = state.agents.find((a) => a.id === id);
      if (!agent) return null;
      Object.assign(agent, {
        name: data.name ?? agent.name,
        role: data.role ?? agent.role,
        status: data.status ?? agent.status,
        last_active: now(),
        avatar_color: data.avatarColor ?? agent.avatar_color,
      });
      return agent;
    },
    getRecentEvents: () => state.events,
    getEventsSince: (timestamp: number) => state.events.filter((event) => event.timestamp >= timestamp),
    getEventById: (id: string) => state.events.find((event) => event.id === id) ?? null,
    createEvent: (data: any) => {
      const event = {
        id: makeId('event'),
        type: data.type,
        message: data.message,
        agent_id: data.agentId ?? null,
        task_id: data.taskId ?? null,
        timestamp: data.timestamp ?? now(),
        detail: data.detail ? JSON.stringify(data.detail) : null,
        agentId: data.agentId ?? null,
        taskId: data.taskId ?? null,
      };
      state.events.unshift(event);
      return event;
    },
    db: {
      close: () => {},
      exec: () => {},
    },
  };
});

import {
  createAgent,
  createEvent,
  createTask,
  getTaskById,
  updateTask,
} from '../db.js';
let baseUrl = '';
let server: import('http').Server;
let authMiddleware: any;
let generateToken: any;

const getAuthHeader = () => {
  const token = generateToken({ id: 'user-1', name: 'Tester', role: 'Dev' });
  return { Authorization: `Bearer ${token}` };
};

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';

  const authModule = await import('../auth.js');
  authMiddleware = authModule.authMiddleware;
  generateToken = authModule.generateToken;

  const tasksRoutes = (await import('../routes/tasks.js')).default;
  const agentsRoutes = (await import('../routes/agents.js')).default;
  const eventsRoutes = (await import('../routes/events.js')).default;

  const app = express();
  app.use(express.json());
  app.use('/api/tasks', authMiddleware, tasksRoutes);
  app.use('/api/agents', authMiddleware, agentsRoutes);
  app.use('/api/events', authMiddleware, eventsRoutes);

  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

beforeEach(() => {
  resetState();
});

afterAll(() => {
  server.close();
});

describe('API endpoints', () => {
  it('GET/POST/PATCH /api/tasks', async () => {
    const createResponse = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'Task A', status: 'todo', tags: [] }),
    });
    expect(createResponse.status).toBe(201);
    const created = await createResponse.json();
    expect(created.task.title).toBe('Task A');

    const listResponse = await fetch(`${baseUrl}/api/tasks`, {
      headers: getAuthHeader(),
    });
    const list = await listResponse.json();
    expect(list.tasks.length).toBe(1);

    const patchResponse = await fetch(`${baseUrl}/api/tasks/${created.task.id}`, {
      method: 'PATCH',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'testing' }),
    });
    const patched = await patchResponse.json();
    expect(patched.task.status).toBe('testing');
  });

  it('GET /api/agents', async () => {
    createAgent({
      id: 'agent-1',
      name: 'Agent One',
      role: 'Dev',
      status: 'online',
      lastActive: Date.now(),
      avatarColor: null,
    });

    const response = await fetch(`${baseUrl}/api/agents`, {
      headers: getAuthHeader(),
    });
    const data = await response.json();
    expect(data.agents.length).toBe(1);
    expect(data.agents[0].name).toBe('Agent One');
  });

  it('GET /api/events', async () => {
    createEvent({
      type: 'task_created',
      message: 'Created task',
      agentId: 'agent-1',
      taskId: null,
      timestamp: Date.now(),
      detail: null,
    });

    const response = await fetch(`${baseUrl}/api/events`, {
      headers: getAuthHeader(),
    });
    const data = await response.json();
    expect(data.events.length).toBe(1);
    expect(data.events[0].type).toBe('task_created');
  });
});

describe('Auth middleware', () => {
  it('rejects missing token', async () => {
    const response = await fetch(`${baseUrl}/api/tasks`);
    expect(response.status).toBe(401);
  });

  it('rejects invalid token', async () => {
    const response = await fetch(`${baseUrl}/api/tasks`, {
      headers: { Authorization: 'Bearer invalid-token' },
    });
    expect(response.status).toBe(401);
  });

  it('rejects expired token', async () => {
    const expiredToken = jwt.sign({ id: 'user', name: 'Expired', role: 'Dev' }, 'test-secret', { expiresIn: -10 });
    const response = await fetch(`${baseUrl}/api/tasks`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    expect(response.status).toBe(401);
  });

  it('accepts valid token', async () => {
    const response = await fetch(`${baseUrl}/api/tasks`, {
      headers: getAuthHeader(),
    });
    expect(response.status).toBe(200);
  });
});

describe('Task status transitions', () => {
  it('tracks done_at when moving to done and clears when leaving', () => {
    const task = createTask({
      title: 'Transition task',
      status: 'todo',
      assignedAgent: null,
      priority: null,
      tags: [],
      createdBy: 'user-1',
    });

    const doneTask = updateTask(task.id, { status: 'done' });
    expect(doneTask.done_at).toBeTruthy();

    const testingTask = updateTask(task.id, { status: 'testing' });
    expect(testingTask.done_at).toBeNull();

    const fresh = getTaskById(task.id);
    expect(fresh.status).toBe('testing');
  });
});
