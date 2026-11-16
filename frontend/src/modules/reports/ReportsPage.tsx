import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  FileText,
  Download,
  Calendar,
  RefreshCw,
  Wrench,
  ClipboardCheck,
  Boxes,
  ShieldCheck,
  AlertTriangle,
  UserCheck,
  HardHat,
  Clock,
  CheckCircle2,
  XCircle,
  Filter,
  BarChart3,
  Layers,
} from 'lucide-react';
import {
  fetchUsersByRole,
  fetchTechnicianReportData,
  fetchOperatorReportData,
  fetchManagerReportData,
  fetchStoreManagerReportData,
  fetchAdminReportData,
  UserSummary,
} from './services/reportService';
import { generateReportPDF, PDFReportSection, PDFReportMetric } from './utils/generateReportPDF';
import { ReportSummaryCards, ReportCardItem } from './components/ReportSummaryCards';
import { ReportUserSelector } from './components/ReportUserSelector';

export const ReportsPage: React.FC = () => {
  const { user } = useAuth();
  const userRole = (user?.role || 'technician').toLowerCase();

  // State: Date Range Filter
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // State: Tab Selection (For Manager and Admin roles)
  const [activeTab, setActiveTab] = useState<string>('');

  // State: Users Directory for Selection
  const [availableUsers, setAvailableUsers] = useState<UserSummary[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // State: Report Data & Status
  const [reportData, setReportData] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Set default tab based on user role
  useEffect(() => {
    if (userRole === 'manager') {
      setActiveTab('technicians');
    } else if (userRole === 'admin') {
      setActiveTab('enterprise');
    }
  }, [userRole]);

  // Load User Directory when tab changes for Manager or Admin
  useEffect(() => {
    const loadDirectory = async () => {
      setSelectedUser(null);
      setReportData(null);
      setErrorMsg(null);

      if (userRole === 'manager') {
        if (activeTab === 'technicians') {
          setIsLoadingUsers(true);
          const list = await fetchUsersByRole('technician');
          setAvailableUsers(list);
          setIsLoadingUsers(false);
          if (list.length > 0) setSelectedUser(list[0]);
        } else if (activeTab === 'operators') {
          setIsLoadingUsers(true);
          const list = await fetchUsersByRole('operator');
          setAvailableUsers(list);
          setIsLoadingUsers(false);
          if (list.length > 0) setSelectedUser(list[0]);
        }
      } else if (userRole === 'admin') {
        let roleToFetch = '';
        if (activeTab === 'managers') roleToFetch = 'manager';
        else if (activeTab === 'store_managers') roleToFetch = 'store_manager';
        else if (activeTab === 'technicians') roleToFetch = 'technician';
        else if (activeTab === 'operators') roleToFetch = 'operator';

        if (roleToFetch) {
          setIsLoadingUsers(true);
          const list = await fetchUsersByRole(roleToFetch);
          setAvailableUsers(list);
          setIsLoadingUsers(false);
          if (list.length > 0) setSelectedUser(list[0]);
        }
      }
    };

    loadDirectory();
  }, [userRole, activeTab]);

  // Main Report Data Fetcher
  const handleGenerateReport = useCallback(async () => {
    if (!user) return;
    setIsGenerating(true);
    setErrorMsg(null);

    try {
      if (userRole === 'technician') {
        const data = await fetchTechnicianReportData(user.id, startDate, endDate);
        setReportData(data);
      } else if (userRole === 'operator') {
        const data = await fetchOperatorReportData(user.id, startDate, endDate);
        setReportData(data);
      } else if (userRole === 'store_manager') {
        const data = await fetchStoreManagerReportData(user.id, startDate, endDate);
        setReportData(data);
      } else if (userRole === 'manager') {
        if (activeTab === 'my_report') {
          const data = await fetchManagerReportData(user.id, startDate, endDate);
          setReportData(data);
        } else if (activeTab === 'technicians') {
          if (!selectedUser) {
            setErrorMsg('Please select a technician first.');
            setIsGenerating(false);
            return;
          }
          const data = await fetchTechnicianReportData(selectedUser.id, startDate, endDate);
          setReportData(data);
        } else if (activeTab === 'operators') {
          if (!selectedUser) {
            setErrorMsg('Please select an operator first.');
            setIsGenerating(false);
            return;
          }
          const data = await fetchOperatorReportData(selectedUser.id, startDate, endDate);
          setReportData(data);
        }
      } else if (userRole === 'admin') {
        if (activeTab === 'enterprise') {
          const data = await fetchAdminReportData(user.id, startDate, endDate);
          setReportData(data);
        } else if (activeTab === 'technicians') {
          if (!selectedUser) {
            setErrorMsg('Please select a technician first.');
            setIsGenerating(false);
            return;
          }
          const data = await fetchTechnicianReportData(selectedUser.id, startDate, endDate);
          setReportData(data);
        } else if (activeTab === 'operators') {
          if (!selectedUser) {
            setErrorMsg('Please select an operator first.');
            setIsGenerating(false);
            return;
          }
          const data = await fetchOperatorReportData(selectedUser.id, startDate, endDate);
          setReportData(data);
        } else if (activeTab === 'managers') {
          if (!selectedUser) {
            setErrorMsg('Please select a manager first.');
            setIsGenerating(false);
            return;
          }
          const data = await fetchManagerReportData(selectedUser.id, startDate, endDate);
          setReportData(data);
        } else if (activeTab === 'store_managers') {
          if (!selectedUser) {
            setErrorMsg('Please select a store manager first.');
            setIsGenerating(false);
            return;
          }
          const data = await fetchStoreManagerReportData(selectedUser.id, startDate, endDate);
          setReportData(data);
        }
      }
    } catch (err: any) {
      console.error('Failed to generate report:', err);
      setErrorMsg(err?.response?.data?.message || err?.message || 'Failed to generate report.');
    } finally {
      setIsGenerating(false);
    }
  }, [user, userRole, activeTab, selectedUser, startDate, endDate]);

  // Auto-generate report on initial mount or when selectedUser changes
  useEffect(() => {
    if (userRole === 'technician' || userRole === 'operator' || userRole === 'store_manager') {
      handleGenerateReport();
    } else if (
      (userRole === 'manager' || userRole === 'admin') &&
      (activeTab === 'my_report' || activeTab === 'enterprise' || selectedUser)
    ) {
      handleGenerateReport();
    }
  }, [userRole, activeTab, selectedUser, handleGenerateReport]);

  // Export to PDF
  const handleDownloadPDF = () => {
    if (!reportData) return;
    setIsDownloading(true);

    try {
      // Determine target user
      let targetInfo = {
        name: user?.fullName || (user as any)?.name || user?.email || 'Authenticated Personnel',
        employeeCode: user?.employeeCode || (user as any)?.employee_code,
        designation: user?.designation || (user as any)?.designation || userRole.toUpperCase(),
        plantName: user?.plantName || 'JCB Ballabgarh Works',
        shopName: user?.shopName || (user as any)?.shop_name || 'All Facilities',
        email: user?.email,
      };

      let reportTitle = 'Activity & Operational Report';
      let reportRole = userRole;
      let metrics: PDFReportMetric[] = [];
      let sections: PDFReportSection[] = [];

      // Determine subject if selectedUser is active
      const isViewingOther =
        (userRole === 'manager' || userRole === 'admin') &&
        ['technicians', 'operators', 'managers', 'store_managers'].includes(activeTab) &&
        selectedUser;

      if (isViewingOther && selectedUser) {
        targetInfo = {
          name: selectedUser.full_name,
          employeeCode: selectedUser.employee_code,
          designation: selectedUser.designation || selectedUser.role.toUpperCase(),
          plantName: user?.plantName || 'JCB Ballabgarh Works',
          shopName: (selectedUser as any).shop_name || 'All Shops',
          email: selectedUser.email,
        };
        reportRole = selectedUser.role;
      }

      // 1. TECHNICIAN REPORT EXPORT
      if (
        userRole === 'technician' ||
        ((userRole === 'manager' || userRole === 'admin') && activeTab === 'technicians')
      ) {
        reportTitle = 'Technician Performance & Work Order Activity Report';
        const stats = reportData.stats || {};
        metrics = [
          { label: 'Total Assigned', value: stats.totalAssigned || 0 },
          { label: 'In Progress', value: stats.acceptedOrInProgress || 0, highlight: true },
          { label: 'Waiting Parts', value: stats.waitingForParts || 0 },
          { label: 'Awaiting Verify', value: stats.awaitingVerification || 0 },
          { label: 'Completed', value: stats.verifiedAndClosed || 0 },
          { label: 'Total Downtime', value: `${stats.totalDowntimeHours || 0} hrs` },
        ];

        // Section: Work Orders
        const woRows = (reportData.workOrders || []).map((w: any) => [
          w.wo_number || 'N/A',
          w.machine_code || 'N/A',
          w.problem_title || w.diagnosis || 'Maintenance Action',
          w.status || 'ASSIGNED',
          w.priority || 'MEDIUM',
          `${w.actual_downtime_minutes || 0} mins`,
          w.created_at ? new Date(w.created_at).toLocaleDateString() : 'N/A',
        ]);

        sections.push({
          title: 'Assigned Work Orders & Repair Details',
          tableHead: ['WO Number', 'Machine', 'Diagnosis / Task', 'Status', 'Priority', 'Downtime', 'Date'],
          tableRows: woRows,
          emptyText: 'No work orders recorded for this technician during the selected period.',
        });

        // Section: Breakdowns Handled
        if (reportData.breakdowns && reportData.breakdowns.length > 0) {
          const bdRows = reportData.breakdowns.map((b: any) => [
            b.ticket_number || 'N/A',
            b.machine_code || 'N/A',
            b.problem_title || 'N/A',
            b.priority || 'MEDIUM',
            b.status || 'N/A',
            b.created_at ? new Date(b.created_at).toLocaleDateString() : 'N/A',
          ]);
          sections.push({
            title: 'Breakdown Complaints Handled',
            tableHead: ['Ticket #', 'Machine', 'Problem Description', 'Priority', 'Status', 'Logged Date'],
            tableRows: bdRows,
          });
        }
      }
      // 2. OPERATOR REPORT EXPORT
      else if (
        userRole === 'operator' ||
        ((userRole === 'manager' || userRole === 'admin') && activeTab === 'operators')
      ) {
        reportTitle = 'Operator Shift Safety & Inspection Compliance Report';
        const stats = reportData.stats || {};
        metrics = [
          { label: 'Inspections Done', value: stats.totalInspections || 0 },
          { label: 'Passed Checks', value: stats.passed || 0 },
          { label: 'Failed Checks', value: stats.failed || 0, highlight: true },
          { label: 'Attention Req.', value: stats.requiringAttention || 0 },
          { label: 'Breakdowns Logged', value: stats.breakdownsReported || 0 },
          { label: 'Machines Operated', value: stats.machinesOperatedCount || 0 },
        ];

        // Section: Inspections
        const inspRows = (reportData.inspections || []).map((i: any) => [
          i.created_at ? new Date(i.created_at).toLocaleDateString() : 'N/A',
          i.machine_code || 'N/A',
          i.shift || 'General',
          i.overall_status || 'PASS',
          i.notes || (i.responses_json ? `${i.responses_json.length} items verified` : 'Complete'),
        ]);

        sections.push({
          title: 'Pre-Shift Machine Inspections Log',
          tableHead: ['Date', 'Machine Code', 'Shift', 'Result', 'Inspection Findings / Notes'],
          tableRows: inspRows,
          emptyText: 'No pre-shift safety inspections recorded for this operator.',
        });

        // Section: Breakdowns Reported
        if (reportData.breakdowns && reportData.breakdowns.length > 0) {
          const bdRows = reportData.breakdowns.map((b: any) => [
            b.ticket_number || 'N/A',
            b.machine_code || 'N/A',
            b.problem_title || 'N/A',
            b.priority || 'MEDIUM',
            b.status || 'N/A',
            b.created_at ? new Date(b.created_at).toLocaleDateString() : 'N/A',
          ]);
          sections.push({
            title: 'Breakdowns Reported by Operator',
            tableHead: ['Ticket #', 'Machine', 'Problem Description', 'Priority', 'Status', 'Date'],
            tableRows: bdRows,
          });
        }
      }
      // 3. STORE MANAGER REPORT EXPORT
      else if (
        userRole === 'store_manager' ||
        (userRole === 'admin' && activeTab === 'store_managers')
      ) {
        reportTitle = 'Store & Inventory Management Official Audit Report';
        const stats = reportData.stats || {};
        metrics = [
          { label: 'Stock Valuation', value: stats.totalInventoryValuation || '₹ 0' },
          { label: 'Active Items', value: stats.totalItemsCount || 0 },
          { label: 'Low Stock Alerts', value: stats.lowStockCount || 0, highlight: true },
          { label: 'Transactions', value: stats.transactionsCount || 0 },
          { label: 'Purchase Reqs', value: stats.prsCount || 0 },
        ];

        // Section: Low Stock
        const lowRows = (reportData.lowStockAlerts || []).map((l: any) => [
          l.part_sku || 'N/A',
          l.part_name || 'N/A',
          l.current_quantity ?? 0,
          l.min_quantity ?? 0,
          l.location || 'Central Store',
        ]);
        sections.push({
          title: 'Critical Low Stock Alerts Requiring Reorder',
          tableHead: ['SKU / Code', 'Part Name', 'Current Qty', 'Min Buffer', 'Bin / Store Location'],
          tableRows: lowRows,
          emptyText: 'All spare parts stock levels are within normal operating buffers.',
        });

        // Section: Transactions
        const txRows = (reportData.transactions || []).map((t: any) => [
          t.created_at ? new Date(t.created_at).toLocaleDateString() : 'N/A',
          t.part_sku || 'N/A',
          t.part_name || 'N/A',
          t.transaction_type || 'ISSUE',
          t.quantity ?? 0,
          t.reference_type || 'Direct',
        ]);
        sections.push({
          title: 'Recent Inventory Movements & Transactions',
          tableHead: ['Date', 'Part SKU', 'Part Description', 'Transaction Type', 'Qty', 'Reference'],
          tableRows: txRows,
          emptyText: 'No inventory transactions recorded during the selected period.',
        });
      }
      // 4. MANAGER REPORT EXPORT
      else if (
        (userRole === 'manager' && activeTab === 'my_report') ||
        (userRole === 'admin' && activeTab === 'managers')
      ) {
        reportTitle = 'Maintenance Management Oversight & Governance Report';
        const stats = reportData.stats || {};
        metrics = [
          { label: 'Complaints Rcvd', value: stats.totalComplaintsReceived || 0 },
          { label: 'Acknowledged', value: stats.complaintsAcknowledged || 0 },
          { label: 'Converted to WO', value: stats.complaintsConverted || 0 },
          { label: 'Active Work Orders', value: stats.workOrdersActive || 0, highlight: true },
          { label: 'Awaiting Verify', value: stats.awaitingVerification || 0 },
          { label: 'Verified & Closed', value: stats.verifiedAndClosed || 0 },
        ];

        // Section: Work Orders Managed
        const woRows = (reportData.workOrders || []).map((w: any) => [
          w.wo_number || 'N/A',
          w.machine_code || 'N/A',
          w.problem_title || 'Maintenance Task',
          w.status || 'N/A',
          w.priority || 'MEDIUM',
          w.created_at ? new Date(w.created_at).toLocaleDateString() : 'N/A',
        ]);
        sections.push({
          title: 'Supervised Work Orders',
          tableHead: ['WO Number', 'Machine', 'Problem Title', 'Status', 'Priority', 'Logged Date'],
          tableRows: woRows,
          emptyText: 'No work orders currently assigned under this management scope.',
        });
      }
      // 5. ADMIN ENTERPRISE REPORT EXPORT
      else if (userRole === 'admin' && activeTab === 'enterprise') {
        reportTitle = 'Enterprise CMMS Governance & System Audit Report';
        const stats = reportData.stats || {};
        metrics = [
          { label: 'Total Users', value: stats.totalUsers || 0 },
          { label: 'Active Work Orders', value: stats.activeWorkOrders || 0, highlight: true },
          { label: 'Pending Breakdowns', value: stats.pendingBreakdowns || 0 },
          { label: 'Completed WOs', value: stats.completedWorkOrders || 0 },
          { label: 'Total Machines', value: stats.totalMachines || 0 },
          { label: 'Audit Trail Records', value: stats.totalAuditLogs || 0 },
        ];

        // Section: Audit Logs
        const auditRows = (reportData.auditLogs || []).map((a: any) => [
          a.created_at ? new Date(a.created_at).toLocaleString() : 'N/A',
          a.entity_name || 'System',
          a.action || 'UPDATE',
          a.performed_by || 'Admin',
        ]);
        sections.push({
          title: 'System Audit Logs & Governance Events',
          tableHead: ['Timestamp', 'Entity Affected', 'Action Performed', 'User Account'],
          tableRows: auditRows,
          emptyText: 'No recent audit events found.',
        });
      }

      // Generate PDF
      generateReportPDF({
        reportTitle,
        role: reportRole,
        targetUser: targetInfo,
        generatedBy: `${user?.fullName || (user as any)?.name || user?.email} (${userRole.toUpperCase()})`,
        dateRange: { startDate, endDate },
        metrics,
        sections,
      });
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Failed to generate PDF. Please ensure report data is loaded.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Build KPI Cards for View
  const renderKPICards = () => {
    if (!reportData?.stats) return null;
    const s = reportData.stats;

    let cards: ReportCardItem[] = [];

    if (
      userRole === 'technician' ||
      ((userRole === 'manager' || userRole === 'admin') && activeTab === 'technicians')
    ) {
      cards = [
        { label: 'Assigned Work Orders', value: s.totalAssigned ?? 0, icon: Wrench },
        { label: 'In Progress / Accepted', value: s.acceptedOrInProgress ?? 0, icon: Clock, variant: 'amber' },
        { label: 'Waiting for Parts', value: s.waitingForParts ?? 0, icon: Boxes, variant: 'red' },
        { label: 'Awaiting Verification', value: s.awaitingVerification ?? 0, icon: AlertTriangle, variant: 'amber' },
        { label: 'Verified & Closed', value: s.verifiedAndClosed ?? 0, icon: CheckCircle2, variant: 'green' },
        { label: 'Total Downtime Handled', value: `${s.totalDowntimeHours || 0} hrs`, icon: Clock, variant: 'blue' },
      ];
    } else if (
      userRole === 'operator' ||
      ((userRole === 'manager' || userRole === 'admin') && activeTab === 'operators')
    ) {
      cards = [
        { label: 'Total Inspections', value: s.totalInspections ?? 0, icon: ClipboardCheck },
        { label: 'Passed Safety Checks', value: s.passed ?? 0, icon: CheckCircle2, variant: 'green' },
        { label: 'Failed Checks', value: s.failed ?? 0, icon: XCircle, variant: 'red' },
        { label: 'Requires Attention', value: s.requiringAttention ?? 0, icon: AlertTriangle, variant: 'amber' },
        { label: 'Breakdowns Reported', value: s.breakdownsReported ?? 0, icon: AlertTriangle, variant: 'amber' },
        { label: 'Machines Operated', value: s.machinesOperatedCount ?? 0, icon: HardHat, variant: 'blue' },
      ];
    } else if (
      userRole === 'store_manager' ||
      (userRole === 'admin' && activeTab === 'store_managers')
    ) {
      cards = [
        { label: 'Stock Valuation', value: s.totalInventoryValuation || '₹ 0.00', icon: Boxes, variant: 'amber' },
        { label: 'Active SKUs', value: s.totalItemsCount ?? 0, icon: Boxes },
        { label: 'Low Stock Alerts', value: s.lowStockCount ?? 0, icon: AlertTriangle, variant: 'red' },
        { label: 'Stock Transactions', value: s.transactionsCount ?? 0, icon: RefreshCw, variant: 'blue' },
        { label: 'Purchase Requests', value: s.prsCount ?? 0, icon: FileText },
      ];
    } else if (
      (userRole === 'manager' && activeTab === 'my_report') ||
      (userRole === 'admin' && activeTab === 'managers')
    ) {
      cards = [
        { label: 'Complaints Received', value: s.totalComplaintsReceived ?? 0, icon: AlertTriangle },
        { label: 'Acknowledged', value: s.complaintsAcknowledged ?? 0, icon: CheckCircle2, variant: 'blue' },
        { label: 'Converted to WO', value: s.complaintsConverted ?? 0, icon: Wrench, variant: 'amber' },
        { label: 'Active Work Orders', value: s.workOrdersActive ?? 0, icon: Clock, variant: 'amber' },
        { label: 'Awaiting Verify', value: s.awaitingVerification ?? 0, icon: AlertTriangle, variant: 'red' },
        { label: 'Verified & Closed', value: s.verifiedAndClosed ?? 0, icon: CheckCircle2, variant: 'green' },
      ];
    } else if (userRole === 'admin' && activeTab === 'enterprise') {
      cards = [
        { label: 'Registered Personnel', value: s.totalUsers ?? 0, icon: UserCheck, variant: 'blue' },
        { label: 'Active Work Orders', value: s.activeWorkOrders ?? 0, icon: Wrench, variant: 'amber' },
        { label: 'Pending Breakdowns', value: s.pendingBreakdowns ?? 0, icon: AlertTriangle, variant: 'red' },
        { label: 'Completed Repairs', value: s.completedWorkOrders ?? 0, icon: CheckCircle2, variant: 'green' },
        { label: 'Monitored Machines', value: s.totalMachines ?? 0, icon: Boxes },
        { label: 'Audit Trail Records', value: s.totalAuditLogs ?? 0, icon: ShieldCheck },
      ];
    }

    return <ReportSummaryCards cards={cards} />;
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header Banner */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500 text-black p-2.5 rounded-lg shadow-sm font-black flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-zinc-900 tracking-tight">
                Role-Based Reports & PDF Generator
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 uppercase tracking-wider">
                Phase 4 • Live
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Official operational reports generated directly from authentic database activity records.
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleGenerateReport}
            disabled={isGenerating}
            className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-xs font-bold hover:bg-zinc-800 transition flex items-center gap-2 shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
            {isGenerating ? 'Querying Records...' : 'Generate Live Report'}
          </button>

          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={!reportData || isDownloading}
            className="px-4 py-2 bg-amber-500 text-black rounded-lg text-xs font-bold hover:bg-amber-400 transition flex items-center gap-2 shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            {isDownloading ? 'Generating PDF...' : 'Download Official PDF'}
          </button>
        </div>
      </div>

      {/* 2. Navigation Tabs (for Manager and Admin) */}
      {userRole === 'manager' && (
        <div className="flex items-center gap-2 border-b border-zinc-200 pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('technicians')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'technicians'
                ? 'bg-amber-500 text-black shadow-xs'
                : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            Technician Reports
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('operators')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'operators'
                ? 'bg-amber-500 text-black shadow-xs'
                : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            <HardHat className="w-3.5 h-3.5" />
            Operator Reports
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('my_report')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'my_report'
                ? 'bg-amber-500 text-black shadow-xs'
                : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            My Manager Report
          </button>
        </div>
      )}

      {userRole === 'admin' && (
        <div className="flex items-center gap-2 border-b border-zinc-200 pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('enterprise')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'enterprise'
                ? 'bg-amber-500 text-black shadow-xs'
                : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Enterprise Audit & KPIs
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('managers')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'managers'
                ? 'bg-amber-500 text-black shadow-xs'
                : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            Manager Reports
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('store_managers')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'store_managers'
                ? 'bg-amber-500 text-black shadow-xs'
                : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            Store Manager Reports
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('technicians')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'technicians'
                ? 'bg-amber-500 text-black shadow-xs'
                : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            Technician Reports
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('operators')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'operators'
                ? 'bg-amber-500 text-black shadow-xs'
                : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            <HardHat className="w-3.5 h-3.5" />
            Operator Reports
          </button>
        </div>
      )}

      {/* 3. Date Filter Toolbar */}
      <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-zinc-400" />
          <span className="text-xs font-bold text-zinc-800 uppercase tracking-wider">
            Activity Date Range Filter
          </span>
          <span className="text-[11px] text-zinc-400">
            (Leave blank for all historic records)
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-zinc-500 font-medium">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 bg-zinc-50 border border-zinc-300 rounded-lg text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-zinc-500 font-medium">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 bg-zinc-50 border border-zinc-300 rounded-lg text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          {(startDate || endDate) && (
            <button
              type="button"
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
              className="px-2.5 py-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition cursor-pointer"
            >
              Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* 4. User Selector Dropdown (When Manager/Admin views subordinate personnel) */}
      {(userRole === 'manager' || userRole === 'admin') &&
        ['technicians', 'operators', 'managers', 'store_managers'].includes(activeTab) && (
          <ReportUserSelector
            roleLabel={
              activeTab === 'technicians'
                ? 'Technician'
                : activeTab === 'operators'
                ? 'Operator'
                : activeTab === 'managers'
                ? 'Manager'
                : 'Store Manager'
            }
            users={availableUsers}
            selectedUser={selectedUser}
            onSelectUser={(u) => setSelectedUser(u)}
            isLoading={isLoadingUsers}
          />
        )}

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 5. Live Summary KPI Cards */}
      {renderKPICards()}

      {/* 6. Detailed Tables (White Theme matching Screenshot 2) */}
      {reportData && (
        <div className="space-y-6">
          {/* Work Orders Table (Technician / Manager) */}
          {reportData.workOrders && (
            <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
              <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/70">
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-amber-500" />
                  <h2 className="text-sm font-bold text-zinc-900">
                    Assigned Work Orders & Repair History
                  </h2>
                  <span className="text-xs bg-zinc-200 text-zinc-800 px-2 py-0.5 rounded-full font-semibold">
                    {reportData.workOrders.length}
                  </span>
                </div>
              </div>

              {reportData.workOrders.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-500">
                  No work orders found for the specified period.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-4 py-3">WO Number</th>
                        <th className="px-4 py-3">Machine</th>
                        <th className="px-4 py-3">Problem / Task</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Priority</th>
                        <th className="px-4 py-3">Downtime</th>
                        <th className="px-4 py-3">Created Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {reportData.workOrders.map((w: any) => (
                        <tr key={w.id} className="hover:bg-zinc-50/80 transition">
                          <td className="px-4 py-3 font-mono font-bold text-zinc-900">
                            {w.wo_number || 'N/A'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-zinc-800">{w.machine_code || 'N/A'}</div>
                            <div className="text-[11px] text-zinc-400">{w.machine_name}</div>
                          </td>
                          <td className="px-4 py-3 text-zinc-700 max-w-xs truncate">
                            {w.problem_title || w.diagnosis || 'Standard Maintenance Action'}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                                ['VERIFIED', 'CLOSED', 'COMPLETED'].includes(w.status?.toUpperCase())
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : w.status?.toUpperCase() === 'PENDING_VERIFICATION'
                                  ? 'bg-amber-100 text-amber-900'
                                  : w.status?.toUpperCase() === 'PARTS_REQUESTED'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-zinc-100 text-zinc-800'
                              }`}
                            >
                              {w.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                w.priority?.toUpperCase() === 'HIGH' || w.priority?.toUpperCase() === 'CRITICAL'
                                  ? 'bg-amber-500 text-black'
                                  : 'bg-zinc-100 text-zinc-700'
                              }`}
                            >
                              {w.priority || 'MEDIUM'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-zinc-600">
                            {w.actual_downtime_minutes || 0} mins
                          </td>
                          <td className="px-4 py-3 text-zinc-500">
                            {w.created_at ? new Date(w.created_at).toLocaleDateString() : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Inspections Table (Operator) */}
          {reportData.inspections && (
            <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
              <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/70">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-amber-500" />
                  <h2 className="text-sm font-bold text-zinc-900">
                    Pre-Shift Inspections & Safety Compliance Log
                  </h2>
                  <span className="text-xs bg-zinc-200 text-zinc-800 px-2 py-0.5 rounded-full font-semibold">
                    {reportData.inspections.length}
                  </span>
                </div>
              </div>

              {reportData.inspections.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-500">
                  No safety inspection records submitted during this period.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-4 py-3">Date & Time</th>
                        <th className="px-4 py-3">Machine Code</th>
                        <th className="px-4 py-3">Shift</th>
                        <th className="px-4 py-3">Evaluation Status</th>
                        <th className="px-4 py-3">Checklist Remarks / Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {reportData.inspections.map((i: any) => (
                        <tr key={i.id} className="hover:bg-zinc-50/80 transition">
                          <td className="px-4 py-3 text-zinc-700 font-medium">
                            {i.created_at ? new Date(i.created_at).toLocaleString() : 'N/A'}
                          </td>
                          <td className="px-4 py-3 font-bold text-zinc-900">
                            {i.machine_code || 'N/A'}
                          </td>
                          <td className="px-4 py-3 capitalize text-zinc-600">
                            {i.shift || 'General'}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                ['PASS', 'PASSED'].includes(i.overall_status?.toUpperCase())
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {i.overall_status || 'PASS'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-zinc-600 max-w-sm truncate">
                            {i.notes || (i.responses_json ? `${i.responses_json.length} items logged` : 'Verified')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Inventory Transactions Table (Store Manager) */}
          {reportData.transactions && (
            <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
              <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/70">
                <div className="flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-amber-500" />
                  <h2 className="text-sm font-bold text-zinc-900">
                    Store Stock Transactions & Issues
                  </h2>
                  <span className="text-xs bg-zinc-200 text-zinc-800 px-2 py-0.5 rounded-full font-semibold">
                    {reportData.transactions.length}
                  </span>
                </div>
              </div>

              {reportData.transactions.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-500">
                  No stock transactions found for this period.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Part SKU</th>
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Qty</th>
                        <th className="px-4 py-3">Reference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {reportData.transactions.map((t: any) => (
                        <tr key={t.id} className="hover:bg-zinc-50/80 transition">
                          <td className="px-4 py-3 text-zinc-600">
                            {t.created_at ? new Date(t.created_at).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-zinc-900">
                            {t.part_sku || 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-zinc-700">{t.part_name || 'N/A'}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-800">
                              {t.transaction_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-zinc-900">
                            {t.quantity}
                          </td>
                          <td className="px-4 py-3 text-zinc-500">
                            {t.reference_type || 'Direct Issue'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Audit Logs Table (Admin) */}
          {reportData.auditLogs && (
            <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
              <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/70">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-500" />
                  <h2 className="text-sm font-bold text-zinc-900">
                    System Audit Trail & Governance Activity
                  </h2>
                  <span className="text-xs bg-zinc-200 text-zinc-800 px-2 py-0.5 rounded-full font-semibold">
                    {reportData.auditLogs.length}
                  </span>
                </div>
              </div>

              {reportData.auditLogs.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-500">
                  No system audit records found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-4 py-3">Timestamp</th>
                        <th className="px-4 py-3">Entity Affected</th>
                        <th className="px-4 py-3">Action</th>
                        <th className="px-4 py-3">User / Performed By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {reportData.auditLogs.map((a: any) => (
                        <tr key={a.id} className="hover:bg-zinc-50/80 transition">
                          <td className="px-4 py-3 text-zinc-600">
                            {a.created_at ? new Date(a.created_at).toLocaleString() : 'N/A'}
                          </td>
                          <td className="px-4 py-3 font-semibold text-zinc-900">
                            {a.entity_name}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-800">
                              {a.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-zinc-600">
                            {a.performed_by || 'Admin System'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
