import { Request, Response, NextFunction } from 'express';
import { query } from '../../config/db';

export const createRDC = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;
    const {
      rdc_type = 'RDC',
      work_order_id,
      machine_id,
      vendor_party_name,
      vendor_name,
      vendor_gstin,
      vendor_address,
      contact_person,
      purpose,
      expected_return_date,
      items = [], // array of { part_id, item_description, serial_number, quantity_dispatched, approximate_value }
    } = req.body;

    const effectiveVendorPartyName = vendor_party_name || vendor_name;

    if (!effectiveVendorPartyName || !purpose) {
      res.status(400).json({ success: false, message: 'Vendor name and dispatch purpose are mandatory.' });
      return;
    }

    // Auto-generate Challan Number (e.g. RDC-2026-00001)
    const countRes = await query('SELECT COUNT(*) FROM rdc_challans');
    const seq = parseInt(countRes.rows[0].count, 10) + 1;
    const challan_number = `${rdc_type}-${new Date().getFullYear()}-${String(seq).padStart(5, '0')}`;

    const insertChallan = await query(
      `INSERT INTO rdc_challans (
        challan_number, rdc_type, work_order_id, machine_id, vendor_party_name,
        vendor_gstin, vendor_address, contact_person, purpose, expected_return_date,
        status, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending_approval', $11)
      RETURNING *`,
      [
        challan_number,
        rdc_type,
        work_order_id || null,
        machine_id || null,
        effectiveVendorPartyName,
        vendor_gstin || '',
        vendor_address || '',
        contact_person || '',
        purpose,
        expected_return_date || null,
        userId,
      ]
    );

    const challan = insertChallan.rows[0];

    // Insert line items
    for (const item of items) {
      await query(
        `INSERT INTO rdc_items (rdc_id, part_id, item_description, serial_number, quantity_dispatched, approximate_value)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [challan.id, item.part_id || null, item.item_description, item.serial_number || '', item.quantity_dispatched || 1, item.approximate_value || 0]
      );
    }

    res.status(201).json({
      success: true,
      message: `${rdc_type} created successfully and forwarded for Manager/Admin authorization.`,
      data: challan,
    });
  } catch (err) {
    next(err);
  }
};

export const getRDCs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, rdc_type } = req.query;
    let sql = `
      SELECT r.*, m.machine_code, u.full_name as created_by_name
      FROM rdc_challans r
      LEFT JOIN machines m ON r.machine_id = m.id
      JOIN users u ON r.created_by = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (status) {
      params.push(status);
      sql += ` AND r.status = $${params.length}`;
    }
    if (rdc_type) {
      params.push(rdc_type);
      sql += ` AND r.rdc_type = $${params.length}`;
    }
    sql += ` ORDER BY r.created_at DESC`;

    const result = await query(sql, params);

    // Fetch items for each challan
    const rdcList = [];
    for (const row of result.rows) {
      const itemsRes = await query(`SELECT * FROM rdc_items WHERE rdc_id = $1`, [row.id]);
      rdcList.push({ ...row, items: itemsRes.rows });
    }

    res.json({ success: true, data: rdcList });
  } catch (err) {
    next(err);
  }
};

export const approveAndDispatchRDC = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const managerId = req.user?.id;
    const { id } = req.params;
    const { gate_pass_number } = req.body;

    const result = await query(
      `UPDATE rdc_challans
       SET status = 'dispatched',
           gate_pass_number = COALESCE($2, 'GP-' || floor(random() * 90000 + 10000)::text),
           approved_by = $3,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, gate_pass_number, managerId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'RDC not found.' });
      return;
    }

    res.json({ success: true, message: 'RDC approved and dispatched. Gate Pass generated.', data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

export const recordRDCReturn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params; // RDC ID
    const { item_id, returned_quantity } = req.body;

    const itemRes = await query(`SELECT * FROM rdc_items WHERE id = $1 AND rdc_id = $2`, [item_id, id]);
    if (itemRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Item not found in this RDC.' });
      return;
    }

    const item = itemRes.rows[0];
    const newReturned = item.quantity_returned + parseInt(returned_quantity, 10);

    await query(
      `UPDATE rdc_items SET quantity_returned = $1 WHERE id = $2`,
      [newReturned, item_id]
    );

    // Check overall RDC status (partially vs fully returned)
    const allItems = await query(`SELECT quantity_dispatched, quantity_returned FROM rdc_items WHERE rdc_id = $1`, [id]);
    let allComplete = true;
    let anyReturned = false;

    for (const it of allItems.rows) {
      if (it.quantity_returned > 0) anyReturned = true;
      if (it.quantity_returned < it.quantity_dispatched) allComplete = false;
    }

    const newStatus = allComplete ? 'fully_returned' : (anyReturned ? 'partially_returned' : 'dispatched');

    const updatedRDC = await query(
      `UPDATE rdc_challans 
       SET status = $1, actual_return_date = CASE WHEN $1 = 'fully_returned' THEN CURRENT_DATE ELSE actual_return_date END, updated_at = NOW() 
       WHERE id = $2 RETURNING *`,
      [newStatus, id]
    );

    res.json({
      success: true,
      message: `Return recorded. RDC Status: ${newStatus}`,
      data: updatedRDC.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

