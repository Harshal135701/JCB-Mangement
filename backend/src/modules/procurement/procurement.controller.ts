import { Request, Response, NextFunction } from 'express';
import {
  createPurchaseRequisitionService,
  getPurchaseRequisitionsService,
  getPurchaseRequisitionDetailsService,
  updatePRStatusService,
  approvePurchaseRequisitionService,
  rejectPurchaseRequisitionService,
  createPurchaseOrderService,
  getPurchaseOrdersService,
  cancelPurchaseRequisitionService,
  processGRNInwardService,
  getVendorsService,
  getProcurementDashboardService,
  createVendorService,
  updateVendorService,
  getVendorByIdService,
  ProcurementServiceError,
  setProcurementServiceDb,
  resetProcurementServiceDb,
  setProcurementServiceIo,
  resetProcurementServiceIo,
} from './procurement.service';

export const setProcurementDb = setProcurementServiceDb;
export const resetProcurementDb = resetProcurementServiceDb;
export const setProcurementIo = setProcurementServiceIo;
export const resetProcurementIo = resetProcurementServiceIo;

// ---------------------------------------------------------------------------
// Error Handling Helper
// ---------------------------------------------------------------------------
function handleControllerError(err: any, res: Response, next: NextFunction): void {
  if (err instanceof ProcurementServiceError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      details: err.details,
    });
    return;
  }
  next(err);
}

// ---------------------------------------------------------------------------
// 1. Create Purchase Requisition (POST /api/v1/procurement/pr)
// ---------------------------------------------------------------------------
export const createPurchaseRequisition = async (
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

    const {
      work_order_id,
      machine_id,
      part_id,
      quantity_required,
      urgency,
      technical_justification,
      expected_delivery_date,
      plant_id,
    } = req.body || {};

    const pr = await createPurchaseRequisitionService(
      {
        work_order_id,
        machine_id,
        part_id,
        quantity_required,
        urgency,
        technical_justification,
        expected_delivery_date,
        plant_id,
      },
      user
    );

    res.status(201).json({
      success: true,
      message: 'Purchase Requisition initiated successfully.',
      data: pr,
    });
  } catch (err) {
    handleControllerError(err, res, next);
  }
};

// ---------------------------------------------------------------------------
// 2. Get All Purchase Requisitions (GET /api/v1/procurement/pr)
// ---------------------------------------------------------------------------
export const getPurchaseRequisitions = async (
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

    const {
      status,
      urgency,
      plant_id,
      shop_id,
      requested_by,
      machine_id,
      work_order_id,
      search,
      page,
      limit,
      sortBy,
      sortOrder,
    } = req.query;

    const result = await getPurchaseRequisitionsService(
      {
        status: status ? String(status) : undefined,
        urgency: urgency ? String(urgency) : undefined,
        plant_id: plant_id ? String(plant_id) : undefined,
        shop_id: shop_id ? String(shop_id) : undefined,
        requested_by: requested_by ? String(requested_by) : undefined,
        machine_id: machine_id ? String(machine_id) : undefined,
        work_order_id: work_order_id ? String(work_order_id) : undefined,
        search: search ? String(search) : undefined,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
        sortBy: sortBy ? String(sortBy) : undefined,
        sortOrder: sortOrder === 'ASC' ? 'ASC' : 'DESC',
      },
      user
    );

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
// 3. Get Purchase Requisition Details (GET /api/v1/procurement/pr/:id)
// ---------------------------------------------------------------------------
export const getPurchaseRequisitionDetails = async (
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
    const pr = await getPurchaseRequisitionDetailsService(id, user);

    res.json({
      success: true,
      data: pr,
    });
  } catch (err) {
    handleControllerError(err, res, next);
  }
};

// ---------------------------------------------------------------------------
// 4. Update PR Status (PUT /api/v1/procurement/pr/:id)
// ---------------------------------------------------------------------------
export const updatePRStatus = async (
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
    const { status, po_number, supplier_name, unit_price, expected_delivery_date, remarks } = req.body || {};

    const updatedPR = await updatePRStatusService(
      id,
      {
        status,
        po_number,
        supplier_name,
        unit_price,
        expected_delivery_date,
        remarks,
      },
      user
    );

    res.json({
      success: true,
      message: 'Purchase requisition updated.',
      data: updatedPR,
    });
  } catch (err) {
    handleControllerError(err, res, next);
  }
};

// ---------------------------------------------------------------------------
// 5. Approve Purchase Requisition (POST /api/v1/procurement/pr/:id/approve)
// ---------------------------------------------------------------------------
export const approvePurchaseRequisition = async (
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
    const { remarks, next_status, target_status } = req.body || {};
    const effectiveTargetStatus = target_status || next_status || 'vendor_selected';

    const updatedPR = await approvePurchaseRequisitionService(
      id,
      {
        next_status: effectiveTargetStatus,
        target_status: effectiveTargetStatus,
        remarks: remarks || 'Requisition approved by management.',
      },
      user
    );

    res.json({
      success: true,
      message: 'Purchase requisition approved successfully.',
      data: updatedPR,
    });
  } catch (err) {
    handleControllerError(err, res, next);
  }
};

// ---------------------------------------------------------------------------
// 6. Reject Purchase Requisition (POST /api/v1/procurement/pr/:id/reject)
// ---------------------------------------------------------------------------
export const rejectPurchaseRequisition = async (
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
    const { reason, remarks } = req.body || {};
    const rejectionReason = reason || remarks;

    const updatedPR = await rejectPurchaseRequisitionService(id, rejectionReason, user);

    res.json({
      success: true,
      message: 'Purchase requisition rejected.',
      data: updatedPR,
    });
  } catch (err) {
    handleControllerError(err, res, next);
  }
};

// ---------------------------------------------------------------------------
// 7. Cancel Purchase Requisition (POST /api/v1/procurement/pr/:id/cancel)
// ---------------------------------------------------------------------------
export const cancelPurchaseRequisition = async (
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
    const { reason, remarks } = req.body || {};
    const cancellationReason = reason || remarks;

    const updatedPR = await cancelPurchaseRequisitionService(id, cancellationReason, user);

    res.json({
      success: true,
      message: 'Purchase requisition cancelled.',
      data: updatedPR,
    });
  } catch (err) {
    handleControllerError(err, res, next);
  }
};

// ---------------------------------------------------------------------------
// 8. Create Purchase Order (POST /api/v1/procurement/pr/:id/po)
// ---------------------------------------------------------------------------
export const createPurchaseOrder = async (
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
    const { po_number, supplier_name, unit_price, expected_delivery_date, remarks, mark_as_ordered } = req.body || {};

    const updatedPR = await createPurchaseOrderService(
      id,
      {
        po_number,
        supplier_name,
        unit_price,
        expected_delivery_date,
        remarks,
        mark_as_ordered,
      },
      user
    );

    res.status(201).json({
      success: true,
      message: `Purchase Order ${updatedPR.po_number} created successfully.`,
      data: updatedPR,
    });
  } catch (err) {
    handleControllerError(err, res, next);
  }
};

// ---------------------------------------------------------------------------
// 9. Get Purchase Orders (GET /api/v1/procurement/po)
// ---------------------------------------------------------------------------
export const getPurchaseOrders = async (
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

    const { status, supplier_name, is_overdue, search, page, limit } = req.query;

    const result = await getPurchaseOrdersService(
      {
        status: status ? String(status) : undefined,
        supplier_name: supplier_name ? String(supplier_name) : undefined,
        is_overdue: is_overdue === 'true',
        search: search ? String(search) : undefined,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
      },
      user
    );

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
// 10. Get Purchase Order Details (GET /api/v1/procurement/po/:id)
// ---------------------------------------------------------------------------
export const getPurchaseOrderDetails = async (
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
    const poDetails = await getPurchaseRequisitionDetailsService(id, user);

    if (!poDetails.po_number) {
      res.status(404).json({ success: false, message: 'Purchase Order not found for this requisition.' });
      return;
    }

    res.json({
      success: true,
      data: poDetails,
    });
  } catch (err) {
    handleControllerError(err, res, next);
  }
};

// ---------------------------------------------------------------------------
// 11. Goods Receipt Note (GRN) Inwarding (POST /api/v1/procurement/pr/:id/grn)
// ---------------------------------------------------------------------------
export const processGRNInward = async (
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
    const {
      received_quantity,
      accepted_quantity,
      rejected_quantity,
      rejection_reason,
      remarks,
      delivery_note_number,
    } = req.body || {};

    const result = await processGRNInwardService(
      id,
      {
        received_quantity,
        accepted_quantity,
        rejected_quantity,
        rejection_reason,
        remarks,
        delivery_note_number,
      },
      user
    );

    res.json({
      success: true,
      message: `GRN processed successfully. ${result.accepted_quantity} units added to physical stock ledger.`,
      data: result.pr,
      receipt_details: {
        grn_number: result.grn_number,
        accepted_quantity: result.accepted_quantity,
        rejected_quantity: result.rejected_quantity,
        total_inwarded: result.total_inwarded,
        remaining_quantity: result.remaining_quantity,
      },
    });
  } catch (err) {
    handleControllerError(err, res, next);
  }
};

// ---------------------------------------------------------------------------
// 12. Vendor Directory & Performance (GET /api/v1/procurement/vendors)
// ---------------------------------------------------------------------------
export const getVendors = async (
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

    const vendors = await getVendorsService(user);

    res.json({
      success: true,
      data: vendors,
    });
  } catch (err) {
    handleControllerError(err, res, next);
  }
};

// ---------------------------------------------------------------------------
// 13. Procurement Dashboard & Reports (GET /api/v1/procurement/dashboard)
// ---------------------------------------------------------------------------
export const getProcurementDashboard = async (
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

    const metrics = await getProcurementDashboardService(user);

    res.json({
      success: true,
      data: metrics,
    });
  } catch (err) {
    handleControllerError(err, res, next);
  }
};

// ---------------------------------------------------------------------------
// 14. Vendor Master CRUD Controllers
// ---------------------------------------------------------------------------
export const createVendor = async (
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

    const {
      vendor_code,
      name,
      contact_person,
      email,
      phone,
      address,
      gstin,
      payment_terms,
      plant_id,
    } = req.body || {};

    const vendor = await createVendorService(
      {
        vendor_code,
        name,
        contact_person,
        email,
        phone,
        address,
        gstin,
        payment_terms,
        plant_id,
      },
      user
    );

    res.status(201).json({
      success: true,
      message: `Vendor ${vendor.name} registered successfully.`,
      data: vendor,
    });
  } catch (err) {
    handleControllerError(err, res, next);
  }
};

export const updateVendor = async (
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
    const {
      name,
      contact_person,
      email,
      phone,
      address,
      gstin,
      payment_terms,
      status,
    } = req.body || {};

    const updated = await updateVendorService(
      id,
      {
        name,
        contact_person,
        email,
        phone,
        address,
        gstin,
        payment_terms,
        status,
      },
      user
    );

    res.json({
      success: true,
      message: `Vendor ${updated.name} updated successfully.`,
      data: updated,
    });
  } catch (err) {
    handleControllerError(err, res, next);
  }
};

export const getVendorById = async (
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
    const vendor = await getVendorByIdService(id, user);

    res.json({
      success: true,
      data: vendor,
    });
  } catch (err) {
    handleControllerError(err, res, next);
  }
};
