/**
 * JCB Smart Machine Maintenance Management System (CMMS)
 * Operator Machine Selection & Manager Approval Workflow - Controller Layer
 */

import { Request, Response, NextFunction } from 'express';
import {
  operatorAssignmentService,
  OperatorAssignmentError,
  setOperatorAssignmentDb,
  resetOperatorAssignmentDb,
  setOperatorAssignmentIo,
  resetOperatorAssignmentIo,
} from './operator-assignment.service';

// Export testing DB/IO injection functions
export {
  setOperatorAssignmentDb,
  resetOperatorAssignmentDb,
  setOperatorAssignmentIo,
  resetOperatorAssignmentIo,
};

/**
 * GET /api/v1/machines/operator/available-machines
 * List all machines in the selected shop with assignment availability status.
 */
export const getAvailableMachines = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { shop_id, plant_id } = req.query;

    const result = await operatorAssignmentService.getAvailableMachines(
      req.user!,
      shop_id as string,
      plant_id as string | undefined
    );

    res.json({
      success: true,
      data: result.data,
      count: result.count,
    });
  } catch (err: any) {
    if (err instanceof OperatorAssignmentError) {
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
 * POST /api/v1/machines/operator/sign-in
 * Operator requests sign-in for an available machine.
 */
export const requestSignIn = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const assignment = await operatorAssignmentService.requestSignIn(
      req.user!,
      req.body,
      req.ip
    );

    res.status(201).json({
      success: true,
      message: 'Machine sign-in request submitted successfully. Pending manager approval.',
      data: assignment,
    });
  } catch (err: any) {
    if (err instanceof OperatorAssignmentError) {
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
 * GET /api/v1/machines/operator/current-assignment
 * Get the operator's current active or pending assignment, or recent rejection.
 */
export const getCurrentAssignment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await operatorAssignmentService.getOperatorCurrentAssignment(
      req.user!
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    if (err instanceof OperatorAssignmentError) {
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
 * POST /api/v1/machines/operator/cancel-request
 * Operator cancels their pending sign-in request.
 */
export const cancelRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { assignment_id } = req.body;

    const assignment = await operatorAssignmentService.cancelRequest(
      req.user!,
      assignment_id,
      req.ip
    );

    res.json({
      success: true,
      message: 'Sign-in request cancelled successfully. Machine reservation released.',
      data: assignment,
    });
  } catch (err: any) {
    if (err instanceof OperatorAssignmentError) {
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
 * POST /api/v1/machines/operator/sign-out
 * Operator (or authorized manager) signs out from an active machine assignment.
 */
export const signOut = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { assignment_id } = req.body;

    const assignment = await operatorAssignmentService.signOut(
      req.user!,
      assignment_id,
      req.ip
    );

    res.json({
      success: true,
      message: 'Signed out from machine successfully. Machine is now available for new shifts.',
      data: assignment,
    });
  } catch (err: any) {
    if (err instanceof OperatorAssignmentError) {
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
 * GET /api/v1/machines/operator/requests/pending
 * Manager views pending operator sign-in requests in their plant.
 */
export const getPendingRequests = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { plant_id, shop_id } = req.query;

    const result = await operatorAssignmentService.getPendingRequests(
      req.user!,
      plant_id as string | undefined,
      shop_id as string | undefined
    );

    res.json({
      success: true,
      data: result.data,
      count: result.count,
    });
  } catch (err: any) {
    if (err instanceof OperatorAssignmentError) {
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
 * GET /api/v1/machines/operator/assignments/active
 * Manager views active operator machine floor sessions.
 */
export const getActiveAssignments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { plant_id, shop_id } = req.query;

    const result = await operatorAssignmentService.getActiveAssignments(
      req.user!,
      plant_id as string | undefined,
      shop_id as string | undefined
    );

    res.json({
      success: true,
      data: result.data,
      count: result.count,
    });
  } catch (err: any) {
    if (err instanceof OperatorAssignmentError) {
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
 * POST /api/v1/machines/operator/requests/:id/approve
 * Manager approves a pending sign-in request.
 */
export const approveRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const assignment = await operatorAssignmentService.approveRequest(
      req.user!,
      id,
      req.ip
    );

    res.json({
      success: true,
      message: `Machine sign-in request approved for ${assignment.operator_name || 'operator'}.`,
      data: assignment,
    });
  } catch (err: any) {
    if (err instanceof OperatorAssignmentError) {
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
 * POST /api/v1/machines/operator/requests/:id/reject
 * Manager rejects a pending sign-in request.
 */
export const rejectRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const assignment = await operatorAssignmentService.rejectRequest(
      req.user!,
      id,
      req.body,
      req.ip
    );

    res.json({
      success: true,
      message: 'Machine sign-in request rejected. Reservation released.',
      data: assignment,
    });
  } catch (err: any) {
    if (err instanceof OperatorAssignmentError) {
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
