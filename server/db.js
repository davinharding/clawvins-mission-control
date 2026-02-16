import Database from 'better-sqlite3';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../data/mission-control.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Initialize schema
function initDB() {
  // Tasks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL CHECK(status IN ('backlog', 'todo', 'in-progress', 'done')),
      assigned_agent TEXT,
      priority TEXT CHECK(priority IN ('low', 'medium', 'high', 'critical')),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      created_by TEXT,
      tags TEXT
    )
  `);

  // Agents table
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('Main', 'Dev', 'Research', 'Ops')),
      status TEXT NOT NULL CHECK(status IN ('online', 'offline', 'busy')),
      last_active INTEGER NOT NULL,
      avatar_color TEXT
    )
  `);

  // Events table
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      agent_id TEXT,
      task_id TEXT,
      timestamp INTEGER NOT NULL
    )
  `);

  // Auth tokens table
  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )
  `);
}

// Initialize database first
initDB();

// Task queries - prepared after tables exist
const taskQueries = {
  getAll: db.prepare('SELECT * FROM tasks ORDER BY created_at DESC'),
  getByStatus: db.prepare('SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC'),
  getByAgent: db.prepare('SELECT * FROM tasks WHERE assigned_agent = ? ORDER BY created_at DESC'),
  getById: db.prepare('SELECT * FROM tasks WHERE id = ?'),
  create: db.prepare(`
    INSERT INTO tasks (id, title, description, status, assigned_agent, priority, created_at, updated_at, created_by, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  update: db.prepare(`
    UPDATE tasks 
    SET title = ?, description = ?, status = ?, assigned_agent = ?, priority = ?, updated_at = ?, tags = ?
    WHERE id = ?
  `),
  delete: db.prepare('DELETE FROM tasks WHERE id = ?'),
};

// Agent queries
const agentQueries = {
  getAll: db.prepare('SELECT * FROM agents ORDER BY name'),
  getById: db.prepare('SELECT * FROM agents WHERE id = ?'),
  create: db.prepare(`
    INSERT INTO agents (id, name, role, status, last_active, avatar_color)
    VALUES (?, ?, ?, ?, ?, ?)
  `),
  update: db.prepare(`
    UPDATE agents 
    SET name = ?, role = ?, status = ?, last_active = ?, avatar_color = ?
    WHERE id = ?
  `),
  updateStatus: db.prepare('UPDATE agents SET status = ?, last_active = ? WHERE id = ?'),
};

// Event queries
const eventQueries = {
  getRecent: db.prepare('SELECT * FROM events ORDER BY timestamp DESC LIMIT ?'),
  getSince: db.prepare('SELECT * FROM events WHERE timestamp > ? ORDER BY timestamp DESC'),
  create: db.prepare(`
    INSERT INTO events (id, type, message, agent_id, task_id, timestamp)
    VALUES (?, ?, ?, ?, ?, ?)
  `),
};

// Helper functions
export function getAllTasks(filters = {}) {
  if (filters.status) {
    return taskQueries.getByStatus.all(filters.status);
  }
  if (filters.agent) {
    return taskQueries.getByAgent.all(filters.agent);
  }
  return taskQueries.getAll.all();
}

export function getTaskById(id) {
  return taskQueries.getById.get(id);
}

export function createTask(data) {
  const id = `task-${randomUUID()}`;
  const now = Date.now();
  const tags = JSON.stringify(data.tags || []);
  
  taskQueries.create.run(
    id,
    data.title,
    data.description || null,
    data.status,
    data.assignedAgent || null,
    data.priority || null,
    now,
    now,
    data.createdBy || null,
    tags
  );
  
  return getTaskById(id);
}

export function updateTask(id, data) {
  const task = getTaskById(id);
  if (!task) return null;
  
  const tags = JSON.stringify(data.tags || JSON.parse(task.tags || '[]'));
  
  taskQueries.update.run(
    data.title !== undefined ? data.title : task.title,
    data.description !== undefined ? data.description : task.description,
    data.status !== undefined ? data.status : task.status,
    data.assignedAgent !== undefined ? data.assignedAgent : task.assigned_agent,
    data.priority !== undefined ? data.priority : task.priority,
    Date.now(),
    tags,
    id
  );
  
  return getTaskById(id);
}

export function deleteTask(id) {
  const result = taskQueries.delete.run(id);
  return result.changes > 0;
}

export function getAllAgents() {
  return agentQueries.getAll.all();
}

export function getAgentById(id) {
  return agentQueries.getById.get(id);
}

export function createAgent(data) {
  const id = data.id || `agent-${randomUUID()}`;
  const now = Date.now();
  
  agentQueries.create.run(
    id,
    data.name,
    data.role,
    data.status || 'offline',
    now,
    data.avatarColor || null
  );
  
  return getAgentById(id);
}

export function updateAgent(id, data) {
  const agent = getAgentById(id);
  if (!agent) return null;
  
  if (data.status && !data.name && !data.role) {
    // Status-only update
    agentQueries.updateStatus.run(data.status, Date.now(), id);
  } else {
    agentQueries.update.run(
      data.name !== undefined ? data.name : agent.name,
      data.role !== undefined ? data.role : agent.role,
      data.status !== undefined ? data.status : agent.status,
      Date.now(),
      data.avatarColor !== undefined ? data.avatarColor : agent.avatar_color,
      id
    );
  }
  
  return getAgentById(id);
}

export function getRecentEvents(limit = 50) {
  return eventQueries.getRecent.all(limit);
}

export function getEventsSince(timestamp) {
  return eventQueries.getSince.all(timestamp);
}

export function createEvent(data) {
  const id = `evt-${randomUUID()}`;
  const now = Date.now();
  
  eventQueries.create.run(
    id,
    data.type,
    data.message,
    data.agentId || null,
    data.taskId || null,
    now
  );
  
  return { id, ...data, timestamp: now };
}

export { db };
