# JCB Smart CMMS — Complete API Inventory
**Document ID:** `02-API-INVENTORY.md`  
**Date:** November 4, 2026  
**Auditor Roles:** Senior Backend Architect, Database Architect, Application Security Engineer, QA Automation Engineer  
**Scope:** Route Definitions, Controllers, Parameter Bindings, Auth Guards, and Runtime Operational Status  

---

## 1. API Inventory Summary Metrics

- **Total Registered HTTP Routes:** **48 endpoints** (46 business module routes + 2 root diagnostics)
- **Functional:** **18 endpoints (37.5%)** — Code executes correctly against the live database without schema or runtime failures.
- **Partially Functional:** **20 endpoints (41.7%)** — Connects to existing database tables, but exhibits security flaws (missing RBAC, lack of tenant scoping), pagination count bugs, concurrency race conditions, or unhandled errors.
- **Broken (Runtime 500 Failures):** **8 endpoints (16.7%)** — Fails immediately upon invocation due to missing database tables (`bays`, `production_lines`, `inspection_templates`, `inspection_records`, `notifications`, `audit_logs`) or column mismatches (`wo_parts_consumed.is_installed`).
- **Missing Enterprise Endpoints:** **12+ critical endpoints** identified as missing from the backend controllers for real-world CMMS operation.

---

## 2. Complete Endpoint Inventory Table

| Module | Endpoint | Method | Controller Handler | Authentication | Role Authorization | Status | Technical Details & Findings |
|---|---|---|---|---|---|---|---|
| **System** | `/health` | `GET` | Inline in `app.ts:32` | None (Public) | None | **Functional** | Returns uptime, timestamp, and health status JSON. |
| **System** | `/api/v1` | `GET` | Inline in `app.ts:41` | None (Public) | None | **Functional** | Returns catalog of all 14 enterprise modules. |
| **Auth** | `/api/v1/auth/login` | `POST` | `login` (`auth.controller.ts:53`) | None (Public) | None | **Partially Functional** | Connects to `users` table; contains backdoor password bypass (`password123`) and fallback bypass dict. |
| **Auth** | `/api/v1/auth/profile` | `GET` | `getProfile` (`auth.controller.ts:136`) | Bearer JWT | All Roles | **Partially Functional** | Queries user details; silently catches DB errors and returns mock profile. |
| **Auth** | `/api/v1/auth/users` | `GET` | `getUsers` (`auth.controller.ts:173`) | Bearer JWT | `admin` | **Functional** | Correctly queries `users` ordered by `created_at DESC`. |
| **Auth** | `/api/v1/auth/users` | `POST` | `createUser` (`auth.controller.ts:186`) | Bearer JWT | `admin` | **Partially Functional** | Creates user; defaults password to `password123`; does not accept `plant_id` or `shop_id`. |
| **Auth** | `/api/v1/auth/users/:id` | `PUT` | `updateUser` (`auth.controller.ts:230`) | Bearer JWT | `admin` | **Functional** | Updates user profile fields; handles 404 for missing ID. |
| **Auth** | `/api/v1/auth/users/:id` | `DELETE` | `deleteUser` (`auth.controller.ts:265`) | Bearer JWT | `admin` | **Functional** | Soft deletes user (`is_active = false`); handles 404. |
| **Org** | `/api/v1/org/hierarchy` | `GET` | `getHierarchy` (`org.controller.ts:4`) | Bearer JWT | All Roles | **Broken** | **Fatal Error:** Queries `bays` and `production_lines` which do not exist in PostgreSQL. Throws 500 error. |
| **Org** | `/api/v1/org/plants` | `GET` | `getPlants` (`org.controller.ts:25`) | Bearer JWT | All Roles | **Functional** | Returns all active plants from `plants` table. |
| **Org** | `/api/v1/org/plants/:plantId/shops` | `GET` | `getShopsByPlant` (`org.controller.ts:34`) | Bearer JWT | All Roles | **Functional** | Returns shops belonging to plant ID parameter. |
| **Machines** | `/api/v1/machines` | `GET` | `getMachines` (`machines.controller.ts:55`) | Bearer JWT | All Roles | **Partially Functional** | List & filters work; `total` count query ignores query filters; returns mock data on DB error. |
| **Machines** | `/api/v1/machines/qr/:uid` | `GET` | `getMachineByQR` (`machines.controller.ts:118`) | Bearer JWT | All Roles | **Partially Functional** | Queries by `qr_code_uid` or `machine_code`; returns hardcoded fallback machine if DB fails. |
| **Machines** | `/api/v1/machines/:id` | `GET` | `getMachineById` (`machines.controller.ts:153`) | Bearer JWT | All Roles | **Partially Functional** | Queries by UUID; returns fallback machine if DB fails; handles 404. |
| **Machines** | `/api/v1/machines` | `POST` | `createMachine` (`machines.controller.ts:184`) | Bearer JWT | `admin` | **Partially Functional** | Inserts asset; if `shop_id` is missing, arbitrarily binds to first shop (`LIMIT 1`). |
| **Machines** | `/api/v1/machines/:id` | `PUT` | `updateMachine` (`machines.controller.ts:249`) | Bearer JWT | `admin` | **Functional** | Updates machine metadata; returns 404 if not found. |
| **Machines** | `/api/v1/machines/:id` | `DELETE` | `deleteMachine` (`machines.controller.ts:296`) | Bearer JWT | `admin` | **Partially Functional** | Checks `work_orders`, but omits `maintenance_requests`; foreign key crash if complaints exist. |
| **Breakdowns** | `/api/v1/breakdowns` | `POST` | `reportBreakdown` (`breakdowns.controller.ts:5`) | Bearer JWT | All Roles | **Partially Functional** | Checks duplicates; updates machine; emits socket event. Sequence generation has concurrency race condition. |
| **Breakdowns** | `/api/v1/breakdowns` | `GET` | `getBreakdowns` (`breakdowns.controller.ts:108`) | Bearer JWT | All Roles | **Functional** | Filters by status/priority/shop; pagination works. |
| **Work Orders** | `/api/v1/work-orders` | `GET` | `getWorkOrders` (`work-orders.controller.ts:200`) | Bearer JWT | All Roles | **Functional** | Returns joined work orders; filters by technician, status, priority. |
| **Work Orders** | `/api/v1/work-orders/assign` | `POST` | `createWorkOrderFromComplaint` (`work-orders.controller.ts:5`) | Bearer JWT | **Missing (All Roles)** | **Partially Functional** | **BAC Risk:** No role restriction (operators can assign). Sequence generation race condition; no transaction. |
| **Work Orders** | `/api/v1/work-orders/:id/milestone` | `POST` | `updateWorkOrderMilestone` (`work-orders.controller.ts:81`) | Bearer JWT | **Missing (All Roles)** | **Partially Functional** | **BAC Risk:** No role check. Missing 404 check before inserting into `work_order_events`. |
| **Work Orders** | `/api/v1/work-orders/:id/verify` | `POST` | `verifyAndCloseWorkOrder` (`work-orders.controller.ts:148`) | Bearer JWT | **Missing (All Roles)** | **Partially Functional** | **BAC Risk:** Technicians can verify own work. Updates machine status & calculates downtime via trigger. |
| **Inventory** | `/api/v1/inventory/search` | `GET` | `searchParts` (`inventory.controller.ts:79`) | Bearer JWT | All Roles | **Functional** | Utilizes GIN trigram indexes; pagination works; returns fallback array if DB fails. |
| **Inventory** | `/api/v1/inventory/reserve` | `POST` | `reservePartForWorkOrder` (`inventory.controller.ts:148`) | Bearer JWT | `admin`, `manager`, `technician` | **Broken** | **Fatal Error:** Inserts into `wo_parts_consumed(..., is_installed)`. Column does not exist. Catches error and returns fake Demo response. |
| **Inventory** | `/api/v1/inventory/adjust` | `POST` | `adjustStock` (`inventory.controller.ts:339`) | Bearer JWT | `admin`, `manager` | **Partially Functional** | Updates stock; writes to audit ledger. No database transaction; negative values unvalidated. |
| **Inventory** | `/api/v1/inventory` | `POST` | `createSparePart` (`inventory.controller.ts:197`) | Bearer JWT | `admin` | **Functional** | Inserts new SKU; handles duplicate part number conflict (409). |
| **Inventory** | `/api/v1/inventory/:id` | `PUT` | `updateSparePart` (`inventory.controller.ts:260`) | Bearer JWT | `admin` | **Functional** | Updates spare part attributes; handles 404. |
| **Inventory** | `/api/v1/inventory/:id` | `DELETE` | `deleteSparePart` (`inventory.controller.ts:305`) | Bearer JWT | `admin` | **Functional** | Checks `wo_parts_consumed` usage; deactivates if historical usage exists; handles 404. |
| **Procurement** | `/api/v1/procurement/pr` | `POST` | `createPurchaseRequisition` (`procurement.controller.ts:6`) | Bearer JWT | **Missing (All Roles)** | **Partially Functional** | Inserts PR; updates linked WO status. Concurrency race on sequence; missing role guard. |
| **Procurement** | `/api/v1/procurement/pr` | `GET` | `getPurchaseRequisitions` (`procurement.controller.ts:61`) | Bearer JWT | All Roles | **Functional** | Lists PRs joined with spare parts and user records. |
| **Procurement** | `/api/v1/procurement/pr/:id` | `PUT` | `updatePRStatus` (`procurement.controller.ts:92`) | Bearer JWT | **Missing (All Roles)** | **Partially Functional** | **BAC Risk:** Any role can approve PRs and set PO numbers. No role restriction. |
| **Procurement** | `/api/v1/procurement/pr/:id/grn` | `POST` | `processGRNInward` (`procurement.controller.ts:124`) | Bearer JWT | **Missing (All Roles)** | **Partially Functional** | **BAC Risk:** Any role can inward GRN. Increments physical stock; resumes WO; no transaction. |
| **RDC** | `/api/v1/rdc` | `POST` | `createRDC` (`rdc.controller.ts:4`) | Bearer JWT | **Missing (All Roles)** | **Partially Functional** | Creates challan; inserts line items in loop. No transaction; sequence race condition. |
| **RDC** | `/api/v1/rdc` | `GET` | `getRDCs` (`rdc.controller.ts:74`) | Bearer JWT | All Roles | **Partially Functional** | **Performance Defect:** N+1 query loop fetching `rdc_items` per challan. |
| **RDC** | `/api/v1/rdc/:id/approve` | `PUT` | `approveAndDispatchRDC` (`rdc.controller.ts:110`) | Bearer JWT | **Missing (All Roles)** | **Partially Functional** | **BAC Risk:** Any role can dispatch challans and generate gate passes. |
| **RDC** | `/api/v1/rdc/:id/return` | `POST` | `recordRDCReturn` (`rdc.controller.ts:138`) | Bearer JWT | **Missing (All Roles)** | **Partially Functional** | Updates returned quantities; does not validate if returned > dispatched; no inventory sync. |
| **PM** | `/api/v1/pm/plans` | `POST` | `createPMPlan` (`pm.controller.ts:4`) | Bearer JWT | **Missing (All Roles)** | **Partially Functional** | **BAC Risk:** Any role can create PM plans. Calculates next due date. |
| **PM** | `/api/v1/pm/plans` | `GET` | `getPMPlans` (`pm.controller.ts:57`) | Bearer JWT | All Roles | **Functional** | Returns active PM plans joined with machine operating hours. |
| **PM** | `/api/v1/pm/generate-due` | `POST` | `generateDuePMWorkOrders` (`pm.controller.ts:81`) | Bearer JWT | **Missing (All Roles)** | **Partially Functional** | Generates scheduled PM work orders. Advances `next_pm_date` upon creation rather than completion. |
| **Inspections** | `/api/v1/inspections/template` | `GET` | `getInspectionTemplate` (`inspections.controller.ts:4`) | Bearer JWT | All Roles | **Broken** | **Fatal Error:** Table `inspection_templates` does not exist in database. Throws 500 error. |
| **Inspections** | `/api/v1/inspections/submit` | `POST` | `submitInspection` (`inspections.controller.ts:37`) | Bearer JWT | All Roles | **Broken** | **Fatal Error:** Table `inspection_records` does not exist in database. Throws 500 error. |
| **Inspections** | `/api/v1/inspections/records` | `GET` | `getInspectionRecords` (`inspections.controller.ts:86`) | Bearer JWT | All Roles | **Broken** | **Fatal Error:** Table `inspection_records` does not exist in database. Throws 500 error. |
| **Notifications** | `/api/v1/notifications` | `GET` | `getMyNotifications` (`notifications.controller.ts:4`) | Bearer JWT | All Roles | **Broken** | **Fatal Error:** Table `notifications` does not exist in database. Throws 500 error. |
| **Notifications** | `/api/v1/notifications/:id/read` | `PUT` | `markAsRead` (`notifications.controller.ts:19`) | Bearer JWT | All Roles | **Broken** | **Fatal Error:** Table `notifications` does not exist in database. Throws 500 error. |
| **Audit** | `/api/v1/audit` | `GET` | `getAuditLogs` (`audit.controller.ts:4`) | Bearer JWT | `admin`, `manager` | **Broken** | **Fatal Error:** Table `audit_logs` does not exist in database. Throws 500 error. |
| **Downtime** | `/api/v1/downtime` | `GET` | `getDowntimeAnalytics` (`downtime.controller.ts:4`) | Bearer JWT | All Roles | **Partially Functional** | Computes MTTR, pareto, and categories; completely ignores `machine_id` and `shop_id` query filters. |
| **Reports** | `/api/v1/reports/dashboard-kpis` | `GET` | `getDashboardStats` (`reports.controller.ts:4`) | Bearer JWT | All Roles | **Partially Functional** | Aggregates machine availability and work order stats; swallows DB errors and returns fake mock stats. |

---

## 3. Missing Enterprise Endpoints Inventory

The following operations are required for full CMMS functionality but have no route or controller implementation:

1. **Authentication & Session Management:**
   - `POST /api/v1/auth/refresh` — Consume refresh token to issue new access token.
   - `POST /api/v1/auth/logout` — Server-side token invalidation / denylist.
   - `PUT /api/v1/auth/change-password` — User self-service credential update.

2. **Work Orders & Maintenance Execution:**
   - `GET /api/v1/work-orders/:id` — Retrieve full work order detail with linked machine, complaint, and assigned personnel.
   - `GET /api/v1/work-orders/:id/events` — Retrieve chronological audit trail of milestones for a work order.
   - `GET /api/v1/work-orders/:id/parts` — Retrieve list of reserved and installed parts for a work order.
   - `POST /api/v1/work-orders/:id/handover` — Operator digital sign-off confirming machine restoration.

3. **Breakdown Complaints:**
   - `GET /api/v1/breakdowns/:id` — Retrieve single complaint details and attached photos.
   - `PUT /api/v1/breakdowns/:id/reject` — Manager rejection of non-actionable complaints with mandatory remarks.

4. **Inventory & Parts Management:**
   - `GET /api/v1/inventory/:id` — Retrieve single spare part detail with stock levels and supplier info.
   - `GET /api/v1/inventory/transactions` — Inspect the immutable stock transaction ledger (`inventory_transactions`).

5. **Organizational Master Data:**
   - `POST /api/v1/org/plants`, `PUT /api/v1/org/plants/:id`, `DELETE /api/v1/org/plants/:id` — Plant administration CRUD.
   - `POST /api/v1/org/shops`, `PUT /api/v1/org/shops/:id`, `DELETE /api/v1/org/shops/:id` — Shop administration CRUD.
