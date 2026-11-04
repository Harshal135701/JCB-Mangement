import { Request, Response, NextFunction } from 'express';
import { query } from '../../config/db';

export const getDashboardStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // 1. Machine Counts
    const machineCountRes = await query(`
      SELECT 
        COUNT(*) as total_machines,
        COUNT(CASE WHEN status = 'operational' THEN 1 END) as operational_count,
        COUNT(CASE WHEN status = 'breakdown' THEN 1 END) as breakdown_count,
        COUNT(CASE WHEN status = 'under_maintenance' THEN 1 END) as maintenance_count,
        COUNT(CASE WHEN status = 'awaiting_parts' THEN 1 END) as awaiting_parts_count
      FROM machines
    `);

    // 2. Work Order Stats
    const woCountRes = await query(`
      SELECT 
        COUNT(CASE WHEN status NOT IN ('verified_closed', 'rejected') THEN 1 END) as open_work_orders,
        COUNT(CASE WHEN status = 'repair_completed' THEN 1 END) as pending_approvals,
        COALESCE(AVG(active_repair_minutes), 0) as avg_mttr_minutes,
        COALESCE(SUM(total_downtime_minutes), 0) as total_downtime_minutes
      FROM work_orders
    `);

    // 3. Spare Parts Shortages
    const partsShortageRes = await query(`
      SELECT COUNT(*) as low_stock_count 
      FROM spare_parts 
      WHERE available_stock <= min_reorder_level
    `);

    // 4. Top 5 Machines by Downtime (Pareto)
    const topDowntimeRes = await query(`
      SELECT m.machine_code, m.name, s.shop_name, 
             COALESCE(SUM(wo.total_downtime_minutes), 0) as downtime_minutes,
             COUNT(wo.id) as failure_count
      FROM machines m
      JOIN shops s ON m.shop_id = s.id
      LEFT JOIN work_orders wo ON m.id = wo.machine_id
      GROUP BY m.id, m.machine_code, m.name, s.shop_name
      ORDER BY downtime_minutes DESC
      LIMIT 5
    `);

    const mStats = machineCountRes.rows[0];
    const woStats = woCountRes.rows[0];
    const lowStock = partsShortageRes.rows[0].low_stock_count;

    const totalMachines = parseInt(mStats.total_machines, 10) || 1;
    const operational = parseInt(mStats.operational_count, 10) || 0;
    const machineAvailability = ((operational / totalMachines) * 100).toFixed(1);

    res.json({
      success: true,
      data: {
        totalMachines,
        operationalCount: operational,
        breakdownCount: parseInt(mStats.breakdown_count, 10) || 0,
        maintenanceCount: parseInt(mStats.maintenance_count, 10) || 0,
        awaitingPartsCount: parseInt(mStats.awaiting_parts_count, 10) || 0,
        openWorkOrders: parseInt(woStats.open_work_orders, 10) || 0,
        pendingApprovals: parseInt(woStats.pending_approvals, 10) || 0,
        avgMTTRMinutes: Math.round(parseFloat(woStats.avg_mttr_minutes)),
        totalDowntimeMinutes: parseInt(woStats.total_downtime_minutes, 10) || 0,
        machineAvailabilityPercent: parseFloat(machineAvailability),
        lowStockItemsCount: parseInt(lowStock, 10) || 0,
        topDowntimeMachines: topDowntimeRes.rows,
      },
    });
  } catch (err) {
    next(err);
  }
};

