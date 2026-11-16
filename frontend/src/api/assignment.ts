import apiClient from './client';

export type AssignmentStatus =
  | 'unassigned'
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'reassigned'
  | 'withdrawn';

export type AssignmentMethod = 'AUTOMATIC' | 'MANUAL';

export interface BreakdownAssignment {
  id: string;
  breakdown_id: string;
  technician_id: string;
  technician_name?: string;
  technician_code?: string;
  technician_email?: string;
  technician_phone?: string;
  technician_skills?: string[];
  assigned_by?: string | null;
  assigned_by_name?: string | null;
  assignment_method: AssignmentMethod;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'REASSIGNED' | 'WITHDRAWN';
  attempt_number: number;
  rejection_reason?: string | null;
  reassignment_reason?: string | null;
  assigned_at: string;
  responded_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface BreakdownAssignmentDetails {
  breakdown_id: string;
  complaint_number: string;
  assignment_status: string;
  assigned_technician_id: string | null;
  current_assignment: BreakdownAssignment | null;
}

export interface EligibleTechnician {
  id: string;
  employee_code: string;
  full_name: string;
  email: string;
  role: string;
  skills_json?: string[] | null;
  active_assignments: number;
  max_active_assignments: number;
  is_available: boolean;
  is_active: boolean;
  previously_rejected?: boolean;
}

export interface EligibleTechniciansResponse {
  strategy: string;
  recommended_technician_id: string | null;
  technicians: EligibleTechnician[];
}

export interface RejectionResult {
  success: boolean;
  rejected: boolean;
  reassigned: boolean;
  message: string;
  data: {
    rejected_assignment: BreakdownAssignment;
    new_assignment?: BreakdownAssignment;
  };
}

/**
 * Get current assignment details for a breakdown
 */
export async function getBreakdownAssignment(
  breakdownId: string
): Promise<BreakdownAssignmentDetails> {
  const res = await apiClient.get<{ success: boolean; data: BreakdownAssignmentDetails }>(
    `/breakdowns/${breakdownId}/assignment`
  );
  return res.data.data;
}

/**
 * Get full chronological attempt history for a breakdown
 */
export async function getBreakdownAssignmentHistory(
  breakdownId: string
): Promise<BreakdownAssignment[]> {
  const res = await apiClient.get<{ success: boolean; data: BreakdownAssignment[] }>(
    `/breakdowns/${breakdownId}/assignment/history`
  );
  return res.data.data || [];
}

/**
 * Get eligible candidate technicians and workload scores for a breakdown
 */
export async function getEligibleTechnicians(
  breakdownId: string
): Promise<EligibleTechniciansResponse> {
  const res = await apiClient.get<{ success: boolean; data: EligibleTechniciansResponse }>(
    `/breakdowns/${breakdownId}/assignment/eligible-technicians`
  );
  return res.data.data;
}

/**
 * Technician accepts pending breakdown assignment
 */
export async function acceptBreakdownAssignment(
  breakdownId: string,
  notes?: string
): Promise<{ success: boolean; message: string; data: any }> {
  const res = await apiClient.post(`/breakdowns/${breakdownId}/assignment/accept`, {
    notes,
  });
  return res.data;
}

/**
 * Technician rejects pending breakdown assignment with mandatory reason
 */
export async function rejectBreakdownAssignment(
  breakdownId: string,
  reason: string
): Promise<RejectionResult> {
  const res = await apiClient.post<RejectionResult>(
    `/breakdowns/${breakdownId}/assignment/reject`,
    {
      reason: reason.trim(),
    }
  );
  return res.data;
}

/**
 * Manager manually assigns an unassigned breakdown to a technician
 */
export async function manualAssignTechnician(
  breakdownId: string,
  technicianId: string,
  notes?: string
): Promise<{ success: boolean; message: string; data: any }> {
  const res = await apiClient.post(`/breakdowns/${breakdownId}/assignment/manual-assign`, {
    technician_id: technicianId,
    notes,
  });
  return res.data;
}

/**
 * Manager manually reassigns an already assigned breakdown to a new technician
 */
export async function manualReassignTechnician(
  breakdownId: string,
  newTechnicianId: string,
  reason: string
): Promise<{ success: boolean; message: string; data: any }> {
  const res = await apiClient.post(`/breakdowns/${breakdownId}/assignment/manual-reassign`, {
    new_technician_id: newTechnicianId,
    technician_id: newTechnicianId,
    reason: reason.trim(),
  });
  return res.data;
}
