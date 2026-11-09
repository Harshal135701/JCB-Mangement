import { Request, Response, NextFunction } from 'express';
import {
  createWorkOrderFromComplaintService,
  getWorkOrdersService,
  getWorkOrderDetailsService,
  getWorkOrderHistoryService,
  getWorkOrderPartsService,
  reassignWorkOrderService,
  updateWorkOrderMilestoneService,
  verifyAndCloseWorkOrderService,
  reopenWorkOrderService,
  WorkOrderServiceError,
  isUUID,
  setWorkOrdersServiceDb,
  resetWorkOrdersServiceDb,
  setWorkOrdersServiceIo,
  resetWorkOrdersServiceIo,
  getWorkOrdersServiceDb,
  getWorkOrdersServiceIo,
} from './work-orders.service';

export const setWorkOrdersDb = setWorkOrdersServiceDb;
export const resetWorkOrdersDb = resetWorkOrdersServiceDb;
export const setWorkOrdersIo = setWorkOrdersServiceIo;
export const resetWorkOrdersIo = resetWorkOrdersServiceIo;

/**
 * POST /api/v1/work-orders/assign
 * Create and allocate work order from breakdown complaint
 */
export const createWorkOrderFromComplaint = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const managerId = req.user?.id;
    const complaint_id = req.body.complaint_id || req.body.ticket_id;
    const { technician_id, sla_hours = 4, work_instructions, is_major_breakdown = false } = req.body || {};

    if (!complaint_id || !technician_id) {
      res.status(400).json({ success: false, message: 'Complaint ID and Technician ID are required.' });
      return;
    }

    if (!isUUID(complaint_id) || !isUUID(technician_id)) {
      res.status(400).json({ success: false, message: 'Valid Complaint ID and Technician ID format required.' });
      return;
    }

    const { pool } = getWorkOrdersServiceDb();
    const io = getWorkOrdersServiceIo();

    const result = await createWorkOrderFromComplaintService(
      {
        complaint_id,
        technician_id,
        manager_id: managerId,
        user: req.user,
        sla_hours: Number(sla_hours) || 4,
        work_instructions,
        is_major_breakdown: Boolean(is_major_breakdown),
      },
      pool,
      io
    );

    res.status(201).json({
      success: true,
      message: 'Work order allocated and dispatched to technician.',
      data: result.workOrder,
    });
  } catch (err: any) {
    if (err instanceof WorkOrderServiceError) {
      res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
      return;
    }
    next(err);
  }
};

/**
 * GET /api/v1/work-orders
 * List work orders with pagination, search, and RBAC scoping
 */
export const getWorkOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { query } = getWorkOrdersServiceDb();
    const result = await getWorkOrdersService(req.query || {}, req.user, query);

    res.json({
      success: true,
      data: result.workOrders,
      pagination: result.pagination,
    });
  } catch (err: any) {
    if (err instanceof WorkOrderServiceError) {
      res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
      return;
    }
    next(err);
  }
};

/**
 * GET /api/v1/work-orders/:id
 * Retrieve work order details including spare parts and milestone events
 */
export const getWorkOrderDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { query } = getWorkOrdersServiceDb();
    const data = await getWorkOrderDetailsService(id, req.user, query);

    res.json({
      success: true,
      data,
    });
  } catch (err: any) {
    if (err instanceof WorkOrderServiceError) {
      res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
      return;
    }
    next(err);
  }
};

/**
 * GET /api/v1/work-orders/:id/history
 * Retrieve full timeline of milestone events
 */
export const getWorkOrderHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { query } = getWorkOrdersServiceDb();
    const data = await getWorkOrderHistoryService(id, req.user, query);

    res.json({
      success: true,
      data,
    });
  } catch (err: any) {
    if (err instanceof WorkOrderServiceError) {
      res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
      return;
    }
    next(err);
  }
};

/**
 * GET /api/v1/work-orders/:id/parts
 * Retrieve spare parts reserved and consumed for work order
 */
export const getWorkOrderParts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { query } = getWorkOrdersServiceDb();
    const data = await getWorkOrderPartsService(id, req.user, query);

    res.json({
      success: true,
      data,
    });
  } catch (err: any) {
    if (err instanceof WorkOrderServiceError) {
      res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
      return;
    }
    next(err);
  }
};

/**
 * POST /api/v1/work-orders/:id/reassign
 * Manager reassignment of work order to another technician
 */
export const reassignWorkOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { pool } = getWorkOrdersServiceDb();
    const io = getWorkOrdersServiceIo();

    const result = await reassignWorkOrderService(id, req.body || {}, req.user, pool, io);

    res.json({
      success: true,
      message: 'Work order reassigned successfully.',
      data: result,
    });
  } catch (err: any) {
    if (err instanceof WorkOrderServiceError) {
      res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
      return;
    }
    next(err);
  }
};

/**
 * POST /api/v1/work-orders/:id/milestone
 * Record technician milestone lifecycle progress
 */
export const updateWorkOrderMilestone = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { pool } = getWorkOrdersServiceDb();
    const io = getWorkOrdersServiceIo();

    const result = await updateWorkOrderMilestoneService(id, req.body || {}, req.user, pool, io);

    const action = String(req.body?.action || 'MILESTONE').toUpperCase();
    res.json({
      success: true,
      message: `Milestone ${action} recorded.`,
      data: result,
    });
  } catch (err: any) {
    if (err instanceof WorkOrderServiceError) {
      res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
      return;
    }
    next(err);
  }
};

/**
 * POST /api/v1/work-orders/:id/verify
 * Manager verification & approval or rework request
 */
export const verifyAndCloseWorkOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { pool } = getWorkOrdersServiceDb();
    const io = getWorkOrdersServiceIo();

    const result = await verifyAndCloseWorkOrderService(id, req.body || {}, req.user, pool, io);

    const isApproved = String(req.body?.result).toUpperCase() === 'APPROVED';
    res.json({
      success: true,
      message: isApproved
        ? 'Work order verified and machine marked Running.'
        : 'Work order rejected and returned for rework.',
      data: result,
    });
  } catch (err: any) {
    if (err instanceof WorkOrderServiceError) {
      res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
      return;
    }
    next(err);
  }
};

/**
 * POST /api/v1/work-orders/:id/reopen
 * Manager reopening of closed work order
 */
export const reopenWorkOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { pool } = getWorkOrdersServiceDb();
    const io = getWorkOrdersServiceIo();

    const result = await reopenWorkOrderService(id, req.body || {}, req.user, pool, io);

    res.json({
      success: true,
      message: 'Work order reopened successfully.',
      data: result,
    });
  } catch (err: any) {
    if (err instanceof WorkOrderServiceError) {
      res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
      return;
    }
    next(err);
  }
};
