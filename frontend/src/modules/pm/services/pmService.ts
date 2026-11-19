import apiClient from '../../../api/client';
import {
  PMPlan,
  PMCalendarMap,
  PMExecutionItem,
  PMExecutionDetail,
  PMDashboardData,
  PMComplianceData,
  PMTrendItem,
} from '../types';

/**
 * 1. PM Dashboard, Compliance & Trends
 */
export async function fetchPMDashboard(params?: Record<string, any>): Promise<PMDashboardData> {
  const res = await apiClient.get('/pm/dashboard', { params });
  return res.data?.data;
}

export async function fetchPMCompliance(params?: Record<string, any>): Promise<PMComplianceData> {
  const res = await apiClient.get('/pm/compliance', { params });
  return res.data?.data;
}

export async function fetchPMTrends(params?: Record<string, any>): Promise<PMTrendItem[]> {
  const res = await apiClient.get('/pm/trends', { params });
  return res.data?.data || [];
}

export async function fetchPMByMachine(params?: Record<string, any>): Promise<any[]> {
  const res = await apiClient.get('/pm/by-machine', { params });
  return res.data?.data || [];
}

/**
 * 2. PM Calendar & Schedule Queues
 */
export async function fetchPMCalendar(month?: string): Promise<{ month: string; data: PMCalendarMap }> {
  const params: Record<string, any> = {};
  if (month) params.month = month;
  const res = await apiClient.get('/pm/calendar', { params });
  return {
    month: res.data?.month || month || '',
    data: res.data?.data || {},
  };
}

export async function fetchPMSchedule(params?: Record<string, any>): Promise<{ data: any[]; pagination: any }> {
  const res = await apiClient.get('/pm/schedule', { params });
  return {
    data: res.data?.data || [],
    pagination: res.data?.pagination || { total: 0, page: 1, limit: 20 },
  };
}

export async function fetchPMUpcoming(windowDays: number = 30): Promise<any[]> {
  const res = await apiClient.get('/pm/upcoming', { params: { windowDays } });
  return res.data?.data || [];
}

export async function fetchPMDue(): Promise<any[]> {
  const res = await apiClient.get('/pm/due');
  return res.data?.data || [];
}

export async function fetchPMOverdue(): Promise<any[]> {
  const res = await apiClient.get('/pm/overdue');
  return res.data?.data || [];
}

/**
 * 3. PM Plan Management (CRUD & Lifecycle)
 */
export async function fetchPMPlans(params?: Record<string, any>): Promise<{ data: PMPlan[]; pagination: any }> {
  const res = await apiClient.get('/pm/plans', { params });
  return {
    data: res.data?.data || [],
    pagination: res.data?.pagination || { total: 0, page: 1, limit: 20 },
  };
}

export async function fetchPMPlanById(id: string): Promise<PMPlan> {
  const res = await apiClient.get(`/pm/plans/${id}`);
  return res.data?.data;
}

export async function createPMPlan(payload: {
  machine_id: string;
  title: string;
  frequency: string;
  interval_days?: number;
  grace_period_days?: number;
  operating_hour_threshold?: number | null;
  checklist_template?: any[];
}): Promise<any> {
  const res = await apiClient.post('/pm/plans', payload);
  return res.data;
}

export async function updatePMPlan(
  id: string,
  payload: {
    title?: string;
    frequency?: string;
    interval_days?: number;
    grace_period_days?: number;
    operating_hour_threshold?: number | null;
    checklist_template?: any[];
  }
): Promise<any> {
  const res = await apiClient.put(`/pm/plans/${id}`, payload);
  return res.data;
}

export async function activatePMPlan(id: string): Promise<any> {
  const res = await apiClient.patch(`/pm/plans/${id}/activate`);
  return res.data;
}

export async function deactivatePMPlan(id: string): Promise<any> {
  const res = await apiClient.patch(`/pm/plans/${id}/deactivate`);
  return res.data;
}

export async function reschedulePM(id: string, new_date: string, reason: string): Promise<any> {
  const res = await apiClient.patch(`/pm/plans/${id}/reschedule`, { new_date, reason });
  return res.data;
}

export async function deferPM(id: string, days: number, reason: string): Promise<any> {
  const res = await apiClient.post(`/pm/plans/${id}/defer`, { days, reason });
  return res.data;
}

export async function skipPM(id: string, reason: string): Promise<any> {
  const res = await apiClient.post(`/pm/plans/${id}/skip`, { reason });
  return res.data;
}

export async function triggerGenerateDuePM(window_days: number = 3): Promise<any> {
  const res = await apiClient.post('/pm/generate-due', { window_days });
  return res.data;
}

/**
 * 4. PM Execution & Verification
 */
export async function fetchPMExecutions(params?: Record<string, any>): Promise<{ data: PMExecutionItem[]; pagination: any }> {
  const res = await apiClient.get('/pm/executions', { params });
  return {
    data: res.data?.data || [],
    pagination: res.data?.pagination || { total: 0, page: 1, limit: 20 },
  };
}

export async function fetchPMExecutionDetails(id: string): Promise<PMExecutionDetail> {
  const res = await apiClient.get(`/pm/executions/${id}`);
  return res.data?.data;
}

export async function fetchPMExecutionChecklist(id: string): Promise<any> {
  const res = await apiClient.get(`/pm/executions/${id}/checklist`);
  return res.data;
}

export async function submitPMExecutionChecklist(
  id: string,
  responses: any[],
  overall_status: 'pass' | 'fail' = 'pass'
): Promise<any> {
  const res = await apiClient.post(`/pm/executions/${id}/checklist`, { responses, overall_status });
  return res.data;
}

export async function completePMExecution(
  id: string,
  payload: {
    work_performed: string;
    technician_remarks?: string;
    parts_used?: Array<{ part_id: string; quantity: number }>;
  }
): Promise<any> {
  const res = await apiClient.post(`/pm/executions/${id}/complete`, payload);
  return res.data;
}

export async function verifyPMExecution(
  id: string,
  payload: {
    status: 'APPROVED' | 'REJECTED';
    verification_remarks?: string;
  }
): Promise<any> {
  const res = await apiClient.post(`/pm/executions/${id}/verify`, payload);
  return res.data;
}

export async function fetchMachinePMHistory(machineId: string): Promise<any[]> {
  const res = await apiClient.get(`/pm/machines/${machineId}/history`);
  return res.data?.data || [];
}

/**
 * 5. Plan-Based PM Execution for Technicians
 */
export async function fetchPMPlanEligibleMachines(planId: string): Promise<{
  plan: PMPlan;
  eligible_machines: any[];
  total_eligible: number;
}> {
  const res = await apiClient.get(`/pm/plans/${planId}/eligible-machines`);
  return res.data?.data;
}

export async function executePMPlanService(
  planId: string,
  payload: {
    machine_id: string;
    checklist_responses: any[];
    overall_status?: 'pass' | 'fail';
    work_performed: string;
    technician_remarks?: string;
    parts_used?: Array<{ part_id: string; quantity: number }>;
  }
): Promise<any> {
  const res = await apiClient.post(`/pm/plans/${planId}/execute`, payload);
  return res.data;
}

export async function startPMExecutionService(
  planId: string,
  machine_id: string
): Promise<any> {
  const res = await apiClient.post(`/pm/plans/${planId}/start`, { machine_id });
  return res.data;
}
