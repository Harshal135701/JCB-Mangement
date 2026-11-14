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

export const ALLOWED_WO_STATUSES = [
  'assigned',
  'accepted',
  'scheduled',
  'under_diagnosis',
  'in_progress',
  'waiting_for_parts',
  'waiting_for_approval',
  'on_hold',
  'submitted_verification',
  'rework_required',
  'completed',
  'verified_closed',
  'reopened',
] as const;
export type WorkOrderStatus = (typeof ALLOWED_WO_STATUSES)[number];

export const ALLOWED_WO_PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;
export type WorkOrderPriority = (typeof ALLOWED_WO_PRIORITIES)[number];

export const ALLOWED_SORT_FIELDS = [
  'created_at',
  'wo_number',
  'priority',
  'status',
  'sla_deadline',
] as const;

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

export interface CreatePMWorkOrderInput {
  pm_plan_id: string;
  machine_id: string;
  plan_code?: string;
  plan_title?: string;
  work_instructions?: string;
  priority?: WorkOrderPriority;
  technician_id?: string;
  manager_id?: string;
  sla_hours?: number;
  user?: AuthenticatedUser;
}

export interface CreatePMWorkOrderResult {
  workOrder: any;
}

export interface GetWorkOrdersFilter {
  page?: number | string;
  limit?: number | string;
  technician_id?: string;
  status?: string;
  priority?: string;
  machine_id?: string;
  plant_id?: string;
  shop_id?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC' | 'asc' | 'desc';
}

export interface UpdateMilestoneInput {
  action: string;
  notes?: string;
  diagnosis?: string;
  affected_component?: string;
  fault_category?: string;
  root_cause_analysis?: string;
  corrective_action?: string;
  technician_remarks?: string;
  before_photos_json?: any;
  after_photos_json?: any;
  scheduled_date?: string;
  scheduled_time?: string;
}

export interface VerifyWorkOrderInput {
  result: 'APPROVED' | 'REJECTED';
  remarks?: string;
}

export interface ReassignWorkOrderInput {
  new_technician_id: string;
  notes?: string;
  work_instructions?: string;
}

export interface ReopenWorkOrderInput {
  reason: string;
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

export const getWorkOrdersServiceDb = () => ({
  query: activeQuery,
  pool: activePool,
});

export const getWorkOrdersServiceIo = () => getActiveIo();

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
 * Helper: record audit log
 */
async function recordAuditLog(
  client: DbClientLike,
  entityId: string,
  action: string,
  performedBy: string | null | undefined,
  oldValues: any,
  newValues: any
): Promise<void> {
  await client.query(
    `INSERT INTO audit_logs (entity_name, entity_id, action, performed_by, old_values, new_values, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [
      'work_orders',
      entityId,
      action,
      performedBy || null,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
    ]
  );
}

/**
 * Helper: record work order event
 */
async function recordWorkOrderEvent(
  client: DbClientLike,
  workOrderId: string,
  eventType: string,
  performedBy: string | null | undefined,
  notes: string | null | undefined
): Promise<void> {
  await client.query(
    `INSERT INTO work_order_events (work_order_id, event_type, performed_by, notes, timestamp)
     VALUES ($1, $2, $3, $4, NOW())`,
    [workOrderId, eventType, performedBy || null, notes || null]
  );
}

/**
 * Helper: create notification and emit real-time socket alert
 */
async function sendNotificationAndEmit(
  client: DbClientLike,
  recipientId: string,
  title: string,
  message: string,
  type: string,
  linkUrl: string,
  socketEvent: string,
  socketPayload: any,
  ioInstance?: any
): Promise<void> {
  const insertRes = await client.query(
    `INSERT INTO notifications (recipient_id, title, message, type, link_url, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [recipientId, title, message, type, linkUrl]
  );

  const activeIo = ioInstance || getActiveIo();
  if (activeIo) {
    const notifItem = {
      id: insertRes.rows?.[0]?.id || `notif-${Date.now()}`,
      recipient_id: recipientId,
      title,
      message,
      type,
      link_url: linkUrl,
      action_url: linkUrl,
      is_read: false,
      created_at: new Date(),
    };

    if (typeof activeIo.to === 'function') {
      activeIo.to(`user:${recipientId}`).emit('notification:new', notifItem);
      activeIo.to(`user_${recipientId}`).emit('notification:new', notifItem);
      activeIo.to(`user:${recipientId}`).emit('notification', notifItem);
      activeIo.to(`user:${recipientId}`).emit(socketEvent, socketPayload);
    }
    if (typeof activeIo.emit === 'function') {
      activeIo.emit(`user:${recipientId}:${socketEvent}`, socketPayload);
    }
    try {
      const countRes = await client.query(
        `SELECT COUNT(*)::int as unread_count FROM notifications WHERE recipient_id = $1 AND is_read = false`,
        [recipientId]
      );
      const unreadCount = Number(countRes.rows?.[0]?.unread_count || 1);
      if (typeof activeIo.to === 'function') {
        activeIo.to(`user:${recipientId}`).emit('notification:unread-count', { unread_count: unreadCount });
      }
    } catch {
      // Non-blocking unread count update
    }
  }
}

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

  // 2. Org scope validation & Role validation
  if (user && user.role !== 'admin') {
    if (user.role !== 'manager') {
      throw new WorkOrderServiceError(`Role '${user.role}' is not authorized to create or allocate work orders.`, 403);
    }
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

  // Validate technician facility compatibility if available on user record
  const tech = techRes.rows[0];
  if (tech && (tech as any).plant_id && complaint.plant_id && (tech as any).plant_id !== complaint.plant_id) {
    throw new WorkOrderServiceError('Assigned technician does not belong to the machine plant facility.', 400);
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
  await recordWorkOrderEvent(
    client,
    workOrder.id,
    'ASSIGNED',
    manager_id || technician_id,
    `Created from complaint ${complaint.complaint_number} and allocated to technician.`
  );

  // 11. Immutable Audit Log
  await recordAuditLog(
    client,
    complaint_id,
    'BREAKDOWN_CONVERTED_WO',
    manager_id || null,
    null,
    {
      work_order_id: workOrder.id,
      wo_number: workOrder.wo_number,
      assigned_technician_id: technician_id,
    }
  );

  // 12. Notification for assigned technician
  await sendNotificationAndEmit(
    client,
    technician_id,
    'New Work Order Assigned',
    `Work Order ${wo_number} assigned for machine ${complaint.machine_code}. SLA: ${slaHoursNum}h.`,
    'assignment',
    `/work-orders/${workOrder.id}`,
    'technician:assigned',
    {
      workOrder,
      message: `New Work Order ${wo_number} assigned. SLA: ${slaHoursNum} hours`,
    },
    ioInstance
  );

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

/**
 * Transactional creation of a Preventive Maintenance Work Order.
 * Generates sequential WO number under PostgreSQL transaction-level advisory lock,
 * inserts work order with regular_maintenance classification, records milestone event,
 * audit log, and notifies assigned technician.
 */
export async function executeCreatePMWorkOrderTransaction(
  client: DbClientLike,
  input: CreatePMWorkOrderInput,
  ioInstance?: any
): Promise<CreatePMWorkOrderResult> {
  const { pm_plan_id, machine_id, plan_code, plan_title, technician_id, manager_id, user } = input;
  const priority = input.priority || 'medium';
  const slaHoursNum = typeof input.sla_hours === 'number' && input.sla_hours > 0 ? input.sla_hours : 48;

  if (!machine_id || !isUUID(machine_id)) {
    throw new WorkOrderServiceError('Valid machine ID is required for PM work order.', 400);
  }

  // 1. Fetch machine and shop/plant details
  const mRes = await client.query(
    `SELECT m.*, s.plant_id, s.shop_name 
     FROM machines m 
     JOIN shops s ON m.shop_id = s.id 
     WHERE m.id = $1`,
    [machine_id]
  );
  if (mRes.rows.length === 0) {
    throw new WorkOrderServiceError('Machine not found for PM work order.', 404);
  }
  const machine = mRes.rows[0];

  // 2. Org scope validation (if user provided)
  if (user && user.role !== 'admin') {
    if (user.plant_id && user.plant_id !== machine.plant_id) {
      throw new WorkOrderServiceError('Unauthorized for this plant.', 403);
    }
    if (user.shop_id && user.shop_id !== machine.shop_id) {
      throw new WorkOrderServiceError('Unauthorized for this shop.', 403);
    }
  }

  // 3. Technician validation if provided
  if (technician_id) {
    if (!isUUID(technician_id)) {
      throw new WorkOrderServiceError('Invalid technician ID format.', 400);
    }
    const techRes = await client.query(
      `SELECT id, full_name, email, role, is_active FROM users WHERE id = $1`,
      [technician_id]
    );
    if (techRes.rows.length === 0 || !techRes.rows[0].is_active) {
      throw new WorkOrderServiceError('Assigned technician not found or inactive.', 400);
    }
    if (techRes.rows[0].role !== 'technician') {
      throw new WorkOrderServiceError('Assigned user must have technician role.', 400);
    }
  }

  // 4. Concurrency-safe Work Order numbering using PostgreSQL transaction-level advisory locking
  const currentYear = new Date().getFullYear();
  const woLockKey = `wo_seq:${currentYear}`;

  // Acquire machine-level PM generation advisory lock to serialize concurrent PM generation
  if (pm_plan_id) {
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
      [`pm_gen:${machine_id}`]
    );

    // Concurrency guard: verify no active open PM work order already exists for this plan
    const dupCheck = await client.query(
      `SELECT id, wo_number, status 
       FROM work_orders 
       WHERE machine_id = $1 
         AND classification = 'regular_maintenance' 
         AND status NOT IN ('verified_closed', 'completed')
         AND (work_instructions LIKE '%' || $2 || '%' OR work_instructions LIKE '%' || $3 || '%')
       LIMIT 1`,
      [machine_id, plan_code || '', pm_plan_id || '']
    );

    if (dupCheck.rows.length > 0) {
      return {
        workOrder: dupCheck.rows[0],
      };
    }
  }

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

  const formattedInstructions = input.work_instructions ||
    `[PM Plan: ${plan_code || 'PM-SCHEDULED'} | Plan ID: ${pm_plan_id}] ${plan_title || 'Preventive Maintenance Service'}. Execute mandatory maintenance checklist.`;

  // 5. Insert Work Order
  const woRes = await client.query(
    `INSERT INTO work_orders (
      wo_number, machine_id, assigned_technician_id, assigned_manager_id,
      priority, status, classification, is_major_breakdown, sla_deadline, work_instructions,
      created_at, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, 'assigned', 'regular_maintenance', FALSE, $6, $7, NOW(), NOW())
    RETURNING *`,
    [
      wo_number,
      machine_id,
      technician_id || null,
      manager_id || (user?.role === 'manager' ? user.id : null),
      priority,
      slaDeadline,
      formattedInstructions,
    ]
  );

  const workOrder = woRes.rows[0];

  // 6. Record Milestone Event
  await client.query(
    `INSERT INTO work_order_events (work_order_id, event_type, performed_by, notes, timestamp)
     VALUES ($1, 'PM_WORK_ORDER_GENERATED', $2, $3, NOW())`,
    [
      workOrder.id,
      user?.id || manager_id || '00000000-0000-0000-0000-000000000001',
      `Automated PM work order generated for plan ${plan_code || pm_plan_id}`,
    ]
  );

  // 7. Audit log
  await recordAuditLog(
    client,
    workOrder.id,
    'CREATE_PM_WORK_ORDER',
    user?.id || manager_id || null,
    null,
    {
      wo_number,
      pm_plan_id,
      machine_id,
      classification: 'regular_maintenance',
    }
  );

  // 8. Notification if technician assigned
  if (technician_id) {
    await sendNotificationAndEmit(
      client,
      technician_id,
      'New PM Work Order Assigned',
      `Preventive Maintenance Work Order ${wo_number} assigned for machine ${machine.machine_code}.`,
      'assignment',
      `/work-orders/${workOrder.id}`,
      'technician:assigned',
      {
        workOrder,
        message: `New PM Work Order ${wo_number} assigned`,
      },
      ioInstance
    );
  }

  return { workOrder };
}

/**
 * Dedicated top-level service for creating PM Work Orders with connection management and rollback safety.
 */
export async function createPMWorkOrderService(
  input: CreatePMWorkOrderInput,
  dbPool: DbPoolLike = activePool,
  ioInstance?: any
): Promise<CreatePMWorkOrderResult> {
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');
    const result = await executeCreatePMWorkOrderTransaction(client, input, ioInstance);
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

/**
 * List Work Orders with search, role-based filtering, and pagination
 */
export async function getWorkOrdersService(
  filter: GetWorkOrdersFilter,
  user?: AuthenticatedUser,
  dbClient: DbQueryFunction = activeQuery
): Promise<{
  workOrders: any[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}> {
  if (!user) {
    throw new WorkOrderServiceError('Authentication required.', 401);
  }

  // Operators must not perform manager or technician operations
  if (user.role === 'operator') {
    throw new WorkOrderServiceError('Operators are not authorized to view or manage work orders.', 403);
  }

  const page = Math.max(1, parseInt(String(filter.page || '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(filter.limit || '20'), 10) || 20));
  const offset = (page - 1) * limit;

  const conditions: string[] = ['1=1'];
  const params: any[] = [];

  // Role-based security scoping
  if (user.role === 'technician') {
    // Technicians must only access work orders assigned to them
    params.push(user.id);
    conditions.push(`wo.assigned_technician_id = $${params.length}`);
  } else if (user.role === 'manager' || user.role === 'store_manager') {
    // Managers and Store Managers must be restricted to their authorized plant/shop (fail-closed)
    if (!user.plant_id) {
      throw new WorkOrderServiceError('Forbidden: Valid plant facility assignment required.', 403);
    }
    if (filter.plant_id && filter.plant_id !== user.plant_id) {
      throw new WorkOrderServiceError('Forbidden: Cannot filter work orders outside your assigned plant facility.', 403);
    }
    if (user.shop_id && filter.shop_id && filter.shop_id !== user.shop_id) {
      throw new WorkOrderServiceError('Forbidden: Cannot filter work orders outside your assigned shop facility.', 403);
    }
    params.push(user.plant_id);
    conditions.push(`s.plant_id = $${params.length}`);
    if (user.shop_id) {
      params.push(user.shop_id);
      conditions.push(`m.shop_id = $${params.length}`);
    }
    if (filter.technician_id && isUUID(filter.technician_id)) {
      params.push(filter.technician_id);
      conditions.push(`wo.assigned_technician_id = $${params.length}`);
    }
  } else if (user.role === 'admin') {
    // Admins can filter by plant, shop, or technician if provided
    if (user.plant_id) {
      if (filter.plant_id && filter.plant_id !== user.plant_id) {
        throw new WorkOrderServiceError('Forbidden: Cannot filter work orders outside your assigned plant facility.', 403);
      }
      params.push(user.plant_id);
      conditions.push(`s.plant_id = $${params.length}`);
    } else if (filter.plant_id && isUUID(filter.plant_id)) {
      params.push(filter.plant_id);
      conditions.push(`s.plant_id = $${params.length}`);
    }
    if (filter.technician_id && isUUID(filter.technician_id)) {
      params.push(filter.technician_id);
      conditions.push(`wo.assigned_technician_id = $${params.length}`);
    }
    if (filter.shop_id && isUUID(filter.shop_id)) {
      params.push(filter.shop_id);
      conditions.push(`m.shop_id = $${params.length}`);
    }
  }

  // Filter: status
  if (filter.status) {
    const cleanStatus = String(filter.status).trim().toLowerCase();
    if (ALLOWED_WO_STATUSES.includes(cleanStatus as WorkOrderStatus)) {
      params.push(cleanStatus);
      conditions.push(`wo.status = $${params.length}`);
    }
  }

  // Filter: priority
  if (filter.priority) {
    const cleanPriority = String(filter.priority).trim().toLowerCase();
    if (ALLOWED_WO_PRIORITIES.includes(cleanPriority as WorkOrderPriority)) {
      params.push(cleanPriority);
      conditions.push(`wo.priority = $${params.length}`);
    }
  }

  // Filter: machine_id
  if (filter.machine_id && isUUID(filter.machine_id)) {
    params.push(filter.machine_id);
    conditions.push(`wo.machine_id = $${params.length}`);
  }

  // Search filter (wo_number, machine_code, machine_name, problem_title)
  const searchQuery = filter.search ? String(filter.search).trim() : '';
  if (searchQuery.length > 0) {
    params.push(`%${searchQuery}%`);
    const pIdx = params.length;
    conditions.push(`(wo.wo_number ILIKE $${pIdx} OR m.machine_code ILIKE $${pIdx} OR m.name ILIKE $${pIdx} OR r.problem_title ILIKE $${pIdx})`);
  }

  // Sorting (support both camelCase and snake_case)
  const sortByParam = filter.sortBy || (filter as any).sort_by;
  const sortOrderParam = filter.sortOrder || (filter as any).sort_order;

  let sortColumn = 'wo.created_at';
  if (sortByParam && ALLOWED_SORT_FIELDS.includes(sortByParam as any)) {
    sortColumn = `wo.${sortByParam}`;
  }
  const sortDirection = String(sortOrderParam || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const whereClause = conditions.join(' AND ');

  // Count total matching records
  const countSql = `
    SELECT COUNT(wo.id)::int AS total
    FROM work_orders wo
    JOIN machines m ON wo.machine_id = m.id
    JOIN shops s ON m.shop_id = s.id
    JOIN plants p ON s.plant_id = p.id
    LEFT JOIN users u ON wo.assigned_technician_id = u.id
    LEFT JOIN users mgr ON wo.assigned_manager_id = mgr.id
    LEFT JOIN maintenance_requests r ON wo.complaint_id = r.id
    WHERE ${whereClause}
  `;
  const countRes = await dbClient(countSql, params);
  const total = countRes.rows[0]?.total || 0;

  // Query records
  const dataParams = [...params, limit, offset];
  const dataSql = `
    SELECT 
      wo.*,
      m.machine_code,
      m.name AS machine_name,
      m.bay_line_location,
      m.criticality,
      m.status AS machine_status,
      s.id AS shop_id,
      s.shop_name,
      p.id AS plant_id,
      p.plant_name,
      u.full_name AS technician_name,
      u.employee_code AS technician_code,
      u.email AS technician_email,
      mgr.full_name AS manager_name,
      mgr.employee_code AS manager_code,
      r.complaint_number,
      r.problem_title,
      r.issue_category
    FROM work_orders wo
    JOIN machines m ON wo.machine_id = m.id
    JOIN shops s ON m.shop_id = s.id
    JOIN plants p ON s.plant_id = p.id
    LEFT JOIN users u ON wo.assigned_technician_id = u.id
    LEFT JOIN users mgr ON wo.assigned_manager_id = mgr.id
    LEFT JOIN maintenance_requests r ON wo.complaint_id = r.id
    WHERE ${whereClause}
    ORDER BY ${sortColumn} ${sortDirection}
    LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
  `;

  const dataRes = await dbClient(dataSql, dataParams);
  const totalPages = Math.ceil(total / limit) || 1;

  return {
    workOrders: dataRes.rows,
    pagination: {
      total,
      page,
      limit,
      totalPages,
    },
  };
}

/**
 * Fetch detailed work order with parts and events
 */
export async function getWorkOrderDetailsService(
  id: string,
  user?: AuthenticatedUser,
  dbClient: DbQueryFunction = activeQuery
): Promise<any> {
  if (!user) {
    throw new WorkOrderServiceError('Authentication required.', 401);
  }

  if (user.role === 'operator') {
    throw new WorkOrderServiceError('Operators are not authorized to view or manage work orders.', 403);
  }

  if (!isUUID(id)) {
    throw new WorkOrderServiceError('Invalid work order ID.', 400);
  }

  const sql = `
    SELECT 
      wo.*,
      m.machine_code,
      m.name AS machine_name,
      m.category AS machine_category,
      m.criticality,
      m.bay_line_location,
      m.operating_hours,
      m.status AS machine_status,
      s.id AS shop_id,
      s.shop_name,
      p.id AS plant_id,
      p.plant_name,
      u.full_name AS technician_name,
      u.employee_code AS technician_code,
      u.email AS technician_email,
      mgr.full_name AS manager_name,
      mgr.employee_code AS manager_code,
      r.complaint_number,
      r.problem_title,
      r.description AS complaint_description,
      r.issue_category,
      r.shift,
      r.breakdown_occurred_at,
      r.reported_at
    FROM work_orders wo
    JOIN machines m ON wo.machine_id = m.id
    JOIN shops s ON m.shop_id = s.id
    JOIN plants p ON s.plant_id = p.id
    LEFT JOIN users u ON wo.assigned_technician_id = u.id
    LEFT JOIN users mgr ON wo.assigned_manager_id = mgr.id
    LEFT JOIN maintenance_requests r ON wo.complaint_id = r.id
    WHERE wo.id = $1
  `;

  const res = await dbClient(sql, [id]);
  if (res.rows.length === 0) {
    throw new WorkOrderServiceError('Work order not found.', 404);
  }

  const wo = res.rows[0];

  // RBAC Access Control
  if (user.role === 'technician') {
    if (wo.assigned_technician_id !== user.id) {
      throw new WorkOrderServiceError('You are only authorized to access work orders assigned to you.', 403);
    }
  } else if (user.role === 'manager' || user.role === 'store_manager') {
    if (!user.plant_id) {
      throw new WorkOrderServiceError('Forbidden: Valid plant facility assignment required.', 403);
    }
    if (user.plant_id !== wo.plant_id) {
      throw new WorkOrderServiceError('Unauthorized for work orders outside your plant.', 403);
    }
    if (user.shop_id && user.shop_id !== wo.shop_id) {
      throw new WorkOrderServiceError('Unauthorized for work orders outside your shop.', 403);
    }
  }

  // Fetch spare parts consumed
  const partsRes = await dbClient(
    `SELECT pc.*, COALESCE(pc.quantity_requested, pc.quantity_issued, 0) AS quantity,
            sp.part_number, sp.name AS part_name, sp.category AS part_category, sp.uom AS unit_of_measure
     FROM wo_parts_consumed pc
     JOIN spare_parts sp ON pc.part_id = sp.id
     WHERE pc.work_order_id = $1
     ORDER BY pc.created_at ASC`,
    [id]
  );

  // Fetch milestone events
  const eventsRes = await dbClient(
    `SELECT e.*, u.full_name AS performed_by_name, u.role AS performed_by_role
     FROM work_order_events e
     LEFT JOIN users u ON e.performed_by = u.id
     WHERE e.work_order_id = $1
     ORDER BY e.timestamp ASC`,
    [id]
  );

  return {
    ...wo,
    parts_consumed: partsRes.rows,
    events: eventsRes.rows,
  };
}

/**
 * Fetch work order lifecycle events
 */
export async function getWorkOrderHistoryService(
  id: string,
  user?: AuthenticatedUser,
  dbClient: DbQueryFunction = activeQuery
): Promise<any[]> {
  // First verify existence and access authorization
  await getWorkOrderDetailsService(id, user, dbClient);

  const eventsRes = await dbClient(
    `SELECT e.*, u.full_name AS performed_by_name, u.role AS performed_by_role
     FROM work_order_events e
     LEFT JOIN users u ON e.performed_by = u.id
     WHERE e.work_order_id = $1
     ORDER BY e.timestamp ASC`,
    [id]
  );

  return eventsRes.rows;
}

/**
 * Fetch spare parts consumed against a work order
 */
export async function getWorkOrderPartsService(
  id: string,
  user?: AuthenticatedUser,
  dbClient: DbQueryFunction = activeQuery
): Promise<any[]> {
  await getWorkOrderDetailsService(id, user, dbClient);

  const partsRes = await dbClient(
    `SELECT pc.*, COALESCE(pc.quantity_requested, pc.quantity_issued, 0) AS quantity,
            sp.part_number, sp.name AS part_name, sp.category AS part_category,
            sp.uom AS unit_of_measure, sp.current_physical_stock, sp.available_stock
     FROM wo_parts_consumed pc
     JOIN spare_parts sp ON pc.part_id = sp.id
     WHERE pc.work_order_id = $1
     ORDER BY pc.created_at ASC`,
    [id]
  );

  return partsRes.rows;
}

/**
 * Reassign work order to another technician
 */
export async function reassignWorkOrderService(
  id: string,
  input: ReassignWorkOrderInput,
  user?: AuthenticatedUser,
  dbPool: DbPoolLike = activePool,
  ioInstance?: any
): Promise<any> {
  if (!user) {
    throw new WorkOrderServiceError('Authentication required.', 401);
  }

  if (!['admin', 'manager'].includes(user.role)) {
    throw new WorkOrderServiceError('Only managers and admins can reassign work orders.', 403);
  }

  if (!isUUID(id)) {
    throw new WorkOrderServiceError('Invalid work order ID.', 400);
  }

  const { new_technician_id, notes, work_instructions } = input;
  if (!new_technician_id || !isUUID(new_technician_id)) {
    throw new WorkOrderServiceError('Valid target technician ID is required.', 400);
  }

  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');

    const woRes = await client.query(
      `SELECT wo.*, m.machine_code, s.plant_id, m.shop_id
       FROM work_orders wo
       JOIN machines m ON wo.machine_id = m.id
       JOIN shops s ON m.shop_id = s.id
       WHERE wo.id = $1
       FOR UPDATE OF wo`,
      [id]
    );

    if (woRes.rows.length === 0) {
      throw new WorkOrderServiceError('Work order not found.', 404);
    }

    const wo = woRes.rows[0];

    // Manager plant/shop check
    if (user.role === 'manager') {
      if (!user.plant_id) {
        throw new WorkOrderServiceError('Forbidden: Valid plant facility assignment required.', 403);
      }
      if (user.plant_id !== wo.plant_id) {
        throw new WorkOrderServiceError('Unauthorized for work orders outside your assigned plant.', 403);
      }
      if (user.shop_id && user.shop_id !== wo.shop_id) {
        throw new WorkOrderServiceError('Unauthorized for work orders outside your assigned shop.', 403);
      }
    }

    if (['verified_closed', 'completed'].includes(wo.status)) {
      throw new WorkOrderServiceError(`Cannot reassign a ${wo.status} work order.`, 400);
    }

    if (wo.assigned_technician_id === new_technician_id) {
      throw new WorkOrderServiceError('Work order is already assigned to this technician.', 400);
    }

    // Verify target technician exists, is active, and facility compatible
    const techRes = await client.query(
      `SELECT id, full_name, email, role, is_active FROM users WHERE id = $1`,
      [new_technician_id]
    );

    if (techRes.rows.length === 0 || !techRes.rows[0].is_active) {
      throw new WorkOrderServiceError('Target technician not found or inactive.', 400);
    }

    if (techRes.rows[0].role !== 'technician') {
      throw new WorkOrderServiceError('Target user must have the technician role.', 400);
    }

    const targetTech = techRes.rows[0];
    if (targetTech && (targetTech as any).plant_id && wo.plant_id && (targetTech as any).plant_id !== wo.plant_id) {
      throw new WorkOrderServiceError('Target technician does not belong to the work order plant facility.', 400);
    }

    // Update assignment
    const updateSql = `
      UPDATE work_orders
      SET assigned_technician_id = $1,
          technician_assigned_time = NOW(),
          work_instructions = COALESCE($2, work_instructions),
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;
    const updateRes = await client.query(updateSql, [
      new_technician_id,
      work_instructions ? work_instructions.trim() : null,
      id,
    ]);
    const updated = updateRes.rows[0];

    // Event & audit log
    await recordWorkOrderEvent(
      client,
      id,
      'REASSIGNED',
      user.id,
      notes || `Work order reassigned to technician ${techRes.rows[0].full_name}.`
    );

    await recordAuditLog(
      client,
      id,
      'WORK_ORDER_REASSIGNED',
      user.id,
      { assigned_technician_id: wo.assigned_technician_id },
      { assigned_technician_id: new_technician_id, notes }
    );

    // Notify new technician
    await sendNotificationAndEmit(
      client,
      new_technician_id,
      'Work Order Reassigned',
      `Work Order ${wo.wo_number} has been reassigned to you for machine ${wo.machine_code}.`,
      'assignment',
      `/work-orders/${id}`,
      'technician:assigned',
      {
        workOrder: updated,
        message: `Work Order ${wo.wo_number} reassigned to you.`,
      },
      ioInstance
    );

    await client.query('COMMIT');
    return updated;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // safe rollback
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Update Work Order Milestone (ACCEPT, SCHEDULE, ARRIVED, START_WORK, PAUSE, RESUME, PROGRESS, COMPLETE)
 */
export async function updateWorkOrderMilestoneService(
  id: string,
  input: UpdateMilestoneInput,
  user?: AuthenticatedUser,
  dbPool: DbPoolLike = activePool,
  ioInstance?: any
): Promise<any> {
  if (!user) {
    throw new WorkOrderServiceError('Authentication required.', 401);
  }

  if (user.role === 'operator') {
    throw new WorkOrderServiceError('Operators are not authorized to update work orders.', 403);
  }

  if (!isUUID(id)) {
    throw new WorkOrderServiceError('Invalid work order ID.', 400);
  }

  const { action } = input;
  if (!action || typeof action !== 'string') {
    throw new WorkOrderServiceError('Milestone action is required.', 400);
  }

  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');

    const woRes = await client.query(
      `SELECT wo.*, m.machine_code, m.id AS machine_id, s.plant_id, m.shop_id
       FROM work_orders wo
       JOIN machines m ON wo.machine_id = m.id
       JOIN shops s ON m.shop_id = s.id
       WHERE wo.id = $1
       FOR UPDATE OF wo`,
      [id]
    );

    if (woRes.rows.length === 0) {
      throw new WorkOrderServiceError('Work order not found.', 404);
    }

    const wo = woRes.rows[0];

    // Authorization checks
    if (user.role === 'technician') {
      if (wo.assigned_technician_id !== user.id) {
        throw new WorkOrderServiceError('You can only update work orders assigned to you.', 403);
      }
    } else if (user.role === 'manager') {
      if (!user.plant_id) {
        throw new WorkOrderServiceError('Forbidden: Valid plant facility assignment required.', 403);
      }
      if (user.plant_id !== wo.plant_id) {
        throw new WorkOrderServiceError('Unauthorized for this plant.', 403);
      }
      if (user.shop_id && user.shop_id !== wo.shop_id) {
        throw new WorkOrderServiceError('Unauthorized for this shop.', 403);
      }
    }

    // Terminal statuses prevent further updates
    if (['verified_closed', 'completed'].includes(wo.status)) {
      throw new WorkOrderServiceError(`Cannot update work order with status '${wo.status}'. It is already closed.`, 400);
    }

    let nextStatus = wo.status;
    let nextMachineStatus: string | null = null;
    const updates: string[] = ['updated_at = NOW()'];
    const params: any[] = [id];

    switch (action.toUpperCase()) {
      case 'ACCEPT': {
        if (wo.status !== 'assigned') {
          throw new WorkOrderServiceError(`Cannot accept work order. Current status is '${wo.status}'.`, 400);
        }
        nextStatus = 'accepted';
        updates.push(`status = 'accepted'`);
        break;
      }

      case 'DECLINE':
      case 'REJECT': {
        if (wo.status !== 'assigned') {
          throw new WorkOrderServiceError(`Cannot decline work order from status '${wo.status}'. Must be 'assigned'.`, 400);
        }
        const reason = input.notes || input.technician_remarks || (input as any).reason || '';
        if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
          throw new WorkOrderServiceError('A reason explaining why you cannot take the job is mandatory.', 400);
        }
        nextStatus = 'assigned';
        updates.push(`assigned_technician_id = NULL`);
        params.push(`Technician declined assignment: ${reason.trim()}`);
        updates.push(`technician_remarks = $${params.length}`);
        break;
      }

      case 'SCHEDULE': {
        if (!['assigned', 'accepted'].includes(wo.status)) {
          throw new WorkOrderServiceError(`Cannot schedule work order from status '${wo.status}'.`, 400);
        }
        nextStatus = 'scheduled';
        updates.push(`status = 'scheduled'`);
        updates.push(`schedule_status = 'confirmed'`);
        if (input.scheduled_date) {
          params.push(input.scheduled_date);
          updates.push(`scheduled_visit_date = $${params.length}`);
        }
        if (input.scheduled_time) {
          params.push(input.scheduled_time);
          updates.push(`scheduled_visit_time = $${params.length}`);
        }
        break;
      }

      case 'ARRIVED': {
        if (!['assigned', 'accepted', 'scheduled'].includes(wo.status)) {
          throw new WorkOrderServiceError(`Cannot record arrival from status '${wo.status}'.`, 400);
        }
        nextStatus = 'under_diagnosis';
        nextMachineStatus = 'under_maintenance';
        updates.push(`status = 'under_diagnosis'`);
        updates.push(`arrival_time = COALESCE(arrival_time, NOW())`);

        // Compute maintenance response minutes from reported_time
        const reportedTime = wo.reported_time || wo.created_at;
        const responseMins = Math.max(0, Math.round((Date.now() - new Date(reportedTime).getTime()) / 60000));
        params.push(responseMins);
        updates.push(`maintenance_response_minutes = COALESCE(maintenance_response_minutes, $${params.length})`);
        break;
      }

      case 'START_WORK': {
        if (!['accepted', 'scheduled', 'under_diagnosis', 'waiting_for_parts', 'rework_required'].includes(wo.status)) {
          throw new WorkOrderServiceError(`Cannot start work from status '${wo.status}'.`, 400);
        }
        nextStatus = 'in_progress';
        nextMachineStatus = 'under_maintenance';
        updates.push(`status = 'in_progress'`);
        updates.push(`work_started_time = COALESCE(work_started_time, NOW())`);
        if (wo.status === 'waiting_for_parts') {
          updates.push(`work_resumed_time = NOW()`);
        }
        break;
      }

      case 'PAUSE': {
        if (wo.status !== 'in_progress') {
          throw new WorkOrderServiceError(`Cannot pause work order from status '${wo.status}'. Must be 'in_progress'.`, 400);
        }
        nextStatus = 'waiting_for_parts';
        nextMachineStatus = 'awaiting_parts';
        updates.push(`status = 'waiting_for_parts'`);
        updates.push(`work_paused_time = NOW()`);
        break;
      }

      case 'RESUME': {
        if (!['waiting_for_parts', 'on_hold'].includes(wo.status)) {
          throw new WorkOrderServiceError(`Cannot resume work order from status '${wo.status}'. Must be 'waiting_for_parts' or 'on_hold'.`, 400);
        }
        nextStatus = 'in_progress';
        nextMachineStatus = 'under_maintenance';
        updates.push(`status = 'in_progress'`);
        updates.push(`work_resumed_time = NOW()`);
        break;
      }

      case 'PROGRESS': {
        if (!['under_diagnosis', 'in_progress', 'waiting_for_parts', 'rework_required'].includes(wo.status)) {
          throw new WorkOrderServiceError(`Cannot record progress updates from status '${wo.status}'.`, 400);
        }
        if (input.diagnosis) {
          params.push(input.diagnosis.trim());
          updates.push(`diagnosis = $${params.length}`);
        }
        if (input.affected_component) {
          params.push(input.affected_component.trim());
          updates.push(`affected_component = $${params.length}`);
        }
        if (input.fault_category) {
          params.push(input.fault_category.trim());
          updates.push(`fault_category = $${params.length}`);
        }
        if (input.root_cause_analysis) {
          params.push(input.root_cause_analysis.trim());
          updates.push(`root_cause_analysis = $${params.length}`);
        }
        if (input.corrective_action) {
          params.push(input.corrective_action.trim());
          updates.push(`corrective_action = $${params.length}`);
        }
        if (input.technician_remarks) {
          params.push(input.technician_remarks.trim());
          updates.push(`technician_remarks = $${params.length}`);
        }
        break;
      }

      case 'COMPLETE': {
        if (!['in_progress', 'under_diagnosis'].includes(wo.status)) {
          throw new WorkOrderServiceError(`Cannot complete repair from status '${wo.status}'. Work order must be in progress or under diagnosis.`, 400);
        }

        if (!input.diagnosis || typeof input.diagnosis !== 'string' || input.diagnosis.trim().length === 0) {
          throw new WorkOrderServiceError('Diagnosis is mandatory when completing repair.', 400);
        }

        if (!input.corrective_action || typeof input.corrective_action !== 'string' || input.corrective_action.trim().length === 0) {
          throw new WorkOrderServiceError('Corrective action is mandatory when completing repair.', 400);
        }

        nextStatus = 'submitted_verification';
        nextMachineStatus = 'awaiting_verification';
        updates.push(`status = 'submitted_verification'`);
        updates.push(`repair_completed_time = NOW()`);

        params.push(input.diagnosis.trim());
        updates.push(`diagnosis = $${params.length}`);

        params.push(input.corrective_action.trim());
        updates.push(`corrective_action = $${params.length}`);

        if (input.affected_component) {
          params.push(input.affected_component.trim());
          updates.push(`affected_component = $${params.length}`);
        }
        if (input.fault_category) {
          params.push(input.fault_category.trim());
          updates.push(`fault_category = $${params.length}`);
        }
        if (input.root_cause_analysis) {
          params.push(input.root_cause_analysis.trim());
          updates.push(`root_cause_analysis = $${params.length}`);
        }
        if (input.technician_remarks || input.notes) {
          params.push((input.technician_remarks || input.notes || '').trim());
          updates.push(`technician_remarks = $${params.length}`);
        }

        // Active repair minutes & labour hours calculation
        const startTime = wo.work_started_time ? new Date(wo.work_started_time).getTime() : Date.now();
        const activeMinutes = Math.max(1, Math.round((Date.now() - startTime) / 60000));
        const labourHours = Math.round((activeMinutes / 60.0) * 100) / 100;

        params.push(activeMinutes);
        updates.push(`active_repair_minutes = $${params.length}`);

        params.push(labourHours);
        updates.push(`labour_hours = $${params.length}`);
        break;
      }

      default:
        throw new WorkOrderServiceError(
          `Invalid action: '${action}'. Allowed: ACCEPT, DECLINE, REJECT, SCHEDULE, ARRIVED, START_WORK, PAUSE, RESUME, PROGRESS, COMPLETE.`,
          400
        );
    }

    // Apply updates to work_orders
    const updateSql = `
      UPDATE work_orders
      SET ${updates.join(', ')}
      WHERE id = $1
      RETURNING *
    `;
    const updateRes = await client.query(updateSql, params);
    const updatedWo = updateRes.rows[0];

    // Update physical machine status if milestone altered machine state
    if (nextMachineStatus) {
      await client.query(
        `UPDATE machines SET status = $1, updated_at = NOW() WHERE id = $2`,
        [nextMachineStatus, wo.machine_id]
      );
    }

    // Record milestone event
    await recordWorkOrderEvent(
      client,
      id,
      action.toUpperCase(),
      user.id,
      input.notes || `Milestone ${action.toUpperCase()} recorded.`
    );

    // Record audit log
    await recordAuditLog(
      client,
      id,
      `WORK_ORDER_${action.toUpperCase()}`,
      user.id,
      { status: wo.status },
      { status: nextStatus, action: action.toUpperCase() }
    );

    const techName = (user as any).full_name || user.employee_code || 'Technician';

    // Stage 3: Technician accepts work order -> notify assigned manager
    if (action.toUpperCase() === 'ACCEPT' && wo.assigned_manager_id) {
      await sendNotificationAndEmit(
        client,
        wo.assigned_manager_id,
        'Work Order Accepted',
        `Technician ${techName} has accepted work order ${wo.wo_number}.`,
        'info',
        `/work-orders/${id}`,
        'work_order:accepted',
        {
          workOrder: updatedWo,
          technician: { id: user.id, name: techName },
          message: `Technician ${techName} has accepted work order ${wo.wo_number}.`,
        },
        ioInstance
      );
    }

    // Stage 3: Technician declines / rejects assignment -> notify assigned manager
    if (['DECLINE', 'REJECT'].includes(action.toUpperCase()) && wo.assigned_manager_id) {
      const declineReason = (input.notes || input.technician_remarks || (input as any).reason || '').trim();
      await sendNotificationAndEmit(
        client,
        wo.assigned_manager_id,
        'Work Order Assignment Declined',
        `Technician ${techName} cannot take work order ${wo.wo_number}: ${declineReason}`,
        'warning',
        `/work-orders/${id}`,
        'work_order:declined',
        {
          workOrder: updatedWo,
          technician: { id: user.id, name: techName },
          reason: declineReason,
          message: `Technician ${techName} declined work order ${wo.wo_number}: ${declineReason}`,
        },
        ioInstance
      );
    }

    // Stage 4: Technician completes repair and submits for verification -> notify assigned manager
    if (nextStatus === 'submitted_verification' && wo.assigned_manager_id) {
      const machineLabel = wo.machine_code || 'Machine';
      await sendNotificationAndEmit(
        client,
        wo.assigned_manager_id,
        'Repair Submitted for Verification',
        `Repair submitted for verification. Machine: ${machineLabel}. Technician: ${techName}. Work Order: ${wo.wo_number}.`,
        'alert',
        `/work-orders/${id}`,
        'work_order:submitted_verification',
        {
          workOrder: updatedWo,
          machine_code: machineLabel,
          technician: { id: user.id, name: techName },
          message: `Repair submitted for verification. Machine: ${machineLabel}. Technician: ${techName}. Work Order: ${wo.wo_number}.`,
        },
        ioInstance
      );
    }

    await client.query('COMMIT');
    return updatedWo;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // safe rollback
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Manager Verification & Approval or Rework Request
 */
export async function verifyAndCloseWorkOrderService(
  id: string,
  input: VerifyWorkOrderInput,
  user?: AuthenticatedUser,
  dbPool: DbPoolLike = activePool,
  ioInstance?: any
): Promise<any> {
  if (!user) {
    throw new WorkOrderServiceError('Authentication required.', 401);
  }

  if (!['admin', 'manager'].includes(user.role)) {
    throw new WorkOrderServiceError('Only managers and admins can verify work orders.', 403);
  }

  if (!isUUID(id)) {
    throw new WorkOrderServiceError('Invalid work order ID.', 400);
  }

  const { result, remarks } = input;
  if (!result || !['APPROVED', 'REJECTED'].includes(result)) {
    throw new WorkOrderServiceError("Verification result must be 'APPROVED' or 'REJECTED'.", 400);
  }

  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');

    const woRes = await client.query(
      `SELECT wo.*, m.machine_code, m.id AS machine_id, s.plant_id, m.shop_id
       FROM work_orders wo
       JOIN machines m ON wo.machine_id = m.id
       JOIN shops s ON m.shop_id = s.id
       WHERE wo.id = $1
       FOR UPDATE OF wo`,
      [id]
    );

    if (woRes.rows.length === 0) {
      throw new WorkOrderServiceError('Work order not found.', 404);
    }

    const wo = woRes.rows[0];

    // Manager scope check
    if (user.role === 'manager') {
      if (!user.plant_id) {
        throw new WorkOrderServiceError('Forbidden: Valid plant facility assignment required.', 403);
      }
      if (user.plant_id !== wo.plant_id) {
        throw new WorkOrderServiceError('Unauthorized for this plant.', 403);
      }
      if (user.shop_id && user.shop_id !== wo.shop_id) {
        throw new WorkOrderServiceError('Unauthorized for this shop.', 403);
      }
    }

    // State machine: must be submitted for verification before manager can verify!
    if (wo.status !== 'submitted_verification') {
      throw new WorkOrderServiceError(
        `Work order must be in 'submitted_verification' status for manager verification. Current status is '${wo.status}'.`,
        400
      );
    }

    if (result === 'APPROVED') {
      // Calculate dual downtime metrics
      const breakdownStart = wo.breakdown_time || wo.reported_time || wo.created_at;
      const totalDowntimeMinutes = Math.max(1, Math.round((Date.now() - new Date(breakdownStart).getTime()) / 60000));

      const updateSql = `
        UPDATE work_orders
        SET status = 'verified_closed',
            manager_verified_time = NOW(),
            machine_restored_time = NOW(),
            total_downtime_minutes = $1,
            manager_verification_remarks = $2,
            updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `;
      const updateRes = await client.query(updateSql, [
        totalDowntimeMinutes,
        remarks || 'Quality inspection passed. Machine restored to production.',
        id,
      ]);
      const verifiedWo = updateRes.rows[0];

      // Safe machine status restoration: check if other active issues exist
      const activeComplaintsRes = await client.query(
        `SELECT COUNT(*)::int as count
         FROM maintenance_requests
         WHERE machine_id = $1 AND id != $2 AND status NOT IN ('closed', 'rejected')`,
        [wo.machine_id, wo.complaint_id || '00000000-0000-0000-0000-000000000000']
      );
      const otherComplaints = activeComplaintsRes.rows[0]?.count || 0;

      const activeWoRes = await client.query(
        `SELECT COUNT(*)::int as count
         FROM work_orders
         WHERE machine_id = $1 AND id != $2 AND status NOT IN ('verified_closed', 'completed')`,
        [wo.machine_id, id]
      );
      const otherWorkOrders = activeWoRes.rows[0]?.count || 0;

      if (otherComplaints === 0 && otherWorkOrders === 0) {
        await client.query(
          `UPDATE machines SET status = 'running', updated_at = NOW() WHERE id = $1`,
          [wo.machine_id]
        );
      }

      // Close linked complaint
      if (wo.complaint_id) {
        await client.query(
          `UPDATE maintenance_requests SET status = 'closed', updated_at = NOW() WHERE id = $1`,
          [wo.complaint_id]
        );
      }

      // Event & Audit log
      await recordWorkOrderEvent(
        client,
        id,
        'VERIFIED_CLOSED',
        user.id,
        remarks || 'Work order verified and approved. Machine restored.'
      );

      await recordAuditLog(
        client,
        id,
        'WORK_ORDER_VERIFIED',
        user.id,
        { status: wo.status },
        { status: 'verified_closed', total_downtime_minutes: totalDowntimeMinutes }
      );

      // Notify technician
      if (wo.assigned_technician_id) {
        await sendNotificationAndEmit(
          client,
          wo.assigned_technician_id,
          'Work Order Approved & Closed',
          `Work Order ${wo.wo_number} has been verified and closed by management. Total Downtime: ${totalDowntimeMinutes}m.`,
          'info',
          `/work-orders/${id}`,
          'work_order:closed',
          {
            workOrder: verifiedWo,
            message: `Work Order ${wo.wo_number} verified and closed.`,
          },
          ioInstance
        );
      }

      // Stage 5: Notify reporting operator that the repair has been verified
      if (wo.complaint_id) {
        try {
          const compRes = await client.query(
            `SELECT id, reported_by_id, complaint_number FROM maintenance_requests WHERE id = $1`,
            [wo.complaint_id]
          );
          if (compRes.rows && compRes.rows.length > 0 && compRes.rows[0].reported_by_id) {
            const operatorId = compRes.rows[0].reported_by_id;
            const machineLabel = wo.machine_code || 'Machine';
            await sendNotificationAndEmit(
              client,
              operatorId,
              'Machine Repair Verified',
              `Your reported machine issue has been repaired and verified. Machine: ${machineLabel}. Work Order: ${wo.wo_number}.`,
              'info',
              `/operator/dashboard?ticketId=${wo.complaint_id}`,
              'repair:verified',
              {
                workOrder: verifiedWo,
                complaint_id: wo.complaint_id,
                machine_code: machineLabel,
                message: `Your reported machine issue has been repaired and verified. Machine: ${machineLabel}. Work Order: ${wo.wo_number}.`,
              },
              ioInstance
            );
          }
        } catch {
          // Non-blocking notification for operator
        }
      }

      await client.query('COMMIT');
      return verifiedWo;
    } else {
      // REJECTED -> Rework Required
      if (!remarks || typeof remarks !== 'string' || remarks.trim().length === 0) {
        throw new WorkOrderServiceError('Remarks explaining the rejection reason are mandatory when requesting rework.', 400);
      }

      const updateSql = `
        UPDATE work_orders
        SET status = 'rework_required',
            manager_verification_remarks = $1,
            updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;
      const updateRes = await client.query(updateSql, [remarks.trim(), id]);
      const reworkWo = updateRes.rows[0];

      // Machine remains under maintenance
      await client.query(
        `UPDATE machines SET status = 'under_maintenance', updated_at = NOW() WHERE id = $1`,
        [wo.machine_id]
      );

      await recordWorkOrderEvent(
        client,
        id,
        'REWORK_REQUIRED',
        user.id,
        remarks.trim()
      );

      await recordAuditLog(
        client,
        id,
        'WORK_ORDER_REJECTED',
        user.id,
        { status: wo.status },
        { status: 'rework_required', remarks: remarks.trim() }
      );

      // Notify technician
      if (wo.assigned_technician_id) {
        await sendNotificationAndEmit(
          client,
          wo.assigned_technician_id,
          'Work Order Rework Requested',
          `Work Order ${wo.wo_number} was rejected during verification: ${remarks.trim()}. Please rework.`,
          'alert',
          `/work-orders/${id}`,
          'work_order:rework_required',
          {
            workOrder: reworkWo,
            message: `Work Order ${wo.wo_number} returned for rework: ${remarks.trim()}`,
          },
          ioInstance
        );
      }

      await client.query('COMMIT');
      return reworkWo;
    }
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // safe rollback
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Reopen a closed or completed work order
 */
export async function reopenWorkOrderService(
  id: string,
  input: ReopenWorkOrderInput,
  user?: AuthenticatedUser,
  dbPool: DbPoolLike = activePool,
  ioInstance?: any
): Promise<any> {
  if (!user) {
    throw new WorkOrderServiceError('Authentication required.', 401);
  }

  if (!['admin', 'manager'].includes(user.role)) {
    throw new WorkOrderServiceError('Only managers and admins can reopen work orders.', 403);
  }

  if (!isUUID(id)) {
    throw new WorkOrderServiceError('Invalid work order ID.', 400);
  }

  const { reason } = input;
  if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
    throw new WorkOrderServiceError('Reason for reopening the work order is mandatory.', 400);
  }

  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');

    const woRes = await client.query(
      `SELECT wo.*, m.machine_code, m.id AS machine_id, s.plant_id, m.shop_id
       FROM work_orders wo
       JOIN machines m ON wo.machine_id = m.id
       JOIN shops s ON m.shop_id = s.id
       WHERE wo.id = $1
       FOR UPDATE OF wo`,
      [id]
    );

    if (woRes.rows.length === 0) {
      throw new WorkOrderServiceError('Work order not found.', 404);
    }

    const wo = woRes.rows[0];

    // Manager scope check
    if (user.role === 'manager') {
      if (!user.plant_id) {
        throw new WorkOrderServiceError('Forbidden: Valid plant facility assignment required.', 403);
      }
      if (user.plant_id !== wo.plant_id) {
        throw new WorkOrderServiceError('Unauthorized for this plant.', 403);
      }
      if (user.shop_id && user.shop_id !== wo.shop_id) {
        throw new WorkOrderServiceError('Unauthorized for this shop.', 403);
      }
    }

    // Only closed or completed work orders can be reopened
    if (!['verified_closed', 'completed'].includes(wo.status)) {
      throw new WorkOrderServiceError(
        `Only closed or completed work orders can be reopened. Current status: '${wo.status}'.`,
        400
      );
    }

    const updateSql = `
      UPDATE work_orders
      SET status = 'reopened',
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const updateRes = await client.query(updateSql, [id]);
    const reopenedWo = updateRes.rows[0];

    // Restore machine status to under_maintenance
    await client.query(
      `UPDATE machines SET status = 'under_maintenance', updated_at = NOW() WHERE id = $1`,
      [wo.machine_id]
    );

    // Reopen linked complaint
    if (wo.complaint_id) {
      await client.query(
        `UPDATE maintenance_requests SET status = 'work_order_created', updated_at = NOW() WHERE id = $1`,
        [wo.complaint_id]
      );
    }

    // Events & Audit
    await recordWorkOrderEvent(
      client,
      id,
      'REOPENED',
      user.id,
      `Work order reopened: ${reason.trim()}`
    );

    await recordAuditLog(
      client,
      id,
      'WORK_ORDER_REOPENED',
      user.id,
      { status: wo.status },
      { status: 'reopened', reason: reason.trim() }
    );

    // Notify technician
    if (wo.assigned_technician_id) {
      await sendNotificationAndEmit(
        client,
        wo.assigned_technician_id,
        'Work Order Reopened',
        `Work Order ${wo.wo_number} was reopened by management: ${reason.trim()}.`,
        'alert',
        `/work-orders/${id}`,
        'work_order:reopened',
        {
          workOrder: reopenedWo,
          message: `Work Order ${wo.wo_number} reopened.`,
        },
        ioInstance
      );
    }

    await client.query('COMMIT');
    return reopenedWo;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // safe rollback
    }
    throw err;
  } finally {
    client.release();
  }
}
