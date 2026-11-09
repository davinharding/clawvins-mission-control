#!/usr/bin/env node
/**
 * Seed Mission Control with a self-contained demo dataset.
 *
 * Unlike `server/seed.js`, this does not need a running OpenClaw gateway:
 * it creates a fictional agent team, a populated board, comments and a
 * live-looking event feed so you can explore the UI locally.
 *
 *   npm run seed:demo
 *
 * WARNING: clears existing tasks, comments, events and agents.
 */
import 'dotenv/config';
import { db, createAgent, createTask, createEvent, createComment } from '../server/db.js';

const MIN = 60 * 1000;
const now = Date.now();

db.prepare('DELETE FROM comments').run();
db.prepare('DELETE FROM events').run();
db.prepare('DELETE FROM tasks').run();
db.prepare('DELETE FROM agents').run();

const agents = [
  { id: 'agent-clawvin', name: 'Clawvin', role: 'Main', status: 'online', avatarColor: '#3b82f6' },
  { id: 'agent-patch', name: 'Patch', role: 'Dev', status: 'busy', avatarColor: '#f59e0b' },
  { id: 'agent-forge', name: 'Forge', role: 'Dev', status: 'online', avatarColor: '#f97316' },
  { id: 'agent-scout', name: 'Scout', role: 'Research', status: 'online', avatarColor: '#a855f7' },
  { id: 'agent-atlas', name: 'Atlas', role: 'Research', status: 'offline', avatarColor: '#8b5cf6' },
  { id: 'agent-ledger', name: 'Ledger', role: 'Ops', status: 'online', avatarColor: '#10b981' },
  { id: 'agent-iris', name: 'Iris', role: 'Ops', status: 'offline', avatarColor: '#14b8a6' },
];
agents.forEach((a) => createAgent(a));

const tasks = [
  ['Ship WebSocket reconnect with backoff', 'Clients should resubscribe and replay missed events after a dropped connection.', 'in-progress', 'agent-patch', 'high', ['realtime', 'frontend']],
  ['Agent API: bulk status updates', 'Let an agent move several tasks in one request to cut chatter on the event feed.', 'todo', 'agent-forge', 'medium', ['api']],
  ['Competitive scan: agent dashboards', 'Summarize how other orchestration tools surface agent state and handoffs.', 'in-progress', 'agent-scout', 'medium', ['research']],
  ['Nightly dependency audit', 'Run audit, open PRs for safe patch bumps, flag majors for review.', 'testing', 'agent-patch', 'low', ['maintenance']],
  ['Playwright coverage for drag and drop', 'Cover column moves, archive drop target and optimistic rollback.', 'testing', 'agent-forge', 'high', ['tests']],
  ['Weekly cost report', 'Roll up model and infra spend per agent and post to the board.', 'todo', 'agent-ledger', 'medium', ['ops', 'reporting']],
  ['Draft launch announcement', 'Short post + changelog for the realtime release.', 'backlog', 'agent-iris', 'low', ['content']],
  ['Evaluate SQLite to Postgres path', 'Document when the single-file DB stops being enough and what migration looks like.', 'backlog', 'agent-atlas', 'medium', ['architecture']],
  ['Notification tray: mark all read', 'Add bulk dismiss and unread count badge.', 'done', 'agent-patch', 'low', ['frontend']],
  ['JWT refresh token rotation', 'Rotate refresh tokens on use and revoke on logout.', 'done', 'agent-forge', 'critical', ['security', 'api']],
  ['Linkify URLs in comments', 'Auto-link URLs in comments and event descriptions.', 'done', 'agent-patch', 'low', ['frontend']],
  ['Morning brief for the team', 'Clawvin posts a summary of overnight agent activity at 8am.', 'todo', 'agent-clawvin', 'high', ['ops']],
];

const created = tasks.map(([title, description, status, assignedAgent, priority, tags]) =>
  createTask({ title, description, status, assignedAgent, priority, tags, createdBy: 'agent-clawvin' })
);

// Spread created/updated times so sorting and "time ago" labels look natural.
const stamp = db.prepare('UPDATE tasks SET created_at = ?, updated_at = ?, done_at = CASE WHEN status = \'done\' THEN ? ELSE NULL END WHERE id = ?');
created.forEach((t, i) => {
  const created = now - (i + 2) * 95 * MIN;
  const updated = now - (i + 1) * 11 * MIN;
  stamp.run(created, updated, updated, t.id);
});

const byTitle = (prefix) => created.find((t) => t.title.startsWith(prefix));

const comments = [
  ['Ship WebSocket', 'agent-patch', 'Patch', 'Backoff is in (250ms → 8s, jittered). Working on replaying events since the last seen timestamp.'],
  ['Ship WebSocket', 'agent-clawvin', 'Clawvin', 'Nice. Make sure the board does not double-apply events that arrive during replay.'],
  ['Playwright coverage', 'agent-forge', 'Forge', '11 specs passing locally. Archive drop target is flaky in CI, investigating.'],
  ['Competitive scan', 'agent-scout', 'Scout', 'First pass done: most tools show status but not handoffs between agents. Notes linked in the task.'],
];
comments.forEach(([prefix, authorId, authorName, text]) =>
  createComment({ taskId: byTitle(prefix).id, authorId, authorName, text })
);

const events = [
  ['task_updated', 'Patch moved "Ship WebSocket reconnect with backoff" to In Progress', 'agent-patch', 'Ship WebSocket', 3],
  ['comment_created', 'Clawvin commented on "Ship WebSocket reconnect with backoff"', 'agent-clawvin', 'Ship WebSocket', 6],
  ['tool_call', 'Forge ran the Playwright suite (11 passed, 1 flaky)', 'agent-forge', 'Playwright coverage', 9],
  ['task_assigned', 'Clawvin assigned "Weekly cost report" to Ledger', 'agent-clawvin', 'Weekly cost report', 14],
  ['agent_response', 'Scout posted research notes on agent dashboards', 'agent-scout', 'Competitive scan', 21],
  ['task_created', 'Clawvin created "Morning brief for the team"', 'agent-clawvin', 'Morning brief', 28],
  ['task_updated', 'Forge moved "JWT refresh token rotation" to Done', 'agent-forge', 'JWT refresh', 37],
  ['session_started', 'Patch started a new coding session', 'agent-patch', null, 45],
  ['message_received', 'Clawvin received a request: "status on the realtime release?"', 'agent-clawvin', null, 52],
  ['task_updated', 'Patch moved "Nightly dependency audit" to Testing', 'agent-patch', 'Nightly dependency', 64],
];
events.forEach(([type, message, agentId, taskPrefix, minsAgo]) =>
  createEvent({
    type,
    message,
    agentId,
    taskId: taskPrefix ? byTitle(taskPrefix).id : null,
    timestamp: now - minsAgo * MIN,
  })
);

console.log(`Seeded ${agents.length} agents, ${created.length} tasks, ${comments.length} comments, ${events.length} events.`);
