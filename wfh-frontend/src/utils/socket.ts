import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../config';

let socket: Socket | null = null;

/**
 * Returns a singleton Socket.io client instance.
 * Connects to /live namespace with websocket and polling transports for reliability.
 * Reconnects if token changes or socket dropped.
 */
export const getSocket = (): Socket => {
  const token = sessionStorage.getItem('wfh_auth_token') || '';
  if (!socket) {
    socket = io(`${API_BASE_URL}/live`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });
  } else {
    // If token exists and differs from handshake auth, update it
    if (socket.auth && (socket.auth as any).token !== token) {
      (socket.auth as any).token = token;
      if (socket.connected) {
        socket.disconnect().connect();
      }
    }
    if (!socket.connected) {
      socket.connect();
    }
  }
  return socket;
};
