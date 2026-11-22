import { config } from './config/env';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app';
import { initSocketServer } from './config/socket';

const server = http.createServer(app);

// Initialize Socket.io with origin allowlist
export const io = new SocketIOServer(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || config.allowedOrigins.includes('*') || config.allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      if (
        /^https:\/\/[\w-]+\.(vercel\.app|ondigitalocean\.app)$/.test(origin) ||
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

// Initialize authenticated Socket.IO gateway with JWT validation & secure room routing
initSocketServer(io);

// Keep-alive settings to prevent ECONNRESET race conditions with reverse proxies & Vite dev proxy
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

// Process safety: prevent unhandled exceptions or rejected promises from abruptly terminating the process
process.on('unhandledRejection', (reason: any) => {
  console.error('[Process Unhandled Rejection]:', reason?.message || reason);
});
process.on('uncaughtException', (err: any) => {
  console.error('[Process Uncaught Exception]:', err?.message || err);
});

if (require.main === module) {
  server.listen(config.port, () => {
    console.log(`=======================================================`);
    console.log(`🚜 JCB SMART MACHINE MAINTENANCE MANAGEMENT SYSTEM`);
    console.log(`🚀 Backend API Server running on port ${config.port}`);
    console.log(`🛡️  Security Foundation active: CORS allowlist & Rate Limiting enabled`);
    console.log(`📡 Socket.io Real-time Gateway active on port ${config.port}`);
    console.log(`=======================================================`);
  });
}

export default server;
