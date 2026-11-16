import { z } from 'zod';

export const uuidSchema = z.string().uuid({ message: 'Must be a valid UUID' });

export const rdcItemInputSchema = z.object({
  part_id: z.string().uuid().optional().nullable(),
  item_description: z.string().trim().min(2, { message: 'Item description must be at least 2 characters.' }),
  serial_number: z.string().trim().optional().nullable(),
  quantity_dispatched: z.number().int().positive({ message: 'Quantity dispatched must be a positive integer.' }),
  unit_cost: z.number().nonnegative({ message: 'Unit cost must be non-negative.' }).optional().default(0),
  approximate_value: z.number().nonnegative({ message: 'Approximate value must be non-negative.' }).optional().default(0),
  remarks: z.string().trim().optional().nullable(),
});

export const createRdcSchema = z.object({
  rdc_type: z.enum(['RDC', 'NRDC']).default('RDC'),
  plant_id: z.string().uuid().optional().nullable(),
  shop_id: z.string().uuid().optional().nullable(),
  work_order_id: z.string().uuid().optional().nullable(),
  machine_id: z.string().uuid().optional().nullable(),
  vendor_id: z.string().uuid().optional().nullable(),
  vendor_party_name: z.string().trim().optional(),
  vendor_name: z.string().trim().optional(),
  vendor_gstin: z.string().trim().optional().nullable(),
  vendor_address: z.string().trim().optional().nullable(),
  contact_person: z.string().trim().optional().nullable(),
  purpose: z.string({ required_error: 'Dispatch purpose is mandatory.', invalid_type_error: 'Dispatch purpose is mandatory.' }).trim().min(2, { message: 'Dispatch purpose is mandatory.' }),
  priority: z.enum(['low', 'medium', 'high', 'emergency']).default('medium'),
  dispatch_date: z.string().trim().optional().nullable(),
  expected_return_date: z.string().trim().optional().nullable(),
  document_reference: z.string().trim().optional().nullable(),
  items: z.array(rdcItemInputSchema).min(1, { message: 'At least one line item is required.' }),
  save_as_draft: z.boolean().optional().default(false),
}).refine(
  (data) => Boolean(data.vendor_party_name || data.vendor_name || data.vendor_id),
  { message: 'Vendor name or vendor ID is mandatory.', path: ['vendor_party_name'] }
).refine(
  (data) => {
    // If it's a Returnable Challan (RDC), expected_return_date is highly recommended
    return true;
  }
);

export const updateRdcSchema = z.object({
  plant_id: z.string().uuid().optional().nullable(),
  shop_id: z.string().uuid().optional().nullable(),
  work_order_id: z.string().uuid().optional().nullable(),
  machine_id: z.string().uuid().optional().nullable(),
  vendor_id: z.string().uuid().optional().nullable(),
  vendor_party_name: z.string().trim().optional(),
  vendor_gstin: z.string().trim().optional().nullable(),
  vendor_address: z.string().trim().optional().nullable(),
  contact_person: z.string().trim().optional().nullable(),
  purpose: z.string().trim().min(2).optional(),
  priority: z.enum(['low', 'medium', 'high', 'emergency']).optional(),
  expected_return_date: z.string().trim().optional().nullable(),
  document_reference: z.string().trim().optional().nullable(),
  items: z.array(rdcItemInputSchema).min(1).optional(),
});

export const submitRdcSchema = z.object({
  notes: z.string().trim().optional(),
});

export const approveRdcSchema = z.object({
  remarks: z.string().trim().optional(),
});

export const rejectRdcSchema = z.object({
  rejection_reason: z.string().trim().min(3, { message: 'Rejection reason must be at least 3 characters.' }),
});

export const dispatchRdcSchema = z.object({
  gate_pass_number: z.string().trim().optional(),
  vehicle_number: z.string().trim().optional(),
  transporter_name: z.string().trim().optional(),
  dispatch_notes: z.string().trim().optional(),
});

export const returnItemSchema = z.object({
  item_id: z.string().uuid({ message: 'Must be a valid item UUID.' }),
  returned_quantity: z.number().int().positive({ message: 'Returned quantity must be at least 1.' }),
  remarks: z.string().trim().optional(),
});

export const replacementItemSchema = z.object({
  item_id: z.string().uuid({ message: 'Must be a valid item UUID.' }),
  replacement_quantity: z.number().int().positive({ message: 'Replacement quantity must be at least 1.' }),
  new_serial_number: z.string().trim().optional(),
  remarks: z.string().trim().optional(),
});

export const damageItemSchema = z.object({
  item_id: z.string().uuid({ message: 'Must be a valid item UUID.' }),
  damaged_quantity: z.number().int().positive({ message: 'Damaged quantity must be at least 1.' }),
  reason: z.string().trim().min(3, { message: 'Reason for damage report must be at least 3 characters.' }),
  damage_type: z.enum(['damaged', 'defective', 'scrap']).default('defective'),
  location: z.string().trim().optional(),
});

export const writeOffItemSchema = z.object({
  item_id: z.string().uuid({ message: 'Must be a valid item UUID.' }),
  writeoff_quantity: z.number().int().positive({ message: 'Write-off quantity must be at least 1.' }),
  reason: z.string().trim().min(5, { message: 'Write-off reason is mandatory and must be at least 5 characters.' }),
});

export const cancelRdcSchema = z.object({
  reason: z.string().trim().min(3, { message: 'Cancellation reason must be at least 3 characters.' }),
});

export const rdcFilterSchema = z.object({
  status: z.string().trim().optional(),
  rdc_type: z.enum(['RDC', 'NRDC', 'all']).optional(),
  plant_id: z.string().uuid().optional(),
  shop_id: z.string().uuid().optional(),
  vendor_id: z.string().uuid().optional(),
  priority: z.enum(['low', 'medium', 'high', 'emergency', 'all']).optional(),
  search: z.string().trim().optional(),
  start_date: z.string().trim().optional(),
  end_date: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  sort_by: z.enum(['created_at', 'challan_number', 'dispatch_date', 'expected_return_date', 'status', 'priority']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});
