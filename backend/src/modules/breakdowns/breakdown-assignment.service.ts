import { query as defaultQuery, pool as defaultPool } from '../../config/db';
import { AuthenticatedUser } from '../../middlewares/auth.middleware';
import {
  DbQueryFunction,
  DbClientLike,
  DbPoolLike,
  BreakdownServiceError,
  isUUID,
  getBreakdownsActiveIo,
} from './breakdowns.service';

export interface TechnicianCandidate {
  id: string;
  employee_code: string;
  full_name: string;
  email: string;
  phone?: string | null;
  role: string;
  plant_id: string | null;
  shop_id: string | null;
  is_active: boolean;
  is_available: boolean;
  skills_json: string[] | any;
  max_active_assignments: number;
  active_workload: number;
  has_skill_match: boolean;
  has_shop_match: boolean;
  is_designated: boolean;
  rejection_count?: number;
}

export interface AssignmentRecord {
  id: string;
  breakdown_id: string;
  technician_id: string;
  assigned_by: string | null;
  assignment_method: 'AUTOMATIC' | 'MANUAL';
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'REASSIGNED' | 'CANCELLED';
  attempt_number: number;
  rejection_reason?: string | null;
  reassignment_reason?: string | null;
  notes?: string | null;
  assigned_at: Date | string;
  responded_at?: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  technician_name?: string;
  technician_code?: string;
  technician_email?: string;
}

let activeQuery: DbQueryFunction = defaultQuery;
let activePool: DbPoolLike = defaultPool as unknown as DbPoolLike;
let customIo: any = undefined;

export const setAssignmentDb = (
  customQuery?: DbQueryFunction,
  customPool?: DbPoolLike
): void => {
  activeQuery = customQuery || defaultQuery;
  activePool = customPool || (defaultPool as unknown as DbPoolLike);
};

export const resetAssignmentDb = (): void => {
  activeQuery = defaultQuery;
  activePool = defaultPool as unknown as DbPoolLike;
};

export const setAssignmentIo = (custom: any): void => {
  customIo = custom;
};

export const resetAssignmentIo = (): void => {
  customIo = undefined;
};

const getActiveIo = (override?: any): any => {
  if (override !== undefined) return override;
  if (customIo !== undefined) return customIo;
  return getBreakdownsActiveIo();
};

/**
 * Send in-app notification and emit Socket.IO events safely
 */
export async function sendAssignmentNotification(
  client: DbClientLike,
  recipientId: string,
  title: string,
  message: string,
  type: string = 'info',
  linkUrl: string = '',
  socketEvent: string = 'notification:new',
  socketPayload?: any,
  ioInstance?: any
): Promise<void> {
  await client.query(
    `INSERT INTO notifications (recipient_id, title, message, type, link_url, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [recipientId, title, message, type, linkUrl]
  );

  const io = getActiveIo(ioInstance);
  if (io && typeof io.to === 'function') {
    const notifItem = {
      recipient_id: recipientId,
      title,
      message,
      type,
      link_url: linkUrl,
      action_url: linkUrl,
      is_read: false,
      created_at: new Date(),
    };
    io.to(`user:${recipientId}`).emit('notification:new', notifItem);
    io.to(`user_${recipientId}`).emit('notification:new', notifItem);
    io.to(`user:${recipientId}`).emit('notification', notifItem);

    if (socketEvent && socketPayload) {
      io.to(`user:${recipientId}`).emit(socketEvent, socketPayload);
      io.to(`user_${recipientId}`).emit(socketEvent, socketPayload);
    }
  }
}

/**
 * Record immutable audit log
 */
export async function recordAssignmentAuditLog(
  client: DbClientLike,
  breakdownId: string,
  action: string,
  performedBy: string | null,
  oldValues: any = null,
  newValues: any = null
): Promise<void> {
  await client.query(
    `INSERT INTO audit_logs (entity_name, entity_id, action, performed_by, old_values, new_values, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [
      'maintenance_requests',
      breakdownId,
      action,
      performedBy,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
    ]
  );
}

/**
 * Parse technician skills array from database column
 */
function parseSkills(skillsJson: any): string[] {
  if (Array.isArray(skillsJson)) {
    return skillsJson.map((s) => String(s).toLowerCase().trim());
  }
  if (typeof skillsJson === 'string') {
    try {
      const parsed = JSON.parse(skillsJson);
      if (Array.isArray(parsed)) {
        return parsed.map((s) => String(s).toLowerCase().trim());
      }
    } catch {
      // ignore JSON parse error
    }
  }
  return [];
}

/**
 * Check if skills match category or title keywords
 */
function checkSkillMatch(skills: string[], issueCategory: string, machineCategory?: string): boolean {
  if (!skills.length) return false;
  const category = (issueCategory || '').toLowerCase().trim();
  const mCategory = (machineCategory || '').toLowerCase().trim();

  for (const skill of skills) {
    if (category && (skill.includes(category) || category.includes(skill))) {
      return true;
    }
    if (mCategory && (skill.includes(mCategory) || mCategory.includes(skill))) {
      return true;
    }
  }
  return false;
}

/**
 * Compute active workload for a technician:
 * Count of PENDING/ACCEPTED assignments + count of active work orders.
 */
export async function getTechnicianActiveWorkload(
  client: DbClientLike,
  technicianId: string
): Promise<number> {
  const baRes = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM breakdown_assignments
     WHERE technician_id = $1 AND status IN ('PENDING', 'ACCEPTED')`,
    [technicianId]
  );
  const baCount = Number(baRes.rows[0]?.count || 0);

  const woRes = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM work_orders
     WHERE assigned_technician_id = $1
       AND status NOT IN ('verified_closed', 'completed', 'rework_required')`,
    [technicianId]
  );
  const woCount = Number(woRes.rows[0]?.count || 0);

  return baCount + woCount;
}

/**
 * Find eligible technicians following JCB assignment policy:
 * Priority 1: Existing machine designated technician (if active, available, not at capacity, matching plant/shop, not excluded)
 * Priority 2: Other eligible technicians ranked by shop match, skill match, lowest active workload, and deterministic tie-breaker.
 */
export async function findEligibleTechniciansService(
  client: DbClientLike,
  machineId: string,
  issueCategory: string,
  excludedTechnicianIds: string[] = []
): Promise<{
  selectedTechnician: TechnicianCandidate | null;
  candidates: TechnicianCandidate[];
  strategy: 'DESIGNATED' | 'BALANCED_WORKLOAD' | 'NONE';
}> {
  // 1. Fetch machine details including designated technician and plant/shop hierarchy
  const mRes = await client.query(
    `SELECT m.id, m.machine_code, m.name, m.category, m.shop_id, m.designated_technician_id,
            s.plant_id, s.shop_name, p.plant_name
     FROM machines m
     JOIN shops s ON m.shop_id = s.id
     JOIN plants p ON s.plant_id = p.id
     WHERE m.id = $1`,
    [machineId]
  );

  if (mRes.rows.length === 0) {
    throw new BreakdownServiceError('Machine not found.', 404);
  }

  const machine = mRes.rows[0];

  // ==========================================
  // PRIORITY 1: Existing Machine Designated Technician
  // ==========================================
  if (machine.designated_technician_id && !excludedTechnicianIds.includes(machine.designated_technician_id)) {
    const desRes = await client.query(
      `SELECT u.id, u.employee_code, u.full_name, u.email, u.phone, u.role,
              u.plant_id, u.shop_id, u.is_active,
              COALESCE(u.is_available, TRUE) AS is_available,
              u.skills_json,
              COALESCE(u.max_active_assignments, 5) AS max_active_assignments
       FROM users u
       WHERE u.id = $1`,
      [machine.designated_technician_id]
    );

    if (desRes.rows.length > 0) {
      const desTech = desRes.rows[0];
      const isEligibleRole = desTech.role === 'technician';
      const isActive = Boolean(desTech.is_active);
      const isAvailable = Boolean(desTech.is_available);
      const plantMatch = !desTech.plant_id || desTech.plant_id === machine.plant_id;
      const shopMatch = !desTech.shop_id || desTech.shop_id === machine.shop_id;

      if (isEligibleRole && isActive && isAvailable && plantMatch && shopMatch) {
        const workload = await getTechnicianActiveWorkload(client, desTech.id);
        const maxCapacity = Number(desTech.max_active_assignments || 5);

        if (workload < maxCapacity) {
          const skills = parseSkills(desTech.skills_json);
          const hasSkillMatch = checkSkillMatch(skills, issueCategory, machine.category);
          const candidate: TechnicianCandidate = {
            id: desTech.id,
            employee_code: desTech.employee_code,
            full_name: desTech.full_name,
            email: desTech.email,
            phone: desTech.phone,
            role: desTech.role,
            plant_id: desTech.plant_id,
            shop_id: desTech.shop_id,
            is_active: true,
            is_available: true,
            skills_json: skills,
            max_active_assignments: maxCapacity,
            active_workload: workload,
            has_skill_match: hasSkillMatch,
            has_shop_match: desTech.shop_id === machine.shop_id,
            is_designated: true,
          };

          return {
            selectedTechnician: candidate,
            candidates: [candidate],
            strategy: 'DESIGNATED',
          };
        }
      }
    }
  }

  // ==========================================
  // PRIORITY 2: Other Eligible Technicians from Plant / Shop
  // ==========================================
  const techRes = await client.query(
    `SELECT u.id, u.employee_code, u.full_name, u.email, u.phone, u.role,
            u.plant_id, u.shop_id, u.is_active,
            COALESCE(u.is_available, TRUE) AS is_available,
            u.skills_json,
            COALESCE(u.max_active_assignments, 5) AS max_active_assignments
     FROM users u
     WHERE u.role = 'technician'
       AND u.is_active = TRUE
       AND COALESCE(u.is_available, TRUE) = TRUE
       AND (u.plant_id IS NULL OR u.plant_id = $1)`,
    [machine.plant_id]
  );

  const eligibleCandidates: TechnicianCandidate[] = [];

  for (const row of techRes.rows) {
    // Exclude previously rejected or designated excluded technicians
    if (excludedTechnicianIds.includes(row.id)) {
      continue;
    }

    // Shop boundaries check: if technician has a shop assigned, must match machine's shop
    if (row.shop_id && row.shop_id !== machine.shop_id) {
      continue;
    }

    // Workload capacity check
    const workload = await getTechnicianActiveWorkload(client, row.id);
    const maxCapacity = Number(row.max_active_assignments || 5);
    if (workload >= maxCapacity) {
      continue;
    }

    const skills = parseSkills(row.skills_json);
    const hasSkill = checkSkillMatch(skills, issueCategory, machine.category);
    const hasShop = row.shop_id === machine.shop_id;

    eligibleCandidates.push({
      id: row.id,
      employee_code: row.employee_code,
      full_name: row.full_name,
      email: row.email,
      phone: row.phone,
      role: row.role,
      plant_id: row.plant_id,
      shop_id: row.shop_id,
      is_active: true,
      is_available: true,
      skills_json: skills,
      max_active_assignments: maxCapacity,
      active_workload: workload,
      has_skill_match: hasSkill,
      has_shop_match: hasShop,
      is_designated: false,
    });
  }

  if (eligibleCandidates.length === 0) {
    return {
      selectedTechnician: null,
      candidates: [],
      strategy: 'NONE',
    };
  }

  // Deterministic Ranking:
  // 1. Same Shop match (Shop match before floating)
  // 2. Skill match
  // 3. Lowest active workload
  // 4. Deterministic tie-breaker: employee_code ASC, then id ASC
  eligibleCandidates.sort((a, b) => {
    // 1. Shop match
    if (a.has_shop_match !== b.has_shop_match) {
      return a.has_shop_match ? -1 : 1;
    }
    // 2. Skill match
    if (a.has_skill_match !== b.has_skill_match) {
      return a.has_skill_match ? -1 : 1;
    }
    // 3. Lowest active workload
    if (a.active_workload !== b.active_workload) {
      return a.active_workload - b.active_workload;
    }
    // 4. Deterministic tie-breaker
    const codeCmp = (a.employee_code || '').localeCompare(b.employee_code || '');
    if (codeCmp !== 0) return codeCmp;
    return a.id.localeCompare(b.id);
  });

  return {
    selectedTechnician: eligibleCandidates[0],
    candidates: eligibleCandidates,
    strategy: 'BALANCED_WORKLOAD',
  };
}

/**
 * Automatically assign breakdown to best eligible technician
 */
export async function autoAssignBreakdownService(
  client: DbClientLike,
  breakdownId: string,
  ioInstance?: any,
  preloaded?: { breakdown: any; machine: any }
): Promise<{
  assigned: boolean;
  assignment?: AssignmentRecord;
  technician?: TechnicianCandidate;
  strategy?: string;
  message: string;
}> {
  // Advisory lock to prevent race conditions during assignment
  try {
    await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [
      `assign:${breakdownId}`,
    ]);
  } catch {
    // advisory lock suppression in mock environments
  }

  let breakdown = preloaded?.breakdown;
  let machine = preloaded?.machine;

  if (!breakdown || !machine) {
    // Fetch breakdown with FOR UPDATE lock
    const bRes = await client.query(
      `SELECT r.*, m.id AS machine_id, m.machine_code, m.name AS machine_name, m.category AS machine_category,
              s.plant_id, m.shop_id, s.shop_name, p.plant_name
       FROM maintenance_requests r
       JOIN machines m ON r.machine_id = m.id
       JOIN shops s ON m.shop_id = s.id
       JOIN plants p ON s.plant_id = p.id
       WHERE r.id = $1
       FOR UPDATE OF r`,
      [breakdownId]
    );

    if (bRes.rows.length === 0) {
      throw new BreakdownServiceError('Breakdown request not found.', 404);
    }

    breakdown = bRes.rows[0];
    machine = {
      id: breakdown.machine_id,
      machine_code: breakdown.machine_code,
      name: breakdown.machine_name,
      category: breakdown.machine_category,
      plant_id: breakdown.plant_id,
      shop_id: breakdown.shop_id,
    };
  }

  // Check if breakdown already has an active pending or accepted assignment
  const existingActiveRes = await client.query(
    `SELECT ba.*, u.full_name AS technician_name, u.employee_code AS technician_code, u.email AS technician_email
     FROM breakdown_assignments ba
     JOIN users u ON ba.technician_id = u.id
     WHERE ba.breakdown_id = $1 AND ba.status IN ('PENDING', 'ACCEPTED')
     FOR UPDATE OF ba`,
    [breakdownId]
  );

  if (existingActiveRes.rows.length > 0) {
    const existing = existingActiveRes.rows[0];
    return {
      assigned: true,
      assignment: existing,
      message: `Breakdown is already actively assigned to technician ${existing.technician_name} (${existing.status}).`,
    };
  }

  // Find technicians who previously rejected this breakdown
  let rejectedIds: string[] = [];
  try {
    const rejectedRes = await client.query(
      `SELECT DISTINCT technician_id
       FROM breakdown_assignments
       WHERE breakdown_id = $1 AND status = 'REJECTED'`,
      [breakdownId]
    );
    rejectedIds = (rejectedRes.rows || []).map((r: any) => r.technician_id);
  } catch {
    rejectedIds = [];
  }

  // Identify eligible technician
  const { selectedTechnician, strategy } = await findEligibleTechniciansService(
    client,
    machine.id || breakdown.machine_id,
    breakdown.issue_category,
    rejectedIds
  );

  if (!selectedTechnician) {
    // No eligible technician found -> set unassigned state and notify plant/shop managers
    await client.query(
      `UPDATE maintenance_requests
       SET assigned_technician_id = NULL,
           assignment_status = 'unassigned',
           current_assignment_id = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [breakdownId]
    );

    // Notify managers
    try {
      const mgrsRes = await client.query(
        `SELECT id FROM users
         WHERE role IN ('admin', 'manager')
           AND (plant_id IS NULL OR plant_id = $1)
           AND (shop_id IS NULL OR shop_id = $2)
           AND is_active = TRUE`,
        [machine.plant_id, machine.shop_id]
      );

      const warnMsg = `No eligible technician available for breakdown ${breakdown.complaint_number} (Machine: ${machine.machine_code}). Manual assignment required.`;
      for (const mgr of (mgrsRes.rows || [])) {
        await sendAssignmentNotification(
          client,
          mgr.id,
          'No Eligible Technician Available',
          warnMsg,
          'warning',
          `/triage?breakdownId=${breakdownId}`,
          'assignment:unassigned',
          { breakdown_id: breakdownId, message: warnMsg },
          ioInstance
        );
      }
    } catch {}

    return {
      assigned: false,
      strategy: 'NONE',
      message: 'No eligible technician available. Breakdown moved to manager assignment queue.',
    };
  }

  // Calculate next attempt number
  const attemptRes = await client.query(
    `SELECT COALESCE(MAX(attempt_number), 0) + 1 AS next_attempt
     FROM breakdown_assignments
     WHERE breakdown_id = $1`,
    [breakdownId]
  );
  const nextAttempt = Number(attemptRes.rows[0]?.next_attempt || 1);

  // Insert assignment record (Status: PENDING)
  const assignInsertRes = await client.query(
    `INSERT INTO breakdown_assignments (
       breakdown_id, technician_id, assigned_by, assignment_method, status,
       attempt_number, assigned_at, created_at, updated_at
     )
     VALUES ($1, $2, NULL, 'AUTOMATIC', 'PENDING', $3, NOW(), NOW(), NOW())
     RETURNING *`,
    [breakdownId, selectedTechnician.id, nextAttempt]
  );
  const assignment = assignInsertRes.rows[0];

  // Update maintenance_requests atomically
  await client.query(
    `UPDATE maintenance_requests
     SET assigned_technician_id = $1,
         assignment_status = 'pending',
         current_assignment_id = $2,
         updated_at = NOW()
     WHERE id = $3`,
    [selectedTechnician.id, assignment.id, breakdownId]
  );

  // Immutable audit log
  await recordAssignmentAuditLog(
    client,
    breakdownId,
    'AUTOMATIC_ASSIGNMENT_CREATED',
    null,
    null,
    {
      assignment_id: assignment.id,
      technician_id: selectedTechnician.id,
      technician_name: selectedTechnician.full_name,
      technician_code: selectedTechnician.employee_code,
      attempt_number: nextAttempt,
      strategy,
    }
  );

  // Notify assigned technician
  const notifMsg = `New breakdown ${breakdown.complaint_number} assigned to you. Machine: ${machine.machine_code} (${machine.name || machine.machine_code}). Priority: ${breakdown.priority}. Please accept or reject.`;
  await sendAssignmentNotification(
    client,
    selectedTechnician.id,
    'New Breakdown Assignment',
    notifMsg,
    'assignment',
    `/technician/dashboard?breakdownId=${breakdownId}`,
    'technician:assigned',
    {
      assignment,
      breakdown: {
        id: breakdownId,
        complaint_number: breakdown.complaint_number,
        machine_code: machine.machine_code,
        priority: breakdown.priority,
      },
    },
    ioInstance
  );

  return {
    assigned: true,
    assignment: {
      ...assignment,
      technician_name: selectedTechnician.full_name,
      technician_code: selectedTechnician.employee_code,
      technician_email: selectedTechnician.email,
    },
    technician: selectedTechnician,
    strategy,
    message: `Breakdown automatically assigned to technician ${selectedTechnician.full_name}. Awaiting technician response.`,
  };
}

/**
 * Technician accepts breakdown assignment
 */
export async function acceptBreakdownAssignmentService(
  client: DbClientLike,
  breakdownId: string,
  user: AuthenticatedUser,
  ioInstance?: any
): Promise<any> {
  if (!user || !user.id) {
    throw new BreakdownServiceError('Authentication required.', 401);
  }

  if (user.role !== 'technician' && user.role !== 'admin') {
    throw new BreakdownServiceError('Only authorized technicians can accept assignments.', 403);
  }

  // Row lock on breakdown
  const bRes = await client.query(
    `SELECT r.*, m.machine_code, m.name AS machine_name, s.plant_id, m.shop_id
     FROM maintenance_requests r
     JOIN machines m ON r.machine_id = m.id
     JOIN shops s ON m.shop_id = s.id
     WHERE r.id = $1
     FOR UPDATE OF r`,
    [breakdownId]
  );

  if (bRes.rows.length === 0) {
    throw new BreakdownServiceError('Breakdown request not found.', 404);
  }

  const breakdown = bRes.rows[0];

  // Fetch active pending assignment with FOR UPDATE
  const aRes = await client.query(
    `SELECT *
     FROM breakdown_assignments
     WHERE breakdown_id = $1 AND status = 'PENDING'
     FOR UPDATE`,
    [breakdownId]
  );

  if (aRes.rows.length === 0) {
    // Check if already accepted
    const accRes = await client.query(
      `SELECT * FROM breakdown_assignments WHERE breakdown_id = $1 AND status = 'ACCEPTED'`,
      [breakdownId]
    );
    if (accRes.rows.length > 0) {
      throw new BreakdownServiceError('Assignment is already accepted.', 400);
    }
    throw new BreakdownServiceError('No pending assignment found for this breakdown.', 400);
  }

  const assignment = aRes.rows[0];

  // Verify the authenticated user is the assigned technician
  if (user.role !== 'admin' && assignment.technician_id !== user.id) {
    throw new BreakdownServiceError('You are not authorized to accept this assignment.', 403);
  }

  // Update assignment to ACCEPTED
  const updateRes = await client.query(
    `UPDATE breakdown_assignments
     SET status = 'ACCEPTED',
         responded_at = NOW(),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [assignment.id]
  );
  const updatedAssignment = updateRes.rows[0];

  // Update maintenance_requests
  await client.query(
    `UPDATE maintenance_requests
     SET assignment_status = 'accepted',
         assigned_technician_id = $1,
         updated_at = NOW()
     WHERE id = $2`,
    [assignment.technician_id, breakdownId]
  );

  // Immutable audit log
  await recordAssignmentAuditLog(
    client,
    breakdownId,
    'ASSIGNMENT_ACCEPTED',
    user.id,
    { status: 'PENDING' },
    { status: 'ACCEPTED', technician_id: assignment.technician_id, assignment_id: assignment.id }
  );

  // Notify plant/shop managers
  const mgrsRes = await client.query(
    `SELECT id FROM users
     WHERE role IN ('admin', 'manager')
       AND (plant_id IS NULL OR plant_id = $1)
       AND (shop_id IS NULL OR shop_id = $2)
       AND is_active = TRUE`,
    [breakdown.plant_id, breakdown.shop_id]
  );

  const techName = (user as any).full_name || user.employee_code || 'Technician';
  const acceptMsg = `Technician ${techName} accepted assignment for breakdown ${breakdown.complaint_number} (Machine: ${breakdown.machine_code}).`;

  for (const mgr of mgrsRes.rows) {
    await sendAssignmentNotification(
      client,
      mgr.id,
      'Technician Accepted Assignment',
      acceptMsg,
      'info',
      `/triage?breakdownId=${breakdownId}`,
      'assignment:accepted',
      {
        breakdown_id: breakdownId,
        technician_id: assignment.technician_id,
        assignment_id: assignment.id,
      },
      ioInstance
    );
  }

  return {
    success: true,
    message: 'Assignment accepted successfully. You are now responsible for this breakdown.',
    data: {
      assignment: updatedAssignment,
      breakdown: {
        id: breakdown.id,
        complaint_number: breakdown.complaint_number,
        machine_code: breakdown.machine_code,
        assignment_status: 'accepted',
        assigned_technician_id: assignment.technician_id,
      },
    },
  };
}

/**
 * Technician rejects breakdown assignment with mandatory reason,
 * triggering automatic routing to next eligible technician.
 */
export async function rejectBreakdownAssignmentService(
  client: DbClientLike,
  breakdownId: string,
  input: { reason?: string; rejection_reason?: string; notes?: string },
  user: AuthenticatedUser,
  ioInstance?: any
): Promise<any> {
  if (!user || !user.id) {
    throw new BreakdownServiceError('Authentication required.', 401);
  }

  if (user.role !== 'technician' && user.role !== 'admin') {
    throw new BreakdownServiceError('Only authorized technicians can reject assignments.', 403);
  }

  const reason = (input.reason || input.rejection_reason || input.notes || '').trim();
  if (!reason || reason.length === 0) {
    throw new BreakdownServiceError(
      'A reason explaining why you cannot accept the assignment is mandatory.',
      400
    );
  }

  // Row lock on breakdown
  const bRes = await client.query(
    `SELECT r.*, m.machine_code, m.name AS machine_name, s.plant_id, m.shop_id
     FROM maintenance_requests r
     JOIN machines m ON r.machine_id = m.id
     JOIN shops s ON m.shop_id = s.id
     WHERE r.id = $1
     FOR UPDATE OF r`,
    [breakdownId]
  );

  if (bRes.rows.length === 0) {
    throw new BreakdownServiceError('Breakdown request not found.', 404);
  }

  const breakdown = bRes.rows[0];

  // Fetch active pending assignment with FOR UPDATE
  const aRes = await client.query(
    `SELECT *
     FROM breakdown_assignments
     WHERE breakdown_id = $1 AND status = 'PENDING'
     FOR UPDATE`,
    [breakdownId]
  );

  if (aRes.rows.length === 0) {
    throw new BreakdownServiceError('No pending assignment found for this breakdown.', 400);
  }

  const assignment = aRes.rows[0];

  // Verify the authenticated user is the assigned technician
  if (user.role !== 'admin' && assignment.technician_id !== user.id) {
    throw new BreakdownServiceError('You are not authorized to reject this assignment.', 403);
  }

  // Update current assignment to REJECTED
  const updateRes = await client.query(
    `UPDATE breakdown_assignments
     SET status = 'REJECTED',
         rejection_reason = $1,
         responded_at = NOW(),
         updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [reason, assignment.id]
  );
  const rejectedAssignment = updateRes.rows[0];

  // Immutable audit log for rejection
  await recordAssignmentAuditLog(
    client,
    breakdownId,
    'ASSIGNMENT_REJECTED',
    user.id,
    { status: 'PENDING' },
    {
      status: 'REJECTED',
      technician_id: assignment.technician_id,
      rejection_reason: reason,
      assignment_id: assignment.id,
    }
  );

  // Notify managers about the rejection
  const mgrsRes = await client.query(
    `SELECT id FROM users
     WHERE role IN ('admin', 'manager')
       AND (plant_id IS NULL OR plant_id = $1)
       AND (shop_id IS NULL OR shop_id = $2)
       AND is_active = TRUE`,
    [breakdown.plant_id, breakdown.shop_id]
  );

  const techName = (user as any).full_name || user.employee_code || 'Technician';
  const rejectMsg = `Technician ${techName} rejected breakdown assignment for ${breakdown.complaint_number} (Machine: ${breakdown.machine_code}). Reason: ${reason}`;

  for (const mgr of mgrsRes.rows) {
    await sendAssignmentNotification(
      client,
      mgr.id,
      'Technician Rejected Assignment',
      rejectMsg,
      'warning',
      `/triage?breakdownId=${breakdownId}`,
      'assignment:rejected',
      {
        breakdown_id: breakdownId,
        rejected_technician_id: assignment.technician_id,
        reason,
      },
      ioInstance
    );
  }

  // ==========================================
  // AUTOMATIC REASSIGNMENT TO NEXT ELIGIBLE TECHNICIAN
  // ==========================================
  // Get all previously rejected technician IDs (including the one who just rejected)
  const allRejectedRes = await client.query(
    `SELECT DISTINCT technician_id
     FROM breakdown_assignments
     WHERE breakdown_id = $1 AND status = 'REJECTED'`,
    [breakdownId]
  );
  const allRejectedIds = allRejectedRes.rows.map((r) => r.technician_id);
  if (!allRejectedIds.includes(assignment.technician_id)) {
    allRejectedIds.push(assignment.technician_id);
  }

  // Find next eligible technician excluding all rejected
  const { selectedTechnician, strategy } = await findEligibleTechniciansService(
    client,
    breakdown.machine_id,
    breakdown.issue_category,
    allRejectedIds
  );

  if (selectedTechnician) {
    // Found another technician! Create new assignment attempt
    const attemptRes = await client.query(
      `SELECT COALESCE(MAX(attempt_number), 0) + 1 AS next_attempt
       FROM breakdown_assignments
       WHERE breakdown_id = $1`,
      [breakdownId]
    );
    const nextAttempt = Number(attemptRes.rows[0]?.next_attempt || 2);

    const newAssignRes = await client.query(
      `INSERT INTO breakdown_assignments (
         breakdown_id, technician_id, assigned_by, assignment_method, status,
         attempt_number, assigned_at, created_at, updated_at
       )
       VALUES ($1, $2, NULL, 'AUTOMATIC', 'PENDING', $3, NOW(), NOW(), NOW())
       RETURNING *`,
      [breakdownId, selectedTechnician.id, nextAttempt]
    );
    const newAssignment = newAssignRes.rows[0];

    // Update maintenance_requests
    await client.query(
      `UPDATE maintenance_requests
       SET assigned_technician_id = $1,
           assignment_status = 'pending',
           current_assignment_id = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [selectedTechnician.id, newAssignment.id, breakdownId]
    );

    // Audit log for reassignment
    await recordAssignmentAuditLog(
      client,
      breakdownId,
      'AUTOMATIC_REASSIGNMENT_CREATED',
      null,
      { previous_technician_id: assignment.technician_id },
      {
        new_technician_id: selectedTechnician.id,
        attempt_number: nextAttempt,
        strategy,
      }
    );

    // Notify newly assigned technician
    const nextNotifMsg = `New breakdown ${breakdown.complaint_number} assigned to you. Machine: ${breakdown.machine_code} (${breakdown.machine_name}). Priority: ${breakdown.priority}. Please accept or reject.`;
    await sendAssignmentNotification(
      client,
      selectedTechnician.id,
      'New Breakdown Assignment',
      nextNotifMsg,
      'assignment',
      `/technician/dashboard?breakdownId=${breakdownId}`,
      'technician:assigned',
      {
        assignment: newAssignment,
        breakdown_id: breakdownId,
      },
      ioInstance
    );

    return {
      success: true,
      rejected: true,
      reassigned: true,
      message: `Assignment rejected. Automatically reassigned to technician ${selectedTechnician.full_name}.`,
      data: {
        rejected_assignment: rejectedAssignment,
        new_assignment: {
          ...newAssignment,
          technician_name: selectedTechnician.full_name,
          technician_code: selectedTechnician.employee_code,
        },
      },
    };
  } else {
    // No more eligible technicians -> return breakdown to manager's queue
    await client.query(
      `UPDATE maintenance_requests
       SET assigned_technician_id = NULL,
           assignment_status = 'unassigned',
           current_assignment_id = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [breakdownId]
    );

    await recordAssignmentAuditLog(
      client,
      breakdownId,
      'ASSIGNMENT_EXHAUSTED_ALL_REJECTED',
      null,
      { previous_technician_id: assignment.technician_id },
      { status: 'unassigned', reason: 'All eligible technicians rejected or none available.' }
    );

    // Critical manager notification
    const exhaustMsg = `All eligible technicians rejected breakdown ${breakdown.complaint_number} (Machine: ${breakdown.machine_code}). Please manually assign a technician.`;
    for (const mgr of mgrsRes.rows) {
      await sendAssignmentNotification(
        client,
        mgr.id,
        'Breakdown Assignment Exhausted',
        exhaustMsg,
        'critical',
        `/triage?breakdownId=${breakdownId}`,
        'assignment:exhausted',
        { breakdown_id: breakdownId, message: exhaustMsg },
        ioInstance
      );
    }

    return {
      success: true,
      rejected: true,
      reassigned: false,
      message: 'Assignment rejected. All eligible technicians have been exhausted. Breakdown returned to manager queue.',
      data: {
        rejected_assignment: rejectedAssignment,
        new_assignment: null,
      },
    };
  }
}

/**
 * Manager manually assigns a technician to an unassigned breakdown
 */
export async function managerManualAssignService(
  client: DbClientLike,
  breakdownId: string,
  input: { technician_id: string; notes?: string },
  user: AuthenticatedUser,
  ioInstance?: any
): Promise<any> {
  if (!user || !user.id) {
    throw new BreakdownServiceError('Authentication required.', 401);
  }

  if (!['admin', 'manager'].includes(user.role)) {
    throw new BreakdownServiceError('Only managers and admins can manually assign technicians.', 403);
  }

  const { technician_id, notes } = input || {};
  if (!technician_id || !isUUID(technician_id)) {
    throw new BreakdownServiceError('Valid technician ID is required.', 400);
  }

  // Row lock on breakdown
  const bRes = await client.query(
    `SELECT r.*, m.machine_code, m.name AS machine_name, s.plant_id, m.shop_id
     FROM maintenance_requests r
     JOIN machines m ON r.machine_id = m.id
     JOIN shops s ON m.shop_id = s.id
     WHERE r.id = $1
     FOR UPDATE OF r`,
    [breakdownId]
  );

  if (bRes.rows.length === 0) {
    throw new BreakdownServiceError('Breakdown request not found.', 404);
  }

  const breakdown = bRes.rows[0];

  // Manager facility scope checks
  if (user.role === 'manager') {
    if (user.plant_id && user.plant_id !== breakdown.plant_id) {
      throw new BreakdownServiceError('Forbidden: Unauthorized for breakdowns outside your assigned plant facility.', 403);
    }
    if (user.shop_id && user.shop_id !== breakdown.shop_id) {
      throw new BreakdownServiceError('Forbidden: Unauthorized for breakdowns outside your assigned shop facility.', 403);
    }
  }

  // Check if breakdown already has an active pending or accepted assignment
  const actRes = await client.query(
    `SELECT * FROM breakdown_assignments
     WHERE breakdown_id = $1 AND status IN ('PENDING', 'ACCEPTED')
     FOR UPDATE`,
    [breakdownId]
  );

  if (actRes.rows.length > 0) {
    throw new BreakdownServiceError(
      'Breakdown already has an active technician assignment. Use reassign endpoint to change technicians.',
      400
    );
  }

  // Validate target technician
  const techRes = await client.query(
    `SELECT u.id, u.employee_code, u.full_name, u.email, u.role, u.is_active,
            u.plant_id, u.shop_id, COALESCE(u.is_available, TRUE) AS is_available
     FROM users u
     WHERE u.id = $1`,
    [technician_id]
  );

  if (techRes.rows.length === 0 || !techRes.rows[0].is_active) {
    throw new BreakdownServiceError('Assigned technician not found or inactive.', 400);
  }

  const targetTech = techRes.rows[0];
  if (targetTech.role !== 'technician') {
    throw new BreakdownServiceError('Assigned user must have the technician role.', 400);
  }

  if (targetTech.plant_id && targetTech.plant_id !== breakdown.plant_id) {
    throw new BreakdownServiceError('Assigned technician does not belong to the breakdown machine plant facility.', 400);
  }

  // Next attempt number
  const attemptRes = await client.query(
    `SELECT COALESCE(MAX(attempt_number), 0) + 1 AS next_attempt
     FROM breakdown_assignments
     WHERE breakdown_id = $1`,
    [breakdownId]
  );
  const nextAttempt = Number(attemptRes.rows[0]?.next_attempt || 1);

  // Insert assignment
  const assignRes = await client.query(
    `INSERT INTO breakdown_assignments (
       breakdown_id, technician_id, assigned_by, assignment_method, status,
       attempt_number, notes, assigned_at, created_at, updated_at
     )
     VALUES ($1, $2, $3, 'MANUAL', 'PENDING', $4, $5, NOW(), NOW(), NOW())
     RETURNING *`,
    [breakdownId, technician_id, user.id, nextAttempt, notes ? notes.trim() : null]
  );
  const assignment = assignRes.rows[0];

  // Update breakdown
  await client.query(
    `UPDATE maintenance_requests
     SET assigned_technician_id = $1,
         assignment_status = 'pending',
         current_assignment_id = $2,
         updated_at = NOW()
     WHERE id = $3`,
    [technician_id, assignment.id, breakdownId]
  );

  // Audit log
  await recordAssignmentAuditLog(
    client,
    breakdownId,
    'MANUAL_ASSIGNMENT_CREATED',
    user.id,
    null,
    {
      assignment_id: assignment.id,
      technician_id,
      technician_name: targetTech.full_name,
      attempt_number: nextAttempt,
      notes,
    }
  );

  // Notify newly assigned technician
  const notifMsg = `You have been manually assigned to breakdown ${breakdown.complaint_number} (Machine: ${breakdown.machine_code}) by manager. Please accept or reject.`;
  await sendAssignmentNotification(
    client,
    technician_id,
    'New Breakdown Assignment (Manual)',
    notifMsg,
    'assignment',
    `/technician/dashboard?breakdownId=${breakdownId}`,
    'technician:assigned',
    { assignment, breakdown_id: breakdownId },
    ioInstance
  );

  return {
    success: true,
    message: `Technician ${targetTech.full_name} assigned successfully.`,
    data: {
      assignment: {
        ...assignment,
        technician_name: targetTech.full_name,
        technician_code: targetTech.employee_code,
        technician_email: targetTech.email,
      },
    },
  };
}

/**
 * Manager manually reassigns a breakdown to a different technician with mandatory reason
 */
export async function managerManualReassignService(
  client: DbClientLike,
  breakdownId: string,
  input: { technician_id?: string; new_technician_id?: string; reason?: string; notes?: string },
  user: AuthenticatedUser,
  ioInstance?: any
): Promise<any> {
  if (!user || !user.id) {
    throw new BreakdownServiceError('Authentication required.', 401);
  }

  if (!['admin', 'manager'].includes(user.role)) {
    throw new BreakdownServiceError('Only managers and admins can reassign technicians.', 403);
  }

  const targetTechId = input.new_technician_id || input.technician_id;
  const reason = (input.reason || input.notes || '').trim();

  if (!targetTechId || !isUUID(targetTechId)) {
    throw new BreakdownServiceError('Valid target technician ID is required.', 400);
  }

  if (!reason || reason.length === 0) {
    throw new BreakdownServiceError('A reason explaining the reassignment is mandatory.', 400);
  }

  // Row lock on breakdown
  const bRes = await client.query(
    `SELECT r.*, m.machine_code, m.name AS machine_name, s.plant_id, m.shop_id
     FROM maintenance_requests r
     JOIN machines m ON r.machine_id = m.id
     JOIN shops s ON m.shop_id = s.id
     WHERE r.id = $1
     FOR UPDATE OF r`,
    [breakdownId]
  );

  if (bRes.rows.length === 0) {
    throw new BreakdownServiceError('Breakdown request not found.', 404);
  }

  const breakdown = bRes.rows[0];

  // Manager facility scope checks
  if (user.role === 'manager') {
    if (user.plant_id && user.plant_id !== breakdown.plant_id) {
      throw new BreakdownServiceError('Forbidden: Unauthorized for breakdowns outside your assigned plant facility.', 403);
    }
    if (user.shop_id && user.shop_id !== breakdown.shop_id) {
      throw new BreakdownServiceError('Forbidden: Unauthorized for breakdowns outside your assigned shop facility.', 403);
    }
  }

  // Check if target technician is already currently assigned
  if (breakdown.assigned_technician_id === targetTechId) {
    throw new BreakdownServiceError('Breakdown is already assigned to this technician.', 400);
  }

  // Validate target technician
  const techRes = await client.query(
    `SELECT u.id, u.employee_code, u.full_name, u.email, u.role, u.is_active,
            u.plant_id, u.shop_id, COALESCE(u.is_available, TRUE) AS is_available
     FROM users u
     WHERE u.id = $1`,
    [targetTechId]
  );

  if (techRes.rows.length === 0 || !techRes.rows[0].is_active) {
    throw new BreakdownServiceError('Target technician not found or inactive.', 400);
  }

  const newTech = techRes.rows[0];
  if (newTech.role !== 'technician') {
    throw new BreakdownServiceError('Target user must have the technician role.', 400);
  }

  if (newTech.plant_id && newTech.plant_id !== breakdown.plant_id) {
    throw new BreakdownServiceError('Target technician does not belong to the breakdown machine plant facility.', 400);
  }

  // Find and cancel/reassign current active assignment
  const actRes = await client.query(
    `SELECT ba.*, u.full_name AS previous_technician_name
     FROM breakdown_assignments ba
     JOIN users u ON ba.technician_id = u.id
     WHERE ba.breakdown_id = $1 AND ba.status IN ('PENDING', 'ACCEPTED')
     FOR UPDATE OF ba`,
    [breakdownId]
  );

  const prevAssignment = actRes.rows[0] || null;
  const previousTechId = prevAssignment?.technician_id || breakdown.assigned_technician_id;

  if (prevAssignment) {
    await client.query(
      `UPDATE breakdown_assignments
       SET status = 'REASSIGNED',
           reassignment_reason = $1,
           responded_at = NOW(),
           updated_at = NOW()
       WHERE id = $2`,
      [reason, prevAssignment.id]
    );

    // Notify previous technician
    if (previousTechId) {
      const prevMsg = `Your assignment for breakdown ${breakdown.complaint_number} (Machine: ${breakdown.machine_code}) was reassigned by manager. Reason: ${reason}`;
      await sendAssignmentNotification(
        client,
        previousTechId,
        'Assignment Withdrawn / Reassigned',
        prevMsg,
        'info',
        `/technician/dashboard?breakdownId=${breakdownId}`,
        'assignment:withdrawn',
        { breakdown_id: breakdownId, reason },
        ioInstance
      );
    }
  }

  // Next attempt number
  const attemptRes = await client.query(
    `SELECT COALESCE(MAX(attempt_number), 0) + 1 AS next_attempt
     FROM breakdown_assignments
     WHERE breakdown_id = $1`,
    [breakdownId]
  );
  const nextAttempt = Number(attemptRes.rows[0]?.next_attempt || 1);

  // Insert new assignment
  const newAssignRes = await client.query(
    `INSERT INTO breakdown_assignments (
       breakdown_id, technician_id, assigned_by, assignment_method, status,
       attempt_number, reassignment_reason, assigned_at, created_at, updated_at
     )
     VALUES ($1, $2, $3, 'MANUAL', 'PENDING', $4, $5, NOW(), NOW(), NOW())
     RETURNING *`,
    [breakdownId, targetTechId, user.id, nextAttempt, reason]
  );
  const newAssignment = newAssignRes.rows[0];

  // Update breakdown
  await client.query(
    `UPDATE maintenance_requests
     SET assigned_technician_id = $1,
         assignment_status = 'pending',
         current_assignment_id = $2,
         updated_at = NOW()
     WHERE id = $3`,
    [targetTechId, newAssignment.id, breakdownId]
  );

  // Audit log
  await recordAssignmentAuditLog(
    client,
    breakdownId,
    'MANUAL_REASSIGNMENT_CREATED',
    user.id,
    { previous_technician_id: previousTechId },
    {
      new_technician_id: targetTechId,
      reason,
      attempt_number: nextAttempt,
    }
  );

  // Notify new technician
  const newNotifMsg = `Breakdown ${breakdown.complaint_number} (Machine: ${breakdown.machine_code}) has been reassigned to you by manager. Please accept or reject.`;
  await sendAssignmentNotification(
    client,
    targetTechId,
    'New Breakdown Assignment (Reassigned)',
    newNotifMsg,
    'assignment',
    `/technician/dashboard?breakdownId=${breakdownId}`,
    'technician:assigned',
    { assignment: newAssignment, breakdown_id: breakdownId },
    ioInstance
  );

  return {
    success: true,
    message: `Breakdown reassigned successfully to technician ${newTech.full_name}.`,
    data: {
      assignment: {
        ...newAssignment,
        technician_name: newTech.full_name,
        technician_code: newTech.employee_code,
        technician_email: newTech.email,
      },
    },
  };
}

/**
 * Get current assignment details for a breakdown
 */
export async function getBreakdownAssignmentService(
  client: DbClientLike,
  breakdownId: string,
  user: AuthenticatedUser
): Promise<any> {
  const bRes = await client.query(
    `SELECT r.id, r.complaint_number, r.status, r.assignment_status, r.assigned_technician_id,
            m.machine_code, m.name AS machine_name, s.plant_id, m.shop_id
     FROM maintenance_requests r
     JOIN machines m ON r.machine_id = m.id
     JOIN shops s ON m.shop_id = s.id
     WHERE r.id = $1`,
    [breakdownId]
  );

  if (bRes.rows.length === 0) {
    throw new BreakdownServiceError('Breakdown request not found.', 404);
  }

  const breakdown = bRes.rows[0];

  // Scoping check
  if (user.role === 'manager') {
    if (user.plant_id && user.plant_id !== breakdown.plant_id) {
      throw new BreakdownServiceError('Forbidden: Unauthorized for breakdowns outside your assigned plant facility.', 403);
    }
  }

  const aRes = await client.query(
    `SELECT ba.*,
            u.full_name AS technician_name, u.employee_code AS technician_code,
            u.email AS technician_email, u.phone AS technician_phone,
            u.skills_json AS technician_skills,
            m_user.full_name AS assigned_by_name
     FROM breakdown_assignments ba
     JOIN users u ON ba.technician_id = u.id
     LEFT JOIN users m_user ON ba.assigned_by = m_user.id
     WHERE ba.breakdown_id = $1 AND ba.status IN ('PENDING', 'ACCEPTED')
     ORDER BY ba.created_at DESC
     LIMIT 1`,
    [breakdownId]
  );

  const activeAssignment = aRes.rows[0] || null;

  return {
    breakdown_id: breakdown.id,
    complaint_number: breakdown.complaint_number,
    assignment_status: breakdown.assignment_status || 'unassigned',
    assigned_technician_id: breakdown.assigned_technician_id,
    current_assignment: activeAssignment,
  };
}

/**
 * Get complete assignment attempt history for a breakdown
 */
export async function getBreakdownAssignmentHistoryService(
  client: DbClientLike,
  breakdownId: string,
  user: AuthenticatedUser
): Promise<any> {
  const bRes = await client.query(
    `SELECT r.id, r.complaint_number, s.plant_id, m.shop_id
     FROM maintenance_requests r
     JOIN machines m ON r.machine_id = m.id
     JOIN shops s ON m.shop_id = s.id
     WHERE r.id = $1`,
    [breakdownId]
  );

  if (bRes.rows.length === 0) {
    throw new BreakdownServiceError('Breakdown request not found.', 404);
  }

  const breakdown = bRes.rows[0];

  if (user.role === 'manager' && user.plant_id && user.plant_id !== breakdown.plant_id) {
    throw new BreakdownServiceError('Forbidden: Unauthorized for breakdowns outside your assigned plant facility.', 403);
  }

  const historyRes = await client.query(
    `SELECT ba.*,
            u.full_name AS technician_name, u.employee_code AS technician_code,
            u.email AS technician_email,
            m_user.full_name AS assigned_by_name
     FROM breakdown_assignments ba
     JOIN users u ON ba.technician_id = u.id
     LEFT JOIN users m_user ON ba.assigned_by = m_user.id
     WHERE ba.breakdown_id = $1
     ORDER BY ba.attempt_number ASC, ba.created_at ASC`,
    [breakdownId]
  );

  return historyRes.rows;
}

/**
 * Get eligible technicians for a breakdown
 */
export async function getEligibleTechniciansForBreakdownService(
  client: DbClientLike,
  breakdownId: string,
  user: AuthenticatedUser
): Promise<any> {
  if (!['admin', 'manager'].includes(user.role)) {
    throw new BreakdownServiceError('Only managers and admins can view eligible technicians.', 403);
  }

  const bRes = await client.query(
    `SELECT r.id, r.issue_category, r.machine_id, s.plant_id, m.shop_id
     FROM maintenance_requests r
     JOIN machines m ON r.machine_id = m.id
     JOIN shops s ON m.shop_id = s.id
     WHERE r.id = $1`,
    [breakdownId]
  );

  if (bRes.rows.length === 0) {
    throw new BreakdownServiceError('Breakdown request not found.', 404);
  }

  const breakdown = bRes.rows[0];

  if (user.role === 'manager' && user.plant_id && user.plant_id !== breakdown.plant_id) {
    throw new BreakdownServiceError('Forbidden: Unauthorized for breakdowns outside your assigned plant facility.', 403);
  }

  // Get rejected technicians
  const rejRes = await client.query(
    `SELECT DISTINCT technician_id
     FROM breakdown_assignments
     WHERE breakdown_id = $1 AND status = 'REJECTED'`,
    [breakdownId]
  );
  const rejectedIds = rejRes.rows.map((r) => r.technician_id);

  const result = await findEligibleTechniciansService(
    client,
    breakdown.machine_id,
    breakdown.issue_category,
    []
  );

  const candidatesWithMeta = result.candidates.map((c) => ({
    ...c,
    previously_rejected: rejectedIds.includes(c.id),
  }));

  return {
    strategy: result.strategy,
    recommended_technician_id: result.selectedTechnician?.id || null,
    technicians: candidatesWithMeta,
  };
}
