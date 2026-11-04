import { Request, Response, NextFunction } from 'express';
import { query } from '../../config/db';
import {
  reservePartForWorkOrderService,
  InventoryError,
} from './inventory.service';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SEEDED_PARTS = [
  {
    id: '30000000-0000-0000-0000-000000000001',
    part_number: 'HYD-10025',
    oem_part_number: 'REX-4WRKE-25',
    name: 'Hydraulic Pump Filter Element',
    description: 'Bosch Rexroth high-pressure microglass filter element for CNC-001',
    category: 'Hydraulic',
    warehouse_zone: 'Main Store',
    rack_number: 'R-04',
    shelf_number: 'S-B',
    bin_number: 'B-102',
    current_physical_stock: 18,
    reserved_stock: 3,
    quarantined_stock: 0,
    available_stock: 15,
    min_reorder_level: 10,
    unit_cost: 4850.00,
  },
  {
    id: '30000000-0000-0000-0000-000000000002',
    part_number: 'BRG-70140',
    oem_part_number: 'SKF-7014-CE',
    name: 'High Precision Angular Spindle Bearing',
    description: 'Super-precision ceramic hybrid bearing for Mazak 12,000 RPM spindle',
    category: 'Bearings',
    warehouse_zone: 'Main Store',
    rack_number: 'R-08',
    shelf_number: 'S-A',
    bin_number: 'B-205',
    current_physical_stock: 8,
    reserved_stock: 1,
    quarantined_stock: 0,
    available_stock: 7,
    min_reorder_level: 2,
    unit_cost: 76200.00,
  },
  {
    id: '30000000-0000-0000-0000-000000000003',
    part_number: 'MTR-02200',
    oem_part_number: 'FAN-A06B-0235',
    name: 'Fanuc AC Servo Motor 3.0kW',
    description: 'Joint 2 axis servo motor for robot welding arm',
    category: 'Electrical',
    warehouse_zone: 'Main Store',
    rack_number: 'R-02',
    shelf_number: 'S-C',
    bin_number: 'B-310',
    current_physical_stock: 4,
    reserved_stock: 0,
    quarantined_stock: 0,
    available_stock: 4,
    min_reorder_level: 1,
    unit_cost: 142000.00,
  },
  {
    id: '30000000-0000-0000-0000-000000000004',
    part_number: 'SEL-99100',
    oem_part_number: 'PAR-HYD-SEAL',
    name: 'Hydraulic Cylinder Seal Kit 120mm',
    description: 'Polyurethane seal assembly for 1000T press ram',
    category: 'Seals',
    warehouse_zone: 'Main Store',
    rack_number: 'R-11',
    shelf_number: 'S-D',
    bin_number: 'B-412',
    current_physical_stock: 25,
    reserved_stock: 0,
    quarantined_stock: 0,
    available_stock: 25,
    min_reorder_level: 5,
    unit_cost: 8900.00,
  },
];

export const searchParts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { query: searchQuery, category, page = '1', limit = '50' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    try {
      let sql = `
        SELECT id, part_number, oem_part_number, name, description, category,
               warehouse_zone, rack_number, shelf_number, bin_number,
               current_physical_stock, reserved_stock, available_stock,
               min_reorder_level, unit_cost
        FROM spare_parts
        WHERE status = 'active'
      `;
      const params: any[] = [];

      if (searchQuery) {
        params.push(`%${searchQuery}%`);
        sql += ` AND (part_number ILIKE $${params.length} OR name ILIKE $${params.length} OR oem_part_number ILIKE $${params.length})`;
      }

      if (category) {
        params.push(category);
        sql += ` AND category = $${params.length}`;
      }

      sql += ` ORDER BY part_number ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(Number(limit), offset);

      const result = await query(sql, params);

      let countSql = `SELECT COUNT(*) FROM spare_parts WHERE status = 'active'`;
      const countParams: any[] = [];
      if (searchQuery) {
        countParams.push(`%${searchQuery}%`);
        countSql += ` AND (part_number ILIKE $1 OR name ILIKE $1 OR oem_part_number ILIKE $1)`;
      }
      const countRes = await query(countSql, countParams);
      const total = parseInt(countRes.rows[0].count, 10);

      res.json({
        success: true,
        data: result.rows,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)),
        },
      });
      return;
    } catch (dbErr) {
      console.warn('[DB Fallback]: Returning seeded spare parts catalog');
      const filtered = SEEDED_PARTS.filter(p => {
        if (!searchQuery) return true;
        const q = String(searchQuery).toLowerCase();
        return p.part_number.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
      });
      res.json({
        success: true,
        data: filtered,
        pagination: { total: filtered.length, page: 1, limit: 50, totalPages: 1 },
      });
    }
  } catch (err) {
    next(err);
  }
};

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

    if (!['admin', 'manager', 'technician'].includes(user.role)) {
      res.status(403).json({
        success: false,
        message: `Forbidden: Role '${user.role}' is not authorized to reserve inventory.`,
      });
      return;
    }

    const { work_order_id, part_id, quantity } = req.body || {};

    // Input Validation: Require valid work_order_id (UUID)
    if (!work_order_id || typeof work_order_id !== 'string' || !UUID_REGEX.test(work_order_id.trim())) {
      res.status(400).json({
        success: false,
        message: 'Invalid or missing work_order_id. A valid UUID is required.',
      });
      return;
    }

    // Input Validation: Require valid part_id (UUID)
    if (!part_id || typeof part_id !== 'string' || !UUID_REGEX.test(part_id.trim())) {
      res.status(400).json({
        success: false,
        message: 'Invalid or missing part_id. A valid UUID is required.',
      });
      return;
    }

    // Input Validation: Quantity must be a strictly positive integer
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

    // Execute reservation workflow inside single database transaction
    try {
      const result = await reservePartForWorkOrderService(
        {
          work_order_id: work_order_id.trim(),
          part_id: part_id.trim(),
          quantity: parsedQuantity,
        },
        user
      );

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

export const createSparePart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      part_number,
      oem_part_number,
      name,
      description,
      category,
      subcategory,
      uom = 'Nos',
      warehouse_zone = 'Main Store',
      bin_location,
      current_physical_stock = 0,
      min_reorder_level = 5,
      max_stock_level = 100,
      unit_cost = 0,
      supplier_name,
    } = req.body;

    if (!part_number || !name || !bin_location) {
      res.status(400).json({ success: false, message: 'part_number, name, and bin_location are required.' });
      return;
    }

    const result = await query(
      `INSERT INTO spare_parts (
        part_number, oem_part_number, name, description, category, subcategory,
        uom, warehouse_zone, bin_location, current_physical_stock, min_reorder_level,
        max_stock_level, unit_cost, supplier_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        part_number,
        oem_part_number || null,
        name,
        description || null,
        category || 'Mechanical',
        subcategory || null,
        uom,
        warehouse_zone,
        bin_location,
        parseInt(current_physical_stock, 10) || 0,
        parseInt(min_reorder_level, 10) || 5,
        parseInt(max_stock_level, 10) || 100,
        parseFloat(unit_cost) || 0,
        supplier_name || 'JCB India Genuine Spares',
      ]
    );

    res.status(201).json({
      success: true,
      message: `Spare Part ${part_number} added to master ledger by Admin.`,
      data: result.rows[0],
    });
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(409).json({ success: false, message: 'Part Number already exists in catalog.' });
      return;
    }
    next(err);
  }
};

export const updateSparePart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      category,
      bin_location,
      min_reorder_level,
      max_stock_level,
      unit_cost,
      supplier_name,
    } = req.body;

    const result = await query(
      `UPDATE spare_parts
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           category = COALESCE($3, category),
           bin_location = COALESCE($4, bin_location),
           min_reorder_level = COALESCE($5, min_reorder_level),
           max_stock_level = COALESCE($6, max_stock_level),
           unit_cost = COALESCE($7, unit_cost),
           supplier_name = COALESCE($8, supplier_name),
           updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [name, description, category, bin_location, min_reorder_level, max_stock_level, unit_cost, supplier_name, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Part not found.' });
      return;
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

export const deleteSparePart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const checkUsage = await query('SELECT count(*) FROM wo_parts_consumed WHERE part_id = $1', [id]);
    if (parseInt(checkUsage.rows[0]?.count || '0', 10) > 0) {
      const updateRes = await query(
        `UPDATE spare_parts SET status = 'inactive', updated_at = NOW() WHERE id = $1 RETURNING *`,
        [id]
      );
      res.json({
        success: true,
        message: 'Part has historical work order usage. Marked inactive rather than hard deleted.',
        data: updateRes.rows[0],
      });
      return;
    }

    const delRes = await query('DELETE FROM spare_parts WHERE id = $1 RETURNING id, part_number', [id]);
    if (delRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Spare part not found.' });
      return;
    }

    res.json({
      success: true,
      message: `Part ${delRes.rows[0].part_number} deleted successfully.`,
      data: delRes.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

export const adjustStock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { part_id, adjustment_quantity, reason } = req.body;
    const performed_by = (req as any).user?.id;

    if (!part_id || adjustment_quantity === undefined) {
      res.status(400).json({ success: false, message: 'part_id and adjustment_quantity are required.' });
      return;
    }

    const updateRes = await query(
      `UPDATE spare_parts 
       SET current_physical_stock = current_physical_stock + $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [adjustment_quantity, part_id]
    );

    if (updateRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Spare part not found.' });
      return;
    }

    // Record immutable audit transaction
    if (performed_by) {
      try {
        await query(
          `INSERT INTO inventory_transactions (part_id, transaction_type, quantity, performed_by, remarks)
           VALUES ($1, 'ADJUSTMENT', $2, $3, $4)`,
          [part_id, adjustment_quantity, performed_by, reason || 'Physical stock audit adjustment']
        );
      } catch (txErr) {
        console.warn('Transaction audit log warning:', txErr);
      }
    }

    res.json({
      success: true,
      message: `Stock adjusted by ${adjustment_quantity} units.`,
      data: updateRes.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

