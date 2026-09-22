import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { logger } from '../config/logger.js';

let io;

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:5173', 'http://localhost:5174'],
      credentials: true,
    },
  });

  // ── Auth middleware ──────────────────────────────────────────────────────────
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('No token'));
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      socket.userId = decoded.userId;
      socket.orgId = decoded.orgId;
      socket.role = decoded.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const orgRoom = `org:${socket.orgId}`;
    socket.join(orgRoom);
    logger.info(`Socket connected: user=${socket.userId} org=${socket.orgId} role=${socket.role}`);

    // Client sends location updates (technicians)
    socket.on('technician:location_push', ({ lat, lng, technicianId }) => {
      // Broadcast to all dispatchers in same org
      socket.to(orgRoom).emit('technician:location_updated', {
        technicianId,
        location: { lat, lng },
        at: new Date(),
      });
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: user=${socket.userId}`);
    });
  });

  // Expose io to Express app
  return io;
}

export function getIO() {
  return io;
}
