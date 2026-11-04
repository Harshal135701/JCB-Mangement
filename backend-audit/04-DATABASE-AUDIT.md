# JCB Smart CMMS — Database & Schema Audit Report
**Document ID:** `04-DATABASE-AUDIT.md`  
**Date:** November 4, 2026  
**Auditor Roles:** Senior PostgreSQL Database Auditor, Database Architect  
**Scope:** PostgreSQL 15+ Schema Analysis, Migration Scripts, Data Integrity, Indexing & Concurrency  
**Target Environment:** PostgreSQL 15+ / Supabase Cloud  

---

## 1. Database Overview & Migration Alignment

The primary schema migration file is [`database/migrations/001_initial_schema.sql`](file:///C:/Users/Borse/Desktop/JCB/JCB/database/migrations/001_initial_schema.sql).

### Verification Findings:
1. **Migration vs Live Supabase Database:**
   - `001_initial_schema.sql` defines **14 tables**, **10 custom ENUM types**, **2 extensions** (`uuid-ossp`, `pg_trgm`), **1 trigger function**, and **3 GIN trigram indexes**.
   - Inspection of the live Supabase catalog confirms that the live database matches `001_initial_schema.sql` exactly.
2. **Migration vs Application Codebase:**
   - The application controllers query **20 tables**.
   - **6 tables are completely missing** from the migration and the live database.
   - **1 column mismatch** exists in `wo_parts_consumed`.
   - **Zero foreign key indexes** exist in the schema.

---

## 2. Table Catalog & Live Row Counts

| Table Name | Defined in Migration | Exists in Live DB | Current Rows | Primary Purpose |
|---|---|---|---|---|
| `plants` | Yes (Line 129) | Yes | 6 | Multi-plant facilities (Ballabgarh, Pune, Jaipur) |
| `shops` | Yes (Line 145) | Yes | 10 | Production shops under plants |
| `users` | Yes (Line 158) | Yes | 9 | Core personnel across 4 roles |
| `machines` | Yes (Line 178) | Yes | 17 | Heavy machinery assets |
| `spare_parts` | Yes (Line 203) | Yes | 19 | Spare parts catalog (160k SKU structure) |
| `inventory_transactions` | Yes (Line 239) | Yes | 1 | Immutable inventory audit ledger |
| `maintenance_requests` | Yes (Line 253) | Yes | 2 | Operator breakdown complaints (CMP) |
| `work_orders` | Yes (Line 276) | Yes | 1 | Maintenance work orders (WO) |
| `work_order_events` | Yes (Line 336) | Yes | 0 | Work order milestone event log |
| `wo_parts_consumed` | Yes (Line 346) | Yes | 0 | Parts reserved/installed on work orders |
| `purchase_requisitions` | Yes (Line 360) | Yes | 2 | Purchase requisitions (PR) |
| `rdc_challans` | Yes (Line 382) | Yes | 1 | Returnable delivery challans (RDC/NRDC) |
| `rdc_items` | Yes (Line 404) | Yes | 0 | Line items on RDC challans |
| `pm_plans` | Yes (Line 417) | Yes | 2 | Preventive maintenance schedules |
| **`bays`** | **NO** | **NO** | N/A | Production bays (Queried in `org.controller.ts:8`) |
| **`production_lines`** | **NO** | **NO** | N/A | Assembly lines (Queried in `org.controller.ts:9`) |
| **`inspection_templates`** | **NO** | **NO** | N/A | Checklists (Queried in `inspections.controller.ts:8`) |
| **`inspection_records`** | **NO** | **NO** | N/A | Inspection logs (Queried in `inspections.controller.ts:57`) |
| **`notifications`** | **NO** | **NO** | N/A | User notifications (Queried in `notifications.controller.ts:9`) |
| **`audit_logs`** | **NO** | **NO** | N/A | System audit trail (Queried in `audit.controller.ts:11`) |

---

## 3. Discrepancy Analysis: Missing Tables & Columns

### 3.1 Missing Tables Deep Dive

```
[FATAL] Missing Table: bays
Referenced in: backend/src/modules/org/org.controller.ts (Line 8)
SQL Query: SELECT * FROM bays WHERE status = 'active' ORDER BY bay_name ASC
Impact: Endpoint GET /api/v1/org/hierarchy crashes immediately with PostgreSQL error: relation "bays" does not exist.
Remediation: Define table `bays` in Migration 002 with columns: id (UUID PK), shop_id (UUID FK), bay_code, bay_name, status, created_at.
```

```
[FATAL] Missing Table: production_lines
Referenced in: backend/src/modules/org/org.controller.ts (Line 9)
SQL Query: SELECT * FROM production_lines WHERE status = 'active' ORDER BY line_name ASC
Impact: Endpoint GET /api/v1/org/hierarchy crashes with PostgreSQL error: relation "production_lines" does not exist.
Remediation: Define table `production_lines` in Migration 002 with columns: id (UUID PK), shop_id (UUID FK), line_code, line_name, status, created_at.
```

```
[FATAL] Missing Table: inspection_templates
Referenced in: backend/src/modules/inspections/inspections.controller.ts (Line 8)
SQL Query: SELECT * FROM inspection_templates WHERE machine_category = $1 AND is_active = true LIMIT 1
Impact: Endpoint GET /api/v1/inspections/template crashes with 500 Internal Server Error.
Remediation: Define table `inspection_templates` in Migration 002 with columns: id (UUID PK), machine_category, title, checklist (JSONB), is_active (BOOLEAN), created_at.
```

```
[FATAL] Missing Table: inspection_records
Referenced in: backend/src/modules/inspections/inspections.controller.ts (Lines 57, 90)
SQL Queries: 
  - INSERT INTO inspection_records (machine_id, operator_id, shift, overall_status, temperature, pressure, vibration, responses_json, operator_signature_url) VALUES (...)
  - SELECT ir.*, m.machine_code, m.name as machine_name, u.full_name as operator_name FROM inspection_records ir ...
Impact: Endpoints POST /api/v1/inspections/submit and GET /api/v1/inspections/records crash with 500 Internal Server Error.
Remediation: Define table `inspection_records` in Migration 002 with appropriate foreign keys to machines and users.
```

```
[FATAL] Missing Table: notifications
Referenced in: backend/src/modules/notifications/notifications.controller.ts (Lines 9, 25)
SQL Queries:
  - SELECT * FROM notifications WHERE recipient_id = $1 ORDER BY created_at DESC LIMIT 30
  - UPDATE notifications SET is_read = true WHERE id = $1 AND recipient_id = $2
Impact: Endpoints GET /api/v1/notifications and PUT /api/v1/notifications/:id/read crash with 500 Internal Server Error.
Remediation: Define table `notifications` in Migration 002 with columns: id (UUID PK), recipient_id (UUID FK), title, message, type, is_read (BOOLEAN), link_url, created_at.
```

```
[FATAL] Missing Table: audit_logs
Referenced in: backend/src/modules/audit/audit.controller.ts (Line 11)
SQL Query: SELECT a.*, u.full_name as performed_by_name, u.role as performed_by_role FROM audit_logs a LEFT JOIN users u ON a.performed_by = u.id ...
Impact: Endpoint GET /api/v1/audit crashes with 500 Internal Server Error.
Remediation: Define table `audit_logs` in Migration 002 with columns: id (UUID PK), entity_name, entity_id, action, performed_by (UUID FK), old_values (JSONB), new_values (JSONB), ip_address, created_at.
```

---

### 3.2 Column Mismatch in `wo_parts_consumed`

- **Location:** [`backend/src/modules/inventory/inventory.controller.ts:173`](file:///C:/Users/Borse/Desktop/JCB/JCB/backend/src/modules/inventory/inventory.controller.ts#L173)
- **Controller SQL Query:**
  ```sql
  INSERT INTO wo_parts_consumed (work_order_id, part_id, quantity_requested, is_installed)
  VALUES ($1, $2, $3, false)
  ```
- **Live Database & Migration Definition (`001_initial_schema.sql:346-357`):**
  ```sql
  CREATE TABLE IF NOT EXISTS wo_parts_consumed (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    part_id UUID NOT NULL REFERENCES spare_parts(id) ON DELETE RESTRICT,
    quantity_requested INT NOT NULL,
    quantity_issued INT DEFAULT 0,
    quantity_installed INT DEFAULT 0,          -- Real column in database
    serial_number_installed VARCHAR(100),
    serial_number_removed VARCHAR(100),
    removed_part_disposition VARCHAR(50) DEFAULT 'quarantine',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```
- **Consequence:**
  PostgreSQL throws: `column "is_installed" of relation "wo_parts_consumed" does not exist`.
  Because lines 185–191 in `inventory.controller.ts` catch all database errors and return a mock `Demo Mode` success response, **no parts are ever recorded in `wo_parts_consumed` in the database**.

---

## 4. Custom Enum Types

The database registers 10 domain enums:

1. `user_role`: `('admin', 'manager', 'operator', 'technician')`
2. `machine_status`: `('running', 'idle', 'breakdown', 'under_maintenance', 'awaiting_parts', 'awaiting_verification', 'inactive', 'decommissioned')`
3. `machine_criticality`: `('class_a', 'class_b', 'class_c')`
4. `complaint_priority`: `('critical', 'high', 'medium', 'low')`
5. `complaint_status`: `('new', 'pending_review', 'approved', 'rejected', 'work_order_created', 'closed')`
6. `work_order_status`: `('assigned', 'accepted', 'scheduled', 'under_diagnosis', 'in_progress', 'waiting_for_parts', 'waiting_for_approval', 'on_hold', 'submitted_verification', 'rework_required', 'completed', 'verified_closed', 'reopened')`
7. `maintenance_classification`: `('regular_maintenance', 'minor_breakdown', 'major_breakdown', 'external_service_required')`
8. `rdc_status`: `('draft', 'pending_approval', 'approved', 'dispatched', 'partially_returned', 'fully_returned', 'overdue', 'cancelled')`
9. `pr_status`: `('new', 'under_review', 'quotation_pending', 'vendor_selected', 'approval_pending', 'po_created', 'ordered', 'partially_received', 'fully_received', 'cancelled')`
10. `pm_frequency`: `('daily', 'weekly', 'monthly', 'quarterly', 'half_yearly', 'yearly')`

---

## 5. Indexes and Performance Audit

### 5.1 Existing Indexes
- **Primary Keys:** B-tree unique indexes exist on all 14 `id` columns.
- **Unique Business Keys:** Unique indexes exist on:
  - `plants.plant_code`
  - `shops.shop_code`
  - `users.email`, `users.employee_code`
  - `machines.machine_code`, `machines.serial_number`, `machines.qr_code_uid`
  - `spare_parts.part_number`
  - `maintenance_requests.complaint_number`
  - `work_orders.wo_number`
  - `purchase_requisitions.pr_number`
  - `rdc_challans.challan_number`
  - `pm_plans.plan_code`
- **Trigram Search Indexes:**
  - `idx_spare_parts_trgm_part_no` on `spare_parts USING gin (part_number gin_trgm_ops)`
  - `idx_spare_parts_trgm_name` on `spare_parts USING gin (name gin_trgm_ops)`
  - `idx_spare_parts_trgm_oem` on `spare_parts USING gin (oem_part_number gin_trgm_ops)`

### 5.2 Missing Foreign Key Indexes (Critical Performance Hazard)
PostgreSQL does not automatically create indexes on foreign key columns. Under heavy production query volume, joins and cascading foreign key checks will execute full sequential table scans.

**Required Indexes to be Added in Migration 002:**
```sql
CREATE INDEX idx_shops_plant_id ON shops(plant_id);
CREATE INDEX idx_users_plant_id ON users(plant_id);
CREATE INDEX idx_users_shop_id ON users(shop_id);
CREATE INDEX idx_machines_shop_id ON machines(shop_id);
CREATE INDEX idx_machines_status ON machines(status);
CREATE INDEX idx_maintenance_requests_machine_id ON maintenance_requests(machine_id);
CREATE INDEX idx_maintenance_requests_status ON maintenance_requests(status);
CREATE INDEX idx_work_orders_machine_id ON work_orders(machine_id);
CREATE INDEX idx_work_orders_complaint_id ON work_orders(complaint_id);
CREATE INDEX idx_work_orders_technician_id ON work_orders(assigned_technician_id);
CREATE INDEX idx_work_orders_status ON work_orders(status);
CREATE INDEX idx_work_order_events_wo_id ON work_order_events(work_order_id);
CREATE INDEX idx_wo_parts_consumed_wo_id ON wo_parts_consumed(work_order_id);
CREATE INDEX idx_wo_parts_consumed_part_id ON wo_parts_consumed(part_id);
CREATE INDEX idx_inv_tx_part_id ON inventory_transactions(part_id);
CREATE INDEX idx_purchase_req_part_id ON purchase_requisitions(part_id);
CREATE INDEX idx_rdc_items_rdc_id ON rdc_items(rdc_id);
CREATE INDEX idx_pm_plans_machine_id ON pm_plans(machine_id);
CREATE INDEX idx_pm_plans_next_date ON pm_plans(next_pm_date) WHERE is_active = true;
```

---

## 6. Triggers and Stored Procedures

### 6.1 `fn_calculate_work_order_downtime()` Trigger Function
Attached as `trg_wo_downtime_calc BEFORE UPDATE ON work_orders`.

```sql
CREATE OR REPLACE FUNCTION fn_calculate_work_order_downtime()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Total Machine Downtime (Actual Breakdown Occurrence -> Restoration verification)
  IF NEW.machine_restored_time IS NOT NULL AND NEW.breakdown_time IS NOT NULL THEN
    NEW.total_downtime_minutes := ROUND(EXTRACT(EPOCH FROM (NEW.machine_restored_time - NEW.breakdown_time)) / 60);
  END IF;

  -- 2. Active Technician Wrench Time
  IF NEW.repair_completed_time IS NOT NULL AND NEW.work_started_time IS NOT NULL THEN
    NEW.active_repair_minutes := ROUND(EXTRACT(EPOCH FROM (NEW.repair_completed_time - NEW.work_started_time)) / 60);
  END IF;

  -- 3. Maintenance Response Delay (Reported -> Tech Arrived / Started)
  IF NEW.arrival_time IS NOT NULL AND NEW.reported_time IS NOT NULL THEN
    NEW.maintenance_response_minutes := ROUND(EXTRACT(EPOCH FROM (NEW.arrival_time - NEW.reported_time)) / 60);
  END IF;

  -- 4. Synchronize Physical Machine Status
  IF NEW.status = 'verified_closed' THEN
    UPDATE machines SET status = 'running', updated_at = NOW() WHERE id = NEW.machine_id;
  ELSIF NEW.status = 'in_progress' OR NEW.status = 'under_diagnosis' THEN
    UPDATE machines SET status = 'under_maintenance', updated_at = NOW() WHERE id = NEW.machine_id;
  ELSIF NEW.status = 'waiting_for_parts' THEN
    UPDATE machines SET status = 'awaiting_parts', updated_at = NOW() WHERE id = NEW.machine_id;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Assessment of Trigger Logic:
- **Positive:** Automates dual downtime calculation and synchronization of physical machine status on `UPDATE`.
- **Negative:** Trigger updates `machines` table directly inside a row-level trigger. If a transaction updates multiple work orders concurrently for the same machine, deadlock risks can emerge.

---

## 7. Seed Data Audit

### 7.1 Seed Files
- [`database/seeds/001_initial_seed.sql`](file:///C:/Users/Borse/Desktop/JCB/JCB/database/seeds/001_initial_seed.sql): Minimal basic seed (3 plants, 3 shops, 4 users, 3 machines, 4 parts).
- [`backend/scripts/seed_rich_db.js`](file:///C:/Users/Borse/Desktop/JCB/JCB/backend/scripts/seed_rich_db.js): Comprehensive enterprise seed script (3 plants, 7 shops, 9 users, 16 industrial machines, 15 parts, 2 complaints, 1 active work order, 2 purchase requisitions, 1 RDC challan, 2 PM plans).

### 7.2 Seed Data Inconsistencies:
1. `seed_rich_db.js:359-372` inserts into `inventory_transactions` under the comment `// 11. Audit Logs`. The developer recognized the absence of `audit_logs` and redirected the seed insert to `inventory_transactions`.
2. Seed users in `001_initial_seed.sql` have static UUIDs prefixed with `f0000000...`, while `seed_rich_db.js` generates dynamic UUIDs via `RETURNING id`.
