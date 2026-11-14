// Safe mock environment configuration prior to imports
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://mock_user:mock_pass@localhost:5432/mock_cmms_db';
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'mock_test_jwt_secret_32_chars_long_key_strictly_for_unit_tests';
process.env.REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET || 'mock_test_refresh_token_secret_32_chars_unit_test';

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import {
  getMyNotifications,
  getUnreadNotificationCount,
  markAsRead,
  markAllNotificationsRead,
  setNotificationsDb,
  resetNotificationsDb,
  setNotificationsIo,
  resetNotificationsIo,
} from './notifications.controller';
import {
  createAndSendNotification,
  getNotificationsService,
  getUnreadCountService,
  markAsReadService,
  markAllAsReadService,
} from './notifications.service';
import {
  authenticateSocketToken,
  setSocketDb,
} from '../../config/socket';
import { AuthenticatedUser } from '../../middlewares/auth.middleware';
import {
  createBreakdownComplaintService,
  setBreakdownsServiceDb,
  setBreakdownsServiceIo,
} from '../breakdowns/breakdowns.service';
import {
  createWorkOrderFromComplaintService,
  updateWorkOrderMilestoneService,
  verifyAndCloseWorkOrderService,
  reassignWorkOrderService,
  setWorkOrdersServiceDb,
  setWorkOrdersServiceIo,
} from '../work-orders/work-orders.service';

/**
 * Mock Response Interface & Context Factory
 */
interface MockResponse {
  statusCode: number;
  responseData: any;
  headers: Record<string, any>;
  status(code: number): MockResponse;
  json(data: any): MockResponse;
  setHeader(name: string, value: any): MockResponse;
}

function createMockContext(
  body: any = {},
  params: Record<string, string> = {},
  query: Record<string, string> = {},
  headers: Record<string, string> = {},
  user?: AuthenticatedUser
): {
  req: Request;
  res: Response & MockResponse;
  next: NextFunction;
} {
  const req = {
    body,
    params,
    query,
    headers,
    user,
  } as unknown as Request;

  const res = {
    statusCode: 200,
    responseData: null,
    headers: {} as Record<string, any>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.responseData = data;
      return this;
    },
    setHeader(name: string, value: any) {
      this.headers[name] = value;
      return this;
    },
  } as Response & MockResponse;

  let nextCalledWith: any = null;
  const next = ((err?: any) => {
    nextCalledWith = err;
    if (err) {
      res.statusCode = err.statusCode || 500;
      res.responseData = { success: false, message: err.message };
    }
  }) as NextFunction;

  return { req, res, next };
}

/**
 * Mock Socket.IO Server implementation for test verification
 */
class MockSocketServer {
  public emittedEvents: { room?: string; event: string; payload: any }[] = [];

  to(room: string) {
    const self = this;
    return {
      emit(event: string, payload: any) {
        self.emittedEvents.push({ room, event, payload });
      },
    };
  }

  emit(event: string, payload: any) {
    this.emittedEvents.push({ event, payload });
  }

  clear() {
    this.emittedEvents = [];
  }
}

/**
 * In-Memory Mock Database for Complete CMMS Notification & Workflow Testing
 */
class MockDatabase {
  public users: Map<string, any> = new Map();
  public machines: Map<string, any> = new Map();
  public complaints: Map<string, any> = new Map();
  public workOrders: Map<string, any> = new Map();
  public notifications: any[] = [];
  public events: any[] = [];
  public audit: any[] = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.users.clear();
    this.machines.clear();
    this.complaints.clear();
    this.workOrders.clear();
    this.notifications = [];
    this.events = [];
    this.audit = [];

    // Seed test users with RFC-4122 compliant UUIDs
    this.users.set('f0000000-0000-0000-0000-000000000001', {
      id: 'f0000000-0000-0000-0000-000000000001',
      employee_code: 'EMP-ADM-001',
      email: 'admin@jcb.com',
      full_name: 'Rajesh Admin',
      role: 'admin',
      plant_id: 'b0000000-0000-0000-0000-000000000001',
      is_active: true,
    });
    this.users.set('f0000000-0000-0000-0000-000000000002', {
      id: 'f0000000-0000-0000-0000-000000000002',
      employee_code: 'EMP-MGR-001',
      email: 'manager@jcb.com',
      full_name: 'Vikas Manager',
      role: 'manager',
      plant_id: 'b0000000-0000-0000-0000-000000000001',
      shop_id: 'c0000000-0000-0000-0000-000000000001',
      is_active: true,
    });
    this.users.set('f0000000-0000-0000-0000-000000000003', {
      id: 'f0000000-0000-0000-0000-000000000003',
      employee_code: 'EMP-TCH-001',
      email: 'tech1@jcb.com',
      full_name: 'Sunil Technician',
      role: 'technician',
      plant_id: 'b0000000-0000-0000-0000-000000000001',
      shop_id: 'c0000000-0000-0000-0000-000000000001',
      is_active: true,
    });
    this.users.set('f0000000-0000-0000-0000-000000000004', {
      id: 'f0000000-0000-0000-0000-000000000004',
      employee_code: 'EMP-TCH-002',
      email: 'tech2@jcb.com',
      full_name: 'Amit Tech 2',
      role: 'technician',
      plant_id: 'b0000000-0000-0000-0000-000000000001',
      shop_id: 'c0000000-0000-0000-0000-000000000001',
      is_active: true,
    });
    this.users.set('f0000000-0000-0000-0000-000000000005', {
      id: 'f0000000-0000-0000-0000-000000000005',
      employee_code: 'EMP-OPR-001',
      email: 'operator@jcb.com',
      full_name: 'Ramesh Operator',
      role: 'operator',
      plant_id: 'b0000000-0000-0000-0000-000000000001',
      shop_id: 'c0000000-0000-0000-0000-000000000001',
      is_active: true,
    });
    this.users.set('f0000000-0000-0000-0000-000000000099', {
      id: 'f0000000-0000-0000-0000-000000000099',
      employee_code: 'EMP-INACT',
      email: 'inactive@jcb.com',
      full_name: 'Inactive User',
      role: 'technician',
      plant_id: 'b0000000-0000-0000-0000-000000000001',
      is_active: false,
    });

    // Seed test machine
    this.machines.set('10000000-0000-0000-0000-000000000001', {
      id: '10000000-0000-0000-0000-000000000001',
      machine_code: 'JCB-CNC-001',
      name: 'Mazak HMC 1',
      plant_id: 'b0000000-0000-0000-0000-000000000001',
      shop_id: 'c0000000-0000-0000-0000-000000000001',
      status: 'running',
    });
  }

  async query(text: string, params: any[] = []): Promise<{ rows: any[]; rowCount: number }> {
    const trimmed = text.trim();

    if (trimmed === 'BEGIN' || trimmed === 'COMMIT' || trimmed === 'ROLLBACK') {
      return { rows: [], rowCount: 0 };
    }

    if (trimmed.includes('pg_advisory_xact_lock')) {
      return { rows: [], rowCount: 0 };
    }

    // 1. SELECT users
    if (trimmed.startsWith('SELECT id, employee_code, email, role') && trimmed.includes('FROM users')) {
      const u = this.users.get(params[0]);
      if (u) {
        return { rows: [u], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    if (trimmed.includes('FROM users') && trimmed.includes("role IN ('admin', 'manager')")) {
      const mgrs = Array.from(this.users.values()).filter(
        (u) => ['admin', 'manager'].includes(u.role) && u.is_active
      );
      return { rows: mgrs, rowCount: mgrs.length };
    }

    if (trimmed.includes('SELECT id, full_name, email, role, is_active FROM users WHERE id = $1')) {
      const u = this.users.get(params[0]);
      return { rows: u ? [u] : [], rowCount: u ? 1 : 0 };
    }

    // 2. Notifications INSERT
    if (trimmed.startsWith('INSERT INTO notifications')) {
      const [recipient_id, title, message, type, link_url, entity_type, entity_id, plant_id, shop_id] = params;
      const notif = {
        id: `a0000000-0000-0000-0000-${String(this.notifications.length + 1).padStart(12, '0')}`,
        recipient_id,
        title,
        message,
        type: type || 'info',
        link_url: link_url || null,
        entity_type: entity_type || null,
        entity_id: entity_id || null,
        plant_id: plant_id || null,
        shop_id: shop_id || null,
        is_read: false,
        created_at: new Date(),
        read_at: null,
      };
      this.notifications.push(notif);
      return { rows: [notif], rowCount: 1 };
    }

    // 3. Notifications SELECT COUNT (unread)
    if (trimmed.includes('COUNT(*)::int as unread_count FROM notifications')) {
      const uid = params[0];
      const count = this.notifications.filter((n) => n.recipient_id === uid && !n.is_read).length;
      return { rows: [{ unread_count: count }], rowCount: 1 };
    }

    // 4. Notifications SELECT COUNT total
    if (trimmed.includes('COUNT(*)::int as total FROM notifications')) {
      const uid = params[0];
      let filtered = this.notifications.filter((n) => n.recipient_id === uid);
      if (params.length > 1 && typeof params[1] === 'boolean') {
        filtered = filtered.filter((n) => n.is_read === params[1]);
      }
      return { rows: [{ total: filtered.length }], rowCount: 1 };
    }

    // 5. Notifications SELECT list
    if (trimmed.startsWith('SELECT * FROM notifications')) {
      const uid = params[0];
      let filtered = this.notifications.filter((n) => n.recipient_id === uid);
      if (trimmed.includes('is_read = $2')) {
        filtered = filtered.filter((n) => n.is_read === params[1]);
      }
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return { rows: filtered, rowCount: filtered.length };
    }

    // 6. Notifications UPDATE mark as read
    if (trimmed.startsWith('UPDATE notifications') && trimmed.includes('SET is_read = true') && trimmed.includes('WHERE id = $1 AND recipient_id = $2')) {
      const [notifId, uid] = params;
      const notif = this.notifications.find((n) => n.id === notifId && n.recipient_id === uid);
      if (notif) {
        notif.is_read = true;
        notif.read_at = new Date();
        return { rows: [notif], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // 7. Check notification ownership for IDOR
    if (trimmed.startsWith('SELECT id, recipient_id FROM notifications WHERE id = $1')) {
      const notif = this.notifications.find((n) => n.id === params[0]);
      return { rows: notif ? [notif] : [], rowCount: notif ? 1 : 0 };
    }

    // 8. Notifications UPDATE mark all as read
    if (trimmed.startsWith('UPDATE notifications') && trimmed.includes('WHERE recipient_id = $1 AND is_read = false')) {
      const uid = params[0];
      const updated: any[] = [];
      this.notifications.forEach((n) => {
        if (n.recipient_id === uid && !n.is_read) {
          n.is_read = true;
          n.read_at = new Date();
          updated.push({ id: n.id });
        }
      });
      return { rows: updated, rowCount: updated.length };
    }

    // 9. Machines query
    if (trimmed.includes('FROM machines') && (trimmed.includes('m.id = $1') || trimmed.includes('WHERE id = $1') || trimmed.includes('WHERE m.id = $1'))) {
      const mid = params[0];
      const m = this.machines.get(mid);
      if (!m) return { rows: [], rowCount: 0 };
      return {
        rows: [
          {
            ...m,
            plant_id: 'b0000000-0000-0000-0000-000000000001',
            shop_name: 'CNC Machining Shop',
            plant_name: 'JCB Ballabgarh Works',
          },
        ],
        rowCount: 1,
      };
    }
    if (trimmed.startsWith('UPDATE machines SET status = $1')) {
      const m = this.machines.get(params[1]);
      if (m) m.status = params[0];
      return { rows: [m], rowCount: 1 };
    }

    // Duplicate complaint check
    if (trimmed.includes('FROM maintenance_requests') && trimmed.includes('WHERE machine_id = $1') && trimmed.includes('LOWER(issue_category)')) {
      return { rows: [], rowCount: 0 };
    }

    // Sequence for complaint number
    if (trimmed.includes('MAX(SUBSTRING(complaint_number FROM')) {
      return { rows: [{ next_seq: this.complaints.size + 1 }], rowCount: 1 };
    }

    // 10. Complaints
    if (trimmed.startsWith('INSERT INTO maintenance_requests')) {
      const compId = `20000000-0000-0000-0000-${String(this.complaints.size + 1).padStart(12, '0')}`;
      const comp = {
        id: compId,
        complaint_number: `CMP-2026-${String(this.complaints.size + 1).padStart(5, '0')}`,
        machine_id: params[0],
        reported_by_id: params[1],
        shift: params[2],
        issue_category: params[3],
        priority: params[4],
        status: 'new',
        problem_title: params[8],
        description: params[9],
        machine_code: 'JCB-CNC-001',
        plant_id: 'b0000000-0000-0000-0000-000000000001',
        shop_id: 'c0000000-0000-0000-0000-000000000001',
        created_at: new Date(),
      };
      this.complaints.set(compId, comp);
      return { rows: [comp], rowCount: 1 };
    }
    if (trimmed.includes('FROM maintenance_requests') && (trimmed.includes('r.id = $1') || trimmed.includes('WHERE id = $1') || trimmed.includes('WHERE r.id = $1'))) {
      const c = this.complaints.get(params[0]);
      if (!c) return { rows: [], rowCount: 0 };
      return {
        rows: [
          {
            ...c,
            machine_code: 'JCB-CNC-001',
            machine_name: 'Mazak HMC 1',
            plant_id: 'b0000000-0000-0000-0000-000000000001',
            shop_id: 'c0000000-0000-0000-0000-000000000001',
          },
        ],
        rowCount: 1,
      };
    }
    if (trimmed.startsWith('UPDATE maintenance_requests')) {
      const c = this.complaints.get(params[params.length - 1]);
      return { rows: [c], rowCount: 1 };
    }

    // 11. Work Orders
    if (trimmed.includes('MAX(SUBSTRING(wo_number')) {
      return { rows: [{ next_seq: this.workOrders.size + 1 }], rowCount: 1 };
    }
    if (trimmed.includes('FROM work_orders WHERE complaint_id = $1')) {
      const existing = Array.from(this.workOrders.values()).find((w) => w.complaint_id === params[0]);
      return { rows: existing ? [existing] : [], rowCount: existing ? 1 : 0 };
    }
    if (trimmed.includes('FROM work_orders') && trimmed.includes('COUNT(*)::int as count')) {
      return { rows: [{ count: 0 }], rowCount: 1 };
    }
    if (trimmed.startsWith('INSERT INTO work_orders')) {
      const woId = `30000000-0000-0000-0000-${String(this.workOrders.size + 1).padStart(12, '0')}`;
      const wo = {
        id: woId,
        wo_number: `WO-2026-${String(this.workOrders.size + 1).padStart(5, '0')}`,
        complaint_id: params[0],
        machine_id: params[1],
        assigned_technician_id: params[2],
        assigned_manager_id: params[3],
        priority: params[4],
        status: 'assigned',
        work_instructions: params[7],
        machine_code: 'JCB-CNC-001',
        plant_id: 'b0000000-0000-0000-0000-000000000001',
        shop_id: 'c0000000-0000-0000-0000-000000000001',
        created_at: new Date(),
      };
      this.workOrders.set(woId, wo);
      return { rows: [wo], rowCount: 1 };
    }
    if (trimmed.includes('FROM work_orders') && (trimmed.includes('wo.id = $1') || trimmed.includes('WHERE id = $1') || trimmed.includes('WHERE wo.id = $1'))) {
      const wo = this.workOrders.get(params[0]);
      if (!wo) return { rows: [], rowCount: 0 };
      return {
        rows: [
          {
            ...wo,
            machine_code: 'JCB-CNC-001',
            plant_id: 'b0000000-0000-0000-0000-000000000001',
            shop_id: 'c0000000-0000-0000-0000-000000000001',
          },
        ],
        rowCount: 1,
      };
    }
    if (trimmed.startsWith('UPDATE work_orders')) {
      const id = params[0] || params[params.length - 1];
      const wo = this.workOrders.get(id) || Array.from(this.workOrders.values())[0];
      if (wo) {
        if (trimmed.includes("status = 'accepted'")) wo.status = 'accepted';
        if (trimmed.includes("assigned_technician_id = NULL")) wo.assigned_technician_id = null;
        if (trimmed.includes("status = 'submitted_verification'")) wo.status = 'submitted_verification';
        if (trimmed.includes("status = 'verified_closed'")) wo.status = 'verified_closed';
        if (trimmed.includes("status = 'rework_required'")) wo.status = 'rework_required';
        if (trimmed.includes("assigned_technician_id = $1")) wo.assigned_technician_id = params[0];
        return { rows: [{ ...wo }], rowCount: 1 };
      }
    }

    // 12. Audit & Events
    if (trimmed.startsWith('INSERT INTO audit_logs')) {
      this.audit.push(params);
      return { rows: [{ id: `aud-${this.audit.length}` }], rowCount: 1 };
    }
    if (trimmed.startsWith('INSERT INTO work_order_events')) {
      this.events.push(params);
      return { rows: [{ id: `evt-${this.events.length}` }], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  }

  getPool() {
    const self = this;
    return {
      async query(text: string, params: any[] = []) {
        return self.query(text, params);
      },
      async connect() {
        return {
          async query(text: string, params: any[] = []) {
            return self.query(text, params);
          },
          release() {},
        };
      },
    };
  }
}

describe('JCB Real-Time Notification & Socket.IO Architecture Test Suite', () => {
  let mockDb: MockDatabase;
  let mockIo: MockSocketServer;

  beforeEach(() => {
    mockDb = new MockDatabase();
    mockIo = new MockSocketServer();

    setNotificationsDb(mockDb.query.bind(mockDb), mockDb.getPool() as any);
    setNotificationsIo(mockIo);
    setSocketDb(mockDb.query.bind(mockDb));
    setBreakdownsServiceDb(mockDb.query.bind(mockDb), mockDb.getPool() as any);
    setBreakdownsServiceIo(mockIo);
    setWorkOrdersServiceDb(mockDb.query.bind(mockDb), mockDb.getPool() as any);
    setWorkOrdersServiceIo(mockIo);
  });

  // =========================================================================
  // 1. Socket.IO Authentication & Room Security
  // =========================================================================
  describe('1. Socket.IO Authentication & Room Security', () => {
    it('1.1. Valid JWT successfully authenticates and returns verified user identity', async () => {
      const user = mockDb.users.get('f0000000-0000-0000-0000-000000000003');
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET!,
        { algorithm: 'HS256', expiresIn: '1h' }
      );

      const authenticated = await authenticateSocketToken(token);
      assert.equal(authenticated.id, user.id);
      assert.equal(authenticated.role, 'technician');
      assert.equal(authenticated.email, user.email);
    });

    it('1.2. Invalid signature or malformed JWT is rejected with authentication error', async () => {
      await assert.rejects(
        async () => {
          await authenticateSocketToken('invalid.token.string');
        },
        {
          name: 'JsonWebTokenError',
        }
      );
    });

    it('1.3. Expired JWT is rejected immediately', async () => {
      const user = mockDb.users.get('f0000000-0000-0000-0000-000000000003');
      const expiredToken = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET!,
        { algorithm: 'HS256', expiresIn: '-1s' }
      );

      await assert.rejects(
        async () => {
          await authenticateSocketToken(expiredToken);
        },
        {
          name: 'TokenExpiredError',
        }
      );
    });

    it('1.4. Inactive user account is rejected even with a signed JWT', async () => {
      const inactiveUser = mockDb.users.get('f0000000-0000-0000-0000-000000000099');
      const token = jwt.sign(
        { id: inactiveUser.id, email: inactiveUser.email, role: inactiveUser.role },
        process.env.JWT_SECRET!,
        { algorithm: 'HS256', expiresIn: '1h' }
      );

      await assert.rejects(
        async () => {
          await authenticateSocketToken(token);
        },
        /inactive/i
      );
    });
  });

  // =========================================================================
  // 2. Notification Persistence & REST APIs
  // =========================================================================
  describe('2. Notification Persistence & REST APIs', () => {
    it('2.1. Notifications are persisted in DB before dispatching real-time socket events', async () => {
      const created = await createAndSendNotification(
        {
          recipientId: 'f0000000-0000-0000-0000-000000000003',
          title: 'Hydraulic Inspection Required',
          message: 'Please inspect HMC Mazak hydraulic oil pressure.',
          type: 'warning',
          linkUrl: '/machines/10000000-0000-0000-0000-000000000001',
        },
        mockDb as any,
        mockIo
      );

      assert.ok(created.id);
      assert.equal(mockDb.notifications.length, 1);
      assert.equal(mockDb.notifications[0].title, 'Hydraulic Inspection Required');

      // Socket event was dispatched to the private user room
      const userEvent = mockIo.emittedEvents.find(
        (e) => e.room === 'user:f0000000-0000-0000-0000-000000000003' && e.event === 'notification:new'
      );
      assert.ok(userEvent);
      assert.equal(userEvent.payload.title, 'Hydraulic Inspection Required');
    });

    it('2.2. Unread notification count returns accurate numbers', async () => {
      const techId = 'f0000000-0000-0000-0000-000000000003';
      const mgrId = 'f0000000-0000-0000-0000-000000000002';

      await createAndSendNotification(
        { recipientId: techId, title: 'Task 1', message: 'First msg' },
        mockDb as any,
        mockIo
      );
      await createAndSendNotification(
        { recipientId: techId, title: 'Task 2', message: 'Second msg' },
        mockDb as any,
        mockIo
      );
      await createAndSendNotification(
        { recipientId: mgrId, title: 'Mgr Task', message: 'Different user' },
        mockDb as any,
        mockIo
      );

      const countRes = await getUnreadCountService(techId, mockDb as any);
      assert.equal(countRes.unread_count, 2);

      // Verify REST controller
      const { req, res, next } = createMockContext({}, {}, {}, {}, { id: techId, role: 'technician', email: 'tech1@jcb.com', employee_code: 'EMP-TCH-001' });
      await getUnreadNotificationCount(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.unread_count, 2);
    });

    it('2.3. Mark as read updates DB, decrements unread count, and emits socket event', async () => {
      const techId = 'f0000000-0000-0000-0000-000000000003';
      const notif = await createAndSendNotification(
        { recipientId: techId, title: 'Alert A', message: 'Check oil' },
        mockDb as any,
        mockIo
      );

      const { req, res, next } = createMockContext(
        {},
        { id: notif.id },
        {},
        {},
        { id: techId, role: 'technician', email: 'tech1@jcb.com', employee_code: 'EMP-TCH-001' }
      );
      await markAsRead(req, res, next);

      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.equal(mockDb.notifications[0].is_read, true);

      // Verify read event emission
      const readEvent = mockIo.emittedEvents.find(
        (e) => e.room === `user:${techId}` && e.event === 'notification:read'
      );
      assert.ok(readEvent);
    });

    it('2.4. IDOR Protection: User cannot mark another user notification as read (HTTP 403)', async () => {
      const mgrId = 'f0000000-0000-0000-0000-000000000002';
      const techId = 'f0000000-0000-0000-0000-000000000003';

      const notif = await createAndSendNotification(
        { recipientId: mgrId, title: 'Manager Secret', message: 'Confidential' },
        mockDb as any,
        mockIo
      );

      // Tech-1 attempts to mark Manager-1's notification as read
      const { req, res, next } = createMockContext(
        {},
        { id: notif.id },
        {},
        {},
        { id: techId, role: 'technician', email: 'tech1@jcb.com', employee_code: 'EMP-TCH-001' }
      );
      await markAsRead(req, res, next);

      assert.equal(res.statusCode, 403);
      assert.equal(mockDb.notifications[0].is_read, false);
    });

    it('2.5. Mark all as read updates all unread notifications for recipient', async () => {
      const techId = 'f0000000-0000-0000-0000-000000000003';
      await createAndSendNotification(
        { recipientId: techId, title: 'N1', message: 'M1' },
        mockDb as any,
        mockIo
      );
      await createAndSendNotification(
        { recipientId: techId, title: 'N2', message: 'M2' },
        mockDb as any,
        mockIo
      );

      const { req, res, next } = createMockContext(
        {},
        {},
        {},
        {},
        { id: techId, role: 'technician', email: 'tech1@jcb.com', employee_code: 'EMP-TCH-001' }
      );
      await markAllNotificationsRead(req, res, next);

      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.updated_count, 2);
      assert.ok(mockDb.notifications.every((n) => n.recipient_id !== techId || n.is_read));
    });

    it('2.6. Pagination and filtering returns scoped notifications', async () => {
      const techId = 'f0000000-0000-0000-0000-000000000003';
      await createAndSendNotification(
        { recipientId: techId, title: 'Crit 1', message: 'M1', type: 'critical' },
        mockDb as any,
        mockIo
      );
      await createAndSendNotification(
        { recipientId: techId, title: 'Warn 1', message: 'M2', type: 'warning' },
        mockDb as any,
        mockIo
      );

      const { req, res, next } = createMockContext(
        {},
        {},
        { limit: '10', page: '1' },
        {},
        { id: techId, role: 'technician', email: 'tech1@jcb.com', employee_code: 'EMP-TCH-001' }
      );
      await getMyNotifications(req, res, next);

      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.data.length, 2);
      assert.equal(res.responseData.pagination.total, 2);
    });
  });

  // =========================================================================
  // 3. End-to-End Maintenance Workflow Notification Lifecycle (5 Stages)
  // =========================================================================
  describe('3. End-to-End Maintenance Workflow Notification Lifecycle (5 Stages)', () => {
    it('3.1. Stage 1: Operator reports breakdown -> Manager receives immediate notification & socket alert', async () => {
      const operatorUser = mockDb.users.get('f0000000-0000-0000-0000-000000000005');
      const complaint = await createBreakdownComplaintService(
        {
          machine_id: '10000000-0000-0000-0000-000000000001',
          issue_category: 'hydraulic',
          priority: 'high',
          problem_title: 'Hydraulic leak on Line 4',
          description: 'High pressure hose leaking near boom cylinder.',
        },
        operatorUser,
        mockDb.getPool() as any,
        mockIo
      );

      assert.ok(complaint.id);

      // Verify manager received persistent notification
      const mgrNotif = mockDb.notifications.find((n) => n.recipient_id === 'f0000000-0000-0000-0000-000000000002');
      assert.ok(mgrNotif);
      assert.match(mgrNotif.message, /JCB-CNC-001/);
      assert.match(mgrNotif.message, /Ramesh Operator/);
      assert.equal(mgrNotif.link_url, `/triage?breakdownId=${complaint.id}`);

      // Verify real-time socket event dispatched to user room
      const socketEvt = mockIo.emittedEvents.find(
        (e) => e.room === 'user:f0000000-0000-0000-0000-000000000002' && e.event === 'notification:new'
      );
      assert.ok(socketEvt);
    });

    it('3.2. Stage 1 Critical: Critical breakdown triggers escalation to Plant Managers and Admins', async () => {
      const operatorUser = mockDb.users.get('f0000000-0000-0000-0000-000000000005');
      mockIo.clear();

      await createBreakdownComplaintService(
        {
          machine_id: '10000000-0000-0000-0000-000000000001',
          issue_category: 'electrical',
          priority: 'critical',
          problem_title: 'Spindle Drive Electrical Fire',
          description: 'Spindle inverter burned out.',
        },
        operatorUser,
        mockDb.getPool() as any,
        mockIo
      );

      // Check admin and plant room broadcasts
      const adminCriticalEvt = mockIo.emittedEvents.find(
        (e) => e.room === 'role:admin' && e.event === 'complaint:critical'
      );
      assert.ok(adminCriticalEvt);
    });

    it('3.3. Stage 2: Manager creates work order -> Assigned technician receives targeted notification', async () => {
      const managerUser = mockDb.users.get('f0000000-0000-0000-0000-000000000002');
      mockIo.clear();

      // Create complaint first
      const compId = '20000000-0000-0000-0000-000000000010';
      const comp = {
        id: compId,
        complaint_number: 'CMP-2026-00010',
        machine_id: '10000000-0000-0000-0000-000000000001',
        reported_by_id: 'f0000000-0000-0000-0000-000000000005',
        machine_code: 'JCB-CNC-001',
        plant_id: 'b0000000-0000-0000-0000-000000000001',
        shop_id: 'c0000000-0000-0000-0000-000000000001',
        status: 'new',
      };
      mockDb.complaints.set(compId, comp);

      const { workOrder } = await createWorkOrderFromComplaintService(
        {
          complaint_id: compId,
          technician_id: 'f0000000-0000-0000-0000-000000000003',
          sla_hours: 4,
          work_instructions: 'Replace hydraulic hose on axis Z.',
          user: managerUser,
        },
        mockDb.getPool() as any,
        mockIo
      );

      assert.ok(workOrder.id);

      // Verify technician received notification
      const techNotif = mockDb.notifications.find(
        (n) => n.recipient_id === 'f0000000-0000-0000-0000-000000000003' && n.title === 'New Work Order Assigned'
      );
      assert.ok(techNotif);

      // Verify socket event to user room
      const techEvt = mockIo.emittedEvents.find(
        (e) => e.room === 'user:f0000000-0000-0000-0000-000000000003' && e.event === 'technician:assigned'
      );
      assert.ok(techEvt);
    });

    it('3.4. Stage 3: Technician accepts work order -> Manager receives acceptance notification', async () => {
      const techUser = mockDb.users.get('f0000000-0000-0000-0000-000000000003');
      const mgrId = 'f0000000-0000-0000-0000-000000000002';
      const woId = '30000000-0000-0000-0000-000000000001';
      mockIo.clear();

      const wo = {
        id: woId,
        wo_number: 'WO-2026-00001',
        complaint_id: '20000000-0000-0000-0000-000000000001',
        machine_id: '10000000-0000-0000-0000-000000000001',
        assigned_technician_id: techUser.id,
        assigned_manager_id: mgrId,
        machine_code: 'JCB-CNC-001',
        status: 'assigned',
        plant_id: 'b0000000-0000-0000-0000-000000000001',
        shop_id: 'c0000000-0000-0000-0000-000000000001',
      };
      mockDb.workOrders.set(woId, wo);

      const accepted = await updateWorkOrderMilestoneService(
        woId,
        { action: 'ACCEPT' },
        techUser,
        mockDb.getPool() as any,
        mockIo
      );

      assert.equal(accepted.status, 'accepted');

      // Verify manager notification
      const mgrNotif = mockDb.notifications.find(
        (n) => n.recipient_id === mgrId && n.title === 'Work Order Accepted'
      );
      assert.ok(mgrNotif);
      assert.match(mgrNotif.message, /accepted work order/i);

      // Verify socket event
      const acceptEvt = mockIo.emittedEvents.find(
        (e) => e.room === `user:${mgrId}` && e.event === 'work_order:accepted'
      );
      assert.ok(acceptEvt);
    });

    it('3.5. Stage 3 Alternative: Technician declines job -> Manager receives decline reason', async () => {
      const techUser = mockDb.users.get('f0000000-0000-0000-0000-000000000003');
      const mgrId = 'f0000000-0000-0000-0000-000000000002';
      const woId = '30000000-0000-0000-0000-000000000002';
      mockIo.clear();

      const wo = {
        id: woId,
        wo_number: 'WO-2026-00002',
        complaint_id: '20000000-0000-0000-0000-000000000001',
        machine_id: '10000000-0000-0000-0000-000000000001',
        assigned_technician_id: techUser.id,
        assigned_manager_id: mgrId,
        machine_code: 'JCB-CNC-001',
        status: 'assigned',
        plant_id: 'b0000000-0000-0000-0000-000000000001',
        shop_id: 'c0000000-0000-0000-0000-000000000001',
      };
      mockDb.workOrders.set(woId, wo);

      const declined = await updateWorkOrderMilestoneService(
        woId,
        { action: 'DECLINE', notes: 'Currently resolving critical spindle breakdown on Bay 1.' },
        techUser,
        mockDb.getPool() as any,
        mockIo
      );

      assert.equal(declined.assigned_technician_id, null);

      // Verify manager received decline notification
      const declNotif = mockDb.notifications.find(
        (n) => n.recipient_id === mgrId && n.title === 'Work Order Assignment Declined'
      );
      assert.ok(declNotif);
      assert.match(declNotif.message, /Bay 1/);
    });

    it('3.6. Stage 4: Technician submits repair report -> Manager receives verification request', async () => {
      const techUser = mockDb.users.get('f0000000-0000-0000-0000-000000000003');
      const mgrId = 'f0000000-0000-0000-0000-000000000002';
      const woId = '30000000-0000-0000-0000-000000000003';
      mockIo.clear();

      const wo = {
        id: woId,
        wo_number: 'WO-2026-00003',
        complaint_id: '20000000-0000-0000-0000-000000000001',
        machine_id: '10000000-0000-0000-0000-000000000001',
        assigned_technician_id: techUser.id,
        assigned_manager_id: mgrId,
        machine_code: 'JCB-CNC-001',
        status: 'in_progress',
        plant_id: 'b0000000-0000-0000-0000-000000000001',
        shop_id: 'c0000000-0000-0000-0000-000000000001',
      };
      mockDb.workOrders.set(woId, wo);

      const submitted = await updateWorkOrderMilestoneService(
        woId,
        {
          action: 'COMPLETE',
          diagnosis: 'Worn cylinder seal',
          corrective_action: 'Replaced hydraulic piston seals and re-pressurized line.',
          technician_remarks: 'Hydraulic seals replaced and bled system.',
        },
        techUser,
        mockDb.getPool() as any,
        mockIo
      );

      assert.equal(submitted.status, 'submitted_verification');

      // Verify manager notification
      const verifNotif = mockDb.notifications.find(
        (n) => n.recipient_id === mgrId && n.title === 'Repair Submitted for Verification'
      );
      assert.ok(verifNotif);
      assert.match(verifNotif.message, /Repair submitted for verification/);
    });

    it('3.7. Stage 5: Manager verifies & approves repair -> Operator receives resolution notification', async () => {
      const managerUser = mockDb.users.get('f0000000-0000-0000-0000-000000000002');
      const techId = 'f0000000-0000-0000-0000-000000000003';
      const oprId = 'f0000000-0000-0000-0000-000000000005';
      const compId = '20000000-0000-0000-0000-000000000004';
      const woId = '30000000-0000-0000-0000-000000000004';
      mockIo.clear();

      // Complaint linked to operator
      const comp = {
        id: compId,
        complaint_number: 'CMP-2026-VERIF',
        machine_id: '10000000-0000-0000-0000-000000000001',
        reported_by_id: oprId,
        status: 'in_progress',
      };
      mockDb.complaints.set(compId, comp);

      const wo = {
        id: woId,
        wo_number: 'WO-2026-00004',
        complaint_id: compId,
        machine_id: '10000000-0000-0000-0000-000000000001',
        assigned_technician_id: techId,
        assigned_manager_id: managerUser.id,
        machine_code: 'JCB-CNC-001',
        status: 'submitted_verification',
        plant_id: 'b0000000-0000-0000-0000-000000000001',
        shop_id: 'c0000000-0000-0000-0000-000000000001',
      };
      mockDb.workOrders.set(woId, wo);

      const verified = await verifyAndCloseWorkOrderService(
        woId,
        { result: 'APPROVED', remarks: 'Pressure test passed. No leakage observed.' },
        managerUser,
        mockDb.getPool() as any,
        mockIo
      );

      assert.equal(verified.status, 'verified_closed');

      // Verify technician received closed notice
      const techNotif = mockDb.notifications.find(
        (n) => n.recipient_id === techId && n.title === 'Work Order Approved & Closed'
      );
      assert.ok(techNotif);

      // Verify operator received repair verification notification
      const oprNotif = mockDb.notifications.find(
        (n) => n.recipient_id === oprId && n.title === 'Machine Repair Verified'
      );
      assert.ok(oprNotif);
      assert.match(oprNotif.message, /repaired and verified/i);
      assert.equal(oprNotif.link_url, `/operator/dashboard?ticketId=${wo.complaint_id}`);

      // Verify real-time socket event for operator
      const oprSocketEvt = mockIo.emittedEvents.find(
        (e) => e.room === `user:${oprId}` && e.event === 'repair:verified'
      );
      assert.ok(oprSocketEvt);
    });

    it('3.8. Stage 5 Alternative: Manager rejects repair -> Technician receives rework notification with remarks', async () => {
      const managerUser = mockDb.users.get('f0000000-0000-0000-0000-000000000002');
      const techId = 'f0000000-0000-0000-0000-000000000003';
      const woId = '30000000-0000-0000-0000-000000000005';
      mockIo.clear();

      const wo = {
        id: woId,
        wo_number: 'WO-2026-00005',
        complaint_id: '20000000-0000-0000-0000-000000000001',
        machine_id: '10000000-0000-0000-0000-000000000001',
        assigned_technician_id: techId,
        assigned_manager_id: managerUser.id,
        machine_code: 'JCB-CNC-001',
        status: 'submitted_verification',
        plant_id: 'b0000000-0000-0000-0000-000000000001',
        shop_id: 'c0000000-0000-0000-0000-000000000001',
      };
      mockDb.workOrders.set(woId, wo);

      const reworked = await verifyAndCloseWorkOrderService(
        woId,
        { result: 'REJECTED', remarks: 'Oil pressure unstable at 120 bar. Re-torque fittings.' },
        managerUser,
        mockDb.getPool() as any,
        mockIo
      );

      assert.equal(reworked.status, 'rework_required');

      // Verify technician received rework notice with mandatory remarks
      const techNotif = mockDb.notifications.find(
        (n) => n.recipient_id === techId && n.title === 'Work Order Rework Requested'
      );
      assert.ok(techNotif);
      assert.match(techNotif.message, /Re-torque fittings/);
    });

    it('3.9. Reassignment: Manager reassigns technician -> New technician receives notification', async () => {
      const managerUser = mockDb.users.get('f0000000-0000-0000-0000-000000000002');
      const tech1Id = 'f0000000-0000-0000-0000-000000000003';
      const tech2Id = 'f0000000-0000-0000-0000-000000000004';
      const woId = '30000000-0000-0000-0000-000000000006';
      mockIo.clear();

      const wo = {
        id: woId,
        wo_number: 'WO-2026-00006',
        complaint_id: '20000000-0000-0000-0000-000000000001',
        machine_id: '10000000-0000-0000-0000-000000000001',
        assigned_technician_id: tech1Id,
        assigned_manager_id: managerUser.id,
        machine_code: 'JCB-CNC-001',
        status: 'assigned',
        plant_id: 'b0000000-0000-0000-0000-000000000001',
        shop_id: 'c0000000-0000-0000-0000-000000000001',
      };
      mockDb.workOrders.set(woId, wo);

      const reassigned = await reassignWorkOrderService(
        woId,
        { new_technician_id: tech2Id, notes: 'Sunil is on emergency shift. Handed to Amit.' },
        managerUser,
        mockDb.getPool() as any,
        mockIo
      );

      assert.equal(reassigned.assigned_technician_id, tech2Id);

      // Verify new technician received reassignment notification
      const newTechNotif = mockDb.notifications.find(
        (n) => n.recipient_id === tech2Id && n.title === 'Work Order Reassigned'
      );
      assert.ok(newTechNotif);
    });
  });

  describe('4. Notification Redirection & Role-Aware Navigation Contracts', () => {
    it('4.1. RDC notification dispatch populates canonical linkUrl with challanId', async () => {
      mockIo.clear();
      const challanId = '55555555-5555-5555-5555-555555555555';
      const recipientId = 'f0000000-0000-0000-0000-000000000002'; // Manager

      const created = await createAndSendNotification(
        {
          recipientId,
          title: 'Delivery Challan Submitted',
          message: 'Challan RDC-2026-0001 submitted for your review.',
          type: 'approval',
          linkUrl: `/rdc?challanId=${challanId}`,
          entityType: 'rdc_challans',
          entityId: challanId,
        },
        mockDb.getPool() as any,
        mockIo
      );

      assert.ok(created.id);
      assert.equal(created.link_url, `/rdc?challanId=${challanId}`);
      assert.equal(created.entity_type, 'rdc_challans');
      assert.equal(created.entity_id, challanId);
    });

    it('4.2. Work order repair verification notification routes operator to operator dashboard with ticketId', async () => {
      const compId = '20000000-0000-0000-0000-000000000099';
      const oprId = 'f0000000-0000-0000-0000-000000000005';
      const woId = '30000000-0000-0000-0000-000000000099';
      mockIo.clear();

      mockDb.complaints.set(compId, {
        id: compId,
        complaint_number: 'CMP-2026-00099',
        machine_id: '10000000-0000-0000-0000-000000000001',
        reported_by_id: oprId,
        status: 'in_progress',
      });

      mockDb.workOrders.set(woId, {
        id: woId,
        wo_number: 'WO-2026-00099',
        complaint_id: compId,
        machine_id: '10000000-0000-0000-0000-000000000001',
        assigned_technician_id: 'f0000000-0000-0000-0000-000000000003',
        assigned_manager_id: 'f0000000-0000-0000-0000-000000000002',
        machine_code: 'JCB-CNC-001',
        status: 'submitted_verification',
        plant_id: 'b0000000-0000-0000-0000-000000000001',
        shop_id: 'c0000000-0000-0000-0000-000000000001',
      });

      await verifyAndCloseWorkOrderService(
        woId,
        { result: 'APPROVED', remarks: 'Repaired and verified.' },
        mockDb.users.get('f0000000-0000-0000-0000-000000000002'),
        mockDb.getPool() as any,
        mockIo
      );

      const oprNotif = mockDb.notifications.find(
        (n) => n.recipient_id === oprId && n.title === 'Machine Repair Verified'
      );
      assert.ok(oprNotif);
      assert.equal(oprNotif.link_url, `/operator/dashboard?ticketId=${compId}`);
    });

    it('4.3. Breakdown reported to manager points to /triage?breakdownId=...', async () => {
      mockIo.clear();
      const operatorUser = mockDb.users.get('f0000000-0000-0000-0000-000000000005');

      const complaint = await createBreakdownComplaintService(
        {
          machine_id: '10000000-0000-0000-0000-000000000001',
          issue_category: 'mechanical',
          priority: 'high',
          problem_title: 'Spindle bearing vibration',
          description: 'Spindle bearing abnormal noise and vibration.',
        },
        operatorUser,
        mockDb.getPool() as any,
        mockIo
      );

      assert.ok(complaint.id);
      const mgrNotif = mockDb.notifications.find(
        (n) => n.recipient_id === 'f0000000-0000-0000-0000-000000000002' && n.title === 'New Breakdown Reported'
      );
      assert.ok(mgrNotif);
      assert.equal(mgrNotif.link_url, `/triage?breakdownId=${complaint.id}`);
    });
  });
});
