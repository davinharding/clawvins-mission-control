import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import http from 'node:http';
import { authMiddleware, agentKeyMiddleware } from './auth.js';
import tasksRoutes from './routes/tasks.js';
import agentsRoutes from './routes/agents.js';
import eventsRoutes from './routes/events.js';
import authRoutes from './routes/auth.js';
import agentTasksRoutes from './routes/agent-tasks.js';
import { setupWebSocket } from './socket.js';
import { SessionMonitor } from './session-monitor.js';

dotenv.config();

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

// Admin endpoint for session sync (called by agent cron)
app.post('/api/admin/session-sync', express.json(), (req, res) => {
  try {
    const { sessions, secret } = req.body;
    
    // Simple secret-based auth (environment variable)
    const expectedSecret = process.env.ADMIN_SECRET || 'change-me-in-production';
    if (secret !== expectedSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (!app.sessionMonitor) {
      return res.status(503).json({ error: 'Session monitor not initialized' });
    }
    
    const eventCount = app.sessionMonitor.processSessions(sessions || []);
    res.json({ 
      success: true, 
      eventsGenerated: eventCount,
      stats: app.sessionMonitor.getStats()
    });
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

const startTime = new Date().toISOString();
server.listen(port, () => {
  console.log('\n🚀 Mission Control Backend Started');
  console.log(`   Time: ${startTime}`);
  console.log(`   Port: ${port}`);
  console.log(`   Health: http://localhost:${port}/health`);
  console.log(`   API: http://localhost:${port}/api`);
  console.log('   WebSocket: Ready');
  console.log('   Session Monitor: Ready');
  console.log('   Session Watcher: Running (pure Node.js)\n');
});

export default app;
