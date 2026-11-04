import { Request, Response, NextFunction } from 'express';
import { query } from '../../config/db';

export const getInspectionTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { category = 'HMC' } = req.query;

    const result = await query(
      `SELECT * FROM inspection_templates WHERE machine_category = $1 AND is_active = true LIMIT 1`,
      [category]
    );

    if (result.rows.length === 0) {
      // Default standard checklist if specific category template not yet customized
      res.json({
        success: true,
        data: {
          title: 'Daily Pre-Shift Machinery Inspection Checklist',
          checklist: [
            { id: 'chk-1', label: 'Hydraulic System Pressure within 45 - 55 Bar', type: 'number', unit: 'Bar', min: 45, max: 55, required: true },
            { id: 'chk-2', label: 'Chiller Unit Operating Temperature (18C - 24C)', type: 'number', unit: 'C', min: 18, max: 24, required: true },
            { id: 'chk-3', label: 'Visual Check: No hydraulic fluid pooling or line leaks', type: 'boolean', required: true },
            { id: 'chk-4', label: 'Emergency Stop & Safety Enclosure Interlock Operational', type: 'boolean', required: true },
            { id: 'chk-5', label: 'Way Lube Automatic Lubrication Reservoir Full', type: 'boolean', required: true },
          ],
        },
      });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

export const submitInspection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const operatorId = req.user?.id;
    const {
      machine_id,
      shift = 'Shift A',
      overall_status = 'pass',
      temperature,
      pressure,
      vibration,
      responses_json = [],
      operator_signature_url,
    } = req.body;

    if (!machine_id) {
      res.status(400).json({ success: false, message: 'Machine ID is mandatory.' });
      return;
    }

    const insertRes = await query(
      `INSERT INTO inspection_records (
        machine_id, operator_id, shift, overall_status,
        temperature, pressure, vibration, responses_json, operator_signature_url
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        machine_id,
        operatorId,
        shift,
        overall_status,
        temperature || null,
        pressure || null,
        vibration || null,
        JSON.stringify(responses_json),
        operator_signature_url || '',
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Inspection submitted successfully.',
      data: insertRes.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

export const getInspectionRecords = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { machine_id } = req.query;
    let sql = `
      SELECT ir.*, m.machine_code, m.name as machine_name, u.full_name as operator_name
      FROM inspection_records ir
      JOIN machines m ON ir.machine_id = m.id
      JOIN users u ON ir.operator_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (machine_id) {
      params.push(machine_id);
      sql += ` AND ir.machine_id = $${params.length}`;
    }
    sql += ` ORDER BY ir.created_at DESC LIMIT 50`;

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
};
