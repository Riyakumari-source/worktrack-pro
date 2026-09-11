import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../config';

let socket: Socket | null = null;

/**
 * Returns a singleton Socket.io client instance.
 * Connects to /live namespace with websocket and polling transports for reliability.
 */
export const getSocket = (): Socket => {
  if (!socket) {
    const token = sessionStorage.getItem('wfh_auth_token') || '';
    socket = io(`${API_BASE_URL}/live`, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
};
