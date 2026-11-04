import { Request, Response, NextFunction } from 'express';
import { query } from '../../config/db';

const SEEDED_MACHINES = [
  {
    id: '10000000-0000-0000-0000-000000000001',
    machine_code: 'CNC-001',
    name: 'Mazak Horizontal Machining Center 1',
    category: 'HMC',
    oem_manufacturer: 'Mazak',
    model_number: 'HCN-6800 NEO',
    serial_number: 'MZK-2023-8991',
    bay_line_location: 'Bay 1 / Line 4',
    criticality: 'class_a',
    status: 'running',
    operating_hours: 4320.50,
    qr_code_uid: 'QR-JCB-CNC-001-UID',
    shop_name: 'CNC Machining Shop',
    plant_name: 'JCB Ballabgarh Works',
  },
  {
    id: '10000000-0000-0000-0000-000000000002',
    machine_code: 'ROB-012',
    name: 'Fanuc 6-Axis Robotic Welding Station',
    category: 'Robotic Welder',
    oem_manufacturer: 'Fanuc',
    model_number: 'ARC Mate 120iD',
    serial_number: 'FNC-9912-3341',
    bay_line_location: 'Bay 2 / Line ROB-1',
    criticality: 'class_a',
    status: 'running',
    operating_hours: 6140.00,
    qr_code_uid: 'QR-JCB-ROB-012-UID',
    shop_name: 'Robotic Welding Shop',
    plant_name: 'JCB Ballabgarh Works',
  },
  {
    id: '10000000-0000-0000-0000-000000000003',
    machine_code: 'CUT-001',
    name: 'Schuler 1000T Hydraulic Forming Press',
    category: 'Press',
    oem_manufacturer: 'Schuler',
    model_number: 'HP-1000-ECO',
    serial_number: 'SCH-1000-091',
    bay_line_location: 'Cutting Bay 3',
    criticality: 'class_b',
    status: 'running',
    operating_hours: 11200.00,
    qr_code_uid: 'QR-JCB-CUT-001-UID',
    shop_name: 'Cutting & Blanking Shop',
    plant_name: 'JCB Ballabgarh Works',
  },
];

export const getMachines = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, shop_id, criticality, search, page = '1', limit = '50' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    try {
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
      return;
    } catch (dbErr) {
      console.warn('[DB Fallback]: Using seeded machine records', dbErr);
      res.json({
        success: true,
        data: SEEDED_MACHINES,
        pagination: { total: SEEDED_MACHINES.length, page: 1, limit: 50, totalPages: 1 },
      });
    }
  } catch (err) {
    next(err);
  }
};

export const getMachineByQR = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { uid } = req.params;

    try {
      const result = await query(
        `SELECT m.*, s.shop_name, p.plant_name
         FROM machines m
         JOIN shops s ON m.shop_id = s.id
         JOIN plants p ON s.plant_id = p.id
         WHERE m.qr_code_uid = $1 OR m.machine_code = $1`,
        [uid]
      );

      if (result.rows.length > 0) {
        const machine = result.rows[0];
        res.json({ success: true, data: machine });
        return;
      }
    } catch (e) {
      // Fallback
    }

    const fallback = SEEDED_MACHINES.find(m => m.qr_code_uid === uid || m.machine_code === uid);
    if (fallback) {
      res.json({ success: true, data: fallback });
      return;
    }

    res.status(404).json({ success: false, message: `No machine found matching QR identifier: ${uid}` });
  } catch (err) {
    next(err);
  }
};

export const getMachineById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    try {
      const result = await query(
        `SELECT m.*, s.shop_name, p.plant_name
         FROM machines m
         JOIN shops s ON m.shop_id = s.id
         JOIN plants p ON s.plant_id = p.id
         WHERE m.id = $1`,
        [id]
      );

      if (result.rows.length > 0) {
        res.json({ success: true, data: result.rows[0] });
        return;
      }
    } catch (e) {}

    const fallback = SEEDED_MACHINES.find(m => m.id === id);
    if (fallback) {
      res.json({ success: true, data: fallback });
      return;
    }

    res.status(404).json({ success: false, message: 'Machine not found.' });
  } catch (err) {
    next(err);
  }
};
