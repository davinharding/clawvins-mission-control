import { io } from 'socket.io-client';

// Derive socket server URL:
// 1. Explicit VITE_SOCKET_URL override
// 2. Strip trailing /api from VITE_API_URL to get the server root
// 3. Fall back to window.location.origin (localhost dev with proxy)
function resolveSocketUrl(): string {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL as string;
  }
  const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (apiUrl) {
    // Strip /api suffix if present — socket.io lives at the server root
    return apiUrl.replace(/\/api\/?$/, '');
  }
  return window.location.origin;
}

const SOCKET_URL = resolveSocketUrl();

export type ConnectionState = 'connected' | 'disconnected' | 'reconnecting';

type ConnectionListener = (state: ConnectionState) => void;

export function createSocket(token: string) {
  const socket = io(SOCKET_URL, {
    autoConnect: false,
    auth: { token },
    // Prefer websocket — polling is unreliable through HTTPS reverse proxies (e.g. Tailscale)
    transports: ['websocket', 'polling'],
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
