/**
 * JCB Smart Machine Maintenance Management System (CMMS)
 * Operator Machine Selection & Manager Approval Workflow Types
 */

export type AssignmentStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'released'
  | 'cancelled';

export type AssignmentType = 'permanent' | 'temporary' | 'shift';

export type MachineAvailabilityStatus =
  | 'available'
  | 'occupied'
  | 'pending'
  | 'maintenance'
  | 'breakdown'
  | 'inactive';

export interface OperatorMachineAssignment {
  id: string;
  operator_id: string;
  machine_id: string;
  shop_id: string;
  plant_id: string;
  shift: string;
  status: AssignmentStatus;
  assignment_type: AssignmentType;
  replacement_for_machine_id?: string | null;
  breakdown_id?: string | null;
  approved_by?: string | null;
  approved_at?: Date | string | null;
  rejected_by?: string | null;
  rejected_at?: Date | string | null;
  rejection_reason?: string | null;
  signed_in_at?: Date | string | null;
  signed_out_at?: Date | string | null;
  notes?: string | null;
  created_at: Date | string;
  updated_at: Date | string;

  // Joined metadata
  operator_name?: string | null;
  operator_code?: string | null;
  operator_email?: string | null;
  operator_shift?: string | null;

  machine_code?: string | null;
  machine_name?: string | null;
  machine_category?: string | null;
  machine_status?: string | null;
  operating_hours?: number | string | null;
  bay_line_location?: string | null;

  shop_name?: string | null;
  shop_code?: string | null;
  plant_name?: string | null;
  plant_code?: string | null;

  approver_name?: string | null;
  approver_code?: string | null;

  // Replacement / breakdown context
  replacement_for_machine_code?: string | null;
  replacement_for_machine_name?: string | null;
  breakdown_complaint_number?: string | null;
  breakdown_problem_title?: string | null;
  breakdown_status?: string | null;

  // Permanent machine reference for the operator
  permanent_machine_id?: string | null;
  permanent_machine_code?: string | null;
  permanent_machine_name?: string | null;
  permanent_machine_status?: string | null;
  permanent_machine_location?: string | null;
}

export interface MachineAvailabilityItem {
  id: string;
  machine_code: string;
  name: string;
  category: string;
  status: string; // machine physical lifecycle status (running, idle, breakdown, under_maintenance)
  criticality: string;
  operating_hours: number | string;
  bay_line_location: string | null;
  shop_id: string;
  shop_name: string;
  plant_id: string;
  plant_name: string;

  // Computed availability for operator sign-in
  assignment_status: MachineAvailabilityStatus;
  is_selectable: boolean;
  unavailability_reason?: string | null;

  current_operator?: {
    id: string;
    full_name: string;
    employee_code: string;
  } | null;

  pending_operator?: {
    id: string;
    full_name: string;
    employee_code: string;
  } | null;
}

export interface RequestSignInInput {
  machine_id: string;
  shop_id: string;
  plant_id: string;
  shift?: string;
  notes?: string;
  assignment_type?: AssignmentType;
  replacement_for_machine_id?: string;
  breakdown_id?: string;
}

export interface RejectSignInInput {
  rejection_reason?: string;
}

export interface PermanentMachineInfo {
  id: string;
  machine_code: string;
  name: string;
  status: string;
  bay_line_location?: string | null;
  operating_hours?: number | string | null;
  category?: string | null;
  shop_id?: string | null;
  shop_name?: string | null;
  plant_id?: string | null;
  plant_name?: string | null;
  active_breakdown?: {
    id: string;
    complaint_number: string;
    problem_title: string;
    status: string;
    priority: string;
    reported_at: string | Date;
  } | null;
}

export interface GetOperatorCurrentAssignmentResult {
  permanentMachine: PermanentMachineInfo | null;
  currentAssignment: OperatorMachineAssignment | null;
  recentRejected: OperatorMachineAssignment | null;
  canRequestTemporary: boolean;
}
