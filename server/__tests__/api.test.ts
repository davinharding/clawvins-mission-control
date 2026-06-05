// @vitest-environment node
import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';

const state = {
  tasks: [] as any[],
  agents: [] as any[],
  events: [] as any[],
  comments: [] as any[],
};

const resetState = () => {
  state.tasks = [];
  state.agents = [];
  state.events = [];
  state.comments = [];
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
    getCommentsByTask: (taskId: string) => state.comments.filter((comment) => comment.task_id === taskId),
    createComment: (data: any) => {
      const comment = {
        id: makeId('comment'),
        task_id: data.taskId,
        author_id: data.authorId,
        author_name: data.authorName,
        text: data.text,
        created_at: now(),
      };
      state.comments.push(comment);
      const task = state.tasks.find((t) => t.id === data.taskId);
      if (task) task.comment_count = (task.comment_count ?? 0) + 1;
      return comment;
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
    getEventsBefore: (timestamp: number, limit = 50) =>
      state.events.filter((event) => event.timestamp < timestamp).slice(0, limit),
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

const getAgentAuthHeader = (agentId = 'agent-patch', agentName = 'Patch', key = 'test-patch-key') => ({
  'x-api-key': key,
  'x-agent-id': agentId,
  'x-agent-name': agentName,
});

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.AGENT_API_KEY = 'test-agent-key';
  process.env.AGENT_API_KEYS = JSON.stringify({
    'test-patch-key': { id: 'agent-patch', name: 'Patch', role: 'Dev' },
    'test-nova-key': { id: 'agent-nova', name: 'Nova', role: 'Research' },
  });

  const authModule = await import('../auth.js');
  authMiddleware = authModule.authMiddleware;
  generateToken = authModule.generateToken;

  const tasksRoutes = (await import('../routes/tasks.js')).default;
  const agentTasksRoutes = (await import('../routes/agent-tasks.js')).default;
  const agentsRoutes = (await import('../routes/agents.js')).default;
  const eventsRoutes = (await import('../routes/events.js')).default;

  const app = express();
  app.use(express.json());
  app.use('/api/tasks', authMiddleware, tasksRoutes);
  app.use('/api/agent-tasks', agentTasksRoutes);
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

  it('rejects mobile overflow verification fixtures as live tasks', async () => {
    const response = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Mobile overflow screenshot 1780449052958',
        status: 'todo',
        priority: 'medium',
        tags: ['mobile', 'overflow'],
        description:
          'Description with inline path `/home/node/.openclaw/workspace-coder/some/really/deep/path/task-bb0e6000-d69e-4428-ab56-42dd93f97831/abcdefghijklmnopqrstuvwxyz0123456789/index.tsx`.',
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(JSON.stringify(body)).toContain('Verification fixtures');
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

describe('Agent task endpoints', () => {
  it('returns only tasks assigned to the authenticated agent', async () => {
    createTask({
      title: 'Patch task',
      status: 'todo',
      assignedAgent: 'agent-patch',
      priority: 'medium',
      tags: [],
      createdBy: 'user-1',
    });
    createTask({
      title: 'Other task',
      status: 'todo',
      assignedAgent: 'agent-nova',
      priority: 'medium',
      tags: [],
      createdBy: 'user-1',
    });

    const response = await fetch(`${baseUrl}/api/agent-tasks/mine`, {
      headers: getAgentAuthHeader(),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.count).toBe(1);
    expect(data.tasks[0].title).toBe('Patch task');
    expect(data.tasks[0].assignedAgent).toBe('agent-patch');
  });

  it('requires an agent-authored comment before agent handoff to testing', async () => {
    const task = createTask({
      title: 'Needs comment before testing',
      status: 'todo',
      assignedAgent: 'agent-patch',
      priority: 'medium',
      tags: [],
      createdBy: 'user-1',
    });

    const response = await fetch(`${baseUrl}/api/agent-tasks/${task.id}/status`, {
      method: 'PATCH',
      headers: {
        ...getAgentAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'testing' }),
    });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toContain('Agent comment required');
    expect(getTaskById(task.id).status).toBe('todo');
  });

  it('allows agents to move tasks through testing and archived statuses after commenting', async () => {
    const task = createTask({
      title: 'Lifecycle task',
      status: 'todo',
      assignedAgent: 'agent-patch',
      priority: 'medium',
      tags: [],
      createdBy: 'user-1',
    });

    await fetch(`${baseUrl}/api/agent-tasks/${task.id}/comment`, {
      method: 'POST',
      headers: {
        ...getAgentAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: 'Starting work and will hand off after verification.' }),
    });

    const testingResponse = await fetch(`${baseUrl}/api/agent-tasks/${task.id}/status`, {
      method: 'PATCH',
      headers: {
        ...getAgentAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'testing' }),
    });
    const testing = await testingResponse.json();

    expect(testingResponse.status).toBe(200);
    expect(testing.task.status).toBe('testing');

    const archivedResponse = await fetch(`${baseUrl}/api/agent-tasks/${task.id}/status`, {
      method: 'PATCH',
      headers: {
        ...getAgentAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'archived' }),
    });
    const archived = await archivedResponse.json();

    expect(archivedResponse.status).toBe(200);
    expect(archived.task.status).toBe('archived');
  });

  it('requires an agent-authored comment before agent full-update completion', async () => {
    const task = createTask({
      title: 'Needs comment before done',
      status: 'in-progress',
      assignedAgent: 'agent-patch',
      priority: 'medium',
      tags: [],
      createdBy: 'user-1',
    });

    const response = await fetch(`${baseUrl}/api/agent-tasks/${task.id}`, {
      method: 'PATCH',
      headers: {
        ...getAgentAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'done' }),
    });

    expect(response.status).toBe(409);
    expect(getTaskById(task.id).status).toBe('in-progress');
  });

  it('does not require comments for human JWT updates through agent task endpoints', async () => {
    const task = createTask({
      title: 'Human status move',
      status: 'todo',
      assignedAgent: 'agent-patch',
      priority: 'medium',
      tags: [],
      createdBy: 'user-1',
    });

    const response = await fetch(`${baseUrl}/api/agent-tasks/${task.id}/status`, {
      method: 'PATCH',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'testing' }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.task.status).toBe('testing');
  });

  it('attributes agent comments from the API key mapping', async () => {
    const task = createTask({
      title: 'Comment task',
      status: 'todo',
      assignedAgent: 'agent-patch',
      priority: 'medium',
      tags: [],
      createdBy: 'user-1',
    });

    const response = await fetch(`${baseUrl}/api/agent-tasks/${task.id}/comment`, {
      method: 'POST',
      headers: {
        ...getAgentAuthHeader('agent-patch', 'Spoofed Display Name'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: 'Working on this.' }),
    });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.comment.authorId).toBe('agent-patch');
    expect(data.comment.authorName).toBe('Patch');
  });

  it('rejects agent API key spoofing with a mismatched x-agent-id', async () => {
    const task = createTask({
      title: 'Spoof target',
      status: 'todo',
      assignedAgent: 'agent-patch',
      priority: 'medium',
      tags: [],
      createdBy: 'user-1',
    });

    const response = await fetch(`${baseUrl}/api/agent-tasks/${task.id}/comment`, {
      method: 'POST',
      headers: {
        ...getAgentAuthHeader('agent-nova', 'Nova', 'test-patch-key'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: 'Pretending to be Nova.' }),
    });

    expect(response.status).toBe(403);
  });

  it('keeps JWT attribution for human task comments', async () => {
    const task = createTask({
      title: 'Human comment task',
      status: 'todo',
      assignedAgent: 'agent-patch',
      priority: 'medium',
      tags: [],
      createdBy: 'user-1',
    });

    const response = await fetch(`${baseUrl}/api/tasks/${task.id}/comments`, {
      method: 'POST',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: 'Human comment.' }),
    });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.comment.authorId).toBe('user-1');
    expect(data.comment.authorName).toBe('Tester');
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
