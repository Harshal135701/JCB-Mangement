import { query as defaultQuery, pool as defaultPool } from '../../config/db';
import { getIo, emitToUser } from '../../config/socket';
import { AuthenticatedUser } from '../../middlewares/auth.middleware';
import { createAndSendNotification } from '../notifications/notifications.service';
import {
  CreateRdcInput,
  UpdateRdcInput,
  SubmitRdcInput,
  ApproveRdcInput,
  RejectRdcInput,
  DispatchRdcInput,
  RecordReturnInput,
  RecordReplacementInput,
  RecordDamageInput,
  WriteOffInput,
  CancelRdcInput,
  RdcFilterQuery,
  RdcChallanRecord,
  RdcDashboardMetrics,
  RdcType,
  RdcStatus,
  RdcPriority,
} from './rdc.types';

export class RdcServiceError extends Error {
  public readonly statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = 'RdcServiceError';
    this.statusCode = statusCode;
  }
}

export type QueryFn = (
  text: string,
  params?: any[]
) => Promise<{ rows: any[]; rowCount?: number | null }>;

export interface DatabaseQueryable {
  query: QueryFn;
}

let activeQuery: QueryFn = defaultQuery;
let activePool: any = defaultPool;
let customIo: any = undefined;

export function setRdcServiceDb(customPool: any, customQuery?: QueryFn): void {
  activePool = customPool || defaultPool;
  activeQuery = customQuery || (customPool ? customPool.query.bind(customPool) : defaultQuery);
}

export function resetRdcServiceDb(): void {
  activePool = defaultPool;
  activeQuery = defaultQuery;
}

export function setRdcServiceIo(custom: any): void {
  customIo = custom;
}

export function resetRdcServiceIo(): void {
  customIo = undefined;
}

export function getRdcServiceDb(): { pool: any; query: QueryFn } {
  return { pool: activePool, query: activeQuery };
}

// ---------------------------------------------------------------------------
// Concurrency-Safe Number Generation
// ---------------------------------------------------------------------------
export async function generateChallanNumber(
  client: DatabaseQueryable,
  rdcType: RdcType,
  year: number
): Promise<string> {
  const lockKey = `rdc_challan_seq:${rdcType}:${year}`;
  await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [lockKey]);

  const prefix = `${rdcType}-${year}-`;
  const maxRes = await client.query(
    `SELECT MAX(SUBSTRING(challan_number FROM length($1) + 1)) as max_seq
     FROM rdc_challans
     WHERE challan_number LIKE $2`,
    [prefix, `${prefix}%`]
  );

  let nextSeq = 1;
  const rawMax = maxRes.rows[0]?.max_seq;
  if (rawMax) {
    const parsed = parseInt(rawMax, 10);
    if (!isNaN(parsed)) {
      nextSeq = parsed + 1;
    }
  }

  return `${prefix}${String(nextSeq).padStart(5, '0')}`;
}

export async function generateGatePassNumber(
  client: DatabaseQueryable,
  year: number
): Promise<string> {
  const lockKey = `rdc_gate_pass_seq:${year}`;
  await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [lockKey]);

  const prefix = `GP-${year}-`;
  const maxRes = await client.query(
    `SELECT MAX(SUBSTRING(gate_pass_number FROM length($1) + 1)) as max_seq
     FROM rdc_challans
     WHERE gate_pass_number LIKE $2`,
    [prefix, `${prefix}%`]
  );

  let nextSeq = 1;
  const rawMax = maxRes.rows[0]?.max_seq;
  if (rawMax) {
    const parsed = parseInt(rawMax, 10);
    if (!isNaN(parsed)) {
      nextSeq = parsed + 1;
    }
  }

  return `${prefix}${String(nextSeq).padStart(5, '0')}`;
}

export async function generateDamageReportNumber(
  client: DatabaseQueryable,
  year: number
): Promise<string> {
  const lockKey = `dmg_report_seq:${year}`;
  await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [lockKey]);

  const prefix = `DMG-${year}-`;
  const maxRes = await client.query(
    `SELECT MAX(SUBSTRING(report_number FROM length($1) + 1)) as max_seq
     FROM damaged_stock_items
     WHERE report_number LIKE $2`,
    [prefix, `${prefix}%`]
  );

  let nextSeq = 1;
  const rawMax = maxRes.rows[0]?.max_seq;
  if (rawMax) {
    const parsed = parseInt(rawMax, 10);
    if (!isNaN(parsed)) {
      nextSeq = parsed + 1;
    }
  }

  return `${prefix}${String(nextSeq).padStart(5, '0')}`;
}

// ---------------------------------------------------------------------------
// Security & Plant Scoping Helpers
// ---------------------------------------------------------------------------
export function validatePlantAccess(
  user: AuthenticatedUser,
  recordPlantId: string | null | undefined,
  action: string = 'access this challan'
): void {
  if (user.role === 'admin') return;

  if (user.plant_id && recordPlantId && user.plant_id !== recordPlantId) {
    throw new RdcServiceError(
      `Forbidden: Cannot ${action} outside your assigned plant.`,
      403
    );
  }
}

export function validateShopAccess(
  user: AuthenticatedUser,
  recordShopId: string | null | undefined,
  action: string = 'access this challan'
): void {
  if (user.role === 'admin' || user.role === 'manager' || user.role === 'store_manager') return;

  if (user.shop_id && recordShopId && user.shop_id !== recordShopId) {
    throw new RdcServiceError(
      `Forbidden: Cannot ${action} outside your assigned shop.`,
      403
    );
  }
}

// ---------------------------------------------------------------------------
// Configurable Approval Level Check
// ---------------------------------------------------------------------------
export async function verifyApprovalAuthority(
  client: DatabaseQueryable,
  user: AuthenticatedUser,
  priority: RdcPriority,
  totalValue: number,
  plantId?: string | null
): Promise<{ level: number; requiredRole: string }> {
  // Only Managers and Administrators are authorized to approve delivery challans
  if (!['admin', 'manager'].includes(user.role)) {
    throw new RdcServiceError(
      'Forbidden: Only Managers or Administrators are authorized to approve delivery challans.',
      403
    );
  }

  // Administrators have global executive sign-off authority across all values and priorities
  if (user.role === 'admin') {
    return { level: 2, requiredRole: 'admin' };
  }

  // Query configurable approval rules from database
  // Order priority:
  // 1. Exact priority match before 'ALL' (e.g. 'emergency' before 'ALL')
  // 2. Specific plant before global default (plant_id match before NULL)
  // 3. Higher approval level first
  let configRes = await client.query(
    `SELECT * FROM rdc_approval_configs
     WHERE is_active = TRUE
       AND (plant_id IS NULL OR plant_id = $1)
       AND (priority = $2 OR priority = 'ALL')
       AND min_value <= $3
       AND (max_value IS NULL OR max_value >= $3)
     ORDER BY 
       CASE WHEN priority = $2 THEN 0 ELSE 1 END,
       CASE WHEN plant_id = $1 THEN 0 ELSE 1 END,
       approval_level DESC
     LIMIT 1`,
    [plantId || null, priority, totalValue]
  );

  if (configRes.rows.length === 0) {
    // Fallback query without priority match
    configRes = await client.query(
      `SELECT * FROM rdc_approval_configs
       WHERE is_active = TRUE
         AND (plant_id IS NULL OR plant_id = $1)
         AND min_value <= $2
         AND (max_value IS NULL OR max_value >= $2)
       ORDER BY 
         CASE WHEN plant_id = $1 THEN 0 ELSE 1 END,
         approval_level DESC
       LIMIT 1`,
      [plantId || null, totalValue]
    );
  }

  const rule = configRes.rows[0];
  if (rule) {
    const allowedRoles = String(rule.required_role || '')
      .split(/[,|]/)
      .map((r: string) => r.trim().toLowerCase())
      .filter(Boolean);

    // If the rule strictly requires 'admin' (and does not include 'manager')
    if (allowedRoles.includes('admin') && !allowedRoles.includes('manager')) {
      throw new RdcServiceError(
        `Approval requires Administrator authorization. Configured policy requires '${rule.required_role}' for material value ₹${totalValue} or priority '${priority}'.`,
        403
      );
    }
    return { level: rule.approval_level, requiredRole: rule.required_role };
  }

  // Safe fallback default: Emergency priority strictly requires Administrator authorization
  if (priority === 'emergency') {
    throw new RdcServiceError(
      'Approval requires Administrator authorization. Material value exceeds standard manager limit or has emergency priority.',
      403
    );
  }

  return { level: 1, requiredRole: 'manager' };
}

// ---------------------------------------------------------------------------
// Audit & Notification Helpers
// ---------------------------------------------------------------------------
export async function createRdcAuditLog(
  client: DatabaseQueryable,
  challanId: string,
  action: string,
  userId: string,
  oldValues: any = null,
  newValues: any = null
): Promise<void> {
  await client.query(
    `INSERT INTO audit_logs (entity_name, entity_id, action, performed_by, old_values, new_values, created_at)
     VALUES ('rdc_challans', $1, $2, $3, $4, $5, NOW())`,
    [challanId, action, userId, oldValues ? JSON.stringify(oldValues) : null, newValues ? JSON.stringify(newValues) : null]
  );
}

export async function notifyUsers(
  client: DatabaseQueryable,
  recipientIds: string[],
  title: string,
  message: string,
  type: 'info' | 'warning' | 'critical' | 'assignment' | 'approval' = 'info',
  challanId?: string,
  plantId?: string | null
): Promise<void> {
  const uniqueRecipients = Array.from(new Set(recipientIds.filter(Boolean)));
  for (const recipientId of uniqueRecipients) {
    try {
      await createAndSendNotification(
        {
          recipientId,
          title,
          message,
          type,
          linkUrl: challanId ? `/rdc?challanId=${challanId}` : '/rdc',
          entityType: 'rdc_challans',
          entityId: challanId,
          plantId: plantId || undefined,
        },
        client,
        customIo || getIo()
      );
    } catch (e) {
      // Non-blocking notification failure
      console.warn('[RDC Notification Warning]:', e);
    }
  }
}

// ---------------------------------------------------------------------------
// Service Methods
// ---------------------------------------------------------------------------

/**
 * 1. Create Delivery Challan (RDC / NRDC)
 */
export async function createChallanService(
  input: CreateRdcInput,
  user: AuthenticatedUser
): Promise<RdcChallanRecord> {
  if (user.role === 'operator') {
    throw new RdcServiceError('Forbidden: Operators cannot create delivery challans.', 403);
  }

  const { pool } = getRdcServiceDb();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const effectivePlantId = input.plant_id || user.plant_id || null;
    validatePlantAccess(user, effectivePlantId, 'create challan for');

    // Vendor resolution
    let vendorPartyName = input.vendor_party_name || input.vendor_name || '';
    let vendorGstin = input.vendor_gstin || '';
    let vendorAddress = input.vendor_address || '';
    let contactPerson = input.contact_person || '';

    if (input.vendor_id) {
      const vRes = await client.query('SELECT * FROM vendors WHERE id = $1', [input.vendor_id]);
      if (vRes.rows.length > 0) {
        const v = vRes.rows[0];
        vendorPartyName = vendorPartyName || v.name;
        vendorGstin = vendorGstin || v.gstin || '';
        vendorAddress = vendorAddress || v.address || '';
        contactPerson = contactPerson || v.contact_person || '';
      }
    }

    if (!vendorPartyName || !input.purpose) {
      throw new RdcServiceError('Vendor party name and dispatch purpose are mandatory.', 400);
    }

    const currentYear = new Date().getFullYear();
    const rdcType: RdcType = input.rdc_type || 'RDC';
    const initialStatus: RdcStatus = input.save_as_draft ? 'draft' : 'pending_approval';

    // Calculate approximate material value across items
    let calculatedTotalValue = 0;
    for (const item of input.items) {
      const cost = item.unit_cost || 0;
      const val = item.approximate_value || cost * item.quantity_dispatched;
      calculatedTotalValue += val;
    }

    // Concurrency-safe challan number generation
    const challanNumber = await generateChallanNumber(client, rdcType, currentYear);

    const insertChallan = await client.query(
      `INSERT INTO rdc_challans (
        challan_number, rdc_type, plant_id, shop_id, work_order_id, machine_id,
        vendor_id, vendor_party_name, vendor_gstin, vendor_address, contact_person,
        purpose, priority, approximate_value, dispatch_date, expected_return_date,
        document_reference, status, created_by, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, COALESCE($15, CURRENT_DATE), $16, $17, $18, $19, NOW(), NOW())
      RETURNING *`,
      [
        challanNumber,
        rdcType,
        effectivePlantId,
        input.shop_id || user.shop_id || null,
        input.work_order_id || null,
        input.machine_id || null,
        input.vendor_id || null,
        vendorPartyName,
        vendorGstin,
        vendorAddress,
        contactPerson,
        input.purpose,
        input.priority || 'medium',
        calculatedTotalValue,
        input.dispatch_date || null,
        rdcType === 'RDC' ? (input.expected_return_date || null) : null,
        input.document_reference || null,
        initialStatus,
        user.id,
      ]
    );

    const challan = insertChallan.rows[0];

    // Insert line items
    const insertedItems: any[] = [];
    for (const item of input.items) {
      const approxVal = item.approximate_value || (item.unit_cost || 0) * item.quantity_dispatched;
      const itRes = await client.query(
        `INSERT INTO rdc_items (
          rdc_id, part_id, item_description, serial_number, quantity_dispatched,
          quantity_returned, quantity_replacement, quantity_damaged, quantity_written_off,
          unit_cost, approximate_value, remarks, disposition, created_at
        )
        VALUES ($1, $2, $3, $4, $5, 0, 0, 0, 0, $6, $7, $8, 'pending', NOW())
        RETURNING *`,
        [
          challan.id,
          item.part_id || null,
          item.item_description,
          item.serial_number || '',
          item.quantity_dispatched,
          item.unit_cost || 0,
          approxVal,
          item.remarks || null,
        ]
      );
      insertedItems.push(itRes.rows[0]);
    }

    // Regulatory audit log
    await createRdcAuditLog(
      client,
      challan.id,
      input.save_as_draft ? 'CREATE_DRAFT' : 'CREATE_AND_SUBMIT',
      user.id,
      null,
      { challan_number: challan.challan_number, status: initialStatus, total_value: calculatedTotalValue }
    );

    // If submitted for approval, notify managers of the plant
    if (initialStatus === 'pending_approval') {
      const mgrRes = await client.query(
        `SELECT id FROM users WHERE role IN ('manager', 'admin') AND is_active = TRUE AND (plant_id IS NULL OR plant_id = $1)`,
        [effectivePlantId]
      );
      const mgrIds = mgrRes.rows.map((r: any) => r.id).filter((id: string) => id !== user.id);
      await notifyUsers(
        client,
        mgrIds,
        `New ${rdcType} Approval Required: ${challan.challan_number}`,
        `${challan.challan_number} (${rdcType}) submitted by ${user.employee_code} for vendor ${vendorPartyName}.`,
        'approval',
        challan.id,
        effectivePlantId
      );
    }

    await client.query('COMMIT');
    return { ...challan, items: insertedItems };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * 2. Get Delivery Challans (List with Filters, Search, Pagination, No N+1)
 */
export async function getChallansService(
  queryFilter: RdcFilterQuery,
  user: AuthenticatedUser
): Promise<{ challans: RdcChallanRecord[]; total: number; page: number; limit: number }> {
  if (user.role === 'operator') {
    throw new RdcServiceError('Forbidden: Operators do not have access to delivery challans.', 403);
  }

  const { query } = getRdcServiceDb();
  const page = Math.max(1, queryFilter.page || 1);
  const limit = Math.min(200, Math.max(1, queryFilter.limit || 50));
  const offset = (page - 1) * limit;

  let whereSql = 'WHERE 1=1';
  const params: any[] = [];

  // Plant scoping
  if (user.role !== 'admin' && user.plant_id) {
    params.push(user.plant_id);
    whereSql += ` AND (r.plant_id = $${params.length} OR r.plant_id IS NULL)`;
  } else if (queryFilter.plant_id) {
    params.push(queryFilter.plant_id);
    whereSql += ` AND r.plant_id = $${params.length}`;
  }

  // Shop scoping
  if (queryFilter.shop_id) {
    params.push(queryFilter.shop_id);
    whereSql += ` AND r.shop_id = $${params.length}`;
  }

  // Vendor filter
  if (queryFilter.vendor_id) {
    params.push(queryFilter.vendor_id);
    whereSql += ` AND r.vendor_id = $${params.length}`;
  }

  // Status filter
  if (queryFilter.status && queryFilter.status !== 'all') {
    params.push(queryFilter.status);
    whereSql += ` AND r.status = $${params.length}`;
  }

  // Type filter
  if (queryFilter.rdc_type && queryFilter.rdc_type !== 'all') {
    params.push(queryFilter.rdc_type);
    whereSql += ` AND r.rdc_type = $${params.length}`;
  }

  // Priority filter
  if (queryFilter.priority && queryFilter.priority !== 'all') {
    params.push(queryFilter.priority);
    whereSql += ` AND r.priority = $${params.length}`;
  }

  // Search filter
  if (queryFilter.search && queryFilter.search.trim()) {
    params.push(`%${queryFilter.search.trim()}%`);
    whereSql += ` AND (r.challan_number ILIKE $${params.length} OR r.vendor_party_name ILIKE $${params.length} OR r.gate_pass_number ILIKE $${params.length} OR r.purpose ILIKE $${params.length})`;
  }

  // Date range filter
  if (queryFilter.start_date) {
    params.push(queryFilter.start_date);
    whereSql += ` AND r.created_at >= $${params.length}`;
  }
  if (queryFilter.end_date) {
    params.push(queryFilter.end_date);
    whereSql += ` AND r.created_at <= $${params.length}`;
  }

  // Count query
  const countRes = await query(
    `SELECT COUNT(*)::int as total
     FROM rdc_challans r
     ${whereSql}`,
    params
  );
  const total = countRes.rows[0]?.total || 0;

  // Sorting
  const sortByMap: Record<string, string> = {
    created_at: 'r.created_at',
    challan_number: 'r.challan_number',
    dispatch_date: 'r.dispatch_date',
    expected_return_date: 'r.expected_return_date',
    status: 'r.status',
    priority: 'r.priority',
  };
  const sortCol = sortByMap[queryFilter.sort_by || 'created_at'] || 'r.created_at';
  const sortDir = queryFilter.sort_order === 'asc' ? 'ASC' : 'DESC';

  // Main query with LEFT JOINs and Aggregated JSON items (eliminates N+1)
  const selectParams = [...params, limit, offset];
  const listSql = `
    SELECT
      r.*,
      p.plant_name,
      s.shop_name,
      m.machine_code,
      m.name as machine_name,
      wo.wo_number,
      u.full_name as created_by_name,
      app.full_name as approved_by_name,
      disp.full_name as dispatched_by_name,
      rej.full_name as rejected_by_name,
      COALESCE(
        json_agg(
          json_build_object(
            'id', ri.id,
            'rdc_id', ri.rdc_id,
            'part_id', ri.part_id,
            'item_description', ri.item_description,
            'serial_number', ri.serial_number,
            'quantity_dispatched', ri.quantity_dispatched,
            'quantity_returned', ri.quantity_returned,
            'quantity_replacement', ri.quantity_replacement,
            'quantity_damaged', ri.quantity_damaged,
            'quantity_written_off', ri.quantity_written_off,
            'unit_cost', ri.unit_cost,
            'approximate_value', ri.approximate_value,
            'remarks', ri.remarks,
            'disposition', ri.disposition,
            'created_at', ri.created_at
          )
        ) FILTER (WHERE ri.id IS NOT NULL),
        '[]'
      ) as items
    FROM rdc_challans r
    LEFT JOIN plants p ON r.plant_id = p.id
    LEFT JOIN shops s ON r.shop_id = s.id
    LEFT JOIN machines m ON r.machine_id = m.id
    LEFT JOIN work_orders wo ON r.work_order_id = wo.id
    LEFT JOIN users u ON r.created_by = u.id
    LEFT JOIN users app ON r.approved_by = app.id
    LEFT JOIN users disp ON r.dispatched_by = disp.id
    LEFT JOIN users rej ON r.rejected_by = rej.id
    LEFT JOIN rdc_items ri ON r.id = ri.rdc_id
    ${whereSql}
    GROUP BY r.id, p.plant_name, s.shop_name, m.machine_code, m.name, wo.wo_number, u.full_name, app.full_name, disp.full_name, rej.full_name
    ORDER BY ${sortCol} ${sortDir}
    LIMIT $${selectParams.length - 1} OFFSET $${selectParams.length}
  `;

  const result = await query(listSql, selectParams);
  return {
    challans: result.rows,
    total,
    page,
    limit,
  };
}

/**
 * 3. Get Single Challan by ID
 */
export async function getChallanByIdService(
  id: string,
  user: AuthenticatedUser
): Promise<RdcChallanRecord> {
  if (user.role === 'operator') {
    throw new RdcServiceError('Forbidden: Operators do not have access to delivery challans.', 403);
  }

  const { query } = getRdcServiceDb();
  const res = await query(
    `SELECT
       r.*,
       p.plant_name,
       s.shop_name,
       m.machine_code,
       m.name as machine_name,
       wo.wo_number,
       u.full_name as created_by_name,
       app.full_name as approved_by_name,
       disp.full_name as dispatched_by_name,
       rej.full_name as rejected_by_name
     FROM rdc_challans r
     LEFT JOIN plants p ON r.plant_id = p.id
     LEFT JOIN shops s ON r.shop_id = s.id
     LEFT JOIN machines m ON r.machine_id = m.id
     LEFT JOIN work_orders wo ON r.work_order_id = wo.id
     LEFT JOIN users u ON r.created_by = u.id
     LEFT JOIN users app ON r.approved_by = app.id
     LEFT JOIN users disp ON r.dispatched_by = disp.id
     LEFT JOIN users rej ON r.rejected_by = rej.id
     WHERE r.id = $1`,
    [id]
  );

  if (res.rows.length === 0) {
    throw new RdcServiceError('Delivery Challan not found.', 404);
  }

  const challan = res.rows[0];
  validatePlantAccess(user, challan.plant_id, 'view');

  const itemsRes = await query(
    `SELECT ri.*, sp.part_number, sp.name as part_name
     FROM rdc_items ri
     LEFT JOIN spare_parts sp ON ri.part_id = sp.id
     WHERE ri.rdc_id = $1
     ORDER BY ri.created_at ASC`,
    [id]
  );

  return { ...challan, items: itemsRes.rows };
}

/**
 * 4. Update Permitted Draft / Rejected Fields
 */
export async function updateChallanDraftService(
  id: string,
  input: UpdateRdcInput,
  user: AuthenticatedUser
): Promise<RdcChallanRecord> {
  const { pool } = getRdcServiceDb();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const sel = await client.query('SELECT * FROM rdc_challans WHERE id = $1 FOR UPDATE', [id]);
    if (sel.rows.length === 0) {
      throw new RdcServiceError('Delivery Challan not found.', 404);
    }
    const current = sel.rows[0];
    validatePlantAccess(user, current.plant_id, 'modify');

    if (!['draft', 'rejected'].includes(current.status)) {
      throw new RdcServiceError(
        `Cannot edit challan in '${current.status}' status. Only draft or rejected challans may be modified.`,
        400
      );
    }

    if (user.role !== 'admin' && user.role !== 'manager' && current.created_by !== user.id) {
      throw new RdcServiceError('Forbidden: Only the author or an authorized manager may edit this draft.', 403);
    }

    // Dynamic field update
    const updates: string[] = ['updated_at = NOW()'];
    const params: any[] = [id];

    if (input.plant_id !== undefined) {
      params.push(input.plant_id);
      updates.push(`plant_id = $${params.length}`);
    }
    if (input.shop_id !== undefined) {
      params.push(input.shop_id);
      updates.push(`shop_id = $${params.length}`);
    }
    if (input.work_order_id !== undefined) {
      params.push(input.work_order_id);
      updates.push(`work_order_id = $${params.length}`);
    }
    if (input.machine_id !== undefined) {
      params.push(input.machine_id);
      updates.push(`machine_id = $${params.length}`);
    }
    if (input.vendor_id !== undefined) {
      params.push(input.vendor_id);
      updates.push(`vendor_id = $${params.length}`);
    }
    if (input.vendor_party_name !== undefined) {
      params.push(input.vendor_party_name);
      updates.push(`vendor_party_name = $${params.length}`);
    }
    if (input.vendor_gstin !== undefined) {
      params.push(input.vendor_gstin);
      updates.push(`vendor_gstin = $${params.length}`);
    }
    if (input.vendor_address !== undefined) {
      params.push(input.vendor_address);
      updates.push(`vendor_address = $${params.length}`);
    }
    if (input.contact_person !== undefined) {
      params.push(input.contact_person);
      updates.push(`contact_person = $${params.length}`);
    }
    if (input.purpose !== undefined) {
      params.push(input.purpose);
      updates.push(`purpose = $${params.length}`);
    }
    if (input.priority !== undefined) {
      params.push(input.priority);
      updates.push(`priority = $${params.length}`);
    }
    if (input.expected_return_date !== undefined) {
      params.push(input.expected_return_date);
      updates.push(`expected_return_date = $${params.length}`);
    }
    if (input.document_reference !== undefined) {
      params.push(input.document_reference);
      updates.push(`document_reference = $${params.length}`);
    }

    const updSql = `UPDATE rdc_challans SET ${updates.join(', ')} WHERE id = $1 RETURNING *`;
    const updRes = await client.query(updSql, params);
    const updatedChallan = updRes.rows[0];

    // If items are provided, replace line items
    if (input.items && input.items.length > 0) {
      await client.query('DELETE FROM rdc_items WHERE rdc_id = $1', [id]);
      let totalVal = 0;
      for (const item of input.items) {
        const val = item.approximate_value || (item.unit_cost || 0) * item.quantity_dispatched;
        totalVal += val;
        await client.query(
          `INSERT INTO rdc_items (
            rdc_id, part_id, item_description, serial_number, quantity_dispatched,
            quantity_returned, quantity_replacement, quantity_damaged, quantity_written_off,
            unit_cost, approximate_value, remarks, disposition, created_at
          )
          VALUES ($1, $2, $3, $4, $5, 0, 0, 0, 0, $6, $7, $8, 'pending', NOW())`,
          [
            id,
            item.part_id || null,
            item.item_description,
            item.serial_number || '',
            item.quantity_dispatched,
            item.unit_cost || 0,
            val,
            item.remarks || null,
          ]
        );
      }
      await client.query('UPDATE rdc_challans SET approximate_value = $1 WHERE id = $2', [totalVal, id]);
      updatedChallan.approximate_value = totalVal;
    }

    await createRdcAuditLog(client, id, 'UPDATE_DRAFT', user.id, current, updatedChallan);
    await client.query('COMMIT');

    const itRes = await client.query('SELECT * FROM rdc_items WHERE rdc_id = $1', [id]);
    return { ...updatedChallan, items: itRes.rows };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * 5. Submit Challan for Approval
 */
export async function submitChallanService(
  id: string,
  input: SubmitRdcInput,
  user: AuthenticatedUser
): Promise<RdcChallanRecord> {
  const { pool } = getRdcServiceDb();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const sel = await client.query('SELECT * FROM rdc_challans WHERE id = $1 FOR UPDATE', [id]);
    if (sel.rows.length === 0) {
      throw new RdcServiceError('Delivery Challan not found.', 404);
    }
    const challan = sel.rows[0];
    validatePlantAccess(user, challan.plant_id, 'submit');

    if (!['draft', 'rejected'].includes(challan.status)) {
      throw new RdcServiceError(
        `Cannot submit challan in '${challan.status}' status. Challan must be in draft or rejected status to submit.`,
        400
      );
    }

    // Verify items exist
    const itemsRes = await client.query('SELECT COUNT(*)::int as count FROM rdc_items WHERE rdc_id = $1', [id]);
    if ((itemsRes.rows[0]?.count || 0) === 0) {
      throw new RdcServiceError('Cannot submit delivery challan without any line items.', 400);
    }

    const updRes = await client.query(
      `UPDATE rdc_challans
       SET status = 'pending_approval',
           submission_notes = $2,
           rejection_reason = NULL,
           rejected_by = NULL,
           rejected_at = NULL,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, input.notes || null]
    );
    const updated = updRes.rows[0];

    await createRdcAuditLog(client, id, 'SUBMIT', user.id, { status: challan.status }, { status: 'pending_approval', notes: input.notes });

    // Notify managers
    const mgrRes = await client.query(
      `SELECT id FROM users WHERE role IN ('manager', 'admin') AND is_active = TRUE AND (plant_id IS NULL OR plant_id = $1)`,
      [challan.plant_id]
    );
    const mgrIds = mgrRes.rows.map((r: any) => r.id).filter((mgrId: string) => mgrId !== user.id);
    await notifyUsers(
      client,
      mgrIds,
      `Delivery Challan Submitted for Approval: ${challan.challan_number}`,
      `Challan ${challan.challan_number} (${challan.rdc_type}) has been submitted for approval by ${user.employee_code}.`,
      'approval',
      id,
      challan.plant_id
    );

    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * 6. Approve Challan (Separation of duties & Configurable Hierarchy)
 */
export async function approveChallanService(
  id: string,
  input: ApproveRdcInput,
  user: AuthenticatedUser
): Promise<RdcChallanRecord> {
  const { pool } = getRdcServiceDb();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const sel = await client.query('SELECT * FROM rdc_challans WHERE id = $1 FOR UPDATE', [id]);
    if (sel.rows.length === 0) {
      throw new RdcServiceError('Delivery Challan not found.', 404);
    }
    const challan = sel.rows[0];
    validatePlantAccess(user, challan.plant_id, 'approve');

    if (challan.status !== 'pending_approval') {
      throw new RdcServiceError(
        `Cannot approve challan in '${challan.status}' status. Only challans in 'pending_approval' may be approved.`,
        400
      );
    }

    // Separation of Duties: NO SELF-APPROVAL
    if (challan.created_by === user.id) {
      throw new RdcServiceError(
        'Forbidden: Self-approval not permitted. Challans must be approved by an independent manager or administrator.',
        403
      );
    }

    // Check configurable approval authority
    const totalVal = parseFloat(challan.approximate_value || '0');
    await verifyApprovalAuthority(client, user, challan.priority, totalVal, challan.plant_id);

    const updRes = await client.query(
      `UPDATE rdc_challans
       SET status = 'approved',
           approved_by = $2,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, user.id]
    );
    const updated = updRes.rows[0];

    await createRdcAuditLog(
      client,
      id,
      'APPROVE',
      user.id,
      { status: challan.status },
      { status: 'approved', approved_by: user.id, remarks: input.remarks }
    );

    // Notify creator
    await notifyUsers(
      client,
      [challan.created_by],
      `Delivery Challan Approved: ${challan.challan_number}`,
      `Your challan ${challan.challan_number} has been approved by ${user.employee_code}. Ready for physical dispatch.`,
      'info',
      id,
      challan.plant_id
    );

    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * 7. Reject Challan with Mandatory Remarks
 */
export async function rejectChallanService(
  id: string,
  input: RejectRdcInput,
  user: AuthenticatedUser
): Promise<RdcChallanRecord> {
  const { pool } = getRdcServiceDb();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const sel = await client.query('SELECT * FROM rdc_challans WHERE id = $1 FOR UPDATE', [id]);
    if (sel.rows.length === 0) {
      throw new RdcServiceError('Delivery Challan not found.', 404);
    }
    const challan = sel.rows[0];
    validatePlantAccess(user, challan.plant_id, 'reject');

    if (challan.status !== 'pending_approval') {
      throw new RdcServiceError(
        `Cannot reject challan in '${challan.status}' status. Only pending_approval challans can be rejected.`,
        400
      );
    }

    if (user.role !== 'admin' && user.role !== 'manager') {
      throw new RdcServiceError('Forbidden: Only managers and administrators can reject delivery challans.', 403);
    }

    const updRes = await client.query(
      `UPDATE rdc_challans
       SET status = 'rejected',
           rejected_by = $2,
           rejected_at = NOW(),
           rejection_reason = $3,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, user.id, input.rejection_reason]
    );
    const updated = updRes.rows[0];

    await createRdcAuditLog(
      client,
      id,
      'REJECT',
      user.id,
      { status: challan.status },
      { status: 'rejected', rejection_reason: input.rejection_reason }
    );

    // Notify creator of rejection
    await notifyUsers(
      client,
      [challan.created_by],
      `Delivery Challan Rejected: ${challan.challan_number}`,
      `Challan ${challan.challan_number} rejected by ${user.employee_code}. Reason: ${input.rejection_reason}`,
      'warning',
      id,
      challan.plant_id
    );

    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * 8. Authorised Dispatch & Gate-Pass Generation (Real Inventory Movement)
 */
export async function dispatchChallanService(
  id: string,
  input: DispatchRdcInput,
  user: AuthenticatedUser
): Promise<RdcChallanRecord> {
  if (!['admin', 'manager', 'store_manager'].includes(user.role)) {
    throw new RdcServiceError(
      'Forbidden: Only Store Managers, Managers, or Admins are authorized to execute physical dispatch.',
      403
    );
  }

  const { pool } = getRdcServiceDb();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const sel = await client.query('SELECT * FROM rdc_challans WHERE id = $1 FOR UPDATE', [id]);
    if (sel.rows.length === 0) {
      throw new RdcServiceError('Delivery Challan not found.', 404);
    }
    const challan = sel.rows[0];
    validatePlantAccess(user, challan.plant_id, 'dispatch');

    if (challan.status !== 'approved') {
      throw new RdcServiceError(
        `Cannot dispatch challan in '${challan.status}' status. Challan must be formally approved prior to physical dispatch.`,
        400
      );
    }

    const currentYear = new Date().getFullYear();
    const gatePassNumber = input.gate_pass_number || (await generateGatePassNumber(client, currentYear));

    // Fetch line items
    const itemsRes = await client.query('SELECT * FROM rdc_items WHERE rdc_id = $1 FOR UPDATE', [id]);
    const items = itemsRes.rows;

    if (items.length === 0) {
      throw new RdcServiceError('Cannot dispatch delivery challan with no line items.', 400);
    }

    // Material movement: Validate stock availability and deduct from spare_parts
    for (const item of items) {
      if (item.part_id) {
        // Lock part row
        const partRes = await client.query(
          `SELECT * FROM spare_parts WHERE id = $1 FOR UPDATE`,
          [item.part_id]
        );
        if (partRes.rows.length === 0) {
          throw new RdcServiceError(`Spare part ID '${item.part_id}' in challan line items not found.`, 404);
        }
        const part = partRes.rows[0];

        if (part.available_stock < item.quantity_dispatched) {
          throw new RdcServiceError(
            `Insufficient available stock for part '${part.part_number}' (${part.name}). Requested: ${item.quantity_dispatched}, Available: ${part.available_stock}.`,
            400
          );
        }

        // Decrement physical stock
        await client.query(
          `UPDATE spare_parts
           SET current_physical_stock = current_physical_stock - $1,
               updated_at = NOW()
           WHERE id = $2`,
          [item.quantity_dispatched, item.part_id]
        );

        // Record immutable audit ledger in inventory_transactions
        await client.query(
          `INSERT INTO inventory_transactions (
            part_id, transaction_type, quantity, source_location, destination_location,
            reference_work_order_id, performed_by, remarks, created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
          [
            item.part_id,
            'ISSUE',
            -item.quantity_dispatched,
            part.bin_location || 'Main Store',
            `Vendor: ${challan.vendor_party_name}`,
            challan.work_order_id || null,
            user.id,
            `Dispatched under Challan ${challan.challan_number} (Gate Pass: ${gatePassNumber})`,
          ]
        );
      }
    }

    // Determine target status:
    // If Non-Returnable (NRDC), it can be marked as 'closed' directly on dispatch, or 'dispatched'
    const targetStatus = challan.rdc_type === 'NRDC' ? 'closed' : 'dispatched';
    const isClosed = targetStatus === 'closed';

    const updRes = await client.query(
      `UPDATE rdc_challans
       SET status = $2::rdc_status,
           gate_pass_number = $3,
           vehicle_number = $4,
           transporter_name = $5,
           dispatched_by = $6::uuid,
           dispatched_at = NOW(),
           closed_at = CASE WHEN $7::boolean THEN NOW() ELSE NULL END,
           closed_by = CASE WHEN $7::boolean THEN $6::uuid ELSE NULL END,
           updated_at = NOW()
       WHERE id = $1::uuid
       RETURNING *`,
      [
        id,
        targetStatus,
        gatePassNumber,
        input.vehicle_number || null,
        input.transporter_name || null,
        user.id,
        isClosed,
      ]
    );
    const updated = updRes.rows[0];

    await createRdcAuditLog(
      client,
      id,
      'DISPATCH',
      user.id,
      { status: challan.status },
      { status: targetStatus, gate_pass_number: gatePassNumber, dispatched_by: user.id }
    );

    // Notify creator
    await notifyUsers(
      client,
      [challan.created_by],
      `Delivery Challan Dispatched: ${challan.challan_number}`,
      `Challan ${challan.challan_number} has been dispatched under Gate Pass ${gatePassNumber}.`,
      'info',
      id,
      challan.plant_id
    );

    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Recalculate and update overall Challan status after any return/replacement/damage/write-off
 */
async function syncChallanStatusAfterItemMutation(
  client: DatabaseQueryable,
  challanId: string
): Promise<string> {
  const challanRes = await client.query('SELECT * FROM rdc_challans WHERE id = $1', [challanId]);
  const challan = challanRes.rows[0];

  const itemsRes = await client.query(
    `SELECT quantity_dispatched, quantity_returned, quantity_replacement, quantity_damaged, quantity_written_off
     FROM rdc_items
     WHERE rdc_id = $1`,
    [challanId]
  );

  let allFullyAccounted = true;
  let anyAccounted = false;

  for (const it of itemsRes.rows) {
    const accounted = (it.quantity_returned || 0) + (it.quantity_replacement || 0) + (it.quantity_damaged || 0) + (it.quantity_written_off || 0);
    if (accounted > 0) anyAccounted = true;
    if (accounted < it.quantity_dispatched) allFullyAccounted = false;
  }

  let newStatus: RdcStatus = challan.status;
  if (allFullyAccounted) {
    newStatus = 'fully_returned';
  } else if (anyAccounted) {
    newStatus = 'partially_returned';
  } else {
    newStatus = 'dispatched';
  }

  const isFullyReturned = newStatus === 'fully_returned';
  await client.query(
    `UPDATE rdc_challans
     SET status = $1::rdc_status,
         actual_return_date = CASE WHEN $3::boolean THEN CURRENT_DATE ELSE actual_return_date END,
         updated_at = NOW()
     WHERE id = $2::uuid`,
    [newStatus, challanId, isFullyReturned]
  );

  return newStatus;
}

/**
 * 9. Record Return against a Specific Item (Normal Usable Return)
 */
export async function recordReturnService(
  challanId: string,
  input: RecordReturnInput,
  user: AuthenticatedUser
): Promise<RdcChallanRecord> {
  if (!['admin', 'manager', 'store_manager'].includes(user.role)) {
    throw new RdcServiceError(
      'Forbidden: Only Store Managers, Managers, or Admins are authorized to record material returns.',
      403
    );
  }

  const { pool } = getRdcServiceDb();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const challanRes = await client.query('SELECT * FROM rdc_challans WHERE id = $1 FOR UPDATE', [challanId]);
    if (challanRes.rows.length === 0) {
      throw new RdcServiceError('Delivery Challan not found.', 404);
    }
    const challan = challanRes.rows[0];
    validatePlantAccess(user, challan.plant_id, 'record return for');

    if (!['dispatched', 'partially_returned', 'overdue'].includes(challan.status)) {
      throw new RdcServiceError(
        `Cannot record return for challan in '${challan.status}' status. Challan must be dispatched or partially returned.`,
        400
      );
    }

    if (challan.rdc_type === 'NRDC') {
      throw new RdcServiceError('Cannot record returns on Non-Returnable Delivery Challans (NRDC).', 400);
    }

    const itemRes = await client.query(
      `SELECT * FROM rdc_items WHERE id = $1 AND rdc_id = $2 FOR UPDATE`,
      [input.item_id, challanId]
    );
    if (itemRes.rows.length === 0) {
      throw new RdcServiceError('Challan line item not found.', 404);
    }
    const item = itemRes.rows[0];

    const currentAccounted =
      (item.quantity_returned || 0) +
      (item.quantity_replacement || 0) +
      (item.quantity_damaged || 0) +
      (item.quantity_written_off || 0);

    const newTotalReturned = (item.quantity_returned || 0) + input.returned_quantity;
    const newTotalAccounted = currentAccounted + input.returned_quantity;

    if (newTotalAccounted > item.quantity_dispatched) {
      throw new RdcServiceError(
        `Over-return rejected: Total accounted quantity (${newTotalAccounted}) would exceed dispatched quantity (${item.quantity_dispatched}).`,
        400
      );
    }

    // Update item line
    await client.query(
      `UPDATE rdc_items
       SET quantity_returned = $1,
           disposition = CASE WHEN $2 >= quantity_dispatched THEN 'returned' ELSE disposition END
       WHERE id = $3`,
      [newTotalReturned, newTotalAccounted, input.item_id]
    );

    // Reconcile inventory: Increment physical stock for usable return
    if (item.part_id) {
      await client.query(
        `UPDATE spare_parts
         SET current_physical_stock = current_physical_stock + $1,
             updated_at = NOW()
         WHERE id = $2`,
        [input.returned_quantity, item.part_id]
      );

      await client.query(
        `INSERT INTO inventory_transactions (
          part_id, transaction_type, quantity, source_location, destination_location,
          reference_work_order_id, performed_by, remarks, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          item.part_id,
          'RETURN',
          input.returned_quantity,
          `Vendor: ${challan.vendor_party_name}`,
          'Main Store',
          challan.work_order_id || null,
          user.id,
          `Return received for Challan ${challan.challan_number}. ${input.remarks || ''}`.trim(),
        ]
      );
    }

    const newStatus = await syncChallanStatusAfterItemMutation(client, challanId);

    await createRdcAuditLog(
      client,
      challanId,
      'RECORD_RETURN',
      user.id,
      { item_id: input.item_id, returned_before: item.quantity_returned },
      { returned_quantity: input.returned_quantity, new_status: newStatus }
    );

    await notifyUsers(
      client,
      [challan.created_by],
      `Return Recorded on Challan: ${challan.challan_number}`,
      `Quantity ${input.returned_quantity} recorded for item '${item.item_description}'. Challan status: ${newStatus}.`,
      'info',
      challanId,
      challan.plant_id
    );

    await client.query('COMMIT');

    const updatedRes = await client.query('SELECT * FROM rdc_challans WHERE id = $1', [challanId]);
    return updatedRes.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * 10. Record Replacement Item Receipt (Stock In as Brand-New / Repaired Unit)
 */
export async function recordReplacementService(
  challanId: string,
  input: RecordReplacementInput,
  user: AuthenticatedUser
): Promise<RdcChallanRecord> {
  if (!['admin', 'manager', 'store_manager'].includes(user.role)) {
    throw new RdcServiceError(
      'Forbidden: Only Store Managers, Managers, or Admins are authorized to record replacement receipts.',
      403
    );
  }

  const { pool } = getRdcServiceDb();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const challanRes = await client.query('SELECT * FROM rdc_challans WHERE id = $1 FOR UPDATE', [challanId]);
    if (challanRes.rows.length === 0) {
      throw new RdcServiceError('Delivery Challan not found.', 404);
    }
    const challan = challanRes.rows[0];
    validatePlantAccess(user, challan.plant_id, 'record replacement for');

    if (!['dispatched', 'partially_returned', 'overdue'].includes(challan.status)) {
      throw new RdcServiceError(
        `Cannot record replacement for challan in '${challan.status}' status.`,
        400
      );
    }

    const itemRes = await client.query(
      `SELECT * FROM rdc_items WHERE id = $1 AND rdc_id = $2 FOR UPDATE`,
      [input.item_id, challanId]
    );
    if (itemRes.rows.length === 0) {
      throw new RdcServiceError('Challan line item not found.', 404);
    }
    const item = itemRes.rows[0];

    const currentAccounted =
      (item.quantity_returned || 0) +
      (item.quantity_replacement || 0) +
      (item.quantity_damaged || 0) +
      (item.quantity_written_off || 0);

    const newTotalReplacement = (item.quantity_replacement || 0) + input.replacement_quantity;
    const newTotalAccounted = currentAccounted + input.replacement_quantity;

    if (newTotalAccounted > item.quantity_dispatched) {
      throw new RdcServiceError(
        `Replacement rejected: Total accounted quantity (${newTotalAccounted}) would exceed dispatched quantity (${item.quantity_dispatched}).`,
        400
      );
    }

    // Update line item
    await client.query(
      `UPDATE rdc_items
       SET quantity_replacement = $1,
           disposition = CASE WHEN $2 >= quantity_dispatched THEN 'replaced' ELSE disposition END
       WHERE id = $3`,
      [newTotalReplacement, newTotalAccounted, input.item_id]
    );

    // Increase physical stock for received replacement
    if (item.part_id) {
      await client.query(
        `UPDATE spare_parts
         SET current_physical_stock = current_physical_stock + $1,
             updated_at = NOW()
         WHERE id = $2`,
        [input.replacement_quantity, item.part_id]
      );

      await client.query(
        `INSERT INTO inventory_transactions (
          part_id, transaction_type, quantity, source_location, destination_location,
          reference_work_order_id, performed_by, remarks, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          item.part_id,
          'STOCK_IN',
          input.replacement_quantity,
          `Vendor (Replacement): ${challan.vendor_party_name}`,
          'Main Store',
          challan.work_order_id || null,
          user.id,
          `Replacement unit received under Challan ${challan.challan_number}. ${input.new_serial_number ? `New S/N: ${input.new_serial_number}.` : ''} ${input.remarks || ''}`.trim(),
        ]
      );
    }

    const newStatus = await syncChallanStatusAfterItemMutation(client, challanId);

    await createRdcAuditLog(
      client,
      challanId,
      'RECORD_REPLACEMENT',
      user.id,
      { item_id: input.item_id, replacement_before: item.quantity_replacement },
      { replacement_quantity: input.replacement_quantity, new_serial_number: input.new_serial_number, new_status: newStatus }
    );

    await notifyUsers(
      client,
      [challan.created_by],
      `Replacement Unit Received: ${challan.challan_number}`,
      `Replacement unit received for item '${item.item_description}'. Status: ${newStatus}.`,
      'info',
      challanId,
      challan.plant_id
    );

    await client.query('COMMIT');

    const updatedRes = await client.query('SELECT * FROM rdc_challans WHERE id = $1', [challanId]);
    return updatedRes.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * 11. Report Damaged Returned Material (Strict Quarantine Segregation)
 */
export async function recordDamageService(
  challanId: string,
  input: RecordDamageInput,
  user: AuthenticatedUser
): Promise<RdcChallanRecord> {
  if (!['admin', 'manager', 'store_manager'].includes(user.role)) {
    throw new RdcServiceError(
      'Forbidden: Only Store Managers, Managers, or Admins are authorized to report damaged returns.',
      403
    );
  }

  const { pool } = getRdcServiceDb();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const challanRes = await client.query('SELECT * FROM rdc_challans WHERE id = $1 FOR UPDATE', [challanId]);
    if (challanRes.rows.length === 0) {
      throw new RdcServiceError('Delivery Challan not found.', 404);
    }
    const challan = challanRes.rows[0];
    validatePlantAccess(user, challan.plant_id, 'report damage for');

    if (!['dispatched', 'partially_returned', 'overdue'].includes(challan.status)) {
      throw new RdcServiceError(
        `Cannot report damage for challan in '${challan.status}' status.`,
        400
      );
    }

    const itemRes = await client.query(
      `SELECT * FROM rdc_items WHERE id = $1 AND rdc_id = $2 FOR UPDATE`,
      [input.item_id, challanId]
    );
    if (itemRes.rows.length === 0) {
      throw new RdcServiceError('Challan line item not found.', 404);
    }
    const item = itemRes.rows[0];

    const currentAccounted =
      (item.quantity_returned || 0) +
      (item.quantity_replacement || 0) +
      (item.quantity_damaged || 0) +
      (item.quantity_written_off || 0);

    const newTotalDamaged = (item.quantity_damaged || 0) + input.damaged_quantity;
    const newTotalAccounted = currentAccounted + input.damaged_quantity;

    if (newTotalAccounted > item.quantity_dispatched) {
      throw new RdcServiceError(
        `Damage quantity rejected: Total accounted quantity (${newTotalAccounted}) would exceed dispatched quantity (${item.quantity_dispatched}).`,
        400
      );
    }

    // Update item line
    await client.query(
      `UPDATE rdc_items
       SET quantity_damaged = $1,
           disposition = 'quarantined'
       WHERE id = $2`,
      [newTotalDamaged, input.item_id]
    );

    // CRITICAL: Stock Quarantine Segregation
    // Increments physical AND increments quarantined stock by equal amount.
    // Result: available_stock (physical - reserved - quarantined) is NOT increased!
    if (item.part_id) {
      await client.query(
        `UPDATE spare_parts
         SET current_physical_stock = current_physical_stock + $1,
             quarantined_stock = quarantined_stock + $1,
             updated_at = NOW()
         WHERE id = $2`,
        [input.damaged_quantity, item.part_id]
      );

      const currentYear = new Date().getFullYear();
      const dmgReportNumber = await generateDamageReportNumber(client, currentYear);

      // Record in damaged_stock_items
      await client.query(
        `INSERT INTO damaged_stock_items (
          report_number, part_id, plant_id, quantity, damage_type, disposition,
          reason, location, reported_by, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, 'quarantined', $6, $7, $8, NOW(), NOW())`,
        [
          dmgReportNumber,
          item.part_id,
          challan.plant_id,
          input.damaged_quantity,
          input.damage_type || 'defective',
          `RDC Damaged Return (${challan.challan_number}): ${input.reason}`,
          input.location || 'Quarantine Bay',
          user.id,
        ]
      );

      // Ledger entry
      await client.query(
        `INSERT INTO inventory_transactions (
          part_id, transaction_type, quantity, source_location, destination_location,
          reference_work_order_id, performed_by, remarks, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          item.part_id,
          'ADJUSTMENT',
          input.damaged_quantity,
          `Vendor: ${challan.vendor_party_name}`,
          'Quarantine Bay',
          challan.work_order_id || null,
          user.id,
          `Damaged material returned under Challan ${challan.challan_number}. Quarantined under ${dmgReportNumber}. Reason: ${input.reason}`,
        ]
      );
    }

    const newStatus = await syncChallanStatusAfterItemMutation(client, challanId);

    await createRdcAuditLog(
      client,
      challanId,
      'REPORT_DAMAGE',
      user.id,
      { item_id: input.item_id, damaged_before: item.quantity_damaged },
      { damaged_quantity: input.damaged_quantity, reason: input.reason, new_status: newStatus }
    );

    // Notify plant manager and creator of quarantine
    const mgrRes = await client.query(
      `SELECT id FROM users WHERE role IN ('manager', 'admin') AND is_active = TRUE AND (plant_id IS NULL OR plant_id = $1)`,
      [challan.plant_id]
    );
    const notifyIds = [challan.created_by, ...mgrRes.rows.map((r: any) => r.id)];
    await notifyUsers(
      client,
      notifyIds,
      `Damaged Material Quarantined: ${challan.challan_number}`,
      `Item '${item.item_description}' (${input.damaged_quantity} units) returned in damaged/defective condition. Moved to Quarantine.`,
      'critical',
      challanId,
      challan.plant_id
    );

    await client.query('COMMIT');

    const updatedRes = await client.query('SELECT * FROM rdc_challans WHERE id = $1', [challanId]);
    return updatedRes.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * 12. Authorised Write-off of Unreturned / Lost Material
 */
export async function recordWriteOffService(
  challanId: string,
  input: WriteOffInput,
  user: AuthenticatedUser
): Promise<RdcChallanRecord> {
  if (user.role !== 'admin' && user.role !== 'manager') {
    throw new RdcServiceError(
      'Forbidden: Only Managers or Administrators are authorized to perform material write-offs.',
      403
    );
  }

  const { pool } = getRdcServiceDb();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const challanRes = await client.query('SELECT * FROM rdc_challans WHERE id = $1 FOR UPDATE', [challanId]);
    if (challanRes.rows.length === 0) {
      throw new RdcServiceError('Delivery Challan not found.', 404);
    }
    const challan = challanRes.rows[0];
    validatePlantAccess(user, challan.plant_id, 'authorize write-off for');

    if (!['dispatched', 'partially_returned', 'overdue'].includes(challan.status)) {
      throw new RdcServiceError(
        `Cannot write off items for challan in '${challan.status}' status.`,
        400
      );
    }

    const itemRes = await client.query(
      `SELECT * FROM rdc_items WHERE id = $1 AND rdc_id = $2 FOR UPDATE`,
      [input.item_id, challanId]
    );
    if (itemRes.rows.length === 0) {
      throw new RdcServiceError('Challan line item not found.', 404);
    }
    const item = itemRes.rows[0];

    const currentAccounted =
      (item.quantity_returned || 0) +
      (item.quantity_replacement || 0) +
      (item.quantity_damaged || 0) +
      (item.quantity_written_off || 0);

    const newTotalWrittenOff = (item.quantity_written_off || 0) + input.writeoff_quantity;
    const newTotalAccounted = currentAccounted + input.writeoff_quantity;

    if (newTotalAccounted > item.quantity_dispatched) {
      throw new RdcServiceError(
        `Write-off rejected: Total accounted quantity (${newTotalAccounted}) would exceed dispatched quantity (${item.quantity_dispatched}).`,
        400
      );
    }

    // Update item line
    await client.query(
      `UPDATE rdc_items
       SET quantity_written_off = $1,
           disposition = 'written_off'
       WHERE id = $2`,
      [newTotalWrittenOff, input.item_id]
    );

    // Ledger entry for scrap / write-off (Stock was already decremented on dispatch)
    if (item.part_id) {
      await client.query(
        `INSERT INTO inventory_transactions (
          part_id, transaction_type, quantity, source_location, destination_location,
          reference_work_order_id, performed_by, remarks, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          item.part_id,
          'SCRAP',
          0,
          `Vendor: ${challan.vendor_party_name}`,
          'Written-Off / Disposed',
          challan.work_order_id || null,
          user.id,
          `Authorized write-off of ${input.writeoff_quantity} units under Challan ${challan.challan_number}. Reason: ${input.reason}`,
        ]
      );
    }

    const newStatus = await syncChallanStatusAfterItemMutation(client, challanId);

    await createRdcAuditLog(
      client,
      challanId,
      'WRITE_OFF',
      user.id,
      { item_id: input.item_id, written_off_before: item.quantity_written_off },
      { writeoff_quantity: input.writeoff_quantity, reason: input.reason, new_status: newStatus }
    );

    await notifyUsers(
      client,
      [challan.created_by],
      `Material Write-off Authorized: ${challan.challan_number}`,
      `Authorized write-off of ${input.writeoff_quantity} units on item '${item.item_description}'. Reason: ${input.reason}.`,
      'warning',
      challanId,
      challan.plant_id
    );

    await client.query('COMMIT');

    const updatedRes = await client.query('SELECT * FROM rdc_challans WHERE id = $1', [challanId]);
    return updatedRes.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * 13. Cancel Delivery Challan (Before Physical Dispatch)
 */
export async function cancelChallanService(
  challanId: string,
  input: CancelRdcInput,
  user: AuthenticatedUser
): Promise<RdcChallanRecord> {
  const { pool } = getRdcServiceDb();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const sel = await client.query('SELECT * FROM rdc_challans WHERE id = $1 FOR UPDATE', [challanId]);
    if (sel.rows.length === 0) {
      throw new RdcServiceError('Delivery Challan not found.', 404);
    }
    const challan = sel.rows[0];
    validatePlantAccess(user, challan.plant_id, 'cancel');

    // Cancellation is strictly permitted ONLY before physical dispatch
    if (['dispatched', 'partially_returned', 'fully_returned', 'closed'].includes(challan.status)) {
      throw new RdcServiceError(
        `Cannot cancel delivery challan in '${challan.status}' status. Material has already been physically dispatched. Outstanding balances must be resolved through return or write-off.`,
        400
      );
    }

    if (challan.status === 'cancelled') {
      throw new RdcServiceError('Delivery challan is already cancelled.', 400);
    }

    // Role check:
    // Technicians can cancel their own draft/pending challans.
    // Managers/Admins can cancel any draft/pending/approved challan before dispatch.
    if (user.role === 'technician' && challan.created_by !== user.id) {
      throw new RdcServiceError('Forbidden: Technicians can only cancel their own challans.', 403);
    }

    const updRes = await client.query(
      `UPDATE rdc_challans
       SET status = 'cancelled',
           cancelled_by = $2,
           cancelled_at = NOW(),
           cancellation_reason = $3,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [challanId, user.id, input.reason]
    );
    const updated = updRes.rows[0];

    await createRdcAuditLog(
      client,
      challanId,
      'CANCEL',
      user.id,
      { status: challan.status },
      { status: 'cancelled', cancellation_reason: input.reason }
    );

    // Notify creator if cancelled by a manager
    if (challan.created_by !== user.id) {
      await notifyUsers(
        client,
        [challan.created_by],
        `Delivery Challan Cancelled: ${challan.challan_number}`,
        `Challan ${challan.challan_number} was cancelled by ${user.employee_code}. Reason: ${input.reason}`,
        'warning',
        challanId,
        challan.plant_id
      );
    }

    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * 14. Close Delivery Challan (Reconciled or fully returned)
 * Valid transitions:
 * fully_returned -> closed
 * dispatched / partially_returned -> closed (only if all line items have zero outstanding quantity)
 */
export async function closeChallanService(
  challanId: string,
  user: AuthenticatedUser
): Promise<RdcChallanRecord> {
  const { pool } = getRdcServiceDb();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const sel = await client.query('SELECT * FROM rdc_challans WHERE id = $1 FOR UPDATE', [challanId]);
    if (sel.rows.length === 0) {
      throw new RdcServiceError('Delivery Challan not found.', 404);
    }
    const challan = sel.rows[0];
    validatePlantAccess(user, challan.plant_id, 'close');

    if (challan.status === 'closed') {
      throw new RdcServiceError('Delivery challan is already closed.', 400);
    }

    if (!['fully_returned', 'dispatched', 'partially_returned'].includes(challan.status)) {
      throw new RdcServiceError(
        `Cannot close delivery challan in '${challan.status}' status. Only dispatched or returned challans can be closed.`,
        400
      );
    }

    if (!['admin', 'manager', 'store_manager'].includes(user.role)) {
      throw new RdcServiceError('Only managers, store managers, or administrators can close delivery challans.', 403);
    }

    // Check item reconciliation invariant: all line items must have 0 outstanding quantity
    const itemsRes = await client.query('SELECT * FROM rdc_items WHERE rdc_id = $1', [challanId]);
    for (const it of itemsRes.rows) {
      const accounted =
        Number(it.quantity_returned || 0) +
        Number(it.quantity_replacement || 0) +
        Number(it.quantity_damaged || 0) +
        Number(it.quantity_written_off || 0);
      const outstanding = Number(it.quantity_dispatched || 0) - accounted;
      if (outstanding > 0) {
        throw new RdcServiceError(
          `Cannot close delivery challan: Item '${it.item_description}' has outstanding unaccounted balance of ${outstanding}. All quantities must be returned, replaced, or written off before closing.`,
          400
        );
      }
    }

    const upd = await client.query(
      `UPDATE rdc_challans
       SET status = 'closed',
           closed_by = $2,
           closed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [challanId, user.id]
    );

    await createRdcAuditLog(
      client,
      challanId,
      'CLOSE_CHALLAN',
      user.id,
      { previous_status: challan.status },
      { status: 'closed', closed_by: user.id }
    );

    if (challan.created_by !== user.id) {
      await notifyUsers(
        client,
        [challan.created_by],
        `Delivery Challan Closed: ${challan.challan_number}`,
        `Challan ${challan.challan_number} has been formally closed and marked reconciled by ${user.role}.`,
        'info',
        challanId,
        challan.plant_id
      );
    }

    await client.query('COMMIT');

    const fresh = await client.query('SELECT * FROM rdc_items WHERE rdc_id = $1', [challanId]);
    return {
      ...upd.rows[0],
      items: fresh.rows,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * 14. Audit History & Lifecycle Timeline
 */
export async function getChallanHistoryService(
  challanId: string,
  user: AuthenticatedUser
): Promise<any[]> {
  const { query } = getRdcServiceDb();

  const cRes = await query('SELECT plant_id FROM rdc_challans WHERE id = $1', [challanId]);
  if (cRes.rows.length === 0) {
    throw new RdcServiceError('Delivery Challan not found.', 404);
  }
  validatePlantAccess(user, cRes.rows[0].plant_id, 'view history of');

  const historyRes = await query(
    `SELECT
       a.id,
       a.action,
       a.performed_by,
       u.full_name as performed_by_name,
       u.employee_code as performed_by_code,
       u.role as performed_by_role,
       a.old_values,
       a.new_values,
       a.created_at
     FROM audit_logs a
     LEFT JOIN users u ON a.performed_by = u.id
     WHERE a.entity_name = 'rdc_challans' AND a.entity_id = $1
     ORDER BY a.created_at ASC`,
    [challanId]
  );

  return historyRes.rows;
}

/**
 * 15. Real Database-Backed Dashboard Metrics
 */
export async function getDashboardMetricsService(
  queryFilter: RdcFilterQuery,
  user: AuthenticatedUser
): Promise<RdcDashboardMetrics> {
  if (user.role === 'operator') {
    throw new RdcServiceError('Forbidden: Operators do not have access to RDC metrics.', 403);
  }

  const { query } = getRdcServiceDb();
  let whereSql = 'WHERE 1=1';
  const params: any[] = [];

  if (user.role !== 'admin' && user.plant_id) {
    params.push(user.plant_id);
    whereSql += ` AND (r.plant_id = $${params.length} OR r.plant_id IS NULL)`;
  } else if (queryFilter.plant_id) {
    params.push(queryFilter.plant_id);
    whereSql += ` AND r.plant_id = $${params.length}`;
  }

  if (queryFilter.shop_id) {
    params.push(queryFilter.shop_id);
    whereSql += ` AND r.shop_id = $${params.length}`;
  }

  if (queryFilter.vendor_id) {
    params.push(queryFilter.vendor_id);
    whereSql += ` AND r.vendor_id = $${params.length}`;
  }

  if (queryFilter.start_date) {
    params.push(queryFilter.start_date);
    whereSql += ` AND r.created_at >= $${params.length}`;
  }

  if (queryFilter.end_date) {
    params.push(queryFilter.end_date);
    whereSql += ` AND r.created_at <= $${params.length}`;
  }

  // Aggregate status counts
  const statusRes = await query(
    `SELECT
       COUNT(*)::int as total_challans,
       COUNT(*) FILTER (WHERE r.rdc_type = 'RDC')::int as total_rdc,
       COUNT(*) FILTER (WHERE r.rdc_type = 'NRDC')::int as total_nrdc,
       COUNT(*) FILTER (WHERE r.status = 'pending_approval')::int as pending_approval,
       COUNT(*) FILTER (WHERE r.status = 'approved')::int as approved_not_dispatched,
       COUNT(*) FILTER (WHERE r.status = 'dispatched')::int as currently_dispatched,
       COUNT(*) FILTER (WHERE r.status = 'partially_returned')::int as partially_returned,
       COUNT(*) FILTER (WHERE r.status = 'fully_returned')::int as fully_returned,
       COUNT(*) FILTER (WHERE r.status = 'closed')::int as closed,
       COUNT(*) FILTER (WHERE r.status = 'cancelled')::int as cancelled,
       COUNT(*) FILTER (
         WHERE r.rdc_type = 'RDC'
           AND r.status IN ('dispatched', 'partially_returned')
           AND r.expected_return_date IS NOT NULL
           AND r.expected_return_date < CURRENT_DATE
       )::int as overdue_returns
     FROM rdc_challans r
     ${whereSql}`,
    params
  );
  const counts = statusRes.rows[0] || {};

  // Outstanding Material Quantity and Value Calculation
  const outstandingRes = await query(
    `SELECT
       COALESCE(SUM(ri.quantity_dispatched - (ri.quantity_returned + ri.quantity_replacement + ri.quantity_damaged + ri.quantity_written_off)), 0)::int as total_outstanding_quantity,
       COALESCE(SUM(
         (ri.quantity_dispatched - (ri.quantity_returned + ri.quantity_replacement + ri.quantity_damaged + ri.quantity_written_off)) *
         CASE WHEN ri.unit_cost > 0 THEN ri.unit_cost ELSE (ri.approximate_value / NULLIF(ri.quantity_dispatched, 0)) END
       ), 0)::numeric(14,2) as total_outstanding_value
     FROM rdc_items ri
     JOIN rdc_challans r ON ri.rdc_id = r.id
     ${whereSql}
       AND r.rdc_type = 'RDC'
       AND r.status IN ('dispatched', 'partially_returned')`,
    params
  );
  const outData = outstandingRes.rows[0] || {};

  // Recent Challans (5 latest)
  const recentRes = await query(
    `SELECT
       r.*,
       p.plant_name,
       s.shop_name,
       u.full_name as created_by_name
     FROM rdc_challans r
     LEFT JOIN plants p ON r.plant_id = p.id
     LEFT JOIN shops s ON r.shop_id = s.id
     LEFT JOIN users u ON r.created_by = u.id
     ${whereSql}
     ORDER BY r.created_at DESC
     LIMIT 5`,
    params
  );

  return {
    total_rdc: counts.total_rdc || 0,
    total_nrdc: counts.total_nrdc || 0,
    pending_approval: counts.pending_approval || 0,
    approved_not_dispatched: counts.approved_not_dispatched || 0,
    currently_dispatched: counts.currently_dispatched || 0,
    partially_returned: counts.partially_returned || 0,
    fully_returned: counts.fully_returned || 0,
    closed: counts.closed || 0,
    cancelled: counts.cancelled || 0,
    overdue_returns: counts.overdue_returns || 0,
    total_outstanding_quantity: outData.total_outstanding_quantity || 0,
    total_outstanding_value: parseFloat(outData.total_outstanding_value || '0'),
    recent_challans: recentRes.rows,
  };
}

/**
 * 16. Overdue Delivery Challans Report
 */
export async function getOverdueChallansService(
  queryFilter: RdcFilterQuery,
  user: AuthenticatedUser
): Promise<any[]> {
  if (user.role === 'operator') {
    throw new RdcServiceError('Forbidden: Operators do not have access to overdue records.', 403);
  }

  const { query } = getRdcServiceDb();
  let whereSql = `
    WHERE r.rdc_type = 'RDC'
      AND r.status IN ('dispatched', 'partially_returned')
      AND r.expected_return_date IS NOT NULL
      AND r.expected_return_date < CURRENT_DATE
  `;
  const params: any[] = [];

  if (user.role !== 'admin' && user.plant_id) {
    params.push(user.plant_id);
    whereSql += ` AND (r.plant_id = $${params.length} OR r.plant_id IS NULL)`;
  } else if (queryFilter.plant_id) {
    params.push(queryFilter.plant_id);
    whereSql += ` AND r.plant_id = $${params.length}`;
  }

  if (queryFilter.shop_id) {
    params.push(queryFilter.shop_id);
    whereSql += ` AND r.shop_id = $${params.length}`;
  }

  if (queryFilter.vendor_id) {
    params.push(queryFilter.vendor_id);
    whereSql += ` AND r.vendor_id = $${params.length}`;
  }

  const overdueSql = `
    SELECT
      r.*,
      p.plant_name,
      s.shop_name,
      u.full_name as created_by_name,
      (CURRENT_DATE - r.expected_return_date)::int as days_overdue,
      COALESCE(
        json_agg(
          json_build_object(
            'id', ri.id,
            'part_id', ri.part_id,
            'item_description', ri.item_description,
            'serial_number', ri.serial_number,
            'quantity_dispatched', ri.quantity_dispatched,
            'quantity_returned', ri.quantity_returned,
            'quantity_replacement', ri.quantity_replacement,
            'quantity_damaged', ri.quantity_damaged,
            'quantity_written_off', ri.quantity_written_off,
            'outstanding_quantity', (ri.quantity_dispatched - (ri.quantity_returned + ri.quantity_replacement + ri.quantity_damaged + ri.quantity_written_off))
          )
        ) FILTER (WHERE ri.id IS NOT NULL),
        '[]'
      ) as items
    FROM rdc_challans r
    LEFT JOIN plants p ON r.plant_id = p.id
    LEFT JOIN shops s ON r.shop_id = s.id
    LEFT JOIN users u ON r.created_by = u.id
    LEFT JOIN rdc_items ri ON r.id = ri.rdc_id
    ${whereSql}
    GROUP BY r.id, p.plant_name, s.shop_name, u.full_name
    ORDER BY days_overdue DESC
  `;

  const res = await query(overdueSql, params);
  return res.rows;
}

/**
 * 17. Delete Delivery Challan (Draft, Rejected, or Cancelled status only)
 */
export async function deleteChallanService(
  challanId: string,
  user: AuthenticatedUser
): Promise<{ id: string; message: string }> {
  const { pool } = getRdcServiceDb();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const sel = await client.query('SELECT * FROM rdc_challans WHERE id = $1 FOR UPDATE', [challanId]);
    if (sel.rows.length === 0) {
      throw new RdcServiceError('Delivery Challan not found.', 404);
    }
    const challan = sel.rows[0];
    validatePlantAccess(user, challan.plant_id, 'delete');

    if (!['draft', 'rejected', 'cancelled'].includes(challan.status)) {
      throw new RdcServiceError(
        `Cannot delete delivery challan in '${challan.status}' status. Only draft, rejected, or cancelled challans can be deleted.`,
        400
      );
    }

    if (user.role === 'technician' && challan.created_by !== user.id) {
      throw new RdcServiceError('Forbidden: Technicians can only delete their own challans.', 403);
    }

    await client.query('DELETE FROM rdc_items WHERE rdc_id = $1', [challanId]);
    await client.query('DELETE FROM rdc_challans WHERE id = $1', [challanId]);

    await client.query('COMMIT');
    return {
      id: challanId,
      message: `Delivery Challan ${challan.challan_number} deleted successfully from database.`,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
