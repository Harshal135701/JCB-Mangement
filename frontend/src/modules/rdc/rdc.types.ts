export type RdcType = 'RDC' | 'NRDC';

export type RdcStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'dispatched'
  | 'partially_returned'
  | 'fully_returned'
  | 'rejected'
  | 'cancelled'
  | 'closed';

export type RdcPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface RdcItem {
  id: string;
  rdc_id: string;
  part_id?: string | null;
  item_description: string;
  serial_number?: string | null;
  quantity_dispatched: number;
  quantity_returned: number;
  quantity_replacement: number;
  quantity_damaged: number;
  quantity_written_off: number;
  unit_cost?: number | null;
  remarks?: string | null;
  disposition?: string | null;
  approximate_value?: number | null;
  outstanding_quantity?: number;
}

export interface RdcChallan {
  id: string;
  challan_number: string;
  rdc_type: RdcType;
  plant_id?: string | null;
  plant_name?: string | null;
  shop_id?: string | null;
  shop_name?: string | null;
  work_order_id?: string | null;
  machine_id?: string | null;
  machine_code?: string | null;
  machine_name?: string | null;
  vendor_id?: string | null;
  vendor_party_name: string;
  vendor_gstin?: string | null;
  vendor_address?: string | null;
  contact_person?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  purpose: string;
  priority: RdcPriority;
  approximate_value?: number | null;
  expected_return_date?: string | null;
  actual_return_date?: string | null;
  gate_pass_number?: string | null;
  status: RdcStatus;
  created_by: string;
  created_by_name?: string;
  created_by_code?: string;
  created_at: string;
  approved_by?: string | null;
  approved_by_name?: string | null;
  approved_at?: string | null;
  dispatched_by?: string | null;
  dispatched_by_name?: string | null;
  dispatched_at?: string | null;
  vehicle_number?: string | null;
  transporter_name?: string | null;
  document_reference?: string | null;
  submission_notes?: string | null;
  rejection_reason?: string | null;
  rejected_by?: string | null;
  rejected_at?: string | null;
  cancellation_reason?: string | null;
  cancelled_by?: string | null;
  cancelled_at?: string | null;
  closed_by?: string | null;
  closed_at?: string | null;
  items?: RdcItem[];
  days_overdue?: number;
}

export interface RdcDashboardMetrics {
  total_rdc: number;
  total_nrdc: number;
  pending_approval: number;
  approved: number;
  dispatched: number;
  partially_returned: number;
  fully_returned: number;
  closed: number;
  cancelled: number;
  overdue_returns: number;
  total_outstanding_quantity: number;
}

export interface RdcAuditLog {
  id: string;
  rdc_id: string;
  action: string;
  performed_by: string;
  actor_name?: string;
  actor_email?: string;
  old_state?: any;
  new_state?: any;
  created_at: string;
}

export interface OverdueRdcItem {
  id: string;
  part_id?: string | null;
  item_description: string;
  serial_number?: string | null;
  quantity_dispatched: number;
  quantity_returned: number;
  quantity_replacement: number;
  quantity_damaged: number;
  quantity_written_off: number;
  outstanding_quantity: number;
}

export interface OverdueRdc {
  id: string;
  challan_number: string;
  rdc_type: RdcType;
  plant_id?: string | null;
  plant_name?: string | null;
  shop_name?: string | null;
  vendor_party_name: string;
  contact_person?: string | null;
  contact_phone?: string | null;
  purpose: string;
  expected_return_date: string;
  gate_pass_number?: string | null;
  status: RdcStatus;
  created_by_name?: string;
  days_overdue: number;
  items: OverdueRdcItem[];
}
