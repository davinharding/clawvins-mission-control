import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'node:http';
import { Server } from 'socket.io';
import { authMiddleware } from './auth.js';
import tasksRoutes from './routes/tasks.js';
import agentsRoutes from './routes/agents.js';
import eventsRoutes from './routes/events.js';
import authRoutes from './routes/auth.js';
import { setupSocket } from './socket.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/tasks', authMiddleware, tasksRoutes);
app.use('/api/agents', authMiddleware, agentsRoutes);
app.use('/api/events', authMiddleware, eventsRoutes);

const port = process.env.PORT || 3002;
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
  },
});

setupSocket(io);
app.io = io;

server.listen(port, () => {
  console.log(`Mission Control API listening on port ${port}`);
});

export default app;
