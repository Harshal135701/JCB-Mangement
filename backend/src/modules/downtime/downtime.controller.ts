import { Request, Response, NextFunction } from 'express';
import {
  getDowntimeSummaryService,
  getDowntimeRecordsService,
  getDowntimeRecordDetailsService,
  getMachineDowntimeSummaryService,
  getMachineDowntimeHistoryService,
  getMachineAvailabilityService,
  getMTTRAnalyticsService,
  getMTBFAnalyticsService,
  getParetoMachinesService,
  getDowntimeByPlantService,
  getDowntimeByShopService,
  getDowntimeByCategoryService,
  getDowntimeByCauseService,
  getDowntimeTrendsService,
  getPlannedVsUnplannedService,
  getSlaPerformanceService,
  getCurrentDowntimeService,
  DowntimeFilterParams,
  DowntimeServiceError,
  setDowntimeServiceDb,
  resetDowntimeServiceDb,
} from './downtime.service';

export const setDowntimeDb = setDowntimeServiceDb;
export const resetDowntimeDb = resetDowntimeServiceDb;

function handleControllerError(err: any, res: Response, next: NextFunction): void {
  if (err instanceof DowntimeServiceError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      details: err.details,
    });
    return;
  }
  next(err);
}

function extractFilters(req: Request): DowntimeFilterParams {
  const {
    start_date,
    end_date,
    plant_id,
    shop_id,
    machine_id,
    priority,
    issue_category,
    downtime_type,
    period,
    status,
    page,
    limit,
    sortBy,
    sortOrder,
  } = req.query;

  return {
    start_date: start_date ? String(start_date) : undefined,
    end_date: end_date ? String(end_date) : undefined,
    plant_id: plant_id ? String(plant_id) : undefined,
    shop_id: shop_id ? String(shop_id) : undefined,
    machine_id: machine_id ? String(machine_id) : undefined,
    priority: priority ? String(priority) : undefined,
    issue_category: issue_category ? String(issue_category) : undefined,
    downtime_type: (downtime_type === 'planned' || downtime_type === 'unplanned') ? downtime_type : 'all',
    period: (period === 'weekly' || period === 'monthly' || period === 'yearly') ? period : 'daily',
    status: status ? String(status) : undefined,
    page: page ? Number(page) : 1,
    limit: limit ? Number(limit) : 20,
    sortBy: sortBy ? String(sortBy) : undefined,
    sortOrder: sortOrder === 'ASC' ? 'ASC' : 'DESC',
  };
}

// ---------------------------------------------------------------------------
// 1. Overall Aggregated Downtime Dashboard Summary (GET /api/v1/downtime)
// ---------------------------------------------------------------------------
export const getDowntimeAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !user.id) {
      res.status(401).json({ success: false, message: 'Unauthorized: Authentication required.' });
      return;
    }

    const filters = extractFilters(req);
    const data = await getDowntimeSummaryService(filters, user);

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    handleControllerError(err, res, next);
  }
};

// ---------------------------------------------------------------------------
// 2. Machine Downtime Records (GET /api/v1/downtime/records)
// ---------------------------------------------------------------------------
export const getDowntimeRecords = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !user.id) {
      res.status(401).json({ success: false, message: 'Unauthorized: Authentication required.' });
      return;
    }

    const filters = extractFilters(req);
    const result = await getDowntimeRecordsService(filters, user);

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (err) {
    handleControllerError(err, res, next);
  }
};

// ---------------------------------------------------------------------------
// 3. Single Downtime Record Inspection (GET /api/v1/downtime/records/:id)
// ---------------------------------------------------------------------------
export const getDowntimeRecordDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !user.id) {
      res.status(401).json({ success: false, message: 'Unauthorized: Authentication required.' });
      return;
    }

    const { id } = req.params;
    const data = await getDowntimeRecordDetailsService(id, user);

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    handleControllerError(err, res, next);
  }
};

// ---------------------------------------------------------------------------
// 4. Machine Downtime Summary (GET /api/v1/downtime/machines/:machineId)
// ---------------------------------------------------------------------------
export const getMachineDowntimeSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !user.id) {
      res.status(401).json({ success: false, message: 'Unauthorized: Authentication required.' });
      return;
    }

    const { machineId } = req.params;
    const filters = extractFilters(req);
    const data = await getMachineDowntimeSummaryService(machineId, filters, user);

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    handleControllerError(err, res, next);
  }
};

// ---------------------------------------------------------------------------
// 5. Machine Historical Timeline (GET /api/v1/downtime/machines/:machineId/history)
// ---------------------------------------------------------------------------
export const getMachineDowntimeHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !user.id) {
      res.status(401).json({ success: false, message: 'Unauthorized: Authentication required.' });
      return;
    }

    const { machineId } = req.params;
    const filters = extractFilters(req);
    const result = await getMachineDowntimeHistoryService(machineId, filters, user);

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (err) {
    handleControllerError(err, res, next);
  }
};

// ---------------------------------------------------------------------------
// 6. Machine Availability Analytics (GET /api/v1/downtime/availability)
// ---------------------------------------------------------------------------
export const getMachineAvailability = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !user.id) {
      res.status(401).json({ success: false, message: 'Unauthorized: Authentication required.' });
      return;
    }

    const filters = extractFilters(req);
    const data = await getMachineAvailabilityService(filters, user);

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    handleControllerError(err, res, next);
  }
};

// ---------------------------------------------------------------------------
// 7. MTTR Analytics (GET /api/v1/downtime/mttr)
// ---------------------------------------------------------------------------
export const getMTTRAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !user.id) {
      res.status(401).json({ success: false, message: 'Unauthorized: Authentication required.' });
      return;
    }

    const filters = extractFilters(req);
    const data = await getMTTRAnalyticsService(filters, user);

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    handleControllerError(err, res, next);
  }
};

// ---------------------------------------------------------------------------
// 8. MTBF Analytics (GET /api/v1/downtime/mtbf)
// ---------------------------------------------------------------------------
export const getMTBFAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !user.id) {
      res.status(401).json({ success: false, message: 'Unauthorized: Authentication required.' });
      return;
    }

    const filters = extractFilters(req);
    const data = await getMTBFAnalyticsService(filters, user);

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    handleControllerError(err, res, next);
  }
};

// ---------------------------------------------------------------------------
// 9. Machine Pareto 80/20 Analysis (GET /api/v1/downtime/by-machine)
// ---------------------------------------------------------------------------
export const getParetoMachines = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !user.id) {
      res.status(401).json({ success: false, message: 'Unauthorized: Authentication required.' });
      return;
    }

    const filters = extractFilters(req);
    const data = await getParetoMachinesService(filters, user);

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    handleControllerError(err, res, next);
  }
};

// ---------------------------------------------------------------------------
// 10. Plant-level Downtime Aggregation (GET /api/v1/downtime/by-plant)
// ---------------------------------------------------------------------------
export const getDowntimeByPlant = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !user.id) {
      res.status(401).json({ success: false, message: 'Unauthorized: Authentication required.' });
      return;
    }

    const filters = extractFilters(req);
    const data = await getDowntimeByPlantService(filters, user);

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    handleControllerError(err, res, next);
  }
};

// ---------------------------------------------------------------------------
// 11. Shop-level Downtime Aggregation (GET /api/v1/downtime/by-shop)
// ---------------------------------------------------------------------------
export const getDowntimeByShop = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !user.id) {
      res.status(401).json({ success: false, message: 'Unauthorized: Authentication required.' });
      return;
    }

    const filters = extractFilters(req);
    const data = await getDowntimeByShopService(filters, user);

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    handleControllerError(err, res, next);
  }
};

// ---------------------------------------------------------------------------
// 12. Category-wise Distribution (GET /api/v1/downtime/by-category)
// ---------------------------------------------------------------------------
export const getDowntimeByCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !user.id) {
      res.status(401).json({ success: false, message: 'Unauthorized: Authentication required.' });
      return;
    }

    const filters = extractFilters(req);
    const data = await getDowntimeByCategoryService(filters, user);

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    handleControllerError(err, res, next);
  }
};

// ---------------------------------------------------------------------------
// 13. Root Cause Breakdown (GET /api/v1/downtime/by-cause)
// ---------------------------------------------------------------------------
export const getDowntimeByCause = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !user.id) {
      res.status(401).json({ success: false, message: 'Unauthorized: Authentication required.' });
      return;
    }

    const filters = extractFilters(req);
    const data = await getDowntimeByCauseService(filters, user);

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    handleControllerError(err, res, next);
  }
};

// ---------------------------------------------------------------------------
// 14. Trend Analytics (GET /api/v1/downtime/trends)
// ---------------------------------------------------------------------------
export const getDowntimeTrends = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !user.id) {
      res.status(401).json({ success: false, message: 'Unauthorized: Authentication required.' });
      return;
    }

    const filters = extractFilters(req);
    const data = await getDowntimeTrendsService(filters, user);

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    handleControllerError(err, res, next);
  }
};

// ---------------------------------------------------------------------------
// 15. Planned vs Unplanned Downtime (GET /api/v1/downtime/planned-vs-unplanned)
// ---------------------------------------------------------------------------
export const getPlannedVsUnplanned = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !user.id) {
      res.status(401).json({ success: false, message: 'Unauthorized: Authentication required.' });
      return;
    }

    const filters = extractFilters(req);
    const data = await getPlannedVsUnplannedService(filters, user);

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    handleControllerError(err, res, next);
  }
};

// ---------------------------------------------------------------------------
// 16. SLA Performance (GET /api/v1/downtime/sla)
// ---------------------------------------------------------------------------
export const getSlaPerformance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !user.id) {
      res.status(401).json({ success: false, message: 'Unauthorized: Authentication required.' });
      return;
    }

    const filters = extractFilters(req);
    const data = await getSlaPerformanceService(filters, user);

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    handleControllerError(err, res, next);
  }
};

// ---------------------------------------------------------------------------
// 17. Current Downtime & Ongoing Incident Monitoring (GET /api/v1/downtime/current)
// ---------------------------------------------------------------------------
export const getCurrentDowntime = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !user.id) {
      res.status(401).json({ success: false, message: 'Unauthorized: Authentication required.' });
      return;
    }

    const filters = extractFilters(req);
    const data = await getCurrentDowntimeService(filters, user);

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    handleControllerError(err, res, next);
  }
};
