import { query as defaultQuery, pool as defaultPool } from '../../config/db';
import { AuthenticatedUser } from '../../middlewares/auth.middleware';
import { createBreakdownComplaintService, IssueCategory } from '../breakdowns/breakdowns.service';

// ---------------------------------------------------------------------------
// 1. Error & Type Definitions
// ---------------------------------------------------------------------------
export class InspectionServiceError extends Error {
  public statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'InspectionServiceError';
    this.statusCode = statusCode;
  }
}

export type DbQueryFunction = (
  text: string,
  params?: any[]
) => Promise<{ rows: any[]; rowCount?: number | null }>;

export interface DbClientLike {
  query: DbQueryFunction;
  release?: () => void;
}

export interface DbPoolLike {
  query: DbQueryFunction;
  connect?: () => Promise<DbClientLike>;
}

let activeDb: DbPoolLike = defaultPool as unknown as DbPoolLike;
let activeIo: any = null;

export const setInspectionsServiceDb = (custom: DbPoolLike): void => {
  activeDb = custom;
};

export const resetInspectionsServiceDb = (): void => {
  activeDb = defaultPool as unknown as DbPoolLike;
};

export const setInspectionsServiceIo = (io: any): void => {
  activeIo = io;
};

export const resetInspectionsServiceIo = (): void => {
  activeIo = null;
};

export const getInspectionsServiceDb = (): DbPoolLike => activeDb;
export const getInspectionsServiceIo = (): any => activeIo;

export async function getDbClient(db: DbPoolLike): Promise<{ client: DbClientLike; release: () => void }> {
  if (typeof db.connect === 'function') {
    const c = await db.connect();
    return {
      client: c,
      release: () => {
        if (typeof c.release === 'function') {
          c.release();
        }
      },
    };
  }
  return {
    client: { query: db.query, release: () => {} },
    release: () => {},
  };
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUUID = (val: unknown): val is string => typeof val === 'string' && UUID_REGEX.test(val.trim());

// ---------------------------------------------------------------------------
// 2. Checklist & Sensor Types
// ---------------------------------------------------------------------------
export interface SensorThresholdItem {
  min?: number;
  max?: number;
  critical_min?: number;
  critical_max?: number;
  unit?: string;
  required?: boolean;
}

export interface SensorThresholds {
  temperature?: SensorThresholdItem;
  pressure?: SensorThresholdItem;
  vibration?: SensorThresholdItem;
}

export interface ChecklistItemDefinition {
  id: string; // e.g. "chk-1"
  label: string;
  type: 'boolean' | 'number' | 'select';
  unit?: string;
  min?: number;
  max?: number;
  critical_min?: number;
  critical_max?: number;
  required?: boolean;
  is_critical?: boolean;
  options?: string[]; // for select
  sensor_type?: 'temperature' | 'pressure' | 'vibration';
}

export interface TemplateEnvelope {
  version: number;
  items: ChecklistItemDefinition[];
  sensor_thresholds?: SensorThresholds;
  description?: string;
}

export interface CreateTemplateInput {
  machine_category: string;
  title: string;
  checklist: ChecklistItemDefinition[] | TemplateEnvelope;
  sensor_thresholds?: SensorThresholds;
  is_active?: boolean;
}

export interface UpdateTemplateInput {
  title?: string;
  checklist?: ChecklistItemDefinition[] | TemplateEnvelope;
  sensor_thresholds?: SensorThresholds;
  is_active?: boolean;
  expected_version?: number;
}

export interface TemplateListQuery {
  machine_category?: string;
  is_active?: string | boolean;
  page?: string | number;
  limit?: string | number;
}

// ---------------------------------------------------------------------------
// 3. Documented Machine Specifications & Default Thresholds
// ---------------------------------------------------------------------------
export const DEFAULT_HMC_CHECKLIST: ChecklistItemDefinition[] = [
  { id: 'chk-1', label: 'Hydraulic System Pressure within 45 - 55 Bar', type: 'number', unit: 'Bar', min: 45, max: 55, critical_min: 35, critical_max: 70, required: true, is_critical: true },
  { id: 'chk-2', label: 'Chiller Unit Operating Temperature (18C - 24C)', type: 'number', unit: 'C', min: 18, max: 24, critical_min: 15, critical_max: 35, required: true, is_critical: false },
  { id: 'chk-3', label: 'Visual Check: No hydraulic fluid pooling or line leaks', type: 'boolean', required: true, is_critical: false },
  { id: 'chk-4', label: 'Emergency Stop & Safety Enclosure Interlock Operational', type: 'boolean', required: true, is_critical: true },
  { id: 'chk-5', label: 'Way Lube Automatic Lubrication Reservoir Full', type: 'boolean', required: true, is_critical: false },
];

export const STANDARD_MACHINE_SPECIFICATIONS: Record<
  string,
  { title: string; items: ChecklistItemDefinition[]; sensor_thresholds: SensorThresholds }
> = {
  HMC: {
    title: 'HMC Daily Pre-Shift Machinery Inspection Checklist',
    items: DEFAULT_HMC_CHECKLIST,
    sensor_thresholds: {
      pressure: { min: 45, max: 55, critical_min: 35, critical_max: 70, unit: 'Bar' },
      temperature: { min: 18, max: 24, critical_min: 15, critical_max: 35, unit: 'C' },
      vibration: { max: 2.5, critical_max: 4.5, unit: 'mm/s' },
    },
  },
  'Robotic Welder': {
    title: 'Robotic Welder Pre-Shift Safety & Sensor Inspection',
    items: [
      { id: 'chk-rob-1', label: 'Safety Light Curtain & Area Interlock Active', type: 'boolean', required: true, is_critical: true },
      { id: 'chk-rob-2', label: 'Weld Shielding Gas Line Pressure (5 - 7 Bar)', type: 'number', unit: 'Bar', min: 5, max: 7, critical_min: 4, critical_max: 8, required: true, is_critical: true },
      { id: 'chk-rob-3', label: 'Torch Tip & Wire Feed Visual Inspection', type: 'boolean', required: true, is_critical: false },
      { id: 'chk-rob-4', label: 'Coolant Flow Rate & Radiator Temp Nominal', type: 'boolean', required: true, is_critical: false },
    ],
    sensor_thresholds: {
      pressure: { min: 5, max: 7, critical_min: 4, critical_max: 8, unit: 'Bar' },
      temperature: { min: 15, max: 35, critical_min: 10, critical_max: 45, unit: 'C' },
      vibration: { max: 1.8, critical_max: 3.0, unit: 'mm/s' },
    },
  },
  Press: {
    title: 'Hydraulic Forming Press Daily Pre-Shift Inspection',
    items: [
      { id: 'chk-prs-1', label: 'Hydraulic Ram Main Pressure (150 - 220 Bar)', type: 'number', unit: 'Bar', min: 150, max: 220, critical_min: 120, critical_max: 260, required: true, is_critical: true },
      { id: 'chk-prs-2', label: 'Die Clamping Mechanism Locked & Interlocked', type: 'boolean', required: true, is_critical: true },
      { id: 'chk-prs-3', label: 'Hydraulic Sump Oil Temperature (25C - 45C)', type: 'number', unit: 'C', min: 25, max: 45, critical_min: 20, critical_max: 60, required: true, is_critical: false },
      { id: 'chk-prs-4', label: 'Emergency Stop Buttons Tested Across 4 Corners', type: 'boolean', required: true, is_critical: true },
    ],
    sensor_thresholds: {
      pressure: { min: 150, max: 220, critical_min: 120, critical_max: 260, unit: 'Bar' },
      temperature: { min: 25, max: 45, critical_min: 20, critical_max: 60, unit: 'C' },
      vibration: { max: 3.5, critical_max: 5.5, unit: 'mm/s' },
    },
  },
};

// ---------------------------------------------------------------------------
// 4. Audit & Notification Helpers
// ---------------------------------------------------------------------------
export async function recordInspectionAuditLog(
  db: DbPoolLike | DbClientLike,
  entityName: string,
  entityId: string,
  action: string,
  performedBy: string,
  oldValues?: any,
  newValues?: any
): Promise<void> {
  try {
    await db.query(
      `INSERT INTO audit_logs (entity_name, entity_id, action, performed_by, old_values, new_values, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        entityName,
        entityId,
        action,
        performedBy,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
      ]
    );
  } catch (err) {
    console.warn('[Inspection Audit Log Failed]:', err);
  }
}

export async function sendInspectionNotification(
  db: DbPoolLike | DbClientLike,
  recipientId: string,
  title: string,
  message: string,
  type: string,
  linkUrl: string,
  io?: any
): Promise<void> {
  try {
    await db.query(
      `INSERT INTO notifications (recipient_id, title, message, type, link_url, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [recipientId, title, message, type, linkUrl]
    );
    if (io && typeof io.to === 'function') {
      const notifPayload = {
        title,
        message,
        type,
        link_url: linkUrl,
        created_at: new Date(),
      };
      // Support both colon and underscore room patterns
      io.to(`user:${recipientId}`).emit('notification:new', notifPayload);
      io.to(`user_${recipientId}`).emit('notification:new', notifPayload);
      io.to(`user:${recipientId}`).emit('notification', notifPayload);
      io.to(`user_${recipientId}`).emit('notification', notifPayload);
    }
  } catch (err) {
    console.warn('[Inspection Notification Failed]:', err);
  }
}

// ---------------------------------------------------------------------------
// 5. Facility Tenancy & Scope Enforcement
// ---------------------------------------------------------------------------

/**
 * Facility Tenancy & Scope Enforcement.
 *
 * Current JCB CMMS Policy:
 * 1. Admin: Universal company-wide access across all plants and shops.
 * 2. Non-admin (Manager, Technician, Operator): Must possess a valid plant_id UUID (fail-closed).
 *    Reject missing or invalid user plant context with HTTP 403.
 * 3. Machine Asset: Must possess a valid plant_id and shop_id UUID (fail-closed).
 *    Reject missing or invalid machine plant/shop context with HTTP 403.
 * 4. Manager & Technician Role Policy:
 *    - With shop_id: Restricted strictly to that assigned shop.
 *    - With null/undefined shop_id: Explicitly recognized as Plant Manager / Plant Maintenance Technician policy
 *      with plant-wide scope across all shops within their assigned plant_id.
 * 5. Operator Role Policy:
 *    - Must possess BOTH a valid plant_id AND valid shop_id UUID (fail-closed).
 *    - Under current schema (001_initial_schema / 002_schema_alignment), there is no operator_machine assignment table.
 *      Operator machine authorization is enforced at shop level (authorized for any machine within user.shop_id).
 */
export function enforceInspectionScope(
  user: AuthenticatedUser,
  machinePlantId?: string,
  machineShopId?: string
): void {
  if (user.role === 'admin') return;

  // 1. Fail-closed: User plant context validation
  if (!user.plant_id || !isUUID(user.plant_id)) {
    throw new InspectionServiceError('Forbidden: Valid plant context is required for non-admin users.', 403);
  }

  // 2. Fail-closed: Machine facility context validation
  if (!machinePlantId || !isUUID(machinePlantId) || !machineShopId || !isUUID(machineShopId)) {
    throw new InspectionServiceError('Forbidden: Machine asset lacks valid plant or shop facility assignment.', 403);
  }

  // 3. Plant isolation across all non-admin roles
  if (user.plant_id !== machinePlantId) {
    throw new InspectionServiceError('Forbidden: Machine belongs to another plant outside your authorized scope.', 403);
  }

  // 4. Role-specific shop policy
  if (user.role === 'operator') {
    if (!user.shop_id || !isUUID(user.shop_id)) {
      throw new InspectionServiceError('Forbidden: Operator must be assigned to a valid shop.', 403);
    }
    if (user.shop_id !== machineShopId) {
      throw new InspectionServiceError('Forbidden: Machine belongs to another shop outside your authorized assigned shop.', 403);
    }
  } else if (user.role === 'manager' || user.role === 'technician') {
    if (user.shop_id) {
      if (!isUUID(user.shop_id)) {
        throw new InspectionServiceError('Forbidden: Invalid shop assignment context.', 403);
      }
      if (user.shop_id !== machineShopId) {
        throw new InspectionServiceError('Forbidden: Machine belongs to another shop outside your authorized assigned shop.', 403);
      }
    }
    // Explicit Plant Manager / Plant Maintenance Technician Policy:
    // When user.shop_id is null/undefined, user is granted plant-wide access within their assigned user.plant_id.
  } else {
    throw new InspectionServiceError(`Forbidden: Role '${user.role}' is not authorized for machine inspection access.`, 403);
  }
}

export async function validateMachineAccess(
  machineId: string,
  user: AuthenticatedUser
): Promise<{ id: string; machine_code: string; name: string; category: string; shop_id: string; plant_id: string; status: string }> {
  if (!isUUID(machineId)) {
    throw new InspectionServiceError('Invalid machine ID format. Must be a valid UUID.', 400);
  }

  // Fail-closed user check before DB lookup if non-admin
  if (user.role !== 'admin' && (!user.plant_id || !isUUID(user.plant_id))) {
    throw new InspectionServiceError('Forbidden: Valid plant context is required for non-admin users.', 403);
  }

  const db = getInspectionsServiceDb();
  // LEFT JOIN so missing shop/plant links do not cause silent omission; caught by fail-closed check
  const mRes = await db.query(
    `SELECT m.id, m.machine_code, m.name, m.category, m.status, m.shop_id, s.plant_id, s.shop_name, p.plant_name
     FROM machines m
     LEFT JOIN shops s ON m.shop_id = s.id
     LEFT JOIN plants p ON s.plant_id = p.id
     WHERE m.id = $1`,
    [machineId]
  );

  if (mRes.rows.length === 0) {
    throw new InspectionServiceError('Machine asset not found.', 404);
  }

  const machine = mRes.rows[0];

  // Enforce fail-closed scope
  enforceInspectionScope(user, machine.plant_id, machine.shop_id);

  return machine;
}

// ---------------------------------------------------------------------------
// 6. Template Structure Validation
// ---------------------------------------------------------------------------
export function validateTemplateStructure(input: {
  title: string;
  machine_category: string;
  checklist: any;
  sensor_thresholds?: any;
}): {
  title: string;
  machine_category: string;
  envelope: TemplateEnvelope;
} {
  if (!input.title || typeof input.title !== 'string' || !input.title.trim()) {
    throw new InspectionServiceError('Template title is required.', 400);
  }
  if (!input.machine_category || typeof input.machine_category !== 'string' || !input.machine_category.trim()) {
    throw new InspectionServiceError('Machine category is required.', 400);
  }

  let items: ChecklistItemDefinition[] = [];
  let version = 1;
  let sensorThresholds: SensorThresholds = {};

  if (Array.isArray(input.checklist)) {
    items = input.checklist;
  } else if (typeof input.checklist === 'object' && input.checklist !== null) {
    if (Array.isArray(input.checklist.items)) {
      items = input.checklist.items;
    }
    if (typeof input.checklist.version === 'number') {
      version = input.checklist.version;
    }
    if (input.checklist.sensor_thresholds && typeof input.checklist.sensor_thresholds === 'object') {
      sensorThresholds = { ...input.checklist.sensor_thresholds };
    }
  } else {
    throw new InspectionServiceError('Checklist must be an array of checklist items or a template envelope object.', 400);
  }

  if (input.sensor_thresholds && typeof input.sensor_thresholds === 'object') {
    sensorThresholds = { ...sensorThresholds, ...input.sensor_thresholds };
  }

  if (items.length === 0) {
    throw new InspectionServiceError('Checklist must contain at least one checklist item.', 400);
  }

  const seenIds = new Set<string>();
  const validatedItems: ChecklistItemDefinition[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item || typeof item !== 'object') {
      throw new InspectionServiceError(`Checklist item at index ${i} is invalid.`, 400);
    }
    const id = (item.id || '').trim();
    if (!id) {
      throw new InspectionServiceError(`Checklist item at index ${i} requires a non-empty string ID.`, 400);
    }
    if (seenIds.has(id.toLowerCase())) {
      throw new InspectionServiceError(`Duplicate checklist item ID '${id}'. Item IDs must be unique.`, 400);
    }
    seenIds.add(id.toLowerCase());

    const label = (item.label || '').trim();
    if (!label) {
      throw new InspectionServiceError(`Checklist item '${id}' requires a non-empty label.`, 400);
    }

    const type = item.type;
    if (!['boolean', 'number', 'select'].includes(type)) {
      throw new InspectionServiceError(`Checklist item '${id}' has unsupported type '${type}'. Must be boolean, number, or select.`, 400);
    }

    const validatedItem: ChecklistItemDefinition = {
      id,
      label,
      type,
      required: item.required !== false,
      is_critical: Boolean(item.is_critical),
    };

    if (item.unit) validatedItem.unit = String(item.unit).trim();

    if (type === 'number') {
      if (item.min !== undefined && item.min !== null) {
        const minVal = Number(item.min);
        if (isNaN(minVal)) throw new InspectionServiceError(`Item '${id}' min must be a valid number.`, 400);
        validatedItem.min = minVal;
      }
      if (item.max !== undefined && item.max !== null) {
        const maxVal = Number(item.max);
        if (isNaN(maxVal)) throw new InspectionServiceError(`Item '${id}' max must be a valid number.`, 400);
        validatedItem.max = maxVal;
      }
      if (validatedItem.min !== undefined && validatedItem.max !== undefined && validatedItem.min > validatedItem.max) {
        throw new InspectionServiceError(`Item '${id}' min (${validatedItem.min}) cannot be greater than max (${validatedItem.max}).`, 400);
      }
      if (item.critical_min !== undefined && item.critical_min !== null) {
        const cMin = Number(item.critical_min);
        if (isNaN(cMin)) throw new InspectionServiceError(`Item '${id}' critical_min must be a valid number.`, 400);
        if (validatedItem.min !== undefined && cMin > validatedItem.min) {
          throw new InspectionServiceError(`Item '${id}' critical_min (${cMin}) cannot be greater than normal min (${validatedItem.min}).`, 400);
        }
        validatedItem.critical_min = cMin;
      }
      if (item.critical_max !== undefined && item.critical_max !== null) {
        const cMax = Number(item.critical_max);
        if (isNaN(cMax)) throw new InspectionServiceError(`Item '${id}' critical_max must be a valid number.`, 400);
        if (validatedItem.max !== undefined && cMax < validatedItem.max) {
          throw new InspectionServiceError(`Item '${id}' critical_max (${cMax}) cannot be less than normal max (${validatedItem.max}).`, 400);
        }
        validatedItem.critical_max = cMax;
      }
    } else if (type === 'select') {
      if (!Array.isArray(item.options) || item.options.length === 0) {
        throw new InspectionServiceError(`Select item '${id}' must define an array of options with at least one choice.`, 400);
      }
      validatedItem.options = item.options.map((opt: any) => String(opt).trim());
    }

    validatedItems.push(validatedItem);
  }

  // Validate sensor thresholds
  const validatedSensors: SensorThresholds = {};
  for (const sensorKey of ['temperature', 'pressure', 'vibration'] as const) {
    const s = (sensorThresholds as any)[sensorKey];
    if (s && typeof s === 'object') {
      const entry: SensorThresholdItem = {};
      if (s.unit) entry.unit = String(s.unit).trim();
      if (s.required !== undefined) entry.required = Boolean(s.required);

      if (s.min !== undefined && s.min !== null) {
        const minVal = Number(s.min);
        if (isNaN(minVal)) throw new InspectionServiceError(`Sensor '${sensorKey}' min must be a valid number.`, 400);
        entry.min = minVal;
      }
      if (s.max !== undefined && s.max !== null) {
        const maxVal = Number(s.max);
        if (isNaN(maxVal)) throw new InspectionServiceError(`Sensor '${sensorKey}' max must be a valid number.`, 400);
        entry.max = maxVal;
      }
      if (s.critical_min !== undefined && s.critical_min !== null) {
        const cMin = Number(s.critical_min);
        if (isNaN(cMin)) throw new InspectionServiceError(`Sensor '${sensorKey}' critical_min must be a valid number.`, 400);
        entry.critical_min = cMin;
      }
      if (s.critical_max !== undefined && s.critical_max !== null) {
        const cMax = Number(s.critical_max);
        if (isNaN(cMax)) throw new InspectionServiceError(`Sensor '${sensorKey}' critical_max must be a valid number.`, 400);
        entry.critical_max = cMax;
      }

      // Logical consistency checks across configured thresholds
      if (entry.min !== undefined && entry.max !== undefined && entry.min > entry.max) {
        throw new InspectionServiceError(`Sensor '${sensorKey}' min (${entry.min}) cannot be greater than max (${entry.max}).`, 400);
      }
      if (entry.critical_min !== undefined && entry.critical_max !== undefined && entry.critical_min > entry.critical_max) {
        throw new InspectionServiceError(`Sensor '${sensorKey}' critical_min (${entry.critical_min}) cannot be greater than critical_max (${entry.critical_max}).`, 400);
      }
      if (entry.critical_min !== undefined && entry.min !== undefined && entry.critical_min > entry.min) {
        throw new InspectionServiceError(`Sensor '${sensorKey}' critical_min (${entry.critical_min}) cannot be greater than normal min (${entry.min}).`, 400);
      }
      if (entry.critical_max !== undefined && entry.max !== undefined && entry.critical_max < entry.max) {
        throw new InspectionServiceError(`Sensor '${sensorKey}' critical_max (${entry.critical_max}) cannot be less than normal max (${entry.max}).`, 400);
      }
      if (entry.critical_min !== undefined && entry.max !== undefined && entry.critical_min > entry.max) {
        throw new InspectionServiceError(`Sensor '${sensorKey}' critical_min (${entry.critical_min}) cannot be greater than normal max (${entry.max}).`, 400);
      }
      if (entry.critical_max !== undefined && entry.min !== undefined && entry.critical_max < entry.min) {
        throw new InspectionServiceError(`Sensor '${sensorKey}' critical_max (${entry.critical_max}) cannot be less than normal min (${entry.min}).`, 400);
      }

      const hasConfiguration =
        entry.min !== undefined ||
        entry.max !== undefined ||
        entry.critical_min !== undefined ||
        entry.critical_max !== undefined ||
        entry.required !== undefined;

      if (hasConfiguration) {
        validatedSensors[sensorKey] = entry;
      }
    }
  }

  return {
    title: input.title.trim(),
    machine_category: input.machine_category.trim(),
    envelope: {
      version,
      items: validatedItems,
      sensor_thresholds: Object.keys(validatedSensors).length > 0 ? validatedSensors : undefined,
    },
  };
}

// ---------------------------------------------------------------------------
// 7. Template Management Services (Phase 2)
// ---------------------------------------------------------------------------

/**
 * Format database row into standardized template response object.
 */
function formatTemplateRow(row: any): any {
  let checklistData = row.checklist;
  if (typeof checklistData === 'string') {
    try {
      checklistData = JSON.parse(checklistData);
    } catch {
      checklistData = [];
    }
  }

  let version = 1;
  let items = Array.isArray(checklistData) ? checklistData : [];
  let sensor_thresholds = undefined;

  if (typeof checklistData === 'object' && checklistData !== null && !Array.isArray(checklistData)) {
    version = checklistData.version || 1;
    items = Array.isArray(checklistData.items) ? checklistData.items : [];
    sensor_thresholds = checklistData.sensor_thresholds;
  }

  return {
    id: row.id,
    machine_category: row.machine_category,
    title: row.title,
    version,
    checklist: items,
    sensor_thresholds,
    is_active: Boolean(row.is_active),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Create a new inspection template with validation and version 1.
 */
export async function createInspectionTemplateService(
  input: CreateTemplateInput,
  user: AuthenticatedUser
): Promise<any> {
  if (user.role !== 'admin' && user.role !== 'manager') {
    throw new InspectionServiceError('Forbidden: Only admins and managers can create inspection templates.', 403);
  }

  if (user.role !== 'admin' && (!user.plant_id || !isUUID(user.plant_id))) {
    throw new InspectionServiceError('Forbidden: Valid plant context is required for non-admin users.', 403);
  }

  const { title, machine_category, envelope } = validateTemplateStructure({
    title: input.title,
    machine_category: input.machine_category,
    checklist: input.checklist,
    sensor_thresholds: input.sensor_thresholds,
  });

  envelope.version = 1;
  const isActive = input.is_active !== false;

  const db = getInspectionsServiceDb();
  const insertRes = await db.query(
    `INSERT INTO inspection_templates (machine_category, title, checklist, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     RETURNING *`,
    [machine_category, title, JSON.stringify(envelope), isActive]
  );

  const created = insertRes.rows[0];

  // Audit trail
  await recordInspectionAuditLog(db, 'inspection_templates', created.id, 'CREATE_TEMPLATE', user.id, null, {
    title,
    machine_category,
    version: 1,
    is_active: isActive,
  });

  return formatTemplateRow(created);
}

/**
 * List inspection templates with pagination and filtering.
 */
export async function getInspectionTemplatesListService(
  query: TemplateListQuery,
  user: AuthenticatedUser
): Promise<{ data: any[]; pagination: { total: number; page: number; limit: number; totalPages: number } }> {
  if (user.role !== 'admin' && (!user.plant_id || !isUUID(user.plant_id))) {
    throw new InspectionServiceError('Forbidden: Valid plant context is required for non-admin users.', 403);
  }

  const db = getInspectionsServiceDb();
  const page = Math.max(1, parseInt(String(query.page || '1'), 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(String(query.limit || '50'), 10) || 50));
  const offset = (page - 1) * limit;

  const conditions: string[] = ['1=1'];
  const params: any[] = [];

  if (query.machine_category) {
    params.push(query.machine_category.trim());
    conditions.push(`LOWER(machine_category) = LOWER($${params.length})`);
  }

  if (query.is_active !== undefined) {
    const activeBool = query.is_active === true || query.is_active === 'true';
    params.push(activeBool);
    conditions.push(`is_active = $${params.length}`);
  }

  const whereSql = conditions.join(' AND ');

  const countRes = await db.query(
    `SELECT COUNT(id) as total FROM inspection_templates WHERE ${whereSql}`,
    params
  );
  const total = parseInt(countRes.rows[0]?.total || '0', 10);

  const dataRes = await db.query(
    `SELECT * FROM inspection_templates
     WHERE ${whereSql}
     ORDER BY created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  const formatted = dataRes.rows.map(formatTemplateRow);

  return {
    data: formatted,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * Retrieve inspection template details by ID.
 */
export async function getInspectionTemplateByIdService(
  templateId: string,
  user: AuthenticatedUser
): Promise<any> {
  if (!isUUID(templateId)) {
    throw new InspectionServiceError('Invalid template ID format. Must be a valid UUID.', 400);
  }

  if (user.role !== 'admin' && (!user.plant_id || !isUUID(user.plant_id))) {
    throw new InspectionServiceError('Forbidden: Valid plant context is required for non-admin users.', 403);
  }

  const db = getInspectionsServiceDb();
  const res = await db.query(
    `SELECT * FROM inspection_templates WHERE id = $1`,
    [templateId]
  );

  if (res.rows.length === 0) {
    throw new InspectionServiceError('Inspection template not found.', 404);
  }

  return formatTemplateRow(res.rows[0]);
}

/**
 * Update an existing inspection template safely with incremented versioning and concurrency protection.
 */
export async function updateInspectionTemplateService(
  templateId: string,
  input: UpdateTemplateInput,
  user: AuthenticatedUser
): Promise<any> {
  if (user.role !== 'admin' && user.role !== 'manager') {
    throw new InspectionServiceError('Forbidden: Only admins and managers can update inspection templates.', 403);
  }

  if (user.role !== 'admin' && (!user.plant_id || !isUUID(user.plant_id))) {
    throw new InspectionServiceError('Forbidden: Valid plant context is required for non-admin users.', 403);
  }

  if (!isUUID(templateId)) {
    throw new InspectionServiceError('Invalid template ID format. Must be a valid UUID.', 400);
  }

  const db = getInspectionsServiceDb();
  const { client, release } = await getDbClient(db);

  try {
    await client.query('BEGIN');

    // Acquire row-level lock to prevent concurrent update races
    const existingRes = await client.query(
      `SELECT * FROM inspection_templates WHERE id = $1 FOR UPDATE`,
      [templateId]
    );

    if (existingRes.rows.length === 0) {
      throw new InspectionServiceError('Inspection template not found.', 404);
    }

    const existing = existingRes.rows[0];
    const oldFormatted = formatTemplateRow(existing);

    // Optimistic Concurrency Control: verify expected_version is mandatory and matches current version
    if (input.expected_version === undefined || input.expected_version === null) {
      throw new InspectionServiceError(
        'Conflict: Optimistic concurrency control requires a valid expected_version. Please provide the current template version to prevent concurrent overwrite.',
        409
      );
    }

    const expVer = Number(input.expected_version);
    if (isNaN(expVer) || expVer !== oldFormatted.version) {
      throw new InspectionServiceError(
        `Conflict: Template version mismatch. Expected version ${expVer}, but current version is ${oldFormatted.version}. Please refresh and reapply your changes.`,
        409
      );
    }

    const nextVersion = (oldFormatted.version || 1) + 1;

    let newTitle = existing.title;
    if (input.title !== undefined) {
      if (typeof input.title !== 'string' || !input.title.trim()) {
        throw new InspectionServiceError('Template title cannot be empty.', 400);
      }
      newTitle = input.title.trim();
    }

    let newEnvelope: TemplateEnvelope = {
      version: nextVersion,
      items: oldFormatted.checklist,
      sensor_thresholds: oldFormatted.sensor_thresholds,
    };

    if (input.checklist !== undefined || input.sensor_thresholds !== undefined) {
      const validated = validateTemplateStructure({
        title: newTitle,
        machine_category: existing.machine_category,
        checklist: input.checklist !== undefined ? input.checklist : oldFormatted.checklist,
        sensor_thresholds: input.sensor_thresholds !== undefined ? input.sensor_thresholds : oldFormatted.sensor_thresholds,
      });
      newEnvelope = validated.envelope;
      newEnvelope.version = nextVersion;
    }

    const newIsActive = input.is_active !== undefined ? Boolean(input.is_active) : existing.is_active;

    const updateRes = await client.query(
      `UPDATE inspection_templates
     SET title = $1, checklist = $2, is_active = $3, updated_at = NOW()
     WHERE id = $4
     RETURNING *`,
      [newTitle, JSON.stringify(newEnvelope), newIsActive, templateId]
    );

    const updated = updateRes.rows[0];

    // Audit trail on transaction client
    await recordInspectionAuditLog(
      client,
      'inspection_templates',
      templateId,
      'UPDATE_TEMPLATE',
      user.id,
      { title: existing.title, version: oldFormatted.version, is_active: existing.is_active },
      { title: newTitle, version: nextVersion, is_active: newIsActive }
    );

    await client.query('COMMIT');
    return formatTemplateRow(updated);
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Safe rollback error suppression
    }
    throw err;
  } finally {
    release();
  }
}

/**
 * Activate or deactivate an inspection template with concurrency locking.
 * Requires expectedVersion to prevent concurrent overwrites.
 */
export async function toggleInspectionTemplateStatusService(
  templateId: string,
  isActive: boolean,
  user: AuthenticatedUser,
  expectedVersion?: number
): Promise<any> {
  if (user.role !== 'admin' && user.role !== 'manager') {
    throw new InspectionServiceError('Forbidden: Only admins and managers can change template status.', 403);
  }

  if (user.role !== 'admin' && (!user.plant_id || !isUUID(user.plant_id))) {
    throw new InspectionServiceError('Forbidden: Valid plant context is required for non-admin users.', 403);
  }

  if (!isUUID(templateId)) {
    throw new InspectionServiceError('Invalid template ID format. Must be a valid UUID.', 400);
  }

  const db = getInspectionsServiceDb();
  const { client, release } = await getDbClient(db);

  try {
    await client.query('BEGIN');

    const existingRes = await client.query(
      `SELECT * FROM inspection_templates WHERE id = $1 FOR UPDATE`,
      [templateId]
    );

    if (existingRes.rows.length === 0) {
      throw new InspectionServiceError('Inspection template not found.', 404);
    }

    const existing = existingRes.rows[0];
    const oldFormatted = formatTemplateRow(existing);

    // Optimistic Concurrency Control: verify expected_version is mandatory and matches current version
    if (expectedVersion === undefined || expectedVersion === null) {
      throw new InspectionServiceError(
        'Conflict: Optimistic concurrency control requires a valid expected_version for template status changes. Please provide the current template version to prevent concurrent overwrite.',
        409
      );
    }

    const expVer = Number(expectedVersion);
    if (isNaN(expVer) || expVer !== oldFormatted.version) {
      throw new InspectionServiceError(
        `Conflict: Template version mismatch. Expected version ${expVer}, but current version is ${oldFormatted.version}. Please refresh and reapply your changes.`,
        409
      );
    }

    const updateRes = await client.query(
      `UPDATE inspection_templates
     SET is_active = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
      [Boolean(isActive), templateId]
    );

    const updated = updateRes.rows[0];

    await recordInspectionAuditLog(
      client,
      'inspection_templates',
      templateId,
      isActive ? 'ACTIVATE_TEMPLATE' : 'DEACTIVATE_TEMPLATE',
      user.id,
      { is_active: existing.is_active },
      { is_active: Boolean(isActive) }
    );

    await client.query('COMMIT');
    return formatTemplateRow(updated);
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Safe rollback error suppression
    }
    throw err;
  } finally {
    release();
  }
}

/**
 * Retrieve active inspection template by machine category (preserving existing backward-compatible endpoint).
 * Returns HTTP 404 configuration error if no active template is configured in the database.
 */
export async function getInspectionTemplateService(
  category: string,
  user: AuthenticatedUser
): Promise<any> {
  if (user.role !== 'admin') {
    if (!user.plant_id || !isUUID(user.plant_id)) {
      throw new InspectionServiceError('Forbidden: Valid plant context is required for non-admin users.', 403);
    }
    if (user.role === 'operator' && (!user.shop_id || !isUUID(user.shop_id))) {
      throw new InspectionServiceError('Forbidden: Operator must be assigned to a valid shop.', 403);
    }
  }

  const cleanCategory = (category || 'HMC').trim();
  const db = getInspectionsServiceDb();

  const result = await db.query(
    `SELECT * FROM inspection_templates 
     WHERE LOWER(machine_category) = LOWER($1) AND is_active = true 
     ORDER BY updated_at DESC LIMIT 1`,
    [cleanCategory]
  );

  if (result.rows.length > 0) {
    return formatTemplateRow(result.rows[0]);
  }

  throw new InspectionServiceError(
    `No active inspection template configured for machine category '${cleanCategory}'. Please configure a template first.`,
    404
  );
}

// ---------------------------------------------------------------------------
// 8. Server-Side Inspection Submission & Evaluation Engine (Phase 2)
// ---------------------------------------------------------------------------
export interface ChecklistResponseItem {
  id: string;
  value: boolean | number | string;
  status?: string; // Optional client assertion, will be verified
  notes?: string;
}

export interface SubmitInspectionInput {
  machine_id: string;
  template_id?: string;
  shift?: string;
  overall_status?: string; // Client-provided status will be IGNORED
  temperature?: number | string | null;
  pressure?: number | string | null;
  vibration?: number | string | null;
  responses?: ChecklistResponseItem[];
  responses_json?: any; // Backward compatible alias
  operator_signature_url?: string;
  escalate_on_fail?: boolean;
}

/**
 * Submit pre-shift machine inspection with complete server-side evaluation.
 *
 * Rules:
 * - Client-provided `overall_status` is strictly IGNORED.
 * - Operator is bound to authenticated user (JWT).
 * - Responses are validated against active template items.
 * - Missing required responses or unknown item IDs reject with HTTP 400.
 * - Critical item failure -> 'fail'.
 * - Non-critical deviation -> 'flagged'.
 * - Sensor outside threshold -> 'fail' (critical) or 'flagged' (deviation).
 * - All valid & within limits -> 'pass'.
 * - Versioned metadata envelope snapshotted in `responses_json`.
 */
export async function submitInspectionService(
  input: SubmitInspectionInput,
  user: AuthenticatedUser
): Promise<any> {
  const { machine_id } = input;
  if (!machine_id) {
    throw new InspectionServiceError('Machine ID is mandatory.', 400);
  }

  // 1. Verify machine exists and enforce fail-closed scope
  const machine = await validateMachineAccess(machine_id, user);

  // 2. Disallow spoofing: operator_id is ALWAYS bound to authenticated user
  const operatorId = user.id;

  const db = getInspectionsServiceDb();

  // 3. Resolve Inspection Template
  let activeTemplate: any = null;
  if (input.template_id) {
    if (!isUUID(input.template_id)) {
      throw new InspectionServiceError('Invalid template ID format.', 400);
    }
    const tRes = await db.query(
      `SELECT * FROM inspection_templates WHERE id = $1`,
      [input.template_id]
    );
    if (tRes.rows.length === 0) {
      throw new InspectionServiceError(`Inspection template '${input.template_id}' not found.`, 404);
    }
    const row = tRes.rows[0];
    if (!row.is_active) {
      throw new InspectionServiceError('Cannot submit inspection against an inactive template.', 400);
    }
    const machineCategory = (machine.category || 'HMC').trim();
    if (row.machine_category.toLowerCase() !== machineCategory.toLowerCase()) {
      throw new InspectionServiceError(`Template category '${row.machine_category}' does not match machine category '${machineCategory}'.`, 400);
    }
    activeTemplate = formatTemplateRow(row);
  } else {
    // Lookup latest active template for machine category
    const machineCategory = (machine.category || 'HMC').trim();
    const tRes = await db.query(
      `SELECT * FROM inspection_templates 
       WHERE LOWER(machine_category) = LOWER($1) AND is_active = true 
       ORDER BY updated_at DESC LIMIT 1`,
      [machineCategory]
    );
    if (tRes.rows.length > 0) {
      activeTemplate = formatTemplateRow(tRes.rows[0]);
    } else {
      throw new InspectionServiceError(
        `No active inspection template configured for machine category '${machineCategory}'. An active template is mandatory for inspection submission.`,
        400
      );
    }
  }

  const templateItems: ChecklistItemDefinition[] = activeTemplate.checklist || [];
  const sensorThresholds: SensorThresholds = activeTemplate.sensor_thresholds || {};

  // 4. Extract and validate responses
  const rawResponses = input.responses !== undefined ? input.responses : input.responses_json;

  if (!Array.isArray(rawResponses) || rawResponses.length === 0) {
    throw new InspectionServiceError('Checklist responses are mandatory for inspection submission.', 400);
  }

  const templateItemMap = new Map<string, ChecklistItemDefinition>();
  for (const item of templateItems) {
    templateItemMap.set(item.id.toLowerCase(), item);
  }

  const responseMap = new Map<string, ChecklistResponseItem>();
  for (let i = 0; i < rawResponses.length; i++) {
    const r = rawResponses[i];
    if (!r || typeof r !== 'object' || !r.id) {
      throw new InspectionServiceError(`Malformed response at index ${i}. Item ID is required.`, 400);
    }
    const cleanId = String(r.id).trim().toLowerCase();

    // Reject unknown checklist item IDs
    if (!templateItemMap.has(cleanId)) {
      throw new InspectionServiceError(`Invalid response: unknown checklist item ID '${r.id}'.`, 400);
    }

    responseMap.set(cleanId, r);
  }

  // Check all required template items are answered
  for (const item of templateItems) {
    if (item.required !== false) {
      const cleanId = item.id.toLowerCase();
      if (!responseMap.has(cleanId)) {
        throw new InspectionServiceError(`Missing required checklist response for '${item.label}' (${item.id}).`, 400);
      }
      const r = responseMap.get(cleanId)!;
      if (r.value === undefined || r.value === null || r.value === '') {
        throw new InspectionServiceError(`Missing required checklist response for '${item.label}' (${item.id}).`, 400);
      }
    }
  }

  // 5. Server-Side Checklist Evaluation
  let hasCriticalFail = false;
  let hasFlagged = false;
  const criticalFailures: any[] = [];
  const deviations: any[] = [];
  const evaluatedItems: any[] = [];

  for (const item of templateItems) {
    const cleanId = item.id.toLowerCase();
    const r = responseMap.get(cleanId);
    if (!r) continue;

    let itemStatus: 'pass' | 'flagged' | 'fail' = 'pass';
    let notes = '';

    if (item.type === 'number') {
      const val = Number(r.value);
      if (isNaN(val)) {
        throw new InspectionServiceError(`Invalid numeric value '${r.value}' for item '${item.id}'.`, 400);
      }

      if (item.critical_min !== undefined && val < item.critical_min) {
        itemStatus = 'fail';
        notes = `Reading ${val} breached critical min threshold ${item.critical_min} ${item.unit || ''}`.trim();
      } else if (item.critical_max !== undefined && val > item.critical_max) {
        itemStatus = 'fail';
        notes = `Reading ${val} breached critical max threshold ${item.critical_max} ${item.unit || ''}`.trim();
      } else if (item.min !== undefined && val < item.min) {
        itemStatus = item.is_critical ? 'fail' : 'flagged';
        notes = `Reading ${val} below normal min threshold ${item.min} ${item.unit || ''}`.trim();
      } else if (item.max !== undefined && val > item.max) {
        itemStatus = item.is_critical ? 'fail' : 'flagged';
        notes = `Reading ${val} above normal max threshold ${item.max} ${item.unit || ''}`.trim();
      }
    } else if (item.type === 'boolean') {
      const isPassing = r.value === true || r.value === 'pass' || r.value === 'true';
      const isFailing = r.value === false || r.value === 'fail' || r.value === 'false';
      if (!isPassing && !isFailing) {
        throw new InspectionServiceError(`Invalid boolean value '${r.value}' for item '${item.id}'. Must be true, false, 'pass', or 'fail'.`, 400);
      }
      if (isFailing) {
        itemStatus = item.is_critical ? 'fail' : 'flagged';
        notes = item.is_critical ? 'Critical safety/operational interlock failed.' : 'Non-critical check deviation noted.';
      }
    } else if (item.type === 'select') {
      const valStr = String(r.value).trim();
      if (item.options && !item.options.includes(valStr)) {
        throw new InspectionServiceError(`Invalid option '${valStr}' for item '${item.id}'. Allowed: ${item.options.join(', ')}`, 400);
      }
      if (r.status === 'fail' || r.status === 'flagged') {
        itemStatus = item.is_critical && r.status === 'fail' ? 'fail' : 'flagged';
        notes = `Option '${valStr}' evaluated as ${itemStatus}.`;
      }
    }

    if (itemStatus === 'fail') {
      hasCriticalFail = true;
      criticalFailures.push({ id: item.id, label: item.label, notes });
    } else if (itemStatus === 'flagged') {
      hasFlagged = true;
      deviations.push({ id: item.id, label: item.label, notes });
    }

    evaluatedItems.push({
      id: item.id,
      label: item.label,
      type: item.type,
      value: r.value,
      status: itemStatus,
      is_critical: item.is_critical,
      notes: notes || undefined,
    });
  }

  // 6. Server-Side Sensor Evaluation (Temperature, Pressure, Vibration)
  const evaluatedSensors: Record<string, any> = {};

  const sensorInputs: Array<{ key: 'temperature' | 'pressure' | 'vibration'; label: string; raw: any }> = [
    { key: 'temperature', label: 'Operating Temperature', raw: input.temperature },
    { key: 'pressure', label: 'System Pressure', raw: input.pressure },
    { key: 'vibration', label: 'Vibration Level', raw: input.vibration },
  ];

  let numTemperature: number | null = null;
  let numPressure: number | null = null;
  let numVibration: number | null = null;

  for (const s of sensorInputs) {
    const threshold = sensorThresholds[s.key];
    const hasValue = s.raw !== undefined && s.raw !== null && s.raw !== '';

    // Enforce required sensor check if threshold specifies required: true
    if (threshold?.required && !hasValue) {
      throw new InspectionServiceError(
        `Missing required sensor reading for '${s.label}' (${s.key}).`,
        400
      );
    }

    if (hasValue) {
      const numVal = parseFloat(String(s.raw));
      if (isNaN(numVal)) {
        throw new InspectionServiceError(`Invalid numeric value '${s.raw}' for sensor '${s.key}'.`, 400);
      }

      if (s.key === 'temperature') numTemperature = numVal;
      if (s.key === 'pressure') numPressure = numVal;
      if (s.key === 'vibration') numVibration = numVal;

      // Missing or incomplete threshold configuration check
      if (
        !threshold ||
        (threshold.min === undefined &&
          threshold.max === undefined &&
          threshold.critical_min === undefined &&
          threshold.critical_max === undefined)
      ) {
        throw new InspectionServiceError(
          `Missing or incomplete threshold configuration for sensor '${s.key}'. Cannot evaluate reading safely.`,
          400
        );
      }

      let sStatus: 'pass' | 'flagged' | 'fail' = 'pass';
      let sNotes = '';

      if (threshold.critical_min !== undefined && numVal < threshold.critical_min) {
        sStatus = 'fail';
        sNotes = `Critical low: reading ${numVal} breached critical min ${threshold.critical_min} ${threshold.unit || ''}`.trim();
      } else if (threshold.critical_max !== undefined && numVal > threshold.critical_max) {
        sStatus = 'fail';
        sNotes = `Critical high: reading ${numVal} breached critical max ${threshold.critical_max} ${threshold.unit || ''}`.trim();
      } else if (threshold.min !== undefined && numVal < threshold.min) {
        sStatus = 'flagged';
        sNotes = `Deviation: reading ${numVal} below operating min ${threshold.min} ${threshold.unit || ''}`.trim();
      } else if (threshold.max !== undefined && numVal > threshold.max) {
        sStatus = 'flagged';
        sNotes = `Deviation: reading ${numVal} above operating max ${threshold.max} ${threshold.unit || ''}`.trim();
      }

      if (sStatus === 'fail') {
        hasCriticalFail = true;
        criticalFailures.push({ id: s.key, label: s.label, notes: sNotes });
      } else if (sStatus === 'flagged') {
        hasFlagged = true;
        deviations.push({ id: s.key, label: s.label, notes: sNotes });
      }

      evaluatedSensors[s.key] = {
        value: numVal,
        status: sStatus,
        limits: threshold,
        notes: sNotes || undefined,
      };
    }
  }

  // 7. Calculate Final Status (Completely discarding client input.overall_status)
  let calculatedOverallStatus: 'pass' | 'flagged' | 'fail' = 'pass';
  if (hasCriticalFail) {
    calculatedOverallStatus = 'fail';
  } else if (hasFlagged) {
    calculatedOverallStatus = 'flagged';
  }

  // 8. Snapshot Versioned Metadata Envelope
  const metadataEnvelope = {
    template_id: activeTemplate.id || null,
    template_version: activeTemplate.version || 1,
    template_title: activeTemplate.title,
    machine_category: machine.category || 'HMC',
    evaluated_at: new Date().toISOString(),
    evaluation_summary: {
      overall_status: calculatedOverallStatus,
      total_items: templateItems.length,
      passed_items: evaluatedItems.filter((x: any) => x.status === 'pass').length,
      flagged_items: deviations.length,
      failed_items: criticalFailures.length,
      critical_failures: criticalFailures,
      deviations: deviations,
    },
    items: evaluatedItems,
    sensors: evaluatedSensors,
  };

  const shift = (input.shift || 'Shift A').trim();
  const operatorSignatureUrl = (input.operator_signature_url || '').trim();

  // 9. Persist into inspection_records
  const insertRes = await db.query(
    `INSERT INTO inspection_records (
      machine_id, operator_id, shift, overall_status,
      temperature, pressure, vibration, responses_json, operator_signature_url
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *`,
    [
      machine.id,
      operatorId,
      shift,
      calculatedOverallStatus,
      numTemperature,
      numPressure,
      numVibration,
      JSON.stringify(metadataEnvelope),
      operatorSignatureUrl,
    ]
  );

  const record = insertRes.rows[0];

  // 10. Regulatory Audit Log
  const auditAction =
    calculatedOverallStatus === 'fail'
      ? 'INSPECTION_CRITICAL_FAIL'
      : calculatedOverallStatus === 'flagged'
      ? 'INSPECTION_FLAGGED'
      : 'INSPECTION_SUBMITTED';

  await recordInspectionAuditLog(db, 'inspection_records', record.id, auditAction, user.id, null, {
    machine_id: machine.id,
    overall_status: calculatedOverallStatus,
    template_id: activeTemplate.id,
    template_version: activeTemplate.version,
    critical_failures_count: criticalFailures.length,
    deviations_count: deviations.length,
  });

  // 11. Cross-Module Escalation & Alerts
  let autoEscalatedComplaint: any = null;
  if (calculatedOverallStatus === 'fail' || calculatedOverallStatus === 'flagged') {
    // Notify managers in the machine's plant
    const mgrsRes = await db.query(
      `SELECT id FROM users WHERE plant_id = $1 AND role = 'manager' AND is_active = true`,
      [machine.plant_id]
    );

    const alertTitle =
      calculatedOverallStatus === 'fail'
        ? `Critical Inspection Failure: ${machine.machine_code}`
        : `Inspection Flagged: ${machine.machine_code}`;
    const alertMsg =
      calculatedOverallStatus === 'fail'
        ? `Pre-shift inspection failed for machine ${machine.machine_code} (${machine.name}) during ${shift}. Immediate maintenance required.`
        : `Pre-shift inspection flagged with deviations for machine ${machine.machine_code} during ${shift}.`;

    const io = getInspectionsServiceIo();
    for (const mgr of mgrsRes.rows) {
      await sendInspectionNotification(
        db,
        mgr.id,
        alertTitle,
        alertMsg,
        'alert',
        `/inspections/records/${record.id}`,
        io
      );
    }

    if (io && typeof io.to === 'function') {
      const alertPayload = {
        record_id: record.id,
        machine_id: machine.id,
        machine_code: machine.machine_code,
        overall_status: calculatedOverallStatus,
        critical_failures: criticalFailures,
        deviations: deviations,
      };
      io.to(`plant:${machine.plant_id}`).emit('inspection_alert', alertPayload);
      io.to(`plant_${machine.plant_id}`).emit('inspection_alert', alertPayload);
      if (machine.shop_id) {
        io.to(`shop:${machine.shop_id}`).emit('inspection_alert', alertPayload);
      }
    }

    // Breakdown Escalation (Delegating strictly to Module 2 Breakdown Service)
    if (calculatedOverallStatus === 'fail' && input.escalate_on_fail) {
      try {
        let issueCategory: IssueCategory = 'mechanical';
        const failureText = criticalFailures
          .map((cf) => `${cf.id} ${cf.label} ${cf.notes}`)
          .join(' ')
          .toLowerCase();

        if (
          failureText.includes('safety') ||
          failureText.includes('interlock') ||
          failureText.includes('e-stop') ||
          failureText.includes('emergency')
        ) {
          issueCategory = 'safety';
        } else if (
          failureText.includes('hydraul') ||
          failureText.includes('pressure') ||
          failureText.includes('fluid') ||
          failureText.includes('leak')
        ) {
          issueCategory = 'hydraulic';
        } else if (
          failureText.includes('temp') ||
          failureText.includes('chiller') ||
          failureText.includes('coolant') ||
          failureText.includes('lubric')
        ) {
          issueCategory = 'lubrication';
        } else if (
          failureText.includes('electr') ||
          failureText.includes('power') ||
          failureText.includes('fuse')
        ) {
          issueCategory = 'electrical';
        }

        const failureDetails = criticalFailures
          .map((cf) => `${cf.label}: ${cf.notes || 'Breached limit'}`)
          .join('; ');

        autoEscalatedComplaint = await createBreakdownComplaintService(
          {
            machine_id: machine.id,
            shift,
            issue_category: issueCategory,
            priority: 'critical',
            problem_title: `Auto-Escalation: Inspection Failure ${machine.machine_code}`.slice(0, 255),
            description: `Automated breakdown complaint generated from failed pre-shift inspection (${record.id}). Critical failures: ${failureDetails}`,
            temperature: numTemperature,
            pressure: numPressure,
          },
          user,
          db as any,
          io
        );
      } catch (escErr: any) {
        console.warn('[Breakdown Escalation Failed]:', escErr?.message || escErr);
      }
    }
  }

  return {
    ...record,
    responses_json: metadataEnvelope,
    breakdown_complaint: autoEscalatedComplaint,
  };
}

// ---------------------------------------------------------------------------
// 9. Records Querying & Details
// ---------------------------------------------------------------------------
export interface GetInspectionRecordsQuery {
  machine_id?: string;
  shift?: string;
  overall_status?: string;
  page?: string | number;
  limit?: string | number;
  plant_id?: string;
  shop_id?: string;
}

/**
 * Retrieve paginated inspection records with multi-tenant plant/shop isolation.
 */
export async function getInspectionRecordsService(
  queryFilters: GetInspectionRecordsQuery,
  user: AuthenticatedUser
): Promise<{ data: any[]; pagination: { total: number; page: number; limit: number; totalPages: number } }> {
  const db = getInspectionsServiceDb();
  const page = Math.max(1, parseInt(String(queryFilters.page || '1'), 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(String(queryFilters.limit || '50'), 10) || 50));
  const offset = (page - 1) * limit;

  const conditions: string[] = ['1=1'];
  const params: any[] = [];

  // Facility tenancy filtering based on authenticated user (fail-closed, never bypassed by query)
  if (user.role !== 'admin') {
    if (!user.plant_id || !isUUID(user.plant_id)) {
      throw new InspectionServiceError('Forbidden: Valid plant context is required for non-admin users.', 403);
    }

    // Detect and reject attempts to bypass scope via query parameters
    if (queryFilters.plant_id && queryFilters.plant_id !== user.plant_id) {
      throw new InspectionServiceError('Forbidden: Cannot access records for another plant.', 403);
    }

    // Always enforce user's authenticated plant in SQL
    params.push(user.plant_id);
    conditions.push(`s.plant_id = $${params.length}`);

    // Role-specific shop policy
    if (user.role === 'operator') {
      if (!user.shop_id || !isUUID(user.shop_id)) {
        throw new InspectionServiceError('Forbidden: Operator must be assigned to a valid shop.', 403);
      }
      if (queryFilters.shop_id && queryFilters.shop_id !== user.shop_id) {
        throw new InspectionServiceError('Forbidden: Cannot access records for another shop outside your assigned shop.', 403);
      }
      params.push(user.shop_id);
      conditions.push(`m.shop_id = $${params.length}`);
    } else if (user.role === 'manager' || user.role === 'technician') {
      if (user.shop_id) {
        if (!isUUID(user.shop_id)) {
          throw new InspectionServiceError('Forbidden: Invalid shop assignment context.', 403);
        }
        if (queryFilters.shop_id && queryFilters.shop_id !== user.shop_id) {
          throw new InspectionServiceError('Forbidden: Cannot access records for another shop outside your assigned shop.', 403);
        }
        params.push(user.shop_id);
        conditions.push(`m.shop_id = $${params.length}`);
      } else if (queryFilters.shop_id) {
        if (!isUUID(queryFilters.shop_id)) {
          throw new InspectionServiceError('Invalid shop_id filter format.', 400);
        }
        params.push(queryFilters.shop_id);
        conditions.push(`m.shop_id = $${params.length}`);
      }
    } else {
      throw new InspectionServiceError(`Forbidden: Role '${user.role}' is not authorized to list inspection records.`, 403);
    }
  } else {
    // Admin user: optionally filter by plant_id or shop_id if provided in query
    if (queryFilters.plant_id) {
      if (!isUUID(queryFilters.plant_id)) {
        throw new InspectionServiceError('Invalid plant_id filter format.', 400);
      }
      params.push(queryFilters.plant_id);
      conditions.push(`s.plant_id = $${params.length}`);
    }
    if (queryFilters.shop_id) {
      if (!isUUID(queryFilters.shop_id)) {
        throw new InspectionServiceError('Invalid shop_id filter format.', 400);
      }
      params.push(queryFilters.shop_id);
      conditions.push(`m.shop_id = $${params.length}`);
    }
  }

  // If machine_id provided, validate UUID and access
  if (queryFilters.machine_id) {
    if (!isUUID(queryFilters.machine_id)) {
      throw new InspectionServiceError('Invalid machine ID format.', 400);
    }
    // Verify machine is in scope
    await validateMachineAccess(queryFilters.machine_id, user);
    params.push(queryFilters.machine_id);
    conditions.push(`ir.machine_id = $${params.length}`);
  }

  if (queryFilters.shift) {
    params.push(queryFilters.shift);
    conditions.push(`ir.shift = $${params.length}`);
  }

  if (queryFilters.overall_status) {
    params.push(queryFilters.overall_status.toLowerCase());
    conditions.push(`LOWER(ir.overall_status) = $${params.length}`);
  }

  const whereSql = conditions.join(' AND ');

  // Count total for pagination
  const countRes = await db.query(
    `SELECT COUNT(ir.id) as total
     FROM inspection_records ir
     JOIN machines m ON ir.machine_id = m.id
     JOIN shops s ON m.shop_id = s.id
     WHERE ${whereSql}`,
    params
  );
  const total = parseInt(countRes.rows[0]?.total || '0', 10);

  // Data query
  const dataSql = `
    SELECT 
      ir.*, 
      m.machine_code, 
      m.name as machine_name, 
      s.shop_name, 
      s.plant_id,
      u.full_name as operator_name
    FROM inspection_records ir
    JOIN machines m ON ir.machine_id = m.id
    JOIN shops s ON m.shop_id = s.id
    LEFT JOIN users u ON ir.operator_id = u.id
    WHERE ${whereSql}
    ORDER BY ir.created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  const dataRes = await db.query(dataSql, [...params, limit, offset]);

  const rows = dataRes.rows.map((row) => {
    let envelope = row.responses_json;
    if (typeof envelope === 'string') {
      try {
        envelope = JSON.parse(envelope);
      } catch {
        envelope = [];
      }
    }
    return {
      ...row,
      responses_json: envelope,
    };
  });

  return {
    data: rows,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * Retrieve a single inspection record by ID with full machine and audit context.
 */
export async function getInspectionRecordByIdService(
  recordId: string,
  user: AuthenticatedUser
): Promise<any> {
  if (!isUUID(recordId)) {
    throw new InspectionServiceError('Invalid inspection record ID format. Must be a valid UUID.', 400);
  }

  if (user.role !== 'admin' && (!user.plant_id || !isUUID(user.plant_id))) {
    throw new InspectionServiceError('Forbidden: Valid plant context is required for non-admin users.', 403);
  }

  const db = getInspectionsServiceDb();
  const res = await db.query(
    `SELECT 
      ir.*, 
      m.machine_code, 
      m.name as machine_name, 
      m.category as machine_category,
      m.shop_id, 
      s.plant_id, 
      s.shop_name, 
      p.plant_name, 
      u.full_name as operator_name,
      u.employee_code as operator_employee_code
     FROM inspection_records ir
     JOIN machines m ON ir.machine_id = m.id
     JOIN shops s ON m.shop_id = s.id
     JOIN plants p ON s.plant_id = p.id
     LEFT JOIN users u ON ir.operator_id = u.id
     WHERE ir.id = $1`,
    [recordId]
  );

  if (res.rows.length === 0) {
    throw new InspectionServiceError('Inspection record not found.', 404);
  }

  const record = res.rows[0];

  // Enforce fail-closed facility scope
  enforceInspectionScope(user, record.plant_id, record.shop_id);

  let envelope = record.responses_json;
  if (typeof envelope === 'string') {
    try {
      envelope = JSON.parse(envelope);
    } catch {
      envelope = [];
    }
  }

  return {
    ...record,
    responses_json: envelope,
  };
}
