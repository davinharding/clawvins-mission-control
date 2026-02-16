import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3002';

export function createSocket(token: string) {
  return io(SOCKET_URL, {
    autoConnect: false,
    auth: { token },
  });
}
