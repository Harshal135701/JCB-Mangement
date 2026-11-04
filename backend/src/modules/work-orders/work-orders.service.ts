import { query as defaultQuery, pool as defaultPool } from '../../config/db';
import { AuthenticatedUser } from '../../middlewares/auth.middleware';

export const isUUID = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export class WorkOrderServiceError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = 'WorkOrderServiceError';
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, WorkOrderServiceError.prototype);
  }
}

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

export interface CreateWorkOrderFromComplaintInput {
  complaint_id: string;
  technician_id: string;
  manager_id?: string;
  user?: AuthenticatedUser;
  sla_hours?: number;
  work_instructions?: string;
  is_major_breakdown?: boolean;
}

export interface CreateWorkOrderResult {
  workOrder: any;
  complaint: any;
}

let activeQuery: DbQueryFunction = defaultQuery;
let activePool: DbPoolLike = defaultPool as unknown as DbPoolLike;
let customIo: any = undefined;

export const setWorkOrdersServiceDb = (
  customQuery?: DbQueryFunction,
  customPool?: DbPoolLike
): void => {
  activeQuery = customQuery || defaultQuery;
  activePool = customPool || (defaultPool as unknown as DbPoolLike);
};

export const resetWorkOrdersServiceDb = (): void => {
  activeQuery = defaultQuery;
  activePool = defaultPool as unknown as DbPoolLike;
};

export const setWorkOrdersServiceIo = (custom: any): void => {
  customIo = custom;
};

export const resetWorkOrdersServiceIo = (): void => {
  customIo = undefined;
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

/**
 * Executes work order creation within an existing open transaction client.
 * Enforces complaint row locking, facility scope checks, eligibility checks,
 * conversion idempotency, technician validation, transaction-level advisory locking
 * for WO number generation, table updates, and audit logging.
 */
export async function executeCreateWorkOrderTransaction(
  client: DbClientLike,
  input: CreateWorkOrderFromComplaintInput,
  ioInstance?: any
): Promise<CreateWorkOrderResult> {
  const { complaint_id, technician_id, manager_id, user, work_instructions } = input;
  const is_major_breakdown = Boolean(input.is_major_breakdown);
  const slaHoursNum = typeof input.sla_hours === 'number' && input.sla_hours > 0 ? input.sla_hours : 4;

  if (!complaint_id || !isUUID(complaint_id)) {
    throw new WorkOrderServiceError('Invalid breakdown complaint ID.', 400);
  }

  if (!technician_id || !isUUID(technician_id)) {
    throw new WorkOrderServiceError('Valid technician ID is required.', 400);
  }

  // 1. Fetch breakdown complaint with row-level lock
  const cmpRes = await client.query(
    `SELECT r.*, m.machine_code, m.name as machine_name, s.plant_id, m.shop_id
     FROM maintenance_requests r
     JOIN machines m ON r.machine_id = m.id
     JOIN shops s ON m.shop_id = s.id
     WHERE r.id = $1
     FOR UPDATE`,
    [complaint_id]
  );

  if (cmpRes.rows.length === 0) {
    throw new WorkOrderServiceError('Breakdown request not found.', 404);
  }

  const complaint = cmpRes.rows[0];

  // 2. Org scope validation
  if (user && user.role !== 'admin') {
    if (user.plant_id && user.plant_id !== complaint.plant_id) {
      throw new WorkOrderServiceError('Unauthorized for this plant.', 403);
    }
    if (user.shop_id && user.shop_id !== complaint.shop_id) {
      throw new WorkOrderServiceError('Unauthorized for this shop.', 403);
    }
  }

  // 3. Workflow eligibility checks
  if (['rejected', 'closed'].includes(complaint.status)) {
    throw new WorkOrderServiceError(`Cannot convert ${complaint.status} breakdown to work order.`, 400);
  }

  // 4. Idempotency checks
  if (complaint.status === 'work_order_created') {
    throw new WorkOrderServiceError('A work order has already been created for this breakdown.', 409);
  }

  const existingWoRes = await client.query(
    `SELECT id, wo_number FROM work_orders WHERE complaint_id = $1`,
    [complaint_id]
  );

  if (existingWoRes.rows.length > 0) {
    throw new WorkOrderServiceError(
      `Work order ${existingWoRes.rows[0].wo_number} already exists for this complaint.`,
      409
    );
  }

  // 5. Verify assigned technician exists, is active, and has technician role
  const techRes = await client.query(
    `SELECT id, full_name, email, role, is_active FROM users WHERE id = $1`,
    [technician_id]
  );

  if (techRes.rows.length === 0 || !techRes.rows[0].is_active) {
    throw new WorkOrderServiceError('Assigned technician not found or inactive.', 400);
  }

  if (techRes.rows[0].role !== 'technician') {
    throw new WorkOrderServiceError('Assigned user must have the technician role.', 400);
  }

  // 6. Concurrency-safe Work Order numbering using PostgreSQL transaction-level advisory locking:
  // Key format: 'wo_seq:YYYY' with collision-resistant 64-bit hashtextextended
  const currentYear = new Date().getFullYear();
  const woLockKey = `wo_seq:${currentYear}`;
  await client.query(
    `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
    [woLockKey]
  );

  const countRes = await client.query(
    `SELECT COALESCE(MAX(SUBSTRING(wo_number FROM '[0-9]+$')::int), 0) + 1 AS next_seq
     FROM work_orders
     WHERE wo_number LIKE $1`,
    [`WO-${currentYear}-%`]
  );
  const nextSeq = countRes.rows[0]?.next_seq || 1;
  const wo_number = `WO-${currentYear}-${String(nextSeq).padStart(5, '0')}`;

  const slaDeadline = new Date(Date.now() + slaHoursNum * 3600 * 1000);

  // 7. Insert Work Order
  const woRes = await client.query(
    `INSERT INTO work_orders (
      wo_number, complaint_id, machine_id, assigned_technician_id, assigned_manager_id,
      priority, status, is_major_breakdown, sla_deadline, work_instructions,
      breakdown_time, reported_time, manager_ack_time, technician_assigned_time
    )
    VALUES ($1, $2, $3, $4, $5, $6, 'assigned', $7, $8, $9, $10, $11, NOW(), NOW())
    RETURNING *`,
    [
      wo_number,
      complaint_id,
      complaint.machine_id,
      technician_id,
      manager_id || null,
      complaint.priority,
      is_major_breakdown,
      slaDeadline,
      work_instructions || 'Diagnose and restore machine operation following JCB safety SOPs.',
      complaint.breakdown_occurred_at,
      complaint.reported_at,
    ]
  );

  const workOrder = woRes.rows[0];

  // 8. Update Complaint status to 'work_order_created'
  await client.query(
    `UPDATE maintenance_requests SET status = 'work_order_created', updated_at = NOW() WHERE id = $1`,
    [complaint_id]
  );

  // 9. Update Machine status to 'under_maintenance'
  await client.query(
    `UPDATE machines SET status = 'under_maintenance', updated_at = NOW() WHERE id = $1`,
    [complaint.machine_id]
  );

  // 10. Record lifecycle event in work_order_events
  await client.query(
    `INSERT INTO work_order_events (work_order_id, event_type, performed_by, notes, timestamp)
     VALUES ($1, 'ASSIGNED', $2, $3, NOW())`,
    [
      workOrder.id,
      manager_id || technician_id,
      `Created from complaint ${complaint.complaint_number} and allocated to technician.`,
    ]
  );

  // 11. Immutable Audit Log
  await client.query(
    `INSERT INTO audit_logs (entity_name, entity_id, action, performed_by, old_values, new_values, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [
      'maintenance_requests',
      complaint_id,
      'BREAKDOWN_CONVERTED_WO',
      manager_id || null,
      null,
      JSON.stringify({
        work_order_id: workOrder.id,
        wo_number: workOrder.wo_number,
        assigned_technician_id: technician_id,
      }),
    ]
  );

  // 12. Notification for assigned technician
  await client.query(
    `INSERT INTO notifications (recipient_id, title, message, type, link_url, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [
      technician_id,
      'New Work Order Assigned',
      `Work Order ${wo_number} assigned for machine ${complaint.machine_code}. SLA: ${slaHoursNum}h.`,
      'assignment',
      `/work-orders/${workOrder.id}`,
    ]
  );

  // 13. Real-time notifications (targeted room + legacy global compatibility)
  const activeIo = ioInstance || getActiveIo();
  if (activeIo) {
    if (typeof activeIo.to === 'function') {
      activeIo.to(`user:${technician_id}`).emit('technician:assigned', {
        workOrder,
        message: `New Work Order ${wo_number} assigned. SLA: ${slaHoursNum} hours`,
      });
    }
    if (typeof activeIo.emit === 'function') {
      activeIo.emit(`technician:${technician_id}:assigned`, {
        workOrder,
        message: `New Work Order ${wo_number} assigned. SLA: ${slaHoursNum} hours`,
      });
    }
  }

  return { workOrder, complaint };
}

/**
 * Top-level service function that acquires a dedicated client from the pool,
 * manages BEGIN / COMMIT / ROLLBACK, and releases the client in finally.
 */
export async function createWorkOrderFromComplaintService(
  input: CreateWorkOrderFromComplaintInput,
  dbPool: DbPoolLike = activePool,
  ioInstance?: any
): Promise<CreateWorkOrderResult> {
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');
    const result = await executeCreateWorkOrderTransaction(client, input, ioInstance);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Safe rollback suppression
    }
    throw err;
  } finally {
    client.release();
  }
}
