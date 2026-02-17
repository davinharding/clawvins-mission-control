import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import http from 'node:http';
import { authMiddleware } from './auth.js';
import tasksRoutes from './routes/tasks.js';
import agentsRoutes from './routes/agents.js';
import eventsRoutes from './routes/events.js';
import authRoutes from './routes/auth.js';
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

app.use('/api/auth', authRoutes);
app.use('/api/tasks', authMiddleware, tasksRoutes);
app.use('/api/agents', authMiddleware, agentsRoutes);
app.use('/api/events', authMiddleware, eventsRoutes);

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

const startTime = new Date().toISOString();
server.listen(port, () => {
  console.log('\n🚀 Mission Control Backend Started');
  console.log(`   Time: ${startTime}`);
  console.log(`   Port: ${port}`);
  console.log(`   Health: http://localhost:${port}/health`);
  console.log(`   API: http://localhost:${port}/api`);
  console.log('   WebSocket: Ready');
  console.log('   Session Monitor: Ready\n');
  
  // Start polling OpenClaw sessions
  app.sessionMonitor.startPolling();
});

export default app;
