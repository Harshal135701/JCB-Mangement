import { Request, Response, NextFunction } from 'express';
import { query } from '../../config/db';
import {
  reservePartForWorkOrderService,
  adjustStockService,
  InventoryError,
  getStoreDashboardService,
  getLowStockAlertsService,
  createStockTransferService,
  getStockTransfersService,
  getStockTransferByIdService,
  reportDamagedStockService,
  getDamagedStockService,
  updateDamagedStockDispositionService,
  getInventoryTransactionsService,
  getInventoryValuationReportService,
  getInventoryMovementReportService,
  getInventoryLevelsService,
} from './inventory.service';
import { AuthenticatedUser } from '../../middlewares/auth.middleware';
import { getIo } from '../../config/socket';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Search and list spare parts catalog with server-side pagination, category filtering,
 * and Trigram / ILIKE search across part number, OEM number, and name.
 */
export const searchParts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { query: searchQuery, category, page = '1', limit = '50', sort_by = 'part_number', sort_order = 'ASC' } = req.query;

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    // Allowed sort columns
    const allowedSortColumns: Record<string, string> = {
      part_number: 'part_number',
      name: 'name',
      category: 'category',
      current_physical_stock: 'current_physical_stock',
      available_stock: 'available_stock',
      unit_cost: 'unit_cost',
      created_at: 'created_at',
    };
    const sortCol = allowedSortColumns[String(sort_by)] || 'part_number';
    const sortDir = String(sort_order).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    let sql = `
      SELECT id, part_number, oem_part_number, name, description, category, subcategory,
             uom, warehouse_zone, bin_location, rack_number, shelf_number, bin_number,
             current_physical_stock, reserved_stock, quarantined_stock, available_stock,
             min_reorder_level, max_stock_level, unit_cost, supplier_name, plant_id, status,
             created_at, updated_at
      FROM spare_parts
      WHERE status = 'active'
    `;
    const params: any[] = [];

    if (searchQuery && String(searchQuery).trim()) {
      params.push(`%${String(searchQuery).trim()}%`);
      sql += ` AND (part_number ILIKE $${params.length} OR name ILIKE $${params.length} OR oem_part_number ILIKE $${params.length})`;
    }

    if (category && String(category).trim() && String(category).trim().toLowerCase() !== 'all') {
      params.push(String(category).trim());
      sql += ` AND category = $${params.length}`;
    }

    sql += ` ORDER BY ${sortCol} ${sortDir} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limitNum, offset);

    const result = await query(sql, params);

    // Synchronized count query with matching filters
    let countSql = `SELECT COUNT(*) FROM spare_parts WHERE status = 'active'`;
    const countParams: any[] = [];

    if (searchQuery && String(searchQuery).trim()) {
      countParams.push(`%${String(searchQuery).trim()}%`);
      countSql += ` AND (part_number ILIKE $${countParams.length} OR name ILIKE $${countParams.length} OR oem_part_number ILIKE $${countParams.length})`;
    }

    if (category && String(category).trim() && String(category).trim().toLowerCase() !== 'all') {
      countParams.push(String(category).trim());
      countSql += ` AND category = $${countParams.length}`;
    }

    const countRes = await query(countSql, countParams);
    const total = parseInt(countRes.rows[0].count, 10);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get single spare part by ID with full stock metrics and bin location
 */
export const getSparePartById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id || !UUID_REGEX.test(id)) {
      res.status(400).json({ success: false, message: 'Invalid part ID format. UUID is required.' });
      return;
    }

    const result = await query(
      `SELECT id, part_number, oem_part_number, name, description, category, subcategory,
              uom, warehouse_zone, bin_location, rack_number, shelf_number, bin_number,
              current_physical_stock, reserved_stock, quarantined_stock, available_stock,
              min_reorder_level, max_stock_level, unit_cost, supplier_name, plant_id, status,
              created_at, updated_at
       FROM spare_parts
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Spare part not found.' });
      return;
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Reserve spare part for an active work order
 */
export const reservePartForWorkOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !user.id) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized: Authentication required.',
      });
      return;
    }

    if (!['admin', 'manager', 'technician', 'store_manager'].includes(user.role)) {
      res.status(403).json({
        success: false,
        message: `Forbidden: Role '${user.role}' is not authorized to reserve inventory.`,
      });
      return;
    }

    const { work_order_id, part_id, quantity } = req.body || {};

    if (!work_order_id || typeof work_order_id !== 'string' || !UUID_REGEX.test(work_order_id.trim())) {
      res.status(400).json({
        success: false,
        message: 'Invalid or missing work_order_id. A valid UUID is required.',
      });
      return;
    }

    if (!part_id || typeof part_id !== 'string' || !UUID_REGEX.test(part_id.trim())) {
      res.status(400).json({
        success: false,
        message: 'Invalid or missing part_id. A valid UUID is required.',
      });
      return;
    }

    let parsedQuantity: number;
    if (typeof quantity === 'number') {
      if (!Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(quantity)) {
        res.status(400).json({
          success: false,
          message: 'Invalid quantity. Quantity must be a positive integer.',
        });
        return;
      }
      parsedQuantity = quantity;
    } else if (typeof quantity === 'string' && /^\d+$/.test(quantity.trim())) {
      parsedQuantity = parseInt(quantity.trim(), 10);
      if (parsedQuantity <= 0) {
        res.status(400).json({
          success: false,
          message: 'Invalid quantity. Quantity must be a positive integer.',
        });
        return;
      }
    } else {
      res.status(400).json({
        success: false,
        message: 'Invalid quantity. Quantity must be a positive integer.',
      });
      return;
    }

    try {
      const result = await reservePartForWorkOrderService(
        {
          work_order_id: work_order_id.trim(),
          part_id: part_id.trim(),
          quantity: parsedQuantity,
        },
        user
      );

      const io = getIo();
      if (io) {
        io.emit('inventory:stock_adjusted', {
          partId: result.spare_part.id,
          part_number: result.spare_part.part_number,
          reserved_stock: result.spare_part.reserved_stock,
          available_stock: result.spare_part.available_stock,
        });
      }

      res.status(200).json({
        success: true,
        message: `Part ${result.spare_part.part_number} reserved successfully for Work Order.`,
        data: {
          ...result.consumption,
          part_number: result.spare_part.part_number,
          reserved_stock: result.spare_part.reserved_stock,
          available_stock: result.spare_part.available_stock,
        },
      });
    } catch (serviceErr: any) {
      if (serviceErr instanceof InventoryError) {
        const errorResponse: { success: boolean; message: string; availableStock?: number } = {
          success: false,
          message: serviceErr.message,
        };
        if (serviceErr.availableStock !== undefined) {
          errorResponse.availableStock = serviceErr.availableStock;
        }
        res.status(serviceErr.statusCode).json(errorResponse);
        return;
      }

      console.error('[Inventory Reservation Error]:', serviceErr?.message || serviceErr);
      res.status(500).json({
        success: false,
        message: 'Internal Enterprise Server Error',
      });
    }
  } catch (err) {
    next(err);
  }
};

/**
 * Create a new spare part master record (Admin and Store Manager).
 * Validates part_number, name, bin_location and numeric bounds.
 */
export const createSparePart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !user.id) {
      res.status(401).json({ success: false, message: 'Unauthorized: Authentication required.' });
      return;
    }

    if (!['admin', 'store_manager'].includes(user.role)) {
      res.status(403).json({ success: false, message: `Forbidden: Role '${user.role}' is not authorized to create spare parts.` });
      return;
    }

    const {
      part_number,
      oem_part_number,
      name,
      description,
      category = 'Mechanical',
      subcategory,
      uom = 'Nos',
      warehouse_zone = 'Main Store',
      bin_location,
      current_physical_stock = 0,
      min_reorder_level = 5,
      max_stock_level = 100,
      unit_cost = 0,
      supplier_name,
      plant_id,
    } = req.body;

    if (!part_number || typeof part_number !== 'string' || !part_number.trim()) {
      res.status(400).json({ success: false, message: 'part_number is required.' });
      return;
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ success: false, message: 'name is required.' });
      return;
    }

    if (!bin_location || typeof bin_location !== 'string' || !bin_location.trim()) {
      res.status(400).json({ success: false, message: 'bin_location is required.' });
      return;
    }

    const assignedPlantId = user.role !== 'admin'
      ? (user.plant_id || plant_id || null)
      : (plant_id || user.plant_id || null);

    const trimmedPartNo = part_number.trim();
    const trimmedName = name.trim();
    const trimmedBin = bin_location.trim();
    const physicalStockNum = Math.max(0, parseInt(String(current_physical_stock), 10) || 0);
    const minReorderNum = Math.max(0, parseInt(String(min_reorder_level), 10) || 5);
    const maxStockNum = Math.max(1, parseInt(String(max_stock_level), 10) || 100);
    const unitCostNum = Math.max(0, parseFloat(String(unit_cost)) || 0);

    const result = await query(
      `INSERT INTO spare_parts (
        part_number, oem_part_number, name, description, category, subcategory,
        uom, warehouse_zone, bin_location, current_physical_stock, min_reorder_level,
        max_stock_level, unit_cost, supplier_name, plant_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        trimmedPartNo,
        oem_part_number ? String(oem_part_number).trim() : null,
        trimmedName,
        description ? String(description).trim() : null,
        category ? String(category).trim() : 'Mechanical',
        subcategory ? String(subcategory).trim() : null,
        uom ? String(uom).trim() : 'Nos',
        warehouse_zone ? String(warehouse_zone).trim() : 'Main Store',
        trimmedBin,
        physicalStockNum,
        minReorderNum,
        maxStockNum,
        unitCostNum,
        supplier_name ? String(supplier_name).trim() : 'JCB Genuine Parts',
        assignedPlantId,
      ]
    );

    const newPart = result.rows[0];

    // If part was created with initial physical stock > 0, log immutable audit transaction
    if (physicalStockNum > 0 && user?.id) {
      try {
        await query(
          `INSERT INTO inventory_transactions (
            part_id, transaction_type, quantity, source_location, destination_location,
            performed_by, remarks, created_at
          ) VALUES ($1, 'STOCK_IN', $2, 'Goods Receiving', $3, $4, 'Initial stock intake upon catalog creation', NOW())`,
          [newPart.id, physicalStockNum, `Bin: ${trimmedBin}`, user.id]
        );
      } catch (txErr) {
        console.warn('[Initial Stock Transaction Warning]:', txErr);
      }
    }

    const io = getIo();
    if (io) {
      io.emit('inventory:part_created', { part: newPart });
      io.emit('inventory:stock_adjusted', { partId: newPart.id });
    }

    res.status(201).json({
      success: true,
      message: `Spare Part ${trimmedPartNo} added to catalog successfully.`,
      data: newPart,
    });
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(409).json({ success: false, message: `Part Number '${req.body.part_number}' already exists in catalog.` });
      return;
    }
    next(err);
  }
};

/**
 * Update spare part metadata (Admin and Store Manager).
 * Note: Physical stock, reserved stock, quarantined stock and available stock
 * CANNOT be updated through this endpoint; stock changes must use /adjust or /reserve.
 */
export const updateSparePart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !user.id) {
      res.status(401).json({ success: false, message: 'Unauthorized: Authentication required.' });
      return;
    }

    if (!['admin', 'store_manager'].includes(user.role)) {
      res.status(403).json({ success: false, message: `Forbidden: Role '${user.role}' is not authorized to update spare parts.` });
      return;
    }

    const { id } = req.params;
    if (!id || !UUID_REGEX.test(id)) {
      res.status(400).json({ success: false, message: 'Invalid part ID format. UUID is required.' });
      return;
    }

    // Plant isolation check for store manager
    if (user.role !== 'admin' && user.plant_id) {
      const partCheck = await query('SELECT id, plant_id FROM spare_parts WHERE id = $1', [id]);
      if (partCheck.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Spare part not found.' });
        return;
      }
      if (partCheck.rows[0].plant_id && partCheck.rows[0].plant_id !== user.plant_id) {
        res.status(403).json({ success: false, message: 'Forbidden: Cannot update spare parts assigned to another plant.' });
        return;
      }
    }

    const {
      name,
      oem_part_number,
      description,
      category,
      subcategory,
      uom,
      warehouse_zone,
      bin_location,
      min_reorder_level,
      max_stock_level,
      unit_cost,
      supplier_name,
    } = req.body;

    const minReorderNum = min_reorder_level !== undefined ? Math.max(0, parseInt(String(min_reorder_level), 10) || 0) : null;
    const maxStockNum = max_stock_level !== undefined ? Math.max(1, parseInt(String(max_stock_level), 10) || 100) : null;
    const unitCostNum = unit_cost !== undefined ? Math.max(0, parseFloat(String(unit_cost)) || 0) : null;

    const result = await query(
      `UPDATE spare_parts
       SET name = COALESCE($1, name),
           oem_part_number = COALESCE($2, oem_part_number),
           description = COALESCE($3, description),
           category = COALESCE($4, category),
           subcategory = COALESCE($5, subcategory),
           uom = COALESCE($6, uom),
           warehouse_zone = COALESCE($7, warehouse_zone),
           bin_location = COALESCE($8, bin_location),
           min_reorder_level = COALESCE($9, min_reorder_level),
           max_stock_level = COALESCE($10, max_stock_level),
           unit_cost = COALESCE($11, unit_cost),
           supplier_name = COALESCE($12, supplier_name),
           updated_at = NOW()
       WHERE id = $13
       RETURNING id, part_number, oem_part_number, name, description, category, subcategory,
                 uom, warehouse_zone, bin_location, rack_number, shelf_number, bin_number,
                 current_physical_stock, reserved_stock, quarantined_stock, available_stock,
                 min_reorder_level, max_stock_level, unit_cost, supplier_name, plant_id, status, updated_at`,
      [
        name ? String(name).trim() : null,
        oem_part_number !== undefined ? (oem_part_number ? String(oem_part_number).trim() : null) : null,
        description !== undefined ? (description ? String(description).trim() : null) : null,
        category ? String(category).trim() : null,
        subcategory !== undefined ? (subcategory ? String(subcategory).trim() : null) : null,
        uom ? String(uom).trim() : null,
        warehouse_zone ? String(warehouse_zone).trim() : null,
        bin_location ? String(bin_location).trim() : null,
        minReorderNum,
        maxStockNum,
        unitCostNum,
        supplier_name !== undefined ? (supplier_name ? String(supplier_name).trim() : null) : null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Spare part not found.' });
      return;
    }

    const io = getIo();
    if (io) {
      io.emit('inventory:part_updated', { part: result.rows[0] });
      io.emit('inventory:stock_adjusted', { partId: id });
    }

    res.json({
      success: true,
      message: 'Spare part updated successfully.',
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete or soft-delete spare part (Admin and Store Manager).
 * If the part has historical transactions, consumed records, or active stock,
 * it is safely transitioned to 'inactive' to maintain referential integrity.
 */
export const deleteSparePart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !user.id) {
      res.status(401).json({ success: false, message: 'Unauthorized: Authentication required.' });
      return;
    }

    if (!['admin', 'store_manager'].includes(user.role)) {
      res.status(403).json({ success: false, message: `Forbidden: Role '${user.role}' is not authorized to delete spare parts.` });
      return;
    }

    const { id } = req.params;
    if (!id || !UUID_REGEX.test(id)) {
      res.status(400).json({ success: false, message: 'Invalid part ID format. UUID is required.' });
      return;
    }

    const partRes = await query('SELECT id, part_number, plant_id, current_physical_stock, reserved_stock, quarantined_stock FROM spare_parts WHERE id = $1', [id]);
    if (partRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Spare part not found.' });
      return;
    }
    const part = partRes.rows[0];

    // Plant isolation check for store manager
    if (user.role !== 'admin' && user.plant_id && part.plant_id && part.plant_id !== user.plant_id) {
      res.status(403).json({ success: false, message: 'Forbidden: Cannot delete spare parts assigned to another plant.' });
      return;
    }

    // Check historical usage in work orders
    const checkUsage = await query('SELECT count(*) FROM wo_parts_consumed WHERE part_id = $1', [id]);
    const usageCount = parseInt(checkUsage.rows[0]?.count || '0', 10);

    // Check historical usage in inventory transactions
    const checkTx = await query('SELECT count(*) FROM inventory_transactions WHERE part_id = $1', [id]);
    const txCount = parseInt(checkTx.rows[0]?.count || '0', 10);

    const hasStock = Number(part.current_physical_stock) > 0 || Number(part.reserved_stock) > 0 || Number(part.quarantined_stock) > 0;

    if (usageCount > 0 || txCount > 0 || hasStock) {
      const updateRes = await query(
        `UPDATE spare_parts SET status = 'inactive', updated_at = NOW() WHERE id = $1 RETURNING *`,
        [id]
      );
      const io = getIo();
      if (io) {
        io.emit('inventory:part_deleted', { partId: id });
        io.emit('inventory:stock_adjusted', { partId: id });
      }
      res.json({
        success: true,
        message: 'Part has historical ledger transactions or active stock. Marked inactive rather than hard deleted.',
        data: updateRes.rows[0],
      });
      return;
    }

    try {
      const delRes = await query('DELETE FROM spare_parts WHERE id = $1 RETURNING id, part_number', [id]);
      const io = getIo();
      if (io) {
        io.emit('inventory:part_deleted', { partId: id });
        io.emit('inventory:stock_adjusted', { partId: id });
      }
      res.json({
        success: true,
        message: `Part ${delRes.rows[0].part_number} deleted successfully from master catalog.`,
        data: delRes.rows[0],
      });
    } catch (delErr: any) {
      if (delErr.code === '23503') {
        const updateRes = await query(
          `UPDATE spare_parts SET status = 'inactive', updated_at = NOW() WHERE id = $1 RETURNING *`,
          [id]
        );
        const io = getIo();
        if (io) {
          io.emit('inventory:part_deleted', { partId: id });
          io.emit('inventory:stock_adjusted', { partId: id });
        }
        res.json({
          success: true,
          message: 'Part has foreign key relationships. Marked inactive rather than hard deleted.',
          data: updateRes.rows[0],
        });
        return;
      }
      throw delErr;
    }
  } catch (err) {
    next(err);
  }
};

/**
 * Adjust physical stock quantity (+ or -) with mandatory audit reason (Admin, Manager, Store Manager).
 * Uses transactional row-locking and writes to immutable inventory_transactions ledger.
 */
export const adjustStock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !user.id) {
      res.status(401).json({ success: false, message: 'Unauthorized: Authentication required.' });
      return;
    }

    if (!['admin', 'manager', 'store_manager'].includes(user.role)) {
      res.status(403).json({ success: false, message: `Forbidden: Role '${user.role}' is not authorized to adjust stock.` });
      return;
    }

    const { part_id, adjustment_quantity, quantity, reason } = req.body || {};

    if (!part_id || typeof part_id !== 'string' || !UUID_REGEX.test(part_id.trim())) {
      res.status(400).json({ success: false, message: 'Invalid or missing part_id. A valid UUID is required.' });
      return;
    }

    const rawQty = adjustment_quantity !== undefined ? adjustment_quantity : quantity;
    const parsedQty = typeof rawQty === 'number' ? rawQty : parseInt(String(rawQty).trim(), 10);
    if (!Number.isInteger(parsedQty) || parsedQty === 0 || !Number.isFinite(parsedQty)) {
      res.status(400).json({ success: false, message: 'Invalid adjustment_quantity. Must be a non-zero integer (+ or -).' });
      return;
    }

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      res.status(400).json({ success: false, message: 'Reason for adjustment is mandatory.' });
      return;
    }

    try {
      const result = await adjustStockService(
        {
          part_id: part_id.trim(),
          adjustment_quantity: parsedQty,
          reason: reason.trim(),
        },
        user
      );

      const io = getIo();
      if (io) {
        io.emit('inventory:stock_adjusted', {
          partId: result.spare_part.id,
          part_number: result.spare_part.part_number,
          reserved_stock: result.spare_part.reserved_stock,
          available_stock: result.spare_part.available_stock,
        });
      }

      res.status(200).json({
        success: true,
        message: `Stock successfully adjusted by ${parsedQty > 0 ? `+${parsedQty}` : parsedQty} units. New physical stock: ${result.spare_part.current_physical_stock}.`,
        data: result.spare_part,
      });
    } catch (serviceErr: any) {
      if (serviceErr instanceof InventoryError) {
        res.status(serviceErr.statusCode).json({
          success: false,
          message: serviceErr.message,
        });
        return;
      }
      throw serviceErr;
    }
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// Store Manager Extended Handlers
// ---------------------------------------------------------------------------

/**
 * GET /dashboard - Store Dashboard Summary KPIs & Status
 */
export const getStoreDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await getStoreDashboardService(req.user as AuthenticatedUser);
    res.json({ success: true, data });
  } catch (err: any) {
    if (err instanceof InventoryError) {
      res.status(err.statusCode).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
};

/**
 * GET /alerts/low-stock - Low-stock alerts and reorder recommendations
 */
export const getLowStockAlerts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await getLowStockAlertsService(req.query as any, req.user as AuthenticatedUser);
    res.json({ success: true, ...result });
  } catch (err: any) {
    if (err instanceof InventoryError) {
      res.status(err.statusCode).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
};

/**
 * GET /levels - Filtered inventory stock levels and health statuses
 */
export const getInventoryLevels = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await getInventoryLevelsService(req.query as any, req.user as AuthenticatedUser);
    res.json({ success: true, ...result });
  } catch (err: any) {
    if (err instanceof InventoryError) {
      res.status(err.statusCode).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
};

/**
 * GET /transactions - Immutable inventory transaction ledger audit history
 */
export const getInventoryTransactions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await getInventoryTransactionsService(req.query as any, req.user as AuthenticatedUser);
    res.json({ success: true, ...result });
  } catch (err: any) {
    if (err instanceof InventoryError) {
      res.status(err.statusCode).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
};

/**
 * POST /transfers - Create and execute stock transfer (intra-plant or inter-plant)
 */
export const createStockTransfer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = {
      ...req.body,
      source_location: req.body.source_location || req.body.source_bin,
      destination_location: req.body.destination_location || req.body.destination_bin,
      remarks: req.body.remarks || req.body.reason,
    };
    const result = await createStockTransferService(payload, req.user as AuthenticatedUser);
    const io = getIo();
    if (io) {
      io.emit('inventory:transfer_created', { transfer: result });
      io.emit('inventory:stock_adjusted', { partId: result.part_id });
    }
    res.status(201).json({
      success: true,
      message: `Stock transfer ${result.transfer_number} processed successfully.`,
      data: result,
    });
  } catch (err: any) {
    if (err instanceof InventoryError) {
      res.status(err.statusCode).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
};

/**
 * GET /transfers - List stock transfers with pagination & filters
 */
export const getStockTransfers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await getStockTransfersService(req.query as any, req.user as AuthenticatedUser);
    res.json({ success: true, ...result });
  } catch (err: any) {
    if (err instanceof InventoryError) {
      res.status(err.statusCode).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
};

/**
 * GET /transfers/:id - Retrieve details of single stock transfer
 */
export const getStockTransferById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await getStockTransferByIdService(req.params.id, req.user as AuthenticatedUser);
    res.json({ success: true, data });
  } catch (err: any) {
    if (err instanceof InventoryError) {
      res.status(err.statusCode).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
};

/**
 * POST /damaged - Quarantine and report damaged or expired stock
 */
export const reportDamagedStock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = {
      ...req.body,
      damage_type: req.body.damage_type || 'damaged',
      reason: req.body.reason || req.body.damage_reason || req.body.remarks,
      disposition: req.body.disposition || 'quarantined',
      quarantined_bin: req.body.quarantined_bin || 'QUAR-BIN-01',
    };
    const result = await reportDamagedStockService(payload, req.user as AuthenticatedUser);
    const io = getIo();
    if (io) {
      io.emit('inventory:damaged_reported', { damaged: result });
      io.emit('inventory:stock_adjusted', { partId: result.part_id });
    }
    res.status(201).json({
      success: true,
      message: `Damaged stock report ${result.report_number} created and parts moved to quarantine.`,
      data: result,
    });
  } catch (err: any) {
    if (err instanceof InventoryError) {
      res.status(err.statusCode).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
};

/**
 * GET /damaged - List damaged & quarantined stock items
 */
export const getDamagedStock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await getDamagedStockService(req.query as any, req.user as AuthenticatedUser);
    res.json({ success: true, ...result });
  } catch (err: any) {
    if (err instanceof InventoryError) {
      res.status(err.statusCode).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
};

/**
 * PATCH /damaged/:id/disposition - Resolve damaged stock quarantine disposition (scrapped, returned_to_vendor, repaired_restocked)
 */
export const updateDamagedStockDisposition = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await updateDamagedStockDispositionService(req.params.id, req.body, req.user as AuthenticatedUser);
    const io = getIo();
    if (io) {
      io.emit('inventory:disposition_updated', { disposition: result });
      io.emit('inventory:stock_adjusted', { partId: result.part_id });
    }
    res.json({
      success: true,
      message: `Damaged stock disposition updated to '${result.disposition}'.`,
      data: result,
    });
  } catch (err: any) {
    if (err instanceof InventoryError) {
      res.status(err.statusCode).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
};

/**
 * GET /reports/valuation - Inventory total and category-wise valuation report
 */
export const getInventoryValuationReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await getInventoryValuationReportService(req.user as AuthenticatedUser);
    res.json({ success: true, data });
  } catch (err: any) {
    if (err instanceof InventoryError) {
      res.status(err.statusCode).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
};

/**
 * GET /reports/movement - Inventory stock intake, consumption, transfer and scrap movement trends
 */
export const getInventoryMovementReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await getInventoryMovementReportService(req.query as any, req.user as AuthenticatedUser);
    res.json({ success: true, ...result });
  } catch (err: any) {
    if (err instanceof InventoryError) {
      res.status(err.statusCode).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
};
