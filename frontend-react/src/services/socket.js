import io from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_BACKEND_URL;

if (!SOCKET_URL) {
  throw new Error('REACT_APP_BACKEND_URL não está configurada');
}

export const socketConnection = io(SOCKET_URL, {
  transports: ['websocket'],
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});

socketConnection.on('connect', () => {
  console.log('Socket connected');
});

socketConnection.on('connect_error', (error) => {
  console.error('Socket connection error:', error);
});

socketConnection.on('disconnect', (reason) => {
  console.log('Socket disconnected:', reason);
});

// Reconexão automática em caso de desconexão
socketConnection.on('disconnect', () => {
  if (socketConnection.io.opts.autoConnect) {
    socketConnection.connect();
  }
});

export default socketConnection; 