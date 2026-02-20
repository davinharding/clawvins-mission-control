import dotenv from 'dotenv';
dotenv.config();

import Database from 'better-sqlite3';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../data/mission-control.db');
console.log(`[DB] Using database: ${dbPath}`);
const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
function initDB() {
  // Tasks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL CHECK(status IN ('backlog', 'todo', 'in-progress', 'testing', 'done', 'archived')),
      assigned_agent TEXT,
      priority TEXT CHECK(priority IN ('low', 'medium', 'high', 'critical')),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      created_by TEXT,
      tags TEXT,
      done_at INTEGER
    )
  `);

  // Agents table
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Main',
      status TEXT NOT NULL CHECK(status IN ('online', 'offline', 'busy')),
      last_active INTEGER NOT NULL,
      avatar_color TEXT
    )
  `);

  // Migration: remove restrictive role CHECK constraint if present (temp-table swap)
  try {
    const agentsInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='agents'").get();
    if (agentsInfo && agentsInfo.sql.includes("CHECK(role IN")) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS agents_migration_tmp (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'Main',
          status TEXT NOT NULL CHECK(status IN ('online', 'offline', 'busy')),
          last_active INTEGER NOT NULL,
          avatar_color TEXT
        );
        INSERT OR IGNORE INTO agents_migration_tmp (id, name, role, status, last_active, avatar_color)
          SELECT id, name, role, status, last_active, avatar_color FROM agents;
        DROP TABLE agents;
        CREATE TABLE agents (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'Main',
          status TEXT NOT NULL CHECK(status IN ('online', 'offline', 'busy')),
          last_active INTEGER NOT NULL,
          avatar_color TEXT
        );
        INSERT INTO agents SELECT * FROM agents_migration_tmp;
        DROP TABLE agents_migration_tmp;
      `);
      console.log('[DB] Migrated agents table: removed restrictive role CHECK constraint');
    }
  } catch (err) {
    console.error('[DB] Migration error (agents role constraint):', err.message);
  }

  // Events table
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      agent_id TEXT,
      task_id TEXT,
      timestamp INTEGER NOT NULL,
      detail TEXT
    )
  `);

  // Migration: add detail column if it doesn't exist (for existing DBs)
  try {
    db.prepare("ALTER TABLE events ADD COLUMN detail TEXT").run();
  } catch {
    // Column already exists — fine
  }

  // Migration: add done_at column if it doesn't exist
  try {
    db.prepare("ALTER TABLE tasks ADD COLUMN done_at INTEGER").run();
    console.log('[DB] Migrated tasks table: added done_at column');
  } catch {
    // Column already exists — fine
  }

  // Migration: update status CHECK constraint to include 'testing' and 'archived'
  // Uses rename+recreate (reliable across all SQLite environments)
  try {
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='tasks'").get();
    const needsMigration = tableInfo && (
      !tableInfo.sql.includes("'testing'") ||
      !tableInfo.sql.includes("'archived'")
    );
    if (needsMigration) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS tasks_migration_tmp (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          status TEXT NOT NULL,
          assigned_agent TEXT,
          priority TEXT CHECK(priority IN ('low', 'medium', 'high', 'critical')),
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          created_by TEXT,
          tags TEXT,
          done_at INTEGER
        );
        INSERT OR IGNORE INTO tasks_migration_tmp (id, title, description, status, assigned_agent, priority, created_at, updated_at, created_by, tags, done_at)
          SELECT id, title, description, status, assigned_agent, priority, created_at, updated_at, created_by, tags, done_at FROM tasks;
        DROP TABLE tasks;
        CREATE TABLE tasks (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          status TEXT NOT NULL CHECK(status IN ('backlog', 'todo', 'in-progress', 'testing', 'done', 'archived')),
          assigned_agent TEXT,
          priority TEXT CHECK(priority IN ('low', 'medium', 'high', 'critical')),
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          created_by TEXT,
          tags TEXT,
          done_at INTEGER
        );
        INSERT INTO tasks SELECT * FROM tasks_migration_tmp;
        DROP TABLE tasks_migration_tmp;
      `);
      console.log('[DB] Migrated tasks table: added testing+archived status');
    }
  } catch (err) {
    console.error('[DB] Migration error (tasks status constraint):', err.message);
  }

  // Comments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )
  `);

  // Migration: fix comments table if FK references tasks_old (from a bad prior migration)
  try {
    const commentsInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='comments'").get();
    if (commentsInfo && commentsInfo.sql.includes('"tasks_old"')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS comments_fix_tmp (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          author_id TEXT NOT NULL,
          author_name TEXT NOT NULL,
          text TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );
        INSERT OR IGNORE INTO comments_fix_tmp SELECT * FROM comments;
        DROP TABLE comments;
        CREATE TABLE comments (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          author_id TEXT NOT NULL,
          author_name TEXT NOT NULL,
          text TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );
        INSERT INTO comments SELECT * FROM comments_fix_tmp;
        DROP TABLE comments_fix_tmp;
      `);
      console.log('[DB] Migrated comments table: fixed FK reference to tasks');
    }
  } catch (err) {
    console.error('[DB] Migration error (comments FK fix):', err.message);
  }

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
  // Excludes archived by default
  getAll: db.prepare(`
    SELECT t.*, (SELECT COUNT(*) FROM comments c WHERE c.task_id = t.id) as comment_count
    FROM tasks t WHERE t.status != 'archived' ORDER BY t.created_at DESC
  `),
  getByStatus: db.prepare(`
    SELECT t.*, (SELECT COUNT(*) FROM comments c WHERE c.task_id = t.id) as comment_count
    FROM tasks t WHERE t.status = ? ORDER BY t.created_at DESC
  `),
  getArchived: db.prepare(`
    SELECT t.*, (SELECT COUNT(*) FROM comments c WHERE c.task_id = t.id) as comment_count
    FROM tasks t WHERE t.status = 'archived' ORDER BY t.updated_at DESC
  `),
  getByAgent: db.prepare(`
    SELECT t.*, (SELECT COUNT(*) FROM comments c WHERE c.task_id = t.id) as comment_count
    FROM tasks t WHERE t.assigned_agent = ? AND t.status != 'archived' ORDER BY t.created_at DESC
  `),
  getByStatusAndAgent: db.prepare(`
    SELECT t.*, (SELECT COUNT(*) FROM comments c WHERE c.task_id = t.id) as comment_count
    FROM tasks t WHERE t.status = ? AND t.assigned_agent = ? ORDER BY t.created_at DESC
  `),
  getById: db.prepare(`
    SELECT t.*, (SELECT COUNT(*) FROM comments c WHERE c.task_id = t.id) as comment_count
    FROM tasks t WHERE t.id = ?
  `),
  create: db.prepare(`
    INSERT INTO tasks (id, title, description, status, assigned_agent, priority, created_at, updated_at, created_by, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  update: db.prepare(`
    UPDATE tasks 
    SET title = ?, description = ?, status = ?, assigned_agent = ?, priority = ?, updated_at = ?, tags = ?, done_at = ?
    WHERE id = ?
  `),
  delete: db.prepare('DELETE FROM tasks WHERE id = ?'),
  // Auto-archive: tasks in 'done' for more than 24h
  autoArchive: db.prepare(`
    UPDATE tasks SET status = 'archived', updated_at = ?
    WHERE status = 'done' AND done_at IS NOT NULL AND done_at < ?
  `),
  // For tasks that lack done_at but have been in done for 24h based on updated_at
  autoArchiveFallback: db.prepare(`
    UPDATE tasks SET status = 'archived', updated_at = ?
    WHERE status = 'done' AND done_at IS NULL AND updated_at < ?
  `),
  countArchived: db.prepare(`SELECT COUNT(*) as count FROM tasks WHERE status = 'archived'`),
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
  getById: db.prepare('SELECT * FROM events WHERE id = ?'),
  create: db.prepare(`
    INSERT INTO events (id, type, message, agent_id, task_id, timestamp, detail)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
};

// Comment queries
const commentQueries = {
  getByTask: db.prepare('SELECT * FROM comments WHERE task_id = ? ORDER BY created_at ASC'),
  create: db.prepare(`
    INSERT INTO comments (id, task_id, author_id, author_name, text, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `),
};

// Helper functions
export function getAllTasks(filters = {}) {
  // Handle combined filters first
  if (filters.status && filters.assignedAgent) {
    return taskQueries.getByStatusAndAgent.all(filters.status, filters.assignedAgent);
  }
  if (filters.status) {
    return taskQueries.getByStatus.all(filters.status);
  }
  if (filters.assignedAgent) {
    return taskQueries.getByAgent.all(filters.assignedAgent);
  }
  return taskQueries.getAll.all();
}

export function getArchivedTasks() {
  return taskQueries.getArchived.all();
}

export function getArchivedCount() {
  return taskQueries.countArchived.get().count;
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
  const newStatus = data.status !== undefined ? data.status : task.status;
  
  // Track when a task enters 'done' status
  let doneAt = task.done_at;
  if (newStatus === 'done' && task.status !== 'done') {
    doneAt = Date.now();
  } else if (newStatus !== 'done' && newStatus !== 'archived') {
    // Leaving done/archived clears done_at
    doneAt = null;
  }
  
  taskQueries.update.run(
    data.title !== undefined ? data.title : task.title,
    data.description !== undefined ? data.description : task.description,
    newStatus,
    data.assignedAgent !== undefined ? data.assignedAgent : task.assigned_agent,
    data.priority !== undefined ? data.priority : task.priority,
    Date.now(),
    tags,
    doneAt,
    id
  );
  
  return getTaskById(id);
}

export function deleteTask(id) {
  const result = taskQueries.delete.run(id);
  return result.changes > 0;
}

/**
 * Auto-archive tasks that have been in 'done' status for 24+ hours.
 * Returns the number of tasks archived.
 */
export function autoArchiveDoneTasks() {
  const now = Date.now();
  const cutoff = now - 24 * 60 * 60 * 1000; // 24 hours ago

  const r1 = taskQueries.autoArchive.run(now, cutoff);
  const r2 = taskQueries.autoArchiveFallback.run(now, cutoff);
  const total = r1.changes + r2.changes;

  if (total > 0) {
    console.log(`[DB] Auto-archived ${total} task(s) from done → archived`);
  }
  return total;
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

export function getEventById(id) {
  return eventQueries.getById.get(id);
}

export function createEvent(data) {
  const id = data.id || `evt-${randomUUID()}`;
  const now = data.timestamp || Date.now();

  eventQueries.create.run(
    id,
    data.type,
    data.message,
    data.agentId || null,
    data.taskId || null,
    now,
    data.detail ? JSON.stringify(data.detail) : null
  );

  return getEventById(id);
}

export function getCommentsByTask(taskId) {
  return commentQueries.getByTask.all(taskId);
}

export function createComment(data) {
  const id = `cmt-${randomUUID()}`;
  const now = Date.now();

  commentQueries.create.run(
    id,
    data.taskId,
    data.authorId,
    data.authorName,
    data.text,
    now
  );

  return {
    id,
    task_id: data.taskId,
    author_id: data.authorId,
    author_name: data.authorName,
    text: data.text,
    created_at: now,
  };
}

export { db };
