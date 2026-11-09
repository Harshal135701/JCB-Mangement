import { config } from './config/env';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app';
import { initSocketServer } from './config/socket';

const server = http.createServer(app);

// Initialize Socket.io with origin allowlist
export const io = new SocketIOServer(server, {
  cors: {
    origin: config.allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

// Initialize authenticated Socket.IO gateway with JWT validation & secure room routing
initSocketServer(io);

server.listen(config.port, () => {
  console.log(`=======================================================`);
  console.log(`🚜 JCB SMART MACHINE MAINTENANCE MANAGEMENT SYSTEM`);
  console.log(`🚀 Backend API Server running on port ${config.port}`);
  console.log(`🛡️  Security Foundation active: CORS allowlist & Rate Limiting enabled`);
  console.log(`📡 Socket.io Real-time Gateway active on port ${config.port}`);
  console.log(`=======================================================`);
});

export default server;
