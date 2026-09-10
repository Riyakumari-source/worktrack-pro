import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../config';

let socket: Socket | null = null;

/**
 * Returns a singleton Socket.io client instance.
 * The JWT auth token is read from sessionStorage (key 'wfh_auth_token').
 * The client connects to the backend server defined by API_BASE_URL.
 */
export const getSocket = (): Socket => {
  if (!socket) {
    const token = sessionStorage.getItem('wfh_auth_token') || '';
    socket = io(`${API_BASE_URL}`, {
      auth: { token },
      transports: ['websocket'],
    });
  }
  return socket;
};
