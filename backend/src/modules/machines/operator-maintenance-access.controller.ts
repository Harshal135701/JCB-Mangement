/**
 * JCB Smart Machine Maintenance Management System (CMMS)
 * Operator Maintenance Access - Controller Layer
 */

import { Request, Response, NextFunction } from 'express';
import {
  getOperatorConsolidatedMaintenanceStatus,
  getMachineMaintenanceOverview,
  enforceOperatorMachineAccess,
  OperatorMaintenanceAccessError,
  setOperatorMaintenanceAccessDb,
  resetOperatorMaintenanceAccessDb,
  isUUID,
  getOperatorMaintenanceAccessDb,
} from './operator-maintenance-access.service';
import { enforceMachineFacilityScope } from './machines.service';
import { machinesRepository } from './machines.repository';
import { query as defaultQuery } from '../../config/db';

export { setOperatorMaintenanceAccessDb, resetOperatorMaintenanceAccessDb };

/**
 * GET /api/v1/machines/operator/maintenance-status
 * Retrieve consolidated maintenance status for the authenticated operator
 * (permanent machine + approved temporary replacement machine)
 */
export const getOperatorMaintenanceStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const data = await getOperatorConsolidatedMaintenanceStatus(req.user);

    res.json({
      success: true,
      data,
    });
  } catch (err: any) {
    if (err instanceof OperatorMaintenanceAccessError) {
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
 * GET /api/v1/machines/:id/maintenance-status
 * Retrieve detailed maintenance status for a specific machine asset with strict RBAC:
 * - Operators: strictly restricted to their assigned permanent or approved temporary machine
 * - Technicians / Managers / Admins: restricted to their facility/plant scope
 */
export const getMachineMaintenanceStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const { id } = req.params;

    if (!id || !isUUID(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid machine ID. Must be a valid UUID.',
      });
      return;
    }

    // 1. Enforce Operator-specific Machine-level Access Control
    if (req.user.role === 'operator') {
      await enforceOperatorMachineAccess(req.user, id);
    } else {
      // 2. Enforce General Facility Scope for Managers/Technicians
      try {
        const machine = await machinesRepository.findById(getOperatorMaintenanceAccessDb(), id);
        if (!machine) {
          res.status(404).json({ success: false, message: 'Machine not found.' });
          return;
        }
        enforceMachineFacilityScope(req.user, machine.plant_id, machine.shop_id);
      } catch (scopeErr: any) {
        if (scopeErr.statusCode) {
          res.status(scopeErr.statusCode).json({
            success: false,
            message: scopeErr.message,
          });
          return;
        }
        throw scopeErr;
      }
    }

    // 3. Fetch comprehensive machine maintenance overview
    const data = await getMachineMaintenanceOverview(id);

    res.json({
      success: true,
      data,
    });
  } catch (err: any) {
    if (err instanceof OperatorMaintenanceAccessError) {
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
