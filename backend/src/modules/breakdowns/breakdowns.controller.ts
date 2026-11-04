import { Request, Response, NextFunction } from 'express';
import { query } from '../../config/db';
import { io } from '../../server';

export const reportBreakdown = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const operatorId = req.user?.id;
    const {
      machine_id,
      shift = 'Shift A',
      issue_category,
      priority = 'medium',
      hour_meter_reading,
      temperature,
      pressure,
      problem_title,
      description,
      breakdown_occurred_at,
      images_json = [],
    } = req.body;

    if (!machine_id || !issue_category || !problem_title || !description) {
      res.status(400).json({
        success: false,
        message: 'Missing required complaint parameters (machine_id, issue_category, problem_title, description).',
      });
      return;
    }

    // 1. Edge Case: Check for duplicate open complaints on the same machine
    const duplicateCheck = await query(
      `SELECT id, complaint_number, priority, status, created_at 
       FROM maintenance_requests 
       WHERE machine_id = $1 AND status NOT IN ('closed', 'rejected')`,
      [machine_id]
    );

    if (duplicateCheck.rows.length > 0) {
      const openComplaint = duplicateCheck.rows[0];
      res.status(409).json({
        success: false,
        isDuplicate: true,
        message: `Duplicate Warning: Complaint ${openComplaint.complaint_number} is already active for this machine.`,
        existingComplaint: openComplaint,
      });
      return;
    }

    // 2. Generate unique Complaint Number (e.g. CMP-2026-00001)
    const countRes = await query('SELECT COUNT(*) FROM maintenance_requests');
    const seq = parseInt(countRes.rows[0].count, 10) + 1;
    const complaint_number = `CMP-${new Date().getFullYear()}-${String(seq).padStart(5, '0')}`;

    const occurrenceTime = breakdown_occurred_at ? new Date(breakdown_occurred_at) : new Date();

    // 3. Insert Complaint
    const insertRes = await query(
      `INSERT INTO maintenance_requests (
        complaint_number, machine_id, reported_by_id, shift, issue_category,
        priority, status, breakdown_occurred_at, reported_at, hour_meter_reading, temperature, pressure,
        problem_title, description, images_json
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'new', $7, NOW(), $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        complaint_number,
        machine_id,
        operatorId,
        shift,
        issue_category,
        priority,
        occurrenceTime,
        hour_meter_reading,
        temperature,
        pressure,
        problem_title,
        description,
        JSON.stringify(images_json),
      ]
    );

    const complaint = insertRes.rows[0];

    // 4. Update physical machine status to 'breakdown'
    await query(
      `UPDATE machines SET status = 'breakdown', updated_at = NOW() WHERE id = $1`,
      [machine_id]
    );

    // 5. Emit real-time Socket event to Manager Web Dashboard
    if (io) {
      io.emit('complaint:created', {
        complaint,
        message: `New Complaint ${complaint_number} raised on machine.`,
      });
    }

    res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully. Manager notified.',
      data: complaint,
    });
  } catch (err) {
    next(err);
  }
};

export const getBreakdowns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, priority, shop_id, page = '1', limit = '50' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let sql = `
      SELECT r.*, m.machine_code, m.name as machine_name, m.criticality, s.shop_name, u.full_name as reported_by_name
      FROM maintenance_requests r
      JOIN machines m ON r.machine_id = m.id
      JOIN shops s ON m.shop_id = s.id
      JOIN users u ON r.reported_by_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status) {
      params.push(status);
      sql += ` AND r.status = $${params.length}`;
    }
    if (priority) {
      params.push(priority);
      sql += ` AND r.priority = $${params.length}`;
    }
    if (shop_id) {
      params.push(shop_id);
      sql += ` AND m.shop_id = $${params.length}`;
    }

    sql += ` ORDER BY r.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(Number(limit), offset);

    const result = await query(sql, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    next(err);
  }
};
