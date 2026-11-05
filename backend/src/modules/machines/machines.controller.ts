/**
 * JCB Smart Machine Maintenance Management System (CMMS)
 * Machines Module - Controller Layer
 * Handles HTTP request validation, error formatting, and response dispatching.
 */

import { Request, Response, NextFunction } from 'express';
import {
  machinesService,
  MachineServiceError,
  setMachinesServiceDb,
  resetMachinesServiceDb,
} from './machines.service';

// Export test database injection functions for unit testing
export const setMachinesDb = setMachinesServiceDb;
export const resetMachinesDb = resetMachinesServiceDb;

/**
 * GET /api/v1/machines
 * List machines with enterprise search, multi-plant filtering, pagination, and sorting.
 */
export const getMachines = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      status,
      shop_id,
      plant_id,
      criticality,
      category,
      exclude_decommissioned,
      search,
      sortBy,
      sortOrder,
      page = '1',
      limit = '50',
    } = req.query;

    const result = await machinesService.listMachines(
      {
        status: status as string,
        shop_id: shop_id as string,
        plant_id: plant_id as string,
        criticality: criticality as string,
        category: category as string,
        exclude_decommissioned: exclude_decommissioned as any,
        search: search as string,
        sortBy: sortBy as string,
        sortOrder: sortOrder as any,
        page: page as any,
        limit: limit as any,
      },
      req.user!
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: result.pagination,
    });
  } catch (err: any) {
    if (err instanceof MachineServiceError) {
      res.status(err.statusCode).json({
        success: false,
        message: err.message,
        details: err.details,
      });
      return;
    }
    next(err);
  }
};

/**
 * GET /api/v1/machines/qr/:uid
 * Retrieve machine by its secure QR code UID.
 */
export const getMachineByQR = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { uid } = req.params;
    const result = await machinesService.getMachineByQr(uid, req.user!);

    res.json({
      success: true,
      data: result.machine,
      ...(result.warning ? { warning: result.warning } : {}),
    });
  } catch (err: any) {
    if (err instanceof MachineServiceError) {
      res.status(err.statusCode).json({
        success: false,
        message: err.message,
        details: err.details,
      });
      return;
    }
    next(err);
  }
};

/**
 * GET /api/v1/machines/:id/history
 * Retrieve consolidated machine maintenance history across complaints, work orders,
 * pre-shift inspections, PM plans, and spare parts consumed.
 */
export const getMachineHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { page, limit, type } = req.query;

    const historyData = await machinesService.getMachineMaintenanceHistory(
      id,
      {
        page: page as any,
        limit: limit as any,
        type: type as string,
      },
      req.user!
    );

    res.json({
      success: true,
      data: historyData,
    });
  } catch (err: any) {
    if (err instanceof MachineServiceError) {
      res.status(err.statusCode).json({
        success: false,
        message: err.message,
        details: err.details,
      });
      return;
    }
    next(err);
  }
};

/**
 * GET /api/v1/machines/:id
 * Retrieve machine asset details by UUID with plant and shop metadata.
 */
export const getMachineById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const machine = await machinesService.getMachineById(id, req.user!);

    res.json({
      success: true,
      data: machine,
    });
  } catch (err: any) {
    if (err instanceof MachineServiceError) {
      res.status(err.statusCode).json({
        success: false,
        message: err.message,
        details: err.details,
      });
      return;
    }
    next(err);
  }
};

/**
 * POST /api/v1/machines
 * Register a new machine asset with auto-generated secure QR UID and audit logging.
 */
export const createMachine = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const machine = await machinesService.createMachine(
      req.body,
      req.user!,
      req.ip
    );

    res.status(201).json({
      success: true,
      message: `Machine ${machine.machine_code} registered successfully.`,
      data: machine,
    });
  } catch (err: any) {
    if (err instanceof MachineServiceError) {
      res.status(err.statusCode).json({
        success: false,
        message: err.message,
        details: err.details,
      });
      return;
    }
    next(err);
  }
};

/**
 * PUT /api/v1/machines/:id
 * Update machine specifications, meter readings, or location with lifecycle consistency.
 */
export const updateMachine = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const machine = await machinesService.updateMachine(
      id,
      req.body,
      req.user!,
      req.ip
    );

    res.json({
      success: true,
      message: `Machine ${machine.machine_code} updated successfully.`,
      data: machine,
    });
  } catch (err: any) {
    if (err instanceof MachineServiceError) {
      res.status(err.statusCode).json({
        success: false,
        message: err.message,
        details: err.details,
      });
      return;
    }
    next(err);
  }
};

/**
 * DELETE /api/v1/machines/:id
 * Safe decommissioning or deletion. Assets with historical records are decommissioned.
 */
export const deleteMachine = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await machinesService.deleteOrDecommissionMachine(
      id,
      req.user!,
      req.ip
    );

    res.json({
      success: true,
      message: result.message,
      data: result.data,
      decommissioned: result.decommissioned,
      deleted: result.deleted,
    });
  } catch (err: any) {
    if (err instanceof MachineServiceError) {
      res.status(err.statusCode).json({
        success: false,
        message: err.message,
        details: err.details,
      });
      return;
    }
    next(err);
  }
};
