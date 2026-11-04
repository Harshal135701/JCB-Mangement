# JCB Smart CMMS — Business Logic & Domain Workflow Audit
**Document ID:** `05-BUSINESS-LOGIC-AUDIT.md`  
**Date:** November 4, 2026  
**Auditor Roles:** Senior Backend Architect, Industrial CMMS Domain Specialist, QA Engineer  
**Scope:** Deep Business Logic Analysis of all 14 Backend Modules  
**Evaluation Standard:** Realistic Heavy Industrial Manufacturing Plant Operations  

---

## 1. Domain Architecture Overview

In heavy equipment manufacturing (such as JCB's Backhoe Loader, Excavator, and Telescopic Handler assembly plants), maintenance management requires strict operational discipline:
1. **Clear Division of Responsibilities:** Machine operators report symptoms; maintenance managers prioritize and assign skilled trades; technicians diagnose, execute repairs, and log parts; managers perform quality verification; operators conduct pre-shift inspections and final operational handover sign-off.
2. **Dual Downtime Precision:** Distinguishing between **Total Equipment Downtime** (clock runs from operator failure notice until operator signs off on machine recovery) and **Active Wrench Time** (technician hands-on repair duration).
3. **Inventory Integrity:** Atomic reservations, strict segregation between physical, reserved, and quarantined inventory, and immutable ledger logging for all stock movements.

---

## 2. Module-by-Module Business Logic Audit

### 2.1 Module 1: Authentication (`backend/src/modules/auth/`)
- **Implemented Functionality:** User login with identifier (`email` or `employee_code`) and password; JWT access and refresh token generation; profile retrieval; administrator user CRUD.
- **Incomplete / Broken Functionality:**
  - Token refresh is not implemented; refresh tokens issued at login have no consuming route.
  - User creation endpoint (`POST /users`) does not accept or set `plant_id` or `shop_id`.
  - Profile endpoint (`getProfile`) swallows database errors and returns a mock profile.
- **Business Logic Errors & Flaws:**
  - **Universal Backdoor:** `password === 'password123'` allows unauthorized access across all user accounts.
  - **In-Memory Fallback:** Bypasses database validation completely if database connection fails.
- **Missing Functionality:** User logout, session revocation, self-service password change, forgotten password reset.

---

### 2.2 Module 2: Organization (`backend/src/modules/org/`)
- **Implemented Functionality:** List plants (`GET /plants`); list shops by plant ID (`GET /plants/:plantId/shops`).
- **Incomplete / Broken Functionality:**
  - `GET /hierarchy` is **completely broken**. It executes queries against `bays` and `production_lines` which do not exist in the database, resulting in a runtime 500 error.
- **Business Logic Errors & Flaws:**
  - No shop or plant level data validation.
- **Missing Functionality:** Plant CRUD (create, update, deactivate plant); Shop CRUD; Bay and Production Line entity management.

---

### 2.3 Module 3: Machines (`backend/src/modules/machines/`)
- **Implemented Functionality:** List machines with status/shop/criticality/search filters; lookup asset by QR code UID; lookup asset by UUID; create machine with auto-generated QR code; update machine specifications; delete/decommission machine.
- **Incomplete / Broken Functionality:**
  - In `getMachines`, the total count query (`SELECT COUNT(*) FROM machines`) does not apply the user's active filters. Pagination metadata (`totalPages`, `total`) is mathematically incorrect whenever filters are applied.
  - If database fails, `getMachines` returns a hardcoded 3-machine array (`SEEDED_MACHINES`), masking database connectivity issues.
- **Business Logic Errors & Flaws:**
  - In `createMachine`, if `shop_id` is omitted, the controller arbitrarily selects the first shop found in the database (`SELECT id FROM shops LIMIT 1`) and binds the asset to it.
  - In `deleteMachine`, the code only checks if the asset is referenced in `work_orders`. If the machine has records in `maintenance_requests`, `pm_plans`, `purchase_requisitions`, or `rdc_challans`, the delete operation crashes with an unhandled PostgreSQL foreign key violation.
- **Missing Functionality:** Asset meter reading updates; document attachment management (OEM manuals, hydraulic/electrical schematics, SOP URLs).

---

### 2.4 Module 4: Breakdowns / Maintenance Requests (`backend/src/modules/breakdowns/`)
- **Implemented Functionality:** Operator reports breakdown via `POST /breakdowns`; duplicate check verifies if an open complaint already exists on the machine; machine status is updated to `'breakdown'`; real-time Socket.IO event `complaint:created` is emitted to managers; list complaints with filters.
- **Incomplete / Broken Functionality:**
  - No endpoint exists to view a single complaint by ID (`GET /breakdowns/:id`).
  - No endpoint exists for a manager to review, cancel, or reject a baseless complaint (`PUT /breakdowns/:id/reject`).
- **Business Logic Errors & Flaws:**
  - **Concurrency Race Condition:** Sequential `complaint_number` is generated via `SELECT COUNT(*) FROM maintenance_requests`. Concurrent submissions calculate the same number and crash on duplicate key collision.
  - **Missing Transaction:** The insertion of `maintenance_requests` and the update of `machines.status = 'breakdown'` are executed as separate queries without a transaction block. If the machine update fails, the complaint exists while the machine remains marked as running.
- **Missing Functionality:** Shift handover notes, complaint escalation triggers for Class-A critical machinery.

---

### 2.5 Module 5: Work Orders (`backend/src/modules/work-orders/`)
- **Implemented Functionality:** Create work order from complaint (`POST /assign`); update milestone timestamps (`POST /:id/milestone`); manager verification and closure (`POST /:id/verify`); list work orders with technician/status/priority filters.
- **Incomplete / Broken Functionality:**
  - No single work order detail endpoint (`GET /work-orders/:id`).
  - No endpoint to retrieve work order milestone event history (`GET /work-orders/:id/events`).
  - No endpoint to retrieve parts consumed against a work order.
- **Business Logic Errors & Flaws:**
  - **Missing Authorization:** `POST /assign`, `POST /:id/milestone`, and `POST /:id/verify` lack `requireRoles`. Technicians can self-approve their own work orders; operators can assign work orders.
  - **Sequence Race Condition:** `wo_number` (`WO-YYYY-XXXXX`) is generated via row count, causing duplicate key conflicts under concurrent creation.
  - **Missing 404 Guard:** In `updateWorkOrderMilestone`, if an invalid work order ID is passed, the update query affects 0 rows, but the subsequent query attempts to insert into `work_order_events`, triggering an unhandled PostgreSQL foreign key exception (`work_order_id not present`).
  - **Missing Handover Sign-Off:** While the database schema defines `operator_acknowledged_at`, `operator_acknowledged_by`, and `operator_feedback_remarks`, there is no API endpoint for the production line operator to formally accept the restored machine.
- **Missing Functionality:** Work order pause/hold reasons; labor hours tracking; technician skill matching during assignment.

---

### 2.6 Module 6: Inventory & Spare Parts (`backend/src/modules/inventory/`)
- **Implemented Functionality:** Fast trigram search across 160k SKU part catalog; physical stock adjustment with audit logging; administrator spare part CRUD.
- **Incomplete / Broken Functionality:**
  - `POST /inventory/reserve` is **completely broken**. The SQL query references a non-existent column `is_installed` on table `wo_parts_consumed`.
  - The controller catches the database error and returns a mock success message labeled `(Demo Mode)`. **No parts are actually reserved or recorded in the database.**
  - No single part detail endpoint (`GET /inventory/:id`).
  - No endpoint to query the immutable inventory transaction ledger (`inventory_transactions`).
- **Business Logic Errors & Flaws:**
  - `SELECT ... FOR UPDATE` in stock reservation is executed outside a database transaction, meaning row locks are released immediately and offer zero concurrency protection.
  - Stock adjustment (`POST /adjust`) allows negative adjustments without verifying if resulting stock falls below zero.
- **Missing Functionality:** Part installation endpoint (`quantity_installed`, serial number tracking); quarantine stock disposition workflow (`quarantine` -> `repairable` / `scrap`).

---

### 2.7 Module 7: Procurement (`backend/src/modules/procurement/`)
- **Implemented Functionality:** Initiate purchase requisition (`POST /pr`); list PRs; update PR status (`PUT /pr/:id`); Goods Receipt Note inwarding (`POST /pr/:id/grn`) which increments physical stock, creates an audit record in `inventory_transactions`, and resumes linked work order.
- **Incomplete / Broken Functionality:**
  - No endpoint to view a single PR by ID.
  - No PR cancellation or rejection endpoint.
- **Business Logic Errors & Flaws:**
  - **Missing Authorization:** Any authenticated user can update PR status or inward GRN shipments.
  - **Missing Transactions:** In `processGRNInward`, queries updating `spare_parts`, inserting into `inventory_transactions`, updating `purchase_requisitions`, and updating `work_orders` run sequentially without a transaction block. Partial failures result in corrupted inventory counts.
  - **Sequence Race Condition:** `pr_number` generated via row count.
- **Missing Functionality:** Multi-level approval thresholds (e.g. PR value > ₹50,000 requires Plant Manager approval); partial shipment receiving.

---

### 2.8 Module 8: Returnable Delivery Challan / RDC (`backend/src/modules/rdc/`)
- **Implemented Functionality:** Create RDC/NRDC challan with line items (`POST /`); list challans (`GET /`); approve and dispatch with automated Gate Pass generation (`PUT /:id/approve`); record returned items (`POST /:id/return`).
- **Incomplete / Broken Functionality:**
  - No single RDC detail endpoint.
- **Business Logic Errors & Flaws:**
  - **Missing Authorization:** All RDC mutation endpoints lack role guards.
  - **N+1 Query Performance Hazard:** `getRDCs` iterates through every challan in a JavaScript `for` loop executing `SELECT * FROM rdc_items WHERE rdc_id = $1`. Fetching 100 challans results in 101 separate database roundtrips.
  - **Missing Inventory Linkage:** When equipment or parts return via `recordRDCReturn`, stock levels are not updated in `spare_parts`, nor are records added to `inventory_transactions`.
  - **Missing Return Validation:** Does not validate if `returned_quantity` exceeds `quantity_dispatched`.
- **Missing Functionality:** Overdue challan alerts; vendor GSTIN format validation; gate pass PDF generation.

---

### 2.9 Module 9: Preventive Maintenance (`backend/src/modules/pm/`)
- **Implemented Functionality:** Create PM plan (`POST /plans`); list PM plans (`GET /plans`); automated due PM work order generation engine (`POST /generate-due`).
- **Incomplete / Broken Functionality:**
  - No single PM plan detail or edit/delete endpoints.
- **Business Logic Errors & Flaws:**
  - **Premature Due Date Advancement:** In `generateDuePMWorkOrders`, `next_pm_date` is advanced immediately when the work order is generated:
    ```sql
    UPDATE pm_plans SET last_pm_date = CURRENT_DATE, next_pm_date = CURRENT_DATE + (interval_days || ' days')::interval WHERE id = $1
    ```
    If the work order is rejected, delayed, or cancelled, the system permanently records that PM was executed, creating a severe industrial safety compliance violation.
  - **No Automated Execution:** `generateDuePMWorkOrders` is an HTTP endpoint requiring manual triggering. No background cron job or timer exists.
- **Missing Functionality:** Execution checklist recording; PM work order completion hooks that advance schedule dates only upon quality verification.

---

### 2.10 Module 10: Inspections (`backend/src/modules/inspections/`)
- **Implemented Functionality:** Controller and route code drafted for checklist template retrieval, daily pre-shift inspection submission, and historical inspection log listing.
- **Incomplete / Broken Functionality:**
  - **100% Non-Operational.** The underlying database tables `inspection_templates` and `inspection_records` do not exist. All three endpoints crash with 500 Internal Server Errors.
- **Missing Functionality:** Mandatory operator shift checklist enforcement before machine start.

---

### 2.11 Module 11: Notifications (`backend/src/modules/notifications/`)
- **Implemented Functionality:** Controller and route code drafted for user notification retrieval and marking notifications as read.
- **Incomplete / Broken Functionality:**
  - **100% Non-Operational.** Table `notifications` does not exist in the database. Both endpoints throw 500 Internal Server Errors.
- **Missing Functionality:** Notification dispatching service (email, SMS, web push); real-time socket delivery pipeline.

---

### 2.12 Module 12: Audit Logs (`backend/src/modules/audit/`)
- **Implemented Functionality:** Route and controller drafted to query system audit logs with pagination and entity filtering.
- **Incomplete / Broken Functionality:**
  - **100% Non-Operational.** Table `audit_logs` does not exist in the database. Endpoint throws a 500 Internal Server Error.
- **Missing Functionality:** Database audit triggers or Express middleware intercepting mutations and persisting entity change diffs.

---

### 2.13 Module 13: Downtime Analytics (`backend/src/modules/downtime/`)
- **Implemented Functionality:** Computes total breakdown incidents, aggregated downtime minutes, active repair wrench time (MTTR), Pareto top 10 breakdown machines, and category failure distribution.
- **Incomplete / Broken Functionality:**
  - The controller extracts `machine_id` and `shop_id` from `req.query`, but **completely ignores them in every SQL query**. Users cannot filter downtime analytics by shop or specific machine.
- **Missing Functionality:** Mean Time Between Failures (MTBF) calculation; custom date range filtering (weekly/monthly/annual trends).

---

### 2.14 Module 14: Reports & Dashboards (`backend/src/modules/reports/`)
- **Implemented Functionality:** Aggregates enterprise operational KPIs: total machines, operational count, breakdown count, awaiting parts count, open work orders, average MTTR, availability percentage, and low stock count.
- **Incomplete / Broken Functionality:**
  - Contains a `try/catch` block that catches query failures and returns hardcoded mock demonstration data, masking database failures.
  - Queries `COUNT(CASE WHEN status = 'running' OR status = 'operational' THEN 1 END)`. The value `'operational'` is not a member of the `machine_status` PostgreSQL enum.
- **Missing Functionality:** Export to PDF/Excel; role-specific dashboard metric endpoints (Operator dashboard vs Plant Head dashboard).
