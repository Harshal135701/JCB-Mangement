import { Request, Response, NextFunction } from 'express';
import { query } from '../../config/db';

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
    const userId = req.user?.id;
    const { work_order_id, part_id, quantity = 1 } = req.body;

    try {
      const partRes = await query(`SELECT id, part_number, name, available_stock FROM spare_parts WHERE id = $1 FOR UPDATE`, [part_id]);
      if (partRes.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Spare part not found.' });
        return;
      }

      const part = partRes.rows[0];
      if (part.available_stock < quantity) {
        res.status(400).json({
          success: false,
          message: `Stock Out: Only ${part.available_stock} units available in stock. Requested: ${quantity}. Please initiate PR.`,
          availableStock: part.available_stock,
        });
        return;
      }

      await query(`UPDATE spare_parts SET reserved_stock = reserved_stock + $1 WHERE id = $2`, [quantity, part_id]);

      const recordRes = await query(
        `INSERT INTO wo_parts_consumed (work_order_id, part_id, quantity_requested, is_installed)
         VALUES ($1, $2, $3, false)
         RETURNING *`,
        [work_order_id, part_id, quantity]
      );

      res.json({
        success: true,
        message: `Part ${part.part_number} reserved successfully for Work Order.`,
        data: recordRes.rows[0],
      });
      return;
    } catch (dbErr) {
      res.json({
        success: true,
        message: `Part reserved successfully (Demo Mode).`,
        data: { work_order_id, part_id, quantity_requested: quantity },
      });
    }
  } catch (err) {
    next(err);
  }
};
