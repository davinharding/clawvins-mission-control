const { verifyToken } = require('./auth');

function setupSocket(io) {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    let authenticated = false;
    
    // Authenticate socket connection
    socket.on('authenticate', (data) => {
      const { token } = data;
      const user = verifyToken(token);
      
      if (user) {
        authenticated = true;
        socket.user = user;
        socket.emit('authenticated', { user });
        console.log('Socket authenticated:', user.name);
      } else {
        socket.emit('auth_error', { error: 'Invalid token' });
        socket.disconnect();
      }
    });
    
    // Require authentication for other events
    socket.use((packet, next) => {
      if (packet[0] === 'authenticate') {
        return next();
      }
      
      if (!authenticated) {
        return next(new Error('Not authenticated'));
      }
      
      next();
    });
    
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
  
  return io;
}

module.exports = { setupSocket };
