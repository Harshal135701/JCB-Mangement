import { PRStatus, PRUrgency } from './ProcurementPage';

// ============================================================================
// VENDOR / SUPPLIER TYPES
// ============================================================================

export interface VendorRecord {
  id: string;
  vendor_code: string;
  name: string;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  gstin?: string | null;
  payment_terms?: string | null;
  status: 'active' | 'inactive';
  plant_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface VendorPerformance {
  vendor_name: string;
  total_orders: number;
  parts_supplied_count: number;
  active_orders: number;
  fulfilled_orders: number;
  total_spend: number;
  on_time_delivery_rate: number;
  // Optional linkage if backend vendors table entry exists
  vendor_code?: string;
  id?: string;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  gstin?: string | null;
  payment_terms?: string | null;
  status?: string;
}

export interface CreateVendorInput {
  vendor_code: string;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  gstin?: string;
  payment_terms?: string;
  plant_id?: string;
}

export interface UpdateVendorInput {
  name?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  gstin?: string;
  payment_terms?: string;
  status?: 'active' | 'inactive';
}

// ============================================================================
// PURCHASE ORDER TYPES
// ============================================================================

export interface PurchaseOrderItem {
  id: string; // Associated PR ID
  po_number: string;
  pr_number: string;
  supplier_name: string;
  unit_price: number | string;
  total_order_value: number | string;
  total_order_cost?: number | string;
  quantity_required: number;
  received_quantity: number;
  remaining_quantity?: number;
  expected_delivery_date?: string | null;
  received_date?: string | null;
  status: PRStatus;
  urgency: PRUrgency | string;
  created_at: string;
  updated_at: string;
  sku?: string;
  part_number: string;
  part_name: string;
  uom?: string;
  bin_location?: string;
  requested_by_name?: string | null;
  approved_by_name?: string | null;
  machine_code?: string | null;
  shop_name?: string | null;
  plant_name?: string | null;
  plant_id?: string | null;
  is_overdue?: boolean;
  days_overdue?: number;

  // Logistics & Inwarding Fields
  supply_method?: string | null;
  delivery_document_type?: string | null;
  challan_type?: string | null;
  vendor_challan_number?: string | null;
  expected_dispatch_date?: string | null;
  dispatch_location?: string | null;
  destination_plant_name?: string | null;
  transport_mode?: string | null;
  transporter_name?: string | null;
  vehicle_number?: string | null;
  lr_tracking_number?: string | null;
  freight_cost?: number | string | null;
  overall_shipment_cost?: number | string | null;
  delivery_remarks?: string | null;
}

export interface PurchaseOrderFilterParams {
  status?: string;
  supplier_name?: string;
  is_overdue?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PurchaseOrderPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
