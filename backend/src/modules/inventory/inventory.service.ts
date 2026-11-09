import { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { pool } from '../../config/db';
import { AuthenticatedUser } from '../../middlewares/auth.middleware';

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

  // 2. Manager authorization: must match plant; and shop if user is scoped to a specific shop
  if (user.role === 'manager') {
    if (user.plant_id && wo.plant_id && user.plant_id !== wo.plant_id) {
      throw new InventoryError(
        'Forbidden: Cannot reserve parts for a work order in a different plant.',
        403
      );
    }
    if (user.shop_id && wo.shop_id && user.shop_id !== wo.shop_id && wo.assigned_manager_id !== user.id) {
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
  dbPool: DatabasePoolLike = pool
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
  dbPool: DatabasePoolLike = pool
): Promise<AdjustStockResult> {
  if (!user || !user.id) {
    throw new InventoryError('Unauthorized: Authentication required.', 401);
  }

  if (!['admin', 'manager'].includes(user.role)) {
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
