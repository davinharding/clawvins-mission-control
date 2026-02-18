import { Server } from 'socket.io';
import { verifyToken } from './auth.js';

export function setupWebSocket(server, app) {
  const allowedOrigins = new Set(
    [
      process.env.FRONTEND_URL,
      process.env.TAILSCALE_ORIGIN,
      'http://localhost:9000',
      'http://localhost:3001',
      'https://localhost:3001',
      // Tailscale MagicDNS default — also covered by TAILSCALE_ORIGIN env var
      'https://stagesnap-assistant.tail581fc8.ts.net',
    ].filter(Boolean)
  );

  const io = new Server(server, {
    // Prefer websocket transport; polling struggles through HTTPS reverse proxies
    transports: ['websocket', 'polling'],
    cors: {
      origin: (origin, callback) => {
        // Allow requests with no origin (same-origin, mobile apps, Postman)
        if (!origin || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }
        // Also allow any *.ts.net Tailscale domain
        if (origin.endsWith('.ts.net')) {
          callback(null, true);
          return;
        }
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      },
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
