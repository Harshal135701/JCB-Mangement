import { Request, Response, NextFunction } from 'express';
import { query } from '../../config/db';

export const getAuditLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { entity_name, page = '1', limit = '50' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let sql = `
      SELECT a.*, u.full_name as performed_by_name, u.role as performed_by_role
      FROM audit_logs a
      LEFT JOIN users u ON a.performed_by = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (entity_name) {
      params.push(entity_name);
      sql += ` AND a.entity_name = $${params.length}`;
    }
    sql += ` ORDER BY a.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(Number(limit), offset);

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
};

