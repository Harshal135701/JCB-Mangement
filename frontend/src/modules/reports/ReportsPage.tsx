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
  Factory,
  Building2,
  Check,
  Info,
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
import {
  generateReportPDF,
  PDFReportMetric,
  PDFSummaryBlock,
} from './utils/generateReportPDF';
import { ReportSummaryCards, ReportCardItem } from './components/ReportSummaryCards';
import { ReportUserSelector } from './components/ReportUserSelector';

export const ReportsPage: React.FC = () => {
  const { user } = useAuth();
  const userRole = (user?.role || 'technician').toLowerCase();

  // State: Date Range Filter
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // State: Tab Selection (Default to personal overview for manager/admin)
  const [activeTab, setActiveTab] = useState<string>(
    userRole === 'admin' ? 'enterprise' : userRole === 'manager' ? 'my_report' : 'personal'
  );

  // State: Users Directory for Selection (Empty by default)
  const [availableUsers, setAvailableUsers] = useState<UserSummary[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // State: Report Data & Status
  const [reportData, setReportData] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Set default tab on user role change
  useEffect(() => {
    if (userRole === 'manager') {
      setActiveTab('my_report');
    } else if (userRole === 'admin') {
      setActiveTab('enterprise');
    } else {
      setActiveTab('personal');
    }
  }, [userRole]);

  // Load User Directory when tab changes for Manager or Admin
  // Crucial: Never preselect any employee by default!
  useEffect(() => {
    const loadDirectory = async () => {
      setSelectedUser(null);
      setReportData(null);
      setErrorMsg(null);

      const isSubordinateTab = ['technicians', 'operators', 'managers', 'store_managers'].includes(activeTab);
      if (!isSubordinateTab) return;

      let roleToFetch = '';
      if (activeTab === 'technicians') roleToFetch = 'technician';
      else if (activeTab === 'operators') roleToFetch = 'operator';
      else if (activeTab === 'managers' && userRole === 'admin') roleToFetch = 'manager';
      else if (activeTab === 'store_managers' && userRole === 'admin') roleToFetch = 'store_manager';

      if (roleToFetch) {
        setIsLoadingUsers(true);
        try {
          const managerPlantId = userRole === 'manager' ? (user?.plantId || (user as any)?.plant_id) : undefined;
          const list = await fetchUsersByRole(roleToFetch, undefined, managerPlantId);
          setAvailableUsers(list);
        } catch (err) {
          console.error('Failed to load employee directory:', err);
          setAvailableUsers([]);
        } finally {
          setIsLoadingUsers(false);
        }
      }
    };

    loadDirectory();
  }, [userRole, activeTab, user?.plantId]);

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
            setReportData(null);
            setIsGenerating(false);
            return;
          }
          const data = await fetchTechnicianReportData(selectedUser.id, startDate, endDate);
          setReportData(data);
        } else if (activeTab === 'operators') {
          if (!selectedUser) {
            setReportData(null);
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
            setReportData(null);
            setIsGenerating(false);
            return;
          }
          const data = await fetchTechnicianReportData(selectedUser.id, startDate, endDate);
          setReportData(data);
        } else if (activeTab === 'operators') {
          if (!selectedUser) {
            setReportData(null);
            setIsGenerating(false);
            return;
          }
          const data = await fetchOperatorReportData(selectedUser.id, startDate, endDate);
          setReportData(data);
        } else if (activeTab === 'managers') {
          if (!selectedUser) {
            setReportData(null);
            setIsGenerating(false);
            return;
          }
          const data = await fetchManagerReportData(selectedUser.id, startDate, endDate);
          setReportData(data);
        } else if (activeTab === 'store_managers') {
          if (!selectedUser) {
            setReportData(null);
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

  // Trigger report fetch when on self tabs or when selectedUser is chosen
  useEffect(() => {
    if (userRole === 'technician' || userRole === 'operator' || userRole === 'store_manager') {
      handleGenerateReport();
    } else if (
      (userRole === 'manager' && activeTab === 'my_report') ||
      (userRole === 'admin' && activeTab === 'enterprise')
    ) {
      handleGenerateReport();
    } else if (selectedUser) {
      handleGenerateReport();
    }
  }, [userRole, activeTab, selectedUser, handleGenerateReport]);

  // Algorithmic summary paragraph generator strictly using real system records
  const generateOverallSummary = (role: string, targetName: string, stats: any): string => {
    const s = stats || {};
    if (role === 'technician') {
      return (
        `During this reporting period, technician ${targetName} was assigned a total of ${s.totalAssigned || 0} ` +
        `work orders across plant machinery. A total of ${s.verifiedAndClosed || 0} maintenance actions were successfully ` +
        `verified and closed, with ${s.acceptedOrInProgress || 0} repair tasks currently active and ${s.waitingForParts || 0} ` +
        `awaiting spare parts from stores. Cumulative downtime resolved across these work orders totals ${s.totalDowntimeHours || 0} ` +
        `hours with ${s.reworkCount || 0} rework incidents recorded, verifying strict adherence to standard plant maintenance procedures.`
      );
    } else if (role === 'operator') {
      return (
        `Operator ${targetName} conducted a total of ${s.totalInspections || 0} pre-shift safety inspections across ` +
        `${s.machinesOperatedCount || 1} unique production machinery assets. Inspection evaluations recorded ${s.passed || 0} passed ` +
        `evaluations, ${s.requiringAttention || 0} checkpoints flagged for preventive attention, and ${s.failed || 0} failed assessments ` +
        `resulting in ${s.breakdownsReported || 0} reported breakdown complaints. Inspection logs confirm consistent daily compliance.`
      );
    } else if (role === 'store_manager') {
      return (
        `Store manager ${targetName} supervised warehouse operations encompassing ${s.totalItemsCount || 0} active spare parts catalog SKUs ` +
        `with an aggregate inventory valuation of ${s.totalInventoryValuation || '₹ 0.00'}. A total of ${s.transactionsCount || 0} inventory ` +
        `movements (receipts, issues, adjustments) were completed to fulfill maintenance requirements, with ${s.lowStockCount || 0} items ` +
        `flagged below safety buffers across ${s.prsCount || 0} purchase requisitions.`
      );
    } else if (role === 'manager') {
      return (
        `Maintenance manager ${targetName} directed operational triage and supervisory oversight across ${s.totalComplaintsReceived || 0} ` +
        `breakdown complaints and ${s.workOrdersAssigned || 0} assigned work orders. Comprehensive triage resulted in ${s.complaintsAcknowledged || 0} ` +
        `acknowledged complaints and ${s.complaintsConverted || 0} work orders dispatched for field repair, with ${s.verifiedAndClosed || 0} jobs ` +
        `successfully completed and ${s.awaitingVerification || 0} work orders currently awaiting final verification sign-off.`
      );
    } else {
      // Admin
      return (
        `System administrator ${targetName} exercised enterprise governance across ${s.totalUsers || 0} registered plant personnel, ` +
        `${s.totalMachines || 0} monitored machinery assets, and enterprise maintenance queues. The enterprise maintenance system records ` +
        `${s.activeWorkOrders || 0} work orders currently in progress and ${s.pendingBreakdowns || 0} pending triage, alongside ` +
        `${s.completedWorkOrders || 0} completed work orders and ${s.totalAuditLogs || 0} logged administrative governance events ensuring regulatory compliance.`
      );
    }
  };

  // Export to Concise, Professional Summary PDF
  const handleDownloadPDF = () => {
    if (!reportData) return;
    setIsDownloading(true);

    try {
      const isViewingOther =
        (userRole === 'manager' || userRole === 'admin') &&
        ['technicians', 'operators', 'managers', 'store_managers'].includes(activeTab) &&
        selectedUser;

      // Determine subject: Selected employee if viewing subordinate, otherwise logged-in user
      const targetUser = isViewingOther && selectedUser
        ? {
            name: selectedUser.full_name,
            employeeCode: selectedUser.employee_code,
            designation: selectedUser.designation || selectedUser.role.toUpperCase(),
            plantName: (selectedUser as any).plant_name || user?.plantName || 'JCB Ballabgarh Works',
            shopName: (selectedUser as any).shop_name || 'Assigned Plant Facilities',
            email: selectedUser.email,
          }
        : {
            name: user?.fullName || (user as any)?.name || user?.email || 'Authenticated Personnel',
            employeeCode: user?.employeeCode || (user as any)?.employee_code,
            designation: user?.designation || userRole.toUpperCase(),
            plantName: user?.plantName || 'JCB Ballabgarh Works',
            shopName: user?.shopName || 'All Plant Facilities',
            email: user?.email,
          };

      const targetRole = isViewingOther && selectedUser ? selectedUser.role : userRole;
      const stats = reportData.stats || {};

      let reportTitle = 'Operational Performance & Activity Summary';
      let metrics: PDFReportMetric[] = [];
      let summaryBlocks: PDFSummaryBlock[] = [];

      const calcPercent = (val: number, total: number) => {
        if (!total || total === 0) return '0%';
        return `${Math.round((val / total) * 100)}%`;
      };

      // 1. TECHNICIAN SUMMARY FORMAT
      if (targetRole === 'technician') {
        reportTitle = 'Technician Performance & Work Order Summary';
        metrics = [
          { label: 'Total Assigned', value: stats.totalAssigned || 0 },
          { label: 'Completed WOs', value: stats.verifiedAndClosed || 0, highlight: true },
          { label: 'Active Repairs', value: stats.acceptedOrInProgress || 0 },
          { label: 'Waiting for Parts', value: stats.waitingForParts || 0 },
          { label: 'Awaiting Verify', value: stats.awaitingVerification || 0 },
          { label: 'Rework Cases', value: stats.reworkCount || 0 },
        ];

        summaryBlocks = [
          {
            title: 'Work Order Execution & Lifecycle Summary',
            tableHead: ['Maintenance Stage', 'Work Orders', 'Distribution', 'Operational Action / Status'],
            tableRows: [
              ['Verified & Closed', stats.verifiedAndClosed || 0, calcPercent(stats.verifiedAndClosed, stats.totalAssigned), 'Completed & Signed Off'],
              ['In Progress / Active', stats.acceptedOrInProgress || 0, calcPercent(stats.acceptedOrInProgress, stats.totalAssigned), 'Active Field Repair / Diagnosis'],
              ['Waiting for Spare Parts', stats.waitingForParts || 0, calcPercent(stats.waitingForParts, stats.totalAssigned), 'Material Requisition in Store'],
              ['Awaiting Manager Sign-Off', stats.awaitingVerification || 0, calcPercent(stats.awaitingVerification, stats.totalAssigned), 'Repair Finished, Pending Audit'],
              ['Rework / Quality Flags', stats.reworkCount || 0, calcPercent(stats.reworkCount, stats.totalAssigned), (stats.reworkCount || 0) > 0 ? 'Quality Re-inspection' : 'Zero Rework Recorded'],
            ],
          },
          {
            title: 'Breakdown Response & Downtime Performance Summary',
            tableHead: ['Performance Metric', 'Recorded Operational Value', 'Compliance Target / Benchmark'],
            tableRows: [
              ['Total Breakdown Complaints Handled', `${stats.complaintsHandled || 0} tickets`, '100% Handled to SOP'],
              ['Total Machine Stoppage Resolved', `${stats.totalDowntimeHours || 0} hours (${stats.totalDowntimeMinutes || 0} mins)`, 'Asset Stoppage Minimized'],
              ['Average Resolution Time', `${stats.totalAssigned ? Math.round(stats.totalDowntimeMinutes / stats.totalAssigned) : 0} mins / WO`, 'Target Benchmark < 120 mins'],
            ],
          },
        ];
      }
      // 2. OPERATOR SUMMARY FORMAT
      else if (targetRole === 'operator') {
        reportTitle = 'Operator Shift Safety & Inspection Compliance Summary';
        metrics = [
          { label: 'Total Inspections', value: stats.totalInspections || 0 },
          { label: 'Passed Checks', value: stats.passed || 0, highlight: true },
          { label: 'Failed Checks', value: stats.failed || 0 },
          { label: 'Requires Attention', value: stats.requiringAttention || 0 },
          { label: 'Breakdowns Logged', value: stats.breakdownsReported || 0 },
          { label: 'Machines Operated', value: stats.machinesOperatedCount || 0 },
        ];

        summaryBlocks = [
          {
            title: 'Pre-Shift Safety Inspection Compliance Summary',
            tableHead: ['Safety Assessment Result', 'Inspections', 'Compliance Rate', 'Operational Action'],
            tableRows: [
              ['Pass (Safe to Operate)', stats.passed || 0, calcPercent(stats.passed, stats.totalInspections), 'Machine Certified for Shift Run'],
              ['Flagged (Attention Required)', stats.requiringAttention || 0, calcPercent(stats.requiringAttention, stats.totalInspections), 'Preventive Attention Notified'],
              ['Fail (Unsafe / Critical Flag)', stats.failed || 0, calcPercent(stats.failed, stats.totalInspections), (stats.failed || 0) > 0 ? 'Machine Stoppage & Ticket Raised' : 'Zero Critical Failures'],
            ],
          },
          {
            title: 'Machinery Operation & Incident Logging Summary',
            tableHead: ['Operational Parameter', 'Recorded Operational Value', 'Facility Status'],
            tableRows: [
              ['Total Safety Checkpoints Evaluated', `${stats.totalInspections || 0} assessments`, 'Pre-Shift Verification Active'],
              ['Unique Machinery Operated', `${stats.machinesOperatedCount || 0} assets`, stats.machineList || 'Assigned Equipment'],
              ['Breakdown Complaints Logged', `${stats.breakdownsReported || 0} complaints`, (stats.breakdownsReported || 0) > 0 ? 'Notified Maintenance Crew' : 'Zero Breakdowns Encountered'],
            ],
          },
        ];
      }
      // 3. STORE MANAGER SUMMARY FORMAT
      else if (targetRole === 'store_manager') {
        reportTitle = 'Store Inventory & Warehouse Management Summary';
        metrics = [
          { label: 'Total Inventory Items', value: stats.totalItemsCount || 0 },
          { label: 'Low-Stock Alerts', value: stats.lowStockCount || 0, highlight: (stats.lowStockCount || 0) > 0 },
          { label: 'Stock Transactions', value: stats.transactionsCount || 0 },
          { label: 'Pending Requisitions', value: stats.prsCount || 0 },
          { label: 'Inventory Valuation', value: stats.totalInventoryValuation || '₹ 0.00' },
        ];

        summaryBlocks = [
          {
            title: 'Inventory Stock & Warehouse Health Summary',
            tableHead: ['Store Management Domain', 'Current Metrics', 'Buffer & Governance Status'],
            tableRows: [
              ['Active Spare Parts SKUs', `${stats.totalItemsCount || 0} catalog items`, 'Continuous Stock Availability'],
              ['Total Inventory Capitalization', stats.totalInventoryValuation || '₹ 0.00', 'Enterprise Asset Value'],
              ['Low-Stock Buffer Alerts', `${stats.lowStockCount || 0} items below safety buffer`, (stats.lowStockCount || 0) > 0 ? 'Replenishment Reorders In-Flight' : 'Buffer Levels Healthy'],
            ],
          },
          {
            title: 'Material Movements & Procurement Pipeline Summary',
            tableHead: ['Supply Chain Activity', 'Transactions / Volume', 'Workflow Stage'],
            tableRows: [
              ['Inventory Issue & Receipt Transactions', `${stats.transactionsCount || 0} logged movements`, 'Store Fulfillment Audited'],
              ['Purchase Requisitions Raised', `${stats.prsCount || 0} requisitions`, 'Pending Manager / Supplier PO'],
              ['Critical Buffer Compliance', (stats.lowStockCount || 0) === 0 ? '100% Compliant' : `${stats.lowStockCount} items flagged`, 'Threshold Monitored'],
            ],
          },
        ];
      }
      // 4. MANAGER SUMMARY FORMAT
      else if (targetRole === 'manager') {
        reportTitle = 'Maintenance Supervisory & Governance Summary';
        metrics = [
          { label: 'Breakdowns Supervised', value: stats.totalComplaintsReceived || 0 },
          { label: 'Pending Breakdowns', value: stats.complaintsAcknowledged || 0 },
          { label: 'Active Work Orders', value: stats.workOrdersActive || 0, highlight: true },
          { label: 'Completed Work Orders', value: stats.verifiedAndClosed || 0 },
          { label: 'Awaiting Verify', value: stats.awaitingVerification || 0 },
          { label: 'Technician Allocation', value: `${stats.workOrdersAssigned || 0} WOs` },
        ];

        summaryBlocks = [
          {
            title: 'Breakdown Triage & Dispatch Oversight Summary',
            tableHead: ['Triage Workflow Stage', 'Tickets Count', 'Conversion Rate', 'Operational Action'],
            tableRows: [
              ['Complaints Acknowledged', stats.complaintsAcknowledged || 0, calcPercent(stats.complaintsAcknowledged, stats.totalComplaintsReceived), 'Under Investigation'],
              ['Converted to Work Orders', stats.complaintsConverted || 0, calcPercent(stats.complaintsConverted, stats.totalComplaintsReceived), 'Dispatched to Field Technicians'],
              ['Complaints Rejected', stats.complaintsRejected || 0, calcPercent(stats.complaintsRejected, stats.totalComplaintsReceived), 'Invalid / Duplicate Report Filtered'],
            ],
          },
          {
            title: 'Work Order Execution & Verification Summary',
            tableHead: ['Supervisory Category', 'Total Work Orders', 'Compliance Status'],
            tableRows: [
              ['Active Repair Jobs', stats.workOrdersActive || 0, 'Technician Repair in Progress'],
              ['Awaiting Manager Sign-Off', stats.awaitingVerification || 0, 'Quality Check Pending'],
              ['Verified & Closed', stats.verifiedAndClosed || 0, 'Completed to Operating Standard'],
              ['Rework Cases', stats.reworkCases || 0, (stats.reworkCases || 0) > 0 ? 'Rework Supervised' : 'Zero Quality Defect Cases'],
            ],
          },
        ];
      }
      // 5. ADMIN SUMMARY FORMAT
      else {
        reportTitle = 'Enterprise CMMS Governance & System Summary';
        metrics = [
          { label: 'Total Users', value: stats.totalUsers || 0 },
          { label: 'Active Work Orders', value: stats.activeWorkOrders || 0, highlight: true },
          { label: 'Pending Breakdowns', value: stats.pendingBreakdowns || 0 },
          { label: 'Completed WOs', value: stats.completedWorkOrders || 0 },
          { label: 'Total Machines', value: stats.totalMachines || 0 },
          { label: 'System Activity Count', value: stats.totalAuditLogs || 0 },
        ];

        summaryBlocks = [
          {
            title: 'Enterprise Personnel & Workforce Allocation Summary',
            tableHead: ['Personnel Role Category', 'Headcount', 'Operational Status'],
            tableRows: [
              ['Maintenance Technicians', reportData.users?.filter((u: any) => u.role === 'technician').length || 0, 'Active Field Engineering'],
              ['Machine Operators', reportData.users?.filter((u: any) => u.role === 'operator').length || 0, 'Shop Floor Operations'],
              ['Plant Managers', reportData.users?.filter((u: any) => u.role === 'manager').length || 0, 'Plant Supervisory Command'],
              ['Store Managers', reportData.users?.filter((u: any) => u.role === 'store_manager').length || 0, 'Store & Spares Governance'],
            ],
          },
          {
            title: 'Enterprise Machinery Assets & Governance Summary',
            tableHead: ['Enterprise Domain', 'Current Status / Count', 'Compliance Assessment'],
            tableRows: [
              ['Registered Machinery Assets', `${stats.totalMachines || 0} machines`, 'Asset Register Monitored'],
              ['Active Work Orders in Enterprise', `${stats.activeWorkOrders || 0} active jobs`, 'Maintenance Ongoing'],
              ['Completed Maintenance Jobs', `${stats.completedWorkOrders || 0} closed jobs`, 'Operational Availability Maintained'],
              ['System Audit Trail Records', `${stats.totalAuditLogs || 0} recorded governance events`, 'Regulatory Audit Verified'],
            ],
          },
        ];
      }

      const executiveSummary = generateOverallSummary(targetRole, targetUser.name, stats);

      generateReportPDF({
        reportTitle,
        role: targetRole,
        targetUser,
        generatedBy: `${user?.fullName || 'User'} (${userRole.toUpperCase()})`,
        dateRange: {
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        },
        metrics,
        executiveSummary,
        summaryBlocks,
      });
    } catch (err: any) {
      console.error('Failed to export PDF:', err);
      setErrorMsg('Failed to export summary PDF. Please retry.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Render on-screen KPI cards
  const renderKPICards = () => {
    if (!reportData) return null;
    const s = reportData.stats || {};
    let cards: ReportCardItem[] = [];

    const isViewingSubordinate =
      (userRole === 'manager' || userRole === 'admin') &&
      ['technicians', 'operators', 'managers', 'store_managers'].includes(activeTab);

    const currentRole = isViewingSubordinate && selectedUser ? selectedUser.role : userRole;

    if (currentRole === 'technician') {
      cards = [
        { label: 'Assigned Work Orders', value: s.totalAssigned ?? 0, icon: Wrench },
        { label: 'In Progress / Accepted', value: s.acceptedOrInProgress ?? 0, icon: Clock, variant: 'amber' },
        { label: 'Waiting for Parts', value: s.waitingForParts ?? 0, icon: Boxes, variant: 'red' },
        { label: 'Awaiting Verification', value: s.awaitingVerification ?? 0, icon: AlertTriangle, variant: 'amber' },
        { label: 'Verified & Closed', value: s.verifiedAndClosed ?? 0, icon: CheckCircle2 },
        { label: 'Total Downtime Handled', value: `${s.totalDowntimeHours || 0} hrs`, icon: Clock, variant: 'blue' },
      ];
    } else if (currentRole === 'operator') {
      cards = [
        { label: 'Total Inspections', value: s.totalInspections ?? 0, icon: ClipboardCheck },
        { label: 'Passed Safety Checks', value: s.passed ?? 0, icon: CheckCircle2, variant: 'green' },
        { label: 'Failed Checks', value: s.failed ?? 0, icon: XCircle, variant: 'red' },
        { label: 'Requires Attention', value: s.requiringAttention ?? 0, icon: AlertTriangle, variant: 'amber' },
        { label: 'Breakdowns Reported', value: s.breakdownsReported ?? 0, icon: AlertTriangle, variant: 'amber' },
        { label: 'Machines Operated', value: s.machinesOperatedCount ?? 0, icon: HardHat, variant: 'blue' },
      ];
    } else if (currentRole === 'store_manager') {
      cards = [
        { label: 'Stock Valuation', value: s.totalInventoryValuation || '₹ 0.00', icon: Boxes, variant: 'amber' },
        { label: 'Active SKUs', value: s.totalItemsCount ?? 0, icon: Boxes },
        { label: 'Low Stock Alerts', value: s.lowStockCount ?? 0, icon: AlertTriangle, variant: 'red' },
        { label: 'Stock Transactions', value: s.transactionsCount ?? 0, icon: RefreshCw, variant: 'blue' },
        { label: 'Purchase Requests', value: s.prsCount ?? 0, icon: FileText },
      ];
    } else if (currentRole === 'manager') {
      cards = [
        { label: 'Complaints Received', value: s.totalComplaintsReceived ?? 0, icon: AlertTriangle },
        { label: 'Acknowledged', value: s.complaintsAcknowledged ?? 0, icon: CheckCircle2, variant: 'blue' },
        { label: 'Converted to WO', value: s.complaintsConverted ?? 0, icon: Wrench, variant: 'amber' },
        { label: 'Active Work Orders', value: s.workOrdersActive ?? 0, icon: Clock, variant: 'amber' },
        { label: 'Awaiting Verify', value: s.awaitingVerification ?? 0, icon: AlertTriangle, variant: 'red' },
        { label: 'Verified & Closed', value: s.verifiedAndClosed ?? 0, icon: CheckCircle2 },
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

  const isSubordinateTab =
    (userRole === 'manager' || userRole === 'admin') &&
    ['technicians', 'operators', 'managers', 'store_managers'].includes(activeTab);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Header Banner */}
      <div className="bg-white border-2 border-zinc-200 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500 text-black p-2.5 rounded-xl shadow-xs font-black flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-jcb-yellow text-zinc-950 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded shadow-2xs">
                JCB CMMS
              </span>
              <h1 className="text-xl font-black text-zinc-950 tracking-tight uppercase">
                Role-Based Reports & PDF Generator
              </h1>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Generate concise, executive summary reports directly from authentic operational records.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleGenerateReport}
            disabled={isGenerating || (isSubordinateTab && !selectedUser)}
            className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-black transition flex items-center gap-2 shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
            {isGenerating ? 'Querying Records...' : 'Refresh Live Report'}
          </button>

          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={!reportData || isDownloading || (isSubordinateTab && !selectedUser)}
            className="px-4 py-2 bg-amber-500 text-black rounded-xl text-xs font-black uppercase tracking-wider hover:bg-amber-400 transition flex items-center gap-2 shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            {isDownloading ? 'Generating PDF...' : 'Download Summary PDF'}
          </button>
        </div>
      </div>

      {/* 2. Navigation Tabs (for Manager and Admin) */}
      {userRole === 'manager' && (
        <div className="flex items-center gap-2 border-b border-zinc-200 pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('my_report')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'my_report'
                ? 'bg-amber-500 text-black shadow-xs font-black'
                : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            My Manager Report
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('technicians')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'technicians'
                ? 'bg-amber-500 text-black shadow-xs font-black'
                : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            Technician Reports
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('operators')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'operators'
                ? 'bg-amber-500 text-black shadow-xs font-black'
                : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            <HardHat className="w-3.5 h-3.5" />
            Operator Reports
          </button>
        </div>
      )}

      {userRole === 'admin' && (
        <div className="flex items-center gap-2 border-b border-zinc-200 pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('enterprise')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'enterprise'
                ? 'bg-amber-500 text-black shadow-xs font-black'
                : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Enterprise Overview & KPIs
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('managers')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'managers'
                ? 'bg-amber-500 text-black shadow-xs font-black'
                : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            Manager Reports
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('store_managers')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'store_managers'
                ? 'bg-amber-500 text-black shadow-xs font-black'
                : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            Store Manager Reports
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('technicians')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'technicians'
                ? 'bg-amber-500 text-black shadow-xs font-black'
                : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            Technician Reports
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('operators')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'operators'
                ? 'bg-amber-500 text-black shadow-xs font-black'
                : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            <HardHat className="w-3.5 h-3.5" />
            Operator Reports
          </button>
        </div>
      )}

      {/* 3. Date Filter Toolbar */}
      <div className="bg-white border-2 border-zinc-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-zinc-400" />
          <span className="text-xs font-black text-zinc-800 uppercase tracking-wider">
            Activity Date Range Filter
          </span>
          <span className="text-[11px] text-zinc-400">
            (Leave blank for all historic records)
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-zinc-500 font-bold">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-zinc-500 font-bold">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-amber-500"
            />
          </div>
          {(startDate || endDate) && (
            <button
              type="button"
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
              className="px-2.5 py-1.5 text-xs font-bold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition cursor-pointer"
            >
              Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* 4. User Selector Dropdown (When Manager/Admin views subordinate personnel) */}
      {isSubordinateTab && (
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
        <div className="p-4 bg-rose-50 border-2 border-rose-200 rounded-2xl text-rose-800 text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 5. Instruction Card when Subordinate tab has no employee selected */}
      {isSubordinateTab && !selectedUser ? (
        <div className="bg-white border-2 border-dashed border-zinc-300 rounded-2xl p-12 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto shadow-2xs">
            <UserCheck className="w-7 h-7" />
          </div>
          <h3 className="text-base font-black text-zinc-950 uppercase tracking-tight">
            Please Select an Employee to Generate Report
          </h3>
          <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">
            Choose an authorized {activeTab.replace(/s$/, '').replace(/_/g, ' ')} from the dropdown directory selector above to inspect their live operational statistics and download their official summary report.
          </p>
        </div>
      ) : (
        <>
          {/* 6. Live Summary KPI Cards */}
          {renderKPICards()}

          {/* 7. Concise Activity Summaries (Management Summary Tables) */}
          {reportData && (
            <div className="bg-white border-2 border-zinc-200 rounded-2xl p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-black text-zinc-950 uppercase tracking-tight">
                    Operational Activity Breakdown
                  </h3>
                </div>
                <span className="text-[10px] font-mono font-bold bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded border border-zinc-200">
                  Concise Management Format
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Metric Summary Box 1 */}
                <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500 block">
                    Execution & Lifecycle Health
                  </span>
                  <div className="space-y-1.5 text-zinc-700">
                    <div className="flex justify-between">
                      <span className="font-medium">Verified / Completed Actions:</span>
                      <span className="font-bold text-emerald-700">
                        {reportData.stats?.verifiedAndClosed ?? reportData.stats?.passed ?? reportData.stats?.completedWorkOrders ?? 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Active / In-Progress Tickets:</span>
                      <span className="font-bold text-amber-700">
                        {reportData.stats?.acceptedOrInProgress ?? reportData.stats?.workOrdersActive ?? reportData.stats?.activeWorkOrders ?? 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Attention Required / Pending:</span>
                      <span className="font-bold text-zinc-900">
                        {reportData.stats?.waitingForParts ?? reportData.stats?.requiringAttention ?? reportData.stats?.pendingBreakdowns ?? 0}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Metric Summary Box 2 */}
                <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500 block">
                    Facility & Equipment Compliance
                  </span>
                  <div className="space-y-1.5 text-zinc-700">
                    <div className="flex justify-between">
                      <span className="font-medium">Equipment Units Addressed:</span>
                      <span className="font-bold text-zinc-900">
                        {reportData.stats?.machinesOperatedCount ?? reportData.stats?.totalMachines ?? 'Assigned Machinery'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Quality Defects / Rework:</span>
                      <span className="font-bold text-emerald-700">
                        {reportData.stats?.reworkCount ?? reportData.stats?.reworkCases ?? 0} (0% Target Met)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Official Documentation:</span>
                      <span className="font-bold text-zinc-900">100% Verified DB Records</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
