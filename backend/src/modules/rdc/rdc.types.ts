export type RdcType = 'RDC' | 'NRDC';

export type RdcStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'dispatched'
  | 'partially_returned'
  | 'fully_returned'
  | 'closed'
  | 'cancelled'
  | 'overdue';

export type RdcPriority = 'low' | 'medium' | 'high' | 'emergency';

export interface RdcItemInput {
  part_id?: string | null;
  item_description: string;
  serial_number?: string | null;
  quantity_dispatched: number;
  unit_cost?: number;
  approximate_value?: number;
  remarks?: string | null;
}

export interface CreateRdcInput {
  rdc_type?: RdcType;
  plant_id?: string | null;
  shop_id?: string | null;
  work_order_id?: string | null;
  machine_id?: string | null;
  vendor_id?: string | null;
  vendor_party_name?: string;
  vendor_name?: string;
  vendor_gstin?: string | null;
  vendor_address?: string | null;
  contact_person?: string | null;
  purpose: string;
  priority?: RdcPriority;
  dispatch_date?: string | null;
  expected_return_date?: string | null;
  document_reference?: string | null;
  items: RdcItemInput[];
  save_as_draft?: boolean;
}

export interface UpdateRdcInput {
  plant_id?: string | null;
  shop_id?: string | null;
  work_order_id?: string | null;
  machine_id?: string | null;
  vendor_id?: string | null;
  vendor_party_name?: string;
  vendor_gstin?: string | null;
  vendor_address?: string | null;
  contact_person?: string | null;
  purpose?: string;
  priority?: RdcPriority;
  expected_return_date?: string | null;
  document_reference?: string | null;
  items?: RdcItemInput[];
}

export interface SubmitRdcInput {
  notes?: string;
}

export interface ApproveRdcInput {
  remarks?: string;
}

export interface RejectRdcInput {
  rejection_reason: string;
}

export interface DispatchRdcInput {
  gate_pass_number?: string;
  vehicle_number?: string;
  transporter_name?: string;
  dispatch_notes?: string;
}

export interface RecordReturnInput {
  item_id: string;
  returned_quantity: number;
  remarks?: string;
}

export interface RecordReplacementInput {
  item_id: string;
  replacement_quantity: number;
  new_serial_number?: string;
  remarks?: string;
}

export interface RecordDamageInput {
  item_id: string;
  damaged_quantity: number;
  reason: string;
  damage_type?: 'damaged' | 'defective' | 'scrap';
  location?: string;
}

export interface WriteOffInput {
  item_id: string;
  writeoff_quantity: number;
  reason: string;
}

export interface CancelRdcInput {
  reason: string;
}

export interface RdcFilterQuery {
  status?: string;
  rdc_type?: string;
  plant_id?: string;
  shop_id?: string;
  vendor_id?: string;
  priority?: string;
  search?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface RdcItemRecord {
  id: string;
  rdc_id: string;
  part_id: string | null;
  part_number?: string | null;
  part_name?: string | null;
  item_description: string;
  serial_number: string | null;
  quantity_dispatched: number;
  quantity_returned: number;
  quantity_replacement: number;
  quantity_damaged: number;
  quantity_written_off: number;
  unit_cost: number;
  approximate_value: number;
  remarks: string | null;
  disposition: string;
  created_at: string | Date;
}

export interface RdcChallanRecord {
  id: string;
  challan_number: string;
  rdc_type: RdcType;
  plant_id: string | null;
  plant_name?: string | null;
  shop_id: string | null;
  shop_name?: string | null;
  work_order_id: string | null;
  wo_number?: string | null;
  machine_id: string | null;
  machine_code?: string | null;
  machine_name?: string | null;
  vendor_id: string | null;
  vendor_party_name: string;
  vendor_gstin: string | null;
  vendor_address: string | null;
  contact_person: string | null;
  purpose: string;
  priority: RdcPriority;
  approximate_value: number;
  dispatch_date: string | Date;
  expected_return_date: string | Date | null;
  actual_return_date: string | Date | null;
  status: RdcStatus;
  gate_pass_number: string | null;
  vehicle_number: string | null;
  transporter_name: string | null;
  document_reference: string | null;
  created_by: string;
  created_by_name?: string | null;
  approved_by: string | null;
  approved_by_name?: string | null;
  approved_at?: string | Date | null;
  dispatched_by: string | null;
  dispatched_by_name?: string | null;
  dispatched_at: string | Date | null;
  rejected_by: string | null;
  rejected_by_name?: string | null;
  rejected_at: string | Date | null;
  rejection_reason: string | null;
  cancelled_by: string | null;
  cancelled_at: string | Date | null;
  cancellation_reason: string | null;
  closed_by: string | null;
  closed_at: string | Date | null;
  submission_notes: string | null;
  created_at: string | Date;
  updated_at: string | Date;
  items?: RdcItemRecord[];
}

export interface RdcDashboardMetrics {
  total_rdc: number;
  total_nrdc: number;
  pending_approval: number;
  approved_not_dispatched: number;
  currently_dispatched: number;
  partially_returned: number;
  fully_returned: number;
  closed: number;
  cancelled: number;
  overdue_returns: number;
  total_outstanding_quantity: number;
  total_outstanding_value: number;
  recent_challans: RdcChallanRecord[];
}
