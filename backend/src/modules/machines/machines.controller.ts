import { Request, Response, NextFunction } from 'express';
import { query } from '../../config/db';

export const getMachines = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, shop_id, criticality, search, page = '1', limit = '50' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let sql = `
      SELECT m.*, s.shop_name, p.plant_name
      FROM machines m
      JOIN shops s ON m.shop_id = s.id
      JOIN plants p ON s.plant_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status) {
      params.push(status);
      sql += ` AND m.status = $${params.length}`;
    }
    if (shop_id) {
      params.push(shop_id);
      sql += ` AND m.shop_id = $${params.length}`;
    }
    if (criticality) {
      params.push(criticality);
      sql += ` AND m.criticality = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (m.machine_code ILIKE $${params.length} OR m.name ILIKE $${params.length} OR m.serial_number ILIKE $${params.length})`;
    }

    sql += ` ORDER BY m.machine_code ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(Number(limit), offset);

    const result = await query(sql, params);

    // Get total count
    const countResult = await query('SELECT COUNT(*) FROM machines');
    const total = parseInt(countResult.rows[0].count, 10);

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

export const getMachineByQR = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { uid } = req.params;

    const result = await query(
      `SELECT m.*, s.shop_name, p.plant_name
       FROM machines m
       JOIN shops s ON m.shop_id = s.id
       JOIN plants p ON s.plant_id = p.id
       WHERE m.qr_code_uid = $1 OR m.machine_code = $1`,
      [uid]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: `No machine found matching QR identifier: ${uid}` });
      return;
    }

    const machine = result.rows[0];

    // Also fetch active open breakdown or work order if any
    const activeTicket = await query(
      `SELECT id, ticket_number, issue_category, priority, status, breakdown_occurred_at, problem_title
       FROM breakdown_tickets
       WHERE machine_id = $1 AND status NOT IN ('verified_closed', 'rejected')
       ORDER BY created_at DESC LIMIT 1`,
      [machine.id]
    );

    res.json({
      success: true,
      data: {
        ...machine,
        activeBreakdown: activeTicket.rows[0] || null,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getMachineById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT m.*, s.shop_name, p.plant_name
       FROM machines m
       JOIN shops s ON m.shop_id = s.id
       JOIN plants p ON s.plant_id = p.id
       WHERE m.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Machine not found.' });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};
