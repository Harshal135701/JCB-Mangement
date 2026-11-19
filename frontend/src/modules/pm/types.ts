export type PMFrequency =
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'semiannual'
  | 'annual';

export type PMScheduleStatus = 'upcoming' | 'due' | 'overdue';

export interface PMPlanChecklistItem {
  id?: string;
  step?: number;
  task: string;
  type?: 'boolean' | 'number' | 'text';
  unit?: string;
  min?: number;
  max?: number;
  required?: boolean;
}

export interface PMPlan {
  id: string;
  plan_code: string;
  machine_id: string;
  machine_code?: string;
  machine_name?: string;
  machine_criticality?: string;
  machine_status?: string;
  current_machine_hours?: number;
  shop_id?: string;
  shop_name?: string;
  plant_id?: string;
  plant_name?: string;
  title: string;
  frequency: PMFrequency;
  interval_days: number;
  grace_period_days: number;
  operating_hour_threshold?: number | null;
  checklist_template: PMPlanChecklistItem[] | string[];
  is_active: boolean;
  next_pm_date?: string;
  schedule_status?: PMScheduleStatus;
  eligible_machine_count?: number;
  latest_execution_status?: string | null;
  eligible_machines?: any[];
  created_at: string;
  updated_at?: string;
  statistics?: {
    total_work_orders: number;
    completed_work_orders: number;
    open_work_orders: number;
  };
}

export interface PMCalendarItem {
  id: string;
  plan_code: string;
  title: string;
  frequency: string;
  next_pm_date: string;
  grace_period_days: number;
  machine_id: string;
  machine_code: string;
  machine_name: string;
  criticality: string;
  shop_name: string;
  plant_name: string;
  schedule_status: PMScheduleStatus;
}

export type PMCalendarMap = Record<string, PMCalendarItem[]>;

export interface PMExecutionItem {
  execution_id: string;
  wo_number: string;
  status: string;
  priority: string;
  work_instructions?: string;
  repair_completed_time?: string | null;
  manager_verified_time?: string | null;
  active_repair_minutes?: number;
  total_downtime_minutes?: number;
  technician_remarks?: string | null;
  manager_verification_remarks?: string | null;
  created_at: string;
  machine_id: string;
  machine_code: string;
  machine_name: string;
  shop_name: string;
  plant_name: string;
  assigned_technician_name?: string | null;
  assigned_manager_name?: string | null;
  diagnosis?: any;
}

export interface PMExecutionDetail extends PMExecutionItem {
  timeline_events?: Array<{
    id: string;
    event_type: string;
    performed_by_name?: string;
    performed_by_role?: string;
    notes?: string;
    timestamp: string;
  }>;
  parts_consumed?: Array<{
    id: string;
    part_id: string;
    part_number: string;
    part_name: string;
    quantity_installed: number;
    unit_cost?: number;
  }>;
}

export interface PMDashboardData {
  kpis: {
    total_active_plans: number;
    upcoming_count: number;
    due_count: number;
    overdue_count: number;
    active_pm_work_orders: number;
    completed_pm_activities: number;
    pending_verification_count: number;
    pm_compliance_percentage: number;
    on_time_completion_percentage: number;
  };
  definitions: {
    compliance_formula: string;
    on_time_formula: string;
  };
}

export interface PMComplianceData {
  overall_compliance_percentage: number;
  on_time_completion_percentage: number;
  overdue_count: number;
  due_count: number;
  completed_count: number;
  by_plant: any[];
  by_shop: any[];
  formula: string;
}

export interface PMTrendItem {
  month: string;
  scheduled_generated: number;
  completed: number;
  compliance_rate: number;
}
