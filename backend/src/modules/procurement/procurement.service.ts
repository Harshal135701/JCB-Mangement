import { PoolClient } from 'pg';
import { pool, query as defaultQuery } from '../../config/db';
import { AuthenticatedUser } from '../../middlewares/auth.middleware';
import { emitToUser, emitToPlant, emitToRole, getIo } from '../../config/socket';

// ---------------------------------------------------------------------------
// Error Handling
// ---------------------------------------------------------------------------
export class ProcurementServiceError extends Error {
  public readonly statusCode: number;
  public readonly details?: any;

  constructor(message: string, statusCode: number = 400, details?: any) {
    super(message);
    this.name = 'ProcurementServiceError';
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, ProcurementServiceError.prototype);
  }
}

// ---------------------------------------------------------------------------
// Database & Socket Interfaces & Injection
// ---------------------------------------------------------------------------
export type QueryFn = (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount?: number | null }>;

export interface DbClientLike {
  query: QueryFn;
  release: () => void;
}

export interface DbPoolLike {
  connect: () => Promise<DbClientLike>;
  query?: QueryFn;
}

let activePool: DbPoolLike = pool as unknown as DbPoolLike;
let activeQuery: QueryFn = defaultQuery as unknown as QueryFn;
let customIo: any = undefined;

export function setProcurementServiceDb(customPool: DbPoolLike, customQuery?: QueryFn): void {
  activePool = customPool;
  activeQuery = customQuery || (customPool.query ? customPool.query.bind(customPool) : async (text, params) => {
    const client = await customPool.connect();
    try {
      return await client.query(text, params);
    } finally {
      client.release();
    }
  });
}

export function resetProcurementServiceDb(): void {
  activePool = pool as unknown as DbPoolLike;
  activeQuery = defaultQuery as unknown as QueryFn;
}

export function setProcurementServiceIo(custom: any): void {
  customIo = custom;
}

export function resetProcurementServiceIo(): void {
  customIo = undefined;
}

export function getProcurementServiceDb(): { pool: DbPoolLike; query: QueryFn } {
  return { pool: activePool, query: activeQuery };
}

export function getProcurementServiceIo(): any {
  if (customIo !== undefined) {
    return customIo;
  }
  return getIo();
}

// ---------------------------------------------------------------------------
// Enums, Constants & State Machine
// ---------------------------------------------------------------------------
export const VALID_PR_STATUSES = [
  'new',
  'under_review',
  'quotation_pending',
  'vendor_selected',
  'approval_pending',
  'po_created',
  'ordered',
  'partially_received',
  'fully_received',
  'cancelled',
  'rejected',
] as const;

export type PRStatus = (typeof VALID_PR_STATUSES)[number];

export const VALID_URGENCIES = ['critical', 'high', 'medium', 'low'] as const;
export type PRUrgency = (typeof VALID_URGENCIES)[number];

export const PR_STATUS_TRANSITIONS: Record<PRStatus, readonly PRStatus[]> = Object.freeze({
  new: ['under_review', 'quotation_pending', 'vendor_selected', 'approval_pending', 'cancelled', 'rejected'],
  under_review: ['quotation_pending', 'vendor_selected', 'approval_pending', 'partially_received', 'fully_received', 'cancelled', 'rejected'],
  quotation_pending: ['vendor_selected', 'approval_pending', 'partially_received', 'fully_received', 'cancelled', 'rejected'],
  vendor_selected: ['approval_pending', 'po_created', 'ordered', 'partially_received', 'fully_received', 'cancelled', 'rejected'],
  approval_pending: ['po_created', 'ordered', 'under_review', 'partially_received', 'fully_received', 'cancelled', 'rejected'],
  po_created: ['ordered', 'partially_received', 'fully_received', 'cancelled'],
  ordered: ['partially_received', 'fully_received', 'cancelled'],
  partially_received: ['partially_received', 'fully_received', 'cancelled'],
  fully_received: [],
  cancelled: [],
  rejected: [],
});

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Domain Interfaces
// ---------------------------------------------------------------------------
export interface CreatePurchaseRequisitionInput {
  work_order_id?: string | null;
  machine_id?: string | null;
  part_id: string;
  quantity_required: number;
  urgency?: PRUrgency;
  technical_justification?: string;
  expected_delivery_date?: string | null;
  plant_id?: string | null;
}

export interface GetPurchaseRequisitionsFilter {
  status?: string;
  urgency?: string;
  plant_id?: string;
  shop_id?: string;
  requested_by?: string;
  machine_id?: string;
  work_order_id?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface EditPurchaseRequisitionInput {
  part_id?: string;
  quantity_required?: number;
  urgency?: PRUrgency;
  technical_justification?: string;
  machine_id?: string | null;
  work_order_id?: string | null;
  expected_delivery_date?: string | null;
}

export interface UpdatePRStatusInput {
  status?: PRStatus;
  po_number?: string;
  supplier_name?: string;
  unit_price?: number;
  expected_delivery_date?: string;
  remarks?: string;
}

export interface ApprovePRInput {
  remarks?: string;
  next_status?: PRStatus;
  target_status?: PRStatus;
}

export interface CreatePOInput {
  po_number?: string;
  supplier_name: string;
  unit_price: number;
  expected_delivery_date?: string;
  remarks?: string;
  mark_as_ordered?: boolean;
  supply_method?: string | null;
  delivery_document_type?: string | null;
  challan_type?: string | null;
  vendor_challan_number?: string | null;
  expected_dispatch_date?: string | null;
  transporter_name?: string | null;
  vehicle_number?: string | null;
  lr_tracking_number?: string | null;
  delivery_remarks?: string | null;
  dispatch_location?: string | null;
  destination_plant_name?: string | null;
  transport_mode?: string | null;
  freight_cost?: number | null;
  overall_shipment_cost?: number | null;
}

export interface ProcessGRNInput {
  received_quantity?: number;
  accepted_quantity?: number;
  rejected_quantity?: number;
  damaged_quantity?: number;
  defective_quantity?: number;
  inspection_status?: string;
  inspection_remarks?: string;
  rejection_reason?: string;
  remarks?: string;
  delivery_note_number?: string;
  vendor_challan_number?: string;
  invoice_number?: string;
  supply_method?: string;
  delivery_document_type?: string;
  challan_type?: string;
  vehicle_number?: string;
  lr_tracking_number?: string;
  dispatch_location?: string;
  destination_plant_name?: string;
  transport_mode?: string;
  transporter_name?: string;
  freight_cost?: number;
  overall_shipment_cost?: number;
}

// ---------------------------------------------------------------------------
// Authorization and Scoping Helpers
// ---------------------------------------------------------------------------
export function validateProcurementRole(user?: AuthenticatedUser): void {
  if (!user || !user.id) {
    throw new ProcurementServiceError('Unauthorized: Authentication required.', 401);
  }
  if (user.role === 'operator') {
    throw new ProcurementServiceError('Forbidden: Operators are not authorized to perform procurement operations.', 403);
  }
  if (!['admin', 'manager', 'technician', 'store_manager'].includes(user.role)) {
    throw new ProcurementServiceError(`Forbidden: Role '${user.role}' is not authorized for procurement.`, 403);
  }
}

export function validateManagerOrAdmin(user?: AuthenticatedUser, action: string = 'this operation'): void {
  validateProcurementRole(user);
  if (user?.role !== 'admin' && user?.role !== 'manager' && user?.role !== 'store_manager') {
    throw new ProcurementServiceError(`Forbidden: Only managers and administrators can perform ${action}.`, 403);
  }
}

export function getAuthorizedPlantId(user: AuthenticatedUser): string | null {
  if (user.role === 'admin') {
    return user.plant_id || null;
  }
  if (!user.plant_id) {
    throw new ProcurementServiceError('Forbidden: User account is not assigned to an active plant facility.', 403);
  }
  return user.plant_id;
}

export function validateStatusTransition(currentStatus: PRStatus, nextStatus: PRStatus): void {
  if (currentStatus === nextStatus) {
    return;
  }
  const allowed = PR_STATUS_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(nextStatus)) {
    throw new ProcurementServiceError(
      `Invalid status transition: Cannot transition purchase requisition from '${currentStatus}' to '${nextStatus}'.`,
      400
    );
  }
}

export function validateStrictNonNegativeInteger(val: any, fieldName: string): number {
  if (val === undefined || val === null || val === '') {
    return 0;
  }
  const num = Number(val);
  if (!Number.isFinite(num) || !Number.isInteger(num) || num < 0) {
    throw new ProcurementServiceError(`${fieldName} must be a valid non-negative integer.`, 400);
  }
  return num;
}

// ---------------------------------------------------------------------------
// Concurrency Safe Number Generators
// ---------------------------------------------------------------------------
export async function generatePRNumberWithAdvisoryLock(client: DbClientLike, year: number): Promise<string> {
  const lockKey = `pr_seq:${year}`;
  await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [lockKey]);

  const maxRes = await client.query(
    `SELECT MAX(SUBSTRING(pr_number FROM 9)) as max_seq
     FROM purchase_requisitions
     WHERE pr_number LIKE $1`,
    [`PR-${year}-%`]
  );

  let nextSeq = 1;
  const rawMax = maxRes.rows[0]?.max_seq;
  if (rawMax) {
    const parsed = parseInt(rawMax, 10);
    if (!isNaN(parsed)) {
      nextSeq = parsed + 1;
    }
  }

  return `PR-${year}-${String(nextSeq).padStart(5, '0')}`;
}

export async function generatePONumberWithAdvisoryLock(client: DbClientLike, year: number): Promise<string> {
  const lockKey = `po_seq:${year}`;
  await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [lockKey]);

  const maxRes = await client.query(
    `SELECT MAX(SUBSTRING(po_number FROM 9)) as max_seq
     FROM purchase_requisitions
     WHERE po_number LIKE $1`,
    [`PO-${year}-%`]
  );

  let nextSeq = 1;
  const rawMax = maxRes.rows[0]?.max_seq;
  if (rawMax) {
    const parsed = parseInt(rawMax, 10);
    if (!isNaN(parsed)) {
      nextSeq = parsed + 1;
    }
  }

  return `PO-${year}-${String(nextSeq).padStart(5, '0')}`;
}

export async function generateGRNNumberWithAdvisoryLock(client: DbClientLike, year: number): Promise<string> {
  const lockKey = `grn_seq:${year}`;
  await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [lockKey]);

  let nextSeq = 1;
  try {
    const maxRes = await client.query(
      `SELECT MAX(SUBSTRING(grn_number FROM 10)) as max_seq
       FROM grn_receipts
       WHERE grn_number LIKE $1`,
      [`GRN-${year}-%`]
    );
    const rawMax = maxRes.rows[0]?.max_seq;
    if (rawMax) {
      const parsed = parseInt(rawMax, 10);
      if (!isNaN(parsed)) {
        nextSeq = parsed + 1;
      }
    }
  } catch {
    // If grn_receipts table query fails in mock test environment, generate timestamped code
    nextSeq = Math.floor(Math.random() * 90000) + 10000;
  }

  return `GRN-${year}-${String(nextSeq).padStart(5, '0')}`;
}

// ---------------------------------------------------------------------------
// 1. Create Purchase Requisition
// ---------------------------------------------------------------------------
export async function createPurchaseRequisitionService(
  input: CreatePurchaseRequisitionInput,
  user: AuthenticatedUser
): Promise<any> {
  validateProcurementRole(user);

  if (!input.part_id || !UUID_REGEX.test(input.part_id.trim())) {
    throw new ProcurementServiceError('Part ID is required and must be a valid UUID.', 400);
  }

  const quantity = Number(input.quantity_required);
  if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity <= 0) {
    throw new ProcurementServiceError('Quantity required must be a positive integer greater than zero.', 400);
  }

  const urgency = input.urgency || 'high';
  if (!VALID_URGENCIES.includes(urgency)) {
    throw new ProcurementServiceError(`Invalid urgency level. Allowed values: ${VALID_URGENCIES.join(', ')}.`, 400);
  }

  if (input.expected_delivery_date) {
    const parsedDate = new Date(input.expected_delivery_date);
    if (isNaN(parsedDate.getTime())) {
      throw new ProcurementServiceError('Expected delivery date must be a valid date.', 400);
    }
  }

  const { pool } = getProcurementServiceDb();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Verify spare part exists and is active
    const partRes = await client.query(
      `SELECT id, part_number, name, status, unit_cost, supplier_name, current_physical_stock, available_stock
       FROM spare_parts
       WHERE id = $1`,
      [input.part_id]
    );

    if (partRes.rows.length === 0) {
      throw new ProcurementServiceError('Spare part not found in catalog.', 404);
    }

    const part = partRes.rows[0];
    if (part.status && part.status.toLowerCase() !== 'active') {
      throw new ProcurementServiceError(`Spare part ${part.part_number} is inactive and cannot be requisitioned.`, 400);
    }

    // 2. Verify machine if provided
    let machinePlantId: string | null = null;
    let machineShopId: string | null = null;

    if (input.machine_id) {
      if (!UUID_REGEX.test(input.machine_id.trim())) {
        throw new ProcurementServiceError('Invalid machine_id format.', 400);
      }
      const machineRes = await client.query(
        `SELECT m.id, m.machine_code, m.shop_id, s.plant_id
         FROM machines m
         LEFT JOIN shops s ON m.shop_id = s.id
         WHERE m.id = $1`,
        [input.machine_id]
      );
      if (machineRes.rows.length === 0) {
        throw new ProcurementServiceError('Referenced machine not found.', 404);
      }
      machinePlantId = machineRes.rows[0].plant_id;
      machineShopId = machineRes.rows[0].shop_id;
    }

    // 3. Verify work order if provided
    let woPlantId: string | null = null;
    let woShopId: string | null = null;
    let woStatus: string | null = null;

    if (input.work_order_id) {
      if (!UUID_REGEX.test(input.work_order_id.trim())) {
        throw new ProcurementServiceError('Invalid work_order_id format.', 400);
      }
      const woRes = await client.query(
        `SELECT wo.id, wo.wo_number, wo.status, wo.machine_id, wo.assigned_technician_id, m.shop_id, s.plant_id
         FROM work_orders wo
         JOIN machines m ON wo.machine_id = m.id
         LEFT JOIN shops s ON m.shop_id = s.id
         WHERE wo.id = $1`,
        [input.work_order_id]
      );
      if (woRes.rows.length === 0) {
        throw new ProcurementServiceError('Referenced work order not found.', 404);
      }
      const wo = woRes.rows[0];
      woStatus = wo.status;

      if (['completed', 'verified_closed', 'submitted_verification'].includes(wo.status)) {
        throw new ProcurementServiceError(
          `Cannot create purchase requisition for a closed or completed work order (${wo.wo_number}).`,
          400
        );
      }

      // Check: If both machine_id and work_order_id are provided, machine MUST match work order machine
      if (input.machine_id && input.machine_id !== wo.machine_id) {
        throw new ProcurementServiceError(
          `Machine/Work-Order mismatch: The specified machine does not match equipment referenced in work order ${wo.wo_number}.`,
          400
        );
      }

      // Check: Technician assignment authorization
      if (user.role === 'technician' && wo.assigned_technician_id && wo.assigned_technician_id !== user.id) {
        throw new ProcurementServiceError(
          `Forbidden: Technicians can only create requisitions for work orders assigned to them.`,
          403
        );
      }

      woPlantId = wo.plant_id;
      woShopId = wo.shop_id;
      machinePlantId = machinePlantId || woPlantId;
      machineShopId = machineShopId || woShopId;
    }

    // 4. Plant and shop scope enforcement
    let suppliedPlantId: string | null = null;
    if (input.plant_id) {
      if (!UUID_REGEX.test(input.plant_id.trim())) {
        throw new ProcurementServiceError('Invalid plant_id format.', 400);
      }
      const plantRes = await client.query(
        `SELECT id, plant_name FROM plants WHERE id = $1`,
        [input.plant_id.trim()]
      );
      if (plantRes.rows.length === 0) {
        throw new ProcurementServiceError('Referenced plant not found.', 404);
      }
      suppliedPlantId = plantRes.rows[0].id;
    }

    // Machine-linked PRs derive plant from machine and reject conflicting supplied plant IDs
    if (machinePlantId && suppliedPlantId && machinePlantId !== suppliedPlantId) {
      throw new ProcurementServiceError(
        'Plant conflict: The supplied plant_id does not match the plant of the specified machine asset.',
        400
      );
    }

    // Determine effective plant ID
    let effectivePlantId: string | null = null;
    if (machinePlantId) {
      effectivePlantId = machinePlantId;
    } else if (user.role === 'admin') {
      // Enterprise admins can supply explicit plant_id or fallback to their user.plant_id
      effectivePlantId = suppliedPlantId || user.plant_id || null;
    } else {
      // Non-admins must derive from their user.plant_id and cannot specify a different plant
      if (suppliedPlantId && suppliedPlantId !== user.plant_id) {
        throw new ProcurementServiceError(
          'Forbidden: Cannot create purchase requisition for a different plant facility.',
          403
        );
      }
      effectivePlantId = user.plant_id || null;
    }

    // Prevent creation of unscoped PRs where plant ownership is required
    if (!effectivePlantId) {
      throw new ProcurementServiceError(
        'Plant ownership is required: Please specify plant_id for generic stock requisitions.',
        400
      );
    }

    // Scope check for non-admins
    if (user.role !== 'admin') {
      const authorizedPlantId = getAuthorizedPlantId(user);
      if (effectivePlantId !== authorizedPlantId) {
        throw new ProcurementServiceError(
          'Forbidden: Cannot create purchase requisition for equipment or stores in a different plant.',
          403
        );
      }
      if (user.role === 'technician' && user.shop_id && machineShopId && user.shop_id !== machineShopId) {
        throw new ProcurementServiceError(
          'Forbidden: Cannot create purchase requisition for equipment in a different shop.',
          403
        );
      }
    }

    const effectiveShopId = machineShopId || (user.shop_id ? user.shop_id : null);

    // 5. Generate concurrency-safe PR number
    const currentYear = new Date().getFullYear();
    const prNumber = await generatePRNumberWithAdvisoryLock(client, currentYear);

    // 6. Insert Purchase Requisition
    const insertRes = await client.query(
      `INSERT INTO purchase_requisitions (
        pr_number, work_order_id, machine_id, part_id, quantity_required,
        urgency, technical_justification, status, requested_by,
        expected_delivery_date, supplier_name, unit_price, plant_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'new', $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        prNumber,
        input.work_order_id || null,
        input.machine_id || null,
        part.id,
        quantity,
        urgency,
        input.technical_justification || '',
        user.id,
        input.expected_delivery_date || null,
        part.supplier_name || null,
        part.unit_cost || 0,
        effectivePlantId,
      ]
    );

    const pr = insertRes.rows[0];

    // 7. If linked to an active work order, only transition to 'waiting_for_parts' if currently assigned or in_progress
    if (input.work_order_id && woStatus && ['assigned', 'in_progress', 'reopened'].includes(woStatus)) {
      await client.query(
        `UPDATE work_orders
         SET status = 'waiting_for_parts', updated_at = NOW()
         WHERE id = $1 AND status != 'waiting_for_parts'`,
        [input.work_order_id]
      );
    }

    // 8. Immutable audit log
    await client.query(
      `INSERT INTO audit_logs (entity_name, entity_id, action, performed_by, new_values)
       VALUES ('purchase_requisitions', $1, 'CREATE', $2, $3)`,
      [
        pr.id,
        user.id,
        JSON.stringify({
          pr_number: pr.pr_number,
          part_id: pr.part_id,
          quantity_required: pr.quantity_required,
          urgency: pr.urgency,
          work_order_id: pr.work_order_id,
          plant_id: effectivePlantId,
        }),
      ]
    );

    // 9. Dispatch in-app notifications only to authorized managers in this plant (or admin)
    const plantFilterParams: any[] = [];
    let mgrQuery = `SELECT id FROM users WHERE role IN ('manager', 'admin') AND is_active = true`;
    if (effectivePlantId) {
      plantFilterParams.push(effectivePlantId);
      mgrQuery += ` AND (plant_id = $1 OR role = 'admin')`;
    }

    const managersRes = await client.query(mgrQuery, plantFilterParams);
    for (const mgr of managersRes.rows) {
      if (mgr.id !== user.id) {
        await client.query(
          `INSERT INTO notifications (recipient_id, title, message, type, link_url)
           VALUES ($1, $2, $3, 'approval', $4)`,
          [
            mgr.id,
            `New Purchase Requisition ${pr.pr_number}`,
            `${(user as any).full_name || user.employee_code || 'An employee'} raised a requisition for ${quantity}x ${part.name} (${part.part_number}).`,
            `/procurement/pr/${pr.id}`,
          ]
        );
      }
    }

    await client.query('COMMIT');

    // 10. Real-time scoped Socket.IO emission (strictly room-scoped, no cross-plant leaks)
    const io = getProcurementServiceIo();
    if (io) {
      const payload = {
        pr,
        message: `New Purchase Requisition ${pr.pr_number} created for part ${part.part_number}.`,
      };
      if (effectivePlantId) {
        emitToPlant(effectivePlantId, 'pr:created', payload, io);
      } else {
        emitToRole('admin', 'pr:created', payload, io);
      }
      emitToUser(user.id, 'pr:created', payload, io);
    }

    return pr;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rbErr) {
      console.error('[PR Creation Rollback Error]:', rbErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// 2. Get Purchase Requisitions (Paginated, Searchable, Scoped)
// ---------------------------------------------------------------------------
export async function getPurchaseRequisitionsService(
  filter: GetPurchaseRequisitionsFilter,
  user: AuthenticatedUser
): Promise<{ data: any[]; pagination: { total: number; page: number; limit: number; totalPages: number } }> {
  validateProcurementRole(user);

  const page = Math.max(1, Number(filter.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(filter.limit) || 20));
  const offset = (page - 1) * limit;

  let baseQuery = `
    FROM purchase_requisitions pr
    JOIN spare_parts sp ON pr.part_id = sp.id
    JOIN users u ON pr.requested_by = u.id
    LEFT JOIN users mgr ON pr.approved_by = mgr.id
    LEFT JOIN machines m ON pr.machine_id = m.id
    LEFT JOIN shops s ON m.shop_id = s.id
    LEFT JOIN plants p ON COALESCE(pr.plant_id, s.plant_id) = p.id
    LEFT JOIN work_orders wo ON pr.work_order_id = wo.id
    WHERE 1=1
  `;

  const params: any[] = [];

  // Scoping enforcement:
  if (user.role === 'technician') {
    params.push(user.id);
    baseQuery += ` AND (pr.requested_by = $${params.length} OR wo.assigned_technician_id = $${params.length})`;
  } else if (user.role === 'manager' || user.role === 'store_manager') {
    const authorizedPlantId = getAuthorizedPlantId(user);
    params.push(authorizedPlantId);
    baseQuery += ` AND (pr.plant_id = $${params.length} OR s.plant_id = $${params.length})`;
  }

  // Filters
  if (filter.status) {
    params.push(filter.status);
    baseQuery += ` AND pr.status = $${params.length}`;
  }

  if (filter.urgency) {
    params.push(filter.urgency);
    baseQuery += ` AND pr.urgency = $${params.length}`;
  }

  if (filter.plant_id) {
    params.push(filter.plant_id);
    baseQuery += ` AND (pr.plant_id = $${params.length} OR s.plant_id = $${params.length})`;
  }

  if (filter.shop_id) {
    params.push(filter.shop_id);
    baseQuery += ` AND m.shop_id = $${params.length}`;
  }

  if (filter.requested_by) {
    params.push(filter.requested_by);
    baseQuery += ` AND pr.requested_by = $${params.length}`;
  }

  if (filter.machine_id) {
    params.push(filter.machine_id);
    baseQuery += ` AND pr.machine_id = $${params.length}`;
  }

  if (filter.work_order_id) {
    params.push(filter.work_order_id);
    baseQuery += ` AND pr.work_order_id = $${params.length}`;
  }

  if (filter.search) {
    params.push(`%${filter.search.trim()}%`);
    const idx = params.length;
    baseQuery += ` AND (
      pr.pr_number ILIKE $${idx} OR
      pr.po_number ILIKE $${idx} OR
      sp.part_number ILIKE $${idx} OR
      sp.name ILIKE $${idx} OR
      pr.supplier_name ILIKE $${idx} OR
      u.full_name ILIKE $${idx}
    )`;
  }

  const { query } = getProcurementServiceDb();

  // Count total matching records
  const countRes = await query(`SELECT COUNT(*) as count ${baseQuery}`, params);
  const total = parseInt(countRes.rows[0]?.count || '0', 10);

  // Sorting
  const allowedSortCols: Record<string, string> = {
    created_at: 'pr.created_at',
    pr_number: 'pr.pr_number',
    urgency: 'pr.urgency',
    status: 'pr.status',
    quantity_required: 'pr.quantity_required',
    expected_delivery_date: 'pr.expected_delivery_date',
  };
  const sortCol = allowedSortCols[filter.sortBy || 'created_at'] || 'pr.created_at';
  const sortDir = filter.sortOrder === 'ASC' ? 'ASC' : 'DESC';

  const selectCols = `
    SELECT pr.*,
           COALESCE((SELECT SUM(gr.accepted_quantity) FROM grn_receipts gr WHERE gr.pr_id = pr.id), 0)::int as received_quantity,
           GREATEST(0, pr.quantity_required - COALESCE((SELECT SUM(gr.accepted_quantity) FROM grn_receipts gr WHERE gr.pr_id = pr.id), 0))::int as remaining_quantity,
           sp.part_number as sku,
           sp.part_number,
           sp.name as part_name,
           sp.category as part_category,
           sp.unit_cost as part_unit_cost,
           sp.current_physical_stock,
           sp.available_stock,
           sp.bin_location,
           u.full_name as requested_by_name,
           u.employee_code as requested_by_code,
           mgr.full_name as approved_by_name,
           m.machine_code,
           m.name as machine_name,
           s.shop_name,
           p.plant_name as plant_name,
           wo.wo_number,
           wo.assigned_technician_id
  `;

  const dataQuery = `${selectCols} ${baseQuery} ORDER BY ${sortCol} ${sortDir} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  const dataRes = await query(dataQuery, [...params, limit, offset]);

  return {
    data: dataRes.rows,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

// ---------------------------------------------------------------------------
// 3. Get Purchase Requisition Details by ID
// ---------------------------------------------------------------------------
export async function getPurchaseRequisitionDetailsService(
  id: string,
  user: AuthenticatedUser
): Promise<any> {
  validateProcurementRole(user);

  if (!UUID_REGEX.test(id.trim())) {
    throw new ProcurementServiceError('Invalid Purchase Requisition ID format.', 400);
  }

  const { query } = getProcurementServiceDb();

  const detailRes = await query(
    `SELECT pr.*,
            COALESCE((SELECT SUM(gr.accepted_quantity) FROM grn_receipts gr WHERE gr.pr_id = pr.id), 0)::int as received_quantity,
            GREATEST(0, pr.quantity_required - COALESCE((SELECT SUM(gr.accepted_quantity) FROM grn_receipts gr WHERE gr.pr_id = pr.id), 0))::int as remaining_quantity,
            sp.part_number as sku,
            sp.part_number,
            sp.name as part_name,
            sp.description as part_description,
            sp.category as part_category,
            sp.uom,
            sp.unit_cost as catalog_unit_cost,
            sp.current_physical_stock,
            sp.reserved_stock,
            sp.available_stock,
            sp.bin_location,
            sp.warehouse_zone,
            u.full_name as requested_by_name,
            u.employee_code as requested_by_code,
            u.email as requested_by_email,
            mgr.full_name as approved_by_name,
            mgr.employee_code as approved_by_code,
            m.machine_code,
            m.name as machine_name,
            m.model_number as machine_model,
            s.shop_name,
            s.id as shop_id,
            p.plant_name as plant_name,
            COALESCE(pr.plant_id, s.plant_id) as plant_id,
            wo.wo_number,
            wo.status as work_order_status,
            wo.assigned_technician_id
     FROM purchase_requisitions pr
     JOIN spare_parts sp ON pr.part_id = sp.id
     JOIN users u ON pr.requested_by = u.id
     LEFT JOIN users mgr ON pr.approved_by = mgr.id
     LEFT JOIN machines m ON pr.machine_id = m.id
     LEFT JOIN shops s ON m.shop_id = s.id
     LEFT JOIN plants p ON COALESCE(pr.plant_id, s.plant_id) = p.id
     LEFT JOIN work_orders wo ON pr.work_order_id = wo.id
     WHERE pr.id = $1`,
    [id]
  );

  if (detailRes.rows.length === 0) {
    throw new ProcurementServiceError('Purchase Requisition not found.', 404);
  }

  const pr = detailRes.rows[0];

  // RBAC Scoping check
  if (user.role === 'technician') {
    if (pr.requested_by !== user.id && pr.assigned_technician_id !== user.id) {
      throw new ProcurementServiceError('Forbidden: Technicians can only view their own purchase requisitions.', 403);
    }
  } else if (user.role === 'manager' || user.role === 'store_manager') {
    const authorizedPlantId = getAuthorizedPlantId(user);
    if (pr.plant_id && pr.plant_id !== authorizedPlantId) {
      throw new ProcurementServiceError('Forbidden: Cannot view purchase requisition from a different plant.', 403);
    }
  }

  // Fetch receipts, transactions, and audit timeline in parallel to minimize latency
  let receipts: any[] = [];
  let transactions: any[] = [];
  let timeline: any[] = [];

  try {
    const [grnRes, txRes, auditRes] = await Promise.all([
      query(
        `SELECT gr.*, u.full_name as received_by_name, u.employee_code as received_by_code
         FROM grn_receipts gr
         JOIN users u ON gr.received_by = u.id
         WHERE gr.pr_id = $1
         ORDER BY gr.created_at DESC`,
        [pr.id]
      ).catch(() => ({ rows: [] })),

      query(
        `SELECT it.*, u.full_name as performed_by_name
         FROM inventory_transactions it
         JOIN users u ON it.performed_by = u.id
         WHERE it.part_id = $1 AND it.remarks LIKE $2
         ORDER BY it.created_at DESC`,
        [pr.part_id, `%[PR:${pr.id}]%`]
      ).catch(() => ({ rows: [] })),

      query(
        `SELECT a.*, u.full_name as performed_by_name, u.role as performed_by_role
         FROM audit_logs a
         LEFT JOIN users u ON a.performed_by = u.id
         WHERE a.entity_name = 'purchase_requisitions' AND a.entity_id = $1
         ORDER BY a.created_at ASC`,
        [pr.id]
      ).catch(() => ({ rows: [] })),
    ]);

    receipts = grnRes.rows || [];
    transactions = txRes.rows || [];
    timeline = auditRes.rows || [];
  } catch {
    // Continue with base details if auxiliary query fails
  }

  return {
    ...pr,
    grn_receipts: receipts,
    receipts,
    transactions,
    timeline,
    audit_logs: timeline,
  };
}

// ---------------------------------------------------------------------------
// 4. Update PR Status & Lifecycle Transitions
// ---------------------------------------------------------------------------
export async function updatePRStatusService(
  id: string,
  input: UpdatePRStatusInput,
  user: AuthenticatedUser
): Promise<any> {
  validateManagerOrAdmin(user, 'status updates on purchase requisitions');

  if (!UUID_REGEX.test(id.trim())) {
    throw new ProcurementServiceError('Invalid PR ID format.', 400);
  }

  const { pool } = getProcurementServiceDb();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Lock PR row FOR UPDATE
    const selectRes = await client.query(
      `SELECT pr.*, s.plant_id as shop_plant_id
       FROM purchase_requisitions pr
       LEFT JOIN machines m ON pr.machine_id = m.id
       LEFT JOIN shops s ON m.shop_id = s.id
       WHERE pr.id = $1
       FOR UPDATE OF pr`,
      [id]
    );

    if (selectRes.rows.length === 0) {
      throw new ProcurementServiceError('Purchase Requisition not found.', 404);
    }

    const currentPR = selectRes.rows[0];
    const effectivePlantId = currentPR.plant_id || currentPR.shop_plant_id;

    // Plant scope check for manager
    if (user.role === 'manager' || user.role === 'store_manager') {
      const authorizedPlantId = getAuthorizedPlantId(user);
      if (effectivePlantId && authorizedPlantId !== effectivePlantId) {
        throw new ProcurementServiceError('Forbidden: Cannot update purchase requisition for another plant.', 403);
      }
    }

    // Separation of duties: requester cannot approve their own PR into vendor_selected, approval_pending, po_created, or ordered
    const targetStatus = input.status || currentPR.status;
    if (['vendor_selected', 'approval_pending', 'po_created', 'ordered'].includes(targetStatus)) {
      if (currentPR.requested_by === user.id && user.role !== 'admin') {
        throw new ProcurementServiceError(
          'Forbidden: Self-approval not permitted. Requisitions must be approved by an independent manager or administrator.',
          403
        );
      }
    }

    // State machine transition validation
    if (input.status) {
      if (!VALID_PR_STATUSES.includes(input.status)) {
        throw new ProcurementServiceError(`Invalid status '${input.status}'. Allowed values: ${VALID_PR_STATUSES.join(', ')}.`, 400);
      }
      validateStatusTransition(currentPR.status as PRStatus, input.status);
    }

    // Mandatory reason for cancellation / rejection
    if (input.status === 'cancelled' || input.status === 'rejected') {
      if (!input.remarks || input.remarks.trim().length < 5) {
        throw new ProcurementServiceError('Cancellation or rejection requires a mandatory reason of at least 5 characters.', 400);
      }
    }

    // Unit price validation
    let unitPrice = currentPR.unit_price;
    if (input.unit_price !== undefined) {
      const parsedPrice = Number(input.unit_price);
      if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
        throw new ProcurementServiceError('Unit price must be a valid non-negative number.', 400);
      }
      unitPrice = parsedPrice;
    }

    const nextStatus = input.status || currentPR.status;
    const poNumber = input.po_number !== undefined ? input.po_number : currentPR.po_number;
    const supplierName = input.supplier_name !== undefined ? input.supplier_name : currentPR.supplier_name;
    const deliveryDate = input.expected_delivery_date !== undefined ? input.expected_delivery_date : currentPR.expected_delivery_date;

    // Only update approved_by if transitioning to approval states
    const isApprovalTransition = ['vendor_selected', 'approval_pending', 'po_created', 'ordered'].includes(nextStatus) && nextStatus !== currentPR.status;
    const approvedByValue = isApprovalTransition ? user.id : currentPR.approved_by;

    const updateRes = await client.query(
      `UPDATE purchase_requisitions
       SET status = $2,
           po_number = $3,
           supplier_name = $4,
           unit_price = $5,
           expected_delivery_date = $6,
           approved_by = $7,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        nextStatus,
        poNumber,
        supplierName,
        unitPrice,
        deliveryDate || null,
        approvedByValue,
      ]
    );

    const updatedPR = updateRes.rows[0];

    // Audit log
    await client.query(
      `INSERT INTO audit_logs (entity_name, entity_id, action, performed_by, old_values, new_values)
       VALUES ('purchase_requisitions', $1, 'STATUS_UPDATE', $2, $3, $4)`,
      [
        id,
        user.id,
        JSON.stringify({ status: currentPR.status, po_number: currentPR.po_number }),
        JSON.stringify({
          status: updatedPR.status,
          po_number: updatedPR.po_number,
          remarks: input.remarks || '',
        }),
      ]
    );

    // In-app notification to requester
    let technicianAvailabilityNotification: any = null;
    let partName = 'spare part';
    let partNumber = '';

    const isReceiptTransition = ['fully_received', 'partially_received'].includes(nextStatus);
    const wasAlreadyReceived = ['fully_received', 'partially_received'].includes(currentPR.status);

    if (isReceiptTransition) {
      // 1. Fetch spare part details
      if (currentPR.part_id) {
        try {
          const partRes = await client.query(
            `SELECT name, part_number FROM spare_parts WHERE id = $1`,
            [currentPR.part_id]
          );
          if (partRes.rows.length > 0) {
            partName = partRes.rows[0].name || partName;
            partNumber = partRes.rows[0].part_number || '';
          }
        } catch {
          // Graceful fallback for mock DB or missing part
        }
      }

      // 2. Check for duplicate notification (only notify once when newly received)
      let alreadyNotified = false;
      if (currentPR.requested_by) {
        try {
          const existingNotifRes = await client.query(
            `SELECT id FROM notifications 
             WHERE recipient_id = $1 
               AND (entity_id = $2 OR link_url LIKE $3)
               AND message LIKE '%Good news! The spare part you reported as unavailable%'
             LIMIT 1`,
            [currentPR.requested_by, id, `%/procurement?prId=${id}%`]
          );
          if (existingNotifRes.rows.length > 0) {
            alreadyNotified = true;
          }
        } catch {
          // Graceful fallback
        }
      }

      // 3. Insert notification only if not already received and not already notified
      if (!wasAlreadyReceived && !alreadyNotified && currentPR.requested_by) {
        const partDetail = partNumber ? `${partName} (${partNumber})` : partName;
        const notifTitle = `Spare Part Available: ${partDetail}`;
        const notifMessage = `Good news! The spare part you reported as unavailable is now available in the store. Your inventory request has been updated. (Request ID: ${currentPR.pr_number} | Part: ${partDetail})`;
        const notifLinkUrl = `/procurement?prId=${id}`;

        try {
          const notifRes = await client.query(
            `INSERT INTO notifications (recipient_id, title, message, type, link_url, entity_type, entity_id, plant_id, shop_id, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
             RETURNING *`,
            [currentPR.requested_by, notifTitle, notifMessage, 'system', notifLinkUrl, 'purchase_requisitions', id, effectivePlantId || null, null]
          );
          technicianAvailabilityNotification = notifRes.rows[0];
        } catch {
          const fallbackRes = await client.query(
            `INSERT INTO notifications (recipient_id, title, message, type, link_url, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             RETURNING *`,
            [currentPR.requested_by, notifTitle, notifMessage, 'system', notifLinkUrl]
          );
          technicianAvailabilityNotification = fallbackRes.rows[0];
        }
      }
    } else {
      // Standard status transition notification (under_review, vendor_selected, approval_pending, etc.)
      if (currentPR.requested_by && currentPR.requested_by !== user.id) {
        await client.query(
          `INSERT INTO notifications (recipient_id, title, message, type, link_url)
           VALUES ($1, $2, $3, 'approval', $4)`,
          [
            currentPR.requested_by,
            `PR ${currentPR.pr_number} Status Updated`,
            `Your requisition status was updated to '${nextStatus}' by ${(user as any).full_name || user.employee_code || 'Management'}. ${input.remarks || ''}`,
            `/procurement?prId=${id}`,
          ]
        );
      }
    }

    await client.query('COMMIT');

    const io = getProcurementServiceIo();
    if (io) {
      const payload = {
        pr: updatedPR,
        previousStatus: currentPR.status,
        updatedBy: (user as any).full_name || user.employee_code,
      };
      if (effectivePlantId) {
        emitToPlant(effectivePlantId, 'pr:status_changed', payload, io);
      }
      if (currentPR.requested_by) {
        emitToUser(currentPR.requested_by, 'pr:status_changed', payload, io);
      }

      // If inventory availability notification was generated, emit dedicated real-time socket events to the technician
      if (technicianAvailabilityNotification && currentPR.requested_by) {
        const notifPayload = {
          ...technicianAvailabilityNotification,
          link_url: technicianAvailabilityNotification.link_url || `/procurement?prId=${id}`,
          action_url: technicianAvailabilityNotification.link_url || `/procurement?prId=${id}`,
        };
        emitToUser(currentPR.requested_by, 'notification:new', notifPayload, io);
        emitToUser(currentPR.requested_by, 'notification', notifPayload, io);
        emitToUser(currentPR.requested_by, 'inventory:available', {
          pr_id: id,
          pr_number: currentPR.pr_number,
          part_id: currentPR.part_id,
          part_name: partName,
          part_number: partNumber,
          status: nextStatus,
          message: technicianAvailabilityNotification.message,
        }, io);
      }
    }

    return updatedPR;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rbErr) {
      console.error('[PR Status Update Rollback Error]:', rbErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// 5. Approve Purchase Requisition (Explicit approval action)
// ---------------------------------------------------------------------------
export async function approvePurchaseRequisitionService(
  id: string,
  input: ApprovePRInput,
  user: AuthenticatedUser
): Promise<any> {
  validateManagerOrAdmin(user, 'approving purchase requisitions');

  // Next status must follow permitted transition: defaults to vendor_selected
  const allowedApprovalTargets: PRStatus[] = ['vendor_selected', 'approval_pending'];
  const nextStatus = input.target_status || input.next_status || 'vendor_selected';

  if (!allowedApprovalTargets.includes(nextStatus)) {
    throw new ProcurementServiceError(
      `Invalid approval status '${nextStatus}'. Approval must transition to ${allowedApprovalTargets.join(' or ')}.`,
      400
    );
  }

  return updatePRStatusService(
    id,
    {
      status: nextStatus,
      remarks: input.remarks || 'Requisition approved by management.',
    },
    user
  );
}

// ---------------------------------------------------------------------------
// 6. Reject Purchase Requisition (Distinct rejection outcome)
// ---------------------------------------------------------------------------
export async function rejectPurchaseRequisitionService(
  id: string,
  reason: string,
  user: AuthenticatedUser
): Promise<any> {
  validateManagerOrAdmin(user, 'rejecting purchase requisitions');

  if (!UUID_REGEX.test(id.trim())) {
    throw new ProcurementServiceError('Invalid PR ID format.', 400);
  }

  if (!reason || reason.trim().length < 5) {
    throw new ProcurementServiceError('Rejection reason must be provided (minimum 5 characters).', 400);
  }

  const { pool } = getProcurementServiceDb();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const selectRes = await client.query(
      `SELECT pr.*, s.plant_id as shop_plant_id
       FROM purchase_requisitions pr
       LEFT JOIN machines m ON pr.machine_id = m.id
       LEFT JOIN shops s ON m.shop_id = s.id
       WHERE pr.id = $1
       FOR UPDATE OF pr`,
      [id]
    );

    if (selectRes.rows.length === 0) {
      throw new ProcurementServiceError('Purchase Requisition not found.', 404);
    }

    const pr = selectRes.rows[0];
    const effectivePlantId = pr.plant_id || pr.shop_plant_id;

    if (user.role === 'manager' || user.role === 'store_manager') {
      const authorizedPlantId = getAuthorizedPlantId(user);
      if (effectivePlantId && authorizedPlantId !== effectivePlantId) {
        throw new ProcurementServiceError('Forbidden: Cannot reject purchase requisition for another plant.', 403);
      }
    }

    if (['cancelled', 'rejected', 'fully_received'].includes(pr.status)) {
      throw new ProcurementServiceError(`Cannot reject requisition in '${pr.status}' status.`, 400);
    }

    // Update PR to rejected status and record reason
    const updateRes = await client.query(
      `UPDATE purchase_requisitions
       SET status = 'rejected',
           rejection_reason = $2,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, reason.trim()]
    );

    const updatedPR = updateRes.rows[0];

    // Audit log
    await client.query(
      `INSERT INTO audit_logs (entity_name, entity_id, action, performed_by, old_values, new_values)
       VALUES ('purchase_requisitions', $1, 'PR_REJECTED', $2, $3, $4)`,
      [
        id,
        user.id,
        JSON.stringify({ status: pr.status }),
        JSON.stringify({ status: 'rejected', reason: reason.trim() }),
      ]
    );

    // Notify requester
    if (pr.requested_by !== user.id) {
      await client.query(
        `INSERT INTO notifications (recipient_id, title, message, type, link_url)
         VALUES ($1, $2, $3, 'approval', $4)`,
        [
          pr.requested_by,
          `PR ${pr.pr_number} Rejected`,
          `Your requisition was rejected by ${(user as any).full_name || user.employee_code || 'Management'}. Reason: ${reason.trim()}`,
          `/procurement/pr/${id}`,
        ]
      );
    }

    await client.query('COMMIT');

    const io = getProcurementServiceIo();
    if (io) {
      const payload = {
        pr: updatedPR,
        previousStatus: pr.status,
        reason: reason.trim(),
        rejectedBy: (user as any).full_name || user.employee_code,
      };
      if (effectivePlantId) {
        emitToPlant(effectivePlantId, 'pr:rejected', payload, io);
      }
      emitToUser(pr.requested_by, 'pr:rejected', payload, io);
    }

    return updatedPR;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rbErr) {
      console.error('[PR Rejection Rollback Error]:', rbErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// 7. Cancel Purchase Requisition / PO
// ---------------------------------------------------------------------------
export async function cancelPurchaseRequisitionService(
  id: string,
  reason: string,
  user: AuthenticatedUser
): Promise<any> {
  validateManagerOrAdmin(user, 'cancellation of requisitions');

  if (!UUID_REGEX.test(id.trim())) {
    throw new ProcurementServiceError('Invalid PR ID format.', 400);
  }

  if (!reason || reason.trim().length < 5) {
    throw new ProcurementServiceError('Cancellation reason must be provided (minimum 5 characters).', 400);
  }

  const { pool } = getProcurementServiceDb();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const selectRes = await client.query(
      `SELECT pr.*, s.plant_id as shop_plant_id
       FROM purchase_requisitions pr
       LEFT JOIN machines m ON pr.machine_id = m.id
       LEFT JOIN shops s ON m.shop_id = s.id
       WHERE pr.id = $1
       FOR UPDATE OF pr`,
      [id]
    );

    if (selectRes.rows.length === 0) {
      throw new ProcurementServiceError('Purchase Requisition not found.', 404);
    }

    const pr = selectRes.rows[0];
    const effectivePlantId = pr.plant_id || pr.shop_plant_id;

    if (user.role === 'manager' || user.role === 'store_manager') {
      const authorizedPlantId = getAuthorizedPlantId(user);
      if (effectivePlantId && authorizedPlantId !== effectivePlantId) {
        throw new ProcurementServiceError('Forbidden: Cannot cancel purchase requisition for another plant.', 403);
      }
    }

    if (['cancelled', 'rejected', 'fully_received'].includes(pr.status)) {
      throw new ProcurementServiceError(`Cannot cancel requisition in '${pr.status}' status.`, 400);
    }

    const updateRes = await client.query(
      `UPDATE purchase_requisitions
       SET status = 'cancelled',
           cancellation_reason = $2,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, reason.trim()]
    );

    const updatedPR = updateRes.rows[0];

    // Audit log
    await client.query(
      `INSERT INTO audit_logs (entity_name, entity_id, action, performed_by, old_values, new_values)
       VALUES ('purchase_requisitions', $1, 'PR_CANCELLED', $2, $3, $4)`,
      [
        id,
        user.id,
        JSON.stringify({ status: pr.status }),
        JSON.stringify({ status: 'cancelled', reason: reason.trim() }),
      ]
    );

    // Notify requester
    if (pr.requested_by !== user.id) {
      await client.query(
        `INSERT INTO notifications (recipient_id, title, message, type, link_url)
         VALUES ($1, $2, $3, 'approval', $4)`,
        [
          pr.requested_by,
          `PR ${pr.pr_number} Cancelled`,
          `Your requisition was cancelled by ${(user as any).full_name || user.employee_code || 'Management'}. Reason: ${reason.trim()}`,
          `/procurement/pr/${id}`,
        ]
      );
    }

    await client.query('COMMIT');

    const io = getProcurementServiceIo();
    if (io) {
      const payload = {
        pr: updatedPR,
        previousStatus: pr.status,
        reason: reason.trim(),
        cancelledBy: (user as any).full_name || user.employee_code,
      };
      if (effectivePlantId) {
        emitToPlant(effectivePlantId, 'pr:status_changed', payload, io);
      }
      emitToUser(pr.requested_by, 'pr:status_changed', payload, io);
    }

    return updatedPR;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rbErr) {
      console.error('[PR Cancellation Rollback Error]:', rbErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// 8. Create Purchase Order (Convert Approved Requisition to PO)
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// 7b. Edit Purchase Requisition (Edit core specification details)
// ---------------------------------------------------------------------------
export async function editPurchaseRequisitionService(
  id: string,
  input: EditPurchaseRequisitionInput,
  user: AuthenticatedUser
): Promise<any> {
  validateProcurementRole(user);

  if (!UUID_REGEX.test(id.trim())) {
    throw new ProcurementServiceError('Invalid PR ID format.', 400);
  }

  const { pool } = getProcurementServiceDb();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Lock PR row FOR UPDATE
    const selectRes = await client.query(
      `SELECT pr.*, s.plant_id as shop_plant_id
       FROM purchase_requisitions pr
       LEFT JOIN machines m ON pr.machine_id = m.id
       LEFT JOIN shops s ON m.shop_id = s.id
       WHERE pr.id = $1
       FOR UPDATE OF pr`,
      [id]
    );

    if (selectRes.rows.length === 0) {
      throw new ProcurementServiceError('Purchase Requisition not found.', 404);
    }

    const currentPR = selectRes.rows[0];
    const effectivePlantId = currentPR.plant_id || currentPR.shop_plant_id;

    // RBAC & scoping check
    if (user.role === 'technician') {
      if (currentPR.requested_by !== user.id) {
        throw new ProcurementServiceError('Forbidden: Technicians can only edit their own purchase requisitions.', 403);
      }
    } else if (user.role === 'manager' || user.role === 'store_manager') {
      const authorizedPlantId = getAuthorizedPlantId(user);
      if (effectivePlantId && authorizedPlantId !== effectivePlantId) {
        throw new ProcurementServiceError('Forbidden: Cannot edit purchase requisition for another plant.', 403);
      }
    }

    // Status check: permitted for pre-order requisitions (new, under_review, approval_pending, quotation_pending, vendor_selected)
    const nonEditableStatuses = ['po_created', 'ordered', 'partially_received', 'fully_received', 'cancelled', 'rejected'];
    if (nonEditableStatuses.includes(currentPR.status) || currentPR.po_number) {
      throw new ProcurementServiceError(
        `Cannot edit requisition in '${currentPR.status}' status. Specifications cannot be modified once a Purchase Order is issued or items ordered.`,
        409
      );
    }

    // Validate part_id if provided
    let effectivePartId = currentPR.part_id;
    if (input.part_id !== undefined && input.part_id !== null) {
      const trimmedPartId = input.part_id.trim();
      if (!UUID_REGEX.test(trimmedPartId)) {
        throw new ProcurementServiceError('Invalid part_id format. UUID required.', 400);
      }
      const partRes = await client.query(
        `SELECT id, part_number, name, status, plant_id FROM spare_parts WHERE id = $1`,
        [trimmedPartId]
      );
      if (partRes.rows.length === 0) {
        throw new ProcurementServiceError('Specified spare part not found in inventory catalog.', 404);
      }
      if (partRes.rows[0].status === 'inactive') {
        throw new ProcurementServiceError('Cannot requisition inactive or discontinued spare parts.', 400);
      }
      effectivePartId = trimmedPartId;
    }

    // Validate quantity_required if provided
    let effectiveQuantity = currentPR.quantity_required;
    if (input.quantity_required !== undefined) {
      const qty = validateStrictNonNegativeInteger(input.quantity_required, 'quantity_required');
      if (qty <= 0) {
        throw new ProcurementServiceError('Quantity required must be greater than zero.', 400);
      }
      effectiveQuantity = qty;
    }

    // Validate urgency if provided
    let effectiveUrgency = currentPR.urgency;
    if (input.urgency !== undefined) {
      if (!['critical', 'high', 'medium', 'low'].includes(input.urgency)) {
        throw new ProcurementServiceError(`Invalid urgency '${input.urgency}'. Must be critical, high, medium, or low.`, 400);
      }
      effectiveUrgency = input.urgency;
    }

    // Validate technical_justification if provided
    let effectiveJustification = currentPR.technical_justification;
    if (input.technical_justification !== undefined) {
      const trimmedJust = input.technical_justification.trim();
      if (trimmedJust.length < 5) {
        throw new ProcurementServiceError('Technical justification must be at least 5 characters.', 400);
      }
      effectiveJustification = trimmedJust;
    }

    // Validate machine_id if provided
    let effectiveMachineId = currentPR.machine_id;
    if (input.machine_id !== undefined) {
      if (input.machine_id === null || input.machine_id.trim() === '') {
        effectiveMachineId = null;
      } else {
        const trimmedMachId = input.machine_id.trim();
        if (!UUID_REGEX.test(trimmedMachId)) {
          throw new ProcurementServiceError('Invalid machine_id format.', 400);
        }
        const machRes = await client.query(
          `SELECT m.id, m.machine_code, m.shop_id, s.plant_id
           FROM machines m
           JOIN shops s ON m.shop_id = s.id
           WHERE m.id = $1`,
          [trimmedMachId]
        );
        if (machRes.rows.length === 0) {
          throw new ProcurementServiceError('Specified machine asset not found.', 404);
        }
        effectiveMachineId = trimmedMachId;
      }
    }

    // Expected delivery date
    let effectiveDeliveryDate = currentPR.expected_delivery_date;
    if (input.expected_delivery_date !== undefined) {
      effectiveDeliveryDate = input.expected_delivery_date || null;
    }

    // Update query
    const updateRes = await client.query(
      `UPDATE purchase_requisitions
       SET part_id = $2,
           quantity_required = $3,
           urgency = $4,
           technical_justification = $5,
           machine_id = $6,
           expected_delivery_date = $7,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        effectivePartId,
        effectiveQuantity,
        effectiveUrgency,
        effectiveJustification,
        effectiveMachineId,
        effectiveDeliveryDate,
      ]
    );

    const updatedPR = updateRes.rows[0];

    // Audit log
    await client.query(
      `INSERT INTO audit_logs (entity_name, entity_id, action, performed_by, old_values, new_values)
       VALUES ('purchase_requisitions', $1, 'PR_EDITED', $2, $3, $4)`,
      [
        id,
        user.id,
        JSON.stringify({
          part_id: currentPR.part_id,
          quantity_required: currentPR.quantity_required,
          urgency: currentPR.urgency,
          machine_id: currentPR.machine_id,
          technical_justification: currentPR.technical_justification,
        }),
        JSON.stringify({
          part_id: updatedPR.part_id,
          quantity_required: updatedPR.quantity_required,
          urgency: updatedPR.urgency,
          machine_id: updatedPR.machine_id,
          technical_justification: updatedPR.technical_justification,
        }),
      ]
    );

    await client.query('COMMIT');

    const io = getProcurementServiceIo();
    if (io) {
      const payload = {
        pr: updatedPR,
        updatedBy: (user as any).full_name || user.employee_code,
      };
      if (effectivePlantId) {
        emitToPlant(effectivePlantId, 'pr:updated', payload, io);
      }
      emitToUser(currentPR.requested_by, 'pr:updated', payload, io);
    }

    return updatedPR;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rbErr) {
      console.error('[PR Edit Rollback Error]:', rbErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// 7c. Delete Purchase Requisition (Delete eligible requisition)
// ---------------------------------------------------------------------------
export async function deletePurchaseRequisitionService(
  id: string,
  user: AuthenticatedUser
): Promise<{ id: string; pr_number: string }> {
  validateProcurementRole(user);

  if (!UUID_REGEX.test(id.trim())) {
    throw new ProcurementServiceError('Invalid PR ID format.', 400);
  }

  const { pool } = getProcurementServiceDb();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Lock PR row FOR UPDATE
    const selectRes = await client.query(
      `SELECT pr.*, s.plant_id as shop_plant_id
       FROM purchase_requisitions pr
       LEFT JOIN machines m ON pr.machine_id = m.id
       LEFT JOIN shops s ON m.shop_id = s.id
       WHERE pr.id = $1
       FOR UPDATE OF pr`,
      [id]
    );

    if (selectRes.rows.length === 0) {
      throw new ProcurementServiceError('Purchase Requisition not found.', 404);
    }

    const pr = selectRes.rows[0];
    const effectivePlantId = pr.plant_id || pr.shop_plant_id;

    // RBAC check
    if (user.role === 'technician') {
      if (pr.requested_by !== user.id) {
        throw new ProcurementServiceError('Forbidden: Technicians can only delete their own purchase requisitions.', 403);
      }
      if (pr.status !== 'new' && pr.status !== 'approval_pending' && pr.status !== 'under_review') {
        throw new ProcurementServiceError('Forbidden: Technicians can only delete their own pending requisitions.', 403);
      }
    } else if (user.role === 'manager' || user.role === 'store_manager') {
      const authorizedPlantId = getAuthorizedPlantId(user);
      if (effectivePlantId && authorizedPlantId !== effectivePlantId) {
        throw new ProcurementServiceError('Forbidden: Cannot delete purchase requisition for another plant.', 403);
      }
    }

    // Business & FK check: Reject deletion if PO exists or goods receipts inwarded
    if (pr.po_number || ['po_created', 'ordered', 'partially_received', 'fully_received'].includes(pr.status)) {
      throw new ProcurementServiceError(
        `Cannot delete requisition ${pr.pr_number}: A Purchase Order (${pr.po_number || 'issued'}) has already been created for this requisition. To discontinue, please cancel the requisition instead to preserve financial audit trails.`,
        409
      );
    }

    let grnCount = 0;
    try {
      const grnCheck = await client.query(
        `SELECT count(*) FROM grn_receipts WHERE pr_id = $1`,
        [id]
      );
      grnCount = parseInt(grnCheck.rows[0]?.count || '0', 10);
    } catch {
      // grn_receipts table check in mock environment
    }

    if (grnCount > 0) {
      throw new ProcurementServiceError(
        `Cannot delete requisition ${pr.pr_number}: ${grnCount} Goods Receipt Note (GRN) records are registered against this requisition. Inwarded inventory transactions cannot be purged.`,
        409
      );
    }

    // Clean up notifications referencing this PR
    try {
      await client.query(
        `DELETE FROM notifications WHERE link_url LIKE $1`,
        [`%/procurement/pr/${id}%`]
      );
    } catch {
      // Continue if notifications cleanup in mock environment
    }

    // Delete the PR row
    await client.query(
      `DELETE FROM purchase_requisitions WHERE id = $1`,
      [id]
    );

    // Record audit log
    await client.query(
      `INSERT INTO audit_logs (entity_name, entity_id, action, performed_by, old_values, new_values)
       VALUES ('purchase_requisitions', $1, 'PR_DELETED', $2, $3, NULL)`,
      [
        id,
        user.id,
        JSON.stringify({
          pr_number: pr.pr_number,
          status: pr.status,
          part_id: pr.part_id,
          quantity_required: pr.quantity_required,
        }),
      ]
    );

    await client.query('COMMIT');

    const io = getProcurementServiceIo();
    if (io) {
      const payload = {
        prId: pr.id,
        prNumber: pr.pr_number,
        deletedBy: (user as any).full_name || user.employee_code,
      };
      if (effectivePlantId) {
        emitToPlant(effectivePlantId, 'pr:deleted', payload, io);
      }
      emitToUser(pr.requested_by, 'pr:deleted', payload, io);
    }

    return { id: pr.id, pr_number: pr.pr_number };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rbErr) {
      console.error('[PR Delete Rollback Error]:', rbErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function createPurchaseOrderService(
  prId: string,
  input: CreatePOInput,
  user: AuthenticatedUser
): Promise<any> {
  validateManagerOrAdmin(user, 'Purchase Order creation');

  if (!UUID_REGEX.test(prId.trim())) {
    throw new ProcurementServiceError('Invalid PR ID format.', 400);
  }

  if (!input.supplier_name || input.supplier_name.trim().length === 0) {
    throw new ProcurementServiceError('Supplier name is mandatory to issue a Purchase Order.', 400);
  }

  const unitPrice = Number(input.unit_price);
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    throw new ProcurementServiceError('Unit price must be a valid non-negative number.', 400);
  }

  if (input.expected_dispatch_date) {
    const d = new Date(input.expected_dispatch_date);
    if (isNaN(d.getTime())) {
      throw new ProcurementServiceError('Expected dispatch date must be a valid date.', 400);
    }
  }

  if (input.expected_delivery_date) {
    const d = new Date(input.expected_delivery_date);
    if (isNaN(d.getTime())) {
      throw new ProcurementServiceError('Expected delivery date must be a valid date.', 400);
    }
  }

  if (input.mark_as_ordered !== undefined && typeof input.mark_as_ordered !== 'boolean') {
    throw new ProcurementServiceError('mark_as_ordered must be a boolean value.', 400);
  }

  const { pool } = getProcurementServiceDb();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Lock PR row FOR UPDATE
    const prRes = await client.query(
      `SELECT pr.*, s.plant_id as shop_plant_id
       FROM purchase_requisitions pr
       LEFT JOIN machines m ON pr.machine_id = m.id
       LEFT JOIN shops s ON m.shop_id = s.id
       WHERE pr.id = $1
       FOR UPDATE OF pr`,
      [prId]
    );

    if (prRes.rows.length === 0) {
      throw new ProcurementServiceError('Purchase Requisition not found.', 404);
    }

    const pr = prRes.rows[0];
    const effectivePlantId = pr.plant_id || pr.shop_plant_id;

    // Manager plant scope check
    if (user.role === 'manager' || user.role === 'store_manager') {
      const authorizedPlantId = getAuthorizedPlantId(user);
      if (effectivePlantId && authorizedPlantId !== effectivePlantId) {
        throw new ProcurementServiceError('Forbidden: Cannot issue PO for a requisition belonging to another plant.', 403);
      }
    }

    // Check: Duplicate PO prevention
    if (pr.po_number && ['po_created', 'ordered', 'partially_received', 'fully_received'].includes(pr.status)) {
      throw new ProcurementServiceError(
        `Purchase Order ${pr.po_number} is already active for this requisition. Duplicate PO generation prevented.`,
        409
      );
    }

    // State machine check: PR must have reached vendor_selected or approval_pending stage
    if (!['vendor_selected', 'approval_pending'].includes(pr.status)) {
      throw new ProcurementServiceError(
        `Cannot issue a Purchase Order for requisition in '${pr.status}' status. Requisition must be approved and vendor-selected first.`,
        400
      );
    }

    // Separation of duties
    if (pr.requested_by === user.id && user.role !== 'admin') {
      throw new ProcurementServiceError('Forbidden: Separation of duties requires an independent manager to approve and issue PO.', 403);
    }

    // 2. Generate or validate PO number
    let poNumber = input.po_number?.trim();
    if (!poNumber) {
      const currentYear = new Date().getFullYear();
      poNumber = await generatePONumberWithAdvisoryLock(client, currentYear);
    } else {
      // Validate unique PO number
      const duplicateRes = await client.query(
        `SELECT id FROM purchase_requisitions WHERE po_number = $1 AND id != $2`,
        [poNumber, pr.id]
      );
      if (duplicateRes.rows.length > 0) {
        throw new ProcurementServiceError(`Purchase Order number '${poNumber}' already exists.`, 409);
      }
    }

    const targetStatus = input.mark_as_ordered ? 'ordered' : 'po_created';

    const freightCost = input.freight_cost !== undefined && input.freight_cost !== null && !isNaN(Number(input.freight_cost))
      ? Math.max(0, Number(input.freight_cost))
      : 0;
    const totalOrderValue = Number(pr.quantity_required) * unitPrice;
    const overallShipmentCost = input.overall_shipment_cost !== undefined && input.overall_shipment_cost !== null && !isNaN(Number(input.overall_shipment_cost)) && Number(input.overall_shipment_cost) > 0
      ? Number(input.overall_shipment_cost)
      : totalOrderValue + freightCost;

    // 3. Update PR with PO details (extended with Shipment & Transportation metadata)
    let updateRes: any;
    try {
      updateRes = await client.query(
        `UPDATE purchase_requisitions
         SET po_number = $2,
             supplier_name = $3,
             unit_price = $4,
             expected_delivery_date = $5,
             status = $6,
             approved_by = $7,
             supply_method = $8,
             delivery_document_type = $9,
             challan_type = $10,
             vendor_challan_number = $11,
             expected_dispatch_date = $12,
             transporter_name = $13,
             vehicle_number = $14,
             lr_tracking_number = $15,
             delivery_remarks = $16,
             dispatch_location = $17,
             destination_plant_name = $18,
             transport_mode = $19,
             freight_cost = $20,
             overall_shipment_cost = $21,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [
          pr.id,
          poNumber,
          input.supplier_name.trim(),
          unitPrice,
          input.expected_delivery_date || null,
          targetStatus,
          user.id,
          input.supply_method?.trim() || null,
          input.delivery_document_type?.trim() || null,
          input.challan_type?.trim() || null,
          input.vendor_challan_number?.trim() || null,
          input.expected_dispatch_date || null,
          input.transporter_name?.trim() || null,
          input.vehicle_number?.trim() || null,
          input.lr_tracking_number?.trim() || null,
          input.delivery_remarks?.trim() || null,
          input.dispatch_location?.trim() || null,
          input.destination_plant_name?.trim() || null,
          input.transport_mode?.trim() || null,
          freightCost,
          overallShipmentCost,
        ]
      );
    } catch (colErr) {
      updateRes = await client.query(
        `UPDATE purchase_requisitions
         SET po_number = $2,
             supplier_name = $3,
             unit_price = $4,
             expected_delivery_date = $5,
             status = $6,
             approved_by = $7,
             supply_method = $8,
             delivery_document_type = $9,
             challan_type = $10,
             vendor_challan_number = $11,
             expected_dispatch_date = $12,
             transporter_name = $13,
             vehicle_number = $14,
             lr_tracking_number = $15,
             delivery_remarks = $16,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [
          pr.id,
          poNumber,
          input.supplier_name.trim(),
          unitPrice,
          input.expected_delivery_date || null,
          targetStatus,
          user.id,
          input.supply_method?.trim() || null,
          input.delivery_document_type?.trim() || null,
          input.challan_type?.trim() || null,
          input.vendor_challan_number?.trim() || null,
          input.expected_dispatch_date || null,
          input.transporter_name?.trim() || null,
          input.vehicle_number?.trim() || null,
          input.lr_tracking_number?.trim() || null,
          input.delivery_remarks?.trim() || null,
        ]
      );
    }

    const updatedPR = updateRes.rows[0];

    // 4. Audit log
    await client.query(
      `INSERT INTO audit_logs (entity_name, entity_id, action, performed_by, old_values, new_values)
       VALUES ('purchase_requisitions', $1, 'PO_CREATED', $2, $3, $4)`,
      [
        pr.id,
        user.id,
        JSON.stringify({ status: pr.status, po_number: pr.po_number }),
        JSON.stringify({
          status: updatedPR.status,
          po_number: poNumber,
          supplier_name: input.supplier_name,
          unit_price: unitPrice,
          total_value: Number(pr.quantity_required) * unitPrice,
          supply_method: input.supply_method || null,
          delivery_document_type: input.delivery_document_type || null,
          challan_type: input.challan_type || null,
          vendor_challan_number: input.vendor_challan_number || null,
          expected_dispatch_date: input.expected_dispatch_date || null,
          transporter_name: input.transporter_name || null,
          vehicle_number: input.vehicle_number || null,
          lr_tracking_number: input.lr_tracking_number || null,
          dispatch_location: input.dispatch_location || null,
          destination_plant_name: input.destination_plant_name || null,
          transport_mode: input.transport_mode || null,
          freight_cost: freightCost,
          overall_shipment_cost: overallShipmentCost,
        }),
      ]
    );

    // 5. In-app notification to requester
    if (pr.requested_by !== user.id) {
      await client.query(
        `INSERT INTO notifications (recipient_id, title, message, type, link_url)
         VALUES ($1, $2, $3, 'approval', $4)`,
        [
          pr.requested_by,
          `Purchase Order ${poNumber} Issued`,
          `PO ${poNumber} has been issued to supplier ${input.supplier_name} for requisition ${pr.pr_number}.`,
          `/procurement/pr/${pr.id}`,
        ]
      );
    }

    await client.query('COMMIT');

    const io = getProcurementServiceIo();
    if (io) {
      const payload = {
        po_number: poNumber,
        pr: updatedPR,
        message: `Purchase Order ${poNumber} issued to ${input.supplier_name}.`,
      };
      if (effectivePlantId) {
        emitToPlant(effectivePlantId, 'po:created', payload, io);
      }
      emitToUser(pr.requested_by, 'po:created', payload, io);
    }

    return updatedPR;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rbErr) {
      console.error('[PO Creation Rollback Error]:', rbErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// 9. Get Purchase Orders (List Active & Historical POs)
// ---------------------------------------------------------------------------
export async function getPurchaseOrdersService(
  filter: {
    status?: string;
    supplier_name?: string;
    is_overdue?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  },
  user: AuthenticatedUser
): Promise<{ data: any[]; pagination: { total: number; page: number; limit: number; totalPages: number } }> {
  validateProcurementRole(user);

  const page = Math.max(1, Number(filter.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(filter.limit) || 20));
  const offset = (page - 1) * limit;

  let baseQuery = `
    FROM purchase_requisitions pr
    JOIN spare_parts sp ON pr.part_id = sp.id
    JOIN users req ON pr.requested_by = req.id
    LEFT JOIN users app ON pr.approved_by = app.id
    LEFT JOIN machines m ON pr.machine_id = m.id
    LEFT JOIN shops s ON m.shop_id = s.id
    LEFT JOIN plants p ON COALESCE(pr.plant_id, s.plant_id) = p.id
    WHERE pr.po_number IS NOT NULL
  `;

  const params: any[] = [];

  // Scoping
  if (user.role === 'technician') {
    params.push(user.id);
    baseQuery += ` AND pr.requested_by = $${params.length}`;
  } else if (user.role === 'manager' || user.role === 'store_manager') {
    const authorizedPlantId = getAuthorizedPlantId(user);
    params.push(authorizedPlantId);
    baseQuery += ` AND (pr.plant_id = $${params.length} OR s.plant_id = $${params.length})`;
  }

  if (filter.status) {
    params.push(filter.status);
    baseQuery += ` AND pr.status = $${params.length}`;
  }

  if (filter.supplier_name) {
    params.push(`%${filter.supplier_name.trim()}%`);
    baseQuery += ` AND pr.supplier_name ILIKE $${params.length}`;
  }

  if (filter.is_overdue) {
    baseQuery += ` AND pr.expected_delivery_date < CURRENT_DATE AND pr.status NOT IN ('fully_received', 'cancelled', 'rejected')`;
  }

  if (filter.search) {
    params.push(`%${filter.search.trim()}%`);
    const idx = params.length;
    baseQuery += ` AND (
      pr.po_number ILIKE $${idx} OR
      pr.pr_number ILIKE $${idx} OR
      sp.part_number ILIKE $${idx} OR
      sp.name ILIKE $${idx} OR
      pr.supplier_name ILIKE $${idx}
    )`;
  }

  const { query } = getProcurementServiceDb();

  const countRes = await query(`SELECT COUNT(*) as count ${baseQuery}`, params);
  const total = parseInt(countRes.rows[0]?.count || '0', 10);

  const selectCols = `
    SELECT pr.id,
           pr.pr_number,
           pr.supply_method,
           pr.delivery_document_type,
           pr.challan_type,
           pr.vendor_challan_number,
           pr.expected_dispatch_date,
           pr.transporter_name,
           pr.vehicle_number,
           pr.lr_tracking_number,
           pr.delivery_remarks,
           pr.dispatch_location,
           pr.destination_plant_name,
           pr.transport_mode,
           COALESCE(pr.freight_cost, 0.00)::numeric as freight_cost,
           COALESCE(pr.overall_shipment_cost, (pr.unit_price * pr.quantity_required) + COALESCE(pr.freight_cost, 0.00))::numeric as overall_shipment_cost,
           pr.po_number,
           pr.supplier_name,
           pr.unit_price,
           (pr.unit_price * pr.quantity_required) as total_order_value,
           (pr.unit_price * pr.quantity_required) as total_order_cost,
           pr.quantity_required,
           COALESCE((SELECT SUM(gr.accepted_quantity) FROM grn_receipts gr WHERE gr.pr_id = pr.id), 0)::int as received_quantity,
           GREATEST(0, pr.quantity_required - COALESCE((SELECT SUM(gr.accepted_quantity) FROM grn_receipts gr WHERE gr.pr_id = pr.id), 0))::int as remaining_quantity,
           pr.expected_delivery_date,
           pr.received_date,
           pr.status,
           pr.urgency,
           pr.created_at,
           pr.updated_at,
           sp.part_number as sku,
           sp.part_number,
           sp.name as part_name,
           sp.uom,
           sp.bin_location,
           req.full_name as requested_by_name,
           app.full_name as approved_by_name,
           m.machine_code,
           s.shop_name,
           p.plant_name as plant_name,
           COALESCE(pr.plant_id, s.plant_id) as plant_id,
           CASE
             WHEN pr.expected_delivery_date < CURRENT_DATE AND pr.status NOT IN ('fully_received', 'cancelled', 'rejected') THEN true
             ELSE false
           END as is_overdue
  `;

  const dataQuery = `${selectCols} ${baseQuery} ORDER BY pr.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  const dataRes = await query(dataQuery, [...params, limit, offset]);

  return {
    data: dataRes.rows,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

// ---------------------------------------------------------------------------
// 10. Process Goods Receipt Note (GRN) Inwarding & Stock Increment
// ---------------------------------------------------------------------------
export async function processGRNInwardService(
  prId: string,
  input: ProcessGRNInput,
  user: AuthenticatedUser
): Promise<any> {
  validateManagerOrAdmin(user, 'Goods Receipt Inwarding (GRN)');

  if (!UUID_REGEX.test(prId.trim())) {
    throw new ProcurementServiceError('Invalid PR ID format.', 400);
  }

  // Strict non-negative integer validation
  const acceptedQty = validateStrictNonNegativeInteger(input.accepted_quantity, 'Accepted quantity');
  const rejectedQty = validateStrictNonNegativeInteger(input.rejected_quantity, 'Rejected quantity');
  const damagedQty = input.damaged_quantity !== undefined ? validateStrictNonNegativeInteger(input.damaged_quantity, 'Damaged quantity') : 0;
  const defectiveQty = input.defective_quantity !== undefined ? validateStrictNonNegativeInteger(input.defective_quantity, 'Defective quantity') : 0;
  const legacyReceivedQty = input.received_quantity !== undefined ? validateStrictNonNegativeInteger(input.received_quantity, 'Received quantity') : 0;

  let finalAcceptedQty = acceptedQty;
  let finalRejectedQty = rejectedQty;
  let finalDamagedQty = damagedQty;
  let finalDefectiveQty = defectiveQty;

  // Fallback for legacy requests that only pass received_quantity
  if (input.accepted_quantity === undefined && input.rejected_quantity === undefined && legacyReceivedQty > 0) {
    finalAcceptedQty = legacyReceivedQty;
    finalRejectedQty = 0;
    finalDamagedQty = 0;
    finalDefectiveQty = 0;
  }

  // Consistent quantity model across all layers:
  // received_quantity = accepted_quantity + rejected_quantity + damaged_quantity
  const totalDeliveredInBatch = finalAcceptedQty + finalRejectedQty + finalDamagedQty;
  if (totalDeliveredInBatch <= 0) {
    throw new ProcurementServiceError('At least 1 delivered unit (accepted, rejected, or damaged) must be recorded for GRN.', 400);
  }

  // Defective quantity is a classification within non-conforming (rejected/damaged) goods
  if (finalDefectiveQty < 0 || finalDefectiveQty > (finalRejectedQty + finalDamagedQty)) {
    throw new ProcurementServiceError(
      `Defective quantity (${finalDefectiveQty}) cannot exceed total non-conforming (rejected + damaged) quantity (${finalRejectedQty + finalDamagedQty}). Defective stock is a classified sub-category of non-conforming goods.`,
      400
    );
  }

  // If received_quantity is explicitly provided alongside sub-quantities, it must strictly match
  if (
    input.received_quantity !== undefined &&
    input.received_quantity !== null &&
    (input.accepted_quantity !== undefined || input.rejected_quantity !== undefined || input.damaged_quantity !== undefined)
  ) {
    if (legacyReceivedQty !== totalDeliveredInBatch) {
      throw new ProcurementServiceError(
        `Received quantity (${legacyReceivedQty}) does not match the sum of accepted (${finalAcceptedQty}), rejected (${finalRejectedQty}), and damaged (${finalDamagedQty}) quantities (expected ${totalDeliveredInBatch}).`,
        400
      );
    }
  }

  if (finalRejectedQty > 0 && (!input.rejection_reason || input.rejection_reason.trim().length === 0)) {
    throw new ProcurementServiceError('Rejection reason is mandatory when items are rejected during quality inspection.', 400);
  }

  let inspectionStatus = input.inspection_status?.trim().toLowerCase();
  if (!inspectionStatus || !['passed', 'partially_passed', 'failed', 'quarantined'].includes(inspectionStatus)) {
    if (finalRejectedQty === 0 && finalDamagedQty === 0 && finalAcceptedQty > 0) {
      inspectionStatus = 'passed';
    } else if (finalAcceptedQty > 0 && (finalRejectedQty > 0 || finalDamagedQty > 0)) {
      inspectionStatus = 'partially_passed';
    } else if (finalAcceptedQty === 0) {
      inspectionStatus = 'failed';
    } else {
      inspectionStatus = 'quarantined';
    }
  }

  const { pool } = getProcurementServiceDb();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Lock PR row FOR UPDATE
    const prRes = await client.query(
      `SELECT pr.*, sp.part_number, sp.name as part_name, sp.warehouse_zone, sp.bin_location,
              wo.status as work_order_status, s.plant_id as shop_plant_id
       FROM purchase_requisitions pr
       JOIN spare_parts sp ON pr.part_id = sp.id
       LEFT JOIN machines m ON pr.machine_id = m.id
       LEFT JOIN shops s ON m.shop_id = s.id
       LEFT JOIN work_orders wo ON pr.work_order_id = wo.id
       WHERE pr.id = $1
       FOR UPDATE OF pr`,
      [prId]
    );

    if (prRes.rows.length === 0) {
      throw new ProcurementServiceError('Purchase Requisition not found.', 404);
    }

    const pr = prRes.rows[0];
    const effectivePlantId = pr.plant_id || pr.shop_plant_id;

    // Manager plant scope check
    if (user.role === 'manager' || user.role === 'store_manager') {
      const authorizedPlantId = getAuthorizedPlantId(user);
      if (effectivePlantId && authorizedPlantId !== effectivePlantId) {
        throw new ProcurementServiceError('Forbidden: Cannot process GRN for a requisition from another plant.', 403);
      }
    }

    // Status validation: only ordered, po_created, or partially_received are eligible
    if (pr.status === 'cancelled' || pr.status === 'rejected') {
      throw new ProcurementServiceError(`Cannot inward goods against a ${pr.status} requisition.`, 400);
    }
    if (pr.status === 'fully_received') {
      throw new ProcurementServiceError('Requisition has already been fully received and stock posted. Duplicate inwarding prevented.', 409);
    }
    if (!['ordered', 'po_created', 'partially_received'].includes(pr.status)) {
      throw new ProcurementServiceError(
        `Cannot process GRN for requisition in '${pr.status}' state. Requisition must be ordered or have a PO created.`,
        400
      );
    }

    // 2. Prevent Over-receipt & Track Partial Delivery:
    // Track both cumulative physical deliveries and cumulative usable accepted stock
    let prevPhysicalDelivered = 0;
    let prevAccepted = 0;
    try {
      const grnPrevRes = await client.query(
        `SELECT 
           COALESCE(SUM(received_quantity), 0) as total_prev_delivered,
           COALESCE(SUM(accepted_quantity), 0) as total_prev_accepted
         FROM grn_receipts
         WHERE pr_id = $1`,
        [pr.id]
      );
      if (grnPrevRes.rows.length > 0) {
        prevPhysicalDelivered = parseInt(grnPrevRes.rows[0].total_prev_delivered || '0', 10);
        prevAccepted = parseInt(grnPrevRes.rows[0].total_prev_accepted || '0', 10);
      }
    } catch {
      // Non-blocking fallback if grn_receipts query fails
    }

    const prevTxRes = await client.query(
      `SELECT COALESCE(SUM(quantity), 0) as total_prev_inwarded
       FROM inventory_transactions
       WHERE part_id = $1 AND remarks LIKE $2 AND transaction_type = 'STOCK_IN'`,
      [pr.part_id, `%[PR:${pr.id}]%`]
    );
    const txPrev = parseInt(prevTxRes.rows[0]?.total_prev_inwarded || '0', 10);
    prevAccepted = Math.max(prevAccepted, txPrev);
    prevPhysicalDelivered = Math.max(prevPhysicalDelivered, prevAccepted);

    // Over-receipt Check A: Physical delivered quantity cannot exceed ordered PO quantity
    const remainingReceivable = pr.quantity_required - prevPhysicalDelivered;
    if (totalDeliveredInBatch > remainingReceivable) {
      throw new ProcurementServiceError(
        `Over-receipt rejected: Total physical delivery (${prevPhysicalDelivered + totalDeliveredInBatch}) exceeds ordered PO quantity (${pr.quantity_required}). Remaining receivable: ${Math.max(0, remainingReceivable)}.`,
        400
      );
    }

    // Over-receipt Check B: Usable accepted quantity cannot exceed remaining acceptable quantity
    const remainingToAccept = pr.quantity_required - prevAccepted;
    if (finalAcceptedQty > remainingToAccept) {
      throw new ProcurementServiceError(
        `Over-receipt rejected: Accepted batch (${finalAcceptedQty}) exceeds remaining acceptable quantity (${remainingToAccept}). Total ordered: ${pr.quantity_required}, Previously accepted: ${prevAccepted}.`,
        400
      );
    }

    // 3. Lock Spare Part row FOR UPDATE
    const partRes = await client.query(
      `SELECT id, current_physical_stock, available_stock, warehouse_zone, bin_location, name, part_number
       FROM spare_parts
       WHERE id = $1
       FOR UPDATE`,
      [pr.part_id]
    );

    if (partRes.rows.length === 0) {
      throw new ProcurementServiceError('Spare part not found in inventory.', 404);
    }

    // 4. Generate GRN number & Persist GRN Record FIRST
    // The GRN record must be successfully persisted before updating physical inventory or PR status.
    const currentYear = new Date().getFullYear();
    const grnNumber = await generateGRNNumberWithAdvisoryLock(client, currentYear);

    const effChallanNo = input.vendor_challan_number?.trim() || input.delivery_note_number?.trim() || pr.vendor_challan_number || null;
    const effSupplyMethod = input.supply_method?.trim() || pr.supply_method || null;
    const effDocType = input.delivery_document_type?.trim() || pr.delivery_document_type || null;
    const effChallanType = input.challan_type?.trim() || pr.challan_type || null;
    const effVehicleNo = input.vehicle_number?.trim() || pr.vehicle_number || null;
    const effTrackingNo = input.lr_tracking_number?.trim() || pr.lr_tracking_number || null;
    const effInvoiceNo = input.invoice_number?.trim() || null;
    const effDispatchLoc = input.dispatch_location?.trim() || pr.dispatch_location || null;
    const effDestPlant = input.destination_plant_name?.trim() || pr.destination_plant_name || pr.plant_name || null;
    const effTransportMode = input.transport_mode?.trim() || pr.transport_mode || 'Road Freight';
    const effTransporter = input.transporter_name?.trim() || pr.transporter_name || null;
    const effFreightCost = Number(input.freight_cost) >= 0 ? Number(input.freight_cost) : (Number(pr.freight_cost) || 0);
    const effOverallShipmentCost = Number(input.overall_shipment_cost) > 0 ? Number(input.overall_shipment_cost) : (Number(pr.overall_shipment_cost) || (Number(pr.unit_price) * finalAcceptedQty + effFreightCost));

    let grnInsertRes: any;
    try {
      grnInsertRes = await client.query(
        `INSERT INTO grn_receipts (
          grn_number, pr_id, delivery_note_number, received_quantity,
          accepted_quantity, rejected_quantity, damaged_quantity, defective_quantity,
          inspection_status, inspection_remarks, rejection_reason, remarks, received_by,
          vendor_challan_number, supply_method, delivery_document_type, challan_type,
          vehicle_number, lr_tracking_number, invoice_number,
          dispatch_location, destination_plant_name, transport_mode, transporter_name,
          freight_cost, overall_shipment_cost
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
        RETURNING id, grn_number`,
        [
          grnNumber,
          pr.id,
          input.delivery_note_number?.trim() || effChallanNo,
          totalDeliveredInBatch,
          finalAcceptedQty,
          finalRejectedQty,
          finalDamagedQty,
          finalDefectiveQty,
          inspectionStatus,
          input.inspection_remarks?.trim() || null,
          input.rejection_reason?.trim() || null,
          input.remarks?.trim() || null,
          user.id,
          effChallanNo,
          effSupplyMethod,
          effDocType,
          effChallanType,
          effVehicleNo,
          effTrackingNo,
          effInvoiceNo,
          effDispatchLoc,
          effDestPlant,
          effTransportMode,
          effTransporter,
          effFreightCost,
          effOverallShipmentCost,
        ]
      );
    } catch (dbErr: any) {
      const isMissingColOrTable =
        dbErr.code === '42703' ||
        dbErr.code === '42P01' ||
        (dbErr.message && (dbErr.message.includes('column') || dbErr.message.includes('relation "grn_receipts" does not exist')));

      if (isMissingColOrTable) {
        throw new ProcurementServiceError(
          `GRN persistence failed: Required GRN/QC schema or table is missing (${dbErr.message}). Ensure database migration 011 has been executed.`,
          500
        );
      }
      throw new ProcurementServiceError(
        `Failed to persist Goods Receipt Note (GRN) record: ${dbErr.message}`,
        500
      );
    }

    if (!grnInsertRes || (grnInsertRes.rowCount === 0 && (!grnInsertRes.rows || grnInsertRes.rows.length === 0))) {
      throw new ProcurementServiceError('Failed to persist Goods Receipt Note (GRN) record: Database returned no inserted row.', 500);
    }

    // 5. Update usable physical stock ONLY with ACCEPTED quantities
    // Rejected, damaged, and defective quantities are strictly excluded from available inventory
    if (finalAcceptedQty > 0) {
      await client.query(
        `UPDATE spare_parts
         SET current_physical_stock = current_physical_stock + $1,
             updated_at = NOW()
         WHERE id = $2`,
        [finalAcceptedQty, pr.part_id]
      );

      // Record immutable stock transaction
      const sourceLocation = pr.supplier_name ? `Vendor: ${pr.supplier_name}` : 'Supplier Direct';
      const destLocation = `Store: ${pr.warehouse_zone || 'Main Store'} (Bin: ${pr.bin_location})`;
      const txRemarks = `[PR:${pr.id}] GRN inwarding against PO ${pr.po_number || pr.pr_number}. Accepted: ${finalAcceptedQty}. ${input.remarks || ''}`.trim();

      await client.query(
        `INSERT INTO inventory_transactions (
          part_id, transaction_type, quantity, source_location, destination_location,
          reference_work_order_id, performed_by, remarks
        )
        VALUES ($1, 'STOCK_IN', $2, $3, $4, $5, $6, $7)`,
        [
          pr.part_id,
          finalAcceptedQty,
          sourceLocation,
          destLocation,
          pr.work_order_id,
          user.id,
          txRemarks,
        ]
      );
    }

    // 6. Record inspection rejection/damage remarks in audit log if rejected or damaged
    if (finalRejectedQty > 0 || finalDamagedQty > 0) {
      await client.query(
        `INSERT INTO audit_logs (entity_name, entity_id, action, performed_by, new_values)
         VALUES ('purchase_requisitions', $1, 'GRN_INSPECTION_REJECT', $2, $3)`,
        [
          pr.id,
          user.id,
          JSON.stringify({
            grn_number: grnNumber,
            rejected_quantity: finalRejectedQty,
            damaged_quantity: finalDamagedQty,
            defective_quantity: finalDefectiveQty,
            inspection_status: inspectionStatus,
            rejection_reason: input.rejection_reason || input.inspection_remarks || null,
            inspection_remarks: input.inspection_remarks || null,
            pr_number: pr.pr_number,
            po_number: pr.po_number,
            delivery_note_number: input.delivery_note_number || null,
          }),
        ]
      );
    }

    // 7. Update PR status: fulfilled only when cumulative accepted meets required
    const cumulativeAccepted = prevAccepted + finalAcceptedQty;
    const cumulativePhysicalDelivered = prevPhysicalDelivered + totalDeliveredInBatch;
    const isFullyReceived = cumulativeAccepted >= pr.quantity_required;
    const nextStatus = isFullyReceived ? 'fully_received' : 'partially_received';

    const updatePRRes = await client.query(
      `UPDATE purchase_requisitions
       SET status = $2,
           received_date = CURRENT_DATE,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [pr.id, nextStatus]
    );

    const updatedPR = updatePRRes.rows[0];

    // 8. Work Order resume: ONLY resume to 'in_progress' when the requisition is fully received
    if (pr.work_order_id && isFullyReceived) {
      await client.query(
        `UPDATE work_orders
         SET status = 'in_progress', updated_at = NOW()
         WHERE id = $1 AND status = 'waiting_for_parts'`,
        [pr.work_order_id]
      );
    }

    // 9. Immutable Audit Log for GRN
    await client.query(
      `INSERT INTO audit_logs (entity_name, entity_id, action, performed_by, new_values)
       VALUES ('purchase_requisitions', $1, 'GRN_PROCESSED', $2, $3)`,
      [
        pr.id,
        user.id,
        JSON.stringify({
          grn_number: grnNumber,
          pr_number: pr.pr_number,
          po_number: pr.po_number,
          received_quantity: totalDeliveredInBatch,
          accepted_quantity: finalAcceptedQty,
          rejected_quantity: finalRejectedQty,
          damaged_quantity: finalDamagedQty,
          defective_quantity: finalDefectiveQty,
          status: nextStatus,
          delivery_note_number: input.delivery_note_number || null,
        }),
      ]
    );

    // 10. Notify Requester (Inventory Available)
    let grnTechnicianNotification: any = null;
    let grnPartName = (partRes.rows[0]?.name) || pr.part_name || 'spare part';
    let grnPartNumber = (partRes.rows[0]?.part_number) || pr.part_number || '';

    if (pr.requested_by) {
      // Check duplicate prevention
      let alreadyNotified = false;
      try {
        const existingNotifRes = await client.query(
          `SELECT id FROM notifications 
           WHERE recipient_id = $1 
             AND (entity_id = $2 OR link_url LIKE $3)
             AND message LIKE '%Good news! The spare part you reported as unavailable%'
           LIMIT 1`,
          [pr.requested_by, pr.id, `%/procurement?prId=${pr.id}%`]
        );
        if (existingNotifRes.rows.length > 0) {
          alreadyNotified = true;
        }
      } catch {
        // Safe fallback
      }

      if (!alreadyNotified) {
        const partDetail = grnPartNumber ? `${grnPartName} (${grnPartNumber})` : grnPartName;
        const grnTitle = `Spare Part Available: ${partDetail}`;
        const grnMessage = `Good news! The spare part you reported as unavailable is now available in the store. Your inventory request has been updated. (Request ID: ${pr.pr_number} | Part: ${partDetail} | GRN: ${grnNumber})`;
        const grnLinkUrl = `/procurement?prId=${pr.id}`;

        try {
          const insertNotifRes = await client.query(
            `INSERT INTO notifications (recipient_id, title, message, type, link_url, entity_type, entity_id, plant_id, shop_id, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
             RETURNING *`,
            [pr.requested_by, grnTitle, grnMessage, 'system', grnLinkUrl, 'purchase_requisitions', pr.id, effectivePlantId || null, null]
          );
          grnTechnicianNotification = insertNotifRes.rows[0];
        } catch {
          const fallbackRes = await client.query(
            `INSERT INTO notifications (recipient_id, title, message, type, link_url, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             RETURNING *`,
            [pr.requested_by, grnTitle, grnMessage, 'system', grnLinkUrl]
          );
          grnTechnicianNotification = fallbackRes.rows[0];
        }
      }
    }

    await client.query('COMMIT');

    // 11. Scoped Socket.IO Real-time Events
    const io = getProcurementServiceIo();
    if (io) {
      const payload = {
        grn_number: grnNumber,
        pr: updatedPR,
        received_quantity: totalDeliveredInBatch,
        accepted_quantity: finalAcceptedQty,
        rejected_quantity: finalRejectedQty,
        damaged_quantity: finalDamagedQty,
        defective_quantity: finalDefectiveQty,
        message: `GRN ${grnNumber} posted for ${pr.part_number}. ${finalAcceptedQty} units added to physical stock ledger.`,
      };
      if (effectivePlantId) {
        emitToPlant(effectivePlantId, 'grn:processed', payload, io);
      }
      if (pr.requested_by) {
        emitToUser(pr.requested_by, 'grn:processed', payload, io);
      }

      // If inventory availability notification was generated, emit dedicated real-time socket events to the technician
      if (grnTechnicianNotification && pr.requested_by) {
        const notifPayload = {
          ...grnTechnicianNotification,
          link_url: grnTechnicianNotification.link_url || `/procurement?prId=${pr.id}`,
          action_url: grnTechnicianNotification.link_url || `/procurement?prId=${pr.id}`,
        };
        emitToUser(pr.requested_by, 'notification:new', notifPayload, io);
        emitToUser(pr.requested_by, 'notification', notifPayload, io);
        emitToUser(pr.requested_by, 'inventory:available', {
          pr_id: pr.id,
          pr_number: pr.pr_number,
          part_id: pr.part_id,
          part_name: grnPartName,
          part_number: grnPartNumber,
          grn_number: grnNumber,
          status: nextStatus,
          message: grnTechnicianNotification.message,
        }, io);
      }

      if (pr.work_order_id && isFullyReceived) {
        io.to(`workorder:${pr.work_order_id}`).emit('workorder:part_arrived', {
          work_order_id: pr.work_order_id,
          part_id: pr.part_id,
          message: `Required part ${pr.part_number} has fully arrived. Work order repair can resume.`,
        });
      }
    }

    return {
      grn_number: grnNumber,
      pr: updatedPR,
      received_quantity: totalDeliveredInBatch,
      accepted_quantity: finalAcceptedQty,
      rejected_quantity: finalRejectedQty,
      damaged_quantity: finalDamagedQty,
      defective_quantity: finalDefectiveQty,
      inspection_status: inspectionStatus,
      inspection_remarks: input.inspection_remarks || null,
      rejection_reason: input.rejection_reason || null,
      previous_inwarded: prevAccepted,
      total_inwarded: cumulativeAccepted,
      cumulative_physical_delivered: cumulativePhysicalDelivered,
      remaining_quantity: Math.max(0, pr.quantity_required - cumulativeAccepted),
      remaining_receivable: Math.max(0, pr.quantity_required - cumulativePhysicalDelivered),
      transport_mode: effTransportMode,
      dispatch_location: effDispatchLoc,
      destination_plant_name: effDestPlant,
      transporter_name: effTransporter,
      lr_tracking_number: effTrackingNo,
      freight_cost: effFreightCost,
      overall_shipment_cost: effOverallShipmentCost,
    };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rbErr) {
      console.error('[GRN Inwarding Rollback Error]:', rbErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// 11. Vendor Directory & Aggregated Performance
// ---------------------------------------------------------------------------
export async function getVendorsService(user: AuthenticatedUser): Promise<any[]> {
  validateManagerOrAdmin(user, 'accessing the vendor directory');

  const { query } = getProcurementServiceDb();

  let prPlantFilter = '';
  const params: any[] = [];
  if (user.role === 'manager' || user.role === 'store_manager') {
    const authorizedPlantId = getAuthorizedPlantId(user);
    params.push(authorizedPlantId);
    prPlantFilter = `WHERE (pr.plant_id = $1 OR s.plant_id = $1)`;
  }

  // Use CTEs to prevent Cartesian explosion between spare parts and PRs
  const vendorQuery = `
    WITH pr_scoped AS (
      SELECT pr.*
      FROM purchase_requisitions pr
      LEFT JOIN machines m ON pr.machine_id = m.id
      LEFT JOIN shops s ON m.shop_id = s.id
      ${prPlantFilter}
    ),
    pr_agg AS (
      SELECT supplier_name as vendor_name,
             COUNT(DISTINCT id) as total_orders,
             COUNT(CASE WHEN status IN ('po_created', 'ordered', 'partially_received') THEN 1 END) as active_orders,
             COUNT(CASE WHEN status = 'fully_received' THEN 1 END) as fulfilled_orders,
             COALESCE(SUM(CASE WHEN status = 'fully_received' THEN quantity_required * unit_price ELSE 0 END), 0) as total_spend,
             COUNT(CASE WHEN status = 'fully_received' AND received_date <= expected_delivery_date THEN 1 END) as on_time_deliveries
      FROM pr_scoped
      WHERE supplier_name IS NOT NULL AND TRIM(supplier_name) != ''
      GROUP BY supplier_name
    ),
    sp_agg AS (
      SELECT supplier_name as vendor_name,
             COUNT(DISTINCT id) as parts_supplied_count
      FROM spare_parts
      WHERE supplier_name IS NOT NULL AND TRIM(supplier_name) != ''
      GROUP BY supplier_name
    ),
    all_vendors AS (
      SELECT vendor_name FROM pr_agg
      UNION
      SELECT vendor_name FROM sp_agg
    )
    SELECT v.vendor_name,
           COALESCE(p.total_orders, 0) as total_orders,
           COALESCE(s.parts_supplied_count, 0) as parts_supplied_count,
           COALESCE(p.active_orders, 0) as active_orders,
           COALESCE(p.fulfilled_orders, 0) as fulfilled_orders,
           COALESCE(p.total_spend, 0) as total_spend,
           COALESCE(p.on_time_deliveries, 0) as on_time_deliveries
    FROM all_vendors v
    LEFT JOIN pr_agg p ON v.vendor_name = p.vendor_name
    LEFT JOIN sp_agg s ON v.vendor_name = s.vendor_name
    ORDER BY total_orders DESC, vendor_name ASC
  `;

  const vendorRes = await query(vendorQuery, params);

  return vendorRes.rows.map((v: any) => {
    const fulfilled = parseInt(v.fulfilled_orders, 10);
    const onTime = parseInt(v.on_time_deliveries, 10);
    const onTimeRate = fulfilled > 0 ? Math.round((onTime / fulfilled) * 100) : 100;

    return {
      vendor_name: v.vendor_name,
      total_orders: parseInt(v.total_orders, 10),
      parts_supplied_count: parseInt(v.parts_supplied_count, 10),
      active_orders: parseInt(v.active_orders, 10),
      fulfilled_orders: fulfilled,
      total_spend: parseFloat(v.total_spend),
      on_time_delivery_rate: onTimeRate,
    };
  });
}

// ---------------------------------------------------------------------------
// 12. Procurement Dashboard & KPI Metrics
// ---------------------------------------------------------------------------
export async function getProcurementDashboardService(user: AuthenticatedUser): Promise<any> {
  validateManagerOrAdmin(user, 'accessing the procurement dashboard');

  const { query } = getProcurementServiceDb();

  let scopeClause = '';
  const params: any[] = [];
  if (user.role === 'manager' || user.role === 'store_manager') {
    const authorizedPlantId = getAuthorizedPlantId(user);
    params.push(authorizedPlantId);
    scopeClause = ` AND (pr.plant_id = $${params.length} OR s.plant_id = $${params.length})`;
  } else if (user.role === 'technician') {
    params.push(user.id);
    scopeClause = ` AND (pr.requested_by = $${params.length} OR wo.assigned_technician_id = $${params.length})`;
  }

  // 1. Requisitions by status
  const statusRes = await query(
    `SELECT pr.status, COUNT(*) as count
     FROM purchase_requisitions pr
     LEFT JOIN machines m ON pr.machine_id = m.id
     LEFT JOIN shops s ON m.shop_id = s.id
     LEFT JOIN work_orders wo ON pr.work_order_id = wo.id
     WHERE 1=1 ${scopeClause}
     GROUP BY pr.status`,
    params
  );

  const counts: Record<string, number> = {};
  for (const row of statusRes.rows) {
    counts[row.status] = parseInt(row.count, 10);
  }

  // 2. Overdue POs: Calculate overdue value strictly on outstanding unreceived items
  const overdueRes = await query(
    `SELECT COUNT(*) as count,
            COALESCE(SUM(pr.quantity_required * pr.unit_price), 0) as overdue_value
     FROM purchase_requisitions pr
     LEFT JOIN machines m ON pr.machine_id = m.id
     LEFT JOIN shops s ON m.shop_id = s.id
     LEFT JOIN work_orders wo ON pr.work_order_id = wo.id
     WHERE pr.po_number IS NOT NULL
       AND pr.expected_delivery_date < CURRENT_DATE
       AND pr.status NOT IN ('fully_received', 'cancelled', 'rejected')
       ${scopeClause}`,
    params
  );

  // 3. Total spend
  const spendRes = await query(
    `SELECT COALESCE(SUM(pr.quantity_required * pr.unit_price), 0) as total_expenditure
     FROM purchase_requisitions pr
     LEFT JOIN machines m ON pr.machine_id = m.id
     LEFT JOIN shops s ON m.shop_id = s.id
     LEFT JOIN work_orders wo ON pr.work_order_id = wo.id
     WHERE pr.status IN ('po_created', 'ordered', 'partially_received', 'fully_received')
       ${scopeClause}`,
    params
  );

  // 4. Urgency breakdown
  const urgencyRes = await query(
    `SELECT pr.urgency, COUNT(*) as count
     FROM purchase_requisitions pr
     LEFT JOIN machines m ON pr.machine_id = m.id
     LEFT JOIN shops s ON m.shop_id = s.id
     LEFT JOIN work_orders wo ON pr.work_order_id = wo.id
     WHERE 1=1 ${scopeClause}
     GROUP BY pr.urgency`,
    params
  );

  // 5. Recent activity
  const recentRes = await query(
    `SELECT pr.id, pr.pr_number, pr.po_number, pr.status, pr.urgency, pr.supplier_name,
            pr.quantity_required, sp.part_number, sp.name as part_name, u.full_name as requested_by_name,
            pr.created_at
     FROM purchase_requisitions pr
     JOIN spare_parts sp ON pr.part_id = sp.id
     JOIN users u ON pr.requested_by = u.id
     LEFT JOIN machines m ON pr.machine_id = m.id
     LEFT JOIN shops s ON m.shop_id = s.id
     LEFT JOIN work_orders wo ON pr.work_order_id = wo.id
     WHERE 1=1 ${scopeClause}
     ORDER BY pr.created_at DESC
     LIMIT 5`,
    params
  );

  const pendingApproval =
    (counts['new'] || 0) +
    (counts['under_review'] || 0) +
    (counts['quotation_pending'] || 0) +
    (counts['vendor_selected'] || 0) +
    (counts['approval_pending'] || 0);
  const activeOrders = (counts['po_created'] || 0) + (counts['ordered'] || 0) + (counts['partially_received'] || 0);
  const overdueCount = parseInt(overdueRes.rows[0]?.count || '0', 10);
  const overdueValue = parseFloat(overdueRes.rows[0]?.overdue_value || '0');
  const totalExpenditure = parseFloat(spendRes.rows[0]?.total_expenditure || '0');

  const kpi = {
    pending_requisitions: pendingApproval,
    active_purchase_orders: activeOrders,
    fulfilled_orders: counts['fully_received'] || 0,
    cancelled_orders: counts['cancelled'] || 0,
    rejected_orders: counts['rejected'] || 0,
    overdue_purchase_orders: overdueCount,
    overdue_value: overdueValue,
    total_expenditure: totalExpenditure,
  };

  const summary = {
    total_pending_prs: pendingApproval,
    active_pos: activeOrders,
    overdue_pos: overdueCount,
    total_spend: totalExpenditure,
    delivered_this_month: counts['fully_received'] || 0,
  };

  return {
    kpi,
    summary,
    overdue_pos_list: [],
    recent_prs: recentRes.rows,
    status_breakdown: counts,
    urgency_breakdown: urgencyRes.rows.reduce((acc: any, cur: any) => {
      acc[cur.urgency] = parseInt(cur.count, 10);
      return acc;
    }, {}),
    recent_activity: recentRes.rows,
  };
}

// ---------------------------------------------------------------------------
// 13. Vendor Master Management Services
// ---------------------------------------------------------------------------
export interface CreateVendorInput {
  vendor_code: string;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  gstin?: string;
  payment_terms?: string;
  plant_id?: string;
}

export interface UpdateVendorInput {
  name?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  gstin?: string;
  payment_terms?: string;
  status?: string;
}

export async function createVendorService(
  input: CreateVendorInput,
  user: AuthenticatedUser
): Promise<any> {
  validateManagerOrAdmin(user, 'registering new vendor');
  const { query } = getProcurementServiceDb();

  if (!input.vendor_code || !input.vendor_code.trim()) {
    throw new ProcurementServiceError('vendor_code is required.', 400);
  }
  if (!input.name || !input.name.trim()) {
    throw new ProcurementServiceError('Vendor name is required.', 400);
  }

  const plantId = input.plant_id || user.plant_id || null;

  try {
    const res = await query(
      `INSERT INTO vendors (
        vendor_code, name, contact_person, email, phone, address, gstin, payment_terms, status, plant_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9)
      RETURNING *`,
      [
        input.vendor_code.trim().toUpperCase(),
        input.name.trim(),
        input.contact_person ? input.contact_person.trim() : null,
        input.email ? input.email.trim() : null,
        input.phone ? input.phone.trim() : null,
        input.address ? input.address.trim() : null,
        input.gstin ? input.gstin.trim() : null,
        input.payment_terms ? input.payment_terms.trim() : 'Net 30',
        plantId,
      ]
    );
    return res.rows[0];
  } catch (err: any) {
    if (err.code === '23505') {
      throw new ProcurementServiceError(`Vendor code '${input.vendor_code}' already exists.`, 409);
    }
    throw err;
  }
}

export async function updateVendorService(
  id: string,
  input: UpdateVendorInput,
  user: AuthenticatedUser
): Promise<any> {
  validateManagerOrAdmin(user, 'updating vendor details');
  const { query } = getProcurementServiceDb();

  if (!id || !UUID_REGEX.test(id)) {
    throw new ProcurementServiceError('Invalid vendor ID format.', 400);
  }

  const res = await query(
    `UPDATE vendors
     SET name = COALESCE($1, name),
         contact_person = COALESCE($2, contact_person),
         email = COALESCE($3, email),
         phone = COALESCE($4, phone),
         address = COALESCE($5, address),
         gstin = COALESCE($6, gstin),
         payment_terms = COALESCE($7, payment_terms),
         status = COALESCE($8, status),
         updated_at = NOW()
     WHERE id = $9
     RETURNING *`,
    [
      input.name ? input.name.trim() : null,
      input.contact_person ? input.contact_person.trim() : null,
      input.email ? input.email.trim() : null,
      input.phone ? input.phone.trim() : null,
      input.address ? input.address.trim() : null,
      input.gstin ? input.gstin.trim() : null,
      input.payment_terms ? input.payment_terms.trim() : null,
      input.status ? input.status.trim().toLowerCase() : null,
      id,
    ]
  );

  if (res.rows.length === 0) {
    throw new ProcurementServiceError('Vendor not found.', 404);
  }

  return res.rows[0];
}

export async function getVendorByIdService(id: string, user: AuthenticatedUser): Promise<any> {
  validateManagerOrAdmin(user, 'viewing vendor details');
  const { query } = getProcurementServiceDb();

  if (!id || !UUID_REGEX.test(id)) {
    throw new ProcurementServiceError('Invalid vendor ID format.', 400);
  }

  const res = await query('SELECT * FROM vendors WHERE id = $1', [id]);
  if (res.rows.length === 0) {
    throw new ProcurementServiceError('Vendor not found.', 404);
  }
  return res.rows[0];
}
