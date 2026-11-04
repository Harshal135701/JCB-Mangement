import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import { errorHandler } from './middlewares/error.middleware';

// Module Routes
import authRoutes from './modules/auth/auth.routes';
import machineRoutes from './modules/machines/machines.routes';
import breakdownRoutes from './modules/breakdowns/breakdowns.routes';
import workOrderRoutes from './modules/work-orders/work-orders.routes';
import inventoryRoutes from './modules/inventory/inventory.routes';
import orgRoutes from './modules/org/org.routes';
import reportRoutes from './modules/reports/reports.routes';

const app: Application = express();

// Global Middlewares
app.use(cors({
  origin: '*', // Allows Web Frontend and React Native Mobile App
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'HEALTHY',
    service: 'JCB Smart Machine Maintenance Management System API',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/v1', (req: Request, res: Response) => {
  res.json({
    message: 'Welcome to JCB Enterprise CMMS API v1',
    modules: [
      'auth',
      'org',
      'machines',
      'breakdowns',
      'work-orders',
      'inventory',
      'reports',
    ],
  });
});

// Register Modular Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/machines', machineRoutes);
app.use('/api/v1/breakdowns', breakdownRoutes);
app.use('/api/v1/work-orders', workOrderRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/org', orgRoutes);
app.use('/api/v1/reports', reportRoutes);

// Global Error Handler
app.use(errorHandler);

export default app;

