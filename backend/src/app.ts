import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import { config } from './config/env';
import { errorHandler } from './middlewares/error.middleware';

// All 14 Enterprise Modules
import authRoutes from './modules/auth/auth.routes';
import orgRoutes from './modules/org/org.routes';
import machineRoutes from './modules/machines/machines.routes';
import breakdownRoutes from './modules/breakdowns/breakdowns.routes';
import workOrderRoutes from './modules/work-orders/work-orders.routes';
import inventoryRoutes from './modules/inventory/inventory.routes';
import procurementRoutes from './modules/procurement/procurement.routes';
import rdcRoutes from './modules/rdc/rdc.routes';
import pmRoutes from './modules/pm/pm.routes';
import inspectionRoutes from './modules/inspections/inspections.routes';
import notificationRoutes from './modules/notifications/notifications.routes';
import auditRoutes from './modules/audit/audit.routes';
import downtimeRoutes from './modules/downtime/downtime.routes';
import reportRoutes from './modules/reports/reports.routes';

const app: Application = express();

// Trust reverse proxy only when explicitly configured via TRUST_PROXY (e.g. 1, true, or loopback)
if (process.env.TRUST_PROXY) {
  const trustVal = process.env.TRUST_PROXY.trim();
  app.set('trust proxy', trustVal === 'true' ? true : !isNaN(Number(trustVal)) ? Number(trustVal) : trustVal);
}

// Secure CORS configuration using environment-configurable origin allowlist
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Permit requests with no origin (mobile applications, curl, server-to-server)
    if (!origin) {
      return callback(null, true);
    }
    if (config.allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // In development mode, dynamically permit any localhost / 127.0.0.1 port
    if (config.nodeEnv !== 'production') {
      const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      if (isLocalhost) {
        return callback(null, true);
      }
    }
    // Origin not allowed: omit CORS headers
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Health & Root Status
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'HEALTHY',
    service: 'JCB Smart Machine Maintenance Management System (CMMS) Backend API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/v1', (req: Request, res: Response) => {
  res.json({
    name: 'JCB Enterprise CMMS API',
    version: '1.0.0',
    modules: [
      'auth',
      'org',
      'machines',
      'breakdowns',
      'work-orders',
      'inventory',
      'procurement',
      'rdc',
      'pm',
      'inspections',
      'notifications',
      'audit',
      'downtime',
      'reports',
    ],
  });
});

// Register All Module Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/org', orgRoutes);
app.use('/api/v1/machines', machineRoutes);
app.use('/api/v1/breakdowns', breakdownRoutes);
app.use('/api/v1/work-orders', workOrderRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/procurement', procurementRoutes);
app.use('/api/v1/rdc', rdcRoutes);
app.use('/api/v1/pm', pmRoutes);
app.use('/api/v1/inspections', inspectionRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/audit', auditRoutes);
app.use('/api/v1/downtime', downtimeRoutes);
app.use('/api/v1/reports', reportRoutes);

// Global Error Handler
app.use(errorHandler);

export default app;
