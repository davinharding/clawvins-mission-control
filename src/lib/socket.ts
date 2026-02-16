import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3002';

export type ConnectionState = 'connected' | 'disconnected' | 'reconnecting';

type ConnectionListener = (state: ConnectionState) => void;

export function createSocket(token: string) {
  const socket = io(SOCKET_URL, {
    autoConnect: false,
    auth: { token },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 600,
    reconnectionDelayMax: 4000,
    timeout: 10000,
  });

  let connectionState: ConnectionState = 'disconnected';
  const listeners = new Set<ConnectionListener>();

  const emitState = (nextState: ConnectionState) => {
    if (connectionState === nextState) return;
    connectionState = nextState;
    listeners.forEach((listener) => listener(connectionState));
  };

  socket.on('connect', () => emitState('connected'));
  socket.on('disconnect', () => emitState('disconnected'));
  socket.on('connect_error', () => emitState('reconnecting'));
  socket.io.on('reconnect_attempt', () => emitState('reconnecting'));
  socket.io.on('reconnect_error', () => emitState('reconnecting'));
  socket.io.on('reconnect_failed', () => emitState('disconnected'));
  socket.io.on('reconnect', () => emitState('connected'));

  return {
    socket,
    getConnectionState: () => connectionState,
    onConnectionStateChange: (listener: ConnectionListener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
