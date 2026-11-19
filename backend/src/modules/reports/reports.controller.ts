import { Request, Response, NextFunction } from 'express';
import { query } from '../../config/db';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Helper to build date/time range SQL filter based on timeframe or start/end dates
 */
function buildTimeframeCondition(
  timeframe?: string,
  startDate?: string,
  endDate?: string,
  dateColumn = 'created_at',
  paramOffset = 1
): { sql: string; params: any[] } {
  const params: any[] = [];
  const clauses: string[] = [];

  if (startDate && endDate) {
    params.push(startDate, endDate);
    clauses.push(`${dateColumn} >= $${paramOffset} AND ${dateColumn} <= $${paramOffset + 1}`);
  } else if (timeframe) {
    const tf = timeframe.trim().toLowerCase();
    if (tf.includes('today')) {
      clauses.push(`${dateColumn} >= CURRENT_DATE`);
    } else if (tf.includes('7')) {
      clauses.push(`${dateColumn} >= CURRENT_DATE - INTERVAL '7 days'`);
    } else if (tf.includes('14')) {
      clauses.push(`${dateColumn} >= CURRENT_DATE - INTERVAL '14 days'`);
    } else if (tf.includes('30')) {
      clauses.push(`${dateColumn} >= CURRENT_DATE - INTERVAL '30 days'`);
    } else if (tf.includes('month')) {
      clauses.push(`${dateColumn} >= date_trunc('month', CURRENT_DATE)`);
    }
  }

  return {
    sql: clauses.length > 0 ? clauses.join(' AND ') : '1=1',
    params,
  };
}

/**
 * GET /api/v1/reports/dashboard-kpis
 * Comprehensive real operational and governance metrics for Admin & Manager dashboards
 */
export const getDashboardStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { plant_id, shop_id, timeframe, start_date, end_date } = req.query as Record<string, string | undefined>;
    const user = req.user;

    // Build plant and shop filter conditions
    const mWhere: string[] = ['1=1'];
    const mParams: any[] = [];

    // Facility filtering (supports UUID or plant code/name)
    let effectivePlant = plant_id;
    if (!effectivePlant && user && user.role !== 'admin' && user.plant_id) {
      effectivePlant = user.plant_id;
    }

    if (effectivePlant && effectivePlant !== 'All Plants') {
      if (UUID_REGEX.test(effectivePlant)) {
        mParams.push(effectivePlant);
        mWhere.push(`s.plant_id = $${mParams.length}`);
      } else {
        mParams.push(`%${effectivePlant}%`);
        const pIdx = mParams.length;
        mWhere.push(`(pl.plant_name ILIKE $${pIdx} OR pl.plant_code ILIKE $${pIdx})`);
      }
    }

    let effectiveShop = shop_id;
    if (!effectiveShop && user && user.role !== 'admin' && user.role !== 'manager' && user.shop_id) {
      effectiveShop = user.shop_id;
    }

    if (effectiveShop && effectiveShop !== 'All Shops') {
      if (UUID_REGEX.test(effectiveShop)) {
        mParams.push(effectiveShop);
        mWhere.push(`m.shop_id = $${mParams.length}`);
      } else {
        mParams.push(`%${effectiveShop}%`);
        const sIdx = mParams.length;
        mWhere.push(`(s.shop_name ILIKE $${sIdx} OR s.shop_code ILIKE $${sIdx})`);
      }
    }

    const machineFilterSql = mWhere.join(' AND ');

    // 1. Machine status counts from real machines table
    const machineRes = await query(
      `
      SELECT 
        COUNT(*)::int as total_machines,
        COUNT(CASE WHEN m.status::text = 'running' THEN 1 END)::int as running_count,
        COUNT(CASE WHEN m.status::text = 'idle' THEN 1 END)::int as idle_count,
        COUNT(CASE WHEN m.status::text = 'breakdown' THEN 1 END)::int as breakdown_count,
        COUNT(CASE WHEN m.status::text = 'under_maintenance' THEN 1 END)::int as maintenance_count,
        COUNT(CASE WHEN m.status::text = 'awaiting_parts' THEN 1 END)::int as awaiting_parts_count
      FROM machines m
      JOIN shops s ON m.shop_id = s.id
      JOIN plants pl ON s.plant_id = pl.id
      WHERE ${machineFilterSql}
    `,
      mParams
    );
    const mStats = machineRes.rows[0] || {
      total_machines: 0,
      running_count: 0,
      idle_count: 0,
      breakdown_count: 0,
      maintenance_count: 0,
      awaiting_parts_count: 0,
    };

    // 2. Maintenance requests counts from maintenance_requests table
    const tfMR = buildTimeframeCondition(timeframe, start_date, end_date, 'mr.created_at', mParams.length + 1);
    const mrWhere = [...mWhere];
    if (tfMR.sql !== '1=1') {
      mrWhere.push(tfMR.sql);
    }
    const mrParams = [...mParams, ...tfMR.params];

    const mrRes = await query(
      `
      SELECT 
        COUNT(*)::int as total_requests,
        COUNT(CASE WHEN mr.status::text IN ('new', 'acknowledged', 'work_order_created') THEN 1 END)::int as pending_requests,
        COUNT(CASE WHEN mr.status::text NOT IN ('closed', 'rejected') THEN 1 END)::int as open_requests,
        COUNT(CASE WHEN mr.status::text = 'closed' THEN 1 END)::int as resolved_requests
      FROM maintenance_requests mr
      JOIN machines m ON mr.machine_id = m.id
      JOIN shops s ON m.shop_id = s.id
      JOIN plants pl ON s.plant_id = pl.id
      WHERE ${mrWhere.join(' AND ')}
    `,
      mrParams
    );
    const mrStats = mrRes.rows[0] || {
      total_requests: 0,
      pending_requests: 0,
      open_requests: 0,
      resolved_requests: 0,
    };

    // 3. Work orders metrics from work_orders table
    const tfWO = buildTimeframeCondition(timeframe, start_date, end_date, 'wo.created_at', mParams.length + 1);
    const woWhere = [...mWhere];
    if (tfWO.sql !== '1=1') {
      woWhere.push(tfWO.sql);
    }
    const woParams = [...mParams, ...tfWO.params];

    const woRes = await query(
      `
      SELECT 
        COUNT(*)::int as total_work_orders,
        COUNT(CASE WHEN wo.status::text IN ('assigned', 'reopened') THEN 1 END)::int as open_work_orders,
        COUNT(CASE WHEN wo.status::text IN ('accepted', 'in_progress', 'under_diagnosis') THEN 1 END)::int as in_progress_work_orders,
        COUNT(CASE WHEN wo.status::text IN ('submitted_verification', 'completed', 'verified_closed') THEN 1 END)::int as completed_work_orders,
        COUNT(CASE WHEN wo.status::text NOT IN ('verified_closed', 'completed') THEN 1 END)::int as active_work_orders,
        COUNT(CASE WHEN wo.sla_deadline IS NOT NULL AND wo.status::text NOT IN ('verified_closed', 'completed') AND wo.sla_deadline < NOW() THEN 1 END)::int as overdue_work_orders,
        COALESCE(AVG(CASE WHEN wo.active_repair_minutes > 0 THEN wo.active_repair_minutes END), 0)::numeric as avg_mttr_minutes,
        COALESCE(SUM(wo.total_downtime_minutes), 0)::int as total_downtime_minutes
      FROM work_orders wo
      JOIN machines m ON wo.machine_id = m.id
      JOIN shops s ON m.shop_id = s.id
      JOIN plants pl ON s.plant_id = pl.id
      WHERE ${woWhere.join(' AND ')}
    `,
      woParams
    );
    const woStats = woRes.rows[0] || {
      total_work_orders: 0,
      open_work_orders: 0,
      in_progress_work_orders: 0,
      completed_work_orders: 0,
      active_work_orders: 0,
      overdue_work_orders: 0,
      avg_mttr_minutes: 0,
      total_downtime_minutes: 0,
    };

    // 4. User governance counts from users table
    const userRes = await query(`
      SELECT 
        COUNT(*)::int as total_users,
        COUNT(CASE WHEN role::text = 'admin' THEN 1 END)::int as admin_count,
        COUNT(CASE WHEN role::text = 'manager' THEN 1 END)::int as manager_count,
        COUNT(CASE WHEN role::text = 'technician' THEN 1 END)::int as technician_count,
        COUNT(CASE WHEN role::text = 'operator' THEN 1 END)::int as operator_count
      FROM users
    `);
    const uStats = userRes.rows[0] || {
      total_users: 0,
      admin_count: 0,
      manager_count: 0,
      technician_count: 0,
      operator_count: 0,
    };

    // 5. Operating plant hierarchy network
    const plantNetworkRes = await query(`
      SELECT 
        p.id,
        p.plant_code,
        p.plant_name,
        p.city,
        p.state,
        p.status as plant_status,
        COUNT(DISTINCT s.id)::int as shop_count,
        COUNT(DISTINCT m.id)::int as machine_count,
        COUNT(DISTINCT CASE WHEN m.status::text = 'running' THEN m.id END)::int as active_machines
      FROM plants p
      LEFT JOIN shops s ON s.plant_id = p.id
      LEFT JOIN machines m ON m.shop_id = s.id
      GROUP BY p.id, p.plant_code, p.plant_name, p.city, p.state, p.status
      ORDER BY p.plant_name ASC
    `);

    // 6. Total plants and shops count
    const orgCountRes = await query(`
      SELECT 
        (SELECT COUNT(*)::int FROM plants) as total_plants,
        (SELECT COUNT(*)::int FROM shops) as total_shops
    `);
    const totalPlants = orgCountRes.rows[0]?.total_plants ?? 0;
    const totalShops = orgCountRes.rows[0]?.total_shops ?? 0;

    // 7. Audit logs total
    const auditRes = await query(`SELECT COUNT(*)::int as total_audit_logs FROM audit_logs`);
    const totalAuditLogs = auditRes.rows[0]?.total_audit_logs ?? 0;

    // 8. Spare parts catalog inventory metrics
    const partsRes = await query(`
      SELECT 
        COUNT(*)::int as total_parts,
        COUNT(CASE WHEN available_stock <= min_reorder_level THEN 1 END)::int as low_stock_count,
        COALESCE(SUM(reserved_stock), 0)::int as total_reserved_stock
      FROM spare_parts
    `);
    const partsStats = partsRes.rows[0] || { total_parts: 0, low_stock_count: 0, total_reserved_stock: 0 };

    // 9. Top downtime machines (real data)
    const topDowntimeRes = await query(
      `
      SELECT 
        m.machine_code,
        m.name,
        s.shop_name,
        COALESCE(SUM(wo.total_downtime_minutes), 0)::int as downtime_minutes,
        COUNT(wo.id)::int as failure_count
      FROM machines m
      JOIN shops s ON m.shop_id = s.id
      JOIN plants pl ON s.plant_id = pl.id
      LEFT JOIN work_orders wo ON m.id = wo.machine_id
      WHERE ${machineFilterSql}
      GROUP BY m.id, m.machine_code, m.name, s.shop_name
      ORDER BY downtime_minutes DESC
      LIMIT 5
    `,
      mParams
    );

    // Derived calculations
    const totalMachines = mStats.total_machines;
    const runningMachines = mStats.running_count;
    const idleMachines = mStats.idle_count;
    const breakdownMachines = mStats.breakdown_count;
    const maintenanceMachines = mStats.maintenance_count;
    const awaitingPartsMachines = mStats.awaiting_parts_count;

    const operationalAvailable = runningMachines + idleMachines;
    const machineAvailabilityPercent =
      totalMachines > 0 ? parseFloat(((operationalAvailable / totalMachines) * 100).toFixed(1)) : 0;
    const downtimeRatePercent =
      totalMachines > 0 ? parseFloat(((breakdownMachines / totalMachines) * 100).toFixed(1)) : 0;

    const totalDowntimeMinutes = woStats.total_downtime_minutes;
    const totalDowntimeHours = parseFloat((totalDowntimeMinutes / 60.0).toFixed(1));
    const avgMTTRMinutes = Math.round(parseFloat(woStats.avg_mttr_minutes));
    const avgMTTRHours = parseFloat((avgMTTRMinutes / 60.0).toFixed(1));

    res.json({
      success: true,
      data: {
        // Machines
        total_machines: totalMachines,
        totalMachines,
        running_machines: runningMachines,
        runningMachines,
        idle_machines: idleMachines,
        idleMachines,
        breakdown_machines: breakdownMachines,
        breakdownMachines,
        maintenance_machines: maintenanceMachines,
        maintenanceMachines,
        awaiting_parts_machines: awaitingPartsMachines,
        awaitingPartsMachines,
        machine_availability_percent: machineAvailabilityPercent,
        machineAvailabilityPercent,
        downtime_rate_percent: downtimeRatePercent,
        downtimeRatePercent,

        // Maintenance requests
        total_requests: mrStats.total_requests,
        totalRequests: mrStats.total_requests,
        pending_requests: mrStats.pending_requests,
        pendingRequests: mrStats.pending_requests,
        open_requests: mrStats.open_requests,
        openRequests: mrStats.open_requests,
        resolved_requests: mrStats.resolved_requests,
        resolvedRequests: mrStats.resolved_requests,

        // Work orders
        total_work_orders: woStats.total_work_orders,
        totalWorkOrders: woStats.total_work_orders,
        open_work_orders: woStats.open_work_orders,
        openWorkOrders: woStats.open_work_orders,
        in_progress_work_orders: woStats.in_progress_work_orders,
        inProgressWorkOrders: woStats.in_progress_work_orders,
        completed_work_orders: woStats.completed_work_orders,
        completedWorkOrders: woStats.completed_work_orders,
        active_work_orders: woStats.active_work_orders,
        activeWorkOrders: woStats.active_work_orders,
        overdue_work_orders: woStats.overdue_work_orders,
        overdueWorkOrders: woStats.overdue_work_orders,
        avg_mttr_minutes: avgMTTRMinutes,
        avgMTTRMinutes,
        avg_mttr_hours: avgMTTRHours,
        avgMTTRHours,
        total_downtime_minutes: totalDowntimeMinutes,
        totalDowntimeMinutes,
        total_downtime_hours: totalDowntimeHours,
        totalDowntimeHours,

        // Users & Roles
        total_users: uStats.total_users,
        totalUsers: uStats.total_users,
        admin_count: uStats.admin_count,
        adminCount: uStats.admin_count,
        manager_count: uStats.manager_count,
        managerCount: uStats.manager_count,
        technician_count: uStats.technician_count,
        technicianCount: uStats.technician_count,
        operator_count: uStats.operator_count,
        operatorCount: uStats.operator_count,

        // Plant network
        total_plants: totalPlants,
        totalPlants,
        total_shops: totalShops,
        totalShops,
        plant_network: plantNetworkRes.rows,
        plantNetwork: plantNetworkRes.rows,

        // Audit & Spares
        total_audit_logs: totalAuditLogs,
        totalAuditLogs,
        low_stock_items_count: partsStats.low_stock_count,
        lowStockItemsCount: partsStats.low_stock_count,
        total_reserved_parts: partsStats.total_reserved_stock,
        totalReservedParts: partsStats.total_reserved_stock,

        // Top downtime machines
        top_downtime_machines: topDowntimeRes.rows,
        topDowntimeMachines: topDowntimeRes.rows,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/reports/maintenance-trend
 * Returns real 4-week trend of Corrective vs Preventive maintenance from work_orders
 */
export const getMaintenanceTrend = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { plant_id, shop_id } = req.query as Record<string, string | undefined>;
    const user = req.user;

    const where: string[] = ['1=1'];
    const params: any[] = [];

    let effectivePlant = plant_id;
    if (!effectivePlant && user && user.role !== 'admin' && user.plant_id) {
      effectivePlant = user.plant_id;
    }
    if (effectivePlant && effectivePlant !== 'All Plants') {
      if (UUID_REGEX.test(effectivePlant)) {
        params.push(effectivePlant);
        where.push(`s.plant_id = $${params.length}`);
      } else {
        params.push(`%${effectivePlant}%`);
        const pIdx = params.length;
        where.push(`(pl.plant_name ILIKE $${pIdx} OR pl.plant_code ILIKE $${pIdx})`);
      }
    }

    let effectiveShop = shop_id;
    if (!effectiveShop && user && user.role !== 'admin' && user.role !== 'manager' && user.shop_id) {
      effectiveShop = user.shop_id;
    }
    if (effectiveShop && effectiveShop !== 'All Shops') {
      if (UUID_REGEX.test(effectiveShop)) {
        params.push(effectiveShop);
        where.push(`m.shop_id = $${params.length}`);
      } else {
        params.push(`%${effectiveShop}%`);
        const sIdx = params.length;
        where.push(`(s.shop_name ILIKE $${sIdx} OR s.shop_code ILIKE $${sIdx})`);
      }
    }

    // Generate 4 weekly buckets ending this week
    const trendRes = await query(
      `
      WITH weekly_buckets AS (
        SELECT 
          generate_series(
            date_trunc('week', CURRENT_DATE - INTERVAL '3 weeks'),
            date_trunc('week', CURRENT_DATE),
            '1 week'::interval
          ) as bucket_start
      )
      SELECT 
        'Week ' || (ROW_NUMBER() OVER (ORDER BY b.bucket_start ASC)) as label,
        to_char(b.bucket_start, 'Mon DD') as date_label,
        b.bucket_start,
        COUNT(CASE WHEN wo.classification::text != 'regular_maintenance' THEN wo.id END)::int as series1,
        COUNT(CASE WHEN wo.classification::text = 'regular_maintenance' THEN wo.id END)::int as series2
      FROM weekly_buckets b
      LEFT JOIN (
        SELECT wo.id, wo.created_at, wo.classification
        FROM work_orders wo
        JOIN machines m ON wo.machine_id = m.id
        JOIN shops s ON m.shop_id = s.id
        JOIN plants pl ON s.plant_id = pl.id
        WHERE ${where.join(' AND ')}
      ) wo ON date_trunc('week', wo.created_at) = b.bucket_start
      GROUP BY b.bucket_start
      ORDER BY b.bucket_start ASC
    `,
      params
    );

    res.json({
      success: true,
      data: trendRes.rows.map((row) => ({
        label: row.label,
        dateLabel: row.date_label,
        series1: row.series1 ?? 0,
        series2: row.series2 ?? 0,
      })),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/reports/machine-status-trend
 * Historical machine status multi-line trend across operational, under_maintenance, breakdown, and idle.
 * Respects plant filter and RBAC scoping.
 */
export const getMachineStatusTrend = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { plant_id, timeframe = 'Last 30 Days' } = req.query as Record<string, string | undefined>;
    const user = req.user;

    const where: string[] = ['1=1'];
    const params: any[] = [];

    let effectivePlant = plant_id;
    if (!effectivePlant && user && user.role !== 'admin' && user.plant_id) {
      effectivePlant = user.plant_id;
    }
    if (effectivePlant && effectivePlant !== 'All Plants') {
      if (UUID_REGEX.test(effectivePlant)) {
        params.push(effectivePlant);
        where.push(`s.plant_id = $${params.length}`);
      } else {
        params.push(`%${effectivePlant}%`);
        const pIdx = params.length;
        where.push(`(pl.plant_name ILIKE $${pIdx} OR pl.plant_code ILIKE $${pIdx})`);
      }
    }

    // Determine interval and step based on timeframe
    let intervalStr = '30 days';
    let stepStr = '3 days';

    const tf = (timeframe || '').trim().toLowerCase();
    if (tf.includes('7')) {
      intervalStr = '7 days';
      stepStr = '1 day';
    } else if (tf.includes('90')) {
      intervalStr = '90 days';
      stepStr = '7 days';
    } else {
      intervalStr = '30 days';
      stepStr = '3 days';
    }

    const trendRes = await query(
      `
      WITH date_series AS (
        SELECT generate_series(
          CURRENT_DATE - INTERVAL '${intervalStr}',
          CURRENT_DATE,
          '${stepStr}'::interval
        )::date as point_date
      ),
      all_machines AS (
        SELECT 
          m.id,
          m.status as current_status,
          m.created_at,
          m.updated_at,
          s.plant_id
        FROM machines m
        JOIN shops s ON m.shop_id = s.id
        JOIN plants pl ON s.plant_id = pl.id
        WHERE ${where.join(' AND ')}
      ),
      active_incidents AS (
        SELECT 
          mr.machine_id,
          mr.breakdown_occurred_at,
          COALESCE(wo.created_at, mr.created_at) as maintenance_start_time,
          wo.machine_restored_time,
          wo.repair_completed_time,
          mr.status as complaint_status,
          wo.status as wo_status
        FROM maintenance_requests mr
        LEFT JOIN work_orders wo ON wo.complaint_id = mr.id
      )
      SELECT 
        d.point_date,
        to_char(d.point_date, 'Mon DD') as date_label,
        COUNT(CASE WHEN m.created_at::date <= d.point_date THEN m.id END)::int as total_fleet,
        
        -- Breakdown count at this date
        COUNT(CASE 
          WHEN m.created_at::date <= d.point_date
           AND (
             (d.point_date = CURRENT_DATE AND m.current_status::text = 'breakdown')
             OR (
               EXISTS (
                 SELECT 1 FROM active_incidents ai 
                 WHERE ai.machine_id = m.id 
                   AND ai.breakdown_occurred_at::date <= d.point_date
                   AND (ai.maintenance_start_time IS NULL OR ai.maintenance_start_time::date > d.point_date)
                   AND (ai.machine_restored_time IS NULL OR ai.machine_restored_time::date > d.point_date)
               )
             )
           )
          THEN 1 
        END)::int as breakdown,

        -- Under Maintenance count at this date
        COUNT(CASE 
          WHEN m.created_at::date <= d.point_date
           AND (
             (d.point_date = CURRENT_DATE AND m.current_status::text IN ('under_maintenance', 'awaiting_parts'))
             OR (
               EXISTS (
                 SELECT 1 FROM active_incidents ai 
                 WHERE ai.machine_id = m.id 
                   AND ai.maintenance_start_time::date <= d.point_date
                   AND (ai.machine_restored_time IS NULL OR ai.machine_restored_time::date > d.point_date)
               )
             )
           )
          THEN 1 
        END)::int as under_maintenance,

        -- Idle count at this date
        COUNT(CASE 
          WHEN m.created_at::date <= d.point_date
           AND (
             (d.point_date = CURRENT_DATE AND m.current_status::text = 'idle')
             OR (
               m.current_status::text = 'idle'
               AND NOT EXISTS (
                 SELECT 1 FROM active_incidents ai 
                 WHERE ai.machine_id = m.id 
                   AND ai.breakdown_occurred_at::date <= d.point_date
                   AND (ai.machine_restored_time IS NULL OR ai.machine_restored_time::date > d.point_date)
               )
             )
           )
          THEN 1 
        END)::int as idle,

        -- Operational / Running count at this date
        COUNT(CASE 
          WHEN m.created_at::date <= d.point_date
           AND (
             (d.point_date = CURRENT_DATE AND m.current_status::text = 'running')
             OR (
               d.point_date < CURRENT_DATE
               AND m.current_status::text NOT IN ('idle')
               AND NOT EXISTS (
                 SELECT 1 FROM active_incidents ai 
                 WHERE ai.machine_id = m.id 
                   AND ai.breakdown_occurred_at::date <= d.point_date
                   AND (ai.machine_restored_time IS NULL OR ai.machine_restored_time::date > d.point_date)
               )
             )
           )
          THEN 1 
        END)::int as operational

      FROM date_series d
      LEFT JOIN all_machines m ON m.created_at::date <= d.point_date
      GROUP BY d.point_date
      ORDER BY d.point_date ASC;
    `,
      params
    );

    const rows = trendRes.rows || [];
    const latestRow = rows[rows.length - 1] || {};

    res.json({
      success: true,
      data: rows.map((r: any) => ({
        point_date: r.point_date,
        date_label: r.date_label,
        operational: r.operational ?? 0,
        under_maintenance: r.under_maintenance ?? 0,
        breakdown: r.breakdown ?? 0,
        idle: r.idle ?? 0,
        total_fleet: r.total_fleet ?? 0,
      })),
      summary: {
        current_operational: latestRow.operational ?? 0,
        current_under_maintenance: latestRow.under_maintenance ?? 0,
        current_breakdown: latestRow.breakdown ?? 0,
        current_idle: latestRow.idle ?? 0,
        total_machines: latestRow.total_fleet ?? 0,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/reports/governance-trend
 * Returns real 4-week trend of Auth Events vs Audit Logs from audit_logs
 */
export const getGovernanceTrend = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const trendRes = await query(`
      WITH weekly_buckets AS (
        SELECT 
          generate_series(
            date_trunc('week', CURRENT_DATE - INTERVAL '3 weeks'),
            date_trunc('week', CURRENT_DATE),
            '1 week'::interval
          ) as bucket_start
      )
      SELECT 
        'Week ' || (ROW_NUMBER() OVER (ORDER BY b.bucket_start ASC)) as label,
        to_char(b.bucket_start, 'Mon DD') as date_label,
        b.bucket_start,
        COUNT(CASE WHEN a.action::text ILIKE '%LOGIN%' OR a.action::text ILIKE '%USER%' OR a.action::text ILIKE '%AUTH%' THEN a.id END)::int as series1,
        COUNT(CASE WHEN a.id IS NOT NULL AND NOT (a.action::text ILIKE '%LOGIN%' OR a.action::text ILIKE '%USER%' OR a.action::text ILIKE '%AUTH%') THEN a.id END)::int as series2
      FROM weekly_buckets b
      LEFT JOIN audit_logs a ON date_trunc('week', a.created_at) = b.bucket_start
      GROUP BY b.bucket_start
      ORDER BY b.bucket_start ASC
    `);

    res.json({
      success: true,
      data: trendRes.rows.map((row) => ({
        label: row.label,
        dateLabel: row.date_label,
        series1: row.series1 ?? 0,
        series2: row.series2 ?? 0,
      })),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/reports/machine-summary/:id
 * Dedicated machine summary report endpoint consolidating:
 * - Machine master details (identification, specs, registration)
 * - Plant/shop/bay/line location hierarchy
 * - Operational assignment (latest operator & inspecting operator, responsible technician/manager)
 * - Current machine condition (status, criticality, active breakdown/repair)
 * - Maintenance history & PM schedule
 * - Breakdown and work order history with downtime & MTTR
 * - Spare parts consumed & outstanding issues
 */
export const getMachineReportSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query as Record<string, string | undefined>;
    const user = req.user;

    if (!id || !UUID_REGEX.test(id)) {
      res.status(400).json({ success: false, message: 'Invalid machine ID. Must be a valid UUID.' });
      return;
    }

    // 1. Fetch Machine Master with Plant, Shop, Bay, Line
    const machineRes = await query(`
      SELECT 
        m.id, m.shop_id, m.machine_code, m.name, m.category, m.oem_manufacturer,
        m.model_number, m.serial_number, m.bay_line_location, m.bay_id, m.production_line_id,
        m.criticality, m.status, m.operating_hours, m.maintenance_frequency_days,
        m.qr_code_uid, m.manual_url, m.description, m.created_at, m.updated_at,
        m.designated_technician_id,
        s.shop_name, s.shop_code, s.plant_id,
        p.plant_name, p.plant_code,
        b.bay_name, b.bay_code,
        pl.line_name, pl.line_code,
        dtech.full_name as designated_technician_name, dtech.employee_code as designated_technician_code
      FROM machines m
      JOIN shops s ON m.shop_id = s.id
      JOIN plants p ON s.plant_id = p.id
      LEFT JOIN bays b ON m.bay_id = b.id
      LEFT JOIN production_lines pl ON m.production_line_id = pl.id
      LEFT JOIN users dtech ON m.designated_technician_id = dtech.id
      WHERE m.id = $1
    `, [id]);

    if (machineRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Machine asset not found.' });
      return;
    }

    const machine = machineRes.rows[0];

    // Facility Scope Enforcement for non-admins
    if (user && user.role !== 'admin') {
      if (user.plant_id && user.plant_id !== machine.plant_id) {
        res.status(403).json({ success: false, message: 'Access denied: Machine belongs to another plant facility.' });
        return;
      }
      if (user.shop_id && user.role !== 'manager' && user.shop_id !== machine.shop_id) {
        res.status(403).json({ success: false, message: 'Access denied: Machine belongs to another shop floor.' });
        return;
      }
    }

    // 2. Fetch Latest Inspecting / Operating Personnel Assignment
    const operatorRes = await query(`
      SELECT 
        u.id, u.full_name, u.employee_code, u.email, u.shift,
        ir.created_at as last_inspection_date, ir.overall_status as last_inspection_status,
        ir.shift as inspection_shift
      FROM inspection_records ir
      JOIN users u ON ir.operator_id = u.id
      WHERE ir.machine_id = $1
      ORDER BY ir.created_at DESC
      LIMIT 1
    `, [id]);
    const operator = operatorRes.rows[0] || null;

    // 3. Fetch Assigned / Responsible Technician & Manager
    const personnelRes = await query(`
      SELECT 
        tech.id as technician_id, tech.full_name as technician_name, tech.employee_code as technician_code,
        mgr.id as manager_id, mgr.full_name as manager_name, mgr.employee_code as manager_code
      FROM work_orders wo
      LEFT JOIN users tech ON wo.assigned_technician_id = tech.id
      LEFT JOIN users mgr ON wo.assigned_manager_id = mgr.id
      WHERE wo.machine_id = $1 AND (wo.assigned_technician_id IS NOT NULL OR wo.assigned_manager_id IS NOT NULL)
      ORDER BY wo.created_at DESC
      LIMIT 1
    `, [id]);
    let personnel = personnelRes.rows[0] || null;
    if (!personnel && machine.designated_technician_id && machine.designated_technician_name) {
      personnel = {
        technician_id: machine.designated_technician_id,
        technician_name: machine.designated_technician_name,
        technician_code: machine.designated_technician_code,
        manager_id: null,
        manager_name: null,
        manager_code: null,
      };
    }

    // 4. Active Issues / Outstanding Stoppage
    // complaint_status enum values: 'new', 'pending_review', 'approved', 'rejected', 'work_order_created', 'closed'
    // Active breakdowns are those not yet closed or rejected. Cast status::text to prevent invalid enum casting errors.
    const activeBreakdownRes = await query(`
      SELECT id, complaint_number, problem_title, issue_category, priority, status, breakdown_occurred_at
      FROM maintenance_requests
      WHERE machine_id = $1 AND status::text NOT IN ('closed', 'rejected')
      ORDER BY breakdown_occurred_at DESC
      LIMIT 1
    `, [id]);

    // work_order_status enum values: 'assigned', 'accepted', 'scheduled', 'under_diagnosis', 'in_progress',
    // 'waiting_for_parts', 'waiting_for_approval', 'on_hold', 'submitted_verification', 'rework_required',
    // 'completed', 'verified_closed', 'reopened'
    // Note: work_orders table does not store problem_title directly; it is joined from maintenance_requests via complaint_id.
    const activeWorkOrderRes = await query(`
      SELECT 
        wo.id, wo.wo_number,
        COALESCE(r.problem_title, wo.work_instructions, wo.diagnosis, 'Maintenance Inspection') as problem_title,
        wo.status, wo.priority, wo.work_started_time
      FROM work_orders wo
      LEFT JOIN maintenance_requests r ON wo.complaint_id = r.id
      WHERE wo.machine_id = $1 AND wo.status::text NOT IN ('verified_closed', 'completed')
      ORDER BY wo.created_at DESC
      LIMIT 1
    `, [id]);

    // Friendly display status mapping helpers for presentation layer
    const formatComplaintStatus = (status: string | null | undefined): string => {
      if (!status) return 'Unknown';
      switch (status.toLowerCase()) {
        case 'closed':
          return 'Resolved';
        case 'work_order_created':
          return 'Work Order Created';
        case 'pending_review':
          return 'Pending Review';
        case 'approved':
          return 'Approved';
        case 'rejected':
          return 'Rejected';
        case 'new':
          return 'New';
        default:
          return status.replace(/_/g, ' ');
      }
    };

    const formatWorkOrderStatus = (status: string | null | undefined): string => {
      if (!status) return 'Unknown';
      switch (status.toLowerCase()) {
        case 'verified_closed':
          return 'Verified Closed';
        case 'submitted_verification':
          return 'Submitted for Verification';
        case 'waiting_for_parts':
          return 'Waiting for Parts';
        case 'waiting_for_approval':
          return 'Waiting for Approval';
        case 'under_diagnosis':
          return 'Under Diagnosis';
        case 'in_progress':
          return 'In Progress';
        case 'rework_required':
          return 'Rework Required';
        case 'completed':
          return 'Completed';
        default:
          return status.replace(/_/g, ' ');
      }
    };

    const activeBreakdown = activeBreakdownRes.rows[0]
      ? {
          ...activeBreakdownRes.rows[0],
          display_status: formatComplaintStatus(activeBreakdownRes.rows[0].status),
        }
      : null;

    const activeWorkOrder = activeWorkOrderRes.rows[0]
      ? {
          ...activeWorkOrderRes.rows[0],
          display_status: formatWorkOrderStatus(activeWorkOrderRes.rows[0].status),
        }
      : null;

    // 5. Preventive Maintenance Plans
    const pmRes = await query(`
      SELECT id, plan_code, title, frequency, interval_days, operating_hour_threshold,
             last_pm_date, next_pm_date, is_active, created_at
      FROM pm_plans
      WHERE machine_id = $1
      ORDER BY next_pm_date ASC NULLS LAST, id ASC
      LIMIT 10
    `, [id]);
    const pmPlans = pmRes.rows;

    // 6. Work Orders History (with date filter if supplied)
    const woParams: any[] = [id];
    let woWhere = 'wo.machine_id = $1';
    if (startDate) {
      woParams.push(startDate);
      woWhere += ` AND wo.created_at >= $${woParams.length}`;
    }
    if (endDate) {
      woParams.push(endDate);
      woWhere += ` AND wo.created_at <= $${woParams.length}`;
    }
    const woHistoryRes = await query(`
      SELECT 
        wo.id, wo.wo_number, wo.status, wo.priority, wo.classification,
        COALESCE(r.problem_title, wo.work_instructions, wo.diagnosis, 'Maintenance Inspection') as problem_title,
        wo.diagnosis, wo.root_cause_analysis, wo.corrective_action,
        wo.total_downtime_minutes, wo.active_repair_minutes, wo.created_at,
        wo.repair_completed_time,
        tech.full_name as assigned_technician_name, tech.employee_code as assigned_technician_code
      FROM work_orders wo
      LEFT JOIN maintenance_requests r ON wo.complaint_id = r.id
      LEFT JOIN users tech ON wo.assigned_technician_id = tech.id
      WHERE ${woWhere}
      ORDER BY wo.created_at DESC
      LIMIT 20
    `, woParams);
    const workOrders = woHistoryRes.rows.map((wo: any) => ({
      ...wo,
      display_status: formatWorkOrderStatus(wo.status),
    }));

    // 7. Breakdown History (with date filter if supplied)
    const bdParams: any[] = [id];
    let bdWhere = 'mr.machine_id = $1';
    if (startDate) {
      bdParams.push(startDate);
      bdWhere += ` AND mr.breakdown_occurred_at >= $${bdParams.length}`;
    }
    if (endDate) {
      bdParams.push(endDate);
      bdWhere += ` AND mr.breakdown_occurred_at <= $${bdParams.length}`;
    }
    const bdHistoryRes = await query(`
      SELECT 
        mr.id, mr.complaint_number, mr.problem_title, mr.issue_category, mr.priority,
        mr.status, mr.breakdown_occurred_at, mr.created_at,
        u.full_name as reported_by_name, u.employee_code as reported_by_code
      FROM maintenance_requests mr
      LEFT JOIN users u ON mr.reported_by_id = u.id
      WHERE ${bdWhere}
      ORDER BY mr.breakdown_occurred_at DESC
      LIMIT 20
    `, bdParams);
    const breakdowns = bdHistoryRes.rows.map((bd: any) => ({
      ...bd,
      display_status: formatComplaintStatus(bd.status),
    }));

    // 8. Spare Parts Consumed
    const partsRes = await query(`
      SELECT 
        wpc.id, wo.wo_number, sp.part_number, sp.name as part_name,
        wpc.quantity_requested, wpc.quantity_issued, wpc.quantity_installed,
        wpc.serial_number_installed, wpc.created_at
      FROM wo_parts_consumed wpc
      JOIN work_orders wo ON wpc.work_order_id = wo.id
      JOIN spare_parts sp ON wpc.part_id = sp.id
      WHERE wo.machine_id = $1
      ORDER BY wpc.created_at DESC
      LIMIT 20
    `, [id]);
    const partsConsumed = partsRes.rows;

    // 9. Aggregates and Performance Metrics
    const aggRes = await query(`
      SELECT 
        (SELECT COUNT(*)::int FROM maintenance_requests WHERE machine_id = $1) as total_breakdowns,
        (SELECT COUNT(*)::int FROM work_orders WHERE machine_id = $1) as total_work_orders,
        (SELECT COUNT(*)::int FROM work_orders WHERE machine_id = $1 AND status::text IN ('verified_closed', 'completed')) as completed_work_orders,
        (SELECT COUNT(*)::int FROM work_orders WHERE machine_id = $1 AND status::text NOT IN ('verified_closed', 'completed')) as active_work_orders,
        (SELECT COUNT(*)::int FROM inspection_records WHERE machine_id = $1) as total_inspections,
        (SELECT COUNT(*)::int FROM pm_plans WHERE machine_id = $1) as total_pm_plans,
        (SELECT COALESCE(SUM(total_downtime_minutes), 0)::int FROM work_orders WHERE machine_id = $1) as total_downtime_minutes,
        (SELECT COALESCE(SUM(active_repair_minutes), 0)::int FROM work_orders WHERE machine_id = $1) as active_repair_minutes,
        (SELECT COUNT(*)::int FROM wo_parts_consumed wpc JOIN work_orders wo ON wpc.work_order_id = wo.id WHERE wo.machine_id = $1) as total_parts_consumed
    `, [id]);
    const agg = aggRes.rows[0] || {};

    const totalDowntimeMinutes = agg.total_downtime_minutes || 0;
    const totalDowntimeHours = parseFloat((totalDowntimeMinutes / 60.0).toFixed(1));
    const completedWOs = agg.completed_work_orders || 0;
    const avgMTTRMinutes = completedWOs > 0 ? Math.round(totalDowntimeMinutes / completedWOs) : 0;
    const operatingHours = Number(machine.operating_hours || 0);

    // Calculate Availability %
    let availabilityPercent = 100;
    if (operatingHours > 0 || totalDowntimeHours > 0) {
      const totalOperationalBase = operatingHours + totalDowntimeHours;
      availabilityPercent = totalOperationalBase > 0 
        ? parseFloat(((operatingHours / totalOperationalBase) * 100).toFixed(1)) 
        : 100;
    }

    res.json({
      success: true,
      data: {
        machine,
        operator,
        personnel,
        activeIssues: {
          breakdown: activeBreakdown,
          workOrder: activeWorkOrder,
          hasActiveStoppage: Boolean(activeBreakdown || activeWorkOrder),
        },
        pmPlans,
        workOrders,
        breakdowns,
        partsConsumed,
        stats: {
          totalBreakdowns: agg.total_breakdowns || 0,
          totalWorkOrders: agg.total_work_orders || 0,
          completedWorkOrders: completedWOs,
          activeWorkOrders: agg.active_work_orders || 0,
          totalInspections: agg.total_inspections || 0,
          totalPmPlans: agg.total_pm_plans || 0,
          totalPartsConsumed: agg.total_parts_consumed || 0,
          totalDowntimeMinutes,
          totalDowntimeHours,
          avgMTTRMinutes,
          operatingHours,
          availabilityPercent,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};
