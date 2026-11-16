import { Request, Response, NextFunction } from 'express';
import {
  createRdcSchema,
  updateRdcSchema,
  submitRdcSchema,
  approveRdcSchema,
  rejectRdcSchema,
  dispatchRdcSchema,
  returnItemSchema,
  replacementItemSchema,
  damageItemSchema,
  writeOffItemSchema,
  cancelRdcSchema,
  rdcFilterSchema,
  uuidSchema,
} from './rdc.validation';
import {
  createChallanService,
  getChallansService,
  getChallanByIdService,
  updateChallanDraftService,
  submitChallanService,
  approveChallanService,
  rejectChallanService,
  dispatchChallanService,
  recordReturnService,
  recordReplacementService,
  recordDamageService,
  recordWriteOffService,
  cancelChallanService,
  closeChallanService,
  deleteChallanService,
  getChallanHistoryService,
  getDashboardMetricsService,
  getOverdueChallansService,
  RdcServiceError,
  setRdcServiceDb,
  resetRdcServiceDb,
  setRdcServiceIo,
  resetRdcServiceIo,
} from './rdc.service';
import { AuthenticatedUser } from '../../middlewares/auth.middleware';

// Re-export test utilities for test suites
export {
  setRdcServiceDb,
  resetRdcServiceDb,
  setRdcServiceIo,
  resetRdcServiceIo,
};

function getAuthUser(req: Request): AuthenticatedUser {
  if (!req.user || !req.user.id) {
    throw new RdcServiceError('Authentication required.', 401);
  }
  return req.user;
}

/**
 * POST /api/v1/rdc
 * Create Returnable / Non-Returnable Delivery Challan
 */
export const createRDC = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = getAuthUser(req);
    const parsed = createRdcSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.errors[0]?.message || 'Invalid delivery challan request.',
        errors: parsed.error.errors,
      });
      return;
    }

    const challan = await createChallanService(parsed.data as any, user);
    res.status(201).json({
      success: true,
      message: `${challan.rdc_type} created successfully${challan.status === 'draft' ? ' as draft.' : ' and forwarded for authorization.'}`,
      data: challan,
    });
  } catch (err: any) {
    if (err instanceof RdcServiceError) {
      res.status(err.statusCode).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
};

/**
 * GET /api/v1/rdc
 * List & filter Delivery Challans
 */
export const getRDCs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = getAuthUser(req);
    const parsed = rdcFilterSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.errors[0]?.message || 'Invalid query parameters.',
        errors: parsed.error.errors,
      });
      return;
    }

    const result = await getChallansService(parsed.data, user);
    res.json({
      success: true,
      data: result.challans,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
    });
  } catch (err: any) {
    if (err instanceof RdcServiceError) {
      res.status(err.statusCode).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
};

/**
 * GET /api/v1/rdc/dashboard
 * Operational metrics & counts
 */
export const getRdcDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = getAuthUser(req);
    const parsed = rdcFilterSchema.safeParse(req.query);
    const metrics = await getDashboardMetricsService(parsed.success ? parsed.data : {}, user);
    res.json({
      success: true,
      data: metrics,
    });
  } catch (err: any) {
    if (err instanceof RdcServiceError) {
      res.status(err.statusCode).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
};

/**
 * GET /api/v1/rdc/overdue
 * Overdue return tracking
 */
export const getOverdueRDCs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = getAuthUser(req);
    const parsed = rdcFilterSchema.safeParse(req.query);
    const overdueList = await getOverdueChallansService(parsed.success ? parsed.data : {}, user);
    res.json({
      success: true,
      data: overdueList,
      total_overdue: overdueList.length,
    });
  } catch (err: any) {
    if (err instanceof RdcServiceError) {
      res.status(err.statusCode).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
};

/**
 * GET /api/v1/rdc/:id
 * Single challan details with line items and relationships
 */
export const getRDCById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = getAuthUser(req);
    const { id } = req.params;
    if (!uuidSchema.safeParse(id).success) {
      res.status(400).json({ success: false, message: 'Invalid challan ID format.' });
      return;
    }

    const challan = await getChallanByIdService(id, user);
    res.json({
      success: true,
      data: challan,
    });
  } catch (err: any) {
    if (err instanceof RdcServiceError) {
      res.status(err.statusCode).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
};

/**
 * PATCH /api/v1/rdc/:id
 * Update permitted draft fields
 */
export const updateRDCDraft = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = getAuthUser(req);
    const { id } = req.params;
    if (!uuidSchema.safeParse(id).success) {
      res.status(400).json({ success: false, message: 'Invalid challan ID format.' });
      return;
    }

    const parsed = updateRdcSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.errors[0]?.message || 'Invalid draft update payload.',
        errors: parsed.error.errors,
      });
      return;
    }

    const updated = await updateChallanDraftService(id, parsed.data, user);
    res.json({
      success: true,
      message: 'Delivery challan draft updated successfully.',
      data: updated,
    });
  } catch (err: any) {
    if (err instanceof RdcServiceError) {
      res.status(err.statusCode).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
};

/**
 * POST /api/v1/rdc/:id/submit
 * Submit draft / resubmit rejected challan for approval
 */
export const submitRDC = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = getAuthUser(req);
    const { id } = req.params;
    if (!uuidSchema.safeParse(id).success) {
      res.status(400).json({ success: false, message: 'Invalid challan ID format.' });
      return;
    }

    const parsed = submitRdcSchema.safeParse(req.body || {});
    const updated = await submitChallanService(id, parsed.success ? parsed.data : {}, user);
    res.json({
      success: true,
      message: 'Delivery challan submitted successfully for management approval.',
      data: updated,
    });
  } catch (err: any) {
    if (err instanceof RdcServiceError) {
      res.status(err.statusCode).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
};

/**
 * POST /api/v1/rdc/:id/approve
 * Formal approval step
 */
export const approveRDC = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = getAuthUser(req);
    const { id } = req.params;
    if (!uuidSchema.safeParse(id).success) {
      res.status(400).json({ success: false, message: 'Invalid challan ID format.' });
      return;
    }

    const parsed = approveRdcSchema.safeParse(req.body || {});
    const updated = await approveChallanService(id, parsed.success ? parsed.data : {}, user);
    res.json({
      success: true,
      message: 'Delivery challan approved successfully. Ready for physical dispatch.',
      data: updated,
    });
  } catch (err: any) {
    if (err instanceof RdcServiceError) {
      res.status(err.statusCode).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
};

/**
 * PUT /api/v1/rdc/:id/approve (Legacy Approval Endpoint compatibility)
 * Strictly enforces separation of duties: executes approval ONLY.
 * Cannot bypass separate physical dispatch authorization.
 */
export const approveAndDispatchRDC = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = getAuthUser(req);
    const { id } = req.params;
    if (!uuidSchema.safeParse(id).success) {
      res.status(400).json({ success: false, message: 'Invalid challan ID format.' });
      return;
    }

    // Enforce separation of duties: Approval and Physical Dispatch are distinct operations.
    // Legacy PUT /approve executes approval only, transitioning status from pending_approval to approved.
    // Physical dispatch with Gate Pass issuance and stock decrement strictly requires POST /:id/dispatch.
    const approved = await approveChallanService(
      id,
      { remarks: req.body.remarks || 'Approved via approval endpoint' },
      user
    );

    res.json({
      success: true,
      message: 'Delivery challan approved successfully. Physical dispatch requires separate authorization via /dispatch.',
      data: approved,
    });
  } catch (err: any) {
    if (err instanceof RdcServiceError) {
      res.status(err.statusCode).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
};

/**
 * POST /api/v1/rdc/:id/reject
 * Reject with mandatory remarks
 */
export const rejectRDC = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = getAuthUser(req);
    const { id } = req.params;
    if (!uuidSchema.safeParse(id).success) {
      res.status(400).json({ success: false, message: 'Invalid challan ID format.' });
      return;
    }

    const parsed = rejectRdcSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.errors[0]?.message || 'Rejection reason is mandatory.',
        errors: parsed.error.errors,
      });
      return;
    }

    const updated = await rejectChallanService(id, parsed.data, user);
    res.json({
      success: true,
      message: 'Delivery challan rejected.',
      data: updated,
    });
  } catch (err: any) {
    if (err instanceof RdcServiceError) {
      res.status(err.statusCode).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
};

/**
 * POST /api/v1/rdc/:id/dispatch
 * Authorised dispatch & gate pass generation with stock deduction
 */
export const dispatchRDC = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = getAuthUser(req);
    const { id } = req.params;
    if (!uuidSchema.safeParse(id).success) {
      res.status(400).json({ success: false, message: 'Invalid challan ID format.' });
      return;
    }

    const parsed = dispatchRdcSchema.safeParse(req.body || {});
    const updated = await dispatchChallanService(id, parsed.success ? parsed.data : {}, user);
    res.json({
      success: true,
      message: 'Delivery challan dispatched successfully. Gate Pass issued.',
      data: updated,
    });
  } catch (err: any) {
    if (err instanceof RdcServiceError) {
      res.status(err.statusCode).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
};

/**
 * POST /api/v1/rdc/:id/return
 * Record returned material against specific item
 */
export const recordRDCReturn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = getAuthUser(req);
    const { id } = req.params;
    if (!uuidSchema.safeParse(id).success) {
      res.status(400).json({ success: false, message: 'Invalid challan ID format.' });
      return;
    }

    const parsed = returnItemSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.errors[0]?.message || 'Invalid return parameters.',
        errors: parsed.error.errors,
      });
      return;
    }

    const updated = await recordReturnService(id, parsed.data, user);
    res.json({
      success: true,
      message: `Return recorded successfully. Challan Status: ${updated.status}`,
      data: updated,
    });
  } catch (err: any) {
    if (err instanceof RdcServiceError) {
      res.status(err.statusCode).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
};

/**
 * POST /api/v1/rdc/:id/replacement
 * Record replacement item receipt
 */
export const recordRDCReplacement = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = getAuthUser(req);
    const { id } = req.params;
    if (!uuidSchema.safeParse(id).success) {
      res.status(400).json({ success: false, message: 'Invalid challan ID format.' });
      return;
    }

    const parsed = replacementItemSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.errors[0]?.message || 'Invalid replacement parameters.',
        errors: parsed.error.errors,
      });
      return;
    }

    const updated = await recordReplacementService(id, parsed.data, user);
    res.json({
      success: true,
      message: `Replacement received and stock replenished. Challan Status: ${updated.status}`,
      data: updated,
    });
  } catch (err: any) {
    if (err instanceof RdcServiceError) {
      res.status(err.statusCode).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
};

/**
 * POST /api/v1/rdc/:id/damage
 * Report damaged material (Strict Quarantine)
 */
export const recordRDCDamage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = getAuthUser(req);
    const { id } = req.params;
    if (!uuidSchema.safeParse(id).success) {
      res.status(400).json({ success: false, message: 'Invalid challan ID format.' });
      return;
    }

    const parsed = damageItemSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.errors[0]?.message || 'Invalid damage reporting parameters.',
        errors: parsed.error.errors,
      });
      return;
    }

    const updated = await recordDamageService(id, parsed.data, user);
    res.json({
      success: true,
      message: `Damaged material quarantined successfully. Challan Status: ${updated.status}`,
      data: updated,
    });
  } catch (err: any) {
    if (err instanceof RdcServiceError) {
      res.status(err.statusCode).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
};

/**
 * POST /api/v1/rdc/:id/writeoff
 * Authorised write-off of outstanding material
 */
export const recordRDCWriteOff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = getAuthUser(req);
    const { id } = req.params;
    if (!uuidSchema.safeParse(id).success) {
      res.status(400).json({ success: false, message: 'Invalid challan ID format.' });
      return;
    }

    const parsed = writeOffItemSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.errors[0]?.message || 'Invalid write-off parameters.',
        errors: parsed.error.errors,
      });
      return;
    }

    const updated = await recordWriteOffService(id, parsed.data, user);
    res.json({
      success: true,
      message: `Material write-off authorized successfully. Challan Status: ${updated.status}`,
      data: updated,
    });
  } catch (err: any) {
    if (err instanceof RdcServiceError) {
      res.status(err.statusCode).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
};

/**
 * POST /api/v1/rdc/:id/cancel
 * Cancel delivery challan (before physical dispatch)
 */
export const cancelRDC = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = getAuthUser(req);
    const { id } = req.params;
    if (!uuidSchema.safeParse(id).success) {
      res.status(400).json({ success: false, message: 'Invalid challan ID format.' });
      return;
    }

    const parsed = cancelRdcSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.errors[0]?.message || 'Cancellation reason is mandatory.',
        errors: parsed.error.errors,
      });
      return;
    }

    const updated = await cancelChallanService(id, parsed.data, user);
    res.json({
      success: true,
      message: 'Delivery challan cancelled successfully.',
      data: updated,
    });
  } catch (err: any) {
    if (err instanceof RdcServiceError) {
      res.status(err.statusCode).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
};

/**
 * POST /api/v1/rdc/:id/close
 * Close reconciled delivery challan
 */
export const closeRDC = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = getAuthUser(req);
    const { id } = req.params;
    if (!uuidSchema.safeParse(id).success) {
      res.status(400).json({ success: false, message: 'Invalid challan ID format.' });
      return;
    }

    const updated = await closeChallanService(id, user);
    res.json({
      success: true,
      message: 'Delivery challan closed successfully.',
      data: updated,
    });
  } catch (err: any) {
    if (err instanceof RdcServiceError) {
      res.status(err.statusCode).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
};

/**
 * GET /api/v1/rdc/:id/history
 * Get audit history & timeline
 */
export const getRDCHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = getAuthUser(req);
    const { id } = req.params;
    if (!uuidSchema.safeParse(id).success) {
      res.status(400).json({ success: false, message: 'Invalid challan ID format.' });
      return;
    }

    const history = await getChallanHistoryService(id, user);
    res.json({
      success: true,
      data: history,
    });
  } catch (err: any) {
    if (err instanceof RdcServiceError) {
      res.status(err.statusCode).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
};

/**
 * DELETE /api/v1/rdc/:id
 * Delete delivery challan (draft, rejected, or cancelled)
 */
export const deleteRDC = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = getAuthUser(req);
    const { id } = req.params;
    if (!uuidSchema.safeParse(id).success) {
      res.status(400).json({ success: false, message: 'Invalid challan ID format.' });
      return;
    }

    const result = await deleteChallanService(id, user);
    res.json({
      success: true,
      message: result.message,
      data: { id: result.id },
    });
  } catch (err: any) {
    if (err instanceof RdcServiceError) {
      res.status(err.statusCode).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
};
