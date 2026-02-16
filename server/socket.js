import { Server } from 'socket.io';
import { verifyToken } from './auth.js';

export function setupWebSocket(server, app) {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:9000',
      credentials: true,
    },
  });

  // Authentication middleware for Socket.io
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication required'));
    }
    
    const decoded = verifyToken(token);
    if (!decoded) {
      return next(new Error('Invalid or expired token'));
    }
    
    socket.user = decoded;
    next();
  });

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.user.name} (${socket.user.id})`);
    
    // Send authenticated event
    socket.emit('authenticated', { user: socket.user });
    
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.user.name}`);
    });
    
    // Handle errors
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  // Attach io to app so routes can access it
  app.io = io;
  
  console.log('WebSocket server initialized');
  
  return io;
}
