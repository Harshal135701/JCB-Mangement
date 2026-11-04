# JCB Smart CMMS — Testing Infrastructure & Readiness Audit
**Document ID:** `06-TESTING-READINESS.md`  
**Date:** November 4, 2026  
**Auditor Roles:** Senior QA Automation Engineer, Test Architect, Backend Security Engineer  
**Scope:** Automated Test Infrastructure, Test Data Requirements, Postman Test Suite Plan  

---

## 1. Existing Test Infrastructure Assessment

### 1.1 Automated Test Framework Status
- **Test Frameworks:** **None installed.** Neither `jest`, `vitest`, `mocha`, nor `supertest` is declared in `backend/package.json`.
- **Existing Test Files:** **0 files.** A recursive search across the repository confirms zero `*.test.ts`, `*.spec.ts`, or test fixtures exist.
- **NPM Test Scripts:** `npm test` does not exist in `backend/package.json`.
- **Current Test Coverage:** **0.00% across all lines, statements, functions, and branches.**

---

## 2. API Testing Readiness & Blockers

### 2.1 Environmental Readiness
- Node.js runtime and dependencies are installed.
- Database connectivity to Supabase PostgreSQL is verified and functioning.
- The server starts cleanly via `npm --prefix backend run dev`.

### 2.2 Immediate Blockers Preventing Safe Automated Testing

1. **Production / Live Database Pollution:**
   - The application connects directly to a live Supabase PostgreSQL database holding demonstration data.
   - Executing write-based test suites (creating test users, machines, or work orders) will corrupt or pollute existing seeded data.
   - **Resolution Required:** A separate, disposable test database or a transactional test runner that wraps each test execution in `BEGIN ... ROLLBACK` must be configured.
2. **Missing Database Tables:**
   - Any test runner invoking `/api/v1/inspections/*`, `/api/v1/notifications/*`, `/api/v1/audit/*`, or `/api/v1/org/hierarchy` will encounter immediate 500 crashes.
   - **Resolution Required:** Execute Migration 002 creating the 6 missing tables prior to testing these routes.
3. **Authentication Backdoor & Fallback Silencing:**
   - Testing authentication logic will yield false positives due to the `'password123'` universal bypass and in-memory mock fallback in `auth.controller.ts:75, 86`.
   - **Resolution Required:** Remove lines 75 and 86–92 in `auth.controller.ts` before conducting auth security testing.
4. **Column Mismatch in Inventory Reservation:**
   - Testing stock reservation will fail due to the non-existent `is_installed` column in `wo_parts_consumed`.
   - **Resolution Required:** Update SQL query to use `quantity_installed` and remove the error-swallowing `(Demo Mode)` catch block.

---

## 3. Test Personas & Role Matrix

Testing requires four role-based accounts (passwords should be configured via environment variables):

| Persona Role | Seeded User Email | Employee Code | Department | Assigned Plant | Assigned Shop |
|---|---|---|---|---|---|
| **Enterprise Admin** | `admin@jcb.com` | `EMP-ADM-001` | IT & Systems | Ballabgarh Works | Global (All Shops) |
| **Maintenance Manager** | `manager@jcb.com` | `EMP-MGR-001` | Mechanical Maintenance | Ballabgarh Works | CNC Machining Shop |
| **Lead Technician** | `technician@jcb.com` | `EMP-TCH-001` | Mechanical Maintenance | Ballabgarh Works | CNC Machining Shop |
| **Electrical Technician**| `anil.tech@jcb.com` | `EMP-TCH-002` | Electrical & PLC | Ballabgarh Works | Robotic Welding Shop |
| **Machine Operator** | `operator@jcb.com` | `EMP-OPR-001` | Production Operations | Ballabgarh Works | CNC Machining Shop |

---

## 4. Endpoints Ready for Immediate Testing

The following **18 endpoints** can be tested immediately using read-only or safe admin operations:

1. `GET /health` — Diagnostic health check.
2. `GET /api/v1` — API module index.
3. `POST /api/v1/auth/login` — Authentication and token generation.
4. `GET /api/v1/auth/profile` — User identity retrieval.
5. `GET /api/v1/auth/users` — User listing (Admin role).
6. `POST /api/v1/auth/users` — User creation (Admin role).
7. `PUT /api/v1/auth/users/:id` — User profile update (Admin role).
8. `DELETE /api/v1/auth/users/:id` — User deactivation (Admin role).
9. `GET /api/v1/org/plants` — Master plant listing.
10. `GET /api/v1/org/plants/:plantId/shops` — Shop listing by plant.
11. `GET /api/v1/machines` — Machine asset listing and filtering.
12. `GET /api/v1/machines/qr/:uid` — QR asset lookup.
13. `GET /api/v1/machines/:id` — Machine detail lookup.
14. `GET /api/v1/breakdowns` — Complaint listing and filtering.
15. `GET /api/v1/work-orders` — Work order listing and filtering.
16. `GET /api/v1/inventory/search` — Trigram part search.
17. `GET /api/v1/procurement/pr` — Purchase requisition listing.
18. `GET /api/v1/pm/plans` — PM schedule listing.

---

## 5. Comprehensive Postman / Automated Testing Plan

### 5.1 Suite 1: Authentication & RBAC Verification
- **TC-AUTH-01 (Positive):** Successful login with valid email and password -> Expect `200 OK`, JWT access token, and user payload.
- **TC-AUTH-02 (Positive):** Successful login with employee code (`EMP-ADM-001`) -> Expect `200 OK`.
- **TC-AUTH-03 (Negative):** Login with incorrect password -> Expect `401 Unauthorized`.
- **TC-AUTH-04 (Negative):** Login with non-existent email -> Expect `401 Unauthorized`.
- **TC-AUTH-05 (Negative):** Missing `identifier` or `password` in body -> Expect `400 Bad Request`.
- **TC-AUTH-06 (Security):** Attempt login using universal backdoor `'password123'` on a user with a different password -> Must return `401 Unauthorized`.
- **TC-AUTH-07 (Security):** Access protected route (`GET /machines`) without Authorization header -> Expect `401 Unauthorized`.
- **TC-AUTH-08 (Security):** Access protected route with malformed Bearer token -> Expect `401 Unauthorized`.
- **TC-AUTH-09 (RBAC):** Operator token accesses `GET /auth/users` -> Expect `403 Forbidden`.
- **TC-AUTH-10 (RBAC):** Admin token accesses `GET /auth/users` -> Expect `200 OK`.

### 5.2 Suite 2: Machine Master & QR Asset Management
- **TC-MAC-01 (Positive):** Admin registers new machine asset with valid body -> Expect `201 Created` with unique QR UID.
- **TC-MAC-02 (Negative):** Technician token attempts `POST /machines` -> Expect `403 Forbidden`.
- **TC-MAC-03 (Negative):** Create machine with missing `machine_code` -> Expect `400 Bad Request`.
- **TC-MAC-04 (Negative):** Create machine with duplicate `machine_code` -> Expect `409 Conflict`.
- **TC-MAC-05 (Positive):** Lookup machine by valid QR UID -> Expect `200 OK` with joined plant and shop names.
- **TC-MAC-06 (Negative):** Lookup machine with non-existent QR UID -> Expect `404 Not Found`.
- **TC-MAC-07 (Validation):** Pass invalid UUID to `GET /machines/:id` -> Expect `400/404` without database stack leak.
- **TC-MAC-08 (Positive):** Filter machines by `criticality=class_a` -> Expect all returned records to have `criticality == 'class_a'`.
- **TC-MAC-09 (Integrity):** Attempt deletion of machine with historical work orders -> Expect machine to be marked `'decommissioned'` rather than hard deleted.

### 5.3 Suite 3: End-to-End Breakdown & Work Order Lifecycle
- **TC-E2E-01 (Operator):** Operator reports breakdown on `ROB-014` via `POST /breakdowns` -> Expect `201 Created`, status `'new'`, and machine status updated to `'breakdown'`.
- **TC-E2E-02 (Duplicate Guard):** Operator reports second breakdown on `ROB-014` before first is closed -> Expect `409 Conflict` with `isDuplicate: true`.
- **TC-E2E-03 (Concurrency):** Submit 5 simultaneous breakdown requests on different machines -> Expect all 5 to receive distinct sequential `complaint_number` values without collisions.
- **TC-E2E-04 (Manager):** Manager assigns technician to complaint via `POST /work-orders/assign` -> Expect `201 Created`, WO status `'assigned'`, SLA calculated, complaint status `'work_order_created'`.
- **TC-E2E-05 (Security):** Operator attempts to assign work order via `POST /work-orders/assign` -> Expect `403 Forbidden`.
- **TC-E2E-06 (Technician):** Assigned technician logs `ACCEPT` milestone -> Expect `200 OK`, status `'accepted'`.
- **TC-E2E-07 (Technician):** Technician logs `ARRIVED` -> Expect status `'under_diagnosis'`, machine status updated to `'under_maintenance'`.
- **TC-E2E-08 (Technician):** Technician logs `START_WORK` -> Expect `work_started_time` recorded.
- **TC-E2E-09 (Technician):** Technician logs `COMPLETE` with diagnosis and root cause analysis -> Expect status `'submitted_verification'`, `repair_completed_time` set.
- **TC-E2E-10 (Security):** Technician attempts to approve and close their own work order via `POST /work-orders/:id/verify` -> Expect `403 Forbidden`.
- **TC-E2E-11 (Manager):** Manager verifies and closes work order with `result: 'APPROVED'` -> Expect status `'verified_closed'`, linked complaint `'closed'`, database trigger executes, `total_downtime_minutes` computed, machine status restored to `'running'`.

### 5.4 Suite 4: Spare Parts Inventory & Stock Ledger
- **TC-INV-01 (Positive):** Search spare parts with `query=cylinder` -> Expect sub-10ms response with relevant SKUs.
- **TC-INV-02 (Positive):** Part reservation with available stock -> Expect `200 OK`, `reserved_stock` incremented, `available_stock` decremented atomically.
- **TC-INV-03 (Negative):** Part reservation where `quantity > available_stock` -> Expect `400 Bad Request` with `Stock Out` notification.
- **TC-INV-04 (Positive):** Manager adjusts stock via `POST /inventory/adjust` -> Expect `200 OK`, `current_physical_stock` updated, immutable record created in `inventory_transactions`.
- **TC-INV-05 (Negative):** Stock adjustment with negative value exceeding physical stock -> Expect `400 Bad Request` preventing negative physical inventory.

### 5.5 Suite 5: Procurement & Inwarding (Zero-Stock Recovery)
- **TC-PR-01 (Positive):** Technician raises critical PR for out-of-stock part linked to active work order -> Expect `201 Created`, linked work order status updated to `'waiting_for_parts'`.
- **TC-PR-02 (Positive):** Manager updates PR with PO number and vendor -> Expect `200 OK`, status `'po_created'`.
- **TC-PR-03 (Positive):** Goods Receipt Note inwarded via `POST /pr/:id/grn` -> Expect physical stock incremented, `inventory_transactions` record inserted, PR status `'fully_received'`, and linked work order resumed to `'in_progress'`.

### 5.6 Suite 6: Multi-Tenant Data Isolation (IDOR)
- **TC-TENANT-01 (Security):** Manager assigned to Pune requests `GET /work-orders` -> Must return **only** work orders for machines located in Pune Operations.
- **TC-TENANT-02 (Security):** Ballabgarh Manager attempts to update or verify a work order belonging to Pune -> Expect `403 Forbidden` / `404 Not Found`.
