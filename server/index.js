import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { authMiddleware } from './auth.js';
import { setupWebSocket } from './socket.js';
import authRoutes from './routes/auth.js';
import taskRoutes from './routes/tasks.js';
import agentRoutes from './routes/agents.js';
import eventRoutes from './routes/events.js';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:9000',
  credentials: true,
}));
app.use(express.json());

// Initialize WebSocket
setupWebSocket(httpServer, app);

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Auth routes (no auth middleware)
app.use('/api/auth', authRoutes);

// Protected API routes
app.use('/api/tasks', authMiddleware, taskRoutes);
app.use('/api/agents', authMiddleware, agentRoutes);
app.use('/api/events', authMiddleware, eventRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`Mission Control backend listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`WebSocket server ready`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export { app, httpServer };
