import { Request, Response, NextFunction } from 'express';
import {
  InspectionServiceError,
  setInspectionsServiceDb,
  resetInspectionsServiceDb,
  setInspectionsServiceIo,
  resetInspectionsServiceIo,
  DbPoolLike,
  getInspectionTemplateService,
  createInspectionTemplateService,
  getInspectionTemplatesListService,
  getInspectionTemplateByIdService,
  updateInspectionTemplateService,
  toggleInspectionTemplateStatusService,
  submitInspectionService,
  getInspectionRecordsService,
  getInspectionRecordByIdService,
} from './inspections.service';

// ---------------------------------------------------------------------------
// Dependency Injection Exports (Used for isolated transactional tests)
// ---------------------------------------------------------------------------
export const setInspectionsDb = (db: DbPoolLike): void => setInspectionsServiceDb(db);
export const resetInspectionsDb = (): void => resetInspectionsServiceDb();
export const setInspectionsIo = (io: any): void => setInspectionsServiceIo(io);
export const resetInspectionsIo = (): void => resetInspectionsServiceIo();

// ---------------------------------------------------------------------------
// Central Error Handler for Module 7
// ---------------------------------------------------------------------------
export function handleInspectionError(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof InspectionServiceError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }
  next(err);
}

// ---------------------------------------------------------------------------
// Controller Endpoints
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/inspections/template
 * Returns active inspection template for category or standard default checklist.
 */
export const getInspectionTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }
    const { category = 'HMC' } = req.query;
    const template = await getInspectionTemplateService(String(category), user);
    res.json({
      success: true,
      data: template,
    });
  } catch (err) {
    handleInspectionError(err, res, next);
  }
};

/**
 * POST /api/v1/inspections/templates
 * Creates a new inspection template with validation and versioning.
 */
export const createInspectionTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }
    const created = await createInspectionTemplateService(req.body, user);
    res.status(201).json({
      success: true,
      message: 'Inspection template created successfully.',
      data: created,
    });
  } catch (err) {
    handleInspectionError(err, res, next);
  }
};

/**
 * GET /api/v1/inspections/templates
 * Returns paginated list of templates with optional category/status filters.
 */
export const getInspectionTemplatesList = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }
    const result = await getInspectionTemplatesListService(req.query, user);
    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (err) {
    handleInspectionError(err, res, next);
  }
};

/**
 * GET /api/v1/inspections/templates/:id
 * Returns template details by ID.
 */
export const getInspectionTemplateById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }
    const template = await getInspectionTemplateByIdService(req.params.id, user);
    res.json({
      success: true,
      data: template,
    });
  } catch (err) {
    handleInspectionError(err, res, next);
  }
};

/**
 * PUT /api/v1/inspections/templates/:id
 * Updates template and increments version.
 */
export const updateInspectionTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }
    const updated = await updateInspectionTemplateService(req.params.id, req.body, user);
    res.json({
      success: true,
      message: 'Inspection template updated successfully.',
      data: updated,
    });
  } catch (err) {
    handleInspectionError(err, res, next);
  }
};

/**
 * PATCH /api/v1/inspections/templates/:id/status
 * Activates or deactivates an inspection template.
 */
export const toggleInspectionTemplateStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }
    const { is_active, expected_version } = req.body;
    if (is_active === undefined || typeof is_active !== 'boolean') {
      res.status(400).json({ success: false, message: 'Field is_active must be a boolean.' });
      return;
    }
    const updated = await toggleInspectionTemplateStatusService(req.params.id, is_active, user, expected_version);
    res.json({
      success: true,
      message: `Inspection template ${is_active ? 'activated' : 'deactivated'} successfully.`,
      data: updated,
    });
  } catch (err) {
    handleInspectionError(err, res, next);
  }
};

/**
 * POST /api/v1/inspections/submit
 * Submits pre-shift machinery inspection with machine access validation, server-side evaluation,
 * and snapshotted versioned metadata.
 */
export const submitInspection = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }
    const record = await submitInspectionService(req.body, user);
    res.status(201).json({
      success: true,
      message: 'Inspection submitted successfully.',
      data: record,
    });
  } catch (err) {
    handleInspectionError(err, res, next);
  }
};

/**
 * GET /api/v1/inspections/records
 * Returns paginated inspection records scoped to user's authorized plant/shop.
 */
export const getInspectionRecords = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }
    const result = await getInspectionRecordsService(req.query, user);
    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (err) {
    handleInspectionError(err, res, next);
  }
};

/**
 * GET /api/v1/inspections/records/:id
 * Returns single inspection record detail with machine and evaluation envelope context.
 */
export const getInspectionRecordById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }
    const record = await getInspectionRecordByIdService(req.params.id, user);
    res.json({
      success: true,
      data: record,
    });
  } catch (err) {
    handleInspectionError(err, res, next);
  }
};
