import { Request, Response, NextFunction } from 'express';
import { query as defaultQuery, pool as defaultPool } from '../../config/db';
import {
  createWorkOrderFromComplaintService,
  WorkOrderServiceError,
  setWorkOrdersServiceDb,
  resetWorkOrdersServiceDb,
  setWorkOrdersServiceIo,
  resetWorkOrdersServiceIo,
} from '../work-orders/work-orders.service';

export const isUUID = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export const ALLOWED_CATEGORIES = [
  'electrical',
  'mechanical',
  'hydraulic',
  'lubrication',
  'safety',
  'other',
] as const;
export type IssueCategory = (typeof ALLOWED_CATEGORIES)[number];

export const ALLOWED_PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;
export type ComplaintPriority = (typeof ALLOWED_PRIORITIES)[number];

export const ALLOWED_STATUSES = [
  'new',
  'pending_review',
  'approved',
  'rejected',
  'work_order_created',
  'closed',
] as const;
export type ComplaintStatus = (typeof ALLOWED_STATUSES)[number];

export const ALLOWED_SORT_FIELDS = [
  'created_at',
  'reported_at',
  'breakdown_occurred_at',
  'priority',
  'status',
] as const;

export type DbQueryFunction = (
  text: string,
  params?: any[]
) => Promise<{ rows: any[]; rowCount?: number | null }>;

export interface DbClientLike {
  query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
  release: () => void;
}

export interface DbPoolLike {
  connect: () => Promise<DbClientLike>;
}

let activeQuery: DbQueryFunction = defaultQuery;
let activePool: DbPoolLike = defaultPool as unknown as DbPoolLike;
let customIo: any = undefined;

export const setBreakdownsDb = (
  customQuery?: DbQueryFunction,
  customPool?: DbPoolLike
): void => {
  activeQuery = customQuery || defaultQuery;
  activePool = customPool || (defaultPool as unknown as DbPoolLike);
  setWorkOrdersServiceDb(activeQuery, activePool);
};

export const resetBreakdownsDb = (): void => {
  activeQuery = defaultQuery;
  activePool = defaultPool as unknown as DbPoolLike;
  resetWorkOrdersServiceDb();
};

export const setBreakdownsIo = (custom: any): void => {
  customIo = custom;
  setWorkOrdersServiceIo(custom);
};

export const resetBreakdownsIo = (): void => {
  customIo = undefined;
  resetWorkOrdersServiceIo();
};

const getActiveIo = (): any => {
  if (customIo !== undefined) {
    return customIo;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const serverModule = require('../../server');
    return serverModule ? serverModule.io : null;
  } catch {
    return null;
  }
};

// REPORT BREAKDOWN (POST /)
export const reportBreakdown = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  let client: DbClientLike | null = null;
  try {
    const operatorId = req.user?.id;
    if (!operatorId || !isUUID(operatorId)) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
      return;
    }

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
    } = req.body || {};

    // 1. Mandatory fields validation
    if (!machine_id || !issue_category || !problem_title || !description) {
      res.status(400).json({
        success: false,
        message: 'Missing required complaint parameters (machine_id, issue_category, problem_title, description).',
      });
      return;
    }

    // 2. Validate Machine UUID format
    if (!isUUID(machine_id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid machine ID.',
      });
      return;
    }

    // 3. Title & Description format validation
    if (typeof problem_title !== 'string' || problem_title.trim().length === 0 || problem_title.trim().length > 255) {
      res.status(400).json({
        success: false,
        message: 'Problem title must contain between 1 and 255 characters.',
      });
      return;
    }

    if (typeof description !== 'string' || description.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Description must be a non-empty string.',
      });
      return;
    }

    // 4. Validate Issue Category against supported list
    const cleanCategory = String(issue_category).trim().toLowerCase();
    if (!ALLOWED_CATEGORIES.includes(cleanCategory as IssueCategory)) {
      res.status(400).json({
        success: false,
        message: `Invalid issue category. Allowed categories: ${ALLOWED_CATEGORIES.join(', ')}.`,
      });
      return;
    }

    // 5. Validate Priority
    const cleanPriority = String(priority || 'medium').trim().toLowerCase();
    if (!ALLOWED_PRIORITIES.includes(cleanPriority as ComplaintPriority)) {
      res.status(400).json({
        success: false,
        message: `Invalid priority. Allowed priorities: ${ALLOWED_PRIORITIES.join(', ')}.`,
      });
      return;
    }

    // 6. Validate Occurrence Timestamp
    let occurrenceTime: Date;
    if (breakdown_occurred_at !== undefined && breakdown_occurred_at !== null) {
      const parsedDate = new Date(breakdown_occurred_at);
      if (isNaN(parsedDate.getTime())) {
        res.status(400).json({
          success: false,
          message: 'Invalid breakdown_occurred_at timestamp format.',
        });
        return;
      }
      // Clock skew tolerance: max 5 minutes in future
      if (parsedDate.getTime() > Date.now() + 5 * 60 * 1000) {
        res.status(400).json({
          success: false,
          message: 'Breakdown occurrence timestamp cannot be in the future.',
        });
        return;
      }
      occurrenceTime = parsedDate;
    } else {
      occurrenceTime = new Date();
    }

    // 7. Validate Numeric Readings (hour_meter, temperature, pressure)
    if (hour_meter_reading !== undefined && hour_meter_reading !== null) {
      const hmr = Number(hour_meter_reading);
      if (isNaN(hmr) || hmr < 0 || hmr > 99999999.99) {
        res.status(400).json({
          success: false,
          message: 'hour_meter_reading must be a valid non-negative number.',
        });
        return;
      }
    }

    if (temperature !== undefined && temperature !== null) {
      const temp = Number(temperature);
      if (isNaN(temp) || temp < -100 || temp > 2000) {
        res.status(400).json({
          success: false,
          message: 'temperature must be a valid numeric reading between -100 and 2000.',
        });
        return;
      }
    }

    if (pressure !== undefined && pressure !== null) {
      const press = Number(pressure);
      if (isNaN(press) || press < 0 || press > 10000) {
        res.status(400).json({
          success: false,
          message: 'pressure must be a valid non-negative numeric reading.',
        });
        return;
      }
    }

    // 8. Evidence validation
    let imagesArray: any[] = [];
    if (Array.isArray(images_json)) {
      imagesArray = images_json;
    } else if (typeof images_json === 'string') {
      try {
        const parsed = JSON.parse(images_json);
        imagesArray = Array.isArray(parsed) ? parsed : [];
      } catch {
        imagesArray = [];
      }
    }

    // Begin atomic transaction
    client = await activePool.connect();
    await client.query('BEGIN');

    // 9. Fetch Machine and verify existence and organizational scope
    const machineRes = await client.query(
      `SELECT m.id, m.machine_code, m.name, m.status, m.shop_id, s.plant_id, s.shop_name, p.plant_name
       FROM machines m
       JOIN shops s ON m.shop_id = s.id
       JOIN plants p ON s.plant_id = p.id
       WHERE m.id = $1
       FOR UPDATE`,
      [machine_id]
    );

    if (machineRes.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({
        success: false,
        message: 'Machine not found.',
      });
      return;
    }

    const machine = machineRes.rows[0];

    // Verify user authorization for machine plant/shop
    if (req.user?.role !== 'admin') {
      if (req.user?.plant_id && req.user.plant_id !== machine.plant_id) {
        await client.query('ROLLBACK');
        res.status(403).json({
          success: false,
          message: 'You are not authorized to report breakdowns for machines outside your assigned plant.',
        });
        return;
      }

      if (req.user?.shop_id && req.user.shop_id !== machine.shop_id) {
        await client.query('ROLLBACK');
        res.status(403).json({
          success: false,
          message: 'You are not authorized to report breakdowns for machines outside your assigned shop.',
        });
        return;
      }
    }

    // 10. Duplicate breakdown detection:
    // Only flag as duplicate if the SAME machine has an ACTIVE complaint for the SAME issue category!
    const duplicateCheck = await client.query(
      `SELECT id, complaint_number, priority, status, issue_category, problem_title, created_at
       FROM maintenance_requests
       WHERE machine_id = $1
         AND LOWER(issue_category) = LOWER($2)
         AND status NOT IN ('closed', 'rejected')
       FOR UPDATE`,
      [machine_id, cleanCategory]
    );

    if (duplicateCheck.rows.length > 0) {
      const openComplaint = duplicateCheck.rows[0];
      await client.query('ROLLBACK');
      res.status(409).json({
        success: false,
        isDuplicate: true,
        message: `Duplicate Warning: Active complaint ${openComplaint.complaint_number} is already active for this machine and ${cleanCategory} issue.`,
        existingComplaint: openComplaint,
      });
      return;
    }

    // 11. Generate unique Complaint Number safely under concurrency: CMP-YYYY-XXXXX
    const currentYear = occurrenceTime.getFullYear();
    const complaintLockKey = `complaint_seq:${currentYear}`;
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
      [complaintLockKey]
    );

    const countRes = await client.query(
      `SELECT COALESCE(MAX(SUBSTRING(complaint_number FROM '[0-9]+$')::int), 0) + 1 AS next_seq
       FROM maintenance_requests
       WHERE complaint_number LIKE $1`,
      [`CMP-${currentYear}-%`]
    );
    const nextSeq = countRes.rows[0]?.next_seq || 1;
    const complaint_number = `CMP-${currentYear}-${String(nextSeq).padStart(5, '0')}`;

    // 12. Insert Breakdown Request
    const insertRes = await client.query(
      `INSERT INTO maintenance_requests (
        complaint_number, machine_id, reported_by_id, shift, issue_category,
        priority, status, breakdown_occurred_at, reported_at, hour_meter_reading,
        temperature, pressure, problem_title, description, images_json
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'new', $7, NOW(), $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        complaint_number,
        machine.id,
        operatorId,
        typeof shift === 'string' && shift.trim().length > 0 ? shift.trim() : 'Shift A',
        cleanCategory,
        cleanPriority,
        occurrenceTime,
        hour_meter_reading !== undefined && hour_meter_reading !== null ? Number(hour_meter_reading) : null,
        temperature !== undefined && temperature !== null ? Number(temperature) : null,
        pressure !== undefined && pressure !== null ? Number(pressure) : null,
        problem_title.trim(),
        description.trim(),
        JSON.stringify(imagesArray),
      ]
    );

    const complaint = insertRes.rows[0];

    // 13. Update physical machine status atomically to 'breakdown'
    await client.query(
      `UPDATE machines SET status = 'breakdown', updated_at = NOW() WHERE id = $1`,
      [machine.id]
    );

    // 14. Immutable Audit Trail
    await client.query(
      `INSERT INTO audit_logs (entity_name, entity_id, action, performed_by, old_values, new_values, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        'maintenance_requests',
        complaint.id,
        'BREAKDOWN_CREATED',
        operatorId,
        null,
        JSON.stringify({
          complaint_number,
          machine_id: machine.id,
          machine_code: machine.machine_code,
          issue_category: cleanCategory,
          priority: cleanPriority,
        }),
      ]
    );

    // 15. In-app notifications for plant and shop managers
    const managersRes = await client.query(
      `SELECT id FROM users
       WHERE role IN ('admin', 'manager')
         AND (plant_id IS NULL OR plant_id = $1)
         AND (shop_id IS NULL OR shop_id = $2)
         AND is_active = TRUE`,
      [machine.plant_id, machine.shop_id]
    );

    for (const mgr of managersRes.rows) {
      await client.query(
        `INSERT INTO notifications (recipient_id, title, message, type, link_url, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          mgr.id,
          cleanPriority === 'critical' ? 'CRITICAL Breakdown Reported' : 'New Breakdown Reported',
          `Complaint ${complaint_number} reported on machine ${machine.machine_code} (${machine.name}) for ${cleanCategory} issue.`,
          cleanPriority === 'critical' ? 'critical' : 'warning',
          `/breakdowns/${complaint.id}`,
        ]
      );
    }

    await client.query('COMMIT');

    // 16. Real-time targeted Socket.IO room broadcast
    const activeIo = getActiveIo();
    if (activeIo) {
      const socketPayload = {
        complaint,
        machine: {
          id: machine.id,
          machine_code: machine.machine_code,
          name: machine.name,
          shop_name: machine.shop_name,
          plant_name: machine.plant_name,
        },
        message: `New Complaint ${complaint_number} raised on machine ${machine.machine_code}.`,
      };

      if (machine.plant_id && typeof activeIo.to === 'function') {
        activeIo.to(`plant:${machine.plant_id}`).emit('complaint:created', socketPayload);
      }
      if (machine.shop_id && typeof activeIo.to === 'function') {
        activeIo.to(`shop:${machine.shop_id}`).emit('complaint:created', socketPayload);
      }
      if (cleanPriority === 'critical' && machine.plant_id && typeof activeIo.to === 'function') {
        activeIo.to(`plant:${machine.plant_id}`).emit('complaint:critical', socketPayload);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully. Manager notified.',
      data: complaint,
    });
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Safe rollback error suppression
      }
    }
    next(err);
  } finally {
    if (client) {
      client.release();
    }
  }
};

// LIST BREAKDOWNS (GET /)
export const getBreakdowns = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      status,
      priority,
      issue_category,
      machine_id,
      shop_id,
      plant_id,
      start_date,
      end_date,
      search,
      q,
      sort_by = 'created_at',
      sort_order = 'desc',
      page = '1',
      limit = '50',
    } = req.query as Record<string, string | undefined>;

    // 1. Pagination Validation
    const pageNum = Number(page);
    if (!Number.isInteger(pageNum) || pageNum < 1) {
      res.status(400).json({
        success: false,
        message: 'Invalid pagination parameters: page must be a positive integer.',
      });
      return;
    }

    const limitNum = Number(limit);
    if (!Number.isInteger(limitNum) || limitNum < 1 || limitNum > 100) {
      res.status(400).json({
        success: false,
        message: 'Invalid pagination parameters: limit must be an integer between 1 and 100.',
      });
      return;
    }

    // 2. Validate Filters
    if (status) {
      const cleanStatus = status.trim().toLowerCase();
      if (!ALLOWED_STATUSES.includes(cleanStatus as ComplaintStatus)) {
        res.status(400).json({
          success: false,
          message: `Invalid status filter. Allowed values: ${ALLOWED_STATUSES.join(', ')}.`,
        });
        return;
      }
    }

    if (priority) {
      const cleanPriority = priority.trim().toLowerCase();
      if (!ALLOWED_PRIORITIES.includes(cleanPriority as ComplaintPriority)) {
        res.status(400).json({
          success: false,
          message: `Invalid priority filter. Allowed values: ${ALLOWED_PRIORITIES.join(', ')}.`,
        });
        return;
      }
    }

    if (machine_id && !isUUID(machine_id)) {
      res.status(400).json({ success: false, message: 'Invalid machine ID.' });
      return;
    }

    if (shop_id && !isUUID(shop_id)) {
      res.status(400).json({ success: false, message: 'Invalid shop ID.' });
      return;
    }

    if (plant_id && !isUUID(plant_id)) {
      res.status(400).json({ success: false, message: 'Invalid plant ID.' });
      return;
    }

    // 3. Sorting Column Whitelist
    const cleanSortBy = String(sort_by).trim().toLowerCase();
    if (!ALLOWED_SORT_FIELDS.includes(cleanSortBy as any)) {
      res.status(400).json({
        success: false,
        message: `Invalid sort field. Allowed fields: ${ALLOWED_SORT_FIELDS.join(', ')}.`,
      });
      return;
    }

    const cleanSortOrder = String(sort_order).trim().toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // 4. Query Construction with Role-based Scope Authorization
    const whereClauses: string[] = [];
    const params: any[] = [];

    // Role-based visibility isolation
    if (req.user?.role !== 'admin') {
      if (req.user?.role === 'operator') {
        // Operators view complaints reported by themselves OR within their assigned shop
        if (req.user.shop_id) {
          params.push(req.user.id);
          const p1 = params.length;
          params.push(req.user.shop_id);
          const p2 = params.length;
          whereClauses.push(`(r.reported_by_id = $${p1} OR m.shop_id = $${p2})`);
        } else {
          params.push(req.user.id);
          whereClauses.push(`r.reported_by_id = $${params.length}`);
        }
      } else {
        // Managers & Technicians: scoped to their plant and shop
        if (req.user?.plant_id) {
          params.push(req.user.plant_id);
          whereClauses.push(`s.plant_id = $${params.length}`);
        }
        if (req.user?.shop_id) {
          params.push(req.user.shop_id);
          whereClauses.push(`m.shop_id = $${params.length}`);
        }
      }
    }

    // Explicit Filter Parameters
    if (status) {
      params.push(status.trim().toLowerCase());
      whereClauses.push(`r.status = $${params.length}`);
    }

    if (priority) {
      params.push(priority.trim().toLowerCase());
      whereClauses.push(`r.priority = $${params.length}`);
    }

    if (issue_category) {
      params.push(issue_category.trim().toLowerCase());
      whereClauses.push(`LOWER(r.issue_category) = $${params.length}`);
    }

    if (machine_id) {
      params.push(machine_id);
      whereClauses.push(`r.machine_id = $${params.length}`);
    }

    if (shop_id) {
      params.push(shop_id);
      whereClauses.push(`m.shop_id = $${params.length}`);
    }

    if (plant_id) {
      params.push(plant_id);
      whereClauses.push(`s.plant_id = $${params.length}`);
    }

    if (start_date) {
      const parsedStart = new Date(start_date);
      if (!isNaN(parsedStart.getTime())) {
        params.push(parsedStart);
        whereClauses.push(`r.breakdown_occurred_at >= $${params.length}`);
      }
    }

    if (end_date) {
      const parsedEnd = new Date(end_date);
      if (!isNaN(parsedEnd.getTime())) {
        params.push(parsedEnd);
        whereClauses.push(`r.breakdown_occurred_at <= $${params.length}`);
      }
    }

    const searchQuery = search || q;
    if (searchQuery && searchQuery.trim().length > 0) {
      params.push(`%${searchQuery.trim()}%`);
      const pIdx = params.length;
      whereClauses.push(
        `(r.complaint_number ILIKE $${pIdx} OR m.machine_code ILIKE $${pIdx} OR m.name ILIKE $${pIdx} OR r.problem_title ILIKE $${pIdx})`
      );
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Total Count Query
    const countSql = `
      SELECT COUNT(r.id)::int AS total
      FROM maintenance_requests r
      JOIN machines m ON r.machine_id = m.id
      JOIN shops s ON m.shop_id = s.id
      ${whereSql}
    `;
    const countResult = await activeQuery(countSql, params);
    const total = countResult.rows[0]?.total ?? 0;

    // Data Query with Pagination
    const offset = (pageNum - 1) * limitNum;
    const queryParams = [...params, limitNum, offset];
    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;

    const dataSql = `
      SELECT r.id, r.complaint_number, r.machine_id, r.reported_by_id, r.shift,
             r.issue_category, r.priority, r.status, r.breakdown_occurred_at,
             r.reported_at, r.hour_meter_reading, r.temperature, r.pressure,
             r.problem_title, r.description, r.images_json, r.manager_remarks,
             r.created_at, r.updated_at,
             m.machine_code, m.name AS machine_name, m.criticality, m.status AS machine_status,
             s.id AS shop_id, s.shop_name, s.plant_id,
             p.plant_name,
             u.full_name AS reported_by_name, u.employee_code AS reported_by_code
      FROM maintenance_requests r
      JOIN machines m ON r.machine_id = m.id
      JOIN shops s ON m.shop_id = s.id
      JOIN plants p ON s.plant_id = p.id
      JOIN users u ON r.reported_by_id = u.id
      ${whereSql}
      ORDER BY r.${cleanSortBy} ${cleanSortOrder}
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const result = await activeQuery(dataSql, queryParams);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

// BREAKDOWN DETAILS (GET /:id)
export const getBreakdownDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!isUUID(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid breakdown ID.',
      });
      return;
    }

    const result = await activeQuery(
      `SELECT r.*,
              m.machine_code, m.name AS machine_name, m.category AS machine_category,
              m.criticality AS machine_criticality, m.status AS machine_status,
              m.bay_line_location, m.operating_hours,
              s.id AS shop_id, s.shop_name, s.plant_id,
              p.plant_name,
              u.full_name AS reported_by_name, u.employee_code AS reported_by_code,
              u.email AS reported_by_email, u.phone AS reported_by_phone,
              wo.id AS work_order_id, wo.wo_number, wo.status AS work_order_status,
              wo.assigned_technician_id,
              tech.full_name AS assigned_technician_name, tech.employee_code AS assigned_technician_code
       FROM maintenance_requests r
       JOIN machines m ON r.machine_id = m.id
       JOIN shops s ON m.shop_id = s.id
       JOIN plants p ON s.plant_id = p.id
       JOIN users u ON r.reported_by_id = u.id
       LEFT JOIN work_orders wo ON wo.complaint_id = r.id
       LEFT JOIN users tech ON wo.assigned_technician_id = tech.id
       WHERE r.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Breakdown request not found.',
      });
      return;
    }

    const breakdown = result.rows[0];

    // Authorization check
    if (req.user?.role !== 'admin') {
      if (req.user?.plant_id && req.user.plant_id !== breakdown.plant_id) {
        res.status(403).json({
          success: false,
          message: 'Access restricted to authorized plant scope.',
        });
        return;
      }
      if (req.user?.shop_id && req.user.shop_id !== breakdown.shop_id) {
        res.status(403).json({
          success: false,
          message: 'Access restricted to authorized shop scope.',
        });
        return;
      }
    }

    // Fetch activity history
    const historyRes = await activeQuery(
      `SELECT a.id, a.action, a.performed_by, u.full_name AS performed_by_name,
              u.role AS performed_by_role, a.old_values, a.new_values, a.created_at
       FROM audit_logs a
       LEFT JOIN users u ON a.performed_by = u.id
       WHERE a.entity_name = 'maintenance_requests' AND a.entity_id = $1
       ORDER BY a.created_at ASC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...breakdown,
        history: historyRes.rows,
      },
    });
  } catch (err) {
    next(err);
  }
};

// BREAKDOWN HISTORY (GET /:id/history)
export const getBreakdownHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!isUUID(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid breakdown ID.',
      });
      return;
    }

    const checkRes = await activeQuery(
      `SELECT r.id, s.plant_id, m.shop_id
       FROM maintenance_requests r
       JOIN machines m ON r.machine_id = m.id
       JOIN shops s ON m.shop_id = s.id
       WHERE r.id = $1`,
      [id]
    );

    if (checkRes.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Breakdown request not found.',
      });
      return;
    }

    const breakdown = checkRes.rows[0];

    if (req.user?.role !== 'admin') {
      if (req.user?.plant_id && req.user.plant_id !== breakdown.plant_id) {
        res.status(403).json({
          success: false,
          message: 'Access restricted to authorized plant scope.',
        });
        return;
      }
      if (req.user?.shop_id && req.user.shop_id !== breakdown.shop_id) {
        res.status(403).json({
          success: false,
          message: 'Access restricted to authorized shop scope.',
        });
        return;
      }
    }

    const historyRes = await activeQuery(
      `SELECT a.id, a.action, a.performed_by, u.full_name AS performed_by_name,
              u.role AS performed_by_role, a.old_values, a.new_values, a.created_at
       FROM audit_logs a
       LEFT JOIN users u ON a.performed_by = u.id
       WHERE a.entity_name = 'maintenance_requests' AND a.entity_id = $1
       ORDER BY a.created_at ASC`,
      [id]
    );

    res.json({
      success: true,
      data: historyRes.rows,
    });
  } catch (err) {
    next(err);
  }
};

// MANAGER ACKNOWLEDGEMENT (PATCH /:id/acknowledge)
export const acknowledgeBreakdown = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const managerId = req.user?.id;
    const { remarks } = req.body || {};

    if (!isUUID(id)) {
      res.status(400).json({ success: false, message: 'Invalid breakdown ID.' });
      return;
    }

    const currentRes = await activeQuery(
      `SELECT r.*, m.machine_code, s.plant_id, m.shop_id
       FROM maintenance_requests r
       JOIN machines m ON r.machine_id = m.id
       JOIN shops s ON m.shop_id = s.id
       WHERE r.id = $1`,
      [id]
    );

    if (currentRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Breakdown request not found.' });
      return;
    }

    const breakdown = currentRes.rows[0];

    // Org scope verification
    if (req.user?.role !== 'admin') {
      if (req.user?.plant_id && req.user.plant_id !== breakdown.plant_id) {
        res.status(403).json({ success: false, message: 'Unauthorized for this plant.' });
        return;
      }
      if (req.user?.shop_id && req.user.shop_id !== breakdown.shop_id) {
        res.status(403).json({ success: false, message: 'Unauthorized for this shop.' });
        return;
      }
    }

    // Status transition validation
    if (breakdown.status !== 'new') {
      res.status(400).json({
        success: false,
        message: `Breakdown cannot be acknowledged in current status: ${breakdown.status}.`,
      });
      return;
    }

    const cleanRemarks = typeof remarks === 'string' && remarks.trim().length > 0 ? remarks.trim() : null;

    const updateRes = await activeQuery(
      `UPDATE maintenance_requests
       SET status = 'pending_review',
           manager_remarks = COALESCE($1, manager_remarks),
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [cleanRemarks, id]
    );

    const updated = updateRes.rows[0];

    // Audit log
    await activeQuery(
      `INSERT INTO audit_logs (entity_name, entity_id, action, performed_by, old_values, new_values, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        'maintenance_requests',
        id,
        'BREAKDOWN_ACKNOWLEDGED',
        managerId,
        JSON.stringify({ status: breakdown.status }),
        JSON.stringify({ status: 'pending_review', remarks: cleanRemarks }),
      ]
    );

    // Notify reporting operator
    await activeQuery(
      `INSERT INTO notifications (recipient_id, title, message, type, link_url, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        breakdown.reported_by_id,
        'Breakdown Acknowledged',
        `Your breakdown complaint ${breakdown.complaint_number} has been acknowledged by management.`,
        'info',
        `/breakdowns/${breakdown.id}`,
      ]
    );

    // Real-time socket event
    const activeIo = getActiveIo();
    if (activeIo && typeof activeIo.to === 'function') {
      activeIo.to(`user:${breakdown.reported_by_id}`).emit('complaint:acknowledged', {
        complaint: updated,
        message: `Complaint ${breakdown.complaint_number} has been acknowledged.`,
      });
    }

    res.json({
      success: true,
      message: 'Breakdown complaint acknowledged successfully.',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

// PRIORITY REVIEW (PATCH /:id/priority)
export const updateBreakdownPriority = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const managerId = req.user?.id;
    const { priority } = req.body || {};

    if (!isUUID(id)) {
      res.status(400).json({ success: false, message: 'Invalid breakdown ID.' });
      return;
    }

    if (!priority || typeof priority !== 'string') {
      res.status(400).json({
        success: false,
        message: `Priority is required. Allowed values: ${ALLOWED_PRIORITIES.join(', ')}.`,
      });
      return;
    }

    const cleanPriority = priority.trim().toLowerCase();
    if (!ALLOWED_PRIORITIES.includes(cleanPriority as ComplaintPriority)) {
      res.status(400).json({
        success: false,
        message: `Invalid priority. Allowed priorities: ${ALLOWED_PRIORITIES.join(', ')}.`,
      });
      return;
    }

    const currentRes = await activeQuery(
      `SELECT r.*, m.machine_code, m.name as machine_name, s.plant_id, m.shop_id
       FROM maintenance_requests r
       JOIN machines m ON r.machine_id = m.id
       JOIN shops s ON m.shop_id = s.id
       WHERE r.id = $1`,
      [id]
    );

    if (currentRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Breakdown request not found.' });
      return;
    }

    const breakdown = currentRes.rows[0];

    // Org scope check
    if (req.user?.role !== 'admin') {
      if (req.user?.plant_id && req.user.plant_id !== breakdown.plant_id) {
        res.status(403).json({ success: false, message: 'Unauthorized for this plant.' });
        return;
      }
      if (req.user?.shop_id && req.user.shop_id !== breakdown.shop_id) {
        res.status(403).json({ success: false, message: 'Unauthorized for this shop.' });
        return;
      }
    }

    if (['closed', 'rejected'].includes(breakdown.status)) {
      res.status(400).json({
        success: false,
        message: `Cannot change priority of a ${breakdown.status} breakdown.`,
      });
      return;
    }

    const updateRes = await activeQuery(
      `UPDATE maintenance_requests
       SET priority = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [cleanPriority, id]
    );

    const updated = updateRes.rows[0];

    // Audit log
    await activeQuery(
      `INSERT INTO audit_logs (entity_name, entity_id, action, performed_by, old_values, new_values, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        'maintenance_requests',
        id,
        'BREAKDOWN_PRIORITY_UPDATED',
        managerId,
        JSON.stringify({ priority: breakdown.priority }),
        JSON.stringify({ priority: cleanPriority }),
      ]
    );

    // If escalated to critical, trigger escalation notifications
    if (cleanPriority === 'critical' && breakdown.priority !== 'critical') {
      const plantManagers = await activeQuery(
        `SELECT id FROM users
         WHERE role IN ('admin', 'manager')
           AND (plant_id IS NULL OR plant_id = $1)
           AND is_active = TRUE`,
        [breakdown.plant_id]
      );

      for (const mgr of plantManagers.rows) {
        await activeQuery(
          `INSERT INTO notifications (recipient_id, title, message, type, link_url, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [
            mgr.id,
            'CRITICAL Breakdown Escalation',
            `Breakdown ${breakdown.complaint_number} on ${breakdown.machine_code} has been escalated to CRITICAL priority.`,
            'critical',
            `/breakdowns/${id}`,
          ]
        );
      }

      const activeIo = getActiveIo();
      if (activeIo && typeof activeIo.to === 'function') {
        activeIo.to(`plant:${breakdown.plant_id}`).emit('complaint:critical', {
          complaint: updated,
          message: `Breakdown ${breakdown.complaint_number} escalated to CRITICAL priority.`,
        });
      }
    }

    res.json({
      success: true,
      message: 'Breakdown priority updated successfully.',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

// REQUEST ADDITIONAL INFORMATION (POST /:id/request-information)
export const requestAdditionalInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const managerId = req.user?.id;
    const { remarks, reason } = req.body || {};

    if (!isUUID(id)) {
      res.status(400).json({ success: false, message: 'Invalid breakdown ID.' });
      return;
    }

    const queryRemarks = remarks || reason;
    if (!queryRemarks || typeof queryRemarks !== 'string' || queryRemarks.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Remarks are mandatory when requesting additional information.',
      });
      return;
    }

    const currentRes = await activeQuery(
      `SELECT r.*, m.machine_code, s.plant_id, m.shop_id
       FROM maintenance_requests r
       JOIN machines m ON r.machine_id = m.id
       JOIN shops s ON m.shop_id = s.id
       WHERE r.id = $1`,
      [id]
    );

    if (currentRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Breakdown request not found.' });
      return;
    }

    const breakdown = currentRes.rows[0];

    // Org scope check
    if (req.user?.role !== 'admin') {
      if (req.user?.plant_id && req.user.plant_id !== breakdown.plant_id) {
        res.status(403).json({ success: false, message: 'Unauthorized for this plant.' });
        return;
      }
      if (req.user?.shop_id && req.user.shop_id !== breakdown.shop_id) {
        res.status(403).json({ success: false, message: 'Unauthorized for this shop.' });
        return;
      }
    }

    if (['closed', 'rejected', 'work_order_created'].includes(breakdown.status)) {
      res.status(400).json({
        success: false,
        message: `Cannot request information on ${breakdown.status} breakdown.`,
      });
      return;
    }

    const cleanRemarks = queryRemarks.trim();

    const updateRes = await activeQuery(
      `UPDATE maintenance_requests
       SET manager_remarks = $1,
           status = CASE WHEN status = 'new' THEN 'pending_review'::complaint_status ELSE status END,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [cleanRemarks, id]
    );

    const updated = updateRes.rows[0];

    // Audit log
    await activeQuery(
      `INSERT INTO audit_logs (entity_name, entity_id, action, performed_by, old_values, new_values, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        'maintenance_requests',
        id,
        'BREAKDOWN_INFO_REQUESTED',
        managerId,
        null,
        JSON.stringify({ remarks: cleanRemarks }),
      ]
    );

    // Notify reporting operator
    await activeQuery(
      `INSERT INTO notifications (recipient_id, title, message, type, link_url, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        breakdown.reported_by_id,
        'Additional Information Requested',
        `Manager requested information regarding complaint ${breakdown.complaint_number}: ${cleanRemarks}`,
        'warning',
        `/breakdowns/${id}`,
      ]
    );

    const activeIo = getActiveIo();
    if (activeIo && typeof activeIo.to === 'function') {
      activeIo.to(`user:${breakdown.reported_by_id}`).emit('complaint:info_requested', {
        complaint: updated,
        message: `Additional information requested for complaint ${breakdown.complaint_number}.`,
      });
    }

    res.json({
      success: true,
      message: 'Additional information requested from operator.',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

// REJECT BREAKDOWN (PATCH /:id/reject)
export const rejectBreakdown = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  let client: DbClientLike | null = null;
  try {
    const { id } = req.params;
    const managerId = req.user?.id;
    const { rejection_reason, reason, remarks } = req.body || {};

    if (!isUUID(id)) {
      res.status(400).json({ success: false, message: 'Invalid breakdown ID.' });
      return;
    }

    const rawReason = rejection_reason || reason || remarks;
    if (!rawReason || typeof rawReason !== 'string' || rawReason.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Rejection reason is mandatory.',
      });
      return;
    }

    const cleanReason = rawReason.trim();

    client = await activePool.connect();
    await client.query('BEGIN');

    const currentRes = await client.query(
      `SELECT r.*, m.machine_code, s.plant_id, m.shop_id
       FROM maintenance_requests r
       JOIN machines m ON r.machine_id = m.id
       JOIN shops s ON m.shop_id = s.id
       WHERE r.id = $1
       FOR UPDATE`,
      [id]
    );

    if (currentRes.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ success: false, message: 'Breakdown request not found.' });
      return;
    }

    const breakdown = currentRes.rows[0];

    // Org scope check
    if (req.user?.role !== 'admin') {
      if (req.user?.plant_id && req.user.plant_id !== breakdown.plant_id) {
        await client.query('ROLLBACK');
        res.status(403).json({ success: false, message: 'Unauthorized for this plant.' });
        return;
      }
      if (req.user?.shop_id && req.user.shop_id !== breakdown.shop_id) {
        await client.query('ROLLBACK');
        res.status(403).json({ success: false, message: 'Unauthorized for this shop.' });
        return;
      }
    }

    if (breakdown.status === 'rejected') {
      await client.query('ROLLBACK');
      res.status(400).json({ success: false, message: 'Breakdown is already rejected.' });
      return;
    }

    if (['work_order_created', 'closed'].includes(breakdown.status)) {
      await client.query('ROLLBACK');
      res.status(400).json({
        success: false,
        message: `Cannot reject breakdown after work order has been created or closed.`,
      });
      return;
    }

    // Update breakdown status to rejected
    const updateRes = await client.query(
      `UPDATE maintenance_requests
       SET status = 'rejected',
           manager_remarks = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [cleanReason, id]
    );
    const updated = updateRes.rows[0];

    // Safe Machine Status Restoration:
    // Only restore machine to 'running' if NO OTHER active complaints and NO OTHER active work orders exist on that machine!
    const otherComplaintsRes = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM maintenance_requests
       WHERE machine_id = $1 AND id != $2 AND status NOT IN ('closed', 'rejected')`,
      [breakdown.machine_id, id]
    );
    const otherActiveComplaints = otherComplaintsRes.rows[0]?.count || 0;

    const otherWorkOrdersRes = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM work_orders
       WHERE machine_id = $1 AND status NOT IN ('completed', 'verified_closed')`,
      [breakdown.machine_id]
    );
    const activeWorkOrders = otherWorkOrdersRes.rows[0]?.count || 0;

    if (otherActiveComplaints === 0 && activeWorkOrders === 0) {
      await client.query(
        `UPDATE machines SET status = 'running', updated_at = NOW() WHERE id = $1`,
        [breakdown.machine_id]
      );
    }

    // Audit log
    await client.query(
      `INSERT INTO audit_logs (entity_name, entity_id, action, performed_by, old_values, new_values, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        'maintenance_requests',
        id,
        'BREAKDOWN_REJECTED',
        managerId,
        null,
        JSON.stringify({ rejection_reason: cleanReason }),
      ]
    );

    // Notify reporting operator
    await client.query(
      `INSERT INTO notifications (recipient_id, title, message, type, link_url, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        breakdown.reported_by_id,
        'Breakdown Complaint Rejected',
        `Your breakdown complaint ${breakdown.complaint_number} was rejected by management: ${cleanReason}`,
        'alert',
        `/breakdowns/${id}`,
      ]
    );

    await client.query('COMMIT');

    const activeIo = getActiveIo();
    if (activeIo && typeof activeIo.to === 'function') {
      activeIo.to(`user:${breakdown.reported_by_id}`).emit('complaint:rejected', {
        complaint: updated,
        message: `Complaint ${breakdown.complaint_number} was rejected.`,
      });
    }

    res.json({
      success: true,
      message: 'Breakdown complaint rejected successfully.',
      data: updated,
    });
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Safe rollback suppression
      }
    }
    next(err);
  } finally {
    if (client) {
      client.release();
    }
  }
};

// CONVERT BREAKDOWN TO WORK ORDER (POST /:id/convert-to-work-order)
export const convertBreakdownToWorkOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const complaintId = req.params.id || req.body.complaint_id || req.body.ticket_id;
    const managerId = req.user?.id;
    const { technician_id, sla_hours = 4, work_instructions, is_major_breakdown = false } = req.body || {};

    if (!complaintId || !isUUID(complaintId)) {
      res.status(400).json({ success: false, message: 'Invalid breakdown ID.' });
      return;
    }

    if (!technician_id || !isUUID(technician_id)) {
      res.status(400).json({ success: false, message: 'Valid technician ID is required.' });
      return;
    }

    const result = await createWorkOrderFromComplaintService(
      {
        complaint_id: complaintId,
        technician_id,
        manager_id: managerId,
        user: req.user,
        sla_hours: Number(sla_hours) || 4,
        work_instructions,
        is_major_breakdown: Boolean(is_major_breakdown),
      },
      activePool,
      getActiveIo()
    );

    res.status(201).json({
      success: true,
      message: 'Work order allocated and dispatched to technician.',
      data: {
        workOrder: result.workOrder,
        complaint_id: result.complaint.id,
        complaint_number: result.complaint.complaint_number,
      },
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
