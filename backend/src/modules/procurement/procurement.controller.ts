import { Request, Response, NextFunction } from 'express';
import { query } from '../../config/db';
import { io } from '../../server';

// 1. Create Purchase Requisition (Technician or Manager when part is zero-stock)
export const createPurchaseRequisition = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;
    const {
      work_order_id,
      machine_id,
      part_id,
      quantity_required,
      urgency = 'high',
      technical_justification,
    } = req.body;

    if (!part_id || !quantity_required) {
      res.status(400).json({ success: false, message: 'Part ID and required quantity are mandatory.' });
      return;
    }

    // Auto-generate PR Number (e.g. PR-2026-00001)
    const countRes = await query('SELECT COUNT(*) FROM purchase_requisitions');
    const seq = parseInt(countRes.rows[0].count, 10) + 1;
    const pr_number = `PR-${new Date().getFullYear()}-${String(seq).padStart(5, '0')}`;

    const insertRes = await query(
      `INSERT INTO purchase_requisitions (
        pr_number, work_order_id, machine_id, part_id, quantity_required,
        urgency, technical_justification, status, requested_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'new', $8)
      RETURNING *`,
      [pr_number, work_order_id || null, machine_id || null, part_id, quantity_required, urgency, technical_justification || '', userId]
    );

    const pr = insertRes.rows[0];

    // If linked to a work order, update WO status to 'waiting_for_parts'
    if (work_order_id) {
      await query(`UPDATE work_orders SET status = 'waiting_for_parts', updated_at = NOW() WHERE id = $1`, [work_order_id]);
    }

    // Socket alert to Purchase/Manager queue
    if (io) {
      io.emit('pr:created', { pr, message: `New Purchase Requisition ${pr_number} created for critical parts.` });
    }

    res.status(201).json({
      success: true,
      message: 'Purchase Requisition initiated successfully.',
      data: pr,
    });
  } catch (err) {
    next(err);
  }
};

// 2. Get All Purchase Requisitions
export const getPurchaseRequisitions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, urgency } = req.query;
    let sql = `
      SELECT pr.*, sp.part_number, sp.name as part_name, sp.unit_cost, sp.available_stock,
             u.full_name as requested_by_name, m.machine_code
      FROM purchase_requisitions pr
      JOIN spare_parts sp ON pr.part_id = sp.id
      JOIN users u ON pr.requested_by = u.id
      LEFT JOIN machines m ON pr.machine_id = m.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (status) {
      params.push(status);
      sql += ` AND pr.status = $${params.length}`;
    }
    if (urgency) {
      params.push(urgency);
      sql += ` AND pr.urgency = $${params.length}`;
    }
    sql += ` ORDER BY pr.created_at DESC`;

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
};

// 3. Update PR Status (Quotation, PO Creation, Vendor Selection)
export const updatePRStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const managerId = req.user?.id;
    const { id } = req.params;
    const { status, po_number, supplier_name, unit_price, expected_delivery_date } = req.body;

    const result = await query(
      `UPDATE purchase_requisitions
       SET status = COALESCE($2, status),
           po_number = COALESCE($3, po_number),
           supplier_name = COALESCE($4, supplier_name),
           unit_price = COALESCE($5, unit_price),
           expected_delivery_date = COALESCE($6, expected_delivery_date),
           approved_by = $7,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, status, po_number, supplier_name, unit_price, expected_delivery_date, managerId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'PR not found.' });
      return;
    }

    res.json({ success: true, message: 'Purchase requisition updated.', data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// 4. Goods Receipt Note (GRN) Inwarding & Stock Increment
export const processGRNInward = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params; // PR ID
    const { received_quantity, remarks } = req.body;

    const prRes = await query(`SELECT * FROM purchase_requisitions WHERE id = $1`, [id]);
    if (prRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'PR not found.' });
      return;
    }
    const pr = prRes.rows[0];
    const qty = parseInt(received_quantity || pr.quantity_required, 10);

    // 1. Increment physical stock
    await query(
      `UPDATE spare_parts SET current_physical_stock = current_physical_stock + $1, updated_at = NOW() WHERE id = $2`,
      [qty, pr.part_id]
    );

    // 2. Record immutable stock transaction
    await query(
      `INSERT INTO inventory_transactions (part_id, transaction_type, quantity, reference_work_order_id, performed_by, remarks)
       VALUES ($1, 'STOCK_IN', $2, $3, $4, $5)`,
      [pr.part_id, qty, pr.work_order_id, userId, remarks || `GRN posted against PO: ${pr.po_number || pr.pr_number}`]
    );

    // 3. Mark PR as fully_received
    const updatedPR = await query(
      `UPDATE purchase_requisitions 
       SET status = 'fully_received', received_date = CURRENT_DATE, updated_at = NOW() 
       WHERE id = $1 RETURNING *`,
      [id]
    );

    // 4. If linked to work order, notify technician that part has arrived and resume WO
    if (pr.work_order_id) {
      await query(`UPDATE work_orders SET status = 'in_progress', updated_at = NOW() WHERE id = $1`, [pr.work_order_id]);
      if (io) {
        io.emit(`workorder:${pr.work_order_id}:part_arrived`, {
          message: `Required part has arrived at store for WO. Repair can resume.`,
        });
      }
    }

    res.json({
      success: true,
      message: `GRN processed successfully. ${qty} units added to physical stock ledger.`,
      data: updatedPR.rows[0],
    });
  } catch (err) {
    next(err);
  }
};
