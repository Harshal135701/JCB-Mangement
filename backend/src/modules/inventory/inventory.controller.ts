import { Request, Response, NextFunction } from 'express';
import { query } from '../../config/db';

export const searchParts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { query: searchQuery, category, page = '1', limit = '50' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

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

    // Count
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
  } catch (err) {
    next(err);
  }
};

export const reservePartForWorkOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { work_order_id, part_id, quantity } = req.body;

    if (!work_order_id || !part_id || !quantity || quantity <= 0) {
      res.status(400).json({ success: false, message: 'Valid work_order_id, part_id and quantity are required.' });
      return;
    }

    // Atomic transaction: check stock & update reserved_stock
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

    // Increment reserved_stock
    await query(`UPDATE spare_parts SET reserved_stock = reserved_stock + $1 WHERE id = $2`, [quantity, part_id]);

    // Record in wo_parts_consumed
    const recordRes = await query(
      `INSERT INTO wo_parts_consumed (work_order_id, part_id, quantity_requested, issued_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [work_order_id, part_id, quantity, userId]
    );

    res.json({
      success: true,
      message: `Part ${part.part_number} reserved successfully for Work Order.`,
      data: recordRes.rows[0],
    });
  } catch (err) {
    next(err);
  }
};
