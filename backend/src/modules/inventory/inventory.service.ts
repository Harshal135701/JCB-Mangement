import { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { pool, query as defaultQuery } from '../../config/db';
import { AuthenticatedUser } from '../../middlewares/auth.middleware';

export type QueryFn = (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount?: number | null }>;

export interface DbClientLike {
  query: QueryFn;
  release: () => void;
}

export interface DbPoolLike {
  connect: () => Promise<DbClientLike>;
  query?: QueryFn;
}

let activePool: any = pool;
let activeQuery: QueryFn = defaultQuery as unknown as QueryFn;

export function setInventoryServiceDb(customPool: any, customQuery?: QueryFn): void {
  activePool = customPool;
  activeQuery = customQuery || (customPool.query ? customPool.query.bind(customPool) : async (text: string, params?: any[]) => {
    const client = await customPool.connect();
    try {
      return await client.query(text, params);
    } finally {
      client.release();
    }
  });
}

export function resetInventoryServiceDb(): void {
  activePool = pool;
  activeQuery = defaultQuery as unknown as QueryFn;
}

export function getInventoryServiceDb(): { pool: any; query: QueryFn } {
  return { pool: activePool, query: activeQuery };
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Domain error for inventory reservation operations.
 * Carries HTTP status code and optional metadata (such as availableStock).
 */
export class InventoryError extends Error {
  public readonly statusCode: number;
  public readonly availableStock?: number;

  constructor(message: string, statusCode: number, availableStock?: number) {
    super(message);
    this.name = 'InventoryError';
    this.statusCode = statusCode;
    this.availableStock = availableStock;
    Object.setPrototypeOf(this, InventoryError.prototype);
  }
}

/**
 * Eligible active work order statuses permitting spare parts reservation.
 * Work orders in inactive/terminal states ('submitted_verification', 'completed', 'verified_closed', 'on_hold')
 * are ineligible for reservation.
 */
export const ELIGIBLE_WORK_ORDER_STATUSES = Object.freeze([
  'assigned',
  'accepted',
  'scheduled',
  'under_diagnosis',
  'in_progress',
  'waiting_for_parts',
  'rework_required',
  'reopened',
] as const);

export type EligibleWorkOrderStatus = (typeof ELIGIBLE_WORK_ORDER_STATUSES)[number];

export interface ReservePartInput {
  work_order_id: string;
  part_id: string;
  quantity: number;
}

export interface WorkOrderRecord {
  id: string;
  wo_number: string;
  status: string;
  machine_id: string;
  assigned_technician_id: string | null;
  assigned_manager_id: string | null;
  shop_id: string;
  plant_id: string;
  shop_name: string;
  bay_line_location: string | null;
}

export interface SparePartRecord {
  id: string;
  part_number: string;
  oem_part_number?: string | null;
  name: string;
  description?: string | null;
  category?: string;
  subcategory?: string | null;
  uom?: string;
  warehouse_zone: string | null;
  bin_location: string;
  current_physical_stock: number;
  reserved_stock: number;
  quarantined_stock: number;
  available_stock: number;
  min_reorder_level?: number;
  max_stock_level?: number;
  unit_cost?: number;
  supplier_name?: string | null;
  status: string;
  updated_at?: string | Date;
}

export interface WoPartsConsumedRecord {
  id: string;
  work_order_id: string;
  part_id: string;
  quantity_requested: number;
  quantity_issued: number;
  quantity_installed: number;
  serial_number_installed?: string | null;
  serial_number_removed?: string | null;
  removed_part_disposition?: string;
  created_at: string | Date;
}

export interface InventoryTransactionRecord {
  id: string;
  part_id: string;
  transaction_type: string;
  quantity: number;
  source_location: string | null;
  destination_location: string | null;
  reference_work_order_id: string | null;
  performed_by: string;
  remarks: string | null;
  created_at: string | Date;
}

export interface ReservePartResult {
  consumption: WoPartsConsumedRecord;
  transaction: InventoryTransactionRecord;
  spare_part: {
    id: string;
    part_number: string;
    name: string;
    current_physical_stock: number;
    reserved_stock: number;
    available_stock: number;
  };
}

export interface QueryResultLike<R = any> {
  rows: R[];
  rowCount?: number | null;
}

export interface DatabaseQueryable {
  query<R = any>(text: string, values?: any[]): Promise<QueryResultLike<R>>;
}

export interface DatabasePoolLike {
  connect(): Promise<DatabaseQueryable & { release(): void }>;
}

/**
 * Validates role-based plant, shop, and technician assignment authorization
 * against the work order and machine context.
 */
export function validateWorkOrderAuthorization(
  wo: WorkOrderRecord,
  user: AuthenticatedUser
): void {
  // 1. Admin has global enterprise access across all plants and shops
  if (user.role === 'admin') {
    return;
  }

  // 2. Manager and Store Manager authorization: must match plant; and shop if user is scoped to a specific shop
  if (user.role === 'manager' || user.role === 'store_manager') {
    if (user.plant_id && wo.plant_id && user.plant_id !== wo.plant_id) {
      throw new InventoryError(
        'Forbidden: Cannot reserve parts for a work order in a different plant.',
        403
      );
    }
    if (user.role === 'manager' && user.shop_id && wo.shop_id && user.shop_id !== wo.shop_id && wo.assigned_manager_id !== user.id) {
      throw new InventoryError(
        'Forbidden: Cannot reserve parts for a work order in a different shop.',
        403
      );
    }
    return;
  }

  // 3. Technician authorization: must match plant, shop, and be assigned to the work order
  if (user.role === 'technician') {
    if (user.plant_id && wo.plant_id && user.plant_id !== wo.plant_id) {
      throw new InventoryError(
        'Forbidden: Cannot reserve parts for a work order in a different plant.',
        403
      );
    }
    if (user.shop_id && wo.shop_id && user.shop_id !== wo.shop_id) {
      throw new InventoryError(
        'Forbidden: Cannot reserve parts for a work order in a different shop.',
        403
      );
    }
    if (wo.assigned_technician_id !== user.id) {
      throw new InventoryError(
        'Forbidden: Technician is not assigned to this work order.',
        403
      );
    }
    return;
  }

  // Any other role is unauthorized
  throw new InventoryError(
    `Forbidden: Role '${user.role}' is not authorized to reserve inventory.`,
    403
  );
}

/**
 * Executes the entire reservation workflow inside an active PostgreSQL transaction.
 *
 * Sequence:
 * 1. Validate & Lock Work Order row (via JOIN machines, shops).
 * 2. Validate plant/shop authorization & active lifecycle status.
 * 3. Lock Spare Part row via SELECT ... FOR UPDATE.
 * 4. Validate stock availability (available_stock >= requested quantity).
 * 5. Update reserved_stock (available_stock is computed generated column).
 * 6. Upsert wo_parts_consumed (avoiding duplicate records, updating atomically).
 * 7. Insert immutable audit record into inventory_transactions.
 */
export async function executeReservationTransaction(
  client: DatabaseQueryable,
  input: ReservePartInput,
  user: AuthenticatedUser
): Promise<ReservePartResult> {
  // Step 1: Validate and lock work order with plant and shop joins
  const woQuery = `
    SELECT 
      wo.id,
      wo.wo_number,
      wo.status,
      wo.machine_id,
      wo.assigned_technician_id,
      wo.assigned_manager_id,
      m.shop_id,
      s.plant_id,
      s.shop_name,
      m.bay_line_location
    FROM work_orders wo
    JOIN machines m ON wo.machine_id = m.id
    JOIN shops s ON m.shop_id = s.id
    WHERE wo.id = $1
    FOR UPDATE OF wo
  `;

  const woRes = await client.query<WorkOrderRecord>(woQuery, [input.work_order_id]);
  if (woRes.rows.length === 0) {
    throw new InventoryError('Work order not found.', 404);
  }

  const wo = woRes.rows[0];

  // Step 2: Validate plant/shop authorization using authenticated user context
  validateWorkOrderAuthorization(wo, user);

  // Step 3: Validate work order status against allowed active statuses
  if (!ELIGIBLE_WORK_ORDER_STATUSES.includes(wo.status as EligibleWorkOrderStatus)) {
    throw new InventoryError(
      `Cannot reserve parts for work order ${wo.wo_number} with status '${wo.status}'. Part reservation is only permitted for active work orders.`,
      400
    );
  }

  // Step 4: Lock spare part row with PostgreSQL SELECT ... FOR UPDATE before stock check
  const partQuery = `
    SELECT 
      id,
      part_number,
      name,
      warehouse_zone,
      bin_location,
      current_physical_stock,
      reserved_stock,
      quarantined_stock,
      available_stock,
      status
    FROM spare_parts
    WHERE id = $1
    FOR UPDATE
  `;

  const partRes = await client.query<SparePartRecord>(partQuery, [input.part_id]);
  if (partRes.rows.length === 0) {
    throw new InventoryError('Spare part not found.', 404);
  }

  const part = partRes.rows[0];

  if (part.status && part.status.toLowerCase() !== 'active') {
    throw new InventoryError(
      `Spare part ${part.part_number} is inactive and cannot be reserved.`,
      400
    );
  }

  const currentAvailable = Number(part.available_stock);
  if (currentAvailable < input.quantity) {
    throw new InventoryError(
      `Stock Out: Only ${currentAvailable} units available in stock. Requested: ${input.quantity}. Please initiate PR.`,
      400,
      currentAvailable
    );
  }

  // Step 5: Update reserved stock only (never update generated available_stock directly)
  const updateStockQuery = `
    UPDATE spare_parts
    SET reserved_stock = reserved_stock + $1,
        updated_at = NOW()
    WHERE id = $2
    RETURNING id, part_number, name, current_physical_stock, reserved_stock, quarantined_stock, available_stock
  `;

  const updatedStockRes = await client.query<SparePartRecord>(updateStockQuery, [
    input.quantity,
    part.id,
  ]);
  const updatedPart = updatedStockRes.rows[0];

  // Step 6: Insert or update wo_parts_consumed atomically (no duplicate rows)
  const existingConsumedQuery = `
    SELECT id, work_order_id, part_id, quantity_requested, quantity_issued, quantity_installed, created_at
    FROM wo_parts_consumed
    WHERE work_order_id = $1 AND part_id = $2
    FOR UPDATE
  `;

  const existingConsumedRes = await client.query<WoPartsConsumedRecord>(
    existingConsumedQuery,
    [wo.id, part.id]
  );

  let consumptionRecord: WoPartsConsumedRecord;

  if (existingConsumedRes.rows.length > 0) {
    // Atomically increment quantity_requested on the existing consumption record
    const updateConsumedQuery = `
      UPDATE wo_parts_consumed
      SET quantity_requested = quantity_requested + $1
      WHERE id = $2
      RETURNING id, work_order_id, part_id, quantity_requested, quantity_issued, quantity_installed, created_at
    `;
    const updateConsumedRes = await client.query<WoPartsConsumedRecord>(
      updateConsumedQuery,
      [input.quantity, existingConsumedRes.rows[0].id]
    );
    consumptionRecord = updateConsumedRes.rows[0];
  } else {
    // Insert new consumption record using actual schema columns
    const insertConsumedQuery = `
      INSERT INTO wo_parts_consumed (
        work_order_id,
        part_id,
        quantity_requested,
        quantity_issued,
        quantity_installed
      ) VALUES ($1, $2, $3, 0, 0)
      RETURNING id, work_order_id, part_id, quantity_requested, quantity_issued, quantity_installed, created_at
    `;
    const insertConsumedRes = await client.query<WoPartsConsumedRecord>(
      insertConsumedQuery,
      [wo.id, part.id, input.quantity]
    );
    consumptionRecord = insertConsumedRes.rows[0];
  }

  // Step 7: Record immutable audit trail in inventory_transactions
  const sourceLocation = part.warehouse_zone
    ? `${part.warehouse_zone} (Bin: ${part.bin_location})`
    : `Bin: ${part.bin_location}`;
  const destLocation = `WO: ${wo.wo_number} (${wo.shop_name})`;
  const remarks = `Reserved ${input.quantity} unit(s) of ${part.part_number} for Work Order ${wo.wo_number}`;

  const insertTxQuery = `
    INSERT INTO inventory_transactions (
      part_id,
      transaction_type,
      quantity,
      source_location,
      destination_location,
      reference_work_order_id,
      performed_by,
      remarks,
      created_at
    ) VALUES ($1, 'RESERVATION', $2, $3, $4, $5, $6, $7, NOW())
    RETURNING id, part_id, transaction_type, quantity, source_location, destination_location, reference_work_order_id, performed_by, remarks, created_at
  `;

  const txRes = await client.query<InventoryTransactionRecord>(insertTxQuery, [
    part.id,
    input.quantity,
    sourceLocation,
    destLocation,
    wo.id,
    user.id,
    remarks,
  ]);
  const transactionRecord = txRes.rows[0];

  return {
    consumption: consumptionRecord,
    transaction: transactionRecord,
    spare_part: {
      id: updatedPart.id,
      part_number: updatedPart.part_number,
      name: updatedPart.name,
      current_physical_stock: Number(updatedPart.current_physical_stock),
      reserved_stock: Number(updatedPart.reserved_stock),
      available_stock: Number(updatedPart.available_stock),
    },
  };
}

/**
 * Top-level service function that acquires a dedicated client from the pool,
 * controls BEGIN / COMMIT / ROLLBACK, and releases the client in finally.
 */
export async function reservePartForWorkOrderService(
  input: ReservePartInput,
  user: AuthenticatedUser,
  dbPool: DatabasePoolLike = activePool
): Promise<ReservePartResult> {
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');
    const result = await executeReservationTransaction(client, input, user);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('[Inventory Reservation Rollback Error]:', rollbackErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

export interface AdjustStockInput {
  part_id: string;
  adjustment_quantity: number;
  reason: string;
}

export interface AdjustStockResult {
  spare_part: SparePartRecord;
  transaction: InventoryTransactionRecord;
}

/**
 * Executes an atomic stock adjustment transaction.
 * 
 * Guarantees:
 * 1. Strict validation of UUID, non-zero integer adjustment, and non-empty reason.
 * 2. SELECT ... FOR UPDATE row-level lock on spare_parts preventing race conditions.
 * 3. Prevention of negative physical stock.
 * 4. Prevention of physical stock dropping below already committed allocated stock (reserved + quarantined).
 * 5. Recomputation of generated available_stock without direct manual assignment.
 * 6. Atomic creation of immutable inventory_transactions record.
 */
export async function executeStockAdjustmentTransaction(
  client: DatabaseQueryable,
  input: AdjustStockInput,
  user: AuthenticatedUser
): Promise<AdjustStockResult> {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!input.part_id || typeof input.part_id !== 'string' || !UUID_REGEX.test(input.part_id.trim())) {
    throw new InventoryError('Invalid or missing part_id. A valid UUID is required.', 400);
  }

  const rawQty = input.adjustment_quantity;
  const parsedQty = typeof rawQty === 'number' ? rawQty : parseInt(String(rawQty).trim(), 10);
  if (
    !Number.isInteger(parsedQty) ||
    parsedQty === 0 ||
    !Number.isFinite(parsedQty)
  ) {
    throw new InventoryError('Invalid adjustment quantity. Quantity must be a non-zero integer (+ or -).', 400);
  }

  if (!input.reason || typeof input.reason !== 'string' || !input.reason.trim()) {
    throw new InventoryError('Adjustment reason is mandatory.', 400);
  }

  // Step 1: Lock spare part row with PostgreSQL SELECT ... FOR UPDATE
  const partQuery = `
    SELECT 
      id,
      part_number,
      oem_part_number,
      name,
      description,
      category,
      subcategory,
      uom,
      warehouse_zone,
      bin_location,
      rack_number,
      shelf_number,
      bin_number,
      current_physical_stock,
      reserved_stock,
      quarantined_stock,
      available_stock,
      min_reorder_level,
      max_stock_level,
      unit_cost,
      supplier_name,
      plant_id,
      status
    FROM spare_parts
    WHERE id = $1
    FOR UPDATE
  `;

  const partRes = await client.query<SparePartRecord>(partQuery, [input.part_id.trim()]);
  if (partRes.rows.length === 0) {
    throw new InventoryError('Spare part not found.', 404);
  }

  const part = partRes.rows[0];

  if (part.status && part.status.toLowerCase() !== 'active') {
    throw new InventoryError(`Cannot adjust stock for inactive spare part ${part.part_number}.`, 400);
  }

  if (user.role !== 'admin' && user.plant_id && (part as any).plant_id && (part as any).plant_id !== user.plant_id) {
    throw new InventoryError('Forbidden: Cannot adjust stock for a spare part in a different plant facility.', 403);
  }

  const currentPhysical = Number(part.current_physical_stock);
  const reservedStock = Number(part.reserved_stock);
  const quarantinedStock = Number(part.quarantined_stock);
  const newPhysicalStock = currentPhysical + parsedQty;

  // Validation: Prevent resulting negative physical stock
  if (newPhysicalStock < 0) {
    throw new InventoryError(
      `Stock adjustment rejected: Resulting physical stock (${newPhysicalStock}) cannot be negative. Current physical stock is ${currentPhysical}.`,
      400
    );
  }

  // Validation: Prevent resulting physical stock from falling below allocated stock (reserved + quarantined)
  const allocatedStock = reservedStock + quarantinedStock;
  if (newPhysicalStock < allocatedStock) {
    throw new InventoryError(
      `Stock adjustment rejected: Resulting physical stock (${newPhysicalStock}) cannot be less than allocated stock (Reserved: ${reservedStock}, Quarantined: ${quarantinedStock}).`,
      400
    );
  }

  // Step 2: Update spare_parts current_physical_stock only (available_stock is generated automatically)
  const updateQuery = `
    UPDATE spare_parts
    SET current_physical_stock = current_physical_stock + $1,
        updated_at = NOW()
    WHERE id = $2
    RETURNING id, part_number, oem_part_number, name, description, category, subcategory,
              uom, warehouse_zone, bin_location, rack_number, shelf_number, bin_number,
              current_physical_stock, reserved_stock, quarantined_stock, available_stock,
              min_reorder_level, max_stock_level, unit_cost, supplier_name, status, updated_at
  `;

  const updateRes = await client.query<SparePartRecord>(updateQuery, [
    parsedQty,
    part.id,
  ]);
  const updatedPart = updateRes.rows[0];

  // Step 3: Insert immutable audit trail in inventory_transactions
  const location = part.warehouse_zone
    ? `${part.warehouse_zone} (Bin: ${part.bin_location})`
    : `Bin: ${part.bin_location}`;
  const remarks = input.reason.trim();

  const insertTxQuery = `
    INSERT INTO inventory_transactions (
      part_id,
      transaction_type,
      quantity,
      source_location,
      destination_location,
      performed_by,
      remarks,
      created_at
    ) VALUES ($1, 'ADJUSTMENT', $2, $3, $3, $4, $5, NOW())
    RETURNING id, part_id, transaction_type, quantity, source_location, destination_location, reference_work_order_id, performed_by, remarks, created_at
  `;

  const txRes = await client.query<InventoryTransactionRecord>(insertTxQuery, [
    part.id,
    parsedQty,
    location,
    user.id,
    remarks,
  ]);
  const transactionRecord = txRes.rows[0];

  return {
    spare_part: {
      ...updatedPart,
      current_physical_stock: Number(updatedPart.current_physical_stock),
      reserved_stock: Number(updatedPart.reserved_stock),
      quarantined_stock: Number(updatedPart.quarantined_stock),
      available_stock: Number(updatedPart.available_stock),
    },
    transaction: transactionRecord,
  };
}

/**
 * Top-level service function that acquires a dedicated client from the pool,
 * controls BEGIN / COMMIT / ROLLBACK, and releases the client in finally.
 */
export async function adjustStockService(
  input: AdjustStockInput,
  user: AuthenticatedUser,
  dbPool: DatabasePoolLike = activePool
): Promise<AdjustStockResult> {
  if (!user || !user.id) {
    throw new InventoryError('Unauthorized: Authentication required.', 401);
  }

  if (!['admin', 'manager', 'store_manager'].includes(user.role)) {
    throw new InventoryError(`Forbidden: Role '${user.role}' is not authorized to adjust stock.`, 403);
  }

  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');
    const result = await executeStockAdjustmentTransaction(client, input, user);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('[Inventory Adjustment Rollback Error]:', rollbackErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Store Manager Role Extensions & Advanced Inventory Services
// ---------------------------------------------------------------------------

export function validateStoreManagerOrAdmin(user?: AuthenticatedUser, action: string = 'this operation'): void {
  if (!user || !user.id) {
    throw new InventoryError('Unauthorized: Authentication required.', 401);
  }
  if (!['admin', 'manager', 'store_manager'].includes(user.role)) {
    throw new InventoryError(`Forbidden: Role '${user.role}' is not authorized to perform ${action}.`, 403);
  }
}

/**
 * Store Dashboard Summary & Real-time Inventory Statistics
 */
export async function getStoreDashboardService(user: AuthenticatedUser): Promise<any> {
  validateStoreManagerOrAdmin(user, 'accessing store dashboard');
  const { query } = getInventoryServiceDb();

  const plantId = (user.role !== 'admin' && user.plant_id) ? user.plant_id : null;
  const plantFilter = plantId ? 'AND (sp.plant_id = $1 OR sp.plant_id IS NULL)' : '';
  const params: any[] = plantId ? [plantId] : [];

  // Summary KPIs
  const summaryRes = await query(`
    SELECT
      COUNT(*)::int AS total_parts,
      COALESCE(SUM(sp.current_physical_stock), 0)::int AS total_physical_stock,
      COALESCE(SUM(sp.reserved_stock), 0)::int AS total_reserved_stock,
      COALESCE(SUM(sp.quarantined_stock), 0)::int AS total_quarantined_stock,
      COALESCE(SUM(sp.available_stock), 0)::int AS total_available_stock,
      COUNT(CASE WHEN sp.available_stock <= sp.min_reorder_level THEN 1 END)::int AS low_stock_items_count,
      COUNT(CASE WHEN sp.current_physical_stock = 0 THEN 1 END)::int AS out_of_stock_count,
      COALESCE(SUM(sp.current_physical_stock * sp.unit_cost), 0)::numeric(14,2) AS total_inventory_valuation
    FROM spare_parts sp
    WHERE sp.status = 'active' ${plantFilter}
  `, params);

  // Category breakdown
  const categoryRes = await query(`
    SELECT
      sp.category,
      COUNT(*)::int AS part_count,
      COALESCE(SUM(sp.current_physical_stock), 0)::int AS physical_stock,
      COALESCE(SUM(sp.available_stock), 0)::int AS available_stock,
      COALESCE(SUM(sp.current_physical_stock * sp.unit_cost), 0)::numeric(14,2) AS valuation
    FROM spare_parts sp
    WHERE sp.status = 'active' ${plantFilter}
    GROUP BY sp.category
    ORDER BY valuation DESC
  `, params);

  // Transfers count
  const transferParams: any[] = plantId ? [plantId] : [];
  const transferFilter = plantId ? 'WHERE (source_plant_id = $1 OR destination_plant_id = $1)' : '';
  const transferRes = await query(`
    SELECT
      COUNT(CASE WHEN status IN ('pending', 'in_transit') THEN 1 END)::int AS active_transfers_count,
      COUNT(*)::int AS total_transfers_count
    FROM stock_transfers ${transferFilter}
  `, transferParams);

  // Damaged stock summary
  const damagedParams: any[] = plantId ? [plantId] : [];
  const damagedFilter = plantId ? 'WHERE (plant_id = $1 OR plant_id IS NULL)' : '';
  const damagedRes = await query(`
    SELECT
      COUNT(*)::int AS total_damaged_reports,
      COALESCE(SUM(CASE WHEN disposition = 'quarantined' THEN quantity ELSE 0 END), 0)::int AS quarantined_units,
      COALESCE(SUM(CASE WHEN disposition = 'scrapped' THEN quantity ELSE 0 END), 0)::int AS scrapped_units
    FROM damaged_stock_items ${damagedFilter}
  `, damagedParams);

  // Recent 10 transactions
  const txRes = await query(`
    SELECT it.id, it.part_id, it.transaction_type, it.quantity, it.source_location,
           it.destination_location, it.reference_work_order_id, it.remarks, it.created_at,
           sp.part_number, sp.name AS part_name, u.full_name AS performed_by_name, u.role AS performed_by_role
    FROM inventory_transactions it
    JOIN spare_parts sp ON it.part_id = sp.id
    LEFT JOIN users u ON it.performed_by = u.id
    WHERE 1=1 ${plantFilter}
    ORDER BY it.created_at DESC
    LIMIT 10
  `, params);

  const kpis = summaryRes.rows[0] || {};

  return {
    summary: {
      total_parts: parseInt(kpis.total_parts || 0, 10),
      total_physical_stock: parseInt(kpis.total_physical_stock || 0, 10),
      total_reserved_stock: parseInt(kpis.total_reserved_stock || 0, 10),
      total_quarantined_stock: parseInt(kpis.total_quarantined_stock || 0, 10),
      total_available_stock: parseInt(kpis.total_available_stock || 0, 10),
      low_stock_items_count: parseInt(kpis.low_stock_items_count || 0, 10),
      out_of_stock_count: parseInt(kpis.out_of_stock_count || 0, 10),
      total_inventory_valuation: parseFloat(kpis.total_inventory_valuation || 0),
    },
    transfers: transferRes.rows[0] || { active_transfers_count: 0, total_transfers_count: 0 },
    damaged_stock: damagedRes.rows[0] || { total_damaged_reports: 0, quarantined_units: 0, scrapped_units: 0 },
    category_breakdown: categoryRes.rows.map((r: any) => ({
      category: r.category,
      part_count: parseInt(r.part_count, 10),
      physical_stock: parseInt(r.physical_stock, 10),
      available_stock: parseInt(r.available_stock, 10),
      valuation: parseFloat(r.valuation),
    })),
    recent_transactions: txRes.rows,
  };
}

export interface GetLowStockAlertsFilter {
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * Reorder Levels and Low-Stock Alerts
 */
export async function getLowStockAlertsService(
  filter: GetLowStockAlertsFilter,
  user: AuthenticatedUser
): Promise<any> {
  if (!user || !user.id) {
    throw new InventoryError('Unauthorized: Authentication required.', 401);
  }
  const { query } = getInventoryServiceDb();

  const page = Math.max(1, Number(filter.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(filter.limit) || 20));
  const offset = (page - 1) * limit;

  const plantId = (user.role !== 'admin' && user.plant_id) ? user.plant_id : null;
  const params: any[] = [];
  const whereClauses: string[] = [
    "sp.status = 'active'",
    '(sp.available_stock <= sp.min_reorder_level OR sp.current_physical_stock <= sp.min_reorder_level)'
  ];

  if (plantId) {
    params.push(plantId);
    whereClauses.push(`(sp.plant_id = $${params.length} OR sp.plant_id IS NULL)`);
  }

  if (filter.category && filter.category.trim() && filter.category.toLowerCase() !== 'all') {
    params.push(filter.category.trim());
    whereClauses.push(`sp.category = $${params.length}`);
  }

  if (filter.search && filter.search.trim()) {
    params.push(`%${filter.search.trim()}%`);
    whereClauses.push(`(sp.part_number ILIKE $${params.length} OR sp.name ILIKE $${params.length} OR sp.oem_part_number ILIKE $${params.length})`);
  }

  const whereSql = whereClauses.join(' AND ');

  const countRes = await query(`SELECT COUNT(*)::int as count FROM spare_parts sp WHERE ${whereSql}`, params);
  const total = parseInt(countRes.rows[0]?.count || 0, 10);

  const queryParams = [...params, limit, offset];
  const listSql = `
    SELECT sp.id, sp.part_number, sp.oem_part_number, sp.name, sp.description, sp.category,
           sp.subcategory, sp.uom, sp.warehouse_zone, sp.bin_location,
           sp.current_physical_stock, sp.reserved_stock, sp.quarantined_stock, sp.available_stock,
           sp.min_reorder_level, sp.max_stock_level, sp.unit_cost, sp.supplier_name,
           (sp.min_reorder_level - sp.available_stock) AS stock_deficit,
           EXISTS(
             SELECT 1 FROM purchase_requisitions pr
             WHERE pr.part_id = sp.id AND pr.status NOT IN ('fully_received', 'cancelled', 'rejected')
           ) AS has_open_pr,
           (
             SELECT pr.pr_number FROM purchase_requisitions pr
             WHERE pr.part_id = sp.id AND pr.status NOT IN ('fully_received', 'cancelled', 'rejected')
             ORDER BY pr.created_at DESC LIMIT 1
           ) AS open_pr_number
    FROM spare_parts sp
    WHERE ${whereSql}
    ORDER BY (sp.min_reorder_level - sp.available_stock) DESC, sp.part_number ASC
    LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
  `;

  const listRes = await query(listSql, queryParams);

  return {
    data: listRes.rows.map((r: any) => ({
      ...r,
      current_physical_stock: Number(r.current_physical_stock),
      reserved_stock: Number(r.reserved_stock),
      quarantined_stock: Number(r.quarantined_stock),
      available_stock: Number(r.available_stock),
      min_reorder_level: Number(r.min_reorder_level),
      max_stock_level: Number(r.max_stock_level),
      stock_deficit: Math.max(0, Number(r.stock_deficit)),
      unit_cost: parseFloat(r.unit_cost || 0),
    })),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export interface CreateStockTransferInput {
  part_id: string;
  source_location: string;
  destination_location: string;
  quantity: number;
  source_plant_id?: string | null;
  destination_plant_id?: string | null;
  remarks?: string | null;
}

/**
 * Stock Transfers (Inter-bin, inter-zone, inter-plant)
 */
export async function createStockTransferService(
  input: CreateStockTransferInput,
  user: AuthenticatedUser
): Promise<any> {
  validateStoreManagerOrAdmin(user, 'creating stock transfer');
  const { pool: dbPool } = getInventoryServiceDb();

  if (!input.part_id || !UUID_REGEX.test(input.part_id.trim())) {
    throw new InventoryError('Invalid or missing part_id. Valid UUID is required.', 400);
  }
  const qty = typeof input.quantity === 'number' ? input.quantity : parseInt(String(input.quantity), 10);
  if (!Number.isInteger(qty) || qty <= 0 || !Number.isFinite(qty)) {
    throw new InventoryError('Transfer quantity must be a positive integer.', 400);
  }
  if (!input.source_location || !input.source_location.trim()) {
    throw new InventoryError('source_location is required.', 400);
  }
  if (!input.destination_location || !input.destination_location.trim()) {
    throw new InventoryError('destination_location is required.', 400);
  }

  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');

    // Lock part
    const partRes = await client.query(
      `SELECT id, part_number, name, bin_location, warehouse_zone, current_physical_stock,
              reserved_stock, quarantined_stock, available_stock, status, plant_id
       FROM spare_parts WHERE id = $1 FOR UPDATE`,
      [input.part_id.trim()]
    );
    if (partRes.rows.length === 0) {
      throw new InventoryError('Spare part not found.', 404);
    }
    const part = partRes.rows[0];
    if (part.status && part.status.toLowerCase() !== 'active') {
      throw new InventoryError(`Cannot transfer inactive spare part ${part.part_number}.`, 400);
    }

    if (user.role !== 'admin' && user.plant_id && part.plant_id && part.plant_id !== user.plant_id) {
      throw new InventoryError('Forbidden: Cannot transfer parts from a different plant.', 403);
    }

    const availableStock = Number(part.available_stock);
    if (availableStock < qty) {
      throw new InventoryError(
        `Insufficient available stock for transfer. Requested: ${qty}, Available: ${availableStock}.`,
        400,
        availableStock
      );
    }

    // Sequence for transfer number
    const year = new Date().getFullYear();
    const countRes = await client.query(`SELECT COUNT(*)::int AS count FROM stock_transfers`);
    const seq = (countRes.rows[0]?.count || 0) + 1;
    const transferNumber = `TRF-${year}-${String(seq).padStart(5, '0')}`;

    const srcPlant = input.source_plant_id || part.plant_id || user.plant_id || null;
    const dstPlant = input.destination_plant_id || srcPlant;
    const isInterPlant = srcPlant && dstPlant && srcPlant !== dstPlant;
    const transferStatus = isInterPlant ? 'in_transit' : 'completed';

    // Insert into stock_transfers
    const insertTrfRes = await client.query(
      `INSERT INTO stock_transfers (
        transfer_number, part_id, source_plant_id, destination_plant_id,
        source_location, destination_location, quantity, status,
        transferred_by, remarks, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING *`,
      [
        transferNumber,
        part.id,
        srcPlant,
        dstPlant,
        input.source_location.trim(),
        input.destination_location.trim(),
        qty,
        transferStatus,
        user.id,
        input.remarks ? input.remarks.trim() : `Stock transfer from ${input.source_location} to ${input.destination_location}`,
      ]
    );
    const transferRecord = insertTrfRes.rows[0];

    // Log transaction
    await client.query(
      `INSERT INTO inventory_transactions (
        part_id, transaction_type, quantity, source_location, destination_location,
        performed_by, remarks, created_at
      ) VALUES ($1, 'TRANSFER', $2, $3, $4, $5, $6, NOW())`,
      [
        part.id,
        qty,
        input.source_location.trim(),
        input.destination_location.trim(),
        user.id,
        `Stock transfer ${transferNumber}: ${qty} units to ${input.destination_location.trim()}`,
      ]
    );

    // If intra-plant / bin transfer, update bin location
    if (!isInterPlant) {
      await client.query(
        `UPDATE spare_parts SET bin_location = $1, updated_at = NOW() WHERE id = $2`,
        [input.destination_location.trim(), part.id]
      );
    } else {
      // Deduct from physical stock of source
      await client.query(
        `UPDATE spare_parts SET current_physical_stock = current_physical_stock - $1, updated_at = NOW() WHERE id = $2`,
        [qty, part.id]
      );
    }

    await client.query('COMMIT');

    return {
      ...transferRecord,
      part_number: part.part_number,
      part_name: part.name,
    };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rbErr) {
      console.error('[Stock Transfer Rollback Error]:', rbErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

export interface GetStockTransfersFilter {
  part_id?: string;
  status?: string;
  source_plant_id?: string;
  destination_plant_id?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export async function getStockTransfersService(
  filter: GetStockTransfersFilter,
  user: AuthenticatedUser
): Promise<any> {
  validateStoreManagerOrAdmin(user, 'listing stock transfers');
  const { query } = getInventoryServiceDb();

  const page = Math.max(1, Number(filter.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(filter.limit) || 20));
  const offset = (page - 1) * limit;

  const plantId = (user.role !== 'admin' && user.plant_id) ? user.plant_id : null;
  const params: any[] = [];
  const whereClauses: string[] = ['1=1'];

  if (plantId) {
    params.push(plantId);
    whereClauses.push(`(st.source_plant_id = $${params.length} OR st.destination_plant_id = $${params.length} OR st.source_plant_id IS NULL)`);
  }
  if (filter.part_id && UUID_REGEX.test(filter.part_id)) {
    params.push(filter.part_id);
    whereClauses.push(`st.part_id = $${params.length}`);
  }
  if (filter.status && filter.status.toLowerCase() !== 'all') {
    params.push(filter.status.toLowerCase());
    whereClauses.push(`st.status = $${params.length}`);
  }
  if (filter.search && filter.search.trim()) {
    params.push(`%${filter.search.trim()}%`);
    whereClauses.push(`(st.transfer_number ILIKE $${params.length} OR sp.part_number ILIKE $${params.length} OR sp.name ILIKE $${params.length})`);
  }

  const whereSql = whereClauses.join(' AND ');

  const countRes = await query(
    `SELECT COUNT(*)::int AS count
     FROM stock_transfers st
     JOIN spare_parts sp ON st.part_id = sp.id
     WHERE ${whereSql}`,
    params
  );
  const total = parseInt(countRes.rows[0]?.count || 0, 10);

  const queryParams = [...params, limit, offset];
  const listSql = `
    SELECT st.*, sp.part_number, sp.name AS part_name, sp.uom,
           u1.full_name AS transferred_by_name, u2.full_name AS received_by_name
    FROM stock_transfers st
    JOIN spare_parts sp ON st.part_id = sp.id
    LEFT JOIN users u1 ON st.transferred_by = u1.id
    LEFT JOIN users u2 ON st.received_by = u2.id
    WHERE ${whereSql}
    ORDER BY st.created_at DESC
    LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
  `;

  const listRes = await query(listSql, queryParams);

  return {
    data: listRes.rows,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getStockTransferByIdService(
  id: string,
  user: AuthenticatedUser
): Promise<any> {
  validateStoreManagerOrAdmin(user, 'viewing stock transfer');
  const { query } = getInventoryServiceDb();

  if (!id || !UUID_REGEX.test(id)) {
    throw new InventoryError('Invalid transfer ID format.', 400);
  }

  const res = await query(
    `SELECT st.*, sp.part_number, sp.name AS part_name, sp.uom, sp.category,
            u1.full_name AS transferred_by_name, u2.full_name AS received_by_name
     FROM stock_transfers st
     JOIN spare_parts sp ON st.part_id = sp.id
     LEFT JOIN users u1 ON st.transferred_by = u1.id
     LEFT JOIN users u2 ON st.received_by = u2.id
     WHERE st.id = $1`,
    [id]
  );

  if (res.rows.length === 0) {
    throw new InventoryError('Stock transfer record not found.', 404);
  }

  return res.rows[0];
}

export interface ReportDamagedStockInput {
  part_id: string;
  quantity: number;
  damage_type: 'damaged' | 'expired' | 'obsolete' | 'defective' | 'scrap';
  disposition?: 'quarantined' | 'scrapped' | 'returned_to_vendor' | 'written_off';
  reason: string;
  location?: string | null;
  batch_lot_number?: string | null;
  plant_id?: string | null;
}

/**
 * Damaged / Expired Stock Management
 */
export async function reportDamagedStockService(
  input: ReportDamagedStockInput,
  user: AuthenticatedUser
): Promise<any> {
  validateStoreManagerOrAdmin(user, 'reporting damaged or expired stock');
  const { pool: dbPool } = getInventoryServiceDb();

  if (!input.part_id || !UUID_REGEX.test(input.part_id.trim())) {
    throw new InventoryError('Invalid or missing part_id. Valid UUID is required.', 400);
  }
  const qty = typeof input.quantity === 'number' ? input.quantity : parseInt(String(input.quantity), 10);
  if (!Number.isInteger(qty) || qty <= 0 || !Number.isFinite(qty)) {
    throw new InventoryError('Quantity must be a positive integer.', 400);
  }

  const validTypes = ['damaged', 'expired', 'obsolete', 'defective', 'scrap'];
  const dmgType = String(input.damage_type || '').toLowerCase();
  if (!validTypes.includes(dmgType)) {
    throw new InventoryError(`Invalid damage_type. Must be one of: ${validTypes.join(', ')}.`, 400);
  }

  const validDispositions = ['quarantined', 'scrapped', 'returned_to_vendor', 'written_off'];
  const disposition = String(input.disposition || 'quarantined').toLowerCase();
  if (!validDispositions.includes(disposition)) {
    throw new InventoryError(`Invalid disposition. Must be one of: ${validDispositions.join(', ')}.`, 400);
  }

  if (!input.reason || !input.reason.trim()) {
    throw new InventoryError('Reason is mandatory for recording damaged/expired stock.', 400);
  }

  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');

    // Lock part
    const partRes = await client.query(
      `SELECT id, part_number, name, bin_location, current_physical_stock,
              reserved_stock, quarantined_stock, available_stock, plant_id, status
       FROM spare_parts WHERE id = $1 FOR UPDATE`,
      [input.part_id.trim()]
    );
    if (partRes.rows.length === 0) {
      throw new InventoryError('Spare part not found.', 404);
    }
    const part = partRes.rows[0];

    if (part.status && part.status.toLowerCase() !== 'active') {
      throw new InventoryError(`Cannot report damage for inactive spare part ${part.part_number}.`, 400);
    }

    if (user.role !== 'admin' && user.plant_id && part.plant_id && part.plant_id !== user.plant_id) {
      throw new InventoryError('Forbidden: Cannot report damaged stock for a part in a different plant.', 403);
    }

    const availableStock = Number(part.available_stock);
    const physicalStock = Number(part.current_physical_stock);

    if (disposition === 'quarantined') {
      if (availableStock < qty) {
        throw new InventoryError(
          `Cannot quarantine ${qty} units: only ${availableStock} units are available.`,
          400,
          availableStock
        );
      }
      // Move to quarantined_stock
      await client.query(
        `UPDATE spare_parts
         SET quarantined_stock = quarantined_stock + $1, updated_at = NOW()
         WHERE id = $2`,
        [qty, part.id]
      );
      // Log transaction
      await client.query(
        `INSERT INTO inventory_transactions (
          part_id, transaction_type, quantity, source_location, destination_location,
          performed_by, remarks, created_at
        ) VALUES ($1, 'DAMAGE_QUARANTINE', $2, $3, 'Quarantine Area', $4, $5, NOW())`,
        [
          part.id,
          qty,
          input.location || `Bin: ${part.bin_location}`,
          user.id,
          `Quarantined ${qty} units (${dmgType}): ${input.reason.trim()}`,
        ]
      );
    } else if (disposition === 'scrapped' || disposition === 'written_off') {
      if (physicalStock < qty) {
        throw new InventoryError(
          `Cannot scrap ${qty} units: current physical stock is only ${physicalStock}.`,
          400
        );
      }
      // Deduct from physical stock
      await client.query(
        `UPDATE spare_parts
         SET current_physical_stock = current_physical_stock - $1, updated_at = NOW()
         WHERE id = $2`,
        [qty, part.id]
      );
      // Log transaction
      await client.query(
        `INSERT INTO inventory_transactions (
          part_id, transaction_type, quantity, source_location, destination_location,
          performed_by, remarks, created_at
        ) VALUES ($1, 'SCRAP', $2, $3, 'Scrap Yard', $4, $5, NOW())`,
        [
          part.id,
          -qty,
          input.location || `Bin: ${part.bin_location}`,
          user.id,
          `Scrapped ${qty} units (${dmgType}): ${input.reason.trim()}`,
        ]
      );
    }

    // Sequence for damage report number
    const year = new Date().getFullYear();
    const countRes = await client.query(`SELECT COUNT(*)::int AS count FROM damaged_stock_items`);
    const seq = (countRes.rows[0]?.count || 0) + 1;
    const reportNumber = `DMG-${year}-${String(seq).padStart(5, '0')}`;

    const plantId = input.plant_id || part.plant_id || user.plant_id || null;

    const insertRes = await client.query(
      `INSERT INTO damaged_stock_items (
        report_number, part_id, plant_id, quantity, damage_type, disposition,
        reason, location, batch_lot_number, reported_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING *`,
      [
        reportNumber,
        part.id,
        plantId,
        qty,
        dmgType,
        disposition,
        input.reason.trim(),
        input.location ? input.location.trim() : null,
        input.batch_lot_number ? input.batch_lot_number.trim() : null,
        user.id,
      ]
    );

    await client.query('COMMIT');

    return {
      ...insertRes.rows[0],
      part_number: part.part_number,
      part_name: part.name,
    };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rbErr) {
      console.error('[Damaged Stock Rollback Error]:', rbErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

export interface GetDamagedStockFilter {
  part_id?: string;
  damage_type?: string;
  disposition?: string;
  page?: number;
  limit?: number;
}

export async function getDamagedStockService(
  filter: GetDamagedStockFilter,
  user: AuthenticatedUser
): Promise<any> {
  validateStoreManagerOrAdmin(user, 'listing damaged stock');
  const { query } = getInventoryServiceDb();

  const page = Math.max(1, Number(filter.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(filter.limit) || 20));
  const offset = (page - 1) * limit;

  const plantId = (user.role !== 'admin' && user.plant_id) ? user.plant_id : null;
  const params: any[] = [];
  const whereClauses: string[] = ['1=1'];

  if (plantId) {
    params.push(plantId);
    whereClauses.push(`(ds.plant_id = $${params.length} OR ds.plant_id IS NULL)`);
  }
  if (filter.part_id && UUID_REGEX.test(filter.part_id)) {
    params.push(filter.part_id);
    whereClauses.push(`ds.part_id = $${params.length}`);
  }
  if (filter.damage_type && filter.damage_type.toLowerCase() !== 'all') {
    params.push(filter.damage_type.toLowerCase());
    whereClauses.push(`ds.damage_type = $${params.length}`);
  }
  if (filter.disposition && filter.disposition.toLowerCase() !== 'all') {
    params.push(filter.disposition.toLowerCase());
    whereClauses.push(`ds.disposition = $${params.length}`);
  }

  const whereSql = whereClauses.join(' AND ');

  const countRes = await query(`SELECT COUNT(*)::int AS count FROM damaged_stock_items ds WHERE ${whereSql}`, params);
  const total = parseInt(countRes.rows[0]?.count || 0, 10);

  const queryParams = [...params, limit, offset];
  const listSql = `
    SELECT ds.*, sp.part_number, sp.name AS part_name, sp.category, u.full_name AS reported_by_name
    FROM damaged_stock_items ds
    JOIN spare_parts sp ON ds.part_id = sp.id
    LEFT JOIN users u ON ds.reported_by = u.id
    WHERE ${whereSql}
    ORDER BY ds.created_at DESC
    LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
  `;

  const listRes = await query(listSql, queryParams);

  return {
    data: listRes.rows,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export interface UpdateDamagedStockDispositionInput {
  disposition: 'scrapped' | 'returned_to_vendor' | 'written_off';
  remarks?: string;
}

export async function updateDamagedStockDispositionService(
  id: string,
  input: UpdateDamagedStockDispositionInput,
  user: AuthenticatedUser
): Promise<any> {
  validateStoreManagerOrAdmin(user, 'updating damaged stock disposition');
  const { pool: dbPool } = getInventoryServiceDb();

  if (!id || !UUID_REGEX.test(id)) {
    throw new InventoryError('Invalid damaged stock record ID.', 400);
  }

  const validDispositions = ['scrapped', 'returned_to_vendor', 'written_off'];
  const newDisp = String(input.disposition || '').toLowerCase();
  if (!validDispositions.includes(newDisp)) {
    throw new InventoryError(`Invalid disposition. Must be one of: ${validDispositions.join(', ')}.`, 400);
  }

  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');

    const dmgRes = await client.query(`SELECT * FROM damaged_stock_items WHERE id = $1 FOR UPDATE`, [id]);
    if (dmgRes.rows.length === 0) {
      throw new InventoryError('Damaged stock record not found.', 404);
    }
    const dmg = dmgRes.rows[0];

    const partRes = await client.query(`SELECT * FROM spare_parts WHERE id = $1 FOR UPDATE`, [dmg.part_id]);
    const part = partRes.rows[0];

    // If transitioning from quarantined, decrement quarantined & physical stock
    if (dmg.disposition === 'quarantined') {
      const qty = Number(dmg.quantity);
      await client.query(
        `UPDATE spare_parts
         SET quarantined_stock = GREATEST(0, quarantined_stock - $1),
             current_physical_stock = GREATEST(0, current_physical_stock - $1),
             updated_at = NOW()
         WHERE id = $2`,
        [qty, part.id]
      );

      const txType = newDisp === 'returned_to_vendor' ? 'RETURN' : 'SCRAP';
      await client.query(
        `INSERT INTO inventory_transactions (
          part_id, transaction_type, quantity, source_location, destination_location,
          performed_by, remarks, created_at
        ) VALUES ($1, $2, $3, 'Quarantine Area', $4, $5, $6, NOW())`,
        [
          part.id,
          txType,
          -qty,
          newDisp === 'returned_to_vendor' ? 'Vendor Depot' : 'Scrap Yard',
          user.id,
          `Disposition updated for ${dmg.report_number} to ${newDisp}. ${input.remarks || ''}`,
        ]
      );
    }

    const updateRes = await client.query(
      `UPDATE damaged_stock_items
       SET disposition = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [newDisp, id]
    );

    await client.query('COMMIT');

    return updateRes.rows[0];
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rbErr) {
      console.error('[Update Disposition Rollback Error]:', rbErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

export interface GetInventoryTransactionsFilter {
  part_id?: string;
  transaction_type?: string;
  performed_by?: string;
  work_order_id?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}

/**
 * Immutable Transaction Ledger History
 */
export async function getInventoryTransactionsService(
  filter: GetInventoryTransactionsFilter,
  user: AuthenticatedUser
): Promise<any> {
  validateStoreManagerOrAdmin(user, 'viewing inventory transaction history');
  const { query } = getInventoryServiceDb();

  const page = Math.max(1, Number(filter.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(filter.limit) || 20));
  const offset = (page - 1) * limit;

  const plantId = (user.role !== 'admin' && user.plant_id) ? user.plant_id : null;
  const params: any[] = [];
  const whereClauses: string[] = ['1=1'];

  if (plantId) {
    params.push(plantId);
    whereClauses.push(`(sp.plant_id = $${params.length} OR sp.plant_id IS NULL)`);
  }
  if (filter.part_id && UUID_REGEX.test(filter.part_id)) {
    params.push(filter.part_id);
    whereClauses.push(`it.part_id = $${params.length}`);
  }
  if (filter.transaction_type && filter.transaction_type.toLowerCase() !== 'all') {
    params.push(filter.transaction_type.toUpperCase());
    whereClauses.push(`it.transaction_type = $${params.length}`);
  }
  if (filter.performed_by && UUID_REGEX.test(filter.performed_by)) {
    params.push(filter.performed_by);
    whereClauses.push(`it.performed_by = $${params.length}`);
  }
  if (filter.work_order_id && UUID_REGEX.test(filter.work_order_id)) {
    params.push(filter.work_order_id);
    whereClauses.push(`it.reference_work_order_id = $${params.length}`);
  }
  if (filter.start_date) {
    params.push(filter.start_date);
    whereClauses.push(`it.created_at >= $${params.length}`);
  }
  if (filter.end_date) {
    params.push(filter.end_date);
    whereClauses.push(`it.created_at <= $${params.length}`);
  }

  const whereSql = whereClauses.join(' AND ');

  const countRes = await query(
    `SELECT COUNT(*)::int AS count
     FROM inventory_transactions it
     JOIN spare_parts sp ON it.part_id = sp.id
     WHERE ${whereSql}`,
    params
  );
  const total = parseInt(countRes.rows[0]?.count || 0, 10);

  const queryParams = [...params, limit, offset];
  const listSql = `
    SELECT it.*, sp.part_number, sp.name AS part_name, sp.category, sp.uom,
           u.full_name AS performed_by_name, u.role AS performed_by_role
    FROM inventory_transactions it
    JOIN spare_parts sp ON it.part_id = sp.id
    LEFT JOIN users u ON it.performed_by = u.id
    WHERE ${whereSql}
    ORDER BY it.created_at DESC
    LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
  `;

  const listRes = await query(listSql, queryParams);

  return {
    data: listRes.rows,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * Inventory Valuation Report
 */
export async function getInventoryValuationReportService(user: AuthenticatedUser): Promise<any> {
  validateStoreManagerOrAdmin(user, 'generating inventory valuation report');
  const { query } = getInventoryServiceDb();

  const plantId = (user.role !== 'admin' && user.plant_id) ? user.plant_id : null;
  const plantFilter = plantId ? 'AND (sp.plant_id = $1 OR sp.plant_id IS NULL)' : '';
  const params: any[] = plantId ? [plantId] : [];

  // Summary by category
  const categoryRes = await query(`
    SELECT
      sp.category,
      COUNT(*)::int AS sku_count,
      COALESCE(SUM(sp.current_physical_stock), 0)::int AS total_physical_units,
      COALESCE(SUM(sp.available_stock), 0)::int AS total_available_units,
      COALESCE(SUM(sp.current_physical_stock * sp.unit_cost), 0)::numeric(14,2) AS category_valuation,
      COALESCE(MIN(sp.unit_cost), 0)::numeric(12,2) AS min_unit_cost,
      COALESCE(MAX(sp.unit_cost), 0)::numeric(12,2) AS max_unit_cost,
      COALESCE(AVG(sp.unit_cost), 0)::numeric(12,2) AS avg_unit_cost
    FROM spare_parts sp
    WHERE sp.status = 'active' ${plantFilter}
    GROUP BY sp.category
    ORDER BY category_valuation DESC
  `, params);

  // Summary by warehouse zone
  const zoneRes = await query(`
    SELECT
      COALESCE(sp.warehouse_zone, 'Unassigned') AS warehouse_zone,
      COUNT(*)::int AS sku_count,
      COALESCE(SUM(sp.current_physical_stock), 0)::int AS total_physical_units,
      COALESCE(SUM(sp.current_physical_stock * sp.unit_cost), 0)::numeric(14,2) AS zone_valuation
    FROM spare_parts sp
    WHERE sp.status = 'active' ${plantFilter}
    GROUP BY sp.warehouse_zone
    ORDER BY zone_valuation DESC
  `, params);

  // Overall totals
  const totalRes = await query(`
    SELECT
      COUNT(*)::int AS total_skus,
      COALESCE(SUM(sp.current_physical_stock), 0)::int AS total_physical_stock,
      COALESCE(SUM(sp.current_physical_stock * sp.unit_cost), 0)::numeric(14,2) AS total_valuation
    FROM spare_parts sp
    WHERE sp.status = 'active' ${plantFilter}
  `, params);

  return {
    total: totalRes.rows[0] || { total_skus: 0, total_physical_stock: 0, total_valuation: 0 },
    by_category: categoryRes.rows,
    by_zone: zoneRes.rows,
    generated_at: new Date().toISOString(),
  };
}

/**
 * Inventory Movement Report
 */
export async function getInventoryMovementReportService(
  filter: { timeframe?: string; start_date?: string; end_date?: string },
  user: AuthenticatedUser
): Promise<any> {
  validateStoreManagerOrAdmin(user, 'generating inventory movement report');
  const { query } = getInventoryServiceDb();

  const plantId = (user.role !== 'admin' && user.plant_id) ? user.plant_id : null;
  const params: any[] = [];
  const plantFilter = plantId ? `AND (sp.plant_id = $${params.length + 1} OR sp.plant_id IS NULL)` : '';
  if (plantId) params.push(plantId);

  // Timeframe filter
  let dateFilter = "it.created_at >= CURRENT_DATE - INTERVAL '30 days'";
  if (filter.start_date && filter.end_date) {
    params.push(filter.start_date, filter.end_date);
    dateFilter = `it.created_at >= $${params.length - 1} AND it.created_at <= $${params.length}`;
  } else if (filter.timeframe) {
    const tf = filter.timeframe.toLowerCase();
    if (tf === '7d' || tf === 'week') {
      dateFilter = "it.created_at >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (tf === '90d' || tf === 'quarter') {
      dateFilter = "it.created_at >= CURRENT_DATE - INTERVAL '90 days'";
    } else if (tf === '1y' || tf === 'year') {
      dateFilter = "it.created_at >= CURRENT_DATE - INTERVAL '1 year'";
    }
  }

  const movementRes = await query(`
    SELECT
      it.transaction_type,
      COUNT(*)::int AS transaction_count,
      COALESCE(SUM(ABS(it.quantity)), 0)::int AS total_units_moved
    FROM inventory_transactions it
    JOIN spare_parts sp ON it.part_id = sp.id
    WHERE ${dateFilter} ${plantFilter}
    GROUP BY it.transaction_type
    ORDER BY total_units_moved DESC
  `, params);

  const topMovedPartsRes = await query(`
    SELECT
      sp.id,
      sp.part_number,
      sp.name AS part_name,
      sp.category,
      COUNT(it.id)::int AS transaction_count,
      COALESCE(SUM(ABS(it.quantity)), 0)::int AS total_units_moved
    FROM inventory_transactions it
    JOIN spare_parts sp ON it.part_id = sp.id
    WHERE ${dateFilter} ${plantFilter}
    GROUP BY sp.id, sp.part_number, sp.name, sp.category
    ORDER BY total_units_moved DESC
    LIMIT 10
  `, params);

  return {
    movement_by_type: movementRes.rows,
    top_moved_parts: topMovedPartsRes.rows,
    generated_at: new Date().toISOString(),
  };
}

/**
 * Detailed Inventory Levels with Stock Health Status
 */
export async function getInventoryLevelsService(
  filter: { category?: string; search?: string; zone?: string; page?: number; limit?: number },
  user: AuthenticatedUser
): Promise<any> {
  validateStoreManagerOrAdmin(user, 'viewing inventory levels');
  const { query } = getInventoryServiceDb();

  const page = Math.max(1, Number(filter.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(filter.limit) || 20));
  const offset = (page - 1) * limit;

  const plantId = (user.role !== 'admin' && user.plant_id) ? user.plant_id : null;
  const params: any[] = [];
  const whereClauses: string[] = ["sp.status = 'active'"];

  if (plantId) {
    params.push(plantId);
    whereClauses.push(`(sp.plant_id = $${params.length} OR sp.plant_id IS NULL)`);
  }
  if (filter.category && filter.category.trim() && filter.category.toLowerCase() !== 'all') {
    params.push(filter.category.trim());
    whereClauses.push(`sp.category = $${params.length}`);
  }
  if (filter.zone && filter.zone.trim() && filter.zone.toLowerCase() !== 'all') {
    params.push(filter.zone.trim());
    whereClauses.push(`sp.warehouse_zone = $${params.length}`);
  }
  if (filter.search && filter.search.trim()) {
    params.push(`%${filter.search.trim()}%`);
    whereClauses.push(`(sp.part_number ILIKE $${params.length} OR sp.name ILIKE $${params.length} OR sp.oem_part_number ILIKE $${params.length})`);
  }

  const whereSql = whereClauses.join(' AND ');

  const countRes = await query(`SELECT COUNT(*)::int AS count FROM spare_parts sp WHERE ${whereSql}`, params);
  const total = parseInt(countRes.rows[0]?.count || 0, 10);

  const queryParams = [...params, limit, offset];
  const listSql = `
    SELECT sp.id, sp.part_number, sp.oem_part_number, sp.name, sp.description, sp.category,
           sp.subcategory, sp.uom, sp.warehouse_zone, sp.bin_location,
           sp.current_physical_stock, sp.reserved_stock, sp.quarantined_stock, sp.available_stock,
           sp.min_reorder_level, sp.max_stock_level, sp.unit_cost, sp.supplier_name,
           CASE
             WHEN sp.current_physical_stock = 0 THEN 'out_of_stock'
             WHEN sp.available_stock <= sp.min_reorder_level THEN 'low_stock'
             WHEN sp.current_physical_stock > sp.max_stock_level THEN 'overstocked'
             ELSE 'healthy'
           END AS stock_health
    FROM spare_parts sp
    WHERE ${whereSql}
    ORDER BY sp.part_number ASC
    LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
  `;

  const listRes = await query(listSql, queryParams);

  return {
    data: listRes.rows.map((r: any) => ({
      ...r,
      current_physical_stock: Number(r.current_physical_stock),
      reserved_stock: Number(r.reserved_stock),
      quarantined_stock: Number(r.quarantined_stock),
      available_stock: Number(r.available_stock),
      min_reorder_level: Number(r.min_reorder_level),
      max_stock_level: Number(r.max_stock_level),
      unit_cost: parseFloat(r.unit_cost || 0),
    })),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}
