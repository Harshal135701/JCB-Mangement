export interface Machine {
  id: string;
  shop_id: string;
  machine_code: string;
  name: string;
  category: string;
  oem_manufacturer: string;
  model_number?: string | null;
  serial_number?: string | null;
  bay_line_location?: string | null;
  bay_id?: string | null;
  production_line_id?: string | null;
  criticality: 'class_a' | 'class_b' | 'class_c' | string;
  status: string;
  operating_hours: number | string;
  maintenance_frequency_days?: number | string;
  qr_code_uid: string;
  manual_url?: string | null;
  electrical_diagram_url?: string | null;
  hydraulic_schematic_url?: string | null;
  sop_document_url?: string | null;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
  shop_name?: string | null;
  shop_code?: string | null;
  plant_id?: string | null;
  plant_name?: string | null;
  plant_code?: string | null;
  bay_name?: string | null;
  line_name?: string | null;
}

export interface Plant {
  id: string;
  plant_code: string;
  plant_name: string;
  status?: string;
}

export interface Shop {
  id: string;
  plant_id: string;
  shop_code: string;
  shop_name: string;
  status?: string;
}

export interface MachineMetrics {
  totalBreakdowns: number;
  totalWorkOrders: number;
  totalInspections: number;
  totalPmPlans: number;
  totalPartsConsumed: number;
  totalPurchaseRequisitions: number;
  totalRdcChallans: number;
  totalAuditLogs: number;
  totalDowntimeMinutes: number;
  activeRepairMinutes: number;
}

export interface MachineHistoryData {
  breakdowns: any[];
  workOrders: any[];
  inspections: any[];
  pmPlans: any[];
  partsConsumed: any[];
  purchaseRequisitions: any[];
  rdcChallans: any[];
  auditLogs: any[];
}

export interface MachineHistoryResponse {
  machine: {
    id: string;
    machine_code: string;
    name: string;
    status: string;
    operating_hours: string | number;
    shop_name?: string;
    plant_name?: string;
  };
  metrics: MachineMetrics;
  history: MachineHistoryData;
  pagination: {
    page: number;
    limit: number;
    total?: number;
    totalPages?: number;
    categories?: Record<string, any>;
  };
}

export interface MachineListFilter {
  search?: string;
  status?: string;
  criticality?: string;
  category?: string;
  plant_id?: string;
  shop_id?: string;
  exclude_decommissioned?: boolean;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  page: number;
  limit: number;
}
