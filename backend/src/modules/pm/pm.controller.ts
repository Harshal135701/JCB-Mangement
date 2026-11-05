import { Request, Response, NextFunction } from 'express';
import {
  PMServiceError,
  setPmServiceDb,
  resetPmServiceDb,
  setPmServiceIo,
  resetPmServiceIo,
  DbPoolLike,
  createPMPlanService,
  getPMPlansService,
  getPMPlanByIdService,
  updatePMPlanService,
  togglePMPlanStatusService,
  getPMScheduleListService,
  getPMUpcomingService,
  getPMDueService,
  getPMOverdueService,
  getPMCalendarService,
  reschedulePMService,
  deferPMService,
  skipPMService,
  generateDuePMWorkOrdersService,
  getPMExecutionsService,
  getPMExecutionDetailsService,
  submitPMChecklistService,
  completePMExecutionService,
  verifyPMExecutionService,
  getMachinePMHistoryService,
  getPMDashboardService,
  getPMComplianceService,
  getPMTrendsService,
  getPMByMachineService,
  getPMByPlantService,
  getPMByShopService,
} from './pm.service';

export const setPmDb = (db: DbPoolLike): void => setPmServiceDb(db);
export const resetPmDb = (): void => resetPmServiceDb();
export const setPmIo = (io: any): void => setPmServiceIo(io);
export const resetPmIo = (): void => resetPmServiceIo();

// ---------------------------------------------------------------------------
// Error Helper
// ---------------------------------------------------------------------------
function handlePMError(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof PMServiceError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }
  next(err);
}

// ---------------------------------------------------------------------------
// 1. PM Plan Management
// ---------------------------------------------------------------------------
export const createPMPlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const plan = await createPMPlanService(req.body, user);
    res.status(201).json({
      success: true,
      message: 'Preventive Maintenance Plan configured successfully.',
      data: plan,
    });
  } catch (err) {
    handlePMError(err, res, next);
  }
};

export const getPMPlans = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const result = await getPMPlansService(req.query, user);
    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (err) {
    handlePMError(err, res, next);
  }
};

export const getPMPlanById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const plan = await getPMPlanByIdService(req.params.id, user);
    res.json({
      success: true,
      data: plan,
    });
  } catch (err) {
    handlePMError(err, res, next);
  }
};

export const updatePMPlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const plan = await updatePMPlanService(req.params.id, req.body, user);
    res.json({
      success: true,
      message: 'PM plan updated successfully.',
      data: plan,
    });
  } catch (err) {
    handlePMError(err, res, next);
  }
};

export const activatePMPlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const plan = await togglePMPlanStatusService(req.params.id, true, user);
    res.json({
      success: true,
      message: 'PM plan activated.',
      data: plan,
    });
  } catch (err) {
    handlePMError(err, res, next);
  }
};

export const deactivatePMPlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const plan = await togglePMPlanStatusService(req.params.id, false, user);
    res.json({
      success: true,
      message: 'PM plan deactivated.',
      data: plan,
    });
  } catch (err) {
    handlePMError(err, res, next);
  }
};

export const getPMPlanHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const plan = await getPMPlanByIdService(req.params.id, user);
    const history = await getMachinePMHistoryService(plan.machine_id, user);
    res.json({
      success: true,
      data: history,
    });
  } catch (err) {
    handlePMError(err, res, next);
  }
};

export const getPMPlanWorkOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const plan = await getPMPlanByIdService(req.params.id, user);
    const workOrders = await getMachinePMHistoryService(plan.machine_id, user);
    res.json({
      success: true,
      data: workOrders,
    });
  } catch (err) {
    handlePMError(err, res, next);
  }
};

// ---------------------------------------------------------------------------
// 2. PM Scheduling and Due Management
// ---------------------------------------------------------------------------
export const getPMSchedule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const result = await getPMScheduleListService(req.query, user);
    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (err) {
    handlePMError(err, res, next);
  }
};

export const getPMUpcoming = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const days = parseInt(String(req.query.days || '7'), 10) || 7;
    const upcoming = await getPMUpcomingService(days, req.query, user);
    res.json({
      success: true,
      window_days: days,
      count: upcoming.length,
      data: upcoming,
    });
  } catch (err) {
    handlePMError(err, res, next);
  }
};

export const getPMDue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const due = await getPMDueService(req.query, user);
    res.json({
      success: true,
      count: due.length,
      data: due,
    });
  } catch (err) {
    handlePMError(err, res, next);
  }
};

export const getPMOverdue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const overdue = await getPMOverdueService(req.query, user);
    res.json({
      success: true,
      count: overdue.length,
      data: overdue,
    });
  } catch (err) {
    handlePMError(err, res, next);
  }
};

export const getPMCalendar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const month = req.query.month as string | undefined;
    const calendar = await getPMCalendarService(month, user);
    res.json({
      success: true,
      month: month || new Date().toISOString().substring(0, 7),
      data: calendar,
    });
  } catch (err) {
    handlePMError(err, res, next);
  }
};

export const reschedulePM = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const { new_date, reason } = req.body;
    const result = await reschedulePMService(req.params.id, new_date, reason, user);
    res.json({
      success: true,
      message: 'PM schedule updated successfully.',
      data: result,
    });
  } catch (err) {
    handlePMError(err, res, next);
  }
};

export const deferPM = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const { days = 7, reason } = req.body;
    const result = await deferPMService(req.params.id, Number(days), reason, user);
    res.json({
      success: true,
      message: `PM deferred by ${days} days.`,
      data: result,
    });
  } catch (err) {
    handlePMError(err, res, next);
  }
};

export const skipPM = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const { reason } = req.body;
    const result = await skipPMService(req.params.id, reason, user);
    res.json({
      success: true,
      message: 'PM maintenance cycle skipped.',
      data: result,
    });
  } catch (err) {
    handlePMError(err, res, next);
  }
};

// ---------------------------------------------------------------------------
// 3. Automatic PM Work Order Generation
// ---------------------------------------------------------------------------
export const generateDuePMWorkOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const { window_days = 3, plan_id, machine_id, technician_id } = req.body;
    const result = await generateDuePMWorkOrdersService(
      {
        window_days: Number(window_days),
        plan_id,
        machine_id,
        technician_id,
      },
      user
    );

    res.json({
      success: true,
      message: `PM Engine completed. Generated ${result.generated_count} work order(s). ${result.already_existing_count} had active open work orders.`,
      data: result,
    });
  } catch (err) {
    handlePMError(err, res, next);
  }
};

// ---------------------------------------------------------------------------
// 4. PM Execution & Completion Tracking
// ---------------------------------------------------------------------------
export const getPMExecutions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const result = await getPMExecutionsService(req.query, user);
    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (err) {
    handlePMError(err, res, next);
  }
};

export const getPMExecutionDetails = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const execution = await getPMExecutionDetailsService(req.params.id, user);
    res.json({
      success: true,
      data: execution,
    });
  } catch (err) {
    handlePMError(err, res, next);
  }
};

export const getPMExecutionChecklist = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const execution = await getPMExecutionDetailsService(req.params.id, user);
    let checklist: any = null;
    if (execution.diagnosis) {
      try {
        checklist = typeof execution.diagnosis === 'string' ? JSON.parse(execution.diagnosis) : execution.diagnosis;
      } catch {
        checklist = null;
      }
    }

    res.json({
      success: true,
      execution_id: execution.id,
      wo_number: execution.wo_number,
      machine_code: execution.machine_code,
      checklist,
    });
  } catch (err) {
    handlePMError(err, res, next);
  }
};

export const submitPMExecutionChecklist = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const responses = req.body.responses || req.body.checklist;
    const overall_status = req.body.overall_status || 'pass';
    const result = await submitPMChecklistService(req.params.id, responses, overall_status, user);
    res.json({
      success: true,
      message: 'PM checklist submitted successfully.',
      data: result,
    });
  } catch (err) {
    handlePMError(err, res, next);
  }
};

export const completePMExecution = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const { work_performed, technician_remarks, parts_used } = req.body;
    const result = await completePMExecutionService(
      req.params.id,
      { work_performed, technician_remarks, parts_used },
      user
    );

    res.json({
      success: true,
      message: 'PM execution completed and submitted for manager verification.',
      data: result,
    });
  } catch (err) {
    handlePMError(err, res, next);
  }
};

export const verifyPMExecution = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const status = req.body.status || req.body.action;
    const verification_remarks = req.body.verification_remarks || req.body.remarks;
    const result = await verifyPMExecutionService(
      req.params.id,
      { status, verification_remarks },
      user
    );

    res.json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (err) {
    handlePMError(err, res, next);
  }
};

export const getMachinePMHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const history = await getMachinePMHistoryService(req.params.machineId, user);
    res.json({
      success: true,
      count: history.length,
      data: history,
    });
  } catch (err) {
    handlePMError(err, res, next);
  }
};

// ---------------------------------------------------------------------------
// 5. PM Dashboard, Compliance & Trends Analytics
// ---------------------------------------------------------------------------
export const getPMDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const dashboard = await getPMDashboardService(req.query, user);
    res.json({
      success: true,
      data: dashboard,
    });
  } catch (err) {
    handlePMError(err, res, next);
  }
};

export const getPMCompliance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const compliance = await getPMComplianceService(req.query, user);
    res.json({
      success: true,
      data: compliance,
    });
  } catch (err) {
    handlePMError(err, res, next);
  }
};

export const getPMTrends = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const trends = await getPMTrendsService(req.query, user);
    res.json({
      success: true,
      data: trends,
    });
  } catch (err) {
    handlePMError(err, res, next);
  }
};

export const getPMByMachine = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const byMachine = await getPMByMachineService(req.query, user);
    res.json({
      success: true,
      count: byMachine.length,
      data: byMachine,
    });
  } catch (err) {
    handlePMError(err, res, next);
  }
};

export const getPMByPlant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const byPlant = await getPMByPlantService(req.query, user);
    res.json({
      success: true,
      count: byPlant.length,
      data: byPlant,
    });
  } catch (err) {
    handlePMError(err, res, next);
  }
};

export const getPMByShop = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const byShop = await getPMByShopService(req.query, user);
    res.json({
      success: true,
      count: byShop.length,
      data: byShop,
    });
  } catch (err) {
    handlePMError(err, res, next);
  }
};
