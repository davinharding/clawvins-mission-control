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

dotenv.config();

const app = express();

// HTTP request logging
app.use(morgan('dev'));

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:9000',
    credentials: true,
  })
);
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.use('/api/auth', authRoutes);
app.use('/api/tasks', authMiddleware, tasksRoutes);
app.use('/api/agents', authMiddleware, agentsRoutes);
app.use('/api/events', authMiddleware, eventsRoutes);

app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  console.error('Stack trace:', err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const port = process.env.PORT || 3002;
const server = http.createServer(app);

setupWebSocket(server, app);

const startTime = new Date().toISOString();
server.listen(port, () => {
  console.log('\n🚀 Mission Control Backend Started');
  console.log(`   Time: ${startTime}`);
  console.log(`   Port: ${port}`);
  console.log(`   Health: http://localhost:${port}/health`);
  console.log(`   API: http://localhost:${port}/api`);
  console.log('   WebSocket: Ready\n');
});

export default app;
