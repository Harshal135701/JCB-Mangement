import http from 'http';
import dotenv from 'dotenv';
import { Server as SocketIOServer } from 'socket.io';
import app from './app';

dotenv.config();

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// Initialize Socket.io with permissive CORS for React Web & React Native Mobile App
export const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚜 JCB SMART MACHINE MAINTENANCE MANAGEMENT SYSTEM`);
  console.log(`🚀 Backend API Server running on http://localhost:${PORT}`);
  console.log(`📡 Socket.io Real-time Gateway active on port ${PORT}`);
  console.log(`=======================================================`);
});

export default server;

