import { Request, Response, NextFunction } from 'express';
import {
  getAuditLogsService,
  getAuditStatsService,
  getAuditEntitiesAndActionsService,
  getAuditLogByIdService,
  exportAuditLogsCsvService,
  AuditFilterParams,
} from './audit.service';

function parseAuditFilters(req: Request): AuditFilterParams {
  const {
    entity_name,
    action,
    performed_by,
    search,
    start_date,
    end_date,
    page,
    limit,
    sort_order,
  } = req.query;

  return {
    entity_name: typeof entity_name === 'string' ? entity_name : undefined,
    action: typeof action === 'string' ? action : undefined,
    performed_by: typeof performed_by === 'string' ? performed_by : undefined,
    search: typeof search === 'string' ? search : undefined,
    start_date: typeof start_date === 'string' ? start_date : undefined,
    end_date: typeof end_date === 'string' ? end_date : undefined,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    sort_order: sort_order === 'ASC' ? 'ASC' : 'DESC',
  };
}

export const getAuditLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const filters = parseAuditFilters(req);
    const result = await getAuditLogsService(filters);
    res.json({
      success: true,
      data: result.logs,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
};

export const getAuditStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const stats = await getAuditStatsService();
    res.json({
      success: true,
      data: stats,
    });
  } catch (err) {
    next(err);
  }
};

export const getAuditFilters = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const filters = await getAuditEntitiesAndActionsService();
    res.json({
      success: true,
      data: filters,
    });
  } catch (err) {
    next(err);
  }
};

export const getAuditLogById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const log = await getAuditLogByIdService(id);
    if (!log) {
      res.status(404).json({ success: false, message: 'Audit log record not found.' });
      return;
    }
    res.json({
      success: true,
      data: log,
    });
  } catch (err) {
    next(err);
  }
};

export const exportAuditLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const filters = parseAuditFilters(req);
    const csvContent = await exportAuditLogsCsvService(filters);
    const filename = `jcb_audit_ledger_${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csvContent);
  } catch (err) {
    next(err);
  }
};
