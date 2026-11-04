import { Request, Response, NextFunction } from 'express';
import { query } from '../../config/db';

export const getDowntimeAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { machine_id, shop_id } = req.query;

    // 1. Overall Aggregated Downtime Metrics
    const metricsRes = await query(`
      SELECT 
        COUNT(id) as total_breakdown_events,
        COALESCE(SUM(total_downtime_minutes), 0) as total_downtime_minutes,
        COALESCE(AVG(total_downtime_minutes), 0) as avg_downtime_per_incident,
        COALESCE(AVG(active_repair_minutes), 0) as mttr_active_wrench_minutes,
        COALESCE(AVG(maintenance_response_minutes), 0) as avg_response_delay_minutes
      FROM work_orders
      WHERE status = 'verified_closed'
    `);

    // 2. Machine-wise Downtime Breakdown (Top 10 Pareto)
    const paretoRes = await query(`
      SELECT m.id, m.machine_code, m.name, s.shop_name, m.criticality,
             COUNT(wo.id) as failure_count,
             COALESCE(SUM(wo.total_downtime_minutes), 0) as total_downtime_minutes,
             COALESCE(AVG(wo.active_repair_minutes), 0) as avg_repair_minutes
      FROM machines m
      JOIN shops s ON m.shop_id = s.id
      LEFT JOIN work_orders wo ON m.id = wo.machine_id AND wo.status = 'verified_closed'
      GROUP BY m.id, m.machine_code, m.name, s.shop_name, m.criticality
      ORDER BY total_downtime_minutes DESC
      LIMIT 10
    `);

    // 3. Category-wise Breakdown Distribution
    const categoryRes = await query(`
      SELECT issue_category, COUNT(*) as count
      FROM maintenance_requests
      GROUP BY issue_category
      ORDER BY count DESC
    `);

    res.json({
      success: true,
      data: {
        summary: metricsRes.rows[0],
        paretoTopMachines: paretoRes.rows,
        categoryDistribution: categoryRes.rows,
      },
    });
  } catch (err) {
    next(err);
  }
};
