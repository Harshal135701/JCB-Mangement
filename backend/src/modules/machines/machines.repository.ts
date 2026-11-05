/**
 * JCB Smart Machine Maintenance Management System (CMMS)
 * Machines Module - Repository Layer
 * Enterprise-grade parameterized database access for machine assets.
 */

export interface DbClientLike {
  query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
  release?: () => void;
}

export type DbQueryFunction = (
  text: string,
  params?: any[]
) => Promise<{ rows: any[]; rowCount?: number | null }>;

export interface MachineRow {
  id: string;
  shop_id: string;
  machine_code: string;
  name: string;
  category: string;
  oem_manufacturer: string;
  model_number: string | null;
  serial_number: string | null;
  bay_line_location: string | null;
  bay_id: string | null;
  production_line_id: string | null;
  criticality: 'class_a' | 'class_b' | 'class_c';
  status:
    | 'running'
    | 'idle'
    | 'breakdown'
    | 'under_maintenance'
    | 'awaiting_parts'
    | 'awaiting_verification'
    | 'inactive'
    | 'decommissioned';
  operating_hours: string | number;
  maintenance_frequency_days: number;
  qr_code_uid: string;
  manual_url: string | null;
  electrical_diagram_url: string | null;
  hydraulic_schematic_url: string | null;
  sop_document_url: string | null;
  description: string | null;
  created_at: string | Date;
  updated_at: string | Date;
  shop_name?: string;
  shop_code?: string;
  plant_id?: string;
  plant_name?: string;
  plant_code?: string;
  bay_name?: string | null;
  bay_code?: string | null;
  line_name?: string | null;
  line_code?: string | null;
}

export interface CreateMachineRepoInput {
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
  criticality?: 'class_a' | 'class_b' | 'class_c';
  status?:
    | 'running'
    | 'idle'
    | 'breakdown'
    | 'under_maintenance'
    | 'awaiting_parts'
    | 'awaiting_verification'
    | 'inactive'
    | 'decommissioned';
  operating_hours?: number;
  maintenance_frequency_days?: number;
  qr_code_uid: string;
  manual_url?: string | null;
  electrical_diagram_url?: string | null;
  hydraulic_schematic_url?: string | null;
  sop_document_url?: string | null;
  description?: string | null;
}

export interface UpdateMachineRepoInput {
  name?: string;
  category?: string;
  oem_manufacturer?: string;
  model_number?: string | null;
  serial_number?: string | null;
  bay_line_location?: string | null;
  bay_id?: string | null;
  production_line_id?: string | null;
  shop_id?: string;
  criticality?: 'class_a' | 'class_b' | 'class_c';
  status?:
    | 'running'
    | 'idle'
    | 'breakdown'
    | 'under_maintenance'
    | 'awaiting_parts'
    | 'awaiting_verification'
    | 'inactive'
    | 'decommissioned';
  operating_hours?: number;
  maintenance_frequency_days?: number;
  manual_url?: string | null;
  electrical_diagram_url?: string | null;
  hydraulic_schematic_url?: string | null;
  sop_document_url?: string | null;
  description?: string | null;
}

export interface ListMachinesRepoFilter {
  plant_id?: string;
  shop_id?: string;
  category?: string;
  criticality?: string;
  status?: string;
  exclude_decommissioned?: boolean;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  page: number;
  limit: number;
}

export const ALLOWED_SORT_COLUMNS: Record<string, string> = {
  machine_code: 'm.machine_code',
  name: 'm.name',
  category: 'm.category',
  criticality: 'm.criticality',
  status: 'm.status',
  operating_hours: 'm.operating_hours',
  maintenance_frequency_days: 'm.maintenance_frequency_days',
  created_at: 'm.created_at',
  updated_at: 'm.updated_at',
};

const MACHINE_SELECT_FIELDS = `
  m.id,
  m.shop_id,
  m.machine_code,
  m.name,
  m.category,
  m.oem_manufacturer,
  m.model_number,
  m.serial_number,
  m.bay_line_location,
  m.bay_id,
  m.production_line_id,
  m.criticality,
  m.status,
  m.operating_hours,
  m.maintenance_frequency_days,
  m.qr_code_uid,
  m.manual_url,
  m.electrical_diagram_url,
  m.hydraulic_schematic_url,
  m.sop_document_url,
  m.description,
  m.created_at,
  m.updated_at,
  s.shop_name,
  s.shop_code,
  s.plant_id,
  p.plant_name,
  p.plant_code,
  b.bay_name,
  b.bay_code,
  pl.line_name,
  pl.line_code
`;

export interface HistoryCategoryPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface MachineMaintenanceHistoryResult {
  breakdowns: any[];
  workOrders: any[];
  inspections: any[];
  pmPlans: any[];
  partsConsumed: any[];
  purchaseRequisitions: any[];
  rdcChallans: any[];
  auditLogs: any[];
  metrics: {
    totalBreakdowns: number;
    totalWorkOrders: number;
    totalInspections: number;
    totalPmPlans: number;
    totalPartsConsumed: number;
    totalPurchaseRequisitions: number;
    totalRdcChallans: number;
    totalAuditLogs: number;
    totalDowntimeMinutes: number;
    activeRepairMinutes: number;
  };
  categoryPagination: Record<string, HistoryCategoryPagination>;
}

export class MachinesRepository {
  /**
   * Find machine by ID with plant, shop, bay, and line metadata.
   */
  async findById(queryFn: DbQueryFunction, id: string): Promise<MachineRow | null> {
    const sql = `
      SELECT ${MACHINE_SELECT_FIELDS}
      FROM machines m
      JOIN shops s ON m.shop_id = s.id
      JOIN plants p ON s.plant_id = p.id
      LEFT JOIN bays b ON m.bay_id = b.id
      LEFT JOIN production_lines pl ON m.production_line_id = pl.id
      WHERE m.id = $1
    `;
    const res = await queryFn(sql, [id]);
    return res.rows[0] || null;
  }

  /**
   * Acquire an exclusive row-level lock on the machine record for transaction safety.
   */
  async lockMachineForUpdate(queryFn: DbQueryFunction, id: string): Promise<MachineRow | null> {
    const sql = `
      SELECT ${MACHINE_SELECT_FIELDS}
      FROM machines m
      JOIN shops s ON m.shop_id = s.id
      JOIN plants p ON s.plant_id = p.id
      LEFT JOIN bays b ON m.bay_id = b.id
      LEFT JOIN production_lines pl ON m.production_line_id = pl.id
      WHERE m.id = $1
      FOR UPDATE OF m
    `;
    const res = await queryFn(sql, [id]);
    return res.rows[0] || null;
  }

  /**
   * Find machine by exact QR UID.
   */
  async findByQrUid(queryFn: DbQueryFunction, qrUid: string): Promise<MachineRow | null> {
    const sql = `
      SELECT ${MACHINE_SELECT_FIELDS}
      FROM machines m
      JOIN shops s ON m.shop_id = s.id
      JOIN plants p ON s.plant_id = p.id
      LEFT JOIN bays b ON m.bay_id = b.id
      LEFT JOIN production_lines pl ON m.production_line_id = pl.id
      WHERE m.qr_code_uid = $1
    `;
    const res = await queryFn(sql, [qrUid]);
    return res.rows[0] || null;
  }

  /**
   * Find machine by exact QR UID or machine code (backward compatibility for legacy barcode scans).
   * Prioritizes exact QR code UID match, falls back to machine code.
   */
  async findByQrOrCode(queryFn: DbQueryFunction, identifier: string): Promise<MachineRow | null> {
    const sql = `
      SELECT ${MACHINE_SELECT_FIELDS}
      FROM machines m
      JOIN shops s ON m.shop_id = s.id
      JOIN plants p ON s.plant_id = p.id
      LEFT JOIN bays b ON m.bay_id = b.id
      LEFT JOIN production_lines pl ON m.production_line_id = pl.id
      WHERE m.qr_code_uid = $1 OR LOWER(m.machine_code) = LOWER($1)
      ORDER BY (CASE WHEN m.qr_code_uid = $1 THEN 0 ELSE 1 END) ASC
      LIMIT 1
    `;
    const res = await queryFn(sql, [identifier]);
    return res.rows[0] || null;
  }

  /**
   * Find machine by machine code (case-insensitive).
   */
  async findByCode(queryFn: DbQueryFunction, code: string): Promise<MachineRow | null> {
    const sql = `
      SELECT ${MACHINE_SELECT_FIELDS}
      FROM machines m
      JOIN shops s ON m.shop_id = s.id
      JOIN plants p ON s.plant_id = p.id
      LEFT JOIN bays b ON m.bay_id = b.id
      LEFT JOIN production_lines pl ON m.production_line_id = pl.id
      WHERE LOWER(m.machine_code) = LOWER($1)
    `;
    const res = await queryFn(sql, [code]);
    return res.rows[0] || null;
  }

  /**
   * Find machine by serial number (case-insensitive), optionally excluding a specific machine ID.
   */
  async findBySerialNumber(
    queryFn: DbQueryFunction,
    serialNumber: string,
    excludeId?: string
  ): Promise<MachineRow | null> {
    let sql = `
      SELECT id, machine_code, serial_number, shop_id
      FROM machines
      WHERE LOWER(serial_number) = LOWER($1)
    `;
    const params: any[] = [serialNumber];
    if (excludeId) {
      params.push(excludeId);
      sql += ` AND id != $2`;
    }
    const res = await queryFn(sql, params);
    return res.rows[0] || null;
  }

  /**
   * Verify shop existence and retrieve its plant relationship.
   */
  async verifyShop(
    queryFn: DbQueryFunction,
    shopId: string
  ): Promise<{ id: string; shop_name: string; shop_code: string; plant_id: string; plant_name: string } | null> {
    const sql = `
      SELECT s.id, s.shop_name, s.shop_code, s.plant_id, p.plant_name
      FROM shops s
      JOIN plants p ON s.plant_id = p.id
      WHERE s.id = $1
    `;
    const res = await queryFn(sql, [shopId]);
    return res.rows[0] || null;
  }

  /**
   * Verify bay belongs to shop if specified.
   */
  async verifyBay(
    queryFn: DbQueryFunction,
    bayId: string,
    shopId: string
  ): Promise<{ id: string; bay_name: string; shop_id: string } | null> {
    const sql = `SELECT id, bay_name, shop_id FROM bays WHERE id = $1 AND shop_id = $2`;
    const res = await queryFn(sql, [bayId, shopId]);
    return res.rows[0] || null;
  }

  /**
   * Verify production line belongs to shop if specified.
   */
  async verifyProductionLine(
    queryFn: DbQueryFunction,
    lineId: string,
    shopId: string
  ): Promise<{ id: string; line_name: string; shop_id: string } | null> {
    const sql = `SELECT id, line_name, shop_id FROM production_lines WHERE id = $1 AND shop_id = $2`;
    const res = await queryFn(sql, [lineId, shopId]);
    return res.rows[0] || null;
  }

  /**
   * List machines with parameterized filters, pagination, and sorting.
   * Returns exact filtered total count and rows.
   */
  async listMachines(
    queryFn: DbQueryFunction,
    filter: ListMachinesRepoFilter
  ): Promise<{ rows: MachineRow[]; total: number }> {
    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    if (filter.plant_id) {
      params.push(filter.plant_id);
      conditions.push(`s.plant_id = $${params.length}`);
    }

    if (filter.shop_id) {
      params.push(filter.shop_id);
      conditions.push(`m.shop_id = $${params.length}`);
    }

    if (filter.category) {
      params.push(filter.category);
      conditions.push(`LOWER(m.category) = LOWER($${params.length})`);
    }

    if (filter.criticality) {
      params.push(filter.criticality);
      conditions.push(`m.criticality = $${params.length}`);
    }

    if (filter.status) {
      params.push(filter.status);
      conditions.push(`m.status = $${params.length}`);
    } else if (filter.exclude_decommissioned) {
      conditions.push(`m.status != 'decommissioned'`);
    }

    if (filter.search) {
      params.push(`%${filter.search}%`);
      const pIdx = params.length;
      conditions.push(
        `(m.machine_code ILIKE $${pIdx} OR m.name ILIKE $${pIdx} OR m.serial_number ILIKE $${pIdx} OR m.model_number ILIKE $${pIdx})`
      );
    }

    const whereClause = conditions.join(' AND ');

    // 1. Filtered total count query
    const countSql = `
      SELECT COUNT(*) AS total
      FROM machines m
      JOIN shops s ON m.shop_id = s.id
      JOIN plants p ON s.plant_id = p.id
      WHERE ${whereClause}
    `;
    const countRes = await queryFn(countSql, params);
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    // 2. Data rows query with validated order and pagination
    const sortField =
      filter.sortBy && ALLOWED_SORT_COLUMNS[filter.sortBy]
        ? ALLOWED_SORT_COLUMNS[filter.sortBy]
        : 'm.machine_code';
    const sortDir = filter.sortOrder === 'DESC' ? 'DESC' : 'ASC';

    const offset = (filter.page - 1) * filter.limit;
    params.push(filter.limit, offset);
    const limitIdx = params.length - 1;
    const offsetIdx = params.length;

    const dataSql = `
      SELECT ${MACHINE_SELECT_FIELDS}
      FROM machines m
      JOIN shops s ON m.shop_id = s.id
      JOIN plants p ON s.plant_id = p.id
      LEFT JOIN bays b ON m.bay_id = b.id
      LEFT JOIN production_lines pl ON m.production_line_id = pl.id
      WHERE ${whereClause}
      ORDER BY ${sortField} ${sortDir}, m.id ASC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const dataRes = await queryFn(dataSql, params);
    return { rows: dataRes.rows, total };
  }

  /**
   * Insert new machine record.
   */
  async insertMachine(queryFn: DbQueryFunction, input: CreateMachineRepoInput): Promise<MachineRow> {
    const sql = `
      INSERT INTO machines (
        shop_id,
        machine_code,
        name,
        category,
        oem_manufacturer,
        model_number,
        serial_number,
        bay_line_location,
        bay_id,
        production_line_id,
        criticality,
        status,
        operating_hours,
        maintenance_frequency_days,
        qr_code_uid,
        manual_url,
        electrical_diagram_url,
        hydraulic_schematic_url,
        sop_document_url,
        description,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        NOW(), NOW()
      )
      RETURNING *
    `;

    const params = [
      input.shop_id,
      input.machine_code,
      input.name,
      input.category,
      input.oem_manufacturer,
      input.model_number ?? null,
      input.serial_number ?? null,
      input.bay_line_location ?? null,
      input.bay_id ?? null,
      input.production_line_id ?? null,
      input.criticality || 'class_b',
      input.status || 'running',
      input.operating_hours ?? 0,
      input.maintenance_frequency_days ?? 30,
      input.qr_code_uid,
      input.manual_url ?? null,
      input.electrical_diagram_url ?? null,
      input.hydraulic_schematic_url ?? null,
      input.sop_document_url ?? null,
      input.description ?? null,
    ];

    const res = await queryFn(sql, params);
    return res.rows[0];
  }

  /**
   * Update existing machine with dynamic parameterized assignment.
   * Explicitly supports setting nullable fields to null when passed as null.
   * Enforces monotonic operating hours check atomically when operating_hours is included.
   */
  async updateMachine(
    queryFn: DbQueryFunction,
    id: string,
    updates: UpdateMachineRepoInput
  ): Promise<MachineRow | null> {
    const setClauses: string[] = [];
    const params: any[] = [];
    let operatingHoursParamIdx: number | null = null;

    const assignableFields: (keyof UpdateMachineRepoInput)[] = [
      'name',
      'category',
      'oem_manufacturer',
      'model_number',
      'serial_number',
      'bay_line_location',
      'bay_id',
      'production_line_id',
      'shop_id',
      'criticality',
      'status',
      'operating_hours',
      'maintenance_frequency_days',
      'manual_url',
      'electrical_diagram_url',
      'hydraulic_schematic_url',
      'sop_document_url',
      'description',
    ];

    for (const field of assignableFields) {
      if (Object.prototype.hasOwnProperty.call(updates, field)) {
        const val = updates[field];
        params.push(val === undefined ? null : val);
        const idx = params.length;
        if (field === 'operating_hours' && val !== null && val !== undefined) {
          operatingHoursParamIdx = idx;
        }
        setClauses.push(`${field} = $${idx}`);
      }
    }

    if (setClauses.length === 0) {
      return this.findById(queryFn, id);
    }

    setClauses.push('updated_at = NOW()');
    params.push(id);
    const idIdx = params.length;

    let whereClause = `WHERE id = $${idIdx}`;
    if (operatingHoursParamIdx !== null) {
      whereClause += ` AND (operating_hours IS NULL OR operating_hours <= $${operatingHoursParamIdx})`;
    }

    const sql = `
      UPDATE machines
      SET ${setClauses.join(', ')}
      ${whereClause}
      RETURNING *
    `;

    const res = await queryFn(sql, params);
    return res.rows[0] || null;
  }

  /**
   * Safely update operating hours only if new value is >= current operating hours.
   * Enforces atomic monotonic cumulative lifetime meter progression.
   */
  async updateOperatingHours(
    queryFn: DbQueryFunction,
    id: string,
    newHours: number
  ): Promise<MachineRow | null> {
    const sql = `
      UPDATE machines
      SET operating_hours = $1, updated_at = NOW()
      WHERE id = $2 AND (operating_hours IS NULL OR operating_hours <= $1)
      RETURNING *
    `;
    const res = await queryFn(sql, [newHours, id]);
    return res.rows[0] || null;
  }

  /**
   * Check active open complaints and in-progress work orders on a machine.
   */
  async checkActiveWorkflows(
    queryFn: DbQueryFunction,
    machineId: string
  ): Promise<{ activeBreakdownCount: number; activeWorkOrderCount: number }> {
    const complaintSql = `
      SELECT COUNT(*) AS count
      FROM maintenance_requests
      WHERE machine_id = $1 AND status NOT IN ('rejected', 'closed')
    `;
    const woSql = `
      SELECT COUNT(*) AS count
      FROM work_orders
      WHERE machine_id = $1 AND status NOT IN ('completed', 'verified_closed')
    `;

    const [cRes, wRes] = await Promise.all([
      queryFn(complaintSql, [machineId]),
      queryFn(woSql, [machineId]),
    ]);

    return {
      activeBreakdownCount: parseInt(cRes.rows[0]?.count || '0', 10),
      activeWorkOrderCount: parseInt(wRes.rows[0]?.count || '0', 10),
    };
  }

  /**
   * Check total historical references across all modules before decommissioning or deletion.
   */
  async checkHistoricalReferences(
    queryFn: DbQueryFunction,
    machineId: string
  ): Promise<{
    workOrderCount: number;
    breakdownCount: number;
    pmPlanCount: number;
    inspectionCount: number;
    purchaseReqCount: number;
    rdcChallanCount: number;
    totalHistoryCount: number;
  }> {
    const [woRes, mrRes, pmRes, inspRes, prRes, rdcRes] = await Promise.all([
      queryFn(`SELECT COUNT(*) AS count FROM work_orders WHERE machine_id = $1`, [machineId]),
      queryFn(`SELECT COUNT(*) AS count FROM maintenance_requests WHERE machine_id = $1`, [machineId]),
      queryFn(`SELECT COUNT(*) AS count FROM pm_plans WHERE machine_id = $1`, [machineId]),
      queryFn(`SELECT COUNT(*) AS count FROM inspection_records WHERE machine_id = $1`, [machineId]),
      queryFn(`SELECT COUNT(*) AS count FROM purchase_requisitions WHERE machine_id = $1`, [machineId]),
      queryFn(`SELECT COUNT(*) AS count FROM rdc_challans WHERE machine_id = $1`, [machineId]),
    ]);

    const workOrderCount = parseInt(woRes.rows[0]?.count || '0', 10);
    const breakdownCount = parseInt(mrRes.rows[0]?.count || '0', 10);
    const pmPlanCount = parseInt(pmRes.rows[0]?.count || '0', 10);
    const inspectionCount = parseInt(inspRes.rows[0]?.count || '0', 10);
    const purchaseReqCount = parseInt(prRes.rows[0]?.count || '0', 10);
    const rdcChallanCount = parseInt(rdcRes.rows[0]?.count || '0', 10);

    const totalHistoryCount =
      workOrderCount +
      breakdownCount +
      pmPlanCount +
      inspectionCount +
      purchaseReqCount +
      rdcChallanCount;

    return {
      workOrderCount,
      breakdownCount,
      pmPlanCount,
      inspectionCount,
      purchaseReqCount,
      rdcChallanCount,
      totalHistoryCount,
    };
  }

  /**
   * Safely decommission a machine asset.
   */
  async decommissionMachine(queryFn: DbQueryFunction, id: string): Promise<MachineRow | null> {
    const sql = `
      UPDATE machines
      SET status = 'decommissioned', updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const res = await queryFn(sql, [id]);
    return res.rows[0] || null;
  }

  /**
   * Hard-delete a machine record when no historical references exist.
   */
  async deleteMachine(
    queryFn: DbQueryFunction,
    id: string
  ): Promise<{ id: string; machine_code: string } | null> {
    const sql = `DELETE FROM machines WHERE id = $1 RETURNING id, machine_code`;
    const res = await queryFn(sql, [id]);
    return res.rows[0] || null;
  }

  /**
   * Record immutable regulatory audit trail.
   */
  async recordAuditLog(
    queryFn: DbQueryFunction,
    entityId: string,
    action: string,
    performedBy: string | null | undefined,
    oldValues: any,
    newValues: any,
    ipAddress?: string
  ): Promise<void> {
    const sql = `
      INSERT INTO audit_logs (entity_name, entity_id, action, performed_by, old_values, new_values, ip_address, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `;
    await queryFn(sql, [
      'machines',
      entityId,
      action,
      performedBy || null,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      ipAddress || null,
    ]);
  }

  /**
   * Retrieve machine maintenance operational history across all integrated modules:
   * breakdowns, work orders, inspections, PM plans, parts consumed, purchase requisitions,
   * RDC challans, and audit logs.
   * Supports selective type filtering, per-category pagination, and deterministic ordering.
   */
  async getMachineMaintenanceHistory(
    queryFn: DbQueryFunction,
    machineId: string,
    options: { page?: number; limit?: number; type?: string } = {}
  ): Promise<MachineMaintenanceHistoryResult> {
    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
    const offset = (page - 1) * limit;
    const requestedType = options.type ? options.type.trim().toLowerCase() : undefined;
    const shouldFetchAll = !requestedType || requestedType === 'all';

    // 1. Breakdowns Query (LEFT JOIN users for resilience if user is deactivated/deleted)
    const breakdownsSql = `
      SELECT mr.id, mr.complaint_number, mr.reported_by_id, mr.shift, mr.issue_category,
             mr.priority, mr.status, mr.breakdown_occurred_at, mr.reported_at,
             mr.hour_meter_reading, mr.problem_title, mr.description, mr.created_at,
             u.full_name as reported_by_name, u.employee_code as reported_by_code
      FROM maintenance_requests mr
      LEFT JOIN users u ON mr.reported_by_id = u.id
      WHERE mr.machine_id = $1
      ORDER BY mr.breakdown_occurred_at DESC, mr.id ASC
      LIMIT $2 OFFSET $3
    `;

    // 2. Work Orders with Downtime Metrics
    const workOrdersSql = `
      SELECT wo.id, wo.wo_number, wo.complaint_id, wo.status, wo.priority, wo.classification,
             wo.is_major_breakdown, wo.sla_deadline, wo.breakdown_time, wo.reported_time,
             wo.work_started_time, wo.repair_completed_time, wo.machine_restored_time,
             wo.total_downtime_minutes, wo.active_repair_minutes, wo.maintenance_response_minutes,
             wo.labour_hours, wo.diagnosis, wo.root_cause_analysis, wo.corrective_action,
             wo.created_at,
             tech.full_name as assigned_technician_name,
             mgr.full_name as assigned_manager_name
      FROM work_orders wo
      LEFT JOIN users tech ON wo.assigned_technician_id = tech.id
      LEFT JOIN users mgr ON wo.assigned_manager_id = mgr.id
      WHERE wo.machine_id = $1
      ORDER BY wo.created_at DESC, wo.id ASC
      LIMIT $2 OFFSET $3
    `;

    // 3. Inspection Records (LEFT JOIN users)
    const inspectionsSql = `
      SELECT ir.id, ir.shift, ir.overall_status, ir.temperature, ir.pressure, ir.vibration,
             ir.created_at,
             u.full_name as operator_name, u.employee_code as operator_code
      FROM inspection_records ir
      LEFT JOIN users u ON ir.operator_id = u.id
      WHERE ir.machine_id = $1
      ORDER BY ir.created_at DESC, ir.id ASC
      LIMIT $2 OFFSET $3
    `;

    // 4. PM Plans with deterministic ordering and LIMIT/OFFSET
    const pmSql = `
      SELECT p.id, p.plan_code, p.title, p.frequency, p.interval_days,
             p.operating_hour_threshold, p.last_pm_date, p.next_pm_date,
             p.grace_period_days, p.is_active, p.created_at
      FROM pm_plans p
      WHERE p.machine_id = $1
      ORDER BY p.next_pm_date ASC, p.id ASC
      LIMIT $2 OFFSET $3
    `;

    // 5. Spare Parts Consumed against this machine
    const partsSql = `
      SELECT wpc.id, wpc.work_order_id, wo.wo_number, wpc.part_id, sp.part_number, sp.name as part_name,
             wpc.quantity_requested, wpc.quantity_issued, wpc.quantity_installed,
             wpc.serial_number_installed, wpc.serial_number_removed, wpc.removed_part_disposition,
             wpc.created_at
      FROM wo_parts_consumed wpc
      JOIN work_orders wo ON wpc.work_order_id = wo.id
      JOIN spare_parts sp ON wpc.part_id = sp.id
      WHERE wo.machine_id = $1
      ORDER BY wpc.created_at DESC, wpc.id ASC
      LIMIT $2 OFFSET $3
    `;

    // 6. Purchase Requisitions (Machine-linked)
    const prSql = `
      SELECT pr.id, pr.pr_number, pr.work_order_id, wo.wo_number, pr.machine_id,
             pr.part_id, sp.part_number, sp.name as part_name,
             pr.quantity_required, pr.urgency, pr.technical_justification,
             pr.status, pr.po_number, pr.supplier_name, pr.unit_price,
             pr.expected_delivery_date, pr.received_date, pr.created_at,
             u.full_name as requested_by_name, u.employee_code as requested_by_code
      FROM purchase_requisitions pr
      LEFT JOIN work_orders wo ON pr.work_order_id = wo.id
      LEFT JOIN spare_parts sp ON pr.part_id = sp.id
      LEFT JOIN users u ON pr.requested_by = u.id
      WHERE pr.machine_id = $1
      ORDER BY pr.created_at DESC, pr.id ASC
      LIMIT $2 OFFSET $3
    `;

    // 7. RDC Challans (Machine-linked)
    const rdcSql = `
      SELECT rdc.id, rdc.challan_number, rdc.rdc_type, rdc.work_order_id, wo.wo_number,
             rdc.machine_id, rdc.vendor_party_name, rdc.vendor_gstin, rdc.contact_person,
             rdc.purpose, rdc.dispatch_date, rdc.expected_return_date, rdc.actual_return_date,
             rdc.status, rdc.gate_pass_number, rdc.created_at,
             u.full_name as created_by_name, u.employee_code as created_by_code
      FROM rdc_challans rdc
      LEFT JOIN work_orders wo ON rdc.work_order_id = wo.id
      LEFT JOIN users u ON rdc.created_by = u.id
      WHERE rdc.machine_id = $1
      ORDER BY rdc.created_at DESC, rdc.id ASC
      LIMIT $2 OFFSET $3
    `;

    // 8. Audit Logs (Machine-specific audit history)
    const auditSql = `
      SELECT al.id, al.entity_name, al.entity_id, al.action, al.performed_by,
             al.old_values, al.new_values, al.ip_address, al.created_at,
             u.full_name as performed_by_name, u.employee_code as performed_by_code
      FROM audit_logs al
      LEFT JOIN users u ON al.performed_by = u.id
      WHERE al.entity_name = 'machines' AND al.entity_id = $1
      ORDER BY al.created_at DESC, al.id ASC
      LIMIT $2 OFFSET $3
    `;

    // 9. Consolidated Aggregate Metrics
    const metricsSql = `
      SELECT 
        (SELECT COUNT(*) FROM maintenance_requests WHERE machine_id = $1) as total_breakdowns,
        (SELECT COUNT(*) FROM work_orders WHERE machine_id = $1) as total_work_orders,
        (SELECT COUNT(*) FROM inspection_records WHERE machine_id = $1) as total_inspections,
        (SELECT COUNT(*) FROM pm_plans WHERE machine_id = $1) as total_pm_plans,
        (SELECT COALESCE(SUM(total_downtime_minutes), 0) FROM work_orders WHERE machine_id = $1) as total_downtime_minutes,
        (SELECT COALESCE(SUM(active_repair_minutes), 0) FROM work_orders WHERE machine_id = $1) as active_repair_minutes,
        (SELECT COUNT(*) FROM wo_parts_consumed wpc JOIN work_orders wo ON wpc.work_order_id = wo.id WHERE wo.machine_id = $1) as total_parts_consumed,
        (SELECT COUNT(*) FROM purchase_requisitions WHERE machine_id = $1) as total_purchase_requisitions,
        (SELECT COUNT(*) FROM rdc_challans WHERE machine_id = $1) as total_rdc_challans,
        (SELECT COUNT(*) FROM audit_logs WHERE entity_name = 'machines' AND entity_id = $1) as total_audit_logs
    `;

    const mRes = await queryFn(metricsSql, [machineId]);
    const mRow = mRes.rows[0] || {};

    const totalBreakdowns = parseInt(mRow.total_breakdowns || '0', 10);
    const totalWorkOrders = parseInt(mRow.total_work_orders || '0', 10);
    const totalInspections = parseInt(mRow.total_inspections || '0', 10);
    const totalPmPlans = parseInt(mRow.total_pm_plans || '0', 10);
    const totalPartsConsumed = parseInt(mRow.total_parts_consumed || '0', 10);
    const totalPurchaseRequisitions = parseInt(mRow.total_purchase_requisitions || '0', 10);
    const totalRdcChallans = parseInt(mRow.total_rdc_challans || '0', 10);
    const totalAuditLogs = parseInt(mRow.total_audit_logs || '0', 10);

    const calcPagination = (total: number): HistoryCategoryPagination => ({
      total,
      page,
      limit,
      totalPages: total === 0 ? 1 : Math.ceil(total / limit),
    });

    const categoryPagination: Record<string, HistoryCategoryPagination> = {
      breakdowns: calcPagination(totalBreakdowns),
      work_orders: calcPagination(totalWorkOrders),
      workOrders: calcPagination(totalWorkOrders),
      inspections: calcPagination(totalInspections),
      pm_plans: calcPagination(totalPmPlans),
      pmPlans: calcPagination(totalPmPlans),
      parts_consumed: calcPagination(totalPartsConsumed),
      partsConsumed: calcPagination(totalPartsConsumed),
      purchase_requisitions: calcPagination(totalPurchaseRequisitions),
      purchaseRequisitions: calcPagination(totalPurchaseRequisitions),
      rdc_challans: calcPagination(totalRdcChallans),
      rdcChallans: calcPagination(totalRdcChallans),
      audit_logs: calcPagination(totalAuditLogs),
      auditLogs: calcPagination(totalAuditLogs),
    };

    let breakdowns: any[] = [];
    let workOrders: any[] = [];
    let inspections: any[] = [];
    let pmPlans: any[] = [];
    let partsConsumed: any[] = [];
    let purchaseRequisitions: any[] = [];
    let rdcChallans: any[] = [];
    let auditLogs: any[] = [];

    const queryPromises: Promise<any>[] = [];

    if (shouldFetchAll || requestedType === 'breakdowns') {
      queryPromises.push(queryFn(breakdownsSql, [machineId, limit, offset]).then((res) => (breakdowns = res.rows)));
    }
    if (shouldFetchAll || requestedType === 'work_orders') {
      queryPromises.push(queryFn(workOrdersSql, [machineId, limit, offset]).then((res) => (workOrders = res.rows)));
    }
    if (shouldFetchAll || requestedType === 'inspections') {
      queryPromises.push(queryFn(inspectionsSql, [machineId, limit, offset]).then((res) => (inspections = res.rows)));
    }
    if (shouldFetchAll || requestedType === 'pm_plans') {
      queryPromises.push(queryFn(pmSql, [machineId, limit, offset]).then((res) => (pmPlans = res.rows)));
    }
    if (shouldFetchAll || requestedType === 'parts_consumed') {
      queryPromises.push(queryFn(partsSql, [machineId, limit, offset]).then((res) => (partsConsumed = res.rows)));
    }
    if (shouldFetchAll || requestedType === 'purchase_requisitions') {
      queryPromises.push(queryFn(prSql, [machineId, limit, offset]).then((res) => (purchaseRequisitions = res.rows)));
    }
    if (shouldFetchAll || requestedType === 'rdc_challans') {
      queryPromises.push(queryFn(rdcSql, [machineId, limit, offset]).then((res) => (rdcChallans = res.rows)));
    }
    if (shouldFetchAll || requestedType === 'audit_logs') {
      queryPromises.push(queryFn(auditSql, [machineId, limit, offset]).then((res) => (auditLogs = res.rows)));
    }

    await Promise.all(queryPromises);

    return {
      breakdowns,
      workOrders,
      inspections,
      pmPlans,
      partsConsumed,
      purchaseRequisitions,
      rdcChallans,
      auditLogs,
      metrics: {
        totalBreakdowns,
        totalWorkOrders,
        totalInspections,
        totalPmPlans,
        totalPartsConsumed,
        totalPurchaseRequisitions,
        totalRdcChallans,
        totalAuditLogs,
        totalDowntimeMinutes: parseInt(mRow.total_downtime_minutes || '0', 10),
        activeRepairMinutes: parseInt(mRow.active_repair_minutes || '0', 10),
      },
      categoryPagination,
    };
  }
}

export const machinesRepository = new MachinesRepository();
