import { io, type Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env['VITE_SOCKET_URL'] ?? 'http://localhost:4001';

export const socket: Socket = io(SOCKET_URL, {
  autoConnect: true,
  reconnection: true,
});
