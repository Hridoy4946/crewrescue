import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { connectDB } from './config/db.js';
import { initSocket } from './socket/index.js';
import { logger } from './config/logger.js';
import { metricsMiddleware, metricsHandler } from './config/metrics.js';

// Models (pre-register all schemas)
import './models/KnowledgeDoc.js';

import { AppError } from './middleware/error.js';
import authRoutes from './routes/auth.js';
import technicianRoutes from './routes/technicians.js';
import incidentRoutes from './routes/incidents.js';
import workOrderRoutes from './routes/workOrders.js';
import depotRoutes from './routes/depots.js';
import assetRoutes from './routes/assets.js';
import vehicleRoutes from './routes/vehicles.js';
import dashboardRoutes from './routes/dashboard.js';
import optimizationRoutes from './routes/optimization.js';
import emergencyRoutes from './routes/emergency.js';
import simulatorRoutes from './routes/simulator.js';
import aiRoutes from './routes/ai.js';
import organizationRoutes from './routes/organizations.js';
import analyticsRoutes from './routes/analytics.js';
import { startSLAWatch } from './services/notificationService.js';
import WorkOrder from './models/WorkOrder.js';

const app = express();
const httpServer = createServer(app);

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'", "http://localhost:5000", "ws://localhost:5000"],
      fontSrc: ["'self'", "data:", "https:", "http:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "data:", "https:", "http:"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
}));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000'),
  max: parseInt(process.env.RATE_LIMIT_MAX ?? '200'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please slow down.' },
});
app.use('/api/', limiter);

// Stricter limiter on auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 20 : 100,
  message: { success: false, error: 'Too many login attempts. Try again in 15 minutes.' },
});

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Logging ───────────────────────────────────────────────────────────────────
app.use(morgan('combined', { stream: { write: (msg) => logger.http(msg.trim()) } }));

// ── Prometheus metrics ────────────────────────────────────────────────────────
app.use(metricsMiddleware);
app.get('/metrics', metricsHandler);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'crewrescue-api', timestamp: new Date().toISOString() });
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/technicians', technicianRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/work-orders', workOrderRoutes);
app.use('/api/depots', depotRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/optimization', optimizationRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/simulator', simulatorRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/sla', analyticsRoutes);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  logger.error(err.stack ?? err.message);
  const status = err instanceof AppError ? err.statusCode : (err.statusCode ?? err.status ?? 500);
  const message = process.env.NODE_ENV === 'production'
    ? (err instanceof AppError ? err.message : 'Internal server error')
    : err.message;
  res.status(status).json({
    success: false,
    error: message,
  });
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? '5000');

async function bootstrap() {
  await connectDB();
  const io = initSocket(httpServer);
  app.set('io', io);
  startSLAWatch(io, WorkOrder);
  httpServer.listen(PORT, () => {
    logger.info(`🚀 CrewRescue API running on http://localhost:${PORT}`);
    logger.info(`📡 WebSocket server ready`);
    logger.info(`📊 Metrics available at http://localhost:${PORT}/metrics`);
  });
}

bootstrap().catch((err) => {
  logger.error('Fatal startup error:', err);
  process.exit(1);
});
