import { Request, Response, NextFunction } from 'express';
import { query } from '../../config/db';

export const createPMPlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      machine_id,
      title,
      frequency = 'monthly',
      interval_days = 30,
      operating_hour_threshold,
      checklist_template = [],
      grace_period_days = 3,
    } = req.body;

    if (!machine_id || !title) {
      res.status(400).json({ success: false, message: 'Machine ID and Plan title are required.' });
      return;
    }

    const countRes = await query('SELECT COUNT(*) FROM pm_plans');
    const seq = parseInt(countRes.rows[0].count, 10) + 1;
    const plan_code = `PM-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`;

    const nextDue = new Date(Date.now() + interval_days * 86400 * 1000);

    const insertRes = await query(
      `INSERT INTO pm_plans (
        plan_code, machine_id, title, frequency, interval_days,
        operating_hour_threshold, checklist_template, next_pm_date, grace_period_days
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        plan_code,
        machine_id,
        title,
        frequency,
        interval_days,
        operating_hour_threshold || null,
        JSON.stringify(checklist_template),
        nextDue,
        grace_period_days,
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Preventive Maintenance Plan configured.',
      data: insertRes.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

export const getPMPlans = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { machine_id } = req.query;
    let sql = `
      SELECT p.*, m.machine_code, m.name as machine_name, m.operating_hours as current_machine_hours
      FROM pm_plans p
      JOIN machines m ON p.machine_id = m.id
      WHERE p.is_active = true
    `;
    const params: any[] = [];
    if (machine_id) {
      params.push(machine_id);
      sql += ` AND p.machine_id = $${params.length}`;
    }
    sql += ` ORDER BY p.next_pm_date ASC`;

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
};

// Automatic PM Work Order Engine
export const generateDuePMWorkOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Select PM plans due within the next 3 days or operating hours threshold exceeded
    const duePlans = await query(`
      SELECT p.*, m.operating_hours, m.shop_id
      FROM pm_plans p
      JOIN machines m ON p.machine_id = m.id
      WHERE p.is_active = true 
        AND (p.next_pm_date <= CURRENT_DATE + INTERVAL '3 days' 
             OR (p.operating_hour_threshold IS NOT NULL AND m.operating_hours >= p.operating_hour_threshold))
    `);

    const generatedWOs = [];

    for (const plan of duePlans.rows) {
      // Prevent duplicate open PM work order
      const existingWO = await query(`
        SELECT id FROM work_orders 
        WHERE machine_id = $1 AND classification = 'regular_maintenance' AND status NOT IN ('verified_closed', 'completed')
      `, [plan.machine_id]);

      if (existingWO.rows.length === 0) {
        const countRes = await query('SELECT COUNT(*) FROM work_orders');
        const seq = parseInt(countRes.rows[0].count, 10) + 1;
        const wo_number = `WO-PM-${new Date().getFullYear()}-${String(seq).padStart(5, '0')}`;

        const woRes = await query(`
          INSERT INTO work_orders (
            wo_number, machine_id, priority, status, classification,
            work_instructions, sla_deadline
          )
          VALUES ($1, $2, 'medium', 'assigned', 'regular_maintenance', $3, NOW() + INTERVAL '48 hours')
          RETURNING *
        `, [
          wo_number,
          plan.machine_id,
          `Automated PM Service: ${plan.title}. Execute mandatory maintenance checklist.`,
        ]);

        generatedWOs.push(woRes.rows[0]);

        // Advance next PM date
        await query(`
          UPDATE pm_plans 
          SET last_pm_date = CURRENT_DATE, 
              next_pm_date = CURRENT_DATE + (interval_days || ' days')::interval,
              updated_at = NOW() 
          WHERE id = $1
        `, [plan.id]);
      }
    }

    res.json({
      success: true,
      message: `Engine processed. Generated ${generatedWOs.length} scheduled PM work orders.`,
      data: generatedWOs,
    });
  } catch (err) {
    next(err);
  }
};
