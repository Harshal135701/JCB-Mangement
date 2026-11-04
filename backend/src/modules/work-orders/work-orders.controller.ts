import { Request, Response, NextFunction } from 'express';
import { query } from '../../config/db';
import { io } from '../../server';
import {
  createWorkOrderFromComplaintService,
  WorkOrderServiceError,
} from './work-orders.service';

export const createWorkOrderFromComplaint = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const managerId = req.user?.id;
    const complaint_id = req.body.complaint_id || req.body.ticket_id;
    const { technician_id, sla_hours = 4, work_instructions, is_major_breakdown = false } = req.body || {};

    if (!complaint_id || !technician_id) {
      res.status(400).json({ success: false, message: 'Complaint ID and Technician ID are required.' });
      return;
    }

    const result = await createWorkOrderFromComplaintService({
      complaint_id,
      technician_id,
      manager_id: managerId,
      user: req.user,
      sla_hours: Number(sla_hours) || 4,
      work_instructions,
      is_major_breakdown: Boolean(is_major_breakdown),
    });

    res.status(201).json({
      success: true,
      message: 'Work order allocated and dispatched to technician.',
      data: result.workOrder,
    });
  } catch (err: any) {
    if (err instanceof WorkOrderServiceError) {
      res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
      return;
    }
    next(err);
  }
};

export const updateWorkOrderMilestone = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { action, notes, diagnosis, affected_component, fault_category, root_cause_analysis, corrective_action } = req.body;

    let updateSql = '';
    const params: any[] = [id];

    switch (action) {
      case 'ACCEPT':
        updateSql = `status = 'accepted', updated_at = NOW()`;
        break;
      case 'SCHEDULE':
        updateSql = `status = 'scheduled', schedule_status = 'confirmed', updated_at = NOW()`;
        break;
      case 'ARRIVED':
        updateSql = `arrival_time = NOW(), status = 'under_diagnosis', updated_at = NOW()`;
        break;
      case 'START_WORK':
        updateSql = `work_started_time = NOW(), status = 'in_progress', updated_at = NOW()`;
        break;
      case 'PAUSE':
        updateSql = `work_paused_time = NOW(), status = 'waiting_for_parts', updated_at = NOW()`;
        break;
      case 'RESUME':
        updateSql = `work_resumed_time = NOW(), status = 'in_progress', updated_at = NOW()`;
        break;
      case 'COMPLETE':
        updateSql = `
          repair_completed_time = NOW(),
          status = 'submitted_verification',
          diagnosis = $2,
          affected_component = $3,
          fault_category = $4,
          root_cause_analysis = $5,
          corrective_action = $6,
          updated_at = NOW()
        `;
        params.push(diagnosis || '', affected_component || '', fault_category || '', root_cause_analysis || '', corrective_action || '');
        break;
      default:
        res.status(400).json({ success: false, message: `Invalid action: ${action}` });
        return;
    }

    const result = await query(
      `UPDATE work_orders SET ${updateSql} WHERE id = $1 RETURNING *`,
      params
    );

    // Event Log
    await query(
      `INSERT INTO work_order_events (work_order_id, event_type, performed_by, notes) VALUES ($1, $2, $3, $4)`,
      [id, action, userId, notes || `Milestone ${action} logged`]
    );

    res.json({
      success: true,
      message: `Milestone ${action} recorded.`,
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

export const verifyAndCloseWorkOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const managerId = req.user?.id;
    const { id } = req.params;
    const { result, remarks } = req.body; // 'APPROVED' or 'REJECTED'

    if (result === 'APPROVED') {
      const updateRes = await query(
        `UPDATE work_orders 
         SET status = 'verified_closed',
             manager_verified_time = NOW(),
             machine_restored_time = NOW(),
             manager_verification_remarks = $2,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [id, remarks || 'Quality inspection passed. Machine restored to production.']
      );

      const wo = updateRes.rows[0];

      // Mark linked complaint as closed
      if (wo.complaint_id) {
        await query(`UPDATE maintenance_requests SET status = 'closed', updated_at = NOW() WHERE id = $1`, [wo.complaint_id]);
      }

      res.json({
        success: true,
        message: 'Work order verified and machine marked Running.',
        data: wo,
      });
    } else {
      const updateRes = await query(
        `UPDATE work_orders 
         SET status = 'rework_required',
             manager_verification_remarks = $2,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [id, remarks || 'Quality inspection failed. Rework requested.']
      );
      res.json({
        success: true,
        message: 'Work order rejected and returned for rework.',
        data: updateRes.rows[0],
      });
    }
  } catch (err) {
    next(err);
  }
};

export const getWorkOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { technician_id, status, priority } = req.query;

    let sql = `
      SELECT wo.*, m.machine_code, m.name as machine_name, m.bay_line_location, m.criticality,
             u.full_name as technician_name, mgr.full_name as manager_name
      FROM work_orders wo
      JOIN machines m ON wo.machine_id = m.id
      LEFT JOIN users u ON wo.assigned_technician_id = u.id
      LEFT JOIN users mgr ON wo.assigned_manager_id = mgr.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (technician_id) {
      params.push(technician_id);
      sql += ` AND wo.assigned_technician_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      sql += ` AND wo.status = $${params.length}`;
    }
    if (priority) {
      params.push(priority);
      sql += ` AND wo.priority = $${params.length}`;
    }

    sql += ` ORDER BY wo.created_at DESC`;

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
};
