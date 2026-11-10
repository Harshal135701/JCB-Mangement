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
