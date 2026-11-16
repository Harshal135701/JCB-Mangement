import { Router } from 'express';
import { 
  searchParts, 
  getSparePartById,
  reservePartForWorkOrder,
  createSparePart,
  updateSparePart,
  deleteSparePart,
  adjustStock,
  getStoreDashboard,
  getLowStockAlerts,
  getInventoryLevels,
  getInventoryTransactions,
  createStockTransfer,
  getStockTransfers,
  getStockTransferById,
  reportDamagedStock,
  getDamagedStock,
  updateDamagedStockDisposition,
  getInventoryValuationReport,
  getInventoryMovementReport,
} from './inventory.controller';
import { authenticateJWT } from '../../middlewares/auth.middleware';
import { requireRoles } from '../../middlewares/rbac.middleware';

const router = Router();

router.use(authenticateJWT);

// Store Dashboard & Analytics
router.get('/dashboard', requireRoles('admin', 'manager', 'store_manager'), getStoreDashboard);
router.get('/alerts/low-stock', requireRoles('admin', 'manager', 'store_manager'), getLowStockAlerts);
router.get('/levels', requireRoles('admin', 'manager', 'store_manager', 'technician', 'operator'), getInventoryLevels);
router.get('/transactions', requireRoles('admin', 'manager', 'store_manager'), getInventoryTransactions);

// Stock Transfers (Inter-bin, inter-zone, inter-plant)
router.post('/transfers', requireRoles('admin', 'manager', 'store_manager'), createStockTransfer);
router.get('/transfers', requireRoles('admin', 'manager', 'store_manager'), getStockTransfers);
router.get('/transfers/:id', requireRoles('admin', 'manager', 'store_manager'), getStockTransferById);

// Damaged & Quarantined Stock Management
router.post('/damaged', requireRoles('admin', 'manager', 'store_manager'), reportDamagedStock);
router.get('/damaged', requireRoles('admin', 'manager', 'store_manager'), getDamagedStock);
router.patch('/damaged/:id/disposition', requireRoles('admin', 'manager', 'store_manager'), updateDamagedStockDisposition);

// Inventory Reports
router.get('/reports/valuation', requireRoles('admin', 'manager', 'store_manager'), getInventoryValuationReport);
router.get('/reports/movement', requireRoles('admin', 'manager', 'store_manager'), getInventoryMovementReport);

// Reservation accessible by Technician, Manager, Store Manager, Admin
router.post('/reserve', requireRoles('admin', 'manager', 'technician', 'store_manager'), reservePartForWorkOrder);

// Stock adjustment accessible by Manager, Store Manager, Admin
router.post('/adjust', requireRoles('admin', 'manager', 'store_manager'), adjustStock);

// Spare Parts Catalog Search & Listing
router.get('/', searchParts);
router.get('/search', searchParts);

// Spare Parts Master CRUD (Admin and Store Manager)
router.post('/', requireRoles('admin', 'store_manager'), createSparePart);
router.put('/:id', requireRoles('admin', 'store_manager'), updateSparePart);
router.delete('/:id', requireRoles('admin', 'store_manager'), deleteSparePart);

// Single Part Retrieval by ID (placed after specific endpoints)
router.get('/:id', getSparePartById);

export default router;
