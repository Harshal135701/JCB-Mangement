/**
 * JCB Smart Machine Maintenance Management System (CMMS)
 * Machines Module - Business Logic & Service Layer
 * Enforces facility isolation, lifecycle state machine, validation, and audit trail.
 */

import crypto from 'crypto';
import { query as defaultQuery, pool as defaultPool } from '../../config/db';
import { AuthenticatedUser } from '../../middlewares/auth.middleware';
import {
  machinesRepository,
  DbQueryFunction,
  DbClientLike,
  MachineRow,
  CreateMachineRepoInput,
  UpdateMachineRepoInput,
  ListMachinesRepoFilter,
  ALLOWED_SORT_COLUMNS,
} from './machines.repository';

// ---------------------------------------------------------------------------
// Error Handling
// ---------------------------------------------------------------------------
export class MachineServiceError extends Error {
  public readonly statusCode: number;
  public readonly details?: any;

  constructor(message: string, statusCode: number = 400, details?: any) {
    super(message);
    this.name = 'MachineServiceError';
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, MachineServiceError.prototype);
  }
}

// ---------------------------------------------------------------------------
// Constants & Allowed Enums
// ---------------------------------------------------------------------------
export const ALLOWED_MACHINE_CRITICALITIES = ['class_a', 'class_b', 'class_c'] as const;
export type MachineCriticality = (typeof ALLOWED_MACHINE_CRITICALITIES)[number];

export const ALLOWED_MACHINE_STATUSES = [
  'running',
  'idle',
  'breakdown',
  'under_maintenance',
  'awaiting_parts',
  'awaiting_verification',
  'inactive',
  'decommissioned',
] as const;
export type MachineLifecycleStatus = (typeof ALLOWED_MACHINE_STATUSES)[number];

export const MAINTENANCE_WORKFLOW_STATUSES = [
  'breakdown',
  'under_maintenance',
  'awaiting_parts',
  'awaiting_verification',
] as const;
export type MaintenanceWorkflowStatus = (typeof MAINTENANCE_WORKFLOW_STATUSES)[number];

export const MANAGER_ALLOWED_UPDATE_FIELDS = new Set<string>([
  'operating_hours',
  'bay_line_location',
  'description',
  'manual_url',
  'electrical_diagram_url',
  'hydraulic_schematic_url',
  'sop_document_url',
]);

export const ALLOWED_HISTORY_TYPES = [
  'breakdowns',
  'work_orders',
  'inspections',
  'pm_plans',
  'parts_consumed',
  'purchase_requisitions',
  'rdc_challans',
  'audit_logs',
] as const;
export type MachineHistoryType = (typeof ALLOWED_HISTORY_TYPES)[number];

export const isUUID = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

// ---------------------------------------------------------------------------
// Database Interface & Test Dependency Injection
// ---------------------------------------------------------------------------
export interface DbPoolLike {
  connect: () => Promise<DbClientLike>;
  query?: DbQueryFunction;
}

let activeQuery: DbQueryFunction = defaultQuery as unknown as DbQueryFunction;
let activePool: DbPoolLike = defaultPool as unknown as DbPoolLike;

export function setMachinesServiceDb(customQuery?: DbQueryFunction, customPool?: DbPoolLike): void {
  activeQuery = customQuery || (defaultQuery as unknown as DbQueryFunction);
  activePool = customPool || (defaultPool as unknown as DbPoolLike);
}

export function resetMachinesServiceDb(): void {
  activeQuery = defaultQuery as unknown as DbQueryFunction;
  activePool = defaultPool as unknown as DbPoolLike;
}

// ---------------------------------------------------------------------------
// Facility Scope Enforcement
// ---------------------------------------------------------------------------
/**
 * Strict Multi-Plant & Shop Facility Isolation Policy:
 * 1. Admin:
 *    - With user.plant_id: Scoped strictly to that plant.
 *    - With null/undefined plant_id: Enterprise-wide scope across all plants.
 * 2. Manager & Technician:
 *    - Must possess a valid plant_id.
 *    - With shop_id: Scoped strictly to that shop.
 *    - With null/undefined shop_id: Permitted plant-wide across all shops in plant_id.
 * 3. Operator:
 *    - Must possess BOTH a valid plant_id AND a valid shop_id (fail-closed).
 *    - Scoped strictly to their assigned shop.
 */
export function enforceMachineFacilityScope(
  user: AuthenticatedUser,
  machinePlantId?: string,
  machineShopId?: string
): void {
  if (!user || !user.role) {
    throw new MachineServiceError('Authentication required.', 401);
  }

  // Enterprise Admin with no plant restriction has global multi-plant access
  if (user.role === 'admin' && !user.plant_id) {
    return;
  }

  // Plant-scoped Admin
  if (user.role === 'admin' && user.plant_id) {
    if (machinePlantId && user.plant_id !== machinePlantId) {
      throw new MachineServiceError(
        'Forbidden: Machine belongs to another plant facility outside your authorized scope.',
        403
      );
    }
    return;
  }

  // All non-admin roles require a valid plant_id
  if (!user.plant_id || !isUUID(user.plant_id)) {
    throw new MachineServiceError('Forbidden: Valid plant facility context is required.', 403);
  }

  if (machinePlantId && user.plant_id !== machinePlantId) {
    throw new MachineServiceError(
      'Forbidden: Machine belongs to another plant facility outside your authorized scope.',
      403
    );
  }

  // Operator role strictly requires assigned shop_id
  if (user.role === 'operator') {
    if (!user.shop_id || !isUUID(user.shop_id)) {
      throw new MachineServiceError('Forbidden: Operator must be assigned to a valid shop facility.', 403);
    }
    if (machineShopId && user.shop_id !== machineShopId) {
      throw new MachineServiceError(
        'Forbidden: Machine belongs to another shop facility outside your authorized assigned shop.',
        403
      );
    }
    return;
  }

  // Manager & Technician roles
  if (user.role === 'manager' || user.role === 'technician') {
    if (user.shop_id) {
      if (!isUUID(user.shop_id)) {
        throw new MachineServiceError('Forbidden: Invalid user shop facility context.', 403);
      }
      if (machineShopId && user.shop_id !== machineShopId) {
        throw new MachineServiceError(
          'Forbidden: Machine belongs to another shop facility outside your authorized assigned shop.',
          403
        );
      }
    }
    return;
  }

  throw new MachineServiceError(`Forbidden: Role '${user.role}' is not authorized to access machines.`, 403);
}

// ---------------------------------------------------------------------------
// Input Interfaces
// ---------------------------------------------------------------------------
export interface CreateMachineInput {
  shop_id: string;
  machine_code: string;
  name: string;
  category: string;
  oem_manufacturer: string;
  model_number?: string | null;
  serial_number?: string | null;
  bay_line_location?: string | null;
  bay_id?: string | null;
  production_line_id?: string | null;
  criticality?: string;
  status?: string;
  operating_hours?: number | string;
  maintenance_frequency_days?: number | string;
  qr_code_uid?: string;
  manual_url?: string | null;
  electrical_diagram_url?: string | null;
  hydraulic_schematic_url?: string | null;
  sop_document_url?: string | null;
  description?: string | null;
}

export interface UpdateMachineInput {
  name?: string;
  category?: string;
  oem_manufacturer?: string;
  model_number?: string | null;
  serial_number?: string | null;
  bay_line_location?: string | null;
  bay_id?: string | null;
  production_line_id?: string | null;
  shop_id?: string;
  criticality?: string;
  status?: string;
  operating_hours?: number | string;
  maintenance_frequency_days?: number | string;
  manual_url?: string | null;
  electrical_diagram_url?: string | null;
  hydraulic_schematic_url?: string | null;
  sop_document_url?: string | null;
  description?: string | null;
  // Immutable fields passed maliciously or erroneously
  id?: any;
  created_at?: any;
  qr_code_uid?: any;
  machine_code?: any;
}

export interface ListMachinesFilter {
  plant_id?: string;
  shop_id?: string;
  category?: string;
  criticality?: string;
  status?: string;
  exclude_decommissioned?: boolean | string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC' | 'asc' | 'desc';
  page?: number | string;
  limit?: number | string;
}

// ---------------------------------------------------------------------------
// Service Class Implementation
// ---------------------------------------------------------------------------
export class MachinesService {
  /**
   * Register a new industrial machine asset with strict validation, unique QR generation,
   * facility isolation, and audit logging.
   */
  async createMachine(input: CreateMachineInput, user: AuthenticatedUser, ipAddress?: string): Promise<MachineRow> {
    if (!user) {
      throw new MachineServiceError('Authentication required.', 401);
    }

    // 1. Mandatory Fields Validation
    if (!input.machine_code || typeof input.machine_code !== 'string' || !input.machine_code.trim()) {
      throw new MachineServiceError('machine_code is required and cannot be empty.', 400);
    }
    const cleanMachineCode = input.machine_code.trim().toUpperCase();

    if (!input.name || typeof input.name !== 'string' || !input.name.trim()) {
      throw new MachineServiceError('name is required and cannot be empty.', 400);
    }
    const cleanName = input.name.trim();

    if (!input.category || typeof input.category !== 'string' || !input.category.trim()) {
      throw new MachineServiceError('category is required and cannot be empty.', 400);
    }
    const cleanCategory = input.category.trim();

    if (!input.oem_manufacturer || typeof input.oem_manufacturer !== 'string' || !input.oem_manufacturer.trim()) {
      throw new MachineServiceError('oem_manufacturer is required and cannot be empty.', 400);
    }
    const cleanManufacturer = input.oem_manufacturer.trim();

    if (!input.shop_id || !isUUID(input.shop_id)) {
      throw new MachineServiceError('Valid shop_id UUID is required. Cannot silently select default shop.', 400);
    }

    // 2. Verify Shop Existence and Plant Isolation
    const shop = await machinesRepository.verifyShop(activeQuery, input.shop_id);
    if (!shop) {
      throw new MachineServiceError(`Shop with ID '${input.shop_id}' not found.`, 404);
    }

    // Check facility scope for the creating user
    enforceMachineFacilityScope(user, shop.plant_id, shop.id);

    // 3. Optional Bay and Production Line Verification
    if (input.bay_id) {
      if (!isUUID(input.bay_id)) {
        throw new MachineServiceError('Invalid bay_id UUID format.', 400);
      }
      const bay = await machinesRepository.verifyBay(activeQuery, input.bay_id, input.shop_id);
      if (!bay) {
        throw new MachineServiceError(`Bay with ID '${input.bay_id}' not found in assigned shop.`, 400);
      }
    }

    if (input.production_line_id) {
      if (!isUUID(input.production_line_id)) {
        throw new MachineServiceError('Invalid production_line_id UUID format.', 400);
      }
      const line = await machinesRepository.verifyProductionLine(activeQuery, input.production_line_id, input.shop_id);
      if (!line) {
        throw new MachineServiceError(
          `Production line with ID '${input.production_line_id}' not found in assigned shop.`,
          400
        );
      }
    }

    // 4. Criticality Validation
    let criticality: MachineCriticality = 'class_b';
    if (input.criticality) {
      const cleanCriticality = input.criticality.trim().toLowerCase() as MachineCriticality;
      if (!ALLOWED_MACHINE_CRITICALITIES.includes(cleanCriticality)) {
        throw new MachineServiceError(
          `Invalid criticality '${input.criticality}'. Allowed values: ${ALLOWED_MACHINE_CRITICALITIES.join(', ')}`,
          400
        );
      }
      criticality = cleanCriticality;
    }

    // 5. Lifecycle Status Validation
    let status: MachineLifecycleStatus = 'running';
    if (input.status) {
      const cleanStatus = input.status.trim().toLowerCase() as MachineLifecycleStatus;
      if (!ALLOWED_MACHINE_STATUSES.includes(cleanStatus)) {
        throw new MachineServiceError(
          `Invalid status '${input.status}'. Allowed values: ${ALLOWED_MACHINE_STATUSES.join(', ')}`,
          400
        );
      }
      status = cleanStatus;
    }

    // 6. Operating Hours Validation
    let operatingHours = 0;
    if (input.operating_hours !== undefined && input.operating_hours !== null) {
      operatingHours = Number(input.operating_hours);
      if (isNaN(operatingHours) || operatingHours < 0) {
        throw new MachineServiceError('operating_hours must be a non-negative number.', 400);
      }
    }

    // 7. Maintenance Frequency Validation
    let maintenanceFreq = 30;
    if (input.maintenance_frequency_days !== undefined && input.maintenance_frequency_days !== null) {
      maintenanceFreq = parseInt(String(input.maintenance_frequency_days), 10);
      if (isNaN(maintenanceFreq) || maintenanceFreq <= 0) {
        throw new MachineServiceError('maintenance_frequency_days must be a positive integer.', 400);
      }
    }

    // 8. Uniqueness Constraints Check
    const existingCode = await machinesRepository.findByCode(activeQuery, cleanMachineCode);
    if (existingCode) {
      throw new MachineServiceError(`Machine code '${cleanMachineCode}' already exists.`, 409);
    }

    let cleanSerialNumber: string | null = null;
    if (input.serial_number && typeof input.serial_number === 'string' && input.serial_number.trim()) {
      cleanSerialNumber = input.serial_number.trim();
      const existingSerial = await machinesRepository.findBySerialNumber(activeQuery, cleanSerialNumber);
      if (existingSerial) {
        throw new MachineServiceError(`Serial number '${cleanSerialNumber}' already exists.`, 409);
      }
    }

    // 9. QR UID Generation & Collision Check
    let qrUid = input.qr_code_uid?.trim();
    if (!qrUid) {
      const uniqueSuffix = crypto.randomBytes(4).toString('hex').toUpperCase();
      qrUid = `QR-JCB-${cleanMachineCode}-${uniqueSuffix}`;
    }

    const existingQr = await machinesRepository.findByQrUid(activeQuery, qrUid);
    if (existingQr) {
      throw new MachineServiceError(`QR code UID '${qrUid}' already exists.`, 409);
    }

    // 10. Database Transaction Execution
    const client = await activePool.connect();
    try {
      await client.query('BEGIN');

      const repoInput: CreateMachineRepoInput = {
        shop_id: input.shop_id,
        machine_code: cleanMachineCode,
        name: cleanName,
        category: cleanCategory,
        oem_manufacturer: cleanManufacturer,
        model_number: input.model_number ? input.model_number.trim() : null,
        serial_number: cleanSerialNumber,
        bay_line_location: input.bay_line_location ? input.bay_line_location.trim() : null,
        bay_id: input.bay_id || null,
        production_line_id: input.production_line_id || null,
        criticality,
        status,
        operating_hours: operatingHours,
        maintenance_frequency_days: maintenanceFreq,
        qr_code_uid: qrUid,
        manual_url: input.manual_url ? input.manual_url.trim() : null,
        electrical_diagram_url: input.electrical_diagram_url ? input.electrical_diagram_url.trim() : null,
        hydraulic_schematic_url: input.hydraulic_schematic_url ? input.hydraulic_schematic_url.trim() : null,
        sop_document_url: input.sop_document_url ? input.sop_document_url.trim() : null,
        description: input.description ? input.description.trim() : null,
      };

      const machine = await machinesRepository.insertMachine(client.query.bind(client), repoInput);

      await machinesRepository.recordAuditLog(
        client.query.bind(client),
        machine.id,
        'MACHINE_CREATED',
        user.id,
        null,
        {
          machine_code: machine.machine_code,
          name: machine.name,
          shop_id: machine.shop_id,
          status: machine.status,
          operating_hours: machine.operating_hours,
        },
        ipAddress
      );

      await client.query('COMMIT');

      // Fetch enriched record with shop and plant details
      const enriched = await machinesRepository.findById(activeQuery, machine.id);
      return enriched || machine;
    } catch (err: any) {
      try {
        await client.query('ROLLBACK');
      } catch (_) {}
      if (err.code === '23505') {
        throw new MachineServiceError('Machine code, serial number, or QR UID already exists.', 409);
      }
      throw err;
    } finally {
      if (typeof client.release === 'function') {
        client.release();
      }
    }
  }

  /**
   * Retrieve paginated, filtered machine asset list with strict facility isolation.
   */
  async listMachines(
    filter: ListMachinesFilter,
    user: AuthenticatedUser
  ): Promise<{ rows: MachineRow[]; pagination: { total: number; page: number; limit: number; totalPages: number } }> {
    if (!user) {
      throw new MachineServiceError('Authentication required.', 401);
    }

    // 1. Pagination Validation
    const page = filter.page !== undefined ? Number(filter.page) : 1;
    const limit = filter.limit !== undefined ? Number(filter.limit) : 50;

    if (isNaN(page) || page < 1) {
      throw new MachineServiceError('page must be an integer >= 1.', 400);
    }
    if (isNaN(limit) || limit < 1 || limit > 100) {
      throw new MachineServiceError('limit must be an integer between 1 and 100.', 400);
    }

    // 2. Sorting Allowlist Validation
    let sortBy: string | undefined = undefined;
    if (filter.sortBy) {
      const cleanSort = filter.sortBy.trim().toLowerCase();
      if (!ALLOWED_SORT_COLUMNS[cleanSort]) {
        throw new MachineServiceError(
          `Invalid sortBy column '${filter.sortBy}'. Allowed columns: ${Object.keys(ALLOWED_SORT_COLUMNS).join(', ')}`,
          400
        );
      }
      sortBy = cleanSort;
    }

    let sortOrder: 'ASC' | 'DESC' = 'ASC';
    if (filter.sortOrder) {
      const cleanOrder = filter.sortOrder.trim().toUpperCase();
      if (cleanOrder !== 'ASC' && cleanOrder !== 'DESC') {
        throw new MachineServiceError("sortOrder must be either 'ASC' or 'DESC'.", 400);
      }
      sortOrder = cleanOrder;
    }

    // 3. Facility Isolation Enforcement for List
    let effectivePlantId: string | undefined = filter.plant_id;
    let effectiveShopId: string | undefined = filter.shop_id;

    if (user.role !== 'admin') {
      if (!user.plant_id || !isUUID(user.plant_id)) {
        throw new MachineServiceError('Forbidden: Valid plant facility context is required.', 403);
      }

      // If client supplied plant_id and it differs from user's plant_id -> reject
      if (filter.plant_id && filter.plant_id !== user.plant_id) {
        throw new MachineServiceError('Forbidden: Cannot filter machines outside your assigned plant facility.', 403);
      }
      effectivePlantId = user.plant_id;

      if (user.role === 'operator') {
        if (!user.shop_id || !isUUID(user.shop_id)) {
          throw new MachineServiceError('Forbidden: Operator must be assigned to a valid shop facility.', 403);
        }
        if (filter.shop_id && filter.shop_id !== user.shop_id) {
          throw new MachineServiceError('Forbidden: Cannot filter machines outside your assigned shop facility.', 403);
        }
        effectiveShopId = user.shop_id;
      } else if (user.shop_id) {
        if (filter.shop_id && filter.shop_id !== user.shop_id) {
          throw new MachineServiceError('Forbidden: Cannot filter machines outside your assigned shop facility.', 403);
        }
        effectiveShopId = user.shop_id;
      }
    } else if (user.plant_id) {
      // Scoped Admin
      if (filter.plant_id && filter.plant_id !== user.plant_id) {
        throw new MachineServiceError('Forbidden: Cannot filter machines outside your assigned plant facility.', 403);
      }
      effectivePlantId = user.plant_id;
    }

    if (effectivePlantId && !isUUID(effectivePlantId)) {
      throw new MachineServiceError('Invalid plant_id filter format.', 400);
    }
    if (effectiveShopId && !isUUID(effectiveShopId)) {
      throw new MachineServiceError('Invalid shop_id filter format.', 400);
    }

    // 4. Validate filter enums if provided
    if (filter.criticality) {
      const cleanCriticality = filter.criticality.trim().toLowerCase();
      if (!ALLOWED_MACHINE_CRITICALITIES.includes(cleanCriticality as any)) {
        throw new MachineServiceError(`Invalid criticality filter '${filter.criticality}'.`, 400);
      }
    }

    if (filter.status) {
      const cleanStatus = filter.status.trim().toLowerCase();
      if (!ALLOWED_MACHINE_STATUSES.includes(cleanStatus as any)) {
        throw new MachineServiceError(`Invalid status filter '${filter.status}'.`, 400);
      }
    }

    const repoFilter: ListMachinesRepoFilter = {
      plant_id: effectivePlantId,
      shop_id: effectiveShopId,
      category: filter.category ? filter.category.trim() : undefined,
      criticality: filter.criticality ? filter.criticality.trim().toLowerCase() : undefined,
      status: filter.status ? filter.status.trim().toLowerCase() : undefined,
      exclude_decommissioned:
        filter.exclude_decommissioned === true || filter.exclude_decommissioned === 'true',
      search: filter.search ? filter.search.trim() : undefined,
      sortBy,
      sortOrder,
      page,
      limit,
    };

    const { rows, total } = await machinesRepository.listMachines(activeQuery, repoFilter);

    return {
      rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: total === 0 ? 1 : Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retrieve machine by unique QR UID or machine code with facility isolation.
   * Handles decommissioned/inactive assets with an explicit notice.
   * Provides full backward compatibility for legacy barcode scans using machine code.
   */
  async getMachineByQr(
    identifier: string,
    user: AuthenticatedUser
  ): Promise<{ machine: MachineRow; warning?: string }> {
    if (!user) {
      throw new MachineServiceError('Authentication required.', 401);
    }

    if (!identifier || typeof identifier !== 'string' || !identifier.trim()) {
      throw new MachineServiceError('QR UID or machine code is required and cannot be empty.', 400);
    }
    const cleanIdentifier = identifier.trim();

    const machine = await machinesRepository.findByQrOrCode(activeQuery, cleanIdentifier);
    if (!machine) {
      throw new MachineServiceError(
        `No machine found matching QR identifier or machine code: ${cleanIdentifier}`,
        404
      );
    }

    // Enforce Facility Scope
    enforceMachineFacilityScope(user, machine.plant_id, machine.shop_id);

    // Explicit Business Rule for Decommissioned/Inactive Machines
    let warning: string | undefined = undefined;
    if (machine.status === 'decommissioned') {
      warning = `Notice: Machine ${machine.machine_code} is permanently decommissioned and removed from active service.`;
    } else if (machine.status === 'inactive') {
      warning = `Notice: Machine ${machine.machine_code} is currently inactive.`;
    }

    return { machine, warning };
  }

  /**
   * Retrieve machine by UUID with plant and shop details.
   */
  async getMachineById(id: string, user: AuthenticatedUser): Promise<MachineRow> {
    if (!user) {
      throw new MachineServiceError('Authentication required.', 401);
    }

    if (!id || !isUUID(id)) {
      throw new MachineServiceError('Invalid machine ID. Must be a valid UUID.', 400);
    }

    const machine = await machinesRepository.findById(activeQuery, id);
    if (!machine) {
      throw new MachineServiceError('Machine not found.', 404);
    }

    // Enforce Facility Scope
    enforceMachineFacilityScope(user, machine.plant_id, machine.shop_id);

    return machine;
  }

  /**
   * Update machine asset with strict immutable protections, lifecycle consistency,
   * monotonic operating hours meter, nullable clearing, manager field-level authorization,
   * and audit trail.
   */
  async updateMachine(
    id: string,
    input: UpdateMachineInput,
    user: AuthenticatedUser,
    ipAddress?: string
  ): Promise<MachineRow> {
    if (!user) {
      throw new MachineServiceError('Authentication required.', 401);
    }

    if (!id || !isUUID(id)) {
      throw new MachineServiceError('Invalid machine ID. Must be a valid UUID.', 400);
    }

    // Role check: Only admin and manager roles may invoke update
    if (user.role !== 'admin' && user.role !== 'manager') {
      throw new MachineServiceError(
        `Forbidden: Role '${user.role}' is not authorized to update machines.`,
        403
      );
    }

    // 1. Fetch Existing Machine Record
    const existing = await machinesRepository.findById(activeQuery, id);
    if (!existing) {
      throw new MachineServiceError('Machine not found.', 404);
    }

    // Enforce Facility Scope on existing record
    enforceMachineFacilityScope(user, existing.plant_id, existing.shop_id);

    // 2. Manager Field-Level Authorization Enforcement
    if (user.role === 'manager') {
      const unauthorizedFields = Object.keys(input).filter(
        (field) =>
          input[field as keyof UpdateMachineInput] !== undefined &&
          !MANAGER_ALLOWED_UPDATE_FIELDS.has(field)
      );

      if (unauthorizedFields.length > 0) {
        throw new MachineServiceError(
          `Forbidden: Managers are not authorized to modify master asset governance fields (${unauthorizedFields.join(', ')}). Permitted operational fields: ${Array.from(MANAGER_ALLOWED_UPDATE_FIELDS).join(', ')}.`,
          403
        );
      }
    }

    // 3. Reject Updates to Immutable Fields (applicable to all authorized roles)
    if (input.id !== undefined && input.id !== id) {
      throw new MachineServiceError('Machine ID is immutable and cannot be updated.', 400);
    }
    if (input.machine_code !== undefined && input.machine_code !== existing.machine_code) {
      throw new MachineServiceError('machine_code is immutable and cannot be updated.', 400);
    }
    if (input.qr_code_uid !== undefined && input.qr_code_uid !== existing.qr_code_uid) {
      throw new MachineServiceError('qr_code_uid is immutable and cannot be updated.', 400);
    }
    if (input.created_at !== undefined) {
      throw new MachineServiceError('created_at is immutable and cannot be updated.', 400);
    }

    const updates: UpdateMachineRepoInput = {};

    // 4. String fields trimming & validation
    if (input.name !== undefined) {
      if (input.name === null || !input.name.trim()) {
        throw new MachineServiceError('Machine name cannot be empty.', 400);
      }
      updates.name = input.name.trim();
    }

    if (input.category !== undefined) {
      if (input.category === null || !input.category.trim()) {
        throw new MachineServiceError('Machine category cannot be empty.', 400);
      }
      updates.category = input.category.trim();
    }

    if (input.oem_manufacturer !== undefined) {
      if (input.oem_manufacturer === null || !input.oem_manufacturer.trim()) {
        throw new MachineServiceError('OEM manufacturer cannot be empty.', 400);
      }
      updates.oem_manufacturer = input.oem_manufacturer.trim();
    }

    // 5. Shop Relocation & Facility Consistency Check
    if (input.shop_id !== undefined) {
      if (input.shop_id === null || !isUUID(input.shop_id)) {
        throw new MachineServiceError('Valid shop_id UUID is required.', 400);
      }
      const newShop = await machinesRepository.verifyShop(activeQuery, input.shop_id);
      if (!newShop) {
        throw new MachineServiceError(`Target shop with ID '${input.shop_id}' not found.`, 404);
      }
      // Check user authorization for new shop
      enforceMachineFacilityScope(user, newShop.plant_id, newShop.id);
      updates.shop_id = input.shop_id;
    }

    // 6. Serial Number Uniqueness Check
    if (input.serial_number !== undefined) {
      if (input.serial_number === null || input.serial_number === '') {
        updates.serial_number = null;
      } else {
        const cleanSerial = input.serial_number.trim();
        const dup = await machinesRepository.findBySerialNumber(activeQuery, cleanSerial, id);
        if (dup) {
          throw new MachineServiceError(`Serial number '${cleanSerial}' already belongs to machine ${dup.machine_code}.`, 409);
        }
        updates.serial_number = cleanSerial;
      }
    }

    // 7. Criticality Validation
    if (input.criticality !== undefined) {
      if (input.criticality === null) {
        throw new MachineServiceError('Criticality cannot be set to null.', 400);
      }
      const cleanCriticality = input.criticality.trim().toLowerCase() as MachineCriticality;
      if (!ALLOWED_MACHINE_CRITICALITIES.includes(cleanCriticality)) {
        throw new MachineServiceError(
          `Invalid criticality '${input.criticality}'. Allowed values: ${ALLOWED_MACHINE_CRITICALITIES.join(', ')}`,
          400
        );
      }
      updates.criticality = cleanCriticality;
    }

    // 8. Operating Hours Monotonic Validation
    if (input.operating_hours !== undefined && input.operating_hours !== null) {
      const newHours = Number(input.operating_hours);
      if (isNaN(newHours) || newHours < 0) {
        throw new MachineServiceError('operating_hours must be a non-negative number.', 400);
      }
      const currentHours = existing.operating_hours !== null && existing.operating_hours !== undefined
        ? Number(existing.operating_hours)
        : 0;
      if (newHours < currentHours) {
        throw new MachineServiceError(
          `Cumulative operating hours cannot be reduced. Current meter reading is ${currentHours} hours, attempted reading: ${newHours} hours.`,
          400
        );
      }
      updates.operating_hours = newHours;
    }

    // 9. Maintenance Frequency Validation
    if (input.maintenance_frequency_days !== undefined) {
      if (input.maintenance_frequency_days === null) {
        throw new MachineServiceError('maintenance_frequency_days cannot be null.', 400);
      }
      const days = parseInt(String(input.maintenance_frequency_days), 10);
      if (isNaN(days) || days <= 0) {
        throw new MachineServiceError('maintenance_frequency_days must be a positive integer.', 400);
      }
      updates.maintenance_frequency_days = days;
    }

    // 10. Lifecycle Status Consistency & Active Workflows Validation
    if (input.status !== undefined) {
      if (input.status === null) {
        throw new MachineServiceError('Machine status cannot be set to null.', 400);
      }
      const newStatus = input.status.trim().toLowerCase() as MachineLifecycleStatus;
      if (!ALLOWED_MACHINE_STATUSES.includes(newStatus)) {
        throw new MachineServiceError(
          `Invalid status '${input.status}'. Allowed values: ${ALLOWED_MACHINE_STATUSES.join(', ')}`,
          400
        );
      }

      // Block manual assignment of maintenance workflow statuses
      if ((MAINTENANCE_WORKFLOW_STATUSES as readonly string[]).includes(newStatus)) {
        throw new MachineServiceError(
          `Cannot manually assign status '${newStatus}' via machine update endpoint. Maintenance workflow statuses (${MAINTENANCE_WORKFLOW_STATUSES.join(', ')}) are exclusively governed by Breakdown and Work Order workflows.`,
          400
        );
      }

      // Check operational consistency if changing status
      if (newStatus !== existing.status) {
        const { activeBreakdownCount, activeWorkOrderCount } = await machinesRepository.checkActiveWorkflows(
          activeQuery,
          id
        );

        // Cannot transition to running, idle, or inactive if machine has active open breakdowns or open work orders
        if (
          (newStatus === 'running' || newStatus === 'idle' || newStatus === 'inactive') &&
          (activeBreakdownCount > 0 || activeWorkOrderCount > 0)
        ) {
          throw new MachineServiceError(
            `Cannot transition machine status to '${newStatus}': Machine has active maintenance workflows in progress (${activeBreakdownCount} active complaint(s), ${activeWorkOrderCount} open work order(s)). Status is governed by the maintenance lifecycle.`,
            409
          );
        }

        // Cannot decommission machine with active workflows
        if (newStatus === 'decommissioned' && (activeBreakdownCount > 0 || activeWorkOrderCount > 0)) {
          throw new MachineServiceError(
            `Cannot decommission machine while active maintenance workflows are in progress (${activeBreakdownCount} breakdown(s), ${activeWorkOrderCount} open work order(s)).`,
            409
          );
        }

        updates.status = newStatus;
      }
    }

    // 11. Nullable Fields Handling (explicitly supporting null clearing)
    const nullableFields: (keyof UpdateMachineInput)[] = [
      'model_number',
      'bay_line_location',
      'bay_id',
      'production_line_id',
      'manual_url',
      'electrical_diagram_url',
      'hydraulic_schematic_url',
      'sop_document_url',
      'description',
    ];

    for (const field of nullableFields) {
      if (Object.prototype.hasOwnProperty.call(input, field)) {
        const val = input[field];
        (updates as any)[field] = val === null || val === '' ? null : typeof val === 'string' ? val.trim() : val;
      }
    }

    // 12. Transaction Execution with Atomic Operating Hour Concurrency Protection
    const client = await activePool.connect();
    try {
      await client.query('BEGIN');

      let updated: MachineRow | null;
      if (Object.keys(updates).length === 1 && updates.operating_hours !== undefined) {
        updated = await machinesRepository.updateOperatingHours(
          client.query.bind(client),
          id,
          updates.operating_hours
        );
      } else {
        updated = await machinesRepository.updateMachine(client.query.bind(client), id, updates);
      }

      if (!updated) {
        // Zero rows affected: check if machine exists to detect concurrent higher operating hours reading
        if (updates.operating_hours !== undefined) {
          const currentMachine = await machinesRepository.findById(client.query.bind(client), id);
          if (currentMachine) {
            throw new MachineServiceError(
              `Operating hour meter conflict: A concurrent update has already recorded a meter reading of ${currentMachine.operating_hours} hours, which exceeds or conflicts with attempted reading ${updates.operating_hours} hours.`,
              409
            );
          }
        }
        throw new MachineServiceError('Machine not found during update.', 404);
      }

      // Record Audit Logs
      await machinesRepository.recordAuditLog(
        client.query.bind(client),
        id,
        'MACHINE_UPDATED',
        user.id,
        existing,
        updated,
        ipAddress
      );

      if (updates.status && updates.status !== existing.status) {
        await machinesRepository.recordAuditLog(
          client.query.bind(client),
          id,
          'MACHINE_STATUS_UPDATED',
          user.id,
          { status: existing.status },
          { status: updates.status },
          ipAddress
        );
      }

      if (updates.operating_hours !== undefined && updates.operating_hours !== Number(existing.operating_hours)) {
        await machinesRepository.recordAuditLog(
          client.query.bind(client),
          id,
          'MACHINE_HOURS_UPDATED',
          user.id,
          { operating_hours: existing.operating_hours },
          { operating_hours: updates.operating_hours },
          ipAddress
        );
      }

      await client.query('COMMIT');

      const enriched = await machinesRepository.findById(activeQuery, id);
      return enriched || updated;
    } catch (err: any) {
      try {
        await client.query('ROLLBACK');
      } catch (_) {}
      if (err.code === '23505') {
        throw new MachineServiceError('Serial number already belongs to another machine.', 409);
      }
      throw err;
    } finally {
      if (typeof client.release === 'function') {
        client.release();
      }
    }
  }

  /**
   * Decommission or delete machine asset safely inside an isolated transaction.
   * Acquires row-level exclusive lock ('SELECT ... FOR UPDATE OF m').
   * If machine has active workflows, operation is strictly blocked with HTTP 409 Conflict.
   * If machine has past operational history, it is safely transitioned to 'decommissioned'.
   * If machine has zero historical references, it is safely hard deleted.
   */
  async deleteOrDecommissionMachine(
    id: string,
    user: AuthenticatedUser,
    ipAddress?: string
  ): Promise<{
    message: string;
    decommissioned: boolean;
    deleted: boolean;
    data: any;
  }> {
    if (!user) {
      throw new MachineServiceError('Authentication required.', 401);
    }

    if (!id || !isUUID(id)) {
      throw new MachineServiceError('Invalid machine ID. Must be a valid UUID.', 400);
    }

    // Role check: Only admin can delete or decommission
    if (user.role !== 'admin') {
      throw new MachineServiceError('Forbidden: Only administrators can decommission or delete machines.', 403);
    }

    const client = await activePool.connect();
    try {
      await client.query('BEGIN');

      // 1. Acquire row-level lock on machine
      const machine = await machinesRepository.lockMachineForUpdate(client.query.bind(client), id);
      if (!machine) {
        throw new MachineServiceError('Machine not found.', 404);
      }

      // Facility Scope Enforcement inside transaction
      enforceMachineFacilityScope(user, machine.plant_id, machine.shop_id);

      // 2. Check Active Workflows on locked connection
      const { activeBreakdownCount, activeWorkOrderCount } = await machinesRepository.checkActiveWorkflows(
        client.query.bind(client),
        id
      );

      if (activeBreakdownCount > 0 || activeWorkOrderCount > 0) {
        throw new MachineServiceError(
          `Cannot decommission or delete machine while active maintenance workflows exist (${activeBreakdownCount} active breakdown(s), ${activeWorkOrderCount} open work order(s)). Complete or close active workflows first.`,
          409
        );
      }

      // 3. Check Total Historical References on locked connection
      const history = await machinesRepository.checkHistoricalReferences(client.query.bind(client), id);

      // 4A. If machine has historical references (work orders, breakdowns, PM plans, inspections, PRs, RDCs) -> Safe Decommissioning
      if (history.totalHistoryCount > 0) {
        if (machine.status === 'decommissioned') {
          await client.query('COMMIT');
          return {
            message: `Machine ${machine.machine_code} is already decommissioned.`,
            decommissioned: true,
            deleted: false,
            data: machine,
          };
        }

        const decommissionedMachine = await machinesRepository.decommissionMachine(
          client.query.bind(client),
          id
        );

        await machinesRepository.recordAuditLog(
          client.query.bind(client),
          id,
          'MACHINE_DECOMMISSIONED',
          user.id,
          { status: machine.status },
          { status: 'decommissioned', reason: 'Operational history preserved' },
          ipAddress
        );

        await client.query('COMMIT');

        const enriched = await machinesRepository.findById(activeQuery, id);
        return {
          message: `Machine ${machine.machine_code} has historical maintenance records (${history.totalHistoryCount} total record(s)). Safely decommissioned rather than hard-deleted to preserve regulatory audit integrity.`,
          decommissioned: true,
          deleted: false,
          data: enriched || decommissionedMachine,
        };
      }

      // 4B. If zero historical references exist -> Safe Hard Deletion
      const deleted = await machinesRepository.deleteMachine(client.query.bind(client), id);

      await machinesRepository.recordAuditLog(
        client.query.bind(client),
        id,
        'MACHINE_DELETED',
        user.id,
        machine,
        null,
        ipAddress
      );

      await client.query('COMMIT');

      return {
        message: `Machine ${machine.machine_code} deleted successfully.`,
        decommissioned: false,
        deleted: true,
        data: deleted,
      };
    } catch (err: any) {
      try {
        await client.query('ROLLBACK');
      } catch (_) {}
      if (err.code === '23503') {
        throw new MachineServiceError(
          'Cannot delete machine: Foreign key constraint violation. Associated historical records exist.',
          409
        );
      }
      throw err;
    } finally {
      if (typeof client.release === 'function') {
        client.release();
      }
    }
  }

  /**
   * Retrieve consolidated machine maintenance history across breakdowns, work orders,
   * pre-shift inspections, PM plans, spare parts consumed, purchase requisitions,
   * RDC challans, and audit logs.
   * Supports type filtering and per-category pagination.
   */
  async getMachineMaintenanceHistory(
    id: string,
    options: { page?: number | string; limit?: number | string; type?: string },
    user: AuthenticatedUser
  ): Promise<{
    machine: {
      id: string;
      machine_code: string;
      name: string;
      status: string;
      operating_hours: string | number;
      shop_name?: string;
      plant_name?: string;
    };
    metrics: any;
    history: {
      breakdowns: any[];
      workOrders: any[];
      inspections: any[];
      pmPlans: any[];
      partsConsumed: any[];
      purchaseRequisitions: any[];
      rdcChallans: any[];
      auditLogs: any[];
    };
    pagination: {
      page: number;
      limit: number;
      total?: number;
      totalPages?: number;
      categories?: Record<string, any>;
    };
  }> {
    if (!user) {
      throw new MachineServiceError('Authentication required.', 401);
    }

    if (!id || !isUUID(id)) {
      throw new MachineServiceError('Invalid machine ID. Must be a valid UUID.', 400);
    }

    const machine = await machinesRepository.findById(activeQuery, id);
    if (!machine) {
      throw new MachineServiceError('Machine not found.', 404);
    }

    // Facility Scope Enforcement
    enforceMachineFacilityScope(user, machine.plant_id, machine.shop_id);

    // 1. Pagination Validation
    const page = options.page !== undefined ? Number(options.page) : 1;
    const limit = options.limit !== undefined ? Number(options.limit) : 20;

    if (isNaN(page) || page < 1) {
      throw new MachineServiceError('page must be an integer >= 1.', 400);
    }
    if (isNaN(limit) || limit < 1 || limit > 100) {
      throw new MachineServiceError('limit must be an integer between 1 and 100.', 400);
    }

    // 2. Type Filter Validation
    let cleanType: string | undefined = undefined;
    if (options.type !== undefined && options.type !== null && String(options.type).trim() !== '') {
      cleanType = String(options.type).trim().toLowerCase();
      if (cleanType !== 'all' && !ALLOWED_HISTORY_TYPES.includes(cleanType as any)) {
        throw new MachineServiceError(
          `Invalid history type '${options.type}'. Allowed types: ${ALLOWED_HISTORY_TYPES.join(', ')}`,
          400
        );
      }
    }

    const data = await machinesRepository.getMachineMaintenanceHistory(activeQuery, id, {
      page,
      limit,
      type: cleanType,
    });

    const categoryPag = data.categoryPagination || {};
    const requestedCatTotal = cleanType && cleanType !== 'all' ? categoryPag[cleanType]?.total : undefined;
    const requestedCatTotalPages = cleanType && cleanType !== 'all' ? categoryPag[cleanType]?.totalPages : undefined;

    return {
      machine: {
        id: machine.id,
        machine_code: machine.machine_code,
        name: machine.name,
        status: machine.status,
        operating_hours: machine.operating_hours,
        shop_name: machine.shop_name,
        plant_name: machine.plant_name,
      },
      metrics: data.metrics,
      history: {
        breakdowns: data.breakdowns,
        workOrders: data.workOrders,
        inspections: data.inspections,
        pmPlans: data.pmPlans,
        partsConsumed: data.partsConsumed,
        purchaseRequisitions: data.purchaseRequisitions,
        rdcChallans: data.rdcChallans,
        auditLogs: data.auditLogs,
      },
      pagination: {
        page,
        limit,
        ...(requestedCatTotal !== undefined ? { total: requestedCatTotal, totalPages: requestedCatTotalPages } : {}),
        categories: categoryPag,
      },
    };
  }
}

export const machinesService = new MachinesService();
