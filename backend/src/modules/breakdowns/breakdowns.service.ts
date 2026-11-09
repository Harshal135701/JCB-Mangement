import { query as defaultQuery, pool as defaultPool } from '../../config/db';

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

export const setBreakdownsServiceDb = (
  customQuery?: DbQueryFunction,
  customPool?: DbPoolLike
): void => {
  activeQuery = customQuery || defaultQuery;
  activePool = customPool || (defaultPool as unknown as DbPoolLike);
};

export const resetBreakdownsServiceDb = (): void => {
  activeQuery = defaultQuery;
  activePool = defaultPool as unknown as DbPoolLike;
};

export const setBreakdownsServiceIo = (custom: any): void => {
  customIo = custom;
};

export const resetBreakdownsServiceIo = (): void => {
  customIo = undefined;
};

export const getBreakdownsActiveIo = (override?: any): any => {
  if (override !== undefined) {
    return override;
  }
  if (customIo !== undefined) {
    return customIo;
  }
  if (process.env.NODE_ENV === 'test') {
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const serverModule = require('../../server');
    return serverModule ? serverModule.io : null;
  } catch {
    return null;
  }
};

export class BreakdownServiceError extends Error {
  public readonly statusCode: number;
  public readonly isDuplicate?: boolean;
  public readonly existingComplaint?: any;

  constructor(message: string, statusCode: number = 400, isDuplicate?: boolean, existingComplaint?: any) {
    super(message);
    this.name = 'BreakdownServiceError';
    this.statusCode = statusCode;
    this.isDuplicate = isDuplicate;
    this.existingComplaint = existingComplaint;
    Object.setPrototypeOf(this, BreakdownServiceError.prototype);
  }
}

export interface CreateBreakdownInput {
  machine_id: string;
  shift?: string;
  issue_category: IssueCategory | string;
  priority?: ComplaintPriority | string;
  hour_meter_reading?: number | string | null;
  temperature?: number | string | null;
  pressure?: number | string | null;
  problem_title: string;
  description: string;
  breakdown_occurred_at?: Date | string | null;
  images_json?: any;
}

/**
 * Reusable Module 2 Service for creating breakdown complaints.
 * Used by POST /api/v1/breakdowns and Module 7 inspection auto-escalation.
 */
export async function createBreakdownComplaintService(
  input: CreateBreakdownInput,
  user: { id: string; role?: string; plant_id?: string; shop_id?: string },
  customPool?: DbPoolLike,
  customIoParam?: any
): Promise<any> {
  const operatorId = user?.id;
  if (!operatorId || !isUUID(operatorId)) {
    throw new BreakdownServiceError('Authentication required.', 401);
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
  } = input || {};

  // 1. Mandatory fields validation
  if (!machine_id || !issue_category || !problem_title || !description) {
    throw new BreakdownServiceError(
      'Missing required complaint parameters (machine_id, issue_category, problem_title, description).',
      400
    );
  }

  // 2. Validate Machine UUID format
  if (!isUUID(machine_id)) {
    throw new BreakdownServiceError('Invalid machine ID.', 400);
  }

  // 3. Title & Description format validation
  if (typeof problem_title !== 'string' || problem_title.trim().length === 0 || problem_title.trim().length > 255) {
    throw new BreakdownServiceError('Problem title must contain between 1 and 255 characters.', 400);
  }

  if (typeof description !== 'string' || description.trim().length === 0) {
    throw new BreakdownServiceError('Description must be a non-empty string.', 400);
  }

  // 4. Validate Issue Category against supported list
  const cleanCategory = String(issue_category).trim().toLowerCase();
  if (!ALLOWED_CATEGORIES.includes(cleanCategory as IssueCategory)) {
    throw new BreakdownServiceError(
      `Invalid issue category. Allowed categories: ${ALLOWED_CATEGORIES.join(', ')}.`,
      400
    );
  }

  // 5. Validate Priority
  const cleanPriority = String(priority || 'medium').trim().toLowerCase();
  if (!ALLOWED_PRIORITIES.includes(cleanPriority as ComplaintPriority)) {
    throw new BreakdownServiceError(
      `Invalid priority. Allowed priorities: ${ALLOWED_PRIORITIES.join(', ')}.`,
      400
    );
  }

  // 6. Validate Occurrence Timestamp
  let occurrenceTime: Date;
  if (breakdown_occurred_at !== undefined && breakdown_occurred_at !== null) {
    const parsedDate = new Date(breakdown_occurred_at);
    if (isNaN(parsedDate.getTime())) {
      throw new BreakdownServiceError('Invalid breakdown_occurred_at timestamp format.', 400);
    }
    // Clock skew tolerance: max 5 minutes in future
    if (parsedDate.getTime() > Date.now() + 5 * 60 * 1000) {
      throw new BreakdownServiceError('Breakdown occurrence timestamp cannot be in the future.', 400);
    }
    occurrenceTime = parsedDate;
  } else {
    occurrenceTime = new Date();
  }

  // 7. Validate Numeric Readings (hour_meter, temperature, pressure)
  if (hour_meter_reading !== undefined && hour_meter_reading !== null) {
    const hmr = Number(hour_meter_reading);
    if (isNaN(hmr) || hmr < 0 || hmr > 99999999.99) {
      throw new BreakdownServiceError('hour_meter_reading must be a valid non-negative number.', 400);
    }
  }

  if (temperature !== undefined && temperature !== null) {
    const temp = Number(temperature);
    if (isNaN(temp) || temp < -100 || temp > 2000) {
      throw new BreakdownServiceError('temperature must be a valid numeric reading between -100 and 2000.', 400);
    }
  }

  if (pressure !== undefined && pressure !== null) {
    const press = Number(pressure);
    if (isNaN(press) || press < 0 || press > 10000) {
      throw new BreakdownServiceError('pressure must be a valid non-negative numeric reading.', 400);
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

  const pool = customPool || activePool;
  let client: DbClientLike | null = null;

  try {
    client = await pool.connect();
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
      throw new BreakdownServiceError('Machine not found.', 404);
    }

    const machine = machineRes.rows[0];

    // Verify user authorization for machine plant/shop
    if (user.role !== 'admin') {
      if (user.plant_id && user.plant_id !== machine.plant_id) {
        throw new BreakdownServiceError(
          'You are not authorized to report breakdowns for machines outside your assigned plant.',
          403
        );
      }

      if (user.shop_id && user.shop_id !== machine.shop_id) {
        throw new BreakdownServiceError(
          'You are not authorized to report breakdowns for machines outside your assigned shop.',
          403
        );
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
      throw new BreakdownServiceError(
        `Duplicate Warning: Active complaint ${openComplaint.complaint_number} is already active for this machine and ${cleanCategory} issue.`,
        409,
        true,
        openComplaint
      );
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

    const reportedByName = (user as any).full_name || (user as any).employee_code || 'Operator';
    const notifTitle = cleanPriority === 'critical' ? 'CRITICAL Breakdown Reported' : 'New Breakdown Reported';
    const notifMessage = `New breakdown request received. Machine: ${machine.machine_code}. Reported by: ${reportedByName}. Priority: ${cleanPriority}. Request ID: ${complaint_number}.`;

    for (const mgr of managersRes.rows) {
      await client.query(
        `INSERT INTO notifications (recipient_id, title, message, type, link_url, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          mgr.id,
          notifTitle,
          notifMessage,
          cleanPriority === 'critical' ? 'critical' : 'warning',
          `/breakdowns/${complaint.id}`,
        ]
      );
    }

    await client.query('COMMIT');

    // 16. Real-time targeted Socket.IO room broadcast
    const activeIo = getBreakdownsActiveIo(customIoParam);
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
        reported_by: reportedByName,
        message: notifMessage,
      };

      // Real-time notification inbox event for each concerned manager
      for (const mgr of managersRes.rows) {
        if (typeof activeIo.to === 'function') {
          const notifItem = {
            recipient_id: mgr.id,
            title: notifTitle,
            message: notifMessage,
            type: cleanPriority === 'critical' ? 'critical' : 'warning',
            link_url: `/breakdowns/${complaint.id}`,
            action_url: `/breakdowns/${complaint.id}`,
            is_read: false,
            created_at: new Date(),
          };
          activeIo.to(`user:${mgr.id}`).emit('notification:new', notifItem);
          activeIo.to(`user_${mgr.id}`).emit('notification:new', notifItem);
          activeIo.to(`user:${mgr.id}`).emit('notification', notifItem);
        }
      }

      if (machine.plant_id && typeof activeIo.to === 'function') {
        activeIo.to(`plant:${machine.plant_id}`).emit('complaint:created', socketPayload);
        activeIo.to(`managers:${machine.plant_id}`).emit('complaint:created', socketPayload);
      }
      if (machine.shop_id && typeof activeIo.to === 'function') {
        activeIo.to(`shop:${machine.shop_id}`).emit('complaint:created', socketPayload);
      }
      if (cleanPriority === 'critical' && typeof activeIo.to === 'function') {
        if (machine.plant_id) {
          activeIo.to(`plant:${machine.plant_id}`).emit('complaint:critical', socketPayload);
        }
        activeIo.to('role:admin').emit('complaint:critical', socketPayload);
      }
    }

    return complaint;
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Safe rollback error suppression
      }
    }
    throw err;
  } finally {
    if (client) {
      client.release();
    }
  }
}
