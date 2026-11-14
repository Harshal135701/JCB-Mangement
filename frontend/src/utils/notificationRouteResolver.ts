import { UserRole, getRoleHomeRoute } from '../context/AuthContext';
import { NotificationItem } from '../context/SocketContext';

/**
 * Validates and resolves any incoming or legacy notification into a valid,
 * role-authorized React Router path within JCB Smart CMMS.
 *
 * @param notification The notification object (or partial payload)
 * @param userRole The role of the currently logged-in user
 * @returns A safe, accessible route string with query parameters if applicable
 */
export function resolveNotificationRoute(
  notification?: Partial<NotificationItem> | null,
  userRole?: UserRole | string
): string {
  const fallbackHome = getRoleHomeRoute(userRole);

  if (!notification) {
    return fallbackHome;
  }

  const rawUrl = (notification.link_url || notification.action_url || '').trim();
  const entityType = (notification.entity_type || '').toLowerCase();
  const entityId = notification.entity_id ? String(notification.entity_id).trim() : '';

  // Extract relative path and query if full URL was provided
  let path = rawUrl;
  let queryString = '';
  if (rawUrl) {
    try {
      if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
        const parsed = new URL(rawUrl);
        path = parsed.pathname;
        queryString = parsed.search;
      } else {
        const queryIndex = rawUrl.indexOf('?');
        if (queryIndex !== -1) {
          path = rawUrl.substring(0, queryIndex);
          queryString = rawUrl.substring(queryIndex);
        }
      }
    } catch {
      path = rawUrl;
    }
  }

  // Helper to extract a query parameter value safely
  const getQueryParam = (search: string, key: string): string | null => {
    if (!search || !search.includes('?')) return null;
    const cleanSearch = search.startsWith('?') ? search.slice(1) : search;
    const pairs = cleanSearch.split('&');
    for (const pair of pairs) {
      const [k, v] = pair.split('=');
      if (decodeURIComponent(k) === key) {
        return decodeURIComponent(v || '');
      }
    }
    return null;
  };

  // 1. BREAKDOWN / MAINTENANCE COMPLAINTS
  // Paths: /breakdowns/:id, /breakdowns, or entity_type = 'maintenance_requests'
  const breakdownMatch = path.match(/^\/breakdowns(?:\/([a-zA-Z0-9_-]+))?/i);
  const isBreakdownEntity =
    entityType === 'maintenance_requests' ||
    entityType === 'breakdowns' ||
    entityType === 'complaints';

  if (breakdownMatch || isBreakdownEntity || path.startsWith('/triage')) {
    const extractedId =
      (breakdownMatch ? breakdownMatch[1] : null) ||
      getQueryParam(queryString, 'breakdownId') ||
      getQueryParam(queryString, 'complaint_id') ||
      getQueryParam(queryString, 'id') ||
      entityId;

    switch (userRole) {
      case 'admin':
      case 'manager':
        return extractedId ? `/triage?breakdownId=${extractedId}` : '/triage';
      case 'technician':
        return extractedId ? `/technician/dashboard?breakdownId=${extractedId}` : '/technician/dashboard';
      case 'operator':
        return extractedId ? `/operator/dashboard?ticketId=${extractedId}` : '/operator/dashboard';
      case 'store_manager':
      default:
        return fallbackHome;
    }
  }

  // 2. PURCHASE REQUISITIONS / PROCUREMENT
  // Paths: /procurement/pr/:id, /procurement, or entity_type = 'purchase_requisitions'
  const prMatch = path.match(/^\/procurement\/pr(?:\/([a-zA-Z0-9_-]+))?/i);
  const isProcurementPath = path === '/procurement' || path.startsWith('/procurement/');
  const isProcurementEntity =
    entityType === 'purchase_requisitions' ||
    entityType === 'procurement' ||
    entityType === 'grn_receipts' ||
    entityType === 'purchase_orders';

  if (prMatch || isProcurementPath || isProcurementEntity) {
    const extractedId =
      (prMatch ? prMatch[1] : null) ||
      getQueryParam(queryString, 'prId') ||
      getQueryParam(queryString, 'id') ||
      entityId;

    // Allowed on /procurement: admin, manager, technician, store_manager
    if (['admin', 'manager', 'technician', 'store_manager'].includes(userRole as string)) {
      return extractedId ? `/procurement?prId=${extractedId}` : '/procurement';
    }
    // Operator is restricted from procurement
    return fallbackHome;
  }

  // 3. PREVENTIVE MAINTENANCE (PM)
  // Paths: /pm/plans, /pm, or entity_type = 'pm_plans'
  const isPmPath = path === '/pm' || path.startsWith('/pm/');
  const isPmEntity = entityType === 'pm_plans' || entityType === 'pm';

  if (isPmPath || isPmEntity) {
    const extractedId =
      getQueryParam(queryString, 'planId') ||
      getQueryParam(queryString, 'id') ||
      entityId;

    // Allowed on /pm: admin, manager, technician
    if (['admin', 'manager', 'technician'].includes(userRole as string)) {
      return extractedId ? `/pm?planId=${extractedId}` : '/pm';
    }
    return fallbackHome;
  }

  // 4. RETURNABLE DELIVERY CHALLANS (RDC)
  // Paths: /rdc/:id, /rdc, or entity_type = 'rdc_challans'
  const rdcMatch = path.match(/^\/rdc(?:\/([a-zA-Z0-9_-]+))?/i);
  const isRdcEntity = entityType === 'rdc_challans' || entityType === 'rdc';

  if (rdcMatch || isRdcEntity || path === '/rdc') {
    const extractedId =
      (rdcMatch ? rdcMatch[1] : null) ||
      getQueryParam(queryString, 'challanId') ||
      getQueryParam(queryString, 'id') ||
      entityId;

    // Allowed on /rdc: admin, manager, technician, store_manager
    if (['admin', 'manager', 'technician', 'store_manager'].includes(userRole as string)) {
      return extractedId ? `/rdc?challanId=${extractedId}` : '/rdc';
    }
    return fallbackHome;
  }

  // 5. WORK ORDERS
  // Paths: /work-orders/:id, /work-orders, or entity_type = 'work_orders'
  const woMatch = path.match(/^\/work-orders(?:\/([a-zA-Z0-9_-]+))?/i);
  const isWoEntity = entityType === 'work_orders' || entityType === 'work_order';

  if (woMatch || isWoEntity || path === '/work-orders') {
    const extractedId = (woMatch ? woMatch[1] : null) || entityId;

    // Allowed on /work-orders: admin, manager, technician, store_manager
    if (['admin', 'manager', 'technician', 'store_manager'].includes(userRole as string)) {
      return extractedId ? `/work-orders/${extractedId}` : '/work-orders';
    }
    // Operator is not allowed on /work-orders; forward to operator dashboard
    if (userRole === 'operator') {
      return extractedId ? `/operator/dashboard?ticketId=${extractedId}` : '/operator/dashboard';
    }
    return fallbackHome;
  }

  // 6. PRE-SHIFT INSPECTIONS & AUDIT LOGS
  // Paths: /inspections/records/:id, /inspections/run, /inspections, or entity_type = 'preshift_inspections'
  const inspectRecordMatch = path.match(/^\/inspections\/records(?:\/([a-zA-Z0-9_-]+))?/i);
  const isInspectPath = path === '/inspections' || path.startsWith('/inspections/');
  const isInspectEntity = entityType === 'preshift_inspections' || entityType === 'inspections';

  if (inspectRecordMatch || isInspectPath || isInspectEntity) {
    const extractedId =
      (inspectRecordMatch ? inspectRecordMatch[1] : null) ||
      getQueryParam(queryString, 'record_id') ||
      getQueryParam(queryString, 'id') ||
      entityId;

    // Allowed on /inspections: operator, manager, admin, technician
    if (['operator', 'manager', 'admin', 'technician'].includes(userRole as string)) {
      if (extractedId) {
        return `/inspections/records/${extractedId}`;
      }
      if (path.includes('/run')) {
        return '/inspections/run';
      }
      return '/inspections';
    }
    return fallbackHome;
  }

  // 7. MACHINES
  // Paths: /machines, or entity_type = 'machines'
  if (path === '/machines' || path.startsWith('/machines/') || entityType === 'machines') {
    if (['admin', 'manager', 'technician', 'operator'].includes(userRole as string)) {
      return '/machines';
    }
    return fallbackHome;
  }

  // 8. INVENTORY
  if (path === '/inventory' || path.startsWith('/inventory/') || entityType === 'inventory') {
    if (['admin', 'manager', 'technician', 'store_manager'].includes(userRole as string)) {
      return '/inventory';
    }
    return fallbackHome;
  }

  // 9. DOWNTIME ANALYTICS
  if (path === '/downtime' || path.startsWith('/downtime/')) {
    if (['admin', 'manager'].includes(userRole as string)) {
      return '/downtime';
    }
    return fallbackHome;
  }

  // 10. USER MANAGEMENT / DIRECTORY
  if (path === '/users' || path.startsWith('/users/')) {
    if (userRole === 'admin') {
      return '/users';
    }
    return fallbackHome;
  }

  // 11. AUDIT LOGS
  if (path === '/audit' || path.startsWith('/audit/')) {
    if (['admin', 'manager', 'store_manager'].includes(userRole as string)) {
      return '/audit';
    }
    return fallbackHome;
  }

  // 12. ROLE DASHBOARDS
  if (path === '/dashboard' && (userRole === 'manager' || userRole === 'admin')) {
    return '/dashboard';
  }
  if (path === '/admin/dashboard' && userRole === 'admin') {
    return '/admin/dashboard';
  }
  if (path === '/technician/dashboard' && (userRole === 'technician' || userRole === 'admin')) {
    return '/technician/dashboard';
  }
  if (path === '/operator/dashboard' && (userRole === 'operator' || userRole === 'admin')) {
    return '/operator/dashboard';
  }
  if (path === '/store/dashboard' && (userRole === 'store_manager' || userRole === 'admin')) {
    return '/store/dashboard';
  }

  // If path is unknown or unauthorized, safely return the user's role home route
  return fallbackHome;
}
