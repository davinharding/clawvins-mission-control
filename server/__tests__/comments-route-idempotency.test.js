// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';

const state = {
  comments: [],
  events: [],
  emitted: [],
};

vi.mock('../db.js', () => ({
  getTaskById: (id) => ({ id, title: 'Stale task' }),
  getCommentsByTask: (taskId) => state.comments.filter((item) => item.task_id === taskId),
  createComment: (data) => {
    const item = {
      id: `comment-${state.comments.length + 1}`,
      task_id: data.taskId,
      author_id: data.authorId,
      author_name: data.authorName,
      text: data.text,
      created_at: state.comments.length + 1,
    };
    state.comments.push(item);
    return item;
  },
  createEvent: (data) => {
    const item = {
      id: `event-${state.events.length + 1}`,
      ...data,
      agentId: data.agentId,
      taskId: data.taskId,
      timestamp: state.events.length + 1,
    };
    state.events.push(item);
    return item;
  },
}));

vi.mock('../validation.js', () => ({
  schemas: { commentCreate: {} },
  validateBody: () => (_req, _res, next) => next(),
}));

let server;
let baseUrl;

beforeAll(async () => {
  const commentsRoutes = (await import('../routes/comments.js')).default;
  const app = express();
  app.io = { emit: (...args) => state.emitted.push(args) };
  app.use(express.json());
  app.use('/api/tasks/:taskId/comments', (req, _res, next) => {
    req.user = { id: 'clawvin', name: 'Clawvin' };
    next();
  }, commentsRoutes);
  server = app.listen(0);
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

beforeEach(() => {
  state.comments.length = 0;
  state.events.length = 0;
  state.emitted.length = 0;
});

afterAll(() => server.close());

const postComment = (text) => fetch(`${baseUrl}/api/tasks/task-1/comments`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text }),
});

describe('comments route nightly sync idempotency', () => {
  it('returns the existing comment and emits no duplicate event for an equivalent consecutive sync note', async () => {
    const created = await postComment('Updated via nightly sync: Still blocked.');
    const duplicate = await postComment(' updated VIA nightly sync :  Still   blocked! ');
    const body = await duplicate.json();

    expect(created.status).toBe(201);
    expect(duplicate.status).toBe(200);
    expect(body).toMatchObject({ deduplicated: true, comment: { id: 'comment-1' } });
    expect(state.comments).toHaveLength(1);
    expect(state.events).toHaveLength(1);
    expect(state.events[0].id).toBe('event-1');
    expect(state.emitted).toHaveLength(2);
  });

  it('preserves repeated legitimate comments and their unique events', async () => {
    await postComment('Legitimate update.');
    await postComment('Legitimate update.');

    expect(state.comments.map((item) => item.id)).toEqual(['comment-1', 'comment-2']);
    expect(state.events.map((item) => item.id)).toEqual(['event-1', 'event-2']);
    expect(state.emitted).toHaveLength(4);
  });
});
