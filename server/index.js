import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import http from 'node:http';
import { authMiddleware, agentKeyMiddleware } from './auth.js';
import tasksRoutes from './routes/tasks.js';
import agentsRoutes from './routes/agents.js';
import eventsRoutes from './routes/events.js';
import authRoutes from './routes/auth.js';
import agentTasksRoutes from './routes/agent-tasks.js';
import searchRoutes from './routes/search.js';
import costsRoutes from './routes/costs.js';
import openaiUsageRoutes from './routes/openai-usage.js';
import { setupWebSocket } from './socket.js';
import { SessionMonitor } from './session-monitor.js';
import { createEvent, autoArchiveDoneTasks, createAgent, getAgentById, db } from './db.js';
import { getAgentsFromSessions } from './openclaw.js';

const app = express();

const allowedOrigins = new Set(
  [
    process.env.FRONTEND_URL,
    'http://localhost:9000',
    'http://localhost:3001',
  ].filter(Boolean)
);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
};

// HTTP request logging
app.use(morgan('dev'));

app.use(cors(corsOptions));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// flexAuth: accept either JWT or Agent API key
const flexAuth = (req, res, next) => {
  const key = req.headers['x-api-key'] || req.headers['x-agent-key'];
  if (key) {
    return agentKeyMiddleware(req, res, (err) => {
      if (err) return next(err);
      if (req.user) return next();
      return authMiddleware(req, res, next);
    });
  }
  return authMiddleware(req, res, next);
};

app.use('/api/auth', authRoutes);
app.use('/api/tasks', flexAuth, tasksRoutes);
app.use('/api/agents', authMiddleware, agentsRoutes);
app.use('/api/events', authMiddleware, eventsRoutes);
app.use('/api/agent-tasks', agentTasksRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/costs', authMiddleware, costsRoutes);
app.use('/api/openai-usage', authMiddleware, openaiUsageRoutes);

// Agent sync from OpenClaw sessions
async function syncAgentsFromOpenClaw() {
  try {
    const agents = await getAgentsFromSessions();
    let synced = 0;
    for (const agent of agents) {
      // Primary dedup: by agent ID
      const existingById = db.prepare('SELECT id FROM agents WHERE id = ?').get(agent.id);
      if (existingById) {
        db.prepare('UPDATE agents SET status = ?, last_active = ? WHERE id = ?')
          .run(agent.status, Date.now(), agent.id);
        continue;
      }
      // Secondary dedup: by name — prevent duplicate display names from different ID formats
      const existingByName = db.prepare('SELECT id FROM agents WHERE LOWER(name) = LOWER(?)').get(agent.name);
      if (existingByName) {
        // Update existing record with correct ID and status instead of inserting a dupe
        db.prepare('UPDATE agents SET id = ?, status = ?, last_active = ? WHERE id = ?')
          .run(agent.id, agent.status, Date.now(), existingByName.id);
        console.log(`[AgentSync] Re-keyed agent "${agent.name}" from ${existingByName.id} → ${agent.id}`);
        continue;
      }
      createAgent(agent);
      synced++;
      console.log(`[AgentSync] Added new agent: ${agent.name} (${agent.id})`);
    }
    if (synced > 0) console.log(`[AgentSync] Synced ${synced} new agents from OpenClaw`);
  } catch (err) {
    console.warn('[AgentSync] Could not sync agents from OpenClaw:', err.message);
  }
}

// Admin endpoint for agent sync (manual trigger)
app.post('/api/admin/sync-agents', express.json(), async (req, res) => {
  try {
    const adminSecret = process.env.ADMIN_SECRET || 'REDACTED_SECRET';

    const headerSecret = req.headers['x-admin-secret'];
    const bodySecret = req.body?.secret;
    if (headerSecret !== adminSecret && bodySecret !== adminSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await syncAgentsFromOpenClaw();
    res.json({ success: true });
  } catch (err) {
    console.error('[Admin] sync-agents error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin endpoint for session sync (called by watch-sessions.js)
app.post('/api/admin/session-sync', express.json(), (req, res) => {
  try {
    const adminSecret = process.env.ADMIN_SECRET || 'REDACTED_SECRET';

    // Accept secret in header or body (header preferred)
    const headerSecret = req.headers['x-admin-secret'];
    const bodySecret = req.body?.secret;
    if (headerSecret !== adminSecret && bodySecret !== adminSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { events = [] } = req.body;
    let stored = 0;

    for (const evt of events) {
      try {
        const savedEvent = createEvent({
          id: evt.id,
          type: evt.type,
          message: evt.message,
          agentId: evt.agentId || null,
          taskId: evt.taskId || null,
          timestamp: evt.timestamp || Date.now(),
          detail: evt.detail || null,
        });

        if (savedEvent) {
          const formatted = {
            id: savedEvent.id,
            type: savedEvent.type,
            message: savedEvent.message,
            agentId: savedEvent.agent_id,
            taskId: savedEvent.task_id,
            timestamp: savedEvent.timestamp,
            detail: savedEvent.detail ? JSON.parse(savedEvent.detail) : null,
          };
          req.app.io.emit('event.new', { event: formatted });
          stored++;
        }
      } catch (err) {
        // Likely duplicate ID — skip silently
        if (!err.message?.includes('UNIQUE')) {
          console.error('[Admin] Event insert error:', err.message);
        }
      }
    }

    res.json({ success: true, stored });
  } catch (err) {
    console.error('[Admin] Session sync error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  console.error('Stack trace:', err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const port = process.env.PORT || 3002;
const server = http.createServer(app);

const io = setupWebSocket(server, app);

// Initialize session monitor
app.sessionMonitor = new SessionMonitor(io);
console.log('Session monitor initialized');

// Start session watcher (pure Node.js, no agent calls)
import { spawn } from 'node:child_process';
const watcherPath = new URL('../scripts/watch-sessions.js', import.meta.url).pathname;
const watcher = spawn('node', [watcherPath], {
  stdio: 'inherit',
  env: {
    ...process.env,
    BACKEND_URL: `http://localhost:${port}/api/admin/session-sync`,
  },
});
watcher.on('error', (err) => console.error('[Watcher] Failed to start:', err));

// Auto-archive: run once on startup, then every hour
function runAutoArchive() {
  try {
    const count = autoArchiveDoneTasks();
    if (count > 0 && app.io) {
      // Notify connected clients that tasks were archived
      app.io.emit('tasks.auto_archived', { count });
    }
  } catch (err) {
    console.error('[AutoArchive] Error:', err);
  }
}

const startTime = new Date().toISOString();
server.listen(port, () => {
  console.log('\n🚀 Mission Control Backend Started');
  console.log(`   Time: ${startTime}`);
  console.log(`   Port: ${port}`);
  console.log(`   Health: http://localhost:${port}/health`);
  console.log(`   API: http://localhost:${port}/api`);
  console.log('   WebSocket: Ready');
  console.log('   Session Monitor: Ready');
  console.log('   Session Watcher: Running (pure Node.js)');
  console.log('   Auto-Archive: Enabled (24h done → archived)\n');

  // Run immediately on startup
  runAutoArchive();

  // Then every hour
  setInterval(runAutoArchive, 60 * 60 * 1000);

  // Sync agents from OpenClaw on startup, then every 5 minutes
  syncAgentsFromOpenClaw();
  setInterval(syncAgentsFromOpenClaw, 5 * 60 * 1000);
});

export default app;
