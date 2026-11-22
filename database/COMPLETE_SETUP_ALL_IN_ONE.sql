-- ====================================================================
-- JCB SMART CMMS: COMPLETE ALL-IN-ONE MASTER SCRIPT
-- (ALL 18 MIGRATIONS + INITIAL SEED + 30 MAHARASHTRIAN FULL DATASET)
-- ====================================================================

-- ========================================================
-- JCB ENTERPRISE CMMS: COMPLETE ALL-IN-ONE MIGRATIONS (001 - 018)
-- ========================================================


-- >>>>>>>>>>>>>> START MIGRATION: 001_initial_schema.sql <<<<<<<<<<<<<<
-- =====================================================================
-- JCB SMART MACHINE MAINTENANCE MANAGEMENT SYSTEM (CMMS)
-- Target: PostgreSQL 15+ / Supabase
-- Scale: 1,000+ Machines | 160,000 Spare Parts SKUs | Multi-Plant Hierarchy
-- Enhanced as per Final Enterprise ChatGPT Blueprint:
-- 1. Strict 4 Core Roles (Admin, Manager, Operator, Technician)
--    with Store & Purchase managed as Functional Work Queues under Manager/Admin.
-- 2. Explicit separation of Operator Complaints (CMP-YYYY-XXXXX) & Work Orders (WO-YYYY-XXXXX).
-- 3. High-integrity Stock Ledger with Quarantined Stock & Atomic Reservation.
-- 4. Multi-timestamp precision Downtime & Response Time metrics.
-- =====================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- High-speed 160k spare parts trigram search

-- 2. Define Custom Enums
DO $$ BEGIN
  -- Strict 5 Core Roles
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM (
      'admin',
      'manager',
      'store_manager',
      'operator',
      'technician'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'machine_status') THEN
    CREATE TYPE machine_status AS ENUM (
      'running',
      'idle',
      'breakdown',
      'under_maintenance',
      'awaiting_parts',
      'awaiting_verification',
      'inactive',
      'decommissioned'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'machine_criticality') THEN
    CREATE TYPE machine_criticality AS ENUM ('class_a', 'class_b', 'class_c');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'complaint_priority') THEN
    CREATE TYPE complaint_priority AS ENUM ('critical', 'high', 'medium', 'low');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'complaint_status') THEN
    CREATE TYPE complaint_status AS ENUM (
      'new',
      'pending_review',
      'approved',
      'rejected',
      'work_order_created',
      'closed'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'work_order_status') THEN
    CREATE TYPE work_order_status AS ENUM (
      'assigned',
      'accepted',
      'scheduled',
      'under_diagnosis',
      'in_progress',
      'waiting_for_parts',
      'waiting_for_approval',
      'on_hold',
      'submitted_verification',
      'rework_required',
      'completed',
      'verified_closed',
      'reopened'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'maintenance_classification') THEN
    CREATE TYPE maintenance_classification AS ENUM (
      'regular_maintenance',
      'minor_breakdown',
      'major_breakdown',
      'external_service_required'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rdc_status') THEN
    CREATE TYPE rdc_status AS ENUM (
      'draft',
      'pending_approval',
      'approved',
      'dispatched',
      'partially_returned',
      'fully_returned',
      'overdue',
      'cancelled'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pr_status') THEN
    CREATE TYPE pr_status AS ENUM (
      'new',
      'under_review',
      'quotation_pending',
      'vendor_selected',
      'approval_pending',
      'po_created',
      'ordered',
      'partially_received',
      'fully_received',
      'cancelled'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pm_frequency') THEN
    CREATE TYPE pm_frequency AS ENUM (
      'daily',
      'weekly',
      'monthly',
      'quarterly',
      'half_yearly',
      'yearly'
    );
  END IF;
END $$;

-- 3. Organizations and Multi-Plant Hierarchy
CREATE TABLE IF NOT EXISTS plants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plant_code VARCHAR(50) UNIQUE NOT NULL,
  plant_name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  state VARCHAR(100) NOT NULL,
  city VARCHAR(100) NOT NULL,
  pin_code VARCHAR(20) NOT NULL,
  plant_manager VARCHAR(255),
  contact_number VARCHAR(50),
  email VARCHAR(255),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  shop_code VARCHAR(50) UNIQUE NOT NULL,
  shop_name VARCHAR(255) NOT NULL,
  description TEXT,
  manager_user_id UUID,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Users (4 Core Roles)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_code VARCHAR(50) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50),
  role user_role NOT NULL DEFAULT 'operator',
  plant_id UUID REFERENCES plants(id) ON DELETE SET NULL,
  shop_id UUID REFERENCES shops(id) ON DELETE SET NULL,
  department VARCHAR(100),
  designation VARCHAR(100),
  shift VARCHAR(50) DEFAULT 'Shift A',
  skills_json JSONB DEFAULT '[]', -- ['Electrical', 'PLC', 'Hydraulic', 'Mechanical']
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Machine Master (1,000+ Assets)
CREATE TABLE IF NOT EXISTS machines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE RESTRICT,
  machine_code VARCHAR(100) UNIQUE NOT NULL, -- e.g., 'CNC-001'
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  oem_manufacturer VARCHAR(255) NOT NULL,
  model_number VARCHAR(100),
  serial_number VARCHAR(100) UNIQUE,
  bay_line_location VARCHAR(100),
  criticality machine_criticality DEFAULT 'class_b',
  status machine_status DEFAULT 'running',
  operating_hours NUMERIC(10, 2) DEFAULT 0.00,
  maintenance_frequency_days INT DEFAULT 30,
  qr_code_uid VARCHAR(100) UNIQUE NOT NULL,
  manual_url TEXT,
  electrical_diagram_url TEXT,
  hydraulic_schematic_url TEXT,
  sop_document_url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Spare Parts & Store Inventory (160,000 SKUs)
CREATE TABLE IF NOT EXISTS spare_parts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  part_number VARCHAR(100) UNIQUE NOT NULL, -- JCB Part No e.g., 'HYD-10025' or '332/Y2415'
  oem_part_number VARCHAR(100),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  subcategory VARCHAR(100),
  uom VARCHAR(20) DEFAULT 'Nos',
  warehouse_zone VARCHAR(50) DEFAULT 'Main Store',
  bin_location VARCHAR(50) NOT NULL, -- e.g., 'A-01-05'
  rack_number VARCHAR(50),
  shelf_number VARCHAR(50),
  bin_number VARCHAR(50),
  
  -- Strict Stock Segregation
  current_physical_stock INT NOT NULL DEFAULT 0 CHECK (current_physical_stock >= 0),
  reserved_stock INT NOT NULL DEFAULT 0 CHECK (reserved_stock >= 0),
  quarantined_stock INT NOT NULL DEFAULT 0 CHECK (quarantined_stock >= 0),
  available_stock INT GENERATED ALWAYS AS (current_physical_stock - reserved_stock - quarantined_stock) STORED,
  
  min_reorder_level INT NOT NULL DEFAULT 5,
  max_stock_level INT DEFAULT 100,
  unit_cost NUMERIC(12, 2) DEFAULT 0.00,
  supplier_name VARCHAR(255),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigram Indexes for Instant Sub-10ms Lookup
CREATE INDEX IF NOT EXISTS idx_spare_parts_trgm_part_no ON spare_parts USING gin (part_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_spare_parts_trgm_name ON spare_parts USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_spare_parts_trgm_oem ON spare_parts USING gin (oem_part_number gin_trgm_ops);

-- Stock Transaction Ledger (Immutable Audit Trail)
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  part_id UUID NOT NULL REFERENCES spare_parts(id) ON DELETE RESTRICT,
  transaction_type VARCHAR(50) NOT NULL, -- 'STOCK_IN', 'RESERVATION', 'ISSUE', 'RETURN', 'ADJUSTMENT', 'SCRAP'
  quantity INT NOT NULL,
  source_location VARCHAR(100),
  destination_location VARCHAR(100),
  reference_work_order_id UUID,
  performed_by UUID NOT NULL REFERENCES users(id),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Operator Complaints (Separate from Work Orders: CMP-YYYY-XXXXX)
CREATE TABLE IF NOT EXISTS maintenance_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_number VARCHAR(50) UNIQUE NOT NULL, -- CMP-2026-00001
  machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE RESTRICT,
  reported_by_id UUID NOT NULL REFERENCES users(id),
  shift VARCHAR(50) DEFAULT 'Shift A',
  issue_category VARCHAR(100) NOT NULL, -- Electrical, Mechanical, Hydraulic, etc.
  priority complaint_priority DEFAULT 'medium',
  status complaint_status DEFAULT 'new',
  breakdown_occurred_at TIMESTAMPTZ NOT NULL,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hour_meter_reading NUMERIC(10, 2),
  temperature NUMERIC(6, 2),
  pressure NUMERIC(6, 2),
  problem_title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  images_json JSONB DEFAULT '[]',
  manager_remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Work Orders (WO-YYYY-XXXXX)
CREATE TABLE IF NOT EXISTS work_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wo_number VARCHAR(50) UNIQUE NOT NULL, -- WO-2026-00001
  complaint_id UUID REFERENCES maintenance_requests(id) ON DELETE SET NULL,
  machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE RESTRICT,
  assigned_technician_id UUID REFERENCES users(id),
  assigned_manager_id UUID REFERENCES users(id),
  priority complaint_priority NOT NULL DEFAULT 'medium',
  status work_order_status DEFAULT 'assigned',
  classification maintenance_classification DEFAULT 'minor_breakdown',
  is_major_breakdown BOOLEAN DEFAULT FALSE,
  sla_deadline TIMESTAMPTZ,
  work_instructions TEXT,

  -- Visit Scheduling
  scheduled_visit_date DATE,
  scheduled_visit_time TIME,
  schedule_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'proposed', 'confirmed'

  -- Timestamps for Dual Downtime Metrics
  breakdown_time TIMESTAMPTZ,
  reported_time TIMESTAMPTZ,
  manager_ack_time TIMESTAMPTZ,
  technician_assigned_time TIMESTAMPTZ,
  travel_started_time TIMESTAMPTZ,
  arrival_time TIMESTAMPTZ,
  work_started_time TIMESTAMPTZ,
  work_paused_time TIMESTAMPTZ,
  work_resumed_time TIMESTAMPTZ,
  repair_completed_time TIMESTAMPTZ,
  manager_verified_time TIMESTAMPTZ,
  machine_restored_time TIMESTAMPTZ,

  -- Metrics Calculations
  total_downtime_minutes INT DEFAULT 0, -- Breakdown to Restoration
  active_repair_minutes INT DEFAULT 0,   -- Work Started to Repair Completed
  maintenance_response_minutes INT DEFAULT 0, -- Reported to Tech Assignment/Arrival
  labour_hours NUMERIC(6, 2) DEFAULT 0.00,

  -- Diagnosis & RCA
  diagnosis TEXT,
  affected_component VARCHAR(255),
  fault_category VARCHAR(100),
  root_cause_analysis TEXT,
  corrective_action TEXT,
  technician_remarks TEXT,
  manager_verification_remarks TEXT,
  before_photos_json JSONB DEFAULT '[]',
  after_photos_json JSONB DEFAULT '[]',
  
  -- Operator Digital Handover Sign-off
  operator_acknowledged_at TIMESTAMPTZ,
  operator_acknowledged_by UUID REFERENCES users(id),
  operator_feedback_remarks TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Work Order Milestone Events
CREATE TABLE IF NOT EXISTS work_order_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  performed_by UUID NOT NULL REFERENCES users(id),
  notes TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Spare Parts Consumed against Work Order
CREATE TABLE IF NOT EXISTS wo_parts_consumed (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  part_id UUID NOT NULL REFERENCES spare_parts(id) ON DELETE RESTRICT,
  quantity_requested INT NOT NULL,
  quantity_issued INT DEFAULT 0,
  quantity_installed INT DEFAULT 0,
  serial_number_installed VARCHAR(100),
  serial_number_removed VARCHAR(100),
  removed_part_disposition VARCHAR(50) DEFAULT 'quarantine', -- 'quarantine', 'repairable', 'scrap'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Purchase Management (PR Work Queue under Manager/Admin)
CREATE TABLE IF NOT EXISTS purchase_requisitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pr_number VARCHAR(50) UNIQUE NOT NULL, -- PR-2026-00001
  work_order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL,
  machine_id UUID REFERENCES machines(id),
  part_id UUID NOT NULL REFERENCES spare_parts(id),
  quantity_required INT NOT NULL CHECK (quantity_required > 0),
  urgency complaint_priority DEFAULT 'high',
  technical_justification TEXT,
  status pr_status DEFAULT 'new',
  requested_by UUID NOT NULL REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  po_number VARCHAR(100),
  supplier_name VARCHAR(255),
  unit_price NUMERIC(12, 2) DEFAULT 0.00,
  expected_delivery_date DATE,
  received_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Returnable Delivery Challan (RDC) Module
CREATE TABLE IF NOT EXISTS rdc_challans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  challan_number VARCHAR(50) UNIQUE NOT NULL, -- RDC-2026-00001
  rdc_type VARCHAR(20) DEFAULT 'RDC', -- 'RDC' (Returnable) or 'NRDC' (Non-Returnable)
  work_order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL,
  machine_id UUID REFERENCES machines(id) ON DELETE SET NULL,
  vendor_party_name VARCHAR(255) NOT NULL,
  vendor_gstin VARCHAR(50),
  vendor_address TEXT,
  contact_person VARCHAR(100),
  purpose TEXT NOT NULL, -- 'Motor Rewinding', 'Testing', 'Calibration'
  dispatch_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_return_date DATE,
  actual_return_date DATE,
  status rdc_status DEFAULT 'pending_approval',
  gate_pass_number VARCHAR(100),
  created_by UUID NOT NULL REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rdc_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rdc_id UUID NOT NULL REFERENCES rdc_challans(id) ON DELETE CASCADE,
  part_id UUID REFERENCES spare_parts(id),
  item_description TEXT NOT NULL,
  serial_number VARCHAR(100),
  quantity_dispatched INT NOT NULL CHECK (quantity_dispatched > 0),
  quantity_returned INT DEFAULT 0 CHECK (quantity_returned >= 0),
  approximate_value NUMERIC(12, 2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Preventive Maintenance (Dual Trigger: Calendar + Operating Hours)
CREATE TABLE IF NOT EXISTS pm_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_code VARCHAR(50) UNIQUE NOT NULL,
  machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  frequency pm_frequency DEFAULT 'monthly',
  interval_days INT DEFAULT 30,
  operating_hour_threshold NUMERIC(10, 2),
  checklist_template JSONB DEFAULT '[]',
  last_pm_date DATE,
  next_pm_date DATE NOT NULL,
  grace_period_days INT DEFAULT 3,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Automated Dual Downtime & Machine Status Trigger
CREATE OR REPLACE FUNCTION fn_calculate_work_order_downtime()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Total Machine Downtime (Actual Breakdown Occurrence -> Operator restoration verification)
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

  -- 4. Synchronize Machine Status
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

DROP TRIGGER IF EXISTS trg_wo_downtime_calc ON work_orders;
CREATE TRIGGER trg_wo_downtime_calc
BEFORE UPDATE ON work_orders
FOR EACH ROW EXECUTE FUNCTION fn_calculate_work_order_downtime();

-- >>>>>>>>>>>>>> END MIGRATION: 001_initial_schema.sql <<<<<<<<<<<<<<


-- >>>>>>>>>>>>>> START MIGRATION: 002_schema_alignment.sql <<<<<<<<<<<<<<
-- =====================================================================
-- JCB SMART MACHINE MAINTENANCE MANAGEMENT SYSTEM (CMMS)
-- Migration 002: Schema Alignment, Missing Subsystems & Foreign Key Integrity
-- Target: PostgreSQL 15+ / Supabase
-- Execution Policy: Safe, Idempotent, Additive-Only, Non-Destructive
-- =====================================================================

-- ---------------------------------------------------------------------
-- SECTION 1: PRECONDITION CHECKS
-- Verify that required extensions and all 14 baseline tables from
-- 001_initial_schema.sql exist prior to applying alignments.
-- Checks extension presence without attempting unnecessary DDL if present.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  missing_tables TEXT[] := ARRAY[]::TEXT[];
  req_table TEXT;
  baseline_tables TEXT[] := ARRAY[
    'plants', 'shops', 'users', 'machines', 'spare_parts',
    'inventory_transactions', 'maintenance_requests', 'work_orders',
    'work_order_events', 'wo_parts_consumed', 'purchase_requisitions',
    'rdc_challans', 'rdc_items', 'pm_plans'
  ];
BEGIN
  -- Verify or install uuid-ossp extension safely
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') THEN
    BEGIN
      CREATE EXTENSION "uuid-ossp";
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE EXCEPTION 'Precondition Failed: Required extension "uuid-ossp" is not installed, and current user lacks privilege to install it.';
    END;
  END IF;

  -- Verify all 14 baseline tables from 001_initial_schema.sql exist
  FOREACH req_table IN ARRAY baseline_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = req_table
    ) THEN
      missing_tables := array_append(missing_tables, req_table);
    END IF;
  END LOOP;

  IF array_length(missing_tables, 1) > 0 THEN
    RAISE EXCEPTION 'Precondition Failed: Baseline tables from 001_initial_schema.sql are missing: %', array_to_string(missing_tables, ', ');
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- SECTION 2: PRODUCTION HIERARCHY (BAYS & PRODUCTION LINES)
-- Resolves runtime 500 in GET /api/v1/org/hierarchy
-- Validates table structure idempotently even if relations already exist.
-- ---------------------------------------------------------------------

-- Table: bays (Physical machining and assembly bays within shops)
CREATE TABLE IF NOT EXISTS bays (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE RESTRICT,
  bay_code VARCHAR(50) UNIQUE NOT NULL,
  bay_name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'active' CHECK (LOWER(status) IN ('active', 'inactive', 'maintenance')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Validate existing bays table structure
ALTER TABLE bays ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES shops(id) ON DELETE RESTRICT;
ALTER TABLE bays ADD COLUMN IF NOT EXISTS bay_code VARCHAR(50);
ALTER TABLE bays ADD COLUMN IF NOT EXISTS bay_name VARCHAR(255);
ALTER TABLE bays ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE bays ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE bays ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE bays ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Table: production_lines (Conveyor, robotic, and transfer lines within shops)
CREATE TABLE IF NOT EXISTS production_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE RESTRICT,
  line_code VARCHAR(50) UNIQUE NOT NULL,
  line_name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'active' CHECK (LOWER(status) IN ('active', 'inactive', 'maintenance')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Validate existing production_lines table structure
ALTER TABLE production_lines ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES shops(id) ON DELETE RESTRICT;
ALTER TABLE production_lines ADD COLUMN IF NOT EXISTS line_code VARCHAR(50);
ALTER TABLE production_lines ADD COLUMN IF NOT EXISTS line_name VARCHAR(255);
ALTER TABLE production_lines ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE production_lines ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE production_lines ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE production_lines ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ---------------------------------------------------------------------
-- SECTION 3: MACHINE LOCATION COMPATIBILITY ENHANCEMENTS
-- Preserves existing `machines.bay_line_location` VARCHAR while offering
-- structured, validated foreign-key references to bays and production lines.
-- ---------------------------------------------------------------------
ALTER TABLE machines ADD COLUMN IF NOT EXISTS bay_id UUID;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS production_line_id UUID;

DO $$ BEGIN
  -- Foreign key: machines.bay_id -> bays(id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'machines'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'bay_id'
  ) THEN
    ALTER TABLE machines
    ADD CONSTRAINT fk_machines_bay
    FOREIGN KEY (bay_id) REFERENCES bays(id) ON DELETE SET NULL;
  END IF;

  -- Foreign key: machines.production_line_id -> production_lines(id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'machines'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'production_line_id'
  ) THEN
    ALTER TABLE machines
    ADD CONSTRAINT fk_machines_production_line
    FOREIGN KEY (production_line_id) REFERENCES production_lines(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- SECTION 4: PRE-SHIFT INSPECTION SUBSYSTEM
-- Resolves runtime 500 in GET /api/v1/inspections/template,
-- POST /api/v1/inspections/submit, and GET /api/v1/inspections/records
-- ---------------------------------------------------------------------

-- Table: inspection_templates (Daily pre-shift checklist definitions per machine category)
CREATE TABLE IF NOT EXISTS inspection_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  machine_category VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Validate existing inspection_templates table structure
ALTER TABLE inspection_templates ADD COLUMN IF NOT EXISTS machine_category VARCHAR(100);
ALTER TABLE inspection_templates ADD COLUMN IF NOT EXISTS title VARCHAR(255);
ALTER TABLE inspection_templates ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '[]'::jsonb;
ALTER TABLE inspection_templates ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE inspection_templates ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE inspection_templates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Table: inspection_records (Completed pre-shift inspection logs submitted by operators)
CREATE TABLE IF NOT EXISTS inspection_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE RESTRICT,
  operator_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  shift VARCHAR(50) DEFAULT 'Shift A',
  overall_status VARCHAR(50) DEFAULT 'pass' CHECK (LOWER(overall_status) IN ('pass', 'flagged', 'fail')),
  temperature NUMERIC(6, 2),
  pressure NUMERIC(6, 2),
  vibration NUMERIC(6, 2),
  responses_json JSONB DEFAULT '[]'::jsonb,
  operator_signature_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Validate existing inspection_records table structure
ALTER TABLE inspection_records ADD COLUMN IF NOT EXISTS machine_id UUID REFERENCES machines(id) ON DELETE RESTRICT;
ALTER TABLE inspection_records ADD COLUMN IF NOT EXISTS operator_id UUID REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE inspection_records ADD COLUMN IF NOT EXISTS shift VARCHAR(50) DEFAULT 'Shift A';
ALTER TABLE inspection_records ADD COLUMN IF NOT EXISTS overall_status VARCHAR(50) DEFAULT 'pass';
ALTER TABLE inspection_records ADD COLUMN IF NOT EXISTS temperature NUMERIC(6, 2);
ALTER TABLE inspection_records ADD COLUMN IF NOT EXISTS pressure NUMERIC(6, 2);
ALTER TABLE inspection_records ADD COLUMN IF NOT EXISTS vibration NUMERIC(6, 2);
ALTER TABLE inspection_records ADD COLUMN IF NOT EXISTS responses_json JSONB DEFAULT '[]'::jsonb;
ALTER TABLE inspection_records ADD COLUMN IF NOT EXISTS operator_signature_url TEXT;
ALTER TABLE inspection_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ---------------------------------------------------------------------
-- SECTION 5: NOTIFICATIONS & SYSTEM AUDIT LOGGING
-- Resolves runtime 500 in GET /api/v1/notifications,
-- PUT /api/v1/notifications/:id/read, and GET /api/v1/audit
-- ---------------------------------------------------------------------

-- Table: notifications (Real-time and in-app alert inbox for operators, technicians, and managers)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'info' CHECK (LOWER(type) IN ('info', 'warning', 'critical', 'assignment', 'approval', 'system', 'alert')),
  is_read BOOLEAN DEFAULT FALSE,
  link_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Validate existing notifications table structure
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title VARCHAR(255);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'info';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link_url TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Table: audit_logs (Immutable regulatory compliance audit trail for entity mutations)
-- Action constraint supports standard enterprise lifecycle states without blocking custom domain actions.
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_name VARCHAR(100) NOT NULL,
  entity_id UUID,
  action VARCHAR(50) NOT NULL CHECK (action ~ '^[A-Z0-9_]+$'),
  performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Validate existing audit_logs table structure
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_name VARCHAR(100);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_id UUID;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS action VARCHAR(50);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS performed_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS old_values JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS new_values JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ---------------------------------------------------------------------
-- SECTION 6: FOREIGN KEY REFERENTIAL INTEGRITY CONSTRAINTS
-- Adds verified missing constraints on existing baseline tables.
-- Scoped strictly to public schema and table; verifies columns and
-- data validity. Orphaned records cause explicit migration failure.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  orphaned_shops_count INT;
  orphaned_inv_tx_count INT;
BEGIN
  -- Constraint: shops.manager_user_id -> users(id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'shops'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'manager_user_id'
  ) THEN
    -- Verify no orphaned references exist before attaching constraint
    SELECT COUNT(*) INTO orphaned_shops_count
    FROM shops s
    WHERE s.manager_user_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = s.manager_user_id);

    IF orphaned_shops_count > 0 THEN
      RAISE EXCEPTION 'Referential Integrity Check Failed: Found % orphaned row(s) in shops.manager_user_id referencing non-existent users(id). Migration aborted to protect database consistency.', orphaned_shops_count;
    END IF;

    ALTER TABLE shops
    ADD CONSTRAINT fk_shops_manager_user
    FOREIGN KEY (manager_user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  -- Constraint: inventory_transactions.reference_work_order_id -> work_orders(id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'inventory_transactions'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'reference_work_order_id'
  ) THEN
    -- Verify no orphaned references exist before attaching constraint
    SELECT COUNT(*) INTO orphaned_inv_tx_count
    FROM inventory_transactions it
    WHERE it.reference_work_order_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM work_orders wo WHERE wo.id = it.reference_work_order_id);

    IF orphaned_inv_tx_count > 0 THEN
      RAISE EXCEPTION 'Referential Integrity Check Failed: Found % orphaned row(s) in inventory_transactions.reference_work_order_id referencing non-existent work_orders(id). Migration aborted to protect database consistency.', orphaned_inv_tx_count;
    END IF;

    ALTER TABLE inventory_transactions
    ADD CONSTRAINT fk_inv_tx_reference_wo
    FOREIGN KEY (reference_work_order_id) REFERENCES work_orders(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- SECTION 7: FOREIGN KEY & QUERY PERFORMANCE INDEXES
-- Eliminates sequential table scans across foreign-key joins and critical filters.
-- Checked against 001_initial_schema.sql to avoid duplicate index creation.
-- ---------------------------------------------------------------------

-- Existing Organization & Master Asset Indexes
CREATE INDEX IF NOT EXISTS idx_shops_plant_id ON shops(plant_id);
CREATE INDEX IF NOT EXISTS idx_shops_manager_user_id ON shops(manager_user_id) WHERE manager_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_plant_id ON users(plant_id) WHERE plant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_shop_id ON users(shop_id) WHERE shop_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_machines_shop_id ON machines(shop_id);
CREATE INDEX IF NOT EXISTS idx_machines_status ON machines(status);
CREATE INDEX IF NOT EXISTS idx_machines_bay_id ON machines(bay_id) WHERE bay_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_machines_line_id ON machines(production_line_id) WHERE production_line_id IS NOT NULL;

-- New Organization Subsystem Indexes
CREATE INDEX IF NOT EXISTS idx_bays_shop_id ON bays(shop_id);
CREATE INDEX IF NOT EXISTS idx_production_lines_shop_id ON production_lines(shop_id);

-- Breakdown Maintenance & Work Order Indexes
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_machine_id ON maintenance_requests(machine_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_reported_by ON maintenance_requests(reported_by_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_status ON maintenance_requests(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_machine_id ON work_orders(machine_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_complaint_id ON work_orders(complaint_id) WHERE complaint_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_work_orders_assigned_tech ON work_orders(assigned_technician_id) WHERE assigned_technician_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_work_orders_assigned_mgr ON work_orders(assigned_manager_id) WHERE assigned_manager_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_order_events_wo_id ON work_order_events(work_order_id);

-- Inventory & Spare Parts Consumption Indexes
CREATE INDEX IF NOT EXISTS idx_wo_parts_consumed_wo_id ON wo_parts_consumed(work_order_id);
CREATE INDEX IF NOT EXISTS idx_wo_parts_consumed_part_id ON wo_parts_consumed(part_id);
CREATE INDEX IF NOT EXISTS idx_inv_tx_part_id ON inventory_transactions(part_id);
CREATE INDEX IF NOT EXISTS idx_inv_tx_reference_wo ON inventory_transactions(reference_work_order_id) WHERE reference_work_order_id IS NOT NULL;

-- Procurement & Dispatch Indexes
CREATE INDEX IF NOT EXISTS idx_purchase_req_work_order_id ON purchase_requisitions(work_order_id) WHERE work_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_req_part_id ON purchase_requisitions(part_id);
CREATE INDEX IF NOT EXISTS idx_purchase_req_requested_by ON purchase_requisitions(requested_by);
CREATE INDEX IF NOT EXISTS idx_purchase_req_status ON purchase_requisitions(status);
CREATE INDEX IF NOT EXISTS idx_rdc_challans_work_order_id ON rdc_challans(work_order_id) WHERE work_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rdc_items_rdc_id ON rdc_items(rdc_id);
CREATE INDEX IF NOT EXISTS idx_rdc_items_part_id ON rdc_items(part_id) WHERE part_id IS NOT NULL;

-- Preventive Maintenance Indexes
CREATE INDEX IF NOT EXISTS idx_pm_plans_machine_id ON pm_plans(machine_id);
CREATE INDEX IF NOT EXISTS idx_pm_plans_next_date ON pm_plans(next_pm_date) WHERE is_active = TRUE;

-- Pre-Shift Inspection Indexes
CREATE INDEX IF NOT EXISTS idx_inspection_templates_category ON inspection_templates(machine_category) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_inspection_records_machine_id ON inspection_records(machine_id);
CREATE INDEX IF NOT EXISTS idx_inspection_records_operator_id ON inspection_records(operator_id);
CREATE INDEX IF NOT EXISTS idx_inspection_records_created_at ON inspection_records(created_at DESC);

-- Notification & Audit Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created ON notifications(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(recipient_id) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_name, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_by ON audit_logs(performed_by) WHERE performed_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- >>>>>>>>>>>>>> END MIGRATION: 002_schema_alignment.sql <<<<<<<<<<<<<<


-- >>>>>>>>>>>>>> START MIGRATION: 003_notifications_realtime_enhancement.sql <<<<<<<<<<<<<<
-- =====================================================================
-- JCB SMART CMMS MIGRATION 003: REAL-TIME NOTIFICATIONS ENHANCEMENT
-- Enhances notifications schema with entity context, plant/shop isolation,
-- read timestamps, and high-performance filtering indexes.
-- =====================================================================

-- 1. Extend notifications table with relational entity links & facility context
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS entity_id UUID;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS plant_id UUID REFERENCES plants(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES shops(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- 2. Performance Indexes for Real-Time Notification Retrieval & Inbox Queries
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread 
  ON notifications(recipient_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_type 
  ON notifications(recipient_id, type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_entity 
  ON notifications(entity_type, entity_id) 
  WHERE entity_type IS NOT NULL;

-- >>>>>>>>>>>>>> END MIGRATION: 003_notifications_realtime_enhancement.sql <<<<<<<<<<<<<<


-- >>>>>>>>>>>>>> START MIGRATION: 004_procurement_enhancements.sql <<<<<<<<<<<<<<
-- =====================================================================
-- JCB SMART CMMS MIGRATION 004: PROCUREMENT & GRN ENHANCEMENTS
-- Additive, safe, idempotent, non-destructive migration.
-- 1. Adds 'rejected' state to pr_status enum.
-- 2. Adds plant_id column to purchase_requisitions with backfill.
-- 3. Adds rejection_reason and cancellation_reason columns.
-- 4. Enforces unique PO number constraint.
-- 5. Creates grn_receipts table for immutable audit ledger of deliveries.
-- =====================================================================

-- 1. Extend pr_status enum with 'rejected'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
    WHERE pg_type.typname = 'pr_status' AND pg_enum.enumlabel = 'rejected'
  ) THEN
    ALTER TYPE pr_status ADD VALUE 'rejected' AFTER 'cancelled';
  END IF;
END $$;

-- 2. Add plant_id to purchase_requisitions for direct plant isolation
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS plant_id UUID REFERENCES plants(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_req_plant_id ON purchase_requisitions(plant_id);

-- Backfill plant_id for existing records from linked machines or requesting user
UPDATE purchase_requisitions pr
SET plant_id = s.plant_id
FROM machines m
JOIN shops s ON m.shop_id = s.id
WHERE pr.machine_id = m.id AND pr.plant_id IS NULL;

UPDATE purchase_requisitions pr
SET plant_id = u.plant_id
FROM users u
WHERE pr.requested_by = u.id AND pr.plant_id IS NULL AND u.plant_id IS NOT NULL;

-- 3. Add explicit rejection_reason and cancellation_reason columns
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- 4. Add unique index for PO numbers (ignoring nulls)
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_req_po_number_unique
  ON purchase_requisitions(po_number)
  WHERE po_number IS NOT NULL;

-- 5. Create grn_receipts ledger table
CREATE TABLE IF NOT EXISTS grn_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grn_number VARCHAR(50) UNIQUE NOT NULL,
  pr_id UUID NOT NULL REFERENCES purchase_requisitions(id) ON DELETE CASCADE,
  delivery_note_number VARCHAR(100),
  received_quantity INT NOT NULL CHECK (received_quantity > 0),
  accepted_quantity INT NOT NULL CHECK (accepted_quantity >= 0),
  rejected_quantity INT NOT NULL DEFAULT 0 CHECK (rejected_quantity >= 0),
  rejection_reason TEXT,
  remarks TEXT,
  received_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_grn_quantities CHECK (received_quantity = accepted_quantity + rejected_quantity)
);

CREATE INDEX IF NOT EXISTS idx_grn_receipts_pr_id ON grn_receipts(pr_id);
CREATE INDEX IF NOT EXISTS idx_grn_receipts_created_at ON grn_receipts(created_at DESC);

-- >>>>>>>>>>>>>> END MIGRATION: 004_procurement_enhancements.sql <<<<<<<<<<<<<<


-- >>>>>>>>>>>>>> START MIGRATION: 005_grn_fk_restrict.sql <<<<<<<<<<<<<<
-- =====================================================================
-- JCB SMART CMMS MIGRATION 005: STRENGTHEN GRN AUDIT INTEGRITY
-- Changes foreign key constraint on grn_receipts(pr_id) from 
-- ON DELETE CASCADE to ON DELETE RESTRICT to preserve regulatory audit trails.
-- =====================================================================

DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  -- 1. Identify existing foreign key constraint referencing purchase_requisitions
  SELECT tc.constraint_name INTO v_constraint_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name 
    AND tc.table_schema = kcu.table_schema
  WHERE tc.table_name = 'grn_receipts'
    AND kcu.column_name = 'pr_id'
    AND tc.constraint_type = 'FOREIGN KEY'
  LIMIT 1;

  -- 2. Drop existing constraint if present
  IF v_constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE grn_receipts DROP CONSTRAINT ' || quote_ident(v_constraint_name);
  END IF;

  -- 3. Re-add with ON DELETE RESTRICT
  ALTER TABLE grn_receipts
    ADD CONSTRAINT grn_receipts_pr_id_fkey
    FOREIGN KEY (pr_id) REFERENCES purchase_requisitions(id)
    ON DELETE RESTRICT;
END $$;

-- >>>>>>>>>>>>>> END MIGRATION: 005_grn_fk_restrict.sql <<<<<<<<<<<<<<


-- >>>>>>>>>>>>>> START MIGRATION: 006_inspection_templates_seed.sql <<<<<<<<<<<<<<
-- =====================================================================
-- JCB Smart Machine Maintenance Management System (CMMS)
-- Migration 006: Seed Default Pre-Shift Inspection Templates
-- =====================================================================

-- Ensure uuid-ossp extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. HMC Inspection Template (Mazak Horizontal Machining Center)
INSERT INTO inspection_templates (
  id,
  machine_category,
  title,
  checklist,
  is_active,
  created_at,
  updated_at
)
VALUES (
  '50000000-0000-0000-0000-000000000001',
  'HMC',
  'HMC Daily Pre-Shift Machinery Inspection Checklist',
  '{
    "version": 1,
    "items": [
      {
        "id": "chk-1",
        "label": "Hydraulic System Pressure within 45 - 55 Bar",
        "type": "number",
        "unit": "Bar",
        "min": 45,
        "max": 55,
        "critical_min": 35,
        "critical_max": 70,
        "required": true,
        "is_critical": true
      },
      {
        "id": "chk-2",
        "label": "Chiller Unit Operating Temperature (18C - 24C)",
        "type": "number",
        "unit": "C",
        "min": 18,
        "max": 24,
        "critical_min": 15,
        "critical_max": 35,
        "required": true,
        "is_critical": false
      },
      {
        "id": "chk-3",
        "label": "Visual Check: No hydraulic fluid pooling or line leaks",
        "type": "boolean",
        "required": true,
        "is_critical": false
      },
      {
        "id": "chk-4",
        "label": "Emergency Stop & Safety Enclosure Interlock Operational",
        "type": "boolean",
        "required": true,
        "is_critical": true
      },
      {
        "id": "chk-5",
        "label": "Way Lube Automatic Lubrication Reservoir Full",
        "type": "boolean",
        "required": true,
        "is_critical": false
      }
    ],
    "sensor_thresholds": {
      "pressure": {
        "min": 45,
        "max": 55,
        "critical_min": 35,
        "critical_max": 70,
        "unit": "Bar",
        "required": true
      },
      "temperature": {
        "min": 18,
        "max": 24,
        "critical_min": 15,
        "critical_max": 35,
        "unit": "C",
        "required": true
      },
      "vibration": {
        "max": 2.5,
        "critical_max": 4.5,
        "unit": "mm/s",
        "required": false
      }
    }
  }'::jsonb,
  TRUE,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  machine_category = EXCLUDED.machine_category,
  title = EXCLUDED.title,
  checklist = EXCLUDED.checklist,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 2. Robotic Welder Template (Fanuc 6-Axis Welding Station)
INSERT INTO inspection_templates (
  id,
  machine_category,
  title,
  checklist,
  is_active,
  created_at,
  updated_at
)
VALUES (
  '50000000-0000-0000-0000-000000000002',
  'Robotic Welder',
  'Robotic Welder Pre-Shift Safety & Sensor Inspection',
  '{
    "version": 1,
    "items": [
      {
        "id": "chk-rob-1",
        "label": "Safety Light Curtain & Area Interlock Active",
        "type": "boolean",
        "required": true,
        "is_critical": true
      },
      {
        "id": "chk-rob-2",
        "label": "Weld Shielding Gas Line Pressure (5 - 7 Bar)",
        "type": "number",
        "unit": "Bar",
        "min": 5,
        "max": 7,
        "critical_min": 4,
        "critical_max": 8,
        "required": true,
        "is_critical": true
      },
      {
        "id": "chk-rob-3",
        "label": "Torch Tip & Wire Feed Visual Inspection",
        "type": "boolean",
        "required": true,
        "is_critical": false
      },
      {
        "id": "chk-rob-4",
        "label": "Coolant Flow Rate & Radiator Temp Nominal",
        "type": "boolean",
        "required": true,
        "is_critical": false
      }
    ],
    "sensor_thresholds": {
      "pressure": {
        "min": 5,
        "max": 7,
        "critical_min": 4,
        "critical_max": 8,
        "unit": "Bar",
        "required": true
      },
      "temperature": {
        "min": 15,
        "max": 35,
        "critical_min": 10,
        "critical_max": 45,
        "unit": "C",
        "required": false
      },
      "vibration": {
        "max": 1.8,
        "critical_max": 3.0,
        "unit": "mm/s",
        "required": false
      }
    }
  }'::jsonb,
  TRUE,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  machine_category = EXCLUDED.machine_category,
  title = EXCLUDED.title,
  checklist = EXCLUDED.checklist,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 3. Press Template (Schuler 1000T Hydraulic Forming Press)
INSERT INTO inspection_templates (
  id,
  machine_category,
  title,
  checklist,
  is_active,
  created_at,
  updated_at
)
VALUES (
  '50000000-0000-0000-0000-000000000003',
  'Press',
  'Hydraulic Forming Press Daily Pre-Shift Inspection',
  '{
    "version": 1,
    "items": [
      {
        "id": "chk-prs-1",
        "label": "Hydraulic Ram Main Pressure (150 - 220 Bar)",
        "type": "number",
        "unit": "Bar",
        "min": 150,
        "max": 220,
        "critical_min": 120,
        "critical_max": 260,
        "required": true,
        "is_critical": true
      },
      {
        "id": "chk-prs-2",
        "label": "Die Clamping Mechanism Locked & Interlocked",
        "type": "boolean",
        "required": true,
        "is_critical": true
      },
      {
        "id": "chk-prs-3",
        "label": "Hydraulic Sump Oil Temperature (25C - 45C)",
        "type": "number",
        "unit": "C",
        "min": 25,
        "max": 45,
        "critical_min": 20,
        "critical_max": 60,
        "required": true,
        "is_critical": false
      },
      {
        "id": "chk-prs-4",
        "label": "Emergency Stop Buttons Tested Across 4 Corners",
        "type": "boolean",
        "required": true,
        "is_critical": true
      }
    ],
    "sensor_thresholds": {
      "pressure": {
        "min": 150,
        "max": 220,
        "critical_min": 120,
        "critical_max": 260,
        "unit": "Bar",
        "required": true
      },
      "temperature": {
        "min": 25,
        "max": 45,
        "critical_min": 20,
        "critical_max": 60,
        "unit": "C",
        "required": true
      },
      "vibration": {
        "max": 3.5,
        "critical_max": 5.5,
        "unit": "mm/s",
        "required": false
      }
    }
  }'::jsonb,
  TRUE,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  machine_category = EXCLUDED.machine_category,
  title = EXCLUDED.title,
  checklist = EXCLUDED.checklist,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- >>>>>>>>>>>>>> END MIGRATION: 006_inspection_templates_seed.sql <<<<<<<<<<<<<<


-- >>>>>>>>>>>>>> START MIGRATION: 007_store_manager_role_and_inventory.sql <<<<<<<<<<<<<<
-- =====================================================================
-- JCB SMART CMMS MIGRATION 007: STORE MANAGER ROLE & ADVANCED INVENTORY
-- Safe, additive, idempotent, non-destructive migration.
-- 1. Adds 'store_manager' to user_role enum.
-- 2. Adds plant_id to spare_parts for store/plant isolation.
-- 3. Creates stock_transfers ledger for inter-location movements.
-- 4. Creates damaged_stock_items for damaged/expired quarantine tracking.
-- 5. Creates vendors master table for procurement vendor management.
-- =====================================================================

-- 1. Add 'store_manager' to user_role enum safely
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
    WHERE pg_type.typname = 'user_role' AND pg_enum.enumlabel = 'store_manager'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'store_manager' AFTER 'manager';
  END IF;
END $$;

-- 2. Add plant_id to spare_parts catalog for multi-plant store isolation
ALTER TABLE spare_parts ADD COLUMN IF NOT EXISTS plant_id UUID REFERENCES plants(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_spare_parts_plant_id ON spare_parts(plant_id);

-- Backfill existing spare parts to default Ballabgarh plant if null
UPDATE spare_parts
SET plant_id = 'b0000000-0000-0000-0000-000000000001'
WHERE plant_id IS NULL AND EXISTS (SELECT 1 FROM plants WHERE id = 'b0000000-0000-0000-0000-000000000001');

-- 3. Create stock_transfers table (Inter-bin, inter-zone, inter-plant movements)
CREATE TABLE IF NOT EXISTS stock_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transfer_number VARCHAR(50) UNIQUE NOT NULL, -- TRF-YYYY-XXXXX
  part_id UUID NOT NULL REFERENCES spare_parts(id) ON DELETE RESTRICT,
  source_plant_id UUID REFERENCES plants(id) ON DELETE SET NULL,
  destination_plant_id UUID REFERENCES plants(id) ON DELETE SET NULL,
  source_location VARCHAR(100) NOT NULL,
  destination_location VARCHAR(100) NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  status VARCHAR(50) NOT NULL DEFAULT 'completed' CHECK (LOWER(status) IN ('pending', 'in_transit', 'completed', 'cancelled')),
  transferred_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  received_by UUID REFERENCES users(id) ON DELETE SET NULL,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_transfers_part_id ON stock_transfers(part_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_source_plant ON stock_transfers(source_plant_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_destination_plant ON stock_transfers(destination_plant_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_created_at ON stock_transfers(created_at DESC);

-- 4. Create damaged_stock_items table (Damaged, expired, obsolete stock tracking)
CREATE TABLE IF NOT EXISTS damaged_stock_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_number VARCHAR(50) UNIQUE NOT NULL, -- DMG-YYYY-XXXXX
  part_id UUID NOT NULL REFERENCES spare_parts(id) ON DELETE RESTRICT,
  plant_id UUID REFERENCES plants(id) ON DELETE SET NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  damage_type VARCHAR(50) NOT NULL CHECK (LOWER(damage_type) IN ('damaged', 'expired', 'obsolete', 'defective', 'scrap')),
  disposition VARCHAR(50) NOT NULL DEFAULT 'quarantined' CHECK (LOWER(disposition) IN ('quarantined', 'scrapped', 'returned_to_vendor', 'written_off')),
  reason TEXT NOT NULL,
  location VARCHAR(100),
  batch_lot_number VARCHAR(100),
  reported_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_damaged_stock_part_id ON damaged_stock_items(part_id);
CREATE INDEX IF NOT EXISTS idx_damaged_stock_plant_id ON damaged_stock_items(plant_id);
CREATE INDEX IF NOT EXISTS idx_damaged_stock_created_at ON damaged_stock_items(created_at DESC);

-- 5. Create vendors master table
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  gstin VARCHAR(50),
  payment_terms VARCHAR(100) DEFAULT 'Net 30',
  status VARCHAR(20) DEFAULT 'active' CHECK (LOWER(status) IN ('active', 'inactive', 'blacklisted')),
  plant_id UUID REFERENCES plants(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendors_name ON vendors(name);
CREATE INDEX IF NOT EXISTS idx_vendors_status ON vendors(status);

-- 6. Populate default vendors if table is newly created
INSERT INTO vendors (vendor_code, name, contact_person, email, phone, address, gstin, payment_terms, status)
VALUES
  ('VEN-001', 'JCB Genuine Parts', 'Operations Head', 'genuine.spares@jcb.com', '+91-129-4299100', 'Plot 23/7 Mathura Road, Ballabgarh, Haryana', '06AAACJ1234F1Z1', 'Net 30', 'active'),
  ('VEN-002', 'Bosch Rexroth India', 'Industrial Sales', 'sales@boschrexroth.co.in', '+91-80-67500000', 'Sanand Industrial Estate, Ahmedabad, Gujarat', '24AAACB9876G1Z2', 'Net 45', 'active'),
  ('VEN-003', 'SKF India Limited', 'Industrial Bearings Div', 'spares@skf.com', '+91-20-66112500', 'Chinchwad, Pune, Maharashtra', '27AAACS4321H1Z3', 'Net 30', 'active'),
  ('VEN-004', 'Fanuc India Private Limited', 'Automation Service Desk', 'service@fanucindia.com', '+91-80-40521200', 'Electronic City, Bengaluru, Karnataka', '29AAACF5544J1Z4', 'Net 60', 'active'),
  ('VEN-005', 'Parker Hannifin India', 'Fluid Power Division', 'orders@parker.com', '+91-22-65137000', 'Mahape, Navi Mumbai, Maharashtra', '27AAACP9988K1Z5', 'Net 30', 'active')
ON CONFLICT (vendor_code) DO NOTHING;

-- >>>>>>>>>>>>>> END MIGRATION: 007_store_manager_role_and_inventory.sql <<<<<<<<<<<<<<


-- >>>>>>>>>>>>>> START MIGRATION: 008_rdc_enterprise_enhancements.sql <<<<<<<<<<<<<<
-- =====================================================================
-- JCB SMART CMMS MIGRATION 008: RDC ENTERPRISE ENHANCEMENTS & WORKFLOW
-- Safe, additive, idempotent, non-destructive migration.
-- 1. Updates rdc_status enum with 'rejected' and 'closed'
-- 2. Enhances rdc_challans with plant/shop isolation, vendor link, priority, dispatch, audit fields
-- 3. Enhances rdc_items with replacement, damage, writeoff quantities, unit cost, remarks, disposition
-- 4. Creates rdc_approval_configs table for configurable approval hierarchy
-- 5. Creates sequences for concurrency-safe numbering
-- 6. Adds performance indexes
-- =====================================================================

-- 1. Update rdc_status enum safely
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
    WHERE pg_type.typname = 'rdc_status' AND pg_enum.enumlabel = 'rejected'
  ) THEN
    ALTER TYPE rdc_status ADD VALUE 'rejected' AFTER 'pending_approval';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
    WHERE pg_type.typname = 'rdc_status' AND pg_enum.enumlabel = 'closed'
  ) THEN
    ALTER TYPE rdc_status ADD VALUE 'closed' AFTER 'fully_returned';
  END IF;
END $$;

-- 2. Enhance rdc_challans table
ALTER TABLE rdc_challans ADD COLUMN IF NOT EXISTS plant_id UUID REFERENCES plants(id) ON DELETE SET NULL;
ALTER TABLE rdc_challans ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES shops(id) ON DELETE SET NULL;
ALTER TABLE rdc_challans ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL;
ALTER TABLE rdc_challans ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium';
ALTER TABLE rdc_challans ADD COLUMN IF NOT EXISTS approximate_value NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE rdc_challans ADD COLUMN IF NOT EXISTS dispatched_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE rdc_challans ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ;
ALTER TABLE rdc_challans ADD COLUMN IF NOT EXISTS vehicle_number VARCHAR(50);
ALTER TABLE rdc_challans ADD COLUMN IF NOT EXISTS transporter_name VARCHAR(255);
ALTER TABLE rdc_challans ADD COLUMN IF NOT EXISTS document_reference VARCHAR(100);
ALTER TABLE rdc_challans ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE rdc_challans ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE rdc_challans ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE rdc_challans ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE rdc_challans ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE rdc_challans ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE rdc_challans ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE rdc_challans ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE rdc_challans ADD COLUMN IF NOT EXISTS submission_notes TEXT;

-- 3. Enhance rdc_items table
ALTER TABLE rdc_items ADD COLUMN IF NOT EXISTS quantity_replacement INT DEFAULT 0;
ALTER TABLE rdc_items ADD COLUMN IF NOT EXISTS quantity_damaged INT DEFAULT 0;
ALTER TABLE rdc_items ADD COLUMN IF NOT EXISTS quantity_written_off INT DEFAULT 0;
ALTER TABLE rdc_items ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE rdc_items ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE rdc_items ADD COLUMN IF NOT EXISTS disposition VARCHAR(50) DEFAULT 'pending';

-- Add check constraints safely if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_rdc_items_replacement'
  ) THEN
    ALTER TABLE rdc_items ADD CONSTRAINT chk_rdc_items_replacement CHECK (quantity_replacement >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_rdc_items_damaged'
  ) THEN
    ALTER TABLE rdc_items ADD CONSTRAINT chk_rdc_items_damaged CHECK (quantity_damaged >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_rdc_items_written_off'
  ) THEN
    ALTER TABLE rdc_items ADD CONSTRAINT chk_rdc_items_written_off CHECK (quantity_written_off >= 0);
  END IF;
END $$;

-- 4. Create rdc_approval_configs table for configurable approval hierarchy
CREATE TABLE IF NOT EXISTS rdc_approval_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plant_id UUID REFERENCES plants(id) ON DELETE SET NULL,
  min_value NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  max_value NUMERIC(12, 2), -- NULL means unlimited
  priority VARCHAR(50) NOT NULL DEFAULT 'ALL', -- 'ALL', 'low', 'medium', 'high', 'emergency'
  required_role VARCHAR(50) NOT NULL, -- 'manager', 'admin'
  approval_level INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed configurable default approval tiers
INSERT INTO rdc_approval_configs (min_value, max_value, priority, required_role, approval_level)
SELECT 0.00, 50000.00, 'ALL', 'manager', 1
WHERE NOT EXISTS (
  SELECT 1 FROM rdc_approval_configs WHERE required_role = 'manager' AND approval_level = 1 AND priority = 'ALL'
);

INSERT INTO rdc_approval_configs (min_value, max_value, priority, required_role, approval_level)
SELECT 50000.01, NULL, 'ALL', 'admin', 2
WHERE NOT EXISTS (
  SELECT 1 FROM rdc_approval_configs WHERE required_role = 'admin' AND approval_level = 2 AND priority = 'ALL'
);

INSERT INTO rdc_approval_configs (min_value, max_value, priority, required_role, approval_level)
SELECT 0.00, NULL, 'emergency', 'admin', 2
WHERE NOT EXISTS (
  SELECT 1 FROM rdc_approval_configs WHERE required_role = 'admin' AND priority = 'emergency'
);

-- 5. Sequences for concurrency-safe numbering
CREATE SEQUENCE IF NOT EXISTS rdc_challan_seq START 1;
CREATE SEQUENCE IF NOT EXISTS rdc_gate_pass_seq START 1;

-- 6. Indexes for query optimization & high-speed lookup
CREATE INDEX IF NOT EXISTS idx_rdc_challans_plant_id ON rdc_challans(plant_id);
CREATE INDEX IF NOT EXISTS idx_rdc_challans_shop_id ON rdc_challans(shop_id);
CREATE INDEX IF NOT EXISTS idx_rdc_challans_vendor_id ON rdc_challans(vendor_id);
CREATE INDEX IF NOT EXISTS idx_rdc_challans_status ON rdc_challans(status);
CREATE INDEX IF NOT EXISTS idx_rdc_challans_priority ON rdc_challans(priority);
CREATE INDEX IF NOT EXISTS idx_rdc_challans_created_at ON rdc_challans(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rdc_challans_expected_return ON rdc_challans(expected_return_date);
CREATE INDEX IF NOT EXISTS idx_rdc_items_disposition ON rdc_items(disposition);
CREATE INDEX IF NOT EXISTS idx_rdc_approval_configs_lookup ON rdc_approval_configs(is_active, priority, min_value);

-- >>>>>>>>>>>>>> END MIGRATION: 008_rdc_enterprise_enhancements.sql <<<<<<<<<<<<<<


-- >>>>>>>>>>>>>> START MIGRATION: 009_vendor_supply_and_challan_details.sql <<<<<<<<<<<<<<
-- =====================================================================
-- JCB SMART CMMS MIGRATION 009: VENDOR SUPPLY & CHALLAN DETAILS
-- Enhances Purchase Orders & Goods Receipt Note (GRN) with vendor supply,
-- delivery document, challan classification, and transport metadata.
-- =====================================================================

-- 1. Extend purchase_requisitions with Vendor Supply & Delivery Details
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS supply_method VARCHAR(100);
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS delivery_document_type VARCHAR(100);
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS challan_type VARCHAR(50);
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS vendor_challan_number VARCHAR(100);
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS expected_dispatch_date DATE;
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS transporter_name VARCHAR(255);
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS vehicle_number VARCHAR(100);
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS lr_tracking_number VARCHAR(100);
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS delivery_remarks TEXT;

-- 2. Extend grn_receipts with verified receipt document and carrier details
ALTER TABLE grn_receipts ADD COLUMN IF NOT EXISTS vendor_challan_number VARCHAR(100);
ALTER TABLE grn_receipts ADD COLUMN IF NOT EXISTS supply_method VARCHAR(100);
ALTER TABLE grn_receipts ADD COLUMN IF NOT EXISTS delivery_document_type VARCHAR(100);
ALTER TABLE grn_receipts ADD COLUMN IF NOT EXISTS challan_type VARCHAR(50);
ALTER TABLE grn_receipts ADD COLUMN IF NOT EXISTS vehicle_number VARCHAR(100);
ALTER TABLE grn_receipts ADD COLUMN IF NOT EXISTS lr_tracking_number VARCHAR(100);
ALTER TABLE grn_receipts ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_purchase_req_vendor_challan ON purchase_requisitions(vendor_challan_number) WHERE vendor_challan_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_req_supply_method ON purchase_requisitions(supply_method) WHERE supply_method IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_grn_receipts_challan_no ON grn_receipts(vendor_challan_number) WHERE vendor_challan_number IS NOT NULL;

-- >>>>>>>>>>>>>> END MIGRATION: 009_vendor_supply_and_challan_details.sql <<<<<<<<<<<<<<


-- >>>>>>>>>>>>>> START MIGRATION: 010_breakdown_technician_assignment.sql <<<<<<<<<<<<<<
-- =====================================================================
-- JCB SMART MACHINE MAINTENANCE MANAGEMENT SYSTEM (CMMS)
-- Migration 010: Automatic Breakdown Technician Assignment & History
-- Target: PostgreSQL 15+ / Supabase
-- Execution Policy: Safe, Idempotent, Additive-Only, Non-Destructive
-- =====================================================================

-- 1. Extend machines table with optional designated technician
ALTER TABLE machines ADD COLUMN IF NOT EXISTS designated_technician_id UUID;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'machines'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'designated_technician_id'
  ) THEN
    ALTER TABLE machines
    ADD CONSTRAINT fk_machines_designated_technician
    FOREIGN KEY (designated_technician_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_machines_designated_tech ON machines(designated_technician_id) WHERE designated_technician_id IS NOT NULL;

-- 2. Extend users table with technician availability & workload capacity
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_active_assignments INT DEFAULT 5;

-- 3. Extend maintenance_requests table with assignment tracking
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS assigned_technician_id UUID;
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS assignment_status VARCHAR(50) DEFAULT 'unassigned';
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS current_assignment_id UUID;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'maintenance_requests'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'assigned_technician_id'
  ) THEN
    ALTER TABLE maintenance_requests
    ADD CONSTRAINT fk_maintenance_requests_assigned_tech
    FOREIGN KEY (assigned_technician_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_maintenance_requests_assigned_tech ON maintenance_requests(assigned_technician_id) WHERE assigned_technician_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_assignment_status ON maintenance_requests(assignment_status);

-- 4. Create breakdown_assignments table for complete attempt history
CREATE TABLE IF NOT EXISTS breakdown_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  breakdown_id UUID NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  assignment_method VARCHAR(20) NOT NULL DEFAULT 'AUTOMATIC' CHECK (assignment_method IN ('AUTOMATIC', 'MANUAL')),
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'REASSIGNED', 'CANCELLED')),
  attempt_number INT NOT NULL DEFAULT 1,
  rejection_reason TEXT,
  reassignment_reason TEXT,
  notes TEXT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_breakdown_assignments_breakdown_id ON breakdown_assignments(breakdown_id);
CREATE INDEX IF NOT EXISTS idx_breakdown_assignments_technician_id ON breakdown_assignments(technician_id);
CREATE INDEX IF NOT EXISTS idx_breakdown_assignments_status ON breakdown_assignments(status);

-- Ensure concurrency safety: only one active (PENDING or ACCEPTED) assignment per breakdown
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_assignment_per_breakdown
  ON breakdown_assignments(breakdown_id)
  WHERE status IN ('PENDING', 'ACCEPTED');

-- 5. Foreign key for current_assignment_id on maintenance_requests
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'maintenance_requests'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'current_assignment_id'
  ) THEN
    ALTER TABLE maintenance_requests
    ADD CONSTRAINT fk_maintenance_requests_current_assignment
    FOREIGN KEY (current_assignment_id) REFERENCES breakdown_assignments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- >>>>>>>>>>>>>> END MIGRATION: 010_breakdown_technician_assignment.sql <<<<<<<<<<<<<<


-- >>>>>>>>>>>>>> START MIGRATION: 011_procurement_shipment_and_qc_enhancements.sql <<<<<<<<<<<<<<
-- =====================================================================
-- JCB SMART CMMS MIGRATION 011: PROCUREMENT SHIPMENT & QC ENHANCEMENTS
-- Additive, idempotent, non-destructive migration.
-- 1. Adds shipment and transportation tracking columns to purchase_requisitions.
-- 2. Adds shipment, transportation, and QC inspection columns to grn_receipts.
-- 3. Updates grn_receipts check constraint to support damaged/defective quantities.
-- =====================================================================

-- 1. Extend purchase_requisitions with realistic Shipment & Transportation Details
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS dispatch_location VARCHAR(255);
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS destination_plant_name VARCHAR(255);
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS transport_mode VARCHAR(100);
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS freight_cost NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS overall_shipment_cost NUMERIC(12, 2) DEFAULT 0.00;

-- 2. Extend grn_receipts with verified Shipment, Transportation, and QC Inspection Details
ALTER TABLE grn_receipts ADD COLUMN IF NOT EXISTS dispatch_location VARCHAR(255);
ALTER TABLE grn_receipts ADD COLUMN IF NOT EXISTS destination_plant_name VARCHAR(255);
ALTER TABLE grn_receipts ADD COLUMN IF NOT EXISTS transport_mode VARCHAR(100);
ALTER TABLE grn_receipts ADD COLUMN IF NOT EXISTS transporter_name VARCHAR(255);
ALTER TABLE grn_receipts ADD COLUMN IF NOT EXISTS freight_cost NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE grn_receipts ADD COLUMN IF NOT EXISTS overall_shipment_cost NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE grn_receipts ADD COLUMN IF NOT EXISTS damaged_quantity INT NOT NULL DEFAULT 0;
ALTER TABLE grn_receipts ADD COLUMN IF NOT EXISTS defective_quantity INT NOT NULL DEFAULT 0;
ALTER TABLE grn_receipts ADD COLUMN IF NOT EXISTS inspection_status VARCHAR(50) DEFAULT 'passed';
ALTER TABLE grn_receipts ADD COLUMN IF NOT EXISTS inspection_remarks TEXT;

-- 3. Update grn_receipts quantity constraint to include damaged quantity
ALTER TABLE grn_receipts DROP CONSTRAINT IF EXISTS chk_grn_quantities;
ALTER TABLE grn_receipts ADD CONSTRAINT chk_grn_quantities
  CHECK (received_quantity = accepted_quantity + rejected_quantity + COALESCE(damaged_quantity, 0));

-- Ensure damaged_quantity is non-negative
ALTER TABLE grn_receipts DROP CONSTRAINT IF EXISTS chk_grn_damaged_quantity;
ALTER TABLE grn_receipts ADD CONSTRAINT chk_grn_damaged_quantity
  CHECK (damaged_quantity >= 0);

-- 4. Create Indexes for fast retrieval
CREATE INDEX IF NOT EXISTS idx_purchase_req_transport_mode ON purchase_requisitions(transport_mode) WHERE transport_mode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_grn_receipts_inspection_status ON grn_receipts(inspection_status) WHERE inspection_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_grn_receipts_transport_mode ON grn_receipts(transport_mode) WHERE transport_mode IS NOT NULL;

-- >>>>>>>>>>>>>> END MIGRATION: 011_procurement_shipment_and_qc_enhancements.sql <<<<<<<<<<<<<<


-- >>>>>>>>>>>>>> START MIGRATION: 012_procurement_qc_defective_quantity_check.sql <<<<<<<<<<<<<<
-- =====================================================================
-- JCB SMART CMMS MIGRATION 012: QC DEFECTIVE QUANTITY CHECK CONSTRAINT
-- Additive, idempotent, non-destructive migration.
-- Enforces that defective_quantity is non-negative and does not exceed
-- the total rejected and damaged quantity (since defective quantity is
-- a classified sub-category within non-conforming goods).
-- =====================================================================

ALTER TABLE grn_receipts DROP CONSTRAINT IF EXISTS chk_grn_defective_quantity;
ALTER TABLE grn_receipts ADD CONSTRAINT chk_grn_defective_quantity
  CHECK (defective_quantity >= 0 AND defective_quantity <= (rejected_quantity + COALESCE(damaged_quantity, 0)));

CREATE INDEX IF NOT EXISTS idx_grn_receipts_defective_qty ON grn_receipts(defective_quantity) WHERE defective_quantity > 0;

-- >>>>>>>>>>>>>> END MIGRATION: 012_procurement_qc_defective_quantity_check.sql <<<<<<<<<<<<<<


-- >>>>>>>>>>>>>> START MIGRATION: 013_rdc_approval_policy_manager_admin.sql <<<<<<<<<<<<<<
-- Migration 013: Update RDC High-Value Approval Policy
-- Business Decision: Both Manager and Admin can approve RDC Gate Passes, including challans with material values exceeding ₹50,000.
-- Strict Separation of Duties (SoD) remains enforced at the application level.
-- Emergency priority policy strictly remains restricted to Administrator sign-off.

UPDATE rdc_approval_configs
SET required_role = 'manager',
    approval_level = 1,
    updated_at = NOW()
WHERE priority = 'ALL'
  AND min_value >= 50000
  AND required_role = 'admin';

-- >>>>>>>>>>>>>> END MIGRATION: 013_rdc_approval_policy_manager_admin.sql <<<<<<<<<<<<<<


-- >>>>>>>>>>>>>> START MIGRATION: 014_operator_signup_and_approval.sql <<<<<<<<<<<<<<
-- =====================================================================
-- JCB SMART CMMS MIGRATION 014: OPERATOR SIGN-UP & MANAGER APPROVAL WORKFLOW
-- Safe, additive, idempotent, non-destructive migration.
-- 1. Adds 'approval_status' ('pending', 'approved', 'rejected') to users.
-- 2. Adds 'approved_by', 'approved_at', and 'rejection_reason' columns.
-- 3. Ensures existing users default to 'approved' for zero regressions.
-- 4. Adds composite indexes for high-speed facility filtering.
-- =====================================================================

DO $$
BEGIN
  -- 1. Add approval_status column to users table if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'approval_status'
  ) THEN
    ALTER TABLE users ADD COLUMN approval_status VARCHAR(50) NOT NULL DEFAULT 'approved'
      CHECK (approval_status IN ('pending', 'approved', 'rejected'));
  END IF;

  -- 2. Add approved_by column (Manager/Admin who approved/rejected the request)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE users ADD COLUMN approved_by UUID REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  -- 3. Add approved_at timestamp column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE users ADD COLUMN approved_at TIMESTAMPTZ;
  END IF;

  -- 4. Add rejection_reason text column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE users ADD COLUMN rejection_reason TEXT;
  END IF;
END $$;

-- Ensure all existing users have 'approved' status
UPDATE users
SET approval_status = 'approved'
WHERE approval_status IS NULL;

-- 5. Performance and filtering indexes
CREATE INDEX IF NOT EXISTS idx_users_approval_status ON users(approval_status);
CREATE INDEX IF NOT EXISTS idx_users_plant_approval ON users(plant_id, approval_status);
CREATE INDEX IF NOT EXISTS idx_users_approved_by ON users(approved_by);

-- >>>>>>>>>>>>>> END MIGRATION: 014_operator_signup_and_approval.sql <<<<<<<<<<<<<<


-- >>>>>>>>>>>>>> START MIGRATION: 015_operator_machine_signin_and_approval.sql <<<<<<<<<<<<<<
-- =====================================================================
-- JCB SMART CMMS MIGRATION 015: OPERATOR MACHINE SELECTION & MANAGER APPROVAL WORKFLOW
-- Safe, additive, idempotent, non-destructive migration.
-- 1. Creates 'operator_machine_assignments' table for shift sign-in sessions.
-- 2. Adds partial unique indexes to guarantee concurrency safety (no double booking).
-- 3. Adds tracking columns on 'machines' for current active operator.
-- =====================================================================

DO $$
BEGIN
  -- 1. Create operator_machine_assignments table if not exists
  CREATE TABLE IF NOT EXISTS operator_machine_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
    shift VARCHAR(50) DEFAULT 'Shift A',
    status VARCHAR(50) NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'approved', 'rejected', 'released', 'cancelled')),
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    rejected_by UUID REFERENCES users(id) ON DELETE SET NULL,
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,
    signed_in_at TIMESTAMPTZ,
    signed_out_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- 2. Add current operator tracking columns to machines table if not exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'machines' AND column_name = 'current_operator_id'
  ) THEN
    ALTER TABLE machines ADD COLUMN current_operator_id UUID REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'machines' AND column_name = 'assignment_status'
  ) THEN
    ALTER TABLE machines ADD COLUMN assignment_status VARCHAR(50) NOT NULL DEFAULT 'unassigned'
      CHECK (assignment_status IN ('unassigned', 'pending_approval', 'occupied'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'machines' AND column_name = 'current_assignment_id'
  ) THEN
    ALTER TABLE machines ADD COLUMN current_assignment_id UUID REFERENCES operator_machine_assignments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. High-performance indexes for lookups
CREATE INDEX IF NOT EXISTS idx_oma_operator_id ON operator_machine_assignments(operator_id);
CREATE INDEX IF NOT EXISTS idx_oma_machine_id ON operator_machine_assignments(machine_id);
CREATE INDEX IF NOT EXISTS idx_oma_shop_id ON operator_machine_assignments(shop_id);
CREATE INDEX IF NOT EXISTS idx_oma_plant_id ON operator_machine_assignments(plant_id);
CREATE INDEX IF NOT EXISTS idx_oma_status ON operator_machine_assignments(status);
CREATE INDEX IF NOT EXISTS idx_oma_plant_status ON operator_machine_assignments(plant_id, status);

-- 4. Atomic Concurrency Guard: Only ONE pending or approved assignment per machine at any time
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_or_pending_machine
  ON operator_machine_assignments(machine_id)
  WHERE status IN ('pending', 'approved');

-- 5. Atomic Concurrency Guard: An operator can only have ONE pending or approved machine at any time
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_or_pending_operator
  ON operator_machine_assignments(operator_id)
  WHERE status IN ('pending', 'approved');

-- 6. Indexes on machines table for operator tracking
CREATE INDEX IF NOT EXISTS idx_machines_current_operator ON machines(current_operator_id);
CREATE INDEX IF NOT EXISTS idx_machines_assignment_status ON machines(assignment_status);

-- >>>>>>>>>>>>>> END MIGRATION: 015_operator_machine_signin_and_approval.sql <<<<<<<<<<<<<<


-- >>>>>>>>>>>>>> START MIGRATION: 016_operator_signup_requested_machine.sql <<<<<<<<<<<<<<
-- =====================================================================
-- JCB SMART CMMS MIGRATION 016: OPERATOR SIGNUP REQUESTED MACHINE PREFERENCE
-- Safe, additive, idempotent, non-destructive migration.
-- 1. Adds 'requested_machine_id' column to 'users' table referencing 'machines'.
-- 2. Adds index for fast lookup of users by requested machine.
-- =====================================================================

DO $$
BEGIN
  -- 1. Add requested_machine_id column to users table if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'requested_machine_id'
  ) THEN
    ALTER TABLE users ADD COLUMN requested_machine_id UUID REFERENCES machines(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Performance and lookup index
CREATE INDEX IF NOT EXISTS idx_users_requested_machine ON users(requested_machine_id);

-- >>>>>>>>>>>>>> END MIGRATION: 016_operator_signup_requested_machine.sql <<<<<<<<<<<<<<


-- >>>>>>>>>>>>>> START MIGRATION: 017_operator_permanent_and_temporary_assignment.sql <<<<<<<<<<<<<<
-- =====================================================================
-- JCB SMART CMMS MIGRATION 017: OPERATOR PERMANENT & TEMPORARY MACHINE ASSIGNMENT
-- Safe, additive, idempotent, non-destructive migration.
-- 1. Adds 'permanent_machine_id' column to 'users' table referencing 'machines'.
-- 2. Backfills 'permanent_machine_id' from 'requested_machine_id' for approved operators.
-- 3. Adds 'assignment_type', 'replacement_for_machine_id', and 'breakdown_id'
--    columns to 'operator_machine_assignments' table.
-- 4. Creates lookup and performance indexes.
-- =====================================================================

DO $$
BEGIN
  -- 1. Add permanent_machine_id column to users table if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'permanent_machine_id'
  ) THEN
    ALTER TABLE users ADD COLUMN permanent_machine_id UUID REFERENCES machines(id) ON DELETE SET NULL;
  END IF;

  -- 2. Add assignment_type column to operator_machine_assignments table if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'operator_machine_assignments' AND column_name = 'assignment_type'
  ) THEN
    ALTER TABLE operator_machine_assignments 
    ADD COLUMN assignment_type VARCHAR(50) NOT NULL DEFAULT 'temporary'
      CHECK (assignment_type IN ('permanent', 'temporary', 'shift'));
  END IF;

  -- 3. Add replacement_for_machine_id column to operator_machine_assignments if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'operator_machine_assignments' AND column_name = 'replacement_for_machine_id'
  ) THEN
    ALTER TABLE operator_machine_assignments 
    ADD COLUMN replacement_for_machine_id UUID REFERENCES machines(id) ON DELETE SET NULL;
  END IF;

  -- 4. Add breakdown_id column to operator_machine_assignments if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'operator_machine_assignments' AND column_name = 'breakdown_id'
  ) THEN
    ALTER TABLE operator_machine_assignments 
    ADD COLUMN breakdown_id UUID REFERENCES maintenance_requests(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 5. Backfill existing approved operators' permanent_machine_id from requested_machine_id
UPDATE users
SET permanent_machine_id = requested_machine_id
WHERE permanent_machine_id IS NULL
  AND requested_machine_id IS NOT NULL
  AND approval_status = 'approved'
  AND role = 'operator';

-- 6. Performance and lookup indexes
CREATE INDEX IF NOT EXISTS idx_users_permanent_machine ON users(permanent_machine_id);
CREATE INDEX IF NOT EXISTS idx_oma_assignment_type ON operator_machine_assignments(assignment_type);
CREATE INDEX IF NOT EXISTS idx_oma_replacement_for ON operator_machine_assignments(replacement_for_machine_id);
CREATE INDEX IF NOT EXISTS idx_oma_breakdown_id ON operator_machine_assignments(breakdown_id);

-- >>>>>>>>>>>>>> END MIGRATION: 017_operator_permanent_and_temporary_assignment.sql <<<<<<<<<<<<<<


-- >>>>>>>>>>>>>> START MIGRATION: 018_pm_plan_machines_and_execution.sql <<<<<<<<<<<<<<
-- =====================================================================
-- JCB SMART CMMS MIGRATION 018: PM PLAN MACHINES RELATIONSHIP & EXECUTION LINK
-- Safe, additive, idempotent, non-destructive migration.
-- 1. Creates 'pm_plan_machines' relational junction table.
-- 2. Backfills 'pm_plan_machines' from existing 'pm_plans.machine_id'.
-- 3. Adds 'pm_plan_id' column to 'work_orders' table.
-- 4. Backfills 'work_orders.pm_plan_id' for existing regular maintenance jobs.
-- 5. Adds lookup, performance, and duplicate prevention indexes.
-- =====================================================================

DO $$
BEGIN
  -- 1. Create pm_plan_machines junction table if not exists
  CREATE TABLE IF NOT EXISTS pm_plan_machines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID NOT NULL REFERENCES pm_plans(id) ON DELETE CASCADE,
    machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_pm_plan_machine UNIQUE (plan_id, machine_id)
  );

  -- 2. Add pm_plan_id column to work_orders if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_orders' AND column_name = 'pm_plan_id'
  ) THEN
    ALTER TABLE work_orders ADD COLUMN pm_plan_id UUID REFERENCES pm_plans(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_pm_plan_machines_plan ON pm_plan_machines(plan_id);
CREATE INDEX IF NOT EXISTS idx_pm_plan_machines_machine ON pm_plan_machines(machine_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_pm_plan_id ON work_orders(pm_plan_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_open_pm_executions 
  ON work_orders(pm_plan_id, machine_id, status)
  WHERE classification = 'regular_maintenance' AND status NOT IN ('verified_closed', 'completed');

-- 4. Backfill pm_plan_machines from existing pm_plans
INSERT INTO pm_plan_machines (plan_id, machine_id)
SELECT id, machine_id 
FROM pm_plans 
WHERE machine_id IS NOT NULL
ON CONFLICT (plan_id, machine_id) DO NOTHING;

-- 5. Backfill work_orders.pm_plan_id from existing regular_maintenance records
UPDATE work_orders wo
SET pm_plan_id = p.id
FROM pm_plans p
WHERE wo.classification = 'regular_maintenance'
  AND wo.pm_plan_id IS NULL
  AND (
    wo.work_instructions LIKE '%' || p.id::text || '%'
    OR wo.work_instructions LIKE '%' || p.plan_code || '%'
  );

-- >>>>>>>>>>>>>> END MIGRATION: 018_pm_plan_machines_and_execution.sql <<<<<<<<<<<<<<



-- ====================================================================
-- PART A: CORE INITIAL SEED DATA (5 ROLES + BASIC SHOPS & MACHINES)
-- ====================================================================

-- =====================================================================
-- JCB SMART CMMS SEED DATA (ALIGNED WITH ENTERPRISE 5-ROLE ARCHITECTURE)
-- Core Roles: Admin, Manager, Store Manager, Operator, Technician
-- =====================================================================

-- 1. Plants
INSERT INTO plants (id, plant_code, plant_name, address, state, city, pin_code, plant_manager, contact_number, email)
VALUES 
  ('b0000000-0000-0000-0000-000000000001', 'PLANT-BALLABGARH', 'JCB Ballabgarh Works', '23/7 Mathura Road', 'Haryana', 'Ballabgarh', '121004', 'Rajesh Sharma', '+91-129-4299000', 'rajesh.sharma@jcb.com'),
  ('b0000000-0000-0000-0000-000000000002', 'PLANT-PUNE', 'JCB Pune Manufacturing Plant', 'Talegaon Industrial Area', 'Maharashtra', 'Pune', '410507', 'Amit Deshmukh', '+91-211-4668000', 'amit.deshmukh@jcb.com'),
  ('b0000000-0000-0000-0000-000000000003', 'PLANT-JAIPUR', 'JCB Jaipur Works', 'Mahindra World City', 'Rajasthan', 'Jaipur', '302037', 'Vikram Rathore', '+91-141-7100000', 'vikram.rathore@jcb.com')
ON CONFLICT (plant_code) DO NOTHING;

-- 2. Shops
INSERT INTO shops (id, plant_id, shop_code, shop_name, description)
VALUES 
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'SHOP-CNC', 'CNC Machining Shop', '100 precision milling & turning machining centers'),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'SHOP-ROB', 'Robotic Welding Shop', '200 automated robotic welding arms'),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'SHOP-CUT', 'Cutting & Blanking Shop', '300 laser & hydraulic cutting presses')
ON CONFLICT (shop_code) DO NOTHING;

-- 3. Users (Core Roles including Store Manager)
INSERT INTO users (id, employee_code, full_name, email, phone, role, plant_id, shop_id, department, designation, shift, skills_json, password_hash)
VALUES 
  ('f0000000-0000-0000-0000-000000000001', 'EMP-ADM-001', 'Rajesh Admin', 'admin@jcb.com', '+91-9811000001', 'admin', 'b0000000-0000-0000-0000-000000000001', NULL, 'IT & Systems', 'Enterprise Administrator', 'General', '[]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e'),
  ('f0000000-0000-0000-0000-000000000002', 'EMP-MGR-001', 'Vikas Verma', 'manager@jcb.com', '+91-9811000002', 'manager', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Maintenance', 'Maintenance In-Charge', 'Shift A', '[]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e'),
  ('f0000000-0000-0000-0000-000000000003', 'EMP-TCH-001', 'Sunil Yadav', 'technician@jcb.com', '+91-9811000003', 'technician', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Electrical Maintenance', 'Senior Maintenance Tech', 'Shift A', '["Electrical", "PLC", "Hydraulic"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e'),
  ('f0000000-0000-0000-0000-000000000004', 'EMP-OPR-001', 'Ramesh Chandra', 'operator@jcb.com', '+91-9811000004', 'operator', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Production Operations', 'CNC Machine Operator', 'Shift A', '[]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e'),
  ('f0000000-0000-0000-0000-000000000005', 'EMP-STM-001', 'Ramesh Gupta', 'store@jcb.com', '+91-9811000005', 'store_manager', 'b0000000-0000-0000-0000-000000000001', NULL, 'Central Stores & Inventory', 'Store Manager', 'General', '["Inventory Control", "Material Handling", "Procurement"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e')
ON CONFLICT (employee_code) DO NOTHING;

-- 4. Machines
INSERT INTO machines (
  id, shop_id, machine_code, name, category, oem_manufacturer, model_number, serial_number, 
  bay_line_location, criticality, status, operating_hours, qr_code_uid, description
)
VALUES 
  (
    '10000000-0000-0000-0000-000000000001', 
    'c0000000-0000-0000-0000-000000000001', 
    'CNC-001', 
    'Mazak Horizontal Machining Center 1', 
    'HMC', 
    'Mazak', 
    'HCN-6800 NEO', 
    'MZK-2023-8991', 
    'Bay 1 / Line 4', 
    'class_a', 
    'running', 
    4320.50, 
    'QR-JCB-CNC-001-UID', 
    'Critical bottleneck machining center for heavy JCB backhoe loader transmission casings'
  ),
  (
    '10000000-0000-0000-0000-000000000002', 
    'c0000000-0000-0000-0000-000000000002', 
    'ROB-012', 
    'Fanuc 6-Axis Robotic Welding Station', 
    'Robotic Welder', 
    'Fanuc', 
    'ARC Mate 120iD', 
    'FNC-9912-3341', 
    'Bay 2 / Line ROB-1', 
    'class_a', 
    'running', 
    6140.00, 
    'QR-JCB-ROB-012-UID', 
    'Primary automated welding cell for excavator boom structural fabrication'
  ),
  (
    '10000000-0000-0000-0000-000000000003', 
    'c0000000-0000-0000-0000-000000000003', 
    'CUT-001', 
    'Schuler 1000T Hydraulic Forming Press', 
    'Press', 
    'Schuler', 
    'HP-1000-ECO', 
    'SCH-1000-091', 
    'Cutting Bay 3', 
    'class_b', 
    'running', 
    11200.00, 
    'QR-JCB-CUT-001-UID', 
    'Heavy hydraulic press for cab roof and bonnet deep-draw stamping'
  )
ON CONFLICT (machine_code) DO NOTHING;

-- 5. Spare Parts Catalog (Sample covering 160k structure)
INSERT INTO spare_parts (
  part_number, oem_part_number, name, description, category, subcategory, warehouse_zone, bin_location,
  current_physical_stock, reserved_stock, quarantined_stock, min_reorder_level, unit_cost
)
VALUES 
  ('HYD-10025', 'REX-4WRKE-25', 'Hydraulic Pump Filter Element', 'Bosch Rexroth high-pressure microglass filter element for CNC-001', 'Hydraulic', 'Filters', 'Main Store', 'A-01-05', 18, 3, 0, 10, 4850.00),
  ('BRG-70140', 'SKF-7014-CE', 'High Precision Angular Spindle Bearing', 'Super-precision ceramic hybrid bearing for Mazak 12,000 RPM spindle', 'Bearings', 'Spindles', 'Main Store', 'B-02-12', 8, 1, 0, 2, 76200.00),
  ('MTR-02200', 'FAN-A06B-0235', 'Fanuc AC Servo Motor 3.0kW', 'Joint 2 axis servo motor for robot welding arm', 'Electrical', 'Motors', 'Main Store', 'C-04-01', 4, 0, 0, 1, 142000.00),
  ('SEL-99100', 'PAR-HYD-SEAL', 'Hydraulic Cylinder Seal Kit 120mm', 'Polyurethane seal assembly for 1000T press ram', 'Seals', 'Hydraulic', 'Main Store', 'D-01-08', 25, 0, 0, 5, 8900.00)
ON CONFLICT (part_number) DO NOTHING;

-- 6. Standard Pre-Shift Inspection Templates
INSERT INTO inspection_templates (
  id, machine_category, title, checklist, is_active, created_at, updated_at
)
VALUES 
  (
    '50000000-0000-0000-0000-000000000001',
    'HMC',
    'HMC Daily Pre-Shift Machinery Inspection Checklist',
    '{
      "version": 1,
      "items": [
        { "id": "chk-1", "label": "Hydraulic System Pressure within 45 - 55 Bar", "type": "number", "unit": "Bar", "min": 45, "max": 55, "critical_min": 35, "critical_max": 70, "required": true, "is_critical": true },
        { "id": "chk-2", "label": "Chiller Unit Operating Temperature (18C - 24C)", "type": "number", "unit": "C", "min": 18, "max": 24, "critical_min": 15, "critical_max": 35, "required": true, "is_critical": false },
        { "id": "chk-3", "label": "Visual Check: No hydraulic fluid pooling or line leaks", "type": "boolean", "required": true, "is_critical": false },
        { "id": "chk-4", "label": "Emergency Stop & Safety Enclosure Interlock Operational", "type": "boolean", "required": true, "is_critical": true },
        { "id": "chk-5", "label": "Way Lube Automatic Lubrication Reservoir Full", "type": "boolean", "required": true, "is_critical": false }
      ],
      "sensor_thresholds": {
        "pressure": { "min": 45, "max": 55, "critical_min": 35, "critical_max": 70, "unit": "Bar", "required": true },
        "temperature": { "min": 18, "max": 24, "critical_min": 15, "critical_max": 35, "unit": "C", "required": true },
        "vibration": { "max": 2.5, "critical_max": 4.5, "unit": "mm/s", "required": false }
      }
    }'::jsonb,
    TRUE,
    NOW(),
    NOW()
  ),
  (
    '50000000-0000-0000-0000-000000000002',
    'Robotic Welder',
    'Robotic Welder Pre-Shift Safety & Sensor Inspection',
    '{
      "version": 1,
      "items": [
        { "id": "chk-rob-1", "label": "Safety Light Curtain & Area Interlock Active", "type": "boolean", "required": true, "is_critical": true },
        { "id": "chk-rob-2", "label": "Weld Shielding Gas Line Pressure (5 - 7 Bar)", "type": "number", "unit": "Bar", "min": 5, "max": 7, "critical_min": 4, "critical_max": 8, "required": true, "is_critical": true },
        { "id": "chk-rob-3", "label": "Torch Tip & Wire Feed Visual Inspection", "type": "boolean", "required": true, "is_critical": false },
        { "id": "chk-rob-4", "label": "Coolant Flow Rate & Radiator Temp Nominal", "type": "boolean", "required": true, "is_critical": false }
      ],
      "sensor_thresholds": {
        "pressure": { "min": 5, "max": 7, "critical_min": 4, "critical_max": 8, "unit": "Bar", "required": true },
        "temperature": { "min": 15, "max": 35, "critical_min": 10, "critical_max": 45, "unit": "C", "required": false },
        "vibration": { "max": 1.8, "critical_max": 3.0, "unit": "mm/s", "required": false }
      }
    }'::jsonb,
    TRUE,
    NOW(),
    NOW()
  ),
  (
    '50000000-0000-0000-0000-000000000003',
    'Press',
    'Hydraulic Forming Press Daily Pre-Shift Inspection',
    '{
      "version": 1,
      "items": [
        { "id": "chk-prs-1", "label": "Hydraulic Ram Main Pressure (150 - 220 Bar)", "type": "number", "unit": "Bar", "min": 150, "max": 220, "critical_min": 120, "critical_max": 260, "required": true, "is_critical": true },
        { "id": "chk-prs-2", "label": "Die Clamping Mechanism Locked & Interlocked", "type": "boolean", "required": true, "is_critical": true },
        { "id": "chk-prs-3", "label": "Hydraulic Sump Oil Temperature (25C - 45C)", "type": "number", "unit": "C", "min": 25, "max": 45, "critical_min": 20, "critical_max": 60, "required": true, "is_critical": false },
        { "id": "chk-prs-4", "label": "Emergency Stop Buttons Tested Across 4 Corners", "type": "boolean", "required": true, "is_critical": true }
      ],
      "sensor_thresholds": {
        "pressure": { "min": 150, "max": 220, "critical_min": 120, "critical_max": 260, "unit": "Bar", "required": true },
        "temperature": { "min": 25, "max": 45, "critical_min": 20, "critical_max": 60, "unit": "C", "required": true },
        "vibration": { "max": 3.5, "critical_max": 5.5, "unit": "mm/s", "required": false }
      }
    }'::jsonb,
    TRUE,
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;


-- ====================================================================
-- PART B: FULL 30 MAHARASHTRIAN ASSETS, WORK ORDERS & PERSONNEL
-- ====================================================================

-- =====================================================================
-- JCB SMART CMMS: COMPREHENSIVE 30 MAHARASHTRIAN DATASET FOR ALL TABLES
-- Fully Populates EVERY Field in Every Table with Exact Schema Enums:
-- 1. Plants (Pune Talegaon Industrial Hub)
-- 2. Shops (5 Specialized Precision Manufacturing Bays)
-- 3. 30 Users (2 Admins, 4 Managers, 4 Store Managers, 10 Technicians, 10 Operators)
-- 4. 30 Machines (All 19+ Fields Fully Populated with Genuine OEM Specs)
-- 5. 30 Spare Parts (All 13 Fields: SKUs, Bin Locations, Stocks, Unit Costs)
-- 6. 30 Maharashtra MIDC Industrial Vendors (Chakan, Bhosari, Pimpri, Talegaon)
-- 7. 30 Breakdown Complaints / Maintenance Requests (Status: new, pending_review, work_order_created)
-- 8. 30 Work Orders (Status: completed, verified_closed, in_progress, assigned, waiting_for_parts, under_diagnosis)
-- 9. 30 Operator Pre-Shift Machine Inspection Records (Temp, Vibration, Pressure Sensor Readings)
-- 10. 30 PM Plans (Checklists, Thresholds, Frequencies, Next Due Dates)
-- 11. 30 Inventory & Spare Parts Transactions (STOCK_IN, ISSUE, RESERVATION)
-- 12. 30 Operator-Machine Active Shift Assignments & Sign-Ins
-- =====================================================================

DO $$
BEGIN

-- 1. Plants (JCB Pune Heavy Manufacturing Works)
INSERT INTO plants (id, plant_code, plant_name, address, state, city, pin_code, plant_manager, contact_number, email)
VALUES ('b0000000-0000-0000-0000-000000000002', 'PLANT-PUNE', 'JCB Pune Heavy Manufacturing Works', 'Plot A-1, Talegaon Industrial Area, Chakan-Talegaon Road', 'Maharashtra', 'Pune', '410507', 'Sachin D. Patil', '+91-211-4668000', 'sachin.patil@jcb.com')
ON CONFLICT (plant_code) DO UPDATE SET plant_name = EXCLUDED.plant_name;

-- 2. Pune Specialized Production Shops
INSERT INTO shops (id, plant_id, shop_code, shop_name, description) VALUES
  ('c0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000002', 'PUN-SHP-HMC', 'Pune HMC & VMC Heavy Machining Shop', 'Precision CNC machining for 3DX backhoe loader chassis, axles, and transmission housings'),
  ('c0000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000002', 'PUN-SHP-ROB', 'Pune Robotic Welding & Arm Fabrication Shop', 'Automated Fanuc 6-axis robotic welding cells for structural booms and excavator dippers'),
  ('c0000000-0000-0000-0000-000000000013', 'b0000000-0000-0000-0000-000000000002', 'PUN-SHP-PRS', 'Pune 1000T Hydraulic Stamping & Press Shop', 'Heavy forming and blanking presses for excavator cabins, bonnets, and ROPS/FOPS canopies'),
  ('c0000000-0000-0000-0000-000000000014', 'b0000000-0000-0000-0000-000000000002', 'PUN-SHP-PNT', 'Pune Automated Electrostatic Powder Coating Line', 'Automated 12-stage chemical pre-treatment and JCB Classic Yellow powder coating plant'),
  ('c0000000-0000-0000-0000-000000000015', 'b0000000-0000-0000-0000-000000000002', 'PUN-SHP-ASM', 'Pune Heavy Excavator & Backhoe Final Assembly', 'Continuous moving takt-time assembly line, fluid filling, and hydraulic testing rigs')
ON CONFLICT (shop_code) DO NOTHING;

-- 3. 30 Maharashtrian Industrial Personnel (All 5 Roles)
INSERT INTO users (id, employee_code, full_name, email, phone, role, plant_id, shop_id, department, designation, shift, skills_json, password_hash, is_active, approval_status) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'EMP-MAH-001', 'Sachin D. Patil', 'sachin.patil@jcb.com', '+91-9822011001', 'admin', 'b0000000-0000-0000-0000-000000000002', NULL, 'Plant Systems & Governance', 'Enterprise VP & Plant Head', 'General', '["Enterprise Governance", "Plant Operations", "Reliability Engineering"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-000000000002', 'EMP-MAH-002', 'Aniket R. Deshmukh', 'aniket.deshmukh@jcb.com', '+91-9822011002', 'admin', 'b0000000-0000-0000-0000-000000000002', NULL, 'IT & Digital Operations', 'Principal Systems Architect', 'General', '["Cloud Infrastructure", "Industrial IoT", "Database Architecture"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-000000000003', 'EMP-MAH-003', 'Rohan S. Kulkarni', 'rohan.kulkarni@jcb.com', '+91-9822011003', 'manager', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000011', 'Mechanical Maintenance', 'Plant Maintenance Manager', 'General', '["Mechanical Maintenance", "Total Productive Maintenance (TPM)", "Root Cause Analysis"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-000000000004', 'EMP-MAH-004', 'Swapnil M. Shinde', 'swapnil.shinde@jcb.com', '+91-9822011004', 'manager', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000012', 'Electrical & Automation', 'Automation Engineering Lead', 'General', '["Robotics Automation", "PLC Architecture", "SCADA Systems"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-000000000005', 'EMP-MAH-005', 'Amol V. More', 'amol.more@jcb.com', '+91-9822011005', 'manager', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000013', 'Heavy Press & Tooling', 'Tooling & Reliability Manager', 'General', '["Die Maintenance", "Heavy Hydraulics", "Forming Presses"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-000000000006', 'EMP-MAH-006', 'Prashant B. Chavan', 'prashant.chavan@jcb.com', '+91-9822011006', 'manager', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000015', 'Quality & Governance', 'Operations & Reliability In-Charge', 'General', '["ISO 9001", "Six Sigma", "Asset Reliability Governance"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-000000000007', 'EMP-MAH-007', 'Mahesh A. Gaikwad', 'mahesh.gaikwad@jcb.com', '+91-9822011007', 'store_manager', 'b0000000-0000-0000-0000-000000000002', NULL, 'Central Stores & Logistics', 'Chief Inventory Controller', 'General', '["Inventory Control", "SAP ERP", "Logistics Optimization", "ABC Analysis"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-000000000008', 'EMP-MAH-008', 'Ganesh N. Jadhav', 'ganesh.jadhav@jcb.com', '+91-9822011008', 'store_manager', 'b0000000-0000-0000-0000-000000000002', NULL, 'Spare Parts Warehouse', 'Senior Materials Manager', 'General', '["Material Inwarding", "Bin Location Auditing", "Vendor Logistics"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-000000000009', 'EMP-MAH-009', 'Santosh K. Bhosale', 'santosh.bhosale@jcb.com', '+91-9822011009', 'store_manager', 'b0000000-0000-0000-0000-000000000002', NULL, 'Tool Crib & Consumables', 'Tool Crib Supervisor', 'General', '["Tool Calibration", "Consumable Issuance", "RDC Scrap Reconciliation"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-00000000000a', 'EMP-MAH-010', 'Rahul T. Kadam', 'rahul.kadam@jcb.com', '+91-9822011010', 'store_manager', 'b0000000-0000-0000-0000-000000000002', NULL, 'Inbound Logistics & Receiving', 'Receiving Store Officer', 'General', '["PO Verification", "Goods Receipt Note (GRN)", "Quality Quarantine"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-00000000000b', 'EMP-MAH-011', 'Nitin G. Pawar', 'nitin.pawar@jcb.com', '+91-9822011011', 'technician', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000011', 'Mechanical Maintenance', 'Senior Mechanical Technician', 'Shift A', '["Rexroth Hydraulics", "Precision Bearings", "Pneumatics"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-00000000000c', 'EMP-MAH-012', 'Vishal B. Mane', 'vishal.mane@jcb.com', '+91-9822011012', 'technician', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000012', 'Electrical Maintenance', 'PLC & Automation Specialist', 'Shift A', '["Siemens S7-1500", "Fanuc Robots", "Profinet Diagnostics"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-00000000000d', 'EMP-MAH-013', 'Sandeep R. Thorat', 'sandeep.thorat@jcb.com', '+91-9822011013', 'technician', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000013', 'Hydraulics & Tooling', 'Lead Hydraulics Tech', 'Shift A', '["Proportional Valves", "Hydraulic Power Packs", "Manifold Blocks"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-00000000000e', 'EMP-MAH-014', 'Dattatray P. Khot', 'dattatray.khot@jcb.com', '+91-9822011014', 'technician', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000012', 'Robotic Welding Bay', 'Robotics Field Technician', 'Shift B', '["Fanuc ARC Mate", "Fronius MIG Torches", "Weld Seam Tracking"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-00000000000f', 'EMP-MAH-015', 'Mangesh D. Salunkhe', 'mangesh.salunkhe@jcb.com', '+91-9822011015', 'technician', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000011', 'CNC Machining Maintenance', 'Spindle & Tool Changer Tech', 'Shift B', '["Mazak High-Speed Spindles", "THK Ball Screws", "Laser Alignment"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-000000000010', 'EMP-MAH-016', 'Pravin V. Sawant', 'pravin.sawant@jcb.com', '+91-9822011016', 'technician', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000013', 'Press & Stamping Bay', 'Heavy Press Mechanical Tech', 'Shift B', '["1000T Ram Seals", "Cushion Cylinder Maintenance", "Oil Filtration"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-000000000011', 'EMP-MAH-017', 'Ajinkya C. Surve', 'ajinkya.surve@jcb.com', '+91-9822011017', 'technician', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000014', 'Powder Coating & Utilities', 'Plant Utilities Technician', 'Shift C', '["Screw Compressors", "Industrial Chillers", "Burner Heating Systems"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-000000000012', 'EMP-MAH-018', 'Yogesh S. Kamble', 'yogesh.kamble@jcb.com', '+91-9822011018', 'technician', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000011', 'Electrical & Instrumentation', 'Drives & VFD Tech', 'Shift C', '["ABB VFD Drives", "Servo Tunings", "Control Panel Thermal Scans"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-000000000013', 'EMP-MAH-019', 'Akash N. Tambade', 'akash.tambade@jcb.com', '+91-9822011019', 'technician', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000015', 'Preventive Maintenance Group', 'Condition Monitoring Specialist', 'General', '["Fluke Vibration Analysis", "FLIR Thermal Imaging", "Oil Spectrometry"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-000000000014', 'EMP-MAH-020', 'Siddhesh R. Gawade', 'siddhesh.gawade@jcb.com', '+91-9822011020', 'technician', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000012', 'Mechanical Fast Response Team', 'Emergency Breakdown Specialist', 'Shift A', '["Fast Breakdown Triage", "Emergency Alignment", "Pin-Bushing Extraction"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-000000000015', 'EMP-MAH-021', 'Tushar H. Shingade', 'tushar.shingade@jcb.com', '+91-9822011021', 'operator', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000011', 'CNC Machining', 'Senior HMC Machine Operator', 'Shift A', '["Mazak SmoothX CNC", "Part Probing", "Fixture Setup"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-000000000016', 'EMP-MAH-022', 'Onkar S. Navale', 'onkar.navale@jcb.com', '+91-9822011022', 'operator', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000012', 'Robotic Welding', 'Automated Cell Operator', 'Shift A', '["Teach Pendant Navigation", "Fixture Clamping", "Weld Inspection"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-000000000017', 'EMP-MAH-023', 'Vijay K. Lokhande', 'vijay.lokhande@jcb.com', '+91-9822011023', 'operator', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000013', 'Heavy Press Bay', 'Schuler 1000T Press Operator', 'Shift A', '["Die Changeover", "Tonnage Monitoring", "Sheet Alignment"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-000000000018', 'EMP-MAH-024', 'Pradeep B. Wagh', 'pradeep.wagh@jcb.com', '+91-9822011024', 'operator', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000013', 'Laser & Plasma Cutting', 'Trumpf Laser Cutting Operator', 'Shift A', '["Sheet Nesting", "Nozzle Centering", "Fiber Laser Safety"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-000000000019', 'EMP-MAH-025', 'Suraj M. Khilare', 'suraj.khilare@jcb.com', '+91-9822011025', 'operator', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000012', 'Chassis Fabrication', 'Excavator Frame Operator', 'Shift B', '["Heavy Rigging", "Tack Welding", "Dimension Verification"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-00000000001a', 'EMP-MAH-026', 'Kiran R. Ghadge', 'kiran.ghadge@jcb.com', '+91-9822011026', 'operator', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000014', 'Powder Coating Bay', 'Electrostatic Line Operator', 'Shift B', '["Powder Flow Metering", "Bake Oven Profiles", "DFT Thickness Gauge"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-00000000001b', 'EMP-MAH-027', 'Deepak N. Choudhary', 'deepak.choudhary@jcb.com', '+91-9822011027', 'operator', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000011', 'Transmission Assembly', 'Gearbox Line Operator', 'Shift B', '["Torque Angle Guns", "Backlash Measurement", "Cleanroom Assembly"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-00000000001c', 'EMP-MAH-028', 'Chetan P. Kore', 'chetan.kore@jcb.com', '+91-9822011028', 'operator', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000015', 'Boom Assembly', 'Boom & Dipper Fitter Operator', 'Shift C', '["Hydraulic Cylinder Mounting", "Hose Routing", "Pin Torquing"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-00000000001d', 'EMP-MAH-029', 'Nilesh A. Dhale', 'nilesh.dhale@jcb.com', '+91-9822011029', 'operator', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000015', 'Cabin & Trim Fitment', 'ROPS/FOPS Cabin Line Operator', 'Shift C', '["Harness Routing", "Glass Glazing", "Console Ergonomics Testing"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-00000000001e', 'EMP-MAH-030', 'Harsh V. Zagade', 'harsh.zagade@jcb.com', '+91-9822011030', 'operator', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000015', 'Final Inspection & Road Track', 'Machine Test Track Operator', 'General', '["Hydraulic Stall Testing", "Brake Dynamometer", "Pre-Delivery Checklist"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved')
ON CONFLICT (email) DO UPDATE SET 
  full_name = EXCLUDED.full_name,
  is_active = TRUE,
  approval_status = 'approved',
  password_hash = EXCLUDED.password_hash;

-- 4. 30 Industrial Machines (ALL 19+ Fields Fully Populated with Genuine OEM Specs)
INSERT INTO machines (
  id, shop_id, machine_code, name, category, oem_manufacturer, model_number, serial_number, 
  bay_line_location, criticality, status, operating_hours, maintenance_frequency_days, qr_code_uid, 
  manual_url, electrical_diagram_url, hydraulic_schematic_url, sop_document_url, description
) VALUES
  ('20000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000011', 'PUN-HMC-001', 'Mazak Horizontal Machining Center HCN-6800 NEO #1', 'HMC', 'Yamazaki Mazak Corp', 'HCN-6800 NEO', 'MZK-PUN-2026-001', 'Bay 1 / Line CNC-1', 'class_a', 'running', 4850.5, 30, 'QR-JCB-PUN-HMC-001-UID', 'https://manuals.jcb-cmms.internal/docs/PUN-HMC-001/operating_manual_rev3.pdf', 'https://manuals.jcb-cmms.internal/diagrams/PUN-HMC-001/electrical_schematic_v2.pdf', 'https://manuals.jcb-cmms.internal/schematics/PUN-HMC-001/hydraulic_circuit_rev4.pdf', 'https://manuals.jcb-cmms.internal/sop/PUN-HMC-001/standard_operating_procedure.pdf', 'High-speed twin-pallet 4-axis HMC machining JCB 3DX transmission housings.'),
  ('20000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000012', 'PUN-HMC-002', 'Mazak Horizontal Machining Center HCN-6800 NEO #2', 'HMC', 'Yamazaki Mazak Corp', 'HCN-6800 NEO', 'MZK-PUN-2026-002', 'Bay 1 / Line CNC-2', 'class_a', 'running', 5120.25, 30, 'QR-JCB-PUN-HMC-002-UID', 'https://manuals.jcb-cmms.internal/docs/PUN-HMC-002/operating_manual_rev3.pdf', 'https://manuals.jcb-cmms.internal/diagrams/PUN-HMC-002/electrical_schematic_v2.pdf', 'https://manuals.jcb-cmms.internal/schematics/PUN-HMC-002/hydraulic_circuit_rev4.pdf', 'https://manuals.jcb-cmms.internal/sop/PUN-HMC-002/standard_operating_procedure.pdf', 'Twin pallet HMC for heavy steel axle carrier precision boring.'),
  ('20000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000013', 'PUN-VMC-001', 'Makino Vertical Machining Center V99 Heavy Milling', 'VMC', 'Makino Milling Machine Co', 'V99-5AX', 'MAK-PUN-2026-003', 'Bay 1 / Line VMC-1', 'class_b', 'running', 3200, 45, 'QR-JCB-PUN-VMC-001-UID', 'https://manuals.jcb-cmms.internal/docs/PUN-VMC-001/operating_manual_rev3.pdf', 'https://manuals.jcb-cmms.internal/diagrams/PUN-VMC-001/electrical_schematic_v2.pdf', 'https://manuals.jcb-cmms.internal/schematics/PUN-VMC-001/hydraulic_circuit_rev4.pdf', 'https://manuals.jcb-cmms.internal/sop/PUN-VMC-001/standard_operating_procedure.pdf', 'Heavy 50-taper vertical milling center for kingpin and steering knuckle brackets.'),
  ('20000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000014', 'PUN-VMC-002', 'Doosan DNM 6700 High Productivity VMC', 'VMC', 'DN Solutions (Doosan)', 'DNM 6700', 'DOO-PUN-2026-004', 'Bay 1 / Line VMC-2', 'class_b', 'under_maintenance', 6410.75, 30, 'QR-JCB-PUN-VMC-002-UID', 'https://manuals.jcb-cmms.internal/docs/PUN-VMC-002/operating_manual_rev3.pdf', 'https://manuals.jcb-cmms.internal/diagrams/PUN-VMC-002/electrical_schematic_v2.pdf', 'https://manuals.jcb-cmms.internal/schematics/PUN-VMC-002/hydraulic_circuit_rev4.pdf', 'https://manuals.jcb-cmms.internal/sop/PUN-VMC-002/standard_operating_procedure.pdf', 'Precision vertical milling center for hydraulic valve manifold blocks.'),
  ('20000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000015', 'PUN-CNC-001', 'Okuma Multus U4000 Intelligent CNC Turning Center', 'CNC Lathe', 'Okuma Corporation', 'Multus U4000', 'OKU-PUN-2026-005', 'Bay 1 / Line LAT-1', 'class_a', 'running', 2890.1, 30, 'QR-JCB-PUN-CNC-001-UID', 'https://manuals.jcb-cmms.internal/docs/PUN-CNC-001/operating_manual_rev3.pdf', 'https://manuals.jcb-cmms.internal/diagrams/PUN-CNC-001/electrical_schematic_v2.pdf', 'https://manuals.jcb-cmms.internal/schematics/PUN-CNC-001/hydraulic_circuit_rev4.pdf', 'https://manuals.jcb-cmms.internal/sop/PUN-CNC-001/standard_operating_procedure.pdf', 'Multi-tasking turn-mill center for excavator track drive shafts and pins.'),
  ('20000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000011', 'PUN-ROB-001', 'Fanuc ARC Mate 120iD 6-Axis Boom Welding Robot #1', 'Robotic Welder', 'Fanuc Robotics Japan', 'ARC Mate 120iD/35', 'FNC-PUN-2026-006', 'Bay 2 / Cell ROB-1', 'class_a', 'running', 7850.3, 15, 'QR-JCB-PUN-ROB-001-UID', 'https://manuals.jcb-cmms.internal/docs/PUN-ROB-001/operating_manual_rev3.pdf', 'https://manuals.jcb-cmms.internal/diagrams/PUN-ROB-001/electrical_schematic_v2.pdf', 'https://manuals.jcb-cmms.internal/schematics/PUN-ROB-001/hydraulic_circuit_rev4.pdf', 'https://manuals.jcb-cmms.internal/sop/PUN-ROB-001/standard_operating_procedure.pdf', 'Automated tandem welding robot with Fronius power source for backhoe boom fabrication.'),
  ('20000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000012', 'PUN-ROB-002', 'Fanuc ARC Mate 120iD 6-Axis Dipper Welding Robot #2', 'Robotic Welder', 'Fanuc Robotics Japan', 'ARC Mate 120iD/35', 'FNC-PUN-2026-007', 'Bay 2 / Cell ROB-2', 'class_a', 'breakdown', 7420, 15, 'QR-JCB-PUN-ROB-002-UID', 'https://manuals.jcb-cmms.internal/docs/PUN-ROB-002/operating_manual_rev3.pdf', 'https://manuals.jcb-cmms.internal/diagrams/PUN-ROB-002/electrical_schematic_v2.pdf', 'https://manuals.jcb-cmms.internal/schematics/PUN-ROB-002/hydraulic_circuit_rev4.pdf', 'https://manuals.jcb-cmms.internal/sop/PUN-ROB-002/standard_operating_procedure.pdf', 'Structural welding cell for heavy dipper and bucket pivot brackets.'),
  ('20000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000013', 'PUN-ROB-003', 'ABB IRB 6700 Heavy Spot & Seam Welding Robot', 'Robotic Welder', 'ABB Robotics Sweden', 'IRB 6700-200/2.60', 'ABB-PUN-2026-008', 'Bay 2 / Cell ROB-3', 'class_b', 'running', 4190.8, 30, 'QR-JCB-PUN-ROB-003-UID', 'https://manuals.jcb-cmms.internal/docs/PUN-ROB-003/operating_manual_rev3.pdf', 'https://manuals.jcb-cmms.internal/diagrams/PUN-ROB-003/electrical_schematic_v2.pdf', 'https://manuals.jcb-cmms.internal/schematics/PUN-ROB-003/hydraulic_circuit_rev4.pdf', 'https://manuals.jcb-cmms.internal/sop/PUN-ROB-003/standard_operating_procedure.pdf', 'Chassis main body robotic seam welder for 4-wheel drive loaders.'),
  ('20000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000014', 'PUN-ROB-004', 'KUKA KR 300 R2500 Heavy Frame Welding Cell', 'Robotic Welder', 'KUKA AG Germany', 'KR 300 R2500 ultra', 'KUK-PUN-2026-009', 'Bay 2 / Cell ROB-4', 'class_a', 'running', 5670.4, 30, 'QR-JCB-PUN-ROB-004-UID', 'https://manuals.jcb-cmms.internal/docs/PUN-ROB-004/operating_manual_rev3.pdf', 'https://manuals.jcb-cmms.internal/diagrams/PUN-ROB-004/electrical_schematic_v2.pdf', 'https://manuals.jcb-cmms.internal/schematics/PUN-ROB-004/hydraulic_circuit_rev4.pdf', 'https://manuals.jcb-cmms.internal/sop/PUN-ROB-004/standard_operating_procedure.pdf', 'Heavy frame structural robotic welding system.'),
  ('20000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-000000000015', 'PUN-PRS-001', 'Schuler 1000T Hydraulic Deep-Draw Forming Press', 'Hydraulic Press', 'Schuler Group Germany', 'HP-1000-ECO', 'SCH-PUN-2026-010', 'Bay 3 / Line PRS-1', 'class_a', 'running', 11450, 15, 'QR-JCB-PUN-PRS-001-UID', 'https://manuals.jcb-cmms.internal/docs/PUN-PRS-001/operating_manual_rev3.pdf', 'https://manuals.jcb-cmms.internal/diagrams/PUN-PRS-001/electrical_schematic_v2.pdf', 'https://manuals.jcb-cmms.internal/schematics/PUN-PRS-001/hydraulic_circuit_rev4.pdf', 'https://manuals.jcb-cmms.internal/sop/PUN-PRS-001/standard_operating_procedure.pdf', '1000-ton hydraulic press deep-drawing cab roof panels and steel engine hoods.'),
  ('20000000-0000-0000-0000-00000000000b', 'c0000000-0000-0000-0000-000000000011', 'PUN-PRS-002', 'Komatsu 600T Mechanical Stamping Press', 'Mechanical Press', 'Komatsu Press Japan', 'E2W-600', 'KOM-PUN-2026-011', 'Bay 3 / Line PRS-2', 'class_b', 'running', 9840.5, 30, 'QR-JCB-PUN-PRS-002-UID', 'https://manuals.jcb-cmms.internal/docs/PUN-PRS-002/operating_manual_rev3.pdf', 'https://manuals.jcb-cmms.internal/diagrams/PUN-PRS-002/electrical_schematic_v2.pdf', 'https://manuals.jcb-cmms.internal/schematics/PUN-PRS-002/hydraulic_circuit_rev4.pdf', 'https://manuals.jcb-cmms.internal/sop/PUN-PRS-002/standard_operating_procedure.pdf', '600-ton straight side mechanical blanking and piercing press.'),
  ('20000000-0000-0000-0000-00000000000c', 'c0000000-0000-0000-0000-000000000012', 'PUN-PRS-003', 'Aida 400T Progressive Die Stamping Press', 'Mechanical Press', 'Aida Engineering', 'NC2-4000', 'AID-PUN-2026-012', 'Bay 3 / Line PRS-3', 'class_b', 'idle', 4310.2, 30, 'QR-JCB-PUN-PRS-003-UID', 'https://manuals.jcb-cmms.internal/docs/PUN-PRS-003/operating_manual_rev3.pdf', 'https://manuals.jcb-cmms.internal/diagrams/PUN-PRS-003/electrical_schematic_v2.pdf', 'https://manuals.jcb-cmms.internal/schematics/PUN-PRS-003/hydraulic_circuit_rev4.pdf', 'https://manuals.jcb-cmms.internal/sop/PUN-PRS-003/standard_operating_procedure.pdf', 'High-speed stamping press for reinforcement brackets and gussets.'),
  ('20000000-0000-0000-0000-00000000000d', 'c0000000-0000-0000-0000-000000000013', 'PUN-LAS-001', 'Trumpf TruLaser 5030 Fiber 10kW CNC Laser Cutter', 'Laser Cutter', 'Trumpf GmbH Germany', 'TruLaser 5030 (L76)', 'TRU-PUN-2026-013', 'Bay 3 / Line CUT-1', 'class_a', 'running', 3820.6, 15, 'QR-JCB-PUN-LAS-001-UID', 'https://manuals.jcb-cmms.internal/docs/PUN-LAS-001/operating_manual_rev3.pdf', 'https://manuals.jcb-cmms.internal/diagrams/PUN-LAS-001/electrical_schematic_v2.pdf', 'https://manuals.jcb-cmms.internal/schematics/PUN-LAS-001/hydraulic_circuit_rev4.pdf', 'https://manuals.jcb-cmms.internal/sop/PUN-LAS-001/standard_operating_procedure.pdf', '10kW fiber laser cutting high-strength Hardox steel plates up to 30mm thick.'),
  ('20000000-0000-0000-0000-00000000000e', 'c0000000-0000-0000-0000-000000000014', 'PUN-LAS-002', 'Bystronic ByStar Fiber 12kW Heavy Sheet Laser', 'Laser Cutter', 'Bystronic Laser Switzerland', 'ByStar Fiber 4020', 'BYS-PUN-2026-014', 'Bay 3 / Line CUT-2', 'class_a', 'running', 4150, 15, 'QR-JCB-PUN-LAS-002-UID', 'https://manuals.jcb-cmms.internal/docs/PUN-LAS-002/operating_manual_rev3.pdf', 'https://manuals.jcb-cmms.internal/diagrams/PUN-LAS-002/electrical_schematic_v2.pdf', 'https://manuals.jcb-cmms.internal/schematics/PUN-LAS-002/hydraulic_circuit_rev4.pdf', 'https://manuals.jcb-cmms.internal/sop/PUN-LAS-002/standard_operating_procedure.pdf', 'Large-format fiber laser cutting main loader arms and side panels.'),
  ('20000000-0000-0000-0000-00000000000f', 'c0000000-0000-0000-0000-000000000015', 'PUN-PLM-001', 'Messer MultiTherm Heavy CNC Plasma & Oxy-Fuel Cutting Gantry', 'Plasma Cutter', 'Messer Cutting Systems', 'MultiTherm 4000', 'MES-PUN-2026-015', 'Bay 3 / Line CUT-3', 'class_b', 'running', 8230.15, 30, 'QR-JCB-PUN-PLM-001-UID', 'https://manuals.jcb-cmms.internal/docs/PUN-PLM-001/operating_manual_rev3.pdf', 'https://manuals.jcb-cmms.internal/diagrams/PUN-PLM-001/electrical_schematic_v2.pdf', 'https://manuals.jcb-cmms.internal/schematics/PUN-PLM-001/hydraulic_circuit_rev4.pdf', 'https://manuals.jcb-cmms.internal/sop/PUN-PLM-001/standard_operating_procedure.pdf', 'Heavy dual-gantry plasma and bevel cutting for excavator track frames.'),
  ('20000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000011', 'PUN-PNT-001', 'Gema OptiCenter Automated Powder Coating System', 'Powder Coating', 'Gema Switzerland GmbH', 'OptiCenter OC07', 'GEM-PUN-2026-016', 'Bay 4 / Line PNT-1', 'class_a', 'running', 6120.9, 30, 'QR-JCB-PUN-PNT-001-UID', 'https://manuals.jcb-cmms.internal/docs/PUN-PNT-001/operating_manual_rev3.pdf', 'https://manuals.jcb-cmms.internal/diagrams/PUN-PNT-001/electrical_schematic_v2.pdf', 'https://manuals.jcb-cmms.internal/schematics/PUN-PNT-001/hydraulic_circuit_rev4.pdf', 'https://manuals.jcb-cmms.internal/sop/PUN-PNT-001/standard_operating_procedure.pdf', 'Automated 24-gun electrostatic powder application booth for JCB Classic Yellow finish.'),
  ('20000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000012', 'PUN-PNT-002', 'Eisenmann 12-Stage Zinc-Phosphating Pretreatment Dip Tunnel', 'Pre-Treatment', 'Eisenmann SE Germany', 'PT-12-TUNNEL', 'EIS-PUN-2026-017', 'Bay 4 / Line PNT-2', 'class_a', 'running', 9140, 30, 'QR-JCB-PUN-PNT-002-UID', 'https://manuals.jcb-cmms.internal/docs/PUN-PNT-002/operating_manual_rev3.pdf', 'https://manuals.jcb-cmms.internal/diagrams/PUN-PNT-002/electrical_schematic_v2.pdf', 'https://manuals.jcb-cmms.internal/schematics/PUN-PNT-002/hydraulic_circuit_rev4.pdf', 'https://manuals.jcb-cmms.internal/sop/PUN-PNT-002/standard_operating_procedure.pdf', 'Continuous conveyor chemical degreasing, zinc phosphate coating, and deionized rinse.'),
  ('20000000-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-000000000013', 'PUN-PNT-003', 'Dürr EcoDry Oven High-Efficiency Convection Curing Oven', 'Curing Oven', 'Dürr Systems AG', 'EcoDryCure 220C', 'DUR-PUN-2026-018', 'Bay 4 / Line PNT-3', 'class_b', 'running', 8750.3, 60, 'QR-JCB-PUN-PNT-003-UID', 'https://manuals.jcb-cmms.internal/docs/PUN-PNT-003/operating_manual_rev3.pdf', 'https://manuals.jcb-cmms.internal/diagrams/PUN-PNT-003/electrical_schematic_v2.pdf', 'https://manuals.jcb-cmms.internal/schematics/PUN-PNT-003/hydraulic_circuit_rev4.pdf', 'https://manuals.jcb-cmms.internal/sop/PUN-PNT-003/standard_operating_procedure.pdf', 'Natural gas fired continuous drying and baking oven at 200°C for paint curing.'),
  ('20000000-0000-0000-0000-000000000013', 'c0000000-0000-0000-0000-000000000014', 'PUN-ASM-001', 'JCB Main Chassis Automated In-Line Carrier Conveyor', 'Assembly Conveyor', 'Dematic Material Handling', 'Power & Free PF-100', 'DEM-PUN-2026-019', 'Bay 5 / Line ASM-1', 'class_a', 'running', 12500, 30, 'QR-JCB-PUN-ASM-001-UID', 'https://manuals.jcb-cmms.internal/docs/PUN-ASM-001/operating_manual_rev3.pdf', 'https://manuals.jcb-cmms.internal/diagrams/PUN-ASM-001/electrical_schematic_v2.pdf', 'https://manuals.jcb-cmms.internal/schematics/PUN-ASM-001/hydraulic_circuit_rev4.pdf', 'https://manuals.jcb-cmms.internal/sop/PUN-ASM-001/standard_operating_procedure.pdf', 'Continuous overhead power and free conveyor synchronizing frame assembly through 18 stations.'),
  ('20000000-0000-0000-0000-000000000014', 'c0000000-0000-0000-0000-000000000015', 'PUN-ASM-002', 'Atlas Copco Multi-Spindle Digital Torque Nutrunner Station', 'Torque Station', 'Atlas Copco Sweden', 'Power Focus 6000', 'ATC-PUN-2026-020', 'Bay 5 / Line ASM-2', 'class_b', 'running', 3410.4, 15, 'QR-JCB-PUN-ASM-002-UID', 'https://manuals.jcb-cmms.internal/docs/PUN-ASM-002/operating_manual_rev3.pdf', 'https://manuals.jcb-cmms.internal/diagrams/PUN-ASM-002/electrical_schematic_v2.pdf', 'https://manuals.jcb-cmms.internal/schematics/PUN-ASM-002/hydraulic_circuit_rev4.pdf', 'https://manuals.jcb-cmms.internal/sop/PUN-ASM-002/standard_operating_procedure.pdf', 'Synchronized multi-spindle DC electric nutrunner torquing axle differential mounting bolts.'),
  ('20000000-0000-0000-0000-000000000015', 'c0000000-0000-0000-0000-000000000011', 'PUN-HYD-001', 'JCB Hydraulic Flushing & Oil Cleanliness Verification Rig', 'Hydraulic Rig', 'Parker Hannifin USA', 'FlushingRig-500L', 'PAR-PUN-2026-021', 'Bay 5 / Line HYD-1', 'class_a', 'running', 4950, 15, 'QR-JCB-PUN-HYD-001-UID', 'https://manuals.jcb-cmms.internal/docs/PUN-HYD-001/operating_manual_rev3.pdf', 'https://manuals.jcb-cmms.internal/diagrams/PUN-HYD-001/electrical_schematic_v2.pdf', 'https://manuals.jcb-cmms.internal/schematics/PUN-HYD-001/hydraulic_circuit_rev4.pdf', 'https://manuals.jcb-cmms.internal/sop/PUN-HYD-001/standard_operating_procedure.pdf', 'High-volume 500 L/min dynamic oil flushing station guaranteeing ISO 4406 16/14/11 cleanliness.'),
  ('20000000-0000-0000-0000-000000000016', 'c0000000-0000-0000-0000-000000000012', 'PUN-HYD-002', 'Rexroth Hydraulic Dynamic Cylinder End-of-Line Test Stand', 'Hydraulic Test Stand', 'Bosch Rexroth Germany', 'CylTest-350Bar', 'REX-PUN-2026-022', 'Bay 5 / Line HYD-2', 'class_a', 'running', 4120.8, 30, 'QR-JCB-PUN-HYD-002-UID', 'https://manuals.jcb-cmms.internal/docs/PUN-HYD-002/operating_manual_rev3.pdf', 'https://manuals.jcb-cmms.internal/diagrams/PUN-HYD-002/electrical_schematic_v2.pdf', 'https://manuals.jcb-cmms.internal/schematics/PUN-HYD-002/hydraulic_circuit_rev4.pdf', 'https://manuals.jcb-cmms.internal/sop/PUN-HYD-002/standard_operating_procedure.pdf', '350 Bar full pressure cycle proof test and internal seal bypass measurement.'),
  ('20000000-0000-0000-0000-000000000017', 'c0000000-0000-0000-0000-000000000013', 'PUN-TST-001', 'JCB Dynamometer Heavy Powertrain Road Testing Rig', 'Dynamometer', 'AVL List GmbH Austria', 'DynoPower 450kW', 'AVL-PUN-2026-023', 'Bay 5 / Line TST-1', 'class_a', 'running', 2890, 30, 'QR-JCB-PUN-TST-001-UID', 'https://manuals.jcb-cmms.internal/docs/PUN-TST-001/operating_manual_rev3.pdf', 'https://manuals.jcb-cmms.internal/diagrams/PUN-TST-001/electrical_schematic_v2.pdf', 'https://manuals.jcb-cmms.internal/schematics/PUN-TST-001/hydraulic_circuit_rev4.pdf', 'https://manuals.jcb-cmms.internal/sop/PUN-TST-001/standard_operating_procedure.pdf', 'Automated 4-wheel dyno testing full drawbar pull, transmission shifting, and hydrostatic drives.'),
  ('20000000-0000-0000-0000-000000000018', 'c0000000-0000-0000-0000-000000000014', 'PUN-CMM-001', 'Carl Zeiss ACCURA High-Precision Bridge Coordinate Measuring Machine', 'CMM Inspection', 'Carl Zeiss AG Germany', 'ACCURA 2000/3000', 'ZEI-PUN-2026-024', 'Quality Lab 1', 'class_a', 'running', 1980.2, 90, 'QR-JCB-PUN-CMM-001-UID', 'https://manuals.jcb-cmms.internal/docs/PUN-CMM-001/operating_manual_rev3.pdf', 'https://manuals.jcb-cmms.internal/diagrams/PUN-CMM-001/electrical_schematic_v2.pdf', 'https://manuals.jcb-cmms.internal/schematics/PUN-CMM-001/hydraulic_circuit_rev4.pdf', 'https://manuals.jcb-cmms.internal/sop/PUN-CMM-001/standard_operating_procedure.pdf', 'Climate-controlled 3D CMM measuring 1-micron tolerances on engine blocks and transmission housings.'),
  ('20000000-0000-0000-0000-000000000019', 'c0000000-0000-0000-0000-000000000015', 'PUN-CMP-001', 'Atlas Copco GA 160 VSD+ Oil-Injected Rotary Screw Air Compressor #1', 'Air Compressor', 'Atlas Copco Belgium', 'GA 160 VSD+', 'ATC-PUN-2026-025', 'Utility Block A', 'class_a', 'running', 14200.5, 30, 'QR-JCB-PUN-CMP-001-UID', 'https://manuals.jcb-cmms.internal/docs/PUN-CMP-001/operating_manual_rev3.pdf', 'https://manuals.jcb-cmms.internal/diagrams/PUN-CMP-001/electrical_schematic_v2.pdf', 'https://manuals.jcb-cmms.internal/schematics/PUN-CMP-001/hydraulic_circuit_rev4.pdf', 'https://manuals.jcb-cmms.internal/sop/PUN-CMP-001/standard_operating_procedure.pdf', 'Primary variable speed plant air compressor supplying 8.5 Bar clean dry air to all CNCs and robots.'),
  ('20000000-0000-0000-0000-00000000001a', 'c0000000-0000-0000-0000-000000000011', 'PUN-CMP-002', 'Atlas Copco GA 160 VSD+ Oil-Injected Rotary Screw Air Compressor #2', 'Air Compressor', 'Atlas Copco Belgium', 'GA 160 VSD+', 'ATC-PUN-2026-026', 'Utility Block A', 'class_a', 'running', 13950, 30, 'QR-JCB-PUN-CMP-002-UID', 'https://manuals.jcb-cmms.internal/docs/PUN-CMP-002/operating_manual_rev3.pdf', 'https://manuals.jcb-cmms.internal/diagrams/PUN-CMP-002/electrical_schematic_v2.pdf', 'https://manuals.jcb-cmms.internal/schematics/PUN-CMP-002/hydraulic_circuit_rev4.pdf', 'https://manuals.jcb-cmms.internal/sop/PUN-CMP-002/standard_operating_procedure.pdf', 'Redundant standby rotary screw compressor with automatic failover.'),
  ('20000000-0000-0000-0000-00000000001b', 'c0000000-0000-0000-0000-000000000012', 'PUN-CHL-001', 'Daikin EWAD-TZ Central Industrial Process Water Chiller 400TR', 'Process Chiller', 'Daikin Applied Europe', 'EWAD400TZ-XR', 'DAI-PUN-2026-027', 'Utility Block B', 'class_a', 'running', 11200, 60, 'QR-JCB-PUN-CHL-001-UID', 'https://manuals.jcb-cmms.internal/docs/PUN-CHL-001/operating_manual_rev3.pdf', 'https://manuals.jcb-cmms.internal/diagrams/PUN-CHL-001/electrical_schematic_v2.pdf', 'https://manuals.jcb-cmms.internal/schematics/PUN-CHL-001/hydraulic_circuit_rev4.pdf', 'https://manuals.jcb-cmms.internal/sop/PUN-CHL-001/standard_operating_procedure.pdf', 'Central cooling water plant supplying 18°C refrigerated water to spindle jackets and robotic weld torches.'),
  ('20000000-0000-0000-0000-00000000001c', 'c0000000-0000-0000-0000-000000000013', 'PUN-BLS-001', 'Pangborn Continuous Heavy Structural Steel Shot Blasting Chamber', 'Shot Blaster', 'Pangborn Group Europe', 'Rotoblast R-150', 'PAN-PUN-2026-028', 'Bay 3 / Line BLS-1', 'class_b', 'running', 6890.3, 30, 'QR-JCB-PUN-BLS-001-UID', 'https://manuals.jcb-cmms.internal/docs/PUN-BLS-001/operating_manual_rev3.pdf', 'https://manuals.jcb-cmms.internal/diagrams/PUN-BLS-001/electrical_schematic_v2.pdf', 'https://manuals.jcb-cmms.internal/schematics/PUN-BLS-001/hydraulic_circuit_rev4.pdf', 'https://manuals.jcb-cmms.internal/sop/PUN-BLS-001/standard_operating_procedure.pdf', '12-wheel continuous turbine shot blasting descaling heavy steel plate fabrications to SA 2.5.'),
  ('20000000-0000-0000-0000-00000000001d', 'c0000000-0000-0000-0000-000000000014', 'PUN-BND-001', 'Trumpf TruBend 5320 Heavy 320T CNC Hydraulic Press Brake', 'Press Brake', 'Trumpf GmbH Germany', 'TruBend 5320', 'TRU-PUN-2026-029', 'Bay 3 / Line BND-1', 'class_b', 'running', 4780, 30, 'QR-JCB-PUN-BND-001-UID', 'https://manuals.jcb-cmms.internal/docs/PUN-BND-001/operating_manual_rev3.pdf', 'https://manuals.jcb-cmms.internal/diagrams/PUN-BND-001/electrical_schematic_v2.pdf', 'https://manuals.jcb-cmms.internal/schematics/PUN-BND-001/hydraulic_circuit_rev4.pdf', 'https://manuals.jcb-cmms.internal/sop/PUN-BND-001/standard_operating_procedure.pdf', '320-ton 4-meter CNC press brake bending high-strength excavator boom side plates.'),
  ('20000000-0000-0000-0000-00000000001e', 'c0000000-0000-0000-0000-000000000015', 'PUN-ROB-005', 'Kawasaki Heavy 7-Axis Gantry Welding Robot System', 'Robotic Welder', 'Kawasaki Heavy Industries', 'BA006L Gantry', 'KAW-PUN-2026-030', 'Bay 2 / Cell ROB-5', 'class_a', 'running', 5340.2, 15, 'QR-JCB-PUN-ROB-005-UID', 'https://manuals.jcb-cmms.internal/docs/PUN-ROB-005/operating_manual_rev3.pdf', 'https://manuals.jcb-cmms.internal/diagrams/PUN-ROB-005/electrical_schematic_v2.pdf', 'https://manuals.jcb-cmms.internal/schematics/PUN-ROB-005/hydraulic_circuit_rev4.pdf', 'https://manuals.jcb-cmms.internal/sop/PUN-ROB-005/standard_operating_procedure.pdf', 'Overhead gantry mounted 7-axis robotic welder for complete 14-ton excavator undercarriage.')
ON CONFLICT (machine_code) DO UPDATE SET 
  name = EXCLUDED.name,
  operating_hours = EXCLUDED.operating_hours,
  status = EXCLUDED.status;

-- 5. 30 Heavy Industrial Spare Parts (All 13 Fields: SKUs, Bin Locations, Stocks, Costs)
INSERT INTO spare_parts (
  part_number, oem_part_number, name, description, category, subcategory, 
  warehouse_zone, bin_location, current_physical_stock, reserved_stock, quarantined_stock, 
  min_reorder_level, unit_cost
) VALUES
  ('PUN-PRT-001', 'REX-4WRKE-25-V1', 'Bosch Rexroth 4WRKE-25 Proportional Directional Valve', 'Genuine JCB OEM industrial spare part engineered for high reliability at JCB Pune Talegaon works.', 'Hydraulics', 'Proportional Valves', 'Store Bay A', 'BIN-A-01-01', 12, 2, 0, 4, 38500),
  ('PUN-PRT-002', 'SKF-7014-CE-P4A', 'SKF Super-Precision Angular Contact Ceramic Spindle Bearing 7014', 'Genuine JCB OEM industrial spare part engineered for high reliability at JCB Pune Talegaon works.', 'Bearings', 'Spindle Bearings', 'Store Bay B', 'BIN-B-02-05', 8, 1, 0, 2, 76500),
  ('PUN-PRT-003', 'FAN-A06B-6114-H205', 'Fanuc Alpha i-Series Servo Amplifier Drive Module', 'Genuine JCB OEM industrial spare part engineered for high reliability at JCB Pune Talegaon works.', 'Electrical', 'Servo Drives', 'Store Bay C', 'BIN-C-01-10', 5, 0, 0, 2, 142000),
  ('PUN-PRT-004', 'PAR-P14P-100-R01', 'Parker Denison Gold Cup P14P Axial Piston Variable Pump', 'Genuine JCB OEM industrial spare part engineered for high reliability at JCB Pune Talegaon works.', 'Hydraulics', 'Hydraulic Pumps', 'Store Bay A', 'BIN-A-03-02', 4, 1, 0, 1, 185000),
  ('PUN-PRT-005', 'HAL-PU-120MM-HP', 'Hallite Polyurethane 120mm Heavy Ram Piston Seal Kit', 'Genuine JCB OEM industrial spare part engineered for high reliability at JCB Pune Talegaon works.', 'Seals', 'Cylinder Seal Kits', 'Store Bay D', 'BIN-D-01-08', 24, 4, 0, 8, 8900),
  ('PUN-PRT-006', 'FES-ISO-24V-5599', 'Festo ISO 5599-1 Size 2 Pneumatic 5/2 Solenoid Valve 24VDC', 'Genuine JCB OEM industrial spare part engineered for high reliability at JCB Pune Talegaon works.', 'Pneumatics', 'Solenoid Valves', 'Store Bay E', 'BIN-E-02-04', 35, 2, 0, 10, 6200),
  ('PUN-PRT-007', 'SIE-6ES7-515F-2AM01', 'Siemens SIMATIC S7-1500 Fail-Safe CPU 1515F-2 PN Module', 'Genuine JCB OEM industrial spare part engineered for high reliability at JCB Pune Talegaon works.', 'Electrical', 'PLC Automation', 'Store Bay C', 'BIN-C-02-01', 6, 0, 0, 2, 198000),
  ('PUN-PRT-008', 'THK-BS-4015-G0', 'THK Ground Precision High-Lead Ball Screw 40mm x 1500mm', 'Genuine JCB OEM industrial spare part engineered for high reliability at JCB Pune Talegaon works.', 'Mechanical', 'Ball Screws', 'Store Bay B', 'BIN-B-04-12', 6, 1, 0, 2, 68400),
  ('PUN-PRT-009', 'DON-P164378-SYN', 'Donaldson 10-Micron High-Efficiency Synthetic Hydraulic Return Filter', 'Genuine JCB OEM industrial spare part engineered for high reliability at JCB Pune Talegaon works.', 'Filtration', 'Oil Filters', 'Store Bay A', 'BIN-A-05-18', 48, 6, 0, 15, 4200),
  ('PUN-PRT-010', 'FRO-ROB-440W-MIG', 'Fronius Robacta Drive Water-Cooled Automated Robotic MIG Torch', 'Genuine JCB OEM industrial spare part engineered for high reliability at JCB Pune Talegaon works.', 'Welding', 'MIG Torches', 'Store Bay F', 'BIN-F-01-03', 8, 2, 0, 3, 58500),
  ('PUN-PRT-011', 'SCH-VFD-ATV930-45K', 'Schneider Electric Altivar Process ATV930 45kW Variable Speed Drive', 'Genuine JCB OEM industrial spare part engineered for high reliability at JCB Pune Talegaon works.', 'Electrical', 'VFD Drives', 'Store Bay C', 'BIN-C-03-08', 4, 0, 0, 1, 112000),
  ('PUN-PRT-012', 'TRU-NOZ-20-EVS', 'Trumpf Original 2.0mm High-Performance Laser Cutting Nozzle', 'Genuine JCB OEM industrial spare part engineered for high reliability at JCB Pune Talegaon works.', 'Laser Consumables', 'Cutting Nozzles', 'Store Bay E', 'BIN-E-01-14', 85, 10, 0, 25, 2400),
  ('PUN-PRT-013', 'HYD-0330D010BN4HC', 'HYDAC Betamicron 0330 D 010 BN4HC High Pressure Pressure Line Filter', 'Genuine JCB OEM industrial spare part engineered for high reliability at JCB Pune Talegaon works.', 'Filtration', 'Oil Filters', 'Store Bay A', 'BIN-A-05-22', 32, 4, 0, 10, 5600),
  ('PUN-PRT-014', 'IFM-O5D100-LASER', 'IFM Electronic Laser Distance & Time-of-Flight Sensor O5D100', 'Genuine JCB OEM industrial spare part engineered for high reliability at JCB Pune Talegaon works.', 'Sensors', 'Laser Sensors', 'Store Bay C', 'BIN-C-04-06', 18, 1, 0, 5, 14800),
  ('PUN-PRT-015', 'GEM-OPTI-GUN-GA03', 'Gema OptiGun GA03 Automatic Powder Coating Spray Gun Head', 'Genuine JCB OEM industrial spare part engineered for high reliability at JCB Pune Talegaon works.', 'Coating Consumables', 'Spray Guns', 'Store Bay F', 'BIN-F-02-11', 10, 2, 0, 3, 32000),
  ('PUN-PRT-016', 'NSK-25TAC62-BS', 'NSK High-Load Ball Screw Support Bearing 25TAC62BSU', 'Genuine JCB OEM industrial spare part engineered for high reliability at JCB Pune Talegaon works.', 'Bearings', 'Ball Screw Bearings', 'Store Bay B', 'BIN-B-02-09', 16, 2, 0, 4, 18900),
  ('PUN-PRT-017', 'DAN-PVG32-PROP', 'Danfoss PVG 32 Proportional Load-Sensing Control Valve Group', 'Genuine JCB OEM industrial spare part engineered for high reliability at JCB Pune Talegaon works.', 'Hydraulics', 'Proportional Valves', 'Store Bay A', 'BIN-A-02-14', 5, 1, 0, 2, 94000),
  ('PUN-PRT-018', 'SMC-MGPM50-100', 'SMC Heavy Compact Guide Cylinder MGPM50-100 with Slide Bearings', 'Genuine JCB OEM industrial spare part engineered for high reliability at JCB Pune Talegaon works.', 'Pneumatics', 'Pneumatic Actuators', 'Store Bay E', 'BIN-E-03-05', 20, 2, 0, 5, 11400),
  ('PUN-PRT-019', 'PIL-PNOZ-S4-REL', 'Pilz PNOZ s4 Compact Emergency Stop & Safety Gate Relay 24VDC', 'Genuine JCB OEM industrial spare part engineered for high reliability at JCB Pune Talegaon works.', 'Safety Controls', 'Safety Relays', 'Store Bay C', 'BIN-C-01-04', 22, 0, 0, 6, 9800),
  ('PUN-PRT-020', 'HAR-400-STEEL-PIN', 'JCB Heavy Hardened 80mm Pivot Pin for Excavator Boom Mounting', 'Genuine JCB OEM industrial spare part engineered for high reliability at JCB Pune Talegaon works.', 'Structural Hardware', 'Pivot Pins', 'Store Bay D', 'BIN-D-03-01', 40, 5, 0, 12, 15400),
  ('PUN-PRT-021', 'ABB-MOTOR-15KW-IE4', 'ABB 15kW IE4 Super Premium Efficiency 4-Pole Induction Motor', 'Genuine JCB OEM industrial spare part engineered for high reliability at JCB Pune Talegaon works.', 'Motors', 'Electric Motors', 'Store Bay B', 'BIN-B-05-02', 4, 0, 0, 1, 68000),
  ('PUN-PRT-022', 'FLU-789-CALIB', 'Fluke 789 ProcessMeter Precision Loop Calibrator & Multimeter', 'Genuine JCB OEM industrial spare part engineered for high reliability at JCB Pune Talegaon works.', 'Tooling & Calibration', 'Calibration Instruments', 'Tool Crib 1', 'TC-01-A', 3, 0, 0, 1, 89000),
  ('PUN-PRT-023', 'KUK-ROB-CABLE-15M', 'KUKA Robot Arm Dresspack Integrated Power & Signal Cable 15m', 'Genuine JCB OEM industrial spare part engineered for high reliability at JCB Pune Talegaon works.', 'Robotics', 'Dresspacks', 'Store Bay F', 'BIN-F-03-08', 6, 1, 0, 2, 42000),
  ('PUN-PRT-024', 'WAG-EP-PRIMER-200L', 'JCB High-Build Epoxy Anti-Corrosive Primer Resin Drum (200L)', 'Genuine JCB OEM industrial spare part engineered for high reliability at JCB Pune Talegaon works.', 'Paints & Chemicals', 'Industrial Paints', 'Chemical Store', 'CHM-01-DRUM', 15, 3, 0, 5, 52000),
  ('PUN-PRT-025', 'ATC-SOCKET-17MM', 'Atlas Copco Heavy Impact Torx Socket E17 1/2 Inch Drive', 'Genuine JCB OEM industrial spare part engineered for high reliability at JCB Pune Talegaon works.', 'Tooling & Bits', 'Nutrunner Sockets', 'Tool Crib 2', 'TC-02-B', 50, 5, 0, 15, 1850),
  ('PUN-PRT-026', 'BAL-BTL-TRANS-400', 'Balluff Micropulse Magnetostrictive Linear Position Transducer 400mm', 'Genuine JCB OEM industrial spare part engineered for high reliability at JCB Pune Talegaon works.', 'Sensors', 'Linear Transducers', 'Store Bay C', 'BIN-C-05-02', 8, 0, 0, 2, 36000),
  ('PUN-PRT-027', 'MAK-PULL-STUD-BT50', 'Makino Precision BT50 Spindle Retention Pull Stud with Through Coolant', 'Genuine JCB OEM industrial spare part engineered for high reliability at JCB Pune Talegaon works.', 'Tooling & Toolholders', 'Pull Studs', 'Store Bay B', 'BIN-B-01-18', 65, 10, 0, 20, 3200),
  ('PUN-PRT-028', 'EAT-VICKERS-25V21', 'Eaton Vickers 25V Fixed Displacement Industrial Vane Pump', 'Genuine JCB OEM industrial spare part engineered for high reliability at JCB Pune Talegaon works.', 'Hydraulics', 'Hydraulic Pumps', 'Store Bay A', 'BIN-A-04-10', 6, 1, 0, 2, 48000),
  ('PUN-PRT-029', 'HON-LIMIT-LSZ16', 'Honeywell Heavy-Duty Enclosed Industrial Limit Switch LSZ16A', 'Genuine JCB OEM industrial spare part engineered for high reliability at JCB Pune Talegaon works.', 'Electrical', 'Limit Switches', 'Store Bay C', 'BIN-C-04-12', 28, 2, 0, 8, 4500),
  ('PUN-PRT-030', 'SKF-LUBRILOG-LGMT', 'SKF Industrial Extreme Pressure Multi-Purpose Bearing Grease Drum (50kg)', 'Genuine JCB OEM industrial spare part engineered for high reliability at JCB Pune Talegaon works.', 'Lubricants', 'Greases', 'Chemical Store', 'CHM-02-DRUM', 18, 2, 0, 5, 28400)
ON CONFLICT (part_number) DO UPDATE SET 
  name = EXCLUDED.name,
  current_physical_stock = EXCLUDED.current_physical_stock,
  unit_cost = EXCLUDED.unit_cost;

-- 6. 30 Industrial Vendors Across Maharashtra MIDC Belts (Chakan, Bhosari, Pimpri, Talegaon)
INSERT INTO vendors (id, vendor_code, name, contact_person, email, phone, address, gstin, status, plant_id) VALUES
  ('50000000-0000-0000-0000-000000000001', 'VND-MH-001', 'Bharat Forge Limited Heavy Machining Division', 'Pradeep Deshpande', 'p.deshpande@bharatforge.com', '+91-20-67042000', 'Mundhwa, Pune, Maharashtra 411036', '27AAACB0123A1Z1', 'active', 'b0000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-000000000002', 'VND-MH-002', 'Kirloskar Oil Engines Limited Industrial Spares', 'Gajanan Kulkarni', 'g.kulkarni@kirloskar.com', '+91-20-25810341', 'Khadki, Pune, Maharashtra 411003', '27AAACK4567B1Z2', 'active', 'b0000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-000000000003', 'VND-MH-003', 'Tata AutoComp Systems Limited Composites Division', 'Makarand Joshi', 'm.joshi@tatacomponents.com', '+91-20-66085000', 'Tathawade, Pune, Maharashtra 411033', '27AAACT8901C1Z3', 'active', 'b0000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-000000000004', 'VND-MH-004', 'Renuka Hydraulics & Pneumatics Pvt Ltd', 'Vitthalrao Shinde', 'sales@renukahydraulics.com', '+91-20-27123456', 'MIDC Bhosari, Pune, Maharashtra 411026', '27AABCR1234D1Z4', 'active', 'b0000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-000000000005', 'VND-MH-005', 'Sahyadri Precision Tools & Fixtures', 'Bapurao Patil', 'b.patil@sahyadritools.co.in', '+91-2135-667788', 'Phase 2, Chakan MIDC, Pune, Maharashtra 410501', '27AABCS5678E1Z5', 'active', 'b0000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-000000000006', 'VND-MH-006', 'Talegaon Industrial Fasteners & Hardware Hub', 'Sanjay Jagtap', 'sanjay@talegaonfasteners.com', '+91-2114-223344', 'Talegaon Dabhade, Pune, Maharashtra 410506', '27AABCT9012F1Z6', 'active', 'b0000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-000000000007', 'VND-MH-007', 'Shree Ganesh Engineering CNC Jobworks', 'Dnyaneshwar More', 'd.more@ganeshengineering.in', '+91-20-27456789', 'Sector 10, PCMC Bhosari, Maharashtra 411026', '27AABCG3456G1Z7', 'active', 'b0000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-000000000008', 'VND-MH-008', 'MahaSeals Industrial O-Rings & Gaskets Ltd', 'Ravindra Gokhale', 'r.gokhale@mahaseals.com', '+91-20-26871234', 'Hadapsar Industrial Estate, Pune, Maharashtra 411013', '27AABCM7890H1Z8', 'active', 'b0000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-000000000009', 'VND-MH-009', 'Maratha Automation & Robotics Field Services', 'Tanaji Bhosale', 'tanaji@marathaautomation.com', '+91-2135-256789', 'Chakan Industrial Area Phase 1, Maharashtra 410501', '27AABCM2345I1Z9', 'active', 'b0000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-00000000000a', 'VND-MH-010', 'Pune Laser Cut & Metal Forming Solutions', 'Anandrao Mohite', 'anand@punelasercut.com', '+91-20-66334455', 'Markal MIDC, Alandi-Chakan Road, Maharashtra 412105', '27AABCP6789J1Z0', 'active', 'b0000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-00000000000b', 'VND-MH-011', 'Kalyani Steels Special Alloys Division', 'Suhas Kulkarni', 's.kulkarni@kalyanisteels.com', '+91-20-66215000', 'Mundhwa, Pune, Maharashtra 411036', '27AAACK1122K1Z1', 'active', 'b0000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-00000000000c', 'VND-MH-012', 'Garware Hi-Tech Industrial Films & Coatings', 'Hemant Garware', 'sales@garwarehitech.com', '+91-240-2556789', 'Waluj MIDC, Chhatrapati Sambhajinagar, Maharashtra 431136', '27AAACG3344L1Z2', 'active', 'b0000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-00000000000d', 'VND-MH-013', 'Pimpri Electrical & VFD Controls Corporation', 'Kailas Sonawane', 'kailas@pimprielectrical.com', '+91-20-27421122', 'MIDC Pimpri, Pune, Maharashtra 411018', '27AABCP5566M1Z3', 'active', 'b0000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-00000000000e', 'VND-MH-014', 'Chakan Hydraulics Precision Hoses & Flanges', 'Milind Suryavanshi', 'milind@chakanhydraulics.in', '+91-2135-661122', 'Phase 3 Chakan MIDC, Kuruli, Maharashtra 410501', '27AABC2233N1Z4', 'active', 'b0000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-00000000000f', 'VND-MH-015', 'Deccan Bearings & Power Transmission Co', 'Rameshwar Thorat', 'deccan.bearings@gmail.com', '+91-20-24451234', 'Budhwar Peth / Timber Market, Pune, Maharashtra 411002', '27AABCD4455O1Z5', 'active', 'b0000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-000000000010', 'VND-MH-016', 'Kolhapur Heavy Foundry & Steel Castings', 'Balasaheb Shinde', 'b.shinde@kolhapurfoundry.com', '+91-231-2678901', 'Shiroli MIDC, Kolhapur, Maharashtra 416122', '27AABCK6677P1Z6', 'active', 'b0000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-000000000011', 'VND-MH-017', 'Nashik Industrial Sensors & Instrumentations', 'Avinash Wagh', 'avinash@nashiksensors.com', '+91-253-2381234', 'Ambad MIDC, Nashik, Maharashtra 422010', '27AABCN8899Q1Z7', 'active', 'b0000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-000000000012', 'VND-MH-018', 'Thane Safety Relays & Light Curtain Systems', 'Satish Kamat', 'satish@thanesafety.co.in', '+91-22-25821234', 'Wagle Industrial Estate, Thane, Maharashtra 400604', '27AABCT0011R1Z8', 'active', 'b0000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-000000000013', 'VND-MH-019', 'Aurangabad Industrial Gas & Weld Rods Hub', 'Eknath Jadhav', 'eknath@aurangabadgas.com', '+91-240-2334455', 'Chikalthana MIDC, Chhatrapati Sambhajinagar, Maharashtra 431006', '27AABCA2233S1Z9', 'active', 'b0000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-000000000014', 'VND-MH-020', 'PCMC Pneumatics & Vacuum Automation Works', 'Pandurang Ghadge', 'pandurang@pcmcpneumatics.com', '+91-20-27114455', 'Kasarwadi, PCMC, Pune, Maharashtra 411034', '27AABCP4455T1Z0', 'active', 'b0000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-000000000015', 'VND-MH-021', 'Satara Special Alloy Gears & Transmissions', 'Jaywantrao Mane', 'j.mane@sataragears.in', '+91-2162-245678', 'Old MIDC, Satara, Maharashtra 415004', '27AABCS6677U1Z1', 'active', 'b0000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-000000000016', 'VND-MH-022', 'Sangli Precision Ball Screws & Linear Guides', 'Sampatrao Kadam', 'sampat@sangliballscrews.com', '+91-233-2641234', 'Kupwad MIDC, Sangli, Maharashtra 416436', '27AABCS8899V1Z2', 'active', 'b0000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-000000000017', 'VND-MH-023', 'Solapur Heavy Die Steel & Forging Blanks', 'Subhash Birajdar', 'subhash@solapurforging.com', '+91-217-2351234', 'Chincholi MIDC, Solapur, Maharashtra 413255', '27AABCS0011W1Z3', 'active', 'b0000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-000000000018', 'VND-MH-024', 'Nagpur Industrial Coolants & Spindle Lubricants', 'Shrikant Fadnavis', 'shrikant@nagpurcoolants.com', '+91-712-2561234', 'Butibori Industrial Area, Nagpur, Maharashtra 441108', '27AABCN2233X1Z4', 'active', 'b0000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-000000000019', 'VND-MH-025', 'Baramati Agro & Heavy Engineering Hydraulics', 'Abhijit Pawar', 'abhijit@baramatihydraulics.in', '+91-2112-243567', 'Baramati MIDC, Pune District, Maharashtra 413133', '27AABCB4455Y1Z5', 'active', 'b0000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-00000000001a', 'VND-MH-026', 'Ranjangaon Auto Sheet Metal Press Parts Ltd', 'Digambar Salunke', 'digambar@ranjangaonpress.com', '+91-2138-662233', 'Ranjangaon MIDC, Shirur, Pune, Maharashtra 412209', '27AABCR6677Z1Z6', 'active', 'b0000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-00000000001b', 'VND-MH-027', 'Navi Mumbai Heavy Cable & Harness Assemblies', 'Mahendra Thakur', 'mahendra@navimumbaicables.com', '+91-22-27781234', 'TTC Industrial Area, Pawane, Navi Mumbai, Maharashtra 400705', '27AABCN8899A1Z7', 'active', 'b0000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-00000000001c', 'VND-MH-028', 'Jalgaon Industrial Powder Paints & Resins Co', 'Chandrakant Patil', 'c.patil@jalgaonpaints.com', '+91-257-2211234', 'Jalgaon MIDC, Jalgaon, Maharashtra 425003', '27AABCJ0011B1Z8', 'active', 'b0000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-00000000001d', 'VND-MH-029', 'Ahmednagar Heavy Axle & Pin Machining Works', 'Gorakhnath Tanpure', 'gorakh@ahmednagarmachining.in', '+91-241-2778901', 'MIDC Nagapur, Ahmednagar, Maharashtra 414111', '27AABCA2233C1Z9', 'active', 'b0000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-00000000001e', 'VND-MH-030', 'Wai Mechanical Springs & Heavy Suspension Links', 'Shridhar Pisal', 'shridhar@waisprings.com', '+91-2167-222333', 'Wai Industrial Estate, Satara, Maharashtra 412803', '27AABCW4455D1Z0', 'active', 'b0000000-0000-0000-0000-000000000002')
ON CONFLICT (vendor_code) DO NOTHING;

-- 7. 30 Breakdown Complaints (Using Valid complaint_status Enum: new, pending_review, work_order_created)
INSERT INTO maintenance_requests (
  id, complaint_number, machine_id, reported_by_id, shift, issue_category, 
  priority, status, breakdown_occurred_at, reported_at, hour_meter_reading, 
  temperature, pressure, problem_title, description, manager_remarks
) VALUES
  ('30000000-0000-0000-0000-000000000001', 'CMP-2026-00101', '20000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000015', 'Shift A', 'Hydraulic', 'critical', 'work_order_created', NOW() - INTERVAL '1 days 4 hours', NOW() - INTERVAL '1 days 3 hours 45 minutes', 4842.00, 39.50, 53.00, 'Main hydraulic relief valve chattering under full excavation pressure', 'During operational shift inspection by Tushar H. Shingade (Senior HMC Machine Operator), anomaly detected on asset PUN-HMC-001 (Mazak Horizontal Machining Center HCN-6800 NEO #1): Main hydraulic relief valve chattering under full excavation pressure. Machine stopped immediately as per JCB safety guidelines.', 'Acknowledged by Plant Maintenance Supervisor. Priority set to critical. Technician assignment dispatched.'),
  ('30000000-0000-0000-0000-000000000002', 'CMP-2026-00102', '20000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000016', 'Shift A', 'Mechanical', 'high', 'work_order_created', NOW() - INTERVAL '0 days 4 hours', NOW() - INTERVAL '0 days 3 hours 45 minutes', 5120.25, 40.50, 54.00, 'Mazak HCN-6800 spindle bearing vibration alarm exceeding 4.8 mm/s threshold', 'During operational shift inspection by Onkar S. Navale (Automated Cell Operator), anomaly detected on asset PUN-HMC-002 (Mazak Horizontal Machining Center HCN-6800 NEO #2): Mazak HCN-6800 spindle bearing vibration alarm exceeding 4.8 mm/s threshold. Machine stopped immediately as per JCB safety guidelines.', 'Acknowledged by Plant Maintenance Supervisor. Priority set to high. Technician assignment dispatched.'),
  ('30000000-0000-0000-0000-000000000003', 'CMP-2026-00103', '20000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000017', 'Shift A', 'Electrical', 'medium', 'work_order_created', NOW() - INTERVAL '13 days 4 hours', NOW() - INTERVAL '13 days 3 hours 45 minutes', 3089.50, 41.50, 55.00, 'Fanuc robot joint 3 servo collision emergency stop during boom welding', 'During operational shift inspection by Vijay K. Lokhande (Schuler 1000T Press Operator), anomaly detected on asset PUN-VMC-001 (Makino Vertical Machining Center V99 Heavy Milling): Fanuc robot joint 3 servo collision emergency stop during boom welding. Machine stopped immediately as per JCB safety guidelines.', 'Acknowledged by Plant Maintenance Supervisor. Priority set to medium. Technician assignment dispatched.'),
  ('30000000-0000-0000-0000-000000000004', 'CMP-2026-00104', '20000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000018', 'Shift A', 'Pneumatics', 'low', 'work_order_created', NOW() - INTERVAL '12 days 4 hours', NOW() - INTERVAL '12 days 3 hours 45 minutes', 6308.75, 42.50, 56.00, 'Schuler 1000T hydraulic press ram seal oil leak pooling on floor', 'During operational shift inspection by Pradeep B. Wagh (Trumpf Laser Cutting Operator), anomaly detected on asset PUN-VMC-002 (Doosan DNM 6700 High Productivity VMC): Schuler 1000T hydraulic press ram seal oil leak pooling on floor. Machine stopped immediately as per JCB safety guidelines.', 'Acknowledged by Plant Maintenance Supervisor. Priority set to low. Technician assignment dispatched.'),
  ('30000000-0000-0000-0000-000000000005', 'CMP-2026-00105', '20000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000019', 'Shift A', 'Automation', 'critical', 'work_order_created', NOW() - INTERVAL '11 days 4 hours', NOW() - INTERVAL '11 days 3 hours 45 minutes', 2796.60, 43.50, 57.00, 'Trumpf laser cutting optical head focus lens thermal distortion alarm', 'During operational shift inspection by Suraj M. Khilare (Excavator Frame Operator), anomaly detected on asset PUN-CNC-001 (Okuma Multus U4000 Intelligent CNC Turning Center): Trumpf laser cutting optical head focus lens thermal distortion alarm. Machine stopped immediately as per JCB safety guidelines.', 'Acknowledged by Plant Maintenance Supervisor. Priority set to critical. Technician assignment dispatched.'),
  ('30000000-0000-0000-0000-000000000006', 'CMP-2026-00106', '20000000-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-00000000001a', 'Shift A', 'Cooling System', 'high', 'work_order_created', NOW() - INTERVAL '10 days 4 hours', NOW() - INTERVAL '10 days 3 hours 45 minutes', 7765.30, 44.50, 58.00, 'Siemens S7-1500 PLC Profinet bus communication drop on Bay 1 line', 'During operational shift inspection by Kiran R. Ghadge (Electrostatic Line Operator), anomaly detected on asset PUN-ROB-001 (Fanuc ARC Mate 120iD 6-Axis Boom Welding Robot #1): Siemens S7-1500 PLC Profinet bus communication drop on Bay 1 line. Machine stopped immediately as per JCB safety guidelines.', 'Acknowledged by Plant Maintenance Supervisor. Priority set to high. Technician assignment dispatched.'),
  ('30000000-0000-0000-0000-000000000007', 'CMP-2026-00107', '20000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-00000000001b', 'Shift A', 'Hydraulic', 'medium', 'work_order_created', NOW() - INTERVAL '9 days 4 hours', NOW() - INTERVAL '9 days 3 hours 45 minutes', 7343.50, 45.50, 59.00, 'Pneumatic die clamp cylinder pressure decay during forming stroke', 'During operational shift inspection by Deepak N. Choudhary (Gearbox Line Operator), anomaly detected on asset PUN-ROB-002 (Fanuc ARC Mate 120iD 6-Axis Dipper Welding Robot #2): Pneumatic die clamp cylinder pressure decay during forming stroke. Machine stopped immediately as per JCB safety guidelines.', 'Acknowledged by Plant Maintenance Supervisor. Priority set to medium. Technician assignment dispatched.'),
  ('30000000-0000-0000-0000-000000000008', 'CMP-2026-00108', '20000000-0000-0000-0000-000000000008', 'f0000000-0000-0000-0000-00000000001c', 'Shift A', 'Mechanical', 'low', 'work_order_created', NOW() - INTERVAL '8 days 4 hours', NOW() - INTERVAL '8 days 3 hours 45 minutes', 4122.80, 46.50, 60.00, 'Daikin chiller compressor refrigerant trip causing spindle temperature 42°C', 'During operational shift inspection by Chetan P. Kore (Boom & Dipper Fitter Operator), anomaly detected on asset PUN-ROB-003 (ABB IRB 6700 Heavy Spot & Seam Welding Robot): Daikin chiller compressor refrigerant trip causing spindle temperature 42°C. Machine stopped immediately as per JCB safety guidelines.', 'Acknowledged by Plant Maintenance Supervisor. Priority set to low. Technician assignment dispatched.'),
  ('30000000-0000-0000-0000-000000000009', 'CMP-2026-00109', '20000000-0000-0000-0000-000000000009', 'f0000000-0000-0000-0000-00000000001d', 'Shift A', 'Electrical', 'critical', 'work_order_created', NOW() - INTERVAL '7 days 4 hours', NOW() - INTERVAL '7 days 3 hours 45 minutes', 5610.90, 47.50, 61.00, 'Gema electrostatic powder spray gun nozzle clogging and uneven thickness', 'During operational shift inspection by Nilesh A. Dhale (ROPS/FOPS Cabin Line Operator), anomaly detected on asset PUN-ROB-004 (KUKA KR 300 R2500 Heavy Frame Welding Cell): Gema electrostatic powder spray gun nozzle clogging and uneven thickness. Machine stopped immediately as per JCB safety guidelines.', 'Acknowledged by Plant Maintenance Supervisor. Priority set to critical. Technician assignment dispatched.'),
  ('30000000-0000-0000-0000-00000000000a', 'CMP-2026-00110', '20000000-0000-0000-0000-00000000000a', 'f0000000-0000-0000-0000-00000000001e', 'Shift A', 'Pneumatics', 'high', 'work_order_created', NOW() - INTERVAL '6 days 4 hours', NOW() - INTERVAL '6 days 3 hours 45 minutes', 11399.00, 48.50, 62.00, 'Automatic tool changer (ATC) arm stuck mid-rotation holding 50-taper milling cutter', 'During operational shift inspection by Harsh V. Zagade (Machine Test Track Operator), anomaly detected on asset PUN-PRS-001 (Schuler 1000T Hydraulic Deep-Draw Forming Press): Automatic tool changer (ATC) arm stuck mid-rotation holding 50-taper milling cutter. Machine stopped immediately as per JCB safety guidelines.', 'Acknowledged by Plant Maintenance Supervisor. Priority set to high. Technician assignment dispatched.'),
  ('30000000-0000-0000-0000-00000000000b', 'CMP-2026-00111', '20000000-0000-0000-0000-00000000000b', 'f0000000-0000-0000-0000-000000000015', 'Shift A', 'Automation', 'medium', 'work_order_created', NOW() - INTERVAL '5 days 4 hours', NOW() - INTERVAL '5 days 3 hours 45 minutes', 9798.00, 49.50, 63.00, 'Hydraulic return filter differential pressure bypass indicator red flag', 'During operational shift inspection by Tushar H. Shingade (Senior HMC Machine Operator), anomaly detected on asset PUN-PRS-002 (Komatsu 600T Mechanical Stamping Press): Hydraulic return filter differential pressure bypass indicator red flag. Machine stopped immediately as per JCB safety guidelines.', 'Acknowledged by Plant Maintenance Supervisor. Priority set to medium. Technician assignment dispatched.'),
  ('30000000-0000-0000-0000-00000000000c', 'CMP-2026-00112', '20000000-0000-0000-0000-00000000000c', 'f0000000-0000-0000-0000-000000000016', 'Shift A', 'Cooling System', 'low', 'work_order_created', NOW() - INTERVAL '4 days 4 hours', NOW() - INTERVAL '4 days 3 hours 45 minutes', 4276.20, 50.50, 64.00, 'Rexroth proportional directional valve spool jammed due to fine silt', 'During operational shift inspection by Onkar S. Navale (Automated Cell Operator), anomaly detected on asset PUN-PRS-003 (Aida 400T Progressive Die Stamping Press): Rexroth proportional directional valve spool jammed due to fine silt. Machine stopped immediately as per JCB safety guidelines.', 'Acknowledged by Plant Maintenance Supervisor. Priority set to low. Technician assignment dispatched.'),
  ('30000000-0000-0000-0000-00000000000d', 'CMP-2026-00113', '20000000-0000-0000-0000-00000000000d', 'f0000000-0000-0000-0000-000000000017', 'Shift A', 'Hydraulic', 'critical', 'work_order_created', NOW() - INTERVAL '3 days 4 hours', NOW() - INTERVAL '3 days 3 hours 45 minutes', 3795.10, 51.50, 65.00, 'Kawasaki 7-axis gantry welding torch water-cooling loop flow sensor failure', 'During operational shift inspection by Vijay K. Lokhande (Schuler 1000T Press Operator), anomaly detected on asset PUN-LAS-001 (Trumpf TruLaser 5030 Fiber 10kW CNC Laser Cutter): Kawasaki 7-axis gantry welding torch water-cooling loop flow sensor failure. Machine stopped immediately as per JCB safety guidelines.', 'Acknowledged by Plant Maintenance Supervisor. Priority set to critical. Technician assignment dispatched.'),
  ('30000000-0000-0000-0000-00000000000e', 'CMP-2026-00114', '20000000-0000-0000-0000-00000000000e', 'f0000000-0000-0000-0000-000000000018', 'Shift A', 'Mechanical', 'high', 'work_order_created', NOW() - INTERVAL '2 days 4 hours', NOW() - INTERVAL '2 days 3 hours 45 minutes', 4133.00, 52.50, 66.00, 'Air compressor GA 160 variable speed drive inverter overcurrent trip', 'During operational shift inspection by Pradeep B. Wagh (Trumpf Laser Cutting Operator), anomaly detected on asset PUN-LAS-002 (Bystronic ByStar Fiber 12kW Heavy Sheet Laser): Air compressor GA 160 variable speed drive inverter overcurrent trip. Machine stopped immediately as per JCB safety guidelines.', 'Acknowledged by Plant Maintenance Supervisor. Priority set to high. Technician assignment dispatched.'),
  ('30000000-0000-0000-0000-00000000000f', 'CMP-2026-00115', '20000000-0000-0000-0000-00000000000f', 'f0000000-0000-0000-0000-000000000019', 'Shift A', 'Electrical', 'medium', 'work_order_created', NOW() - INTERVAL '1 days 4 hours', NOW() - INTERVAL '1 days 3 hours 45 minutes', 8221.65, 53.50, 67.00, 'Atlas Copco DC nutrunner torque angle sensor out of calibration ±15Nm', 'During operational shift inspection by Suraj M. Khilare (Excavator Frame Operator), anomaly detected on asset PUN-PLM-001 (Messer MultiTherm Heavy CNC Plasma & Oxy-Fuel Cutting Gantry): Atlas Copco DC nutrunner torque angle sensor out of calibration ±15Nm. Machine stopped immediately as per JCB safety guidelines.', 'Acknowledged by Plant Maintenance Supervisor. Priority set to medium. Technician assignment dispatched.'),
  ('30000000-0000-0000-0000-000000000010', 'CMP-2026-00116', '20000000-0000-0000-0000-000000000010', 'f0000000-0000-0000-0000-00000000001a', 'Shift A', 'Pneumatics', 'low', 'work_order_created', NOW() - INTERVAL '0 days 4 hours', NOW() - INTERVAL '0 days 3 hours 45 minutes', 6120.90, 54.50, 68.00, 'Bystronic fiber laser auto-nozzle cleaning station air cylinder stuck', 'During operational shift inspection by Kiran R. Ghadge (Electrostatic Line Operator), anomaly detected on asset PUN-PNT-001 (Gema OptiCenter Automated Powder Coating System): Bystronic fiber laser auto-nozzle cleaning station air cylinder stuck. Machine stopped immediately as per JCB safety guidelines.', 'Acknowledged by Plant Maintenance Supervisor. Priority set to low. Technician assignment dispatched.'),
  ('30000000-0000-0000-0000-000000000011', 'CMP-2026-00117', '20000000-0000-0000-0000-000000000011', 'f0000000-0000-0000-0000-00000000001b', 'Shift A', 'Automation', 'critical', 'work_order_created', NOW() - INTERVAL '13 days 4 hours', NOW() - INTERVAL '13 days 3 hours 45 minutes', 9029.50, 55.50, 69.00, 'Powder coating dry-off oven exhaust blower bearing noise and vibration', 'During operational shift inspection by Deepak N. Choudhary (Gearbox Line Operator), anomaly detected on asset PUN-PNT-002 (Eisenmann 12-Stage Zinc-Phosphating Pretreatment Dip Tunnel): Powder coating dry-off oven exhaust blower bearing noise and vibration. Machine stopped immediately as per JCB safety guidelines.', 'Acknowledged by Plant Maintenance Supervisor. Priority set to critical. Technician assignment dispatched.'),
  ('30000000-0000-0000-0000-000000000012', 'CMP-2026-00118', '20000000-0000-0000-0000-000000000012', 'f0000000-0000-0000-0000-00000000001c', 'Shift A', 'Cooling System', 'high', 'work_order_created', NOW() - INTERVAL '12 days 4 hours', NOW() - INTERVAL '12 days 3 hours 45 minutes', 8648.30, 56.50, 70.00, 'Mazak X-axis linear glass scale optical encoder error E-204', 'During operational shift inspection by Chetan P. Kore (Boom & Dipper Fitter Operator), anomaly detected on asset PUN-PNT-003 (Dürr EcoDry Oven High-Efficiency Convection Curing Oven): Mazak X-axis linear glass scale optical encoder error E-204. Machine stopped immediately as per JCB safety guidelines.', 'Acknowledged by Plant Maintenance Supervisor. Priority set to high. Technician assignment dispatched.'),
  ('30000000-0000-0000-0000-000000000013', 'CMP-2026-00119', '20000000-0000-0000-0000-000000000013', 'f0000000-0000-0000-0000-00000000001d', 'Shift A', 'Hydraulic', 'medium', 'work_order_created', NOW() - INTERVAL '11 days 4 hours', NOW() - INTERVAL '11 days 3 hours 45 minutes', 12406.50, 57.50, 71.00, 'Hydraulic cylinder rod chromed surface score marks and oil leakage', 'During operational shift inspection by Nilesh A. Dhale (ROPS/FOPS Cabin Line Operator), anomaly detected on asset PUN-ASM-001 (JCB Main Chassis Automated In-Line Carrier Conveyor): Hydraulic cylinder rod chromed surface score marks and oil leakage. Machine stopped immediately as per JCB safety guidelines.', 'Acknowledged by Plant Maintenance Supervisor. Priority set to medium. Technician assignment dispatched.'),
  ('30000000-0000-0000-0000-000000000014', 'CMP-2026-00120', '20000000-0000-0000-0000-000000000014', 'f0000000-0000-0000-0000-00000000001e', 'Shift A', 'Mechanical', 'low', 'work_order_created', NOW() - INTERVAL '10 days 4 hours', NOW() - INTERVAL '10 days 3 hours 45 minutes', 3325.40, 58.50, 52.00, 'Pre-treatment chemical dip tank 4 immersion heating element burnt', 'During operational shift inspection by Harsh V. Zagade (Machine Test Track Operator), anomaly detected on asset PUN-ASM-002 (Atlas Copco Multi-Spindle Digital Torque Nutrunner Station): Pre-treatment chemical dip tank 4 immersion heating element burnt. Machine stopped immediately as per JCB safety guidelines.', 'Acknowledged by Plant Maintenance Supervisor. Priority set to low. Technician assignment dispatched.'),
  ('30000000-0000-0000-0000-000000000015', 'CMP-2026-00121', '20000000-0000-0000-0000-000000000015', 'f0000000-0000-0000-0000-000000000015', 'Shift A', 'Electrical', 'critical', 'pending_review', NOW() - INTERVAL '9 days 4 hours', NOW() - INTERVAL '9 days 3 hours 45 minutes', 4873.50, 59.50, 53.00, 'Shot blasting turbine wheel blade wear leading to uneven surface finish', 'During operational shift inspection by Tushar H. Shingade (Senior HMC Machine Operator), anomaly detected on asset PUN-HYD-001 (JCB Hydraulic Flushing & Oil Cleanliness Verification Rig): Shot blasting turbine wheel blade wear leading to uneven surface finish. Machine stopped immediately as per JCB safety guidelines.', 'Acknowledged by Plant Maintenance Supervisor. Priority set to critical. Technician assignment dispatched.'),
  ('30000000-0000-0000-0000-000000000016', 'CMP-2026-00122', '20000000-0000-0000-0000-000000000016', 'f0000000-0000-0000-0000-000000000016', 'Shift A', 'Pneumatics', 'high', 'pending_review', NOW() - INTERVAL '8 days 4 hours', NOW() - INTERVAL '8 days 3 hours 45 minutes', 4052.80, 60.50, 54.00, 'Chassis assembly power and free conveyor carrier dog chain slippage', 'During operational shift inspection by Onkar S. Navale (Automated Cell Operator), anomaly detected on asset PUN-HYD-002 (Rexroth Hydraulic Dynamic Cylinder End-of-Line Test Stand): Chassis assembly power and free conveyor carrier dog chain slippage. Machine stopped immediately as per JCB safety guidelines.', 'Acknowledged by Plant Maintenance Supervisor. Priority set to high. Technician assignment dispatched.'),
  ('30000000-0000-0000-0000-000000000017', 'CMP-2026-00123', '20000000-0000-0000-0000-000000000017', 'f0000000-0000-0000-0000-000000000017', 'Shift A', 'Automation', 'medium', 'pending_review', NOW() - INTERVAL '7 days 4 hours', NOW() - INTERVAL '7 days 3 hours 45 minutes', 2830.50, 61.50, 55.00, 'High-pressure test rig pressure transducer erratic 4-20mA signal drift', 'During operational shift inspection by Vijay K. Lokhande (Schuler 1000T Press Operator), anomaly detected on asset PUN-TST-001 (JCB Dynamometer Heavy Powertrain Road Testing Rig): High-pressure test rig pressure transducer erratic 4-20mA signal drift. Machine stopped immediately as per JCB safety guidelines.', 'Acknowledged by Plant Maintenance Supervisor. Priority set to medium. Technician assignment dispatched.'),
  ('30000000-0000-0000-0000-000000000018', 'CMP-2026-00124', '20000000-0000-0000-0000-000000000018', 'f0000000-0000-0000-0000-000000000018', 'Shift A', 'Cooling System', 'low', 'pending_review', NOW() - INTERVAL '6 days 4 hours', NOW() - INTERVAL '6 days 3 hours 45 minutes', 1929.20, 62.50, 56.00, 'Pilz safety light curtain optical emitter beam misalignment after part load', 'During operational shift inspection by Pradeep B. Wagh (Trumpf Laser Cutting Operator), anomaly detected on asset PUN-CMM-001 (Carl Zeiss ACCURA High-Precision Bridge Coordinate Measuring Machine): Pilz safety light curtain optical emitter beam misalignment after part load. Machine stopped immediately as per JCB safety guidelines.', 'Acknowledged by Plant Maintenance Supervisor. Priority set to low. Technician assignment dispatched.'),
  ('30000000-0000-0000-0000-000000000019', 'CMP-2026-00125', '20000000-0000-0000-0000-000000000019', 'f0000000-0000-0000-0000-000000000019', 'Shift A', 'Hydraulic', 'critical', 'pending_review', NOW() - INTERVAL '5 days 4 hours', NOW() - INTERVAL '5 days 3 hours 45 minutes', 14158.00, 63.50, 57.00, 'CNC lathe turret index motor thermal overload switch trip after boring', 'During operational shift inspection by Suraj M. Khilare (Excavator Frame Operator), anomaly detected on asset PUN-CMP-001 (Atlas Copco GA 160 VSD+ Oil-Injected Rotary Screw Air Compressor #1): CNC lathe turret index motor thermal overload switch trip after boring. Machine stopped immediately as per JCB safety guidelines.', 'Acknowledged by Plant Maintenance Supervisor. Priority set to critical. Technician assignment dispatched.'),
  ('30000000-0000-0000-0000-00000000001a', 'CMP-2026-00126', '20000000-0000-0000-0000-00000000001a', 'f0000000-0000-0000-0000-00000000001a', 'Shift A', 'Mechanical', 'high', 'pending_review', NOW() - INTERVAL '4 days 4 hours', NOW() - INTERVAL '4 days 3 hours 45 minutes', 13916.00, 64.50, 58.00, 'Pneumatic FRL unit air regulator diaphragm ruptured in Press Bay', 'During operational shift inspection by Kiran R. Ghadge (Electrostatic Line Operator), anomaly detected on asset PUN-CMP-002 (Atlas Copco GA 160 VSD+ Oil-Injected Rotary Screw Air Compressor #2): Pneumatic FRL unit air regulator diaphragm ruptured in Press Bay. Machine stopped immediately as per JCB safety guidelines.', 'Acknowledged by Plant Maintenance Supervisor. Priority set to high. Technician assignment dispatched.'),
  ('30000000-0000-0000-0000-00000000001b', 'CMP-2026-00127', '20000000-0000-0000-0000-00000000001b', 'f0000000-0000-0000-0000-00000000001b', 'Shift A', 'Electrical', 'medium', 'new', NOW() - INTERVAL '3 days 4 hours', NOW() - INTERVAL '3 days 3 hours 45 minutes', 11174.50, 65.50, 59.00, 'Fanuc robot arm teach pendant deadman switch intermittent contact', 'During operational shift inspection by Deepak N. Choudhary (Gearbox Line Operator), anomaly detected on asset PUN-CHL-001 (Daikin EWAD-TZ Central Industrial Process Water Chiller 400TR): Fanuc robot arm teach pendant deadman switch intermittent contact. Machine stopped immediately as per JCB safety guidelines.', 'Acknowledged by Plant Maintenance Supervisor. Priority set to medium. Technician assignment dispatched.'),
  ('30000000-0000-0000-0000-00000000001c', 'CMP-2026-00128', '20000000-0000-0000-0000-00000000001c', 'f0000000-0000-0000-0000-00000000001c', 'Shift A', 'Pneumatics', 'low', 'new', NOW() - INTERVAL '2 days 4 hours', NOW() - INTERVAL '2 days 3 hours 45 minutes', 6873.30, 38.50, 60.00, 'Hydraulic power pack immersion cooler oil temperature high alarm 65°C', 'During operational shift inspection by Chetan P. Kore (Boom & Dipper Fitter Operator), anomaly detected on asset PUN-BLS-001 (Pangborn Continuous Heavy Structural Steel Shot Blasting Chamber): Hydraulic power pack immersion cooler oil temperature high alarm 65°C. Machine stopped immediately as per JCB safety guidelines.', 'Acknowledged by Plant Maintenance Supervisor. Priority set to low. Technician assignment dispatched.'),
  ('30000000-0000-0000-0000-00000000001d', 'CMP-2026-00129', '20000000-0000-0000-0000-00000000001d', 'f0000000-0000-0000-0000-00000000001d', 'Shift A', 'Automation', 'critical', 'new', NOW() - INTERVAL '1 days 4 hours', NOW() - INTERVAL '1 days 3 hours 45 minutes', 4771.50, 39.50, 61.00, 'Carl Zeiss CMM air bearing pressure drop interlock locking granite bridge', 'During operational shift inspection by Nilesh A. Dhale (ROPS/FOPS Cabin Line Operator), anomaly detected on asset PUN-BND-001 (Trumpf TruBend 5320 Heavy 320T CNC Hydraulic Press Brake): Carl Zeiss CMM air bearing pressure drop interlock locking granite bridge. Machine stopped immediately as per JCB safety guidelines.', 'Acknowledged by Plant Maintenance Supervisor. Priority set to critical. Technician assignment dispatched.'),
  ('30000000-0000-0000-0000-00000000001e', 'CMP-2026-00130', '20000000-0000-0000-0000-00000000001e', 'f0000000-0000-0000-0000-00000000001e', 'Shift A', 'Cooling System', 'high', 'new', NOW() - INTERVAL '0 days 4 hours', NOW() - INTERVAL '0 days 3 hours 45 minutes', 5340.20, 40.50, 62.00, 'Tracked machine dyno test track rolling drum hydraulic retarder overheating', 'During operational shift inspection by Harsh V. Zagade (Machine Test Track Operator), anomaly detected on asset PUN-ROB-005 (Kawasaki Heavy 7-Axis Gantry Welding Robot System): Tracked machine dyno test track rolling drum hydraulic retarder overheating. Machine stopped immediately as per JCB safety guidelines.', 'Acknowledged by Plant Maintenance Supervisor. Priority set to high. Technician assignment dispatched.')
ON CONFLICT (complaint_number) DO NOTHING;

-- 8. 30 Real Work Orders (Using Valid work_order_status Enum)
INSERT INTO work_orders (
  id, wo_number, complaint_id, machine_id, assigned_technician_id, assigned_manager_id, 
  priority, status, classification, is_major_breakdown, work_instructions, 
  breakdown_time, reported_time, manager_ack_time, technician_assigned_time, 
  travel_started_time, arrival_time, completed_at
) VALUES
  ('40000000-0000-0000-0000-000000000001', 'WO-2026-00201', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-00000000000b', 'f0000000-0000-0000-0000-000000000003', 'critical', 'completed', 'minor_breakdown', false, 'Assigned Lead Technician Nitin G. Pawar (Senior Mechanical Technician) to perform comprehensive root-cause analysis and repair on asset Mazak Horizontal Machining Center HCN-6800 NEO #1. Supervisor: Rohan S. Kulkarni. Follow JCB Safety Lockout-Tagout (LOTO) protocols, isolate high-pressure hydraulic accumulators, and verify torque specifications using calibrated tools.', NOW() - INTERVAL '1 days 4 hours', NOW() - INTERVAL '1 days 3 hours 45 minutes', NOW() - INTERVAL '1 days 3 hours 20 minutes', NOW() - INTERVAL '1 days 3 hours', NOW() - INTERVAL '1 days 2 hours 45 minutes', NOW() - INTERVAL '1 days 2 hours 30 minutes', NOW() - INTERVAL '1 days 30 minutes'),
  ('40000000-0000-0000-0000-000000000002', 'WO-2026-00202', '30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-00000000000c', 'f0000000-0000-0000-0000-000000000004', 'high', 'verified_closed', 'minor_breakdown', false, 'Assigned Lead Technician Vishal B. Mane (PLC & Automation Specialist) to perform comprehensive root-cause analysis and repair on asset Mazak Horizontal Machining Center HCN-6800 NEO #2. Supervisor: Swapnil M. Shinde. Follow JCB Safety Lockout-Tagout (LOTO) protocols, isolate high-pressure hydraulic accumulators, and verify torque specifications using calibrated tools.', NOW() - INTERVAL '0 days 4 hours', NOW() - INTERVAL '0 days 3 hours 45 minutes', NOW() - INTERVAL '0 days 3 hours 20 minutes', NOW() - INTERVAL '0 days 3 hours', NOW() - INTERVAL '0 days 2 hours 45 minutes', NOW() - INTERVAL '0 days 2 hours 30 minutes', NOW() - INTERVAL '0 days 30 minutes'),
  ('40000000-0000-0000-0000-000000000003', 'WO-2026-00203', '30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-00000000000d', 'f0000000-0000-0000-0000-000000000005', 'medium', 'in_progress', 'minor_breakdown', false, 'Assigned Lead Technician Sandeep R. Thorat (Lead Hydraulics Tech) to perform comprehensive root-cause analysis and repair on asset Makino Vertical Machining Center V99 Heavy Milling. Supervisor: Amol V. More. Follow JCB Safety Lockout-Tagout (LOTO) protocols, isolate high-pressure hydraulic accumulators, and verify torque specifications using calibrated tools.', NOW() - INTERVAL '13 days 4 hours', NOW() - INTERVAL '13 days 3 hours 45 minutes', NOW() - INTERVAL '13 days 3 hours 20 minutes', NOW() - INTERVAL '13 days 3 hours', NOW() - INTERVAL '13 days 2 hours 45 minutes', NOW() - INTERVAL '13 days 2 hours 30 minutes', NULL),
  ('40000000-0000-0000-0000-000000000004', 'WO-2026-00204', '30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-00000000000e', 'f0000000-0000-0000-0000-000000000006', 'low', 'assigned', 'major_breakdown', true, 'Assigned Lead Technician Dattatray P. Khot (Robotics Field Technician) to perform comprehensive root-cause analysis and repair on asset Doosan DNM 6700 High Productivity VMC. Supervisor: Prashant B. Chavan. Follow JCB Safety Lockout-Tagout (LOTO) protocols, isolate high-pressure hydraulic accumulators, and verify torque specifications using calibrated tools.', NOW() - INTERVAL '12 days 4 hours', NOW() - INTERVAL '12 days 3 hours 45 minutes', NOW() - INTERVAL '12 days 3 hours 20 minutes', NOW() - INTERVAL '12 days 3 hours', NOW() - INTERVAL '12 days 2 hours 45 minutes', NOW() - INTERVAL '12 days 2 hours 30 minutes', NULL),
  ('40000000-0000-0000-0000-000000000005', 'WO-2026-00205', '30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-00000000000f', 'f0000000-0000-0000-0000-000000000003', 'critical', 'waiting_for_parts', 'minor_breakdown', false, 'Assigned Lead Technician Mangesh D. Salunkhe (Spindle & Tool Changer Tech) to perform comprehensive root-cause analysis and repair on asset Okuma Multus U4000 Intelligent CNC Turning Center. Supervisor: Rohan S. Kulkarni. Follow JCB Safety Lockout-Tagout (LOTO) protocols, isolate high-pressure hydraulic accumulators, and verify torque specifications using calibrated tools.', NOW() - INTERVAL '11 days 4 hours', NOW() - INTERVAL '11 days 3 hours 45 minutes', NOW() - INTERVAL '11 days 3 hours 20 minutes', NOW() - INTERVAL '11 days 3 hours', NOW() - INTERVAL '11 days 2 hours 45 minutes', NOW() - INTERVAL '11 days 2 hours 30 minutes', NULL),
  ('40000000-0000-0000-0000-000000000006', 'WO-2026-00206', '30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-000000000010', 'f0000000-0000-0000-0000-000000000004', 'high', 'under_diagnosis', 'minor_breakdown', false, 'Assigned Lead Technician Pravin V. Sawant (Heavy Press Mechanical Tech) to perform comprehensive root-cause analysis and repair on asset Fanuc ARC Mate 120iD 6-Axis Boom Welding Robot #1. Supervisor: Swapnil M. Shinde. Follow JCB Safety Lockout-Tagout (LOTO) protocols, isolate high-pressure hydraulic accumulators, and verify torque specifications using calibrated tools.', NOW() - INTERVAL '10 days 4 hours', NOW() - INTERVAL '10 days 3 hours 45 minutes', NOW() - INTERVAL '10 days 3 hours 20 minutes', NOW() - INTERVAL '10 days 3 hours', NOW() - INTERVAL '10 days 2 hours 45 minutes', NOW() - INTERVAL '10 days 2 hours 30 minutes', NULL),
  ('40000000-0000-0000-0000-000000000007', 'WO-2026-00207', '30000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000011', 'f0000000-0000-0000-0000-000000000005', 'medium', 'completed', 'minor_breakdown', false, 'Assigned Lead Technician Ajinkya C. Surve (Plant Utilities Technician) to perform comprehensive root-cause analysis and repair on asset Fanuc ARC Mate 120iD 6-Axis Dipper Welding Robot #2. Supervisor: Amol V. More. Follow JCB Safety Lockout-Tagout (LOTO) protocols, isolate high-pressure hydraulic accumulators, and verify torque specifications using calibrated tools.', NOW() - INTERVAL '9 days 4 hours', NOW() - INTERVAL '9 days 3 hours 45 minutes', NOW() - INTERVAL '9 days 3 hours 20 minutes', NOW() - INTERVAL '9 days 3 hours', NOW() - INTERVAL '9 days 2 hours 45 minutes', NOW() - INTERVAL '9 days 2 hours 30 minutes', NOW() - INTERVAL '9 days 30 minutes'),
  ('40000000-0000-0000-0000-000000000008', 'WO-2026-00208', '30000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000008', 'f0000000-0000-0000-0000-000000000012', 'f0000000-0000-0000-0000-000000000006', 'low', 'verified_closed', 'major_breakdown', true, 'Assigned Lead Technician Yogesh S. Kamble (Drives & VFD Tech) to perform comprehensive root-cause analysis and repair on asset ABB IRB 6700 Heavy Spot & Seam Welding Robot. Supervisor: Prashant B. Chavan. Follow JCB Safety Lockout-Tagout (LOTO) protocols, isolate high-pressure hydraulic accumulators, and verify torque specifications using calibrated tools.', NOW() - INTERVAL '8 days 4 hours', NOW() - INTERVAL '8 days 3 hours 45 minutes', NOW() - INTERVAL '8 days 3 hours 20 minutes', NOW() - INTERVAL '8 days 3 hours', NOW() - INTERVAL '8 days 2 hours 45 minutes', NOW() - INTERVAL '8 days 2 hours 30 minutes', NOW() - INTERVAL '8 days 30 minutes'),
  ('40000000-0000-0000-0000-000000000009', 'WO-2026-00209', '30000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000009', 'f0000000-0000-0000-0000-000000000013', 'f0000000-0000-0000-0000-000000000003', 'critical', 'in_progress', 'minor_breakdown', false, 'Assigned Lead Technician Akash N. Tambade (Condition Monitoring Specialist) to perform comprehensive root-cause analysis and repair on asset KUKA KR 300 R2500 Heavy Frame Welding Cell. Supervisor: Rohan S. Kulkarni. Follow JCB Safety Lockout-Tagout (LOTO) protocols, isolate high-pressure hydraulic accumulators, and verify torque specifications using calibrated tools.', NOW() - INTERVAL '7 days 4 hours', NOW() - INTERVAL '7 days 3 hours 45 minutes', NOW() - INTERVAL '7 days 3 hours 20 minutes', NOW() - INTERVAL '7 days 3 hours', NOW() - INTERVAL '7 days 2 hours 45 minutes', NOW() - INTERVAL '7 days 2 hours 30 minutes', NULL),
  ('40000000-0000-0000-0000-00000000000a', 'WO-2026-00210', '30000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', 'f0000000-0000-0000-0000-000000000014', 'f0000000-0000-0000-0000-000000000004', 'high', 'assigned', 'minor_breakdown', false, 'Assigned Lead Technician Siddhesh R. Gawade (Emergency Breakdown Specialist) to perform comprehensive root-cause analysis and repair on asset Schuler 1000T Hydraulic Deep-Draw Forming Press. Supervisor: Swapnil M. Shinde. Follow JCB Safety Lockout-Tagout (LOTO) protocols, isolate high-pressure hydraulic accumulators, and verify torque specifications using calibrated tools.', NOW() - INTERVAL '6 days 4 hours', NOW() - INTERVAL '6 days 3 hours 45 minutes', NOW() - INTERVAL '6 days 3 hours 20 minutes', NOW() - INTERVAL '6 days 3 hours', NOW() - INTERVAL '6 days 2 hours 45 minutes', NOW() - INTERVAL '6 days 2 hours 30 minutes', NULL),
  ('40000000-0000-0000-0000-00000000000b', 'WO-2026-00211', '30000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-00000000000b', 'f0000000-0000-0000-0000-00000000000b', 'f0000000-0000-0000-0000-000000000005', 'medium', 'waiting_for_parts', 'minor_breakdown', false, 'Assigned Lead Technician Nitin G. Pawar (Senior Mechanical Technician) to perform comprehensive root-cause analysis and repair on asset Komatsu 600T Mechanical Stamping Press. Supervisor: Amol V. More. Follow JCB Safety Lockout-Tagout (LOTO) protocols, isolate high-pressure hydraulic accumulators, and verify torque specifications using calibrated tools.', NOW() - INTERVAL '5 days 4 hours', NOW() - INTERVAL '5 days 3 hours 45 minutes', NOW() - INTERVAL '5 days 3 hours 20 minutes', NOW() - INTERVAL '5 days 3 hours', NOW() - INTERVAL '5 days 2 hours 45 minutes', NOW() - INTERVAL '5 days 2 hours 30 minutes', NULL),
  ('40000000-0000-0000-0000-00000000000c', 'WO-2026-00212', '30000000-0000-0000-0000-00000000000c', '20000000-0000-0000-0000-00000000000c', 'f0000000-0000-0000-0000-00000000000c', 'f0000000-0000-0000-0000-000000000006', 'low', 'under_diagnosis', 'major_breakdown', true, 'Assigned Lead Technician Vishal B. Mane (PLC & Automation Specialist) to perform comprehensive root-cause analysis and repair on asset Aida 400T Progressive Die Stamping Press. Supervisor: Prashant B. Chavan. Follow JCB Safety Lockout-Tagout (LOTO) protocols, isolate high-pressure hydraulic accumulators, and verify torque specifications using calibrated tools.', NOW() - INTERVAL '4 days 4 hours', NOW() - INTERVAL '4 days 3 hours 45 minutes', NOW() - INTERVAL '4 days 3 hours 20 minutes', NOW() - INTERVAL '4 days 3 hours', NOW() - INTERVAL '4 days 2 hours 45 minutes', NOW() - INTERVAL '4 days 2 hours 30 minutes', NULL),
  ('40000000-0000-0000-0000-00000000000d', 'WO-2026-00213', '30000000-0000-0000-0000-00000000000d', '20000000-0000-0000-0000-00000000000d', 'f0000000-0000-0000-0000-00000000000d', 'f0000000-0000-0000-0000-000000000003', 'critical', 'completed', 'minor_breakdown', false, 'Assigned Lead Technician Sandeep R. Thorat (Lead Hydraulics Tech) to perform comprehensive root-cause analysis and repair on asset Trumpf TruLaser 5030 Fiber 10kW CNC Laser Cutter. Supervisor: Rohan S. Kulkarni. Follow JCB Safety Lockout-Tagout (LOTO) protocols, isolate high-pressure hydraulic accumulators, and verify torque specifications using calibrated tools.', NOW() - INTERVAL '3 days 4 hours', NOW() - INTERVAL '3 days 3 hours 45 minutes', NOW() - INTERVAL '3 days 3 hours 20 minutes', NOW() - INTERVAL '3 days 3 hours', NOW() - INTERVAL '3 days 2 hours 45 minutes', NOW() - INTERVAL '3 days 2 hours 30 minutes', NOW() - INTERVAL '3 days 30 minutes'),
  ('40000000-0000-0000-0000-00000000000e', 'WO-2026-00214', '30000000-0000-0000-0000-00000000000e', '20000000-0000-0000-0000-00000000000e', 'f0000000-0000-0000-0000-00000000000e', 'f0000000-0000-0000-0000-000000000004', 'high', 'verified_closed', 'minor_breakdown', false, 'Assigned Lead Technician Dattatray P. Khot (Robotics Field Technician) to perform comprehensive root-cause analysis and repair on asset Bystronic ByStar Fiber 12kW Heavy Sheet Laser. Supervisor: Swapnil M. Shinde. Follow JCB Safety Lockout-Tagout (LOTO) protocols, isolate high-pressure hydraulic accumulators, and verify torque specifications using calibrated tools.', NOW() - INTERVAL '2 days 4 hours', NOW() - INTERVAL '2 days 3 hours 45 minutes', NOW() - INTERVAL '2 days 3 hours 20 minutes', NOW() - INTERVAL '2 days 3 hours', NOW() - INTERVAL '2 days 2 hours 45 minutes', NOW() - INTERVAL '2 days 2 hours 30 minutes', NOW() - INTERVAL '2 days 30 minutes'),
  ('40000000-0000-0000-0000-00000000000f', 'WO-2026-00215', '30000000-0000-0000-0000-00000000000f', '20000000-0000-0000-0000-00000000000f', 'f0000000-0000-0000-0000-00000000000f', 'f0000000-0000-0000-0000-000000000005', 'medium', 'in_progress', 'minor_breakdown', false, 'Assigned Lead Technician Mangesh D. Salunkhe (Spindle & Tool Changer Tech) to perform comprehensive root-cause analysis and repair on asset Messer MultiTherm Heavy CNC Plasma & Oxy-Fuel Cutting Gantry. Supervisor: Amol V. More. Follow JCB Safety Lockout-Tagout (LOTO) protocols, isolate high-pressure hydraulic accumulators, and verify torque specifications using calibrated tools.', NOW() - INTERVAL '1 days 4 hours', NOW() - INTERVAL '1 days 3 hours 45 minutes', NOW() - INTERVAL '1 days 3 hours 20 minutes', NOW() - INTERVAL '1 days 3 hours', NOW() - INTERVAL '1 days 2 hours 45 minutes', NOW() - INTERVAL '1 days 2 hours 30 minutes', NULL),
  ('40000000-0000-0000-0000-000000000010', 'WO-2026-00216', '30000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000010', 'f0000000-0000-0000-0000-000000000010', 'f0000000-0000-0000-0000-000000000006', 'low', 'assigned', 'major_breakdown', true, 'Assigned Lead Technician Pravin V. Sawant (Heavy Press Mechanical Tech) to perform comprehensive root-cause analysis and repair on asset Gema OptiCenter Automated Powder Coating System. Supervisor: Prashant B. Chavan. Follow JCB Safety Lockout-Tagout (LOTO) protocols, isolate high-pressure hydraulic accumulators, and verify torque specifications using calibrated tools.', NOW() - INTERVAL '0 days 4 hours', NOW() - INTERVAL '0 days 3 hours 45 minutes', NOW() - INTERVAL '0 days 3 hours 20 minutes', NOW() - INTERVAL '0 days 3 hours', NOW() - INTERVAL '0 days 2 hours 45 minutes', NOW() - INTERVAL '0 days 2 hours 30 minutes', NULL),
  ('40000000-0000-0000-0000-000000000011', 'WO-2026-00217', '30000000-0000-0000-0000-000000000011', '20000000-0000-0000-0000-000000000011', 'f0000000-0000-0000-0000-000000000011', 'f0000000-0000-0000-0000-000000000003', 'critical', 'waiting_for_parts', 'minor_breakdown', false, 'Assigned Lead Technician Ajinkya C. Surve (Plant Utilities Technician) to perform comprehensive root-cause analysis and repair on asset Eisenmann 12-Stage Zinc-Phosphating Pretreatment Dip Tunnel. Supervisor: Rohan S. Kulkarni. Follow JCB Safety Lockout-Tagout (LOTO) protocols, isolate high-pressure hydraulic accumulators, and verify torque specifications using calibrated tools.', NOW() - INTERVAL '13 days 4 hours', NOW() - INTERVAL '13 days 3 hours 45 minutes', NOW() - INTERVAL '13 days 3 hours 20 minutes', NOW() - INTERVAL '13 days 3 hours', NOW() - INTERVAL '13 days 2 hours 45 minutes', NOW() - INTERVAL '13 days 2 hours 30 minutes', NULL),
  ('40000000-0000-0000-0000-000000000012', 'WO-2026-00218', '30000000-0000-0000-0000-000000000012', '20000000-0000-0000-0000-000000000012', 'f0000000-0000-0000-0000-000000000012', 'f0000000-0000-0000-0000-000000000004', 'high', 'under_diagnosis', 'minor_breakdown', false, 'Assigned Lead Technician Yogesh S. Kamble (Drives & VFD Tech) to perform comprehensive root-cause analysis and repair on asset Dürr EcoDry Oven High-Efficiency Convection Curing Oven. Supervisor: Swapnil M. Shinde. Follow JCB Safety Lockout-Tagout (LOTO) protocols, isolate high-pressure hydraulic accumulators, and verify torque specifications using calibrated tools.', NOW() - INTERVAL '12 days 4 hours', NOW() - INTERVAL '12 days 3 hours 45 minutes', NOW() - INTERVAL '12 days 3 hours 20 minutes', NOW() - INTERVAL '12 days 3 hours', NOW() - INTERVAL '12 days 2 hours 45 minutes', NOW() - INTERVAL '12 days 2 hours 30 minutes', NULL),
  ('40000000-0000-0000-0000-000000000013', 'WO-2026-00219', '30000000-0000-0000-0000-000000000013', '20000000-0000-0000-0000-000000000013', 'f0000000-0000-0000-0000-000000000013', 'f0000000-0000-0000-0000-000000000005', 'medium', 'completed', 'minor_breakdown', false, 'Assigned Lead Technician Akash N. Tambade (Condition Monitoring Specialist) to perform comprehensive root-cause analysis and repair on asset JCB Main Chassis Automated In-Line Carrier Conveyor. Supervisor: Amol V. More. Follow JCB Safety Lockout-Tagout (LOTO) protocols, isolate high-pressure hydraulic accumulators, and verify torque specifications using calibrated tools.', NOW() - INTERVAL '11 days 4 hours', NOW() - INTERVAL '11 days 3 hours 45 minutes', NOW() - INTERVAL '11 days 3 hours 20 minutes', NOW() - INTERVAL '11 days 3 hours', NOW() - INTERVAL '11 days 2 hours 45 minutes', NOW() - INTERVAL '11 days 2 hours 30 minutes', NOW() - INTERVAL '11 days 30 minutes'),
  ('40000000-0000-0000-0000-000000000014', 'WO-2026-00220', '30000000-0000-0000-0000-000000000014', '20000000-0000-0000-0000-000000000014', 'f0000000-0000-0000-0000-000000000014', 'f0000000-0000-0000-0000-000000000006', 'low', 'verified_closed', 'major_breakdown', true, 'Assigned Lead Technician Siddhesh R. Gawade (Emergency Breakdown Specialist) to perform comprehensive root-cause analysis and repair on asset Atlas Copco Multi-Spindle Digital Torque Nutrunner Station. Supervisor: Prashant B. Chavan. Follow JCB Safety Lockout-Tagout (LOTO) protocols, isolate high-pressure hydraulic accumulators, and verify torque specifications using calibrated tools.', NOW() - INTERVAL '10 days 4 hours', NOW() - INTERVAL '10 days 3 hours 45 minutes', NOW() - INTERVAL '10 days 3 hours 20 minutes', NOW() - INTERVAL '10 days 3 hours', NOW() - INTERVAL '10 days 2 hours 45 minutes', NOW() - INTERVAL '10 days 2 hours 30 minutes', NOW() - INTERVAL '10 days 30 minutes'),
  ('40000000-0000-0000-0000-000000000015', 'WO-2026-00221', '30000000-0000-0000-0000-000000000015', '20000000-0000-0000-0000-000000000015', 'f0000000-0000-0000-0000-00000000000b', 'f0000000-0000-0000-0000-000000000003', 'critical', 'in_progress', 'minor_breakdown', false, 'Assigned Lead Technician Nitin G. Pawar (Senior Mechanical Technician) to perform comprehensive root-cause analysis and repair on asset JCB Hydraulic Flushing & Oil Cleanliness Verification Rig. Supervisor: Rohan S. Kulkarni. Follow JCB Safety Lockout-Tagout (LOTO) protocols, isolate high-pressure hydraulic accumulators, and verify torque specifications using calibrated tools.', NOW() - INTERVAL '9 days 4 hours', NOW() - INTERVAL '9 days 3 hours 45 minutes', NOW() - INTERVAL '9 days 3 hours 20 minutes', NOW() - INTERVAL '9 days 3 hours', NOW() - INTERVAL '9 days 2 hours 45 minutes', NOW() - INTERVAL '9 days 2 hours 30 minutes', NULL),
  ('40000000-0000-0000-0000-000000000016', 'WO-2026-00222', '30000000-0000-0000-0000-000000000016', '20000000-0000-0000-0000-000000000016', 'f0000000-0000-0000-0000-00000000000c', 'f0000000-0000-0000-0000-000000000004', 'high', 'assigned', 'minor_breakdown', false, 'Assigned Lead Technician Vishal B. Mane (PLC & Automation Specialist) to perform comprehensive root-cause analysis and repair on asset Rexroth Hydraulic Dynamic Cylinder End-of-Line Test Stand. Supervisor: Swapnil M. Shinde. Follow JCB Safety Lockout-Tagout (LOTO) protocols, isolate high-pressure hydraulic accumulators, and verify torque specifications using calibrated tools.', NOW() - INTERVAL '8 days 4 hours', NOW() - INTERVAL '8 days 3 hours 45 minutes', NOW() - INTERVAL '8 days 3 hours 20 minutes', NOW() - INTERVAL '8 days 3 hours', NOW() - INTERVAL '8 days 2 hours 45 minutes', NOW() - INTERVAL '8 days 2 hours 30 minutes', NULL),
  ('40000000-0000-0000-0000-000000000017', 'WO-2026-00223', '30000000-0000-0000-0000-000000000017', '20000000-0000-0000-0000-000000000017', 'f0000000-0000-0000-0000-00000000000d', 'f0000000-0000-0000-0000-000000000005', 'medium', 'waiting_for_parts', 'minor_breakdown', false, 'Assigned Lead Technician Sandeep R. Thorat (Lead Hydraulics Tech) to perform comprehensive root-cause analysis and repair on asset JCB Dynamometer Heavy Powertrain Road Testing Rig. Supervisor: Amol V. More. Follow JCB Safety Lockout-Tagout (LOTO) protocols, isolate high-pressure hydraulic accumulators, and verify torque specifications using calibrated tools.', NOW() - INTERVAL '7 days 4 hours', NOW() - INTERVAL '7 days 3 hours 45 minutes', NOW() - INTERVAL '7 days 3 hours 20 minutes', NOW() - INTERVAL '7 days 3 hours', NOW() - INTERVAL '7 days 2 hours 45 minutes', NOW() - INTERVAL '7 days 2 hours 30 minutes', NULL),
  ('40000000-0000-0000-0000-000000000018', 'WO-2026-00224', '30000000-0000-0000-0000-000000000018', '20000000-0000-0000-0000-000000000018', 'f0000000-0000-0000-0000-00000000000e', 'f0000000-0000-0000-0000-000000000006', 'low', 'under_diagnosis', 'major_breakdown', true, 'Assigned Lead Technician Dattatray P. Khot (Robotics Field Technician) to perform comprehensive root-cause analysis and repair on asset Carl Zeiss ACCURA High-Precision Bridge Coordinate Measuring Machine. Supervisor: Prashant B. Chavan. Follow JCB Safety Lockout-Tagout (LOTO) protocols, isolate high-pressure hydraulic accumulators, and verify torque specifications using calibrated tools.', NOW() - INTERVAL '6 days 4 hours', NOW() - INTERVAL '6 days 3 hours 45 minutes', NOW() - INTERVAL '6 days 3 hours 20 minutes', NOW() - INTERVAL '6 days 3 hours', NOW() - INTERVAL '6 days 2 hours 45 minutes', NOW() - INTERVAL '6 days 2 hours 30 minutes', NULL),
  ('40000000-0000-0000-0000-000000000019', 'WO-2026-00225', '30000000-0000-0000-0000-000000000019', '20000000-0000-0000-0000-000000000019', 'f0000000-0000-0000-0000-00000000000f', 'f0000000-0000-0000-0000-000000000003', 'critical', 'completed', 'minor_breakdown', false, 'Assigned Lead Technician Mangesh D. Salunkhe (Spindle & Tool Changer Tech) to perform comprehensive root-cause analysis and repair on asset Atlas Copco GA 160 VSD+ Oil-Injected Rotary Screw Air Compressor #1. Supervisor: Rohan S. Kulkarni. Follow JCB Safety Lockout-Tagout (LOTO) protocols, isolate high-pressure hydraulic accumulators, and verify torque specifications using calibrated tools.', NOW() - INTERVAL '5 days 4 hours', NOW() - INTERVAL '5 days 3 hours 45 minutes', NOW() - INTERVAL '5 days 3 hours 20 minutes', NOW() - INTERVAL '5 days 3 hours', NOW() - INTERVAL '5 days 2 hours 45 minutes', NOW() - INTERVAL '5 days 2 hours 30 minutes', NOW() - INTERVAL '5 days 30 minutes'),
  ('40000000-0000-0000-0000-00000000001a', 'WO-2026-00226', '30000000-0000-0000-0000-00000000001a', '20000000-0000-0000-0000-00000000001a', 'f0000000-0000-0000-0000-000000000010', 'f0000000-0000-0000-0000-000000000004', 'high', 'verified_closed', 'minor_breakdown', false, 'Assigned Lead Technician Pravin V. Sawant (Heavy Press Mechanical Tech) to perform comprehensive root-cause analysis and repair on asset Atlas Copco GA 160 VSD+ Oil-Injected Rotary Screw Air Compressor #2. Supervisor: Swapnil M. Shinde. Follow JCB Safety Lockout-Tagout (LOTO) protocols, isolate high-pressure hydraulic accumulators, and verify torque specifications using calibrated tools.', NOW() - INTERVAL '4 days 4 hours', NOW() - INTERVAL '4 days 3 hours 45 minutes', NOW() - INTERVAL '4 days 3 hours 20 minutes', NOW() - INTERVAL '4 days 3 hours', NOW() - INTERVAL '4 days 2 hours 45 minutes', NOW() - INTERVAL '4 days 2 hours 30 minutes', NOW() - INTERVAL '4 days 30 minutes'),
  ('40000000-0000-0000-0000-00000000001b', 'WO-2026-00227', '30000000-0000-0000-0000-00000000001b', '20000000-0000-0000-0000-00000000001b', 'f0000000-0000-0000-0000-000000000011', 'f0000000-0000-0000-0000-000000000005', 'medium', 'in_progress', 'minor_breakdown', false, 'Assigned Lead Technician Ajinkya C. Surve (Plant Utilities Technician) to perform comprehensive root-cause analysis and repair on asset Daikin EWAD-TZ Central Industrial Process Water Chiller 400TR. Supervisor: Amol V. More. Follow JCB Safety Lockout-Tagout (LOTO) protocols, isolate high-pressure hydraulic accumulators, and verify torque specifications using calibrated tools.', NOW() - INTERVAL '3 days 4 hours', NOW() - INTERVAL '3 days 3 hours 45 minutes', NOW() - INTERVAL '3 days 3 hours 20 minutes', NOW() - INTERVAL '3 days 3 hours', NOW() - INTERVAL '3 days 2 hours 45 minutes', NOW() - INTERVAL '3 days 2 hours 30 minutes', NULL),
  ('40000000-0000-0000-0000-00000000001c', 'WO-2026-00228', '30000000-0000-0000-0000-00000000001c', '20000000-0000-0000-0000-00000000001c', 'f0000000-0000-0000-0000-000000000012', 'f0000000-0000-0000-0000-000000000006', 'low', 'assigned', 'major_breakdown', true, 'Assigned Lead Technician Yogesh S. Kamble (Drives & VFD Tech) to perform comprehensive root-cause analysis and repair on asset Pangborn Continuous Heavy Structural Steel Shot Blasting Chamber. Supervisor: Prashant B. Chavan. Follow JCB Safety Lockout-Tagout (LOTO) protocols, isolate high-pressure hydraulic accumulators, and verify torque specifications using calibrated tools.', NOW() - INTERVAL '2 days 4 hours', NOW() - INTERVAL '2 days 3 hours 45 minutes', NOW() - INTERVAL '2 days 3 hours 20 minutes', NOW() - INTERVAL '2 days 3 hours', NOW() - INTERVAL '2 days 2 hours 45 minutes', NOW() - INTERVAL '2 days 2 hours 30 minutes', NULL),
  ('40000000-0000-0000-0000-00000000001d', 'WO-2026-00229', '30000000-0000-0000-0000-00000000001d', '20000000-0000-0000-0000-00000000001d', 'f0000000-0000-0000-0000-000000000013', 'f0000000-0000-0000-0000-000000000003', 'critical', 'waiting_for_parts', 'minor_breakdown', false, 'Assigned Lead Technician Akash N. Tambade (Condition Monitoring Specialist) to perform comprehensive root-cause analysis and repair on asset Trumpf TruBend 5320 Heavy 320T CNC Hydraulic Press Brake. Supervisor: Rohan S. Kulkarni. Follow JCB Safety Lockout-Tagout (LOTO) protocols, isolate high-pressure hydraulic accumulators, and verify torque specifications using calibrated tools.', NOW() - INTERVAL '1 days 4 hours', NOW() - INTERVAL '1 days 3 hours 45 minutes', NOW() - INTERVAL '1 days 3 hours 20 minutes', NOW() - INTERVAL '1 days 3 hours', NOW() - INTERVAL '1 days 2 hours 45 minutes', NOW() - INTERVAL '1 days 2 hours 30 minutes', NULL),
  ('40000000-0000-0000-0000-00000000001e', 'WO-2026-00230', '30000000-0000-0000-0000-00000000001e', '20000000-0000-0000-0000-00000000001e', 'f0000000-0000-0000-0000-000000000014', 'f0000000-0000-0000-0000-000000000004', 'high', 'under_diagnosis', 'minor_breakdown', false, 'Assigned Lead Technician Siddhesh R. Gawade (Emergency Breakdown Specialist) to perform comprehensive root-cause analysis and repair on asset Kawasaki Heavy 7-Axis Gantry Welding Robot System. Supervisor: Swapnil M. Shinde. Follow JCB Safety Lockout-Tagout (LOTO) protocols, isolate high-pressure hydraulic accumulators, and verify torque specifications using calibrated tools.', NOW() - INTERVAL '0 days 4 hours', NOW() - INTERVAL '0 days 3 hours 45 minutes', NOW() - INTERVAL '0 days 3 hours 20 minutes', NOW() - INTERVAL '0 days 3 hours', NOW() - INTERVAL '0 days 2 hours 45 minutes', NOW() - INTERVAL '0 days 2 hours 30 minutes', NULL)
ON CONFLICT (wo_number) DO NOTHING;

-- 9. 30 Operator Pre-Shift Machine Inspections (Sensor Readings)
INSERT INTO inspection_records (
  id, machine_id, operator_id, shift, overall_status, temperature, pressure, vibration, responses_json, operator_signature_url, created_at
) VALUES
  ('70000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000015', 'Shift A', 'pass', 23.30, 48.50, 1.28, '[{"item_id":"chk-1","label":"Hydraulic System Pressure within 45 - 55 Bar","status":"pass","value":"48.50"},{"item_id":"chk-2","label":"Spindle Chiller Unit Operating Temperature (18C - 24C)","status":"pass","value":"23.30"},{"item_id":"chk-3","label":"Visual Check: No hydraulic fluid pooling or line leaks","status":"pass"},{"item_id":"chk-4","label":"Emergency Stop & Safety Enclosure Interlock Operational","status":"pass"},{"item_id":"chk-5","label":"Automatic Way Lube Lubrication Reservoir Level Nominal","status":"pass"}]'::jsonb, 'https://signatures.jcb-cmms.internal/operators/EMP-MAH-021/sig.png', NOW() - INTERVAL '9 days 6 hours'),
  ('70000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000016', 'Shift A', 'pass', 24.10, 49.00, 1.36, '[{"item_id":"chk-1","label":"Hydraulic System Pressure within 45 - 55 Bar","status":"pass","value":"49.00"},{"item_id":"chk-2","label":"Spindle Chiller Unit Operating Temperature (18C - 24C)","status":"pass","value":"24.10"},{"item_id":"chk-3","label":"Visual Check: No hydraulic fluid pooling or line leaks","status":"pass"},{"item_id":"chk-4","label":"Emergency Stop & Safety Enclosure Interlock Operational","status":"pass"},{"item_id":"chk-5","label":"Automatic Way Lube Lubrication Reservoir Level Nominal","status":"pass"}]'::jsonb, 'https://signatures.jcb-cmms.internal/operators/EMP-MAH-022/sig.png', NOW() - INTERVAL '8 days 6 hours'),
  ('70000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000017', 'Shift A', 'pass', 24.90, 49.50, 1.44, '[{"item_id":"chk-1","label":"Hydraulic System Pressure within 45 - 55 Bar","status":"pass","value":"49.50"},{"item_id":"chk-2","label":"Spindle Chiller Unit Operating Temperature (18C - 24C)","status":"pass","value":"24.90"},{"item_id":"chk-3","label":"Visual Check: No hydraulic fluid pooling or line leaks","status":"pass"},{"item_id":"chk-4","label":"Emergency Stop & Safety Enclosure Interlock Operational","status":"pass"},{"item_id":"chk-5","label":"Automatic Way Lube Lubrication Reservoir Level Nominal","status":"pass"}]'::jsonb, 'https://signatures.jcb-cmms.internal/operators/EMP-MAH-023/sig.png', NOW() - INTERVAL '7 days 6 hours'),
  ('70000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000018', 'Shift A', 'pass', 25.70, 50.00, 1.52, '[{"item_id":"chk-1","label":"Hydraulic System Pressure within 45 - 55 Bar","status":"pass","value":"50.00"},{"item_id":"chk-2","label":"Spindle Chiller Unit Operating Temperature (18C - 24C)","status":"pass","value":"25.70"},{"item_id":"chk-3","label":"Visual Check: No hydraulic fluid pooling or line leaks","status":"pass"},{"item_id":"chk-4","label":"Emergency Stop & Safety Enclosure Interlock Operational","status":"pass"},{"item_id":"chk-5","label":"Automatic Way Lube Lubrication Reservoir Level Nominal","status":"pass"}]'::jsonb, 'https://signatures.jcb-cmms.internal/operators/EMP-MAH-024/sig.png', NOW() - INTERVAL '6 days 6 hours'),
  ('70000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000019', 'Shift A', 'pass', 26.50, 50.50, 1.60, '[{"item_id":"chk-1","label":"Hydraulic System Pressure within 45 - 55 Bar","status":"pass","value":"50.50"},{"item_id":"chk-2","label":"Spindle Chiller Unit Operating Temperature (18C - 24C)","status":"pass","value":"26.50"},{"item_id":"chk-3","label":"Visual Check: No hydraulic fluid pooling or line leaks","status":"pass"},{"item_id":"chk-4","label":"Emergency Stop & Safety Enclosure Interlock Operational","status":"pass"},{"item_id":"chk-5","label":"Automatic Way Lube Lubrication Reservoir Level Nominal","status":"pass"}]'::jsonb, 'https://signatures.jcb-cmms.internal/operators/EMP-MAH-025/sig.png', NOW() - INTERVAL '5 days 6 hours'),
  ('70000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-00000000001a', 'Shift A', 'pass', 27.30, 51.00, 1.68, '[{"item_id":"chk-1","label":"Hydraulic System Pressure within 45 - 55 Bar","status":"pass","value":"51.00"},{"item_id":"chk-2","label":"Spindle Chiller Unit Operating Temperature (18C - 24C)","status":"pass","value":"27.30"},{"item_id":"chk-3","label":"Visual Check: No hydraulic fluid pooling or line leaks","status":"pass"},{"item_id":"chk-4","label":"Emergency Stop & Safety Enclosure Interlock Operational","status":"pass"},{"item_id":"chk-5","label":"Automatic Way Lube Lubrication Reservoir Level Nominal","status":"pass"}]'::jsonb, 'https://signatures.jcb-cmms.internal/operators/EMP-MAH-026/sig.png', NOW() - INTERVAL '4 days 6 hours'),
  ('70000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-00000000001b', 'Shift A', 'flagged', 28.10, 51.50, 1.76, '[{"item_id":"chk-1","label":"Hydraulic System Pressure within 45 - 55 Bar","status":"pass","value":"51.50"},{"item_id":"chk-2","label":"Spindle Chiller Unit Operating Temperature (18C - 24C)","status":"pass","value":"28.10"},{"item_id":"chk-3","label":"Visual Check: No hydraulic fluid pooling or line leaks","status":"pass"},{"item_id":"chk-4","label":"Emergency Stop & Safety Enclosure Interlock Operational","status":"pass"},{"item_id":"chk-5","label":"Automatic Way Lube Lubrication Reservoir Level Nominal","status":"pass"}]'::jsonb, 'https://signatures.jcb-cmms.internal/operators/EMP-MAH-027/sig.png', NOW() - INTERVAL '3 days 6 hours'),
  ('70000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000008', 'f0000000-0000-0000-0000-00000000001c', 'Shift A', 'pass', 28.90, 52.00, 1.84, '[{"item_id":"chk-1","label":"Hydraulic System Pressure within 45 - 55 Bar","status":"pass","value":"52.00"},{"item_id":"chk-2","label":"Spindle Chiller Unit Operating Temperature (18C - 24C)","status":"pass","value":"28.90"},{"item_id":"chk-3","label":"Visual Check: No hydraulic fluid pooling or line leaks","status":"pass"},{"item_id":"chk-4","label":"Emergency Stop & Safety Enclosure Interlock Operational","status":"pass"},{"item_id":"chk-5","label":"Automatic Way Lube Lubrication Reservoir Level Nominal","status":"pass"}]'::jsonb, 'https://signatures.jcb-cmms.internal/operators/EMP-MAH-028/sig.png', NOW() - INTERVAL '2 days 6 hours'),
  ('70000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000009', 'f0000000-0000-0000-0000-00000000001d', 'Shift A', 'pass', 29.70, 52.50, 1.92, '[{"item_id":"chk-1","label":"Hydraulic System Pressure within 45 - 55 Bar","status":"pass","value":"52.50"},{"item_id":"chk-2","label":"Spindle Chiller Unit Operating Temperature (18C - 24C)","status":"pass","value":"29.70"},{"item_id":"chk-3","label":"Visual Check: No hydraulic fluid pooling or line leaks","status":"pass"},{"item_id":"chk-4","label":"Emergency Stop & Safety Enclosure Interlock Operational","status":"pass"},{"item_id":"chk-5","label":"Automatic Way Lube Lubrication Reservoir Level Nominal","status":"pass"}]'::jsonb, 'https://signatures.jcb-cmms.internal/operators/EMP-MAH-029/sig.png', NOW() - INTERVAL '1 days 6 hours'),
  ('70000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', 'f0000000-0000-0000-0000-00000000001e', 'Shift A', 'pass', 30.50, 53.00, 2.00, '[{"item_id":"chk-1","label":"Hydraulic System Pressure within 45 - 55 Bar","status":"pass","value":"53.00"},{"item_id":"chk-2","label":"Spindle Chiller Unit Operating Temperature (18C - 24C)","status":"pass","value":"30.50"},{"item_id":"chk-3","label":"Visual Check: No hydraulic fluid pooling or line leaks","status":"pass"},{"item_id":"chk-4","label":"Emergency Stop & Safety Enclosure Interlock Operational","status":"pass"},{"item_id":"chk-5","label":"Automatic Way Lube Lubrication Reservoir Level Nominal","status":"pass"}]'::jsonb, 'https://signatures.jcb-cmms.internal/operators/EMP-MAH-030/sig.png', NOW() - INTERVAL '0 days 6 hours'),
  ('70000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-00000000000b', 'f0000000-0000-0000-0000-000000000015', 'Shift A', 'pass', 31.30, 53.50, 2.08, '[{"item_id":"chk-1","label":"Hydraulic System Pressure within 45 - 55 Bar","status":"pass","value":"53.50"},{"item_id":"chk-2","label":"Spindle Chiller Unit Operating Temperature (18C - 24C)","status":"pass","value":"31.30"},{"item_id":"chk-3","label":"Visual Check: No hydraulic fluid pooling or line leaks","status":"pass"},{"item_id":"chk-4","label":"Emergency Stop & Safety Enclosure Interlock Operational","status":"pass"},{"item_id":"chk-5","label":"Automatic Way Lube Lubrication Reservoir Level Nominal","status":"pass"}]'::jsonb, 'https://signatures.jcb-cmms.internal/operators/EMP-MAH-021/sig.png', NOW() - INTERVAL '9 days 6 hours'),
  ('70000000-0000-0000-0000-00000000000c', '20000000-0000-0000-0000-00000000000c', 'f0000000-0000-0000-0000-000000000016', 'Shift A', 'pass', 32.10, 54.00, 2.16, '[{"item_id":"chk-1","label":"Hydraulic System Pressure within 45 - 55 Bar","status":"pass","value":"54.00"},{"item_id":"chk-2","label":"Spindle Chiller Unit Operating Temperature (18C - 24C)","status":"pass","value":"32.10"},{"item_id":"chk-3","label":"Visual Check: No hydraulic fluid pooling or line leaks","status":"pass"},{"item_id":"chk-4","label":"Emergency Stop & Safety Enclosure Interlock Operational","status":"pass"},{"item_id":"chk-5","label":"Automatic Way Lube Lubrication Reservoir Level Nominal","status":"pass"}]'::jsonb, 'https://signatures.jcb-cmms.internal/operators/EMP-MAH-022/sig.png', NOW() - INTERVAL '8 days 6 hours'),
  ('70000000-0000-0000-0000-00000000000d', '20000000-0000-0000-0000-00000000000d', 'f0000000-0000-0000-0000-000000000017', 'Shift A', 'pass', 32.90, 54.50, 2.24, '[{"item_id":"chk-1","label":"Hydraulic System Pressure within 45 - 55 Bar","status":"pass","value":"54.50"},{"item_id":"chk-2","label":"Spindle Chiller Unit Operating Temperature (18C - 24C)","status":"pass","value":"32.90"},{"item_id":"chk-3","label":"Visual Check: No hydraulic fluid pooling or line leaks","status":"pass"},{"item_id":"chk-4","label":"Emergency Stop & Safety Enclosure Interlock Operational","status":"pass"},{"item_id":"chk-5","label":"Automatic Way Lube Lubrication Reservoir Level Nominal","status":"pass"}]'::jsonb, 'https://signatures.jcb-cmms.internal/operators/EMP-MAH-023/sig.png', NOW() - INTERVAL '7 days 6 hours'),
  ('70000000-0000-0000-0000-00000000000e', '20000000-0000-0000-0000-00000000000e', 'f0000000-0000-0000-0000-000000000018', 'Shift A', 'pass', 33.70, 55.00, 2.32, '[{"item_id":"chk-1","label":"Hydraulic System Pressure within 45 - 55 Bar","status":"pass","value":"55.00"},{"item_id":"chk-2","label":"Spindle Chiller Unit Operating Temperature (18C - 24C)","status":"pass","value":"33.70"},{"item_id":"chk-3","label":"Visual Check: No hydraulic fluid pooling or line leaks","status":"pass"},{"item_id":"chk-4","label":"Emergency Stop & Safety Enclosure Interlock Operational","status":"pass"},{"item_id":"chk-5","label":"Automatic Way Lube Lubrication Reservoir Level Nominal","status":"pass"}]'::jsonb, 'https://signatures.jcb-cmms.internal/operators/EMP-MAH-024/sig.png', NOW() - INTERVAL '6 days 6 hours'),
  ('70000000-0000-0000-0000-00000000000f', '20000000-0000-0000-0000-00000000000f', 'f0000000-0000-0000-0000-000000000019', 'Shift A', 'fail', 34.50, 55.50, 2.40, '[{"item_id":"chk-1","label":"Hydraulic System Pressure within 45 - 55 Bar","status":"pass","value":"55.50"},{"item_id":"chk-2","label":"Spindle Chiller Unit Operating Temperature (18C - 24C)","status":"pass","value":"34.50"},{"item_id":"chk-3","label":"Visual Check: No hydraulic fluid pooling or line leaks","status":"fail"},{"item_id":"chk-4","label":"Emergency Stop & Safety Enclosure Interlock Operational","status":"pass"},{"item_id":"chk-5","label":"Automatic Way Lube Lubrication Reservoir Level Nominal","status":"pass"}]'::jsonb, 'https://signatures.jcb-cmms.internal/operators/EMP-MAH-025/sig.png', NOW() - INTERVAL '5 days 6 hours'),
  ('70000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000010', 'f0000000-0000-0000-0000-00000000001a', 'Shift A', 'pass', 35.30, 56.00, 2.48, '[{"item_id":"chk-1","label":"Hydraulic System Pressure within 45 - 55 Bar","status":"pass","value":"56.00"},{"item_id":"chk-2","label":"Spindle Chiller Unit Operating Temperature (18C - 24C)","status":"pass","value":"35.30"},{"item_id":"chk-3","label":"Visual Check: No hydraulic fluid pooling or line leaks","status":"pass"},{"item_id":"chk-4","label":"Emergency Stop & Safety Enclosure Interlock Operational","status":"pass"},{"item_id":"chk-5","label":"Automatic Way Lube Lubrication Reservoir Level Nominal","status":"pass"}]'::jsonb, 'https://signatures.jcb-cmms.internal/operators/EMP-MAH-026/sig.png', NOW() - INTERVAL '4 days 6 hours'),
  ('70000000-0000-0000-0000-000000000011', '20000000-0000-0000-0000-000000000011', 'f0000000-0000-0000-0000-00000000001b', 'Shift A', 'pass', 36.10, 56.50, 2.56, '[{"item_id":"chk-1","label":"Hydraulic System Pressure within 45 - 55 Bar","status":"pass","value":"56.50"},{"item_id":"chk-2","label":"Spindle Chiller Unit Operating Temperature (18C - 24C)","status":"pass","value":"36.10"},{"item_id":"chk-3","label":"Visual Check: No hydraulic fluid pooling or line leaks","status":"pass"},{"item_id":"chk-4","label":"Emergency Stop & Safety Enclosure Interlock Operational","status":"pass"},{"item_id":"chk-5","label":"Automatic Way Lube Lubrication Reservoir Level Nominal","status":"pass"}]'::jsonb, 'https://signatures.jcb-cmms.internal/operators/EMP-MAH-027/sig.png', NOW() - INTERVAL '3 days 6 hours'),
  ('70000000-0000-0000-0000-000000000012', '20000000-0000-0000-0000-000000000012', 'f0000000-0000-0000-0000-00000000001c', 'Shift A', 'pass', 36.90, 57.00, 2.64, '[{"item_id":"chk-1","label":"Hydraulic System Pressure within 45 - 55 Bar","status":"pass","value":"57.00"},{"item_id":"chk-2","label":"Spindle Chiller Unit Operating Temperature (18C - 24C)","status":"pass","value":"36.90"},{"item_id":"chk-3","label":"Visual Check: No hydraulic fluid pooling or line leaks","status":"pass"},{"item_id":"chk-4","label":"Emergency Stop & Safety Enclosure Interlock Operational","status":"pass"},{"item_id":"chk-5","label":"Automatic Way Lube Lubrication Reservoir Level Nominal","status":"pass"}]'::jsonb, 'https://signatures.jcb-cmms.internal/operators/EMP-MAH-028/sig.png', NOW() - INTERVAL '2 days 6 hours'),
  ('70000000-0000-0000-0000-000000000013', '20000000-0000-0000-0000-000000000013', 'f0000000-0000-0000-0000-00000000001d', 'Shift A', 'pass', 37.70, 57.50, 2.72, '[{"item_id":"chk-1","label":"Hydraulic System Pressure within 45 - 55 Bar","status":"pass","value":"57.50"},{"item_id":"chk-2","label":"Spindle Chiller Unit Operating Temperature (18C - 24C)","status":"pass","value":"37.70"},{"item_id":"chk-3","label":"Visual Check: No hydraulic fluid pooling or line leaks","status":"pass"},{"item_id":"chk-4","label":"Emergency Stop & Safety Enclosure Interlock Operational","status":"pass"},{"item_id":"chk-5","label":"Automatic Way Lube Lubrication Reservoir Level Nominal","status":"pass"}]'::jsonb, 'https://signatures.jcb-cmms.internal/operators/EMP-MAH-029/sig.png', NOW() - INTERVAL '1 days 6 hours'),
  ('70000000-0000-0000-0000-000000000014', '20000000-0000-0000-0000-000000000014', 'f0000000-0000-0000-0000-00000000001e', 'Shift A', 'pass', 38.50, 58.00, 2.80, '[{"item_id":"chk-1","label":"Hydraulic System Pressure within 45 - 55 Bar","status":"pass","value":"58.00"},{"item_id":"chk-2","label":"Spindle Chiller Unit Operating Temperature (18C - 24C)","status":"pass","value":"38.50"},{"item_id":"chk-3","label":"Visual Check: No hydraulic fluid pooling or line leaks","status":"pass"},{"item_id":"chk-4","label":"Emergency Stop & Safety Enclosure Interlock Operational","status":"pass"},{"item_id":"chk-5","label":"Automatic Way Lube Lubrication Reservoir Level Nominal","status":"pass"}]'::jsonb, 'https://signatures.jcb-cmms.internal/operators/EMP-MAH-030/sig.png', NOW() - INTERVAL '0 days 6 hours'),
  ('70000000-0000-0000-0000-000000000015', '20000000-0000-0000-0000-000000000015', 'f0000000-0000-0000-0000-000000000015', 'Shift A', 'pass', 39.30, 58.50, 2.88, '[{"item_id":"chk-1","label":"Hydraulic System Pressure within 45 - 55 Bar","status":"pass","value":"58.50"},{"item_id":"chk-2","label":"Spindle Chiller Unit Operating Temperature (18C - 24C)","status":"pass","value":"39.30"},{"item_id":"chk-3","label":"Visual Check: No hydraulic fluid pooling or line leaks","status":"pass"},{"item_id":"chk-4","label":"Emergency Stop & Safety Enclosure Interlock Operational","status":"pass"},{"item_id":"chk-5","label":"Automatic Way Lube Lubrication Reservoir Level Nominal","status":"pass"}]'::jsonb, 'https://signatures.jcb-cmms.internal/operators/EMP-MAH-021/sig.png', NOW() - INTERVAL '9 days 6 hours'),
  ('70000000-0000-0000-0000-000000000016', '20000000-0000-0000-0000-000000000016', 'f0000000-0000-0000-0000-000000000016', 'Shift A', 'pass', 40.10, 59.00, 2.96, '[{"item_id":"chk-1","label":"Hydraulic System Pressure within 45 - 55 Bar","status":"pass","value":"59.00"},{"item_id":"chk-2","label":"Spindle Chiller Unit Operating Temperature (18C - 24C)","status":"pass","value":"40.10"},{"item_id":"chk-3","label":"Visual Check: No hydraulic fluid pooling or line leaks","status":"pass"},{"item_id":"chk-4","label":"Emergency Stop & Safety Enclosure Interlock Operational","status":"pass"},{"item_id":"chk-5","label":"Automatic Way Lube Lubrication Reservoir Level Nominal","status":"pass"}]'::jsonb, 'https://signatures.jcb-cmms.internal/operators/EMP-MAH-022/sig.png', NOW() - INTERVAL '8 days 6 hours'),
  ('70000000-0000-0000-0000-000000000017', '20000000-0000-0000-0000-000000000017', 'f0000000-0000-0000-0000-000000000017', 'Shift A', 'pass', 40.90, 59.50, 3.04, '[{"item_id":"chk-1","label":"Hydraulic System Pressure within 45 - 55 Bar","status":"pass","value":"59.50"},{"item_id":"chk-2","label":"Spindle Chiller Unit Operating Temperature (18C - 24C)","status":"pass","value":"40.90"},{"item_id":"chk-3","label":"Visual Check: No hydraulic fluid pooling or line leaks","status":"pass"},{"item_id":"chk-4","label":"Emergency Stop & Safety Enclosure Interlock Operational","status":"pass"},{"item_id":"chk-5","label":"Automatic Way Lube Lubrication Reservoir Level Nominal","status":"pass"}]'::jsonb, 'https://signatures.jcb-cmms.internal/operators/EMP-MAH-023/sig.png', NOW() - INTERVAL '7 days 6 hours'),
  ('70000000-0000-0000-0000-000000000018', '20000000-0000-0000-0000-000000000018', 'f0000000-0000-0000-0000-000000000018', 'Shift A', 'pass', 41.70, 60.00, 3.12, '[{"item_id":"chk-1","label":"Hydraulic System Pressure within 45 - 55 Bar","status":"pass","value":"60.00"},{"item_id":"chk-2","label":"Spindle Chiller Unit Operating Temperature (18C - 24C)","status":"pass","value":"41.70"},{"item_id":"chk-3","label":"Visual Check: No hydraulic fluid pooling or line leaks","status":"pass"},{"item_id":"chk-4","label":"Emergency Stop & Safety Enclosure Interlock Operational","status":"pass"},{"item_id":"chk-5","label":"Automatic Way Lube Lubrication Reservoir Level Nominal","status":"pass"}]'::jsonb, 'https://signatures.jcb-cmms.internal/operators/EMP-MAH-024/sig.png', NOW() - INTERVAL '6 days 6 hours'),
  ('70000000-0000-0000-0000-000000000019', '20000000-0000-0000-0000-000000000019', 'f0000000-0000-0000-0000-000000000019', 'Shift A', 'pass', 42.50, 60.50, 3.20, '[{"item_id":"chk-1","label":"Hydraulic System Pressure within 45 - 55 Bar","status":"pass","value":"60.50"},{"item_id":"chk-2","label":"Spindle Chiller Unit Operating Temperature (18C - 24C)","status":"pass","value":"42.50"},{"item_id":"chk-3","label":"Visual Check: No hydraulic fluid pooling or line leaks","status":"pass"},{"item_id":"chk-4","label":"Emergency Stop & Safety Enclosure Interlock Operational","status":"pass"},{"item_id":"chk-5","label":"Automatic Way Lube Lubrication Reservoir Level Nominal","status":"pass"}]'::jsonb, 'https://signatures.jcb-cmms.internal/operators/EMP-MAH-025/sig.png', NOW() - INTERVAL '5 days 6 hours'),
  ('70000000-0000-0000-0000-00000000001a', '20000000-0000-0000-0000-00000000001a', 'f0000000-0000-0000-0000-00000000001a', 'Shift A', 'pass', 43.30, 61.00, 3.28, '[{"item_id":"chk-1","label":"Hydraulic System Pressure within 45 - 55 Bar","status":"pass","value":"61.00"},{"item_id":"chk-2","label":"Spindle Chiller Unit Operating Temperature (18C - 24C)","status":"pass","value":"43.30"},{"item_id":"chk-3","label":"Visual Check: No hydraulic fluid pooling or line leaks","status":"pass"},{"item_id":"chk-4","label":"Emergency Stop & Safety Enclosure Interlock Operational","status":"pass"},{"item_id":"chk-5","label":"Automatic Way Lube Lubrication Reservoir Level Nominal","status":"pass"}]'::jsonb, 'https://signatures.jcb-cmms.internal/operators/EMP-MAH-026/sig.png', NOW() - INTERVAL '4 days 6 hours'),
  ('70000000-0000-0000-0000-00000000001b', '20000000-0000-0000-0000-00000000001b', 'f0000000-0000-0000-0000-00000000001b', 'Shift A', 'pass', 44.10, 61.50, 3.36, '[{"item_id":"chk-1","label":"Hydraulic System Pressure within 45 - 55 Bar","status":"pass","value":"61.50"},{"item_id":"chk-2","label":"Spindle Chiller Unit Operating Temperature (18C - 24C)","status":"pass","value":"44.10"},{"item_id":"chk-3","label":"Visual Check: No hydraulic fluid pooling or line leaks","status":"pass"},{"item_id":"chk-4","label":"Emergency Stop & Safety Enclosure Interlock Operational","status":"pass"},{"item_id":"chk-5","label":"Automatic Way Lube Lubrication Reservoir Level Nominal","status":"pass"}]'::jsonb, 'https://signatures.jcb-cmms.internal/operators/EMP-MAH-027/sig.png', NOW() - INTERVAL '3 days 6 hours'),
  ('70000000-0000-0000-0000-00000000001c', '20000000-0000-0000-0000-00000000001c', 'f0000000-0000-0000-0000-00000000001c', 'Shift A', 'pass', 44.90, 62.00, 3.44, '[{"item_id":"chk-1","label":"Hydraulic System Pressure within 45 - 55 Bar","status":"pass","value":"62.00"},{"item_id":"chk-2","label":"Spindle Chiller Unit Operating Temperature (18C - 24C)","status":"pass","value":"44.90"},{"item_id":"chk-3","label":"Visual Check: No hydraulic fluid pooling or line leaks","status":"pass"},{"item_id":"chk-4","label":"Emergency Stop & Safety Enclosure Interlock Operational","status":"pass"},{"item_id":"chk-5","label":"Automatic Way Lube Lubrication Reservoir Level Nominal","status":"pass"}]'::jsonb, 'https://signatures.jcb-cmms.internal/operators/EMP-MAH-028/sig.png', NOW() - INTERVAL '2 days 6 hours'),
  ('70000000-0000-0000-0000-00000000001d', '20000000-0000-0000-0000-00000000001d', 'f0000000-0000-0000-0000-00000000001d', 'Shift A', 'pass', 45.70, 62.50, 3.52, '[{"item_id":"chk-1","label":"Hydraulic System Pressure within 45 - 55 Bar","status":"pass","value":"62.50"},{"item_id":"chk-2","label":"Spindle Chiller Unit Operating Temperature (18C - 24C)","status":"pass","value":"45.70"},{"item_id":"chk-3","label":"Visual Check: No hydraulic fluid pooling or line leaks","status":"pass"},{"item_id":"chk-4","label":"Emergency Stop & Safety Enclosure Interlock Operational","status":"pass"},{"item_id":"chk-5","label":"Automatic Way Lube Lubrication Reservoir Level Nominal","status":"pass"}]'::jsonb, 'https://signatures.jcb-cmms.internal/operators/EMP-MAH-029/sig.png', NOW() - INTERVAL '1 days 6 hours'),
  ('70000000-0000-0000-0000-00000000001e', '20000000-0000-0000-0000-00000000001e', 'f0000000-0000-0000-0000-00000000001e', 'Shift A', 'pass', 46.50, 63.00, 3.60, '[{"item_id":"chk-1","label":"Hydraulic System Pressure within 45 - 55 Bar","status":"pass","value":"63.00"},{"item_id":"chk-2","label":"Spindle Chiller Unit Operating Temperature (18C - 24C)","status":"pass","value":"46.50"},{"item_id":"chk-3","label":"Visual Check: No hydraulic fluid pooling or line leaks","status":"pass"},{"item_id":"chk-4","label":"Emergency Stop & Safety Enclosure Interlock Operational","status":"pass"},{"item_id":"chk-5","label":"Automatic Way Lube Lubrication Reservoir Level Nominal","status":"pass"}]'::jsonb, 'https://signatures.jcb-cmms.internal/operators/EMP-MAH-030/sig.png', NOW() - INTERVAL '0 days 6 hours')
ON CONFLICT (id) DO NOTHING;

-- 10. 30 Preventive Maintenance (PM) Plans
INSERT INTO pm_plans (
  id, plan_code, machine_id, title, frequency, interval_days, operating_hour_threshold, checklist_template, last_pm_date, next_pm_date, grace_period_days, is_active
) VALUES
  ('80000000-0000-0000-0000-000000000001', 'PM-PLAN-001', '20000000-0000-0000-0000-000000000001', 'PM Plan - Mazak Horizontal Machining Center HCN-6800 NEO #1 (WEEKLY)', 'weekly', 7, 300.00, '[{"step":1,"task":"Clean and inspect hydraulic suction strainer and magnetic plug","tool":"Solvent & Lint-Free Cloth"},{"step":2,"task":"Measure spindle runout using dial test indicator (Tolerance < 0.003mm)","tool":"Mitutoyo 0.001mm DTI"},{"step":3,"task":"Torque check anchor bolts and foundation vibration dampeners","tool":"Torque Wrench 250Nm"},{"step":4,"task":"Verify safety interlock switches, emergency stop relays and door switches","tool":"Multimeter"},{"step":5,"task":"Top up central automatic grease lubrication reservoir with EP2 grease","tool":"Grease Pump"}]'::jsonb, '2026-10-15', CURRENT_DATE + INTERVAL '6 days', 3, TRUE),
  ('80000000-0000-0000-0000-000000000002', 'PM-PLAN-002', '20000000-0000-0000-0000-000000000002', 'PM Plan - Mazak Horizontal Machining Center HCN-6800 NEO #2 (MONTHLY)', 'monthly', 30, 350.00, '[{"step":1,"task":"Clean and inspect hydraulic suction strainer and magnetic plug","tool":"Solvent & Lint-Free Cloth"},{"step":2,"task":"Measure spindle runout using dial test indicator (Tolerance < 0.003mm)","tool":"Mitutoyo 0.001mm DTI"},{"step":3,"task":"Torque check anchor bolts and foundation vibration dampeners","tool":"Torque Wrench 250Nm"},{"step":4,"task":"Verify safety interlock switches, emergency stop relays and door switches","tool":"Multimeter"},{"step":5,"task":"Top up central automatic grease lubrication reservoir with EP2 grease","tool":"Grease Pump"}]'::jsonb, '2026-10-15', CURRENT_DATE + INTERVAL '7 days', 3, TRUE),
  ('80000000-0000-0000-0000-000000000003', 'PM-PLAN-003', '20000000-0000-0000-0000-000000000003', 'PM Plan - Makino Vertical Machining Center V99 Heavy Milling (WEEKLY)', 'weekly', 7, 400.00, '[{"step":1,"task":"Clean and inspect hydraulic suction strainer and magnetic plug","tool":"Solvent & Lint-Free Cloth"},{"step":2,"task":"Measure spindle runout using dial test indicator (Tolerance < 0.003mm)","tool":"Mitutoyo 0.001mm DTI"},{"step":3,"task":"Torque check anchor bolts and foundation vibration dampeners","tool":"Torque Wrench 250Nm"},{"step":4,"task":"Verify safety interlock switches, emergency stop relays and door switches","tool":"Multimeter"},{"step":5,"task":"Top up central automatic grease lubrication reservoir with EP2 grease","tool":"Grease Pump"}]'::jsonb, '2026-10-15', CURRENT_DATE + INTERVAL '8 days', 3, TRUE),
  ('80000000-0000-0000-0000-000000000004', 'PM-PLAN-004', '20000000-0000-0000-0000-000000000004', 'PM Plan - Doosan DNM 6700 High Productivity VMC (QUARTERLY)', 'quarterly', 90, 450.00, '[{"step":1,"task":"Clean and inspect hydraulic suction strainer and magnetic plug","tool":"Solvent & Lint-Free Cloth"},{"step":2,"task":"Measure spindle runout using dial test indicator (Tolerance < 0.003mm)","tool":"Mitutoyo 0.001mm DTI"},{"step":3,"task":"Torque check anchor bolts and foundation vibration dampeners","tool":"Torque Wrench 250Nm"},{"step":4,"task":"Verify safety interlock switches, emergency stop relays and door switches","tool":"Multimeter"},{"step":5,"task":"Top up central automatic grease lubrication reservoir with EP2 grease","tool":"Grease Pump"}]'::jsonb, '2026-10-15', CURRENT_DATE + INTERVAL '9 days', 3, TRUE),
  ('80000000-0000-0000-0000-000000000005', 'PM-PLAN-005', '20000000-0000-0000-0000-000000000005', 'PM Plan - Okuma Multus U4000 Intelligent CNC Turning Center (WEEKLY)', 'weekly', 7, 500.00, '[{"step":1,"task":"Clean and inspect hydraulic suction strainer and magnetic plug","tool":"Solvent & Lint-Free Cloth"},{"step":2,"task":"Measure spindle runout using dial test indicator (Tolerance < 0.003mm)","tool":"Mitutoyo 0.001mm DTI"},{"step":3,"task":"Torque check anchor bolts and foundation vibration dampeners","tool":"Torque Wrench 250Nm"},{"step":4,"task":"Verify safety interlock switches, emergency stop relays and door switches","tool":"Multimeter"},{"step":5,"task":"Top up central automatic grease lubrication reservoir with EP2 grease","tool":"Grease Pump"}]'::jsonb, '2026-10-15', CURRENT_DATE + INTERVAL '10 days', 3, TRUE),
  ('80000000-0000-0000-0000-000000000006', 'PM-PLAN-006', '20000000-0000-0000-0000-000000000006', 'PM Plan - Fanuc ARC Mate 120iD 6-Axis Boom Welding Robot #1 (MONTHLY)', 'monthly', 30, 550.00, '[{"step":1,"task":"Clean and inspect hydraulic suction strainer and magnetic plug","tool":"Solvent & Lint-Free Cloth"},{"step":2,"task":"Measure spindle runout using dial test indicator (Tolerance < 0.003mm)","tool":"Mitutoyo 0.001mm DTI"},{"step":3,"task":"Torque check anchor bolts and foundation vibration dampeners","tool":"Torque Wrench 250Nm"},{"step":4,"task":"Verify safety interlock switches, emergency stop relays and door switches","tool":"Multimeter"},{"step":5,"task":"Top up central automatic grease lubrication reservoir with EP2 grease","tool":"Grease Pump"}]'::jsonb, '2026-10-15', CURRENT_DATE + INTERVAL '11 days', 3, TRUE),
  ('80000000-0000-0000-0000-000000000007', 'PM-PLAN-007', '20000000-0000-0000-0000-000000000007', 'PM Plan - Fanuc ARC Mate 120iD 6-Axis Dipper Welding Robot #2 (WEEKLY)', 'weekly', 7, 600.00, '[{"step":1,"task":"Clean and inspect hydraulic suction strainer and magnetic plug","tool":"Solvent & Lint-Free Cloth"},{"step":2,"task":"Measure spindle runout using dial test indicator (Tolerance < 0.003mm)","tool":"Mitutoyo 0.001mm DTI"},{"step":3,"task":"Torque check anchor bolts and foundation vibration dampeners","tool":"Torque Wrench 250Nm"},{"step":4,"task":"Verify safety interlock switches, emergency stop relays and door switches","tool":"Multimeter"},{"step":5,"task":"Top up central automatic grease lubrication reservoir with EP2 grease","tool":"Grease Pump"}]'::jsonb, '2026-10-15', CURRENT_DATE + INTERVAL '12 days', 3, TRUE),
  ('80000000-0000-0000-0000-000000000008', 'PM-PLAN-008', '20000000-0000-0000-0000-000000000008', 'PM Plan - ABB IRB 6700 Heavy Spot & Seam Welding Robot (QUARTERLY)', 'quarterly', 90, 650.00, '[{"step":1,"task":"Clean and inspect hydraulic suction strainer and magnetic plug","tool":"Solvent & Lint-Free Cloth"},{"step":2,"task":"Measure spindle runout using dial test indicator (Tolerance < 0.003mm)","tool":"Mitutoyo 0.001mm DTI"},{"step":3,"task":"Torque check anchor bolts and foundation vibration dampeners","tool":"Torque Wrench 250Nm"},{"step":4,"task":"Verify safety interlock switches, emergency stop relays and door switches","tool":"Multimeter"},{"step":5,"task":"Top up central automatic grease lubrication reservoir with EP2 grease","tool":"Grease Pump"}]'::jsonb, '2026-10-15', CURRENT_DATE + INTERVAL '13 days', 3, TRUE),
  ('80000000-0000-0000-0000-000000000009', 'PM-PLAN-009', '20000000-0000-0000-0000-000000000009', 'PM Plan - KUKA KR 300 R2500 Heavy Frame Welding Cell (WEEKLY)', 'weekly', 7, 700.00, '[{"step":1,"task":"Clean and inspect hydraulic suction strainer and magnetic plug","tool":"Solvent & Lint-Free Cloth"},{"step":2,"task":"Measure spindle runout using dial test indicator (Tolerance < 0.003mm)","tool":"Mitutoyo 0.001mm DTI"},{"step":3,"task":"Torque check anchor bolts and foundation vibration dampeners","tool":"Torque Wrench 250Nm"},{"step":4,"task":"Verify safety interlock switches, emergency stop relays and door switches","tool":"Multimeter"},{"step":5,"task":"Top up central automatic grease lubrication reservoir with EP2 grease","tool":"Grease Pump"}]'::jsonb, '2026-10-15', CURRENT_DATE + INTERVAL '14 days', 3, TRUE),
  ('80000000-0000-0000-0000-00000000000a', 'PM-PLAN-010', '20000000-0000-0000-0000-00000000000a', 'PM Plan - Schuler 1000T Hydraulic Deep-Draw Forming Press (MONTHLY)', 'monthly', 30, 750.00, '[{"step":1,"task":"Clean and inspect hydraulic suction strainer and magnetic plug","tool":"Solvent & Lint-Free Cloth"},{"step":2,"task":"Measure spindle runout using dial test indicator (Tolerance < 0.003mm)","tool":"Mitutoyo 0.001mm DTI"},{"step":3,"task":"Torque check anchor bolts and foundation vibration dampeners","tool":"Torque Wrench 250Nm"},{"step":4,"task":"Verify safety interlock switches, emergency stop relays and door switches","tool":"Multimeter"},{"step":5,"task":"Top up central automatic grease lubrication reservoir with EP2 grease","tool":"Grease Pump"}]'::jsonb, '2026-10-15', CURRENT_DATE + INTERVAL '15 days', 3, TRUE),
  ('80000000-0000-0000-0000-00000000000b', 'PM-PLAN-011', '20000000-0000-0000-0000-00000000000b', 'PM Plan - Komatsu 600T Mechanical Stamping Press (WEEKLY)', 'weekly', 7, 800.00, '[{"step":1,"task":"Clean and inspect hydraulic suction strainer and magnetic plug","tool":"Solvent & Lint-Free Cloth"},{"step":2,"task":"Measure spindle runout using dial test indicator (Tolerance < 0.003mm)","tool":"Mitutoyo 0.001mm DTI"},{"step":3,"task":"Torque check anchor bolts and foundation vibration dampeners","tool":"Torque Wrench 250Nm"},{"step":4,"task":"Verify safety interlock switches, emergency stop relays and door switches","tool":"Multimeter"},{"step":5,"task":"Top up central automatic grease lubrication reservoir with EP2 grease","tool":"Grease Pump"}]'::jsonb, '2026-10-15', CURRENT_DATE + INTERVAL '16 days', 3, TRUE),
  ('80000000-0000-0000-0000-00000000000c', 'PM-PLAN-012', '20000000-0000-0000-0000-00000000000c', 'PM Plan - Aida 400T Progressive Die Stamping Press (QUARTERLY)', 'quarterly', 90, 850.00, '[{"step":1,"task":"Clean and inspect hydraulic suction strainer and magnetic plug","tool":"Solvent & Lint-Free Cloth"},{"step":2,"task":"Measure spindle runout using dial test indicator (Tolerance < 0.003mm)","tool":"Mitutoyo 0.001mm DTI"},{"step":3,"task":"Torque check anchor bolts and foundation vibration dampeners","tool":"Torque Wrench 250Nm"},{"step":4,"task":"Verify safety interlock switches, emergency stop relays and door switches","tool":"Multimeter"},{"step":5,"task":"Top up central automatic grease lubrication reservoir with EP2 grease","tool":"Grease Pump"}]'::jsonb, '2026-10-15', CURRENT_DATE + INTERVAL '17 days', 3, TRUE),
  ('80000000-0000-0000-0000-00000000000d', 'PM-PLAN-013', '20000000-0000-0000-0000-00000000000d', 'PM Plan - Trumpf TruLaser 5030 Fiber 10kW CNC Laser Cutter (WEEKLY)', 'weekly', 7, 900.00, '[{"step":1,"task":"Clean and inspect hydraulic suction strainer and magnetic plug","tool":"Solvent & Lint-Free Cloth"},{"step":2,"task":"Measure spindle runout using dial test indicator (Tolerance < 0.003mm)","tool":"Mitutoyo 0.001mm DTI"},{"step":3,"task":"Torque check anchor bolts and foundation vibration dampeners","tool":"Torque Wrench 250Nm"},{"step":4,"task":"Verify safety interlock switches, emergency stop relays and door switches","tool":"Multimeter"},{"step":5,"task":"Top up central automatic grease lubrication reservoir with EP2 grease","tool":"Grease Pump"}]'::jsonb, '2026-10-15', CURRENT_DATE + INTERVAL '18 days', 3, TRUE),
  ('80000000-0000-0000-0000-00000000000e', 'PM-PLAN-014', '20000000-0000-0000-0000-00000000000e', 'PM Plan - Bystronic ByStar Fiber 12kW Heavy Sheet Laser (MONTHLY)', 'monthly', 30, 950.00, '[{"step":1,"task":"Clean and inspect hydraulic suction strainer and magnetic plug","tool":"Solvent & Lint-Free Cloth"},{"step":2,"task":"Measure spindle runout using dial test indicator (Tolerance < 0.003mm)","tool":"Mitutoyo 0.001mm DTI"},{"step":3,"task":"Torque check anchor bolts and foundation vibration dampeners","tool":"Torque Wrench 250Nm"},{"step":4,"task":"Verify safety interlock switches, emergency stop relays and door switches","tool":"Multimeter"},{"step":5,"task":"Top up central automatic grease lubrication reservoir with EP2 grease","tool":"Grease Pump"}]'::jsonb, '2026-10-15', CURRENT_DATE + INTERVAL '19 days', 3, TRUE),
  ('80000000-0000-0000-0000-00000000000f', 'PM-PLAN-015', '20000000-0000-0000-0000-00000000000f', 'PM Plan - Messer MultiTherm Heavy CNC Plasma & Oxy-Fuel Cutting Gantry (WEEKLY)', 'weekly', 7, 1000.00, '[{"step":1,"task":"Clean and inspect hydraulic suction strainer and magnetic plug","tool":"Solvent & Lint-Free Cloth"},{"step":2,"task":"Measure spindle runout using dial test indicator (Tolerance < 0.003mm)","tool":"Mitutoyo 0.001mm DTI"},{"step":3,"task":"Torque check anchor bolts and foundation vibration dampeners","tool":"Torque Wrench 250Nm"},{"step":4,"task":"Verify safety interlock switches, emergency stop relays and door switches","tool":"Multimeter"},{"step":5,"task":"Top up central automatic grease lubrication reservoir with EP2 grease","tool":"Grease Pump"}]'::jsonb, '2026-10-15', CURRENT_DATE + INTERVAL '20 days', 3, TRUE),
  ('80000000-0000-0000-0000-000000000010', 'PM-PLAN-016', '20000000-0000-0000-0000-000000000010', 'PM Plan - Gema OptiCenter Automated Powder Coating System (QUARTERLY)', 'quarterly', 90, 1050.00, '[{"step":1,"task":"Clean and inspect hydraulic suction strainer and magnetic plug","tool":"Solvent & Lint-Free Cloth"},{"step":2,"task":"Measure spindle runout using dial test indicator (Tolerance < 0.003mm)","tool":"Mitutoyo 0.001mm DTI"},{"step":3,"task":"Torque check anchor bolts and foundation vibration dampeners","tool":"Torque Wrench 250Nm"},{"step":4,"task":"Verify safety interlock switches, emergency stop relays and door switches","tool":"Multimeter"},{"step":5,"task":"Top up central automatic grease lubrication reservoir with EP2 grease","tool":"Grease Pump"}]'::jsonb, '2026-10-15', CURRENT_DATE + INTERVAL '21 days', 3, TRUE),
  ('80000000-0000-0000-0000-000000000011', 'PM-PLAN-017', '20000000-0000-0000-0000-000000000011', 'PM Plan - Eisenmann 12-Stage Zinc-Phosphating Pretreatment Dip Tunnel (WEEKLY)', 'weekly', 7, 1100.00, '[{"step":1,"task":"Clean and inspect hydraulic suction strainer and magnetic plug","tool":"Solvent & Lint-Free Cloth"},{"step":2,"task":"Measure spindle runout using dial test indicator (Tolerance < 0.003mm)","tool":"Mitutoyo 0.001mm DTI"},{"step":3,"task":"Torque check anchor bolts and foundation vibration dampeners","tool":"Torque Wrench 250Nm"},{"step":4,"task":"Verify safety interlock switches, emergency stop relays and door switches","tool":"Multimeter"},{"step":5,"task":"Top up central automatic grease lubrication reservoir with EP2 grease","tool":"Grease Pump"}]'::jsonb, '2026-10-15', CURRENT_DATE + INTERVAL '22 days', 3, TRUE),
  ('80000000-0000-0000-0000-000000000012', 'PM-PLAN-018', '20000000-0000-0000-0000-000000000012', 'PM Plan - Dürr EcoDry Oven High-Efficiency Convection Curing Oven (MONTHLY)', 'monthly', 30, 1150.00, '[{"step":1,"task":"Clean and inspect hydraulic suction strainer and magnetic plug","tool":"Solvent & Lint-Free Cloth"},{"step":2,"task":"Measure spindle runout using dial test indicator (Tolerance < 0.003mm)","tool":"Mitutoyo 0.001mm DTI"},{"step":3,"task":"Torque check anchor bolts and foundation vibration dampeners","tool":"Torque Wrench 250Nm"},{"step":4,"task":"Verify safety interlock switches, emergency stop relays and door switches","tool":"Multimeter"},{"step":5,"task":"Top up central automatic grease lubrication reservoir with EP2 grease","tool":"Grease Pump"}]'::jsonb, '2026-10-15', CURRENT_DATE + INTERVAL '23 days', 3, TRUE),
  ('80000000-0000-0000-0000-000000000013', 'PM-PLAN-019', '20000000-0000-0000-0000-000000000013', 'PM Plan - JCB Main Chassis Automated In-Line Carrier Conveyor (WEEKLY)', 'weekly', 7, 1200.00, '[{"step":1,"task":"Clean and inspect hydraulic suction strainer and magnetic plug","tool":"Solvent & Lint-Free Cloth"},{"step":2,"task":"Measure spindle runout using dial test indicator (Tolerance < 0.003mm)","tool":"Mitutoyo 0.001mm DTI"},{"step":3,"task":"Torque check anchor bolts and foundation vibration dampeners","tool":"Torque Wrench 250Nm"},{"step":4,"task":"Verify safety interlock switches, emergency stop relays and door switches","tool":"Multimeter"},{"step":5,"task":"Top up central automatic grease lubrication reservoir with EP2 grease","tool":"Grease Pump"}]'::jsonb, '2026-10-15', CURRENT_DATE + INTERVAL '24 days', 3, TRUE),
  ('80000000-0000-0000-0000-000000000014', 'PM-PLAN-020', '20000000-0000-0000-0000-000000000014', 'PM Plan - Atlas Copco Multi-Spindle Digital Torque Nutrunner Station (QUARTERLY)', 'quarterly', 90, 1250.00, '[{"step":1,"task":"Clean and inspect hydraulic suction strainer and magnetic plug","tool":"Solvent & Lint-Free Cloth"},{"step":2,"task":"Measure spindle runout using dial test indicator (Tolerance < 0.003mm)","tool":"Mitutoyo 0.001mm DTI"},{"step":3,"task":"Torque check anchor bolts and foundation vibration dampeners","tool":"Torque Wrench 250Nm"},{"step":4,"task":"Verify safety interlock switches, emergency stop relays and door switches","tool":"Multimeter"},{"step":5,"task":"Top up central automatic grease lubrication reservoir with EP2 grease","tool":"Grease Pump"}]'::jsonb, '2026-10-15', CURRENT_DATE + INTERVAL '25 days', 3, TRUE),
  ('80000000-0000-0000-0000-000000000015', 'PM-PLAN-021', '20000000-0000-0000-0000-000000000015', 'PM Plan - JCB Hydraulic Flushing & Oil Cleanliness Verification Rig (WEEKLY)', 'weekly', 7, 1300.00, '[{"step":1,"task":"Clean and inspect hydraulic suction strainer and magnetic plug","tool":"Solvent & Lint-Free Cloth"},{"step":2,"task":"Measure spindle runout using dial test indicator (Tolerance < 0.003mm)","tool":"Mitutoyo 0.001mm DTI"},{"step":3,"task":"Torque check anchor bolts and foundation vibration dampeners","tool":"Torque Wrench 250Nm"},{"step":4,"task":"Verify safety interlock switches, emergency stop relays and door switches","tool":"Multimeter"},{"step":5,"task":"Top up central automatic grease lubrication reservoir with EP2 grease","tool":"Grease Pump"}]'::jsonb, '2026-10-15', CURRENT_DATE + INTERVAL '26 days', 3, TRUE),
  ('80000000-0000-0000-0000-000000000016', 'PM-PLAN-022', '20000000-0000-0000-0000-000000000016', 'PM Plan - Rexroth Hydraulic Dynamic Cylinder End-of-Line Test Stand (MONTHLY)', 'monthly', 30, 1350.00, '[{"step":1,"task":"Clean and inspect hydraulic suction strainer and magnetic plug","tool":"Solvent & Lint-Free Cloth"},{"step":2,"task":"Measure spindle runout using dial test indicator (Tolerance < 0.003mm)","tool":"Mitutoyo 0.001mm DTI"},{"step":3,"task":"Torque check anchor bolts and foundation vibration dampeners","tool":"Torque Wrench 250Nm"},{"step":4,"task":"Verify safety interlock switches, emergency stop relays and door switches","tool":"Multimeter"},{"step":5,"task":"Top up central automatic grease lubrication reservoir with EP2 grease","tool":"Grease Pump"}]'::jsonb, '2026-10-15', CURRENT_DATE + INTERVAL '27 days', 3, TRUE),
  ('80000000-0000-0000-0000-000000000017', 'PM-PLAN-023', '20000000-0000-0000-0000-000000000017', 'PM Plan - JCB Dynamometer Heavy Powertrain Road Testing Rig (WEEKLY)', 'weekly', 7, 1400.00, '[{"step":1,"task":"Clean and inspect hydraulic suction strainer and magnetic plug","tool":"Solvent & Lint-Free Cloth"},{"step":2,"task":"Measure spindle runout using dial test indicator (Tolerance < 0.003mm)","tool":"Mitutoyo 0.001mm DTI"},{"step":3,"task":"Torque check anchor bolts and foundation vibration dampeners","tool":"Torque Wrench 250Nm"},{"step":4,"task":"Verify safety interlock switches, emergency stop relays and door switches","tool":"Multimeter"},{"step":5,"task":"Top up central automatic grease lubrication reservoir with EP2 grease","tool":"Grease Pump"}]'::jsonb, '2026-10-15', CURRENT_DATE + INTERVAL '28 days', 3, TRUE),
  ('80000000-0000-0000-0000-000000000018', 'PM-PLAN-024', '20000000-0000-0000-0000-000000000018', 'PM Plan - Carl Zeiss ACCURA High-Precision Bridge Coordinate Measuring Machine (QUARTERLY)', 'quarterly', 90, 1450.00, '[{"step":1,"task":"Clean and inspect hydraulic suction strainer and magnetic plug","tool":"Solvent & Lint-Free Cloth"},{"step":2,"task":"Measure spindle runout using dial test indicator (Tolerance < 0.003mm)","tool":"Mitutoyo 0.001mm DTI"},{"step":3,"task":"Torque check anchor bolts and foundation vibration dampeners","tool":"Torque Wrench 250Nm"},{"step":4,"task":"Verify safety interlock switches, emergency stop relays and door switches","tool":"Multimeter"},{"step":5,"task":"Top up central automatic grease lubrication reservoir with EP2 grease","tool":"Grease Pump"}]'::jsonb, '2026-10-15', CURRENT_DATE + INTERVAL '29 days', 3, TRUE),
  ('80000000-0000-0000-0000-000000000019', 'PM-PLAN-025', '20000000-0000-0000-0000-000000000019', 'PM Plan - Atlas Copco GA 160 VSD+ Oil-Injected Rotary Screw Air Compressor #1 (WEEKLY)', 'weekly', 7, 1500.00, '[{"step":1,"task":"Clean and inspect hydraulic suction strainer and magnetic plug","tool":"Solvent & Lint-Free Cloth"},{"step":2,"task":"Measure spindle runout using dial test indicator (Tolerance < 0.003mm)","tool":"Mitutoyo 0.001mm DTI"},{"step":3,"task":"Torque check anchor bolts and foundation vibration dampeners","tool":"Torque Wrench 250Nm"},{"step":4,"task":"Verify safety interlock switches, emergency stop relays and door switches","tool":"Multimeter"},{"step":5,"task":"Top up central automatic grease lubrication reservoir with EP2 grease","tool":"Grease Pump"}]'::jsonb, '2026-10-15', CURRENT_DATE + INTERVAL '5 days', 3, TRUE),
  ('80000000-0000-0000-0000-00000000001a', 'PM-PLAN-026', '20000000-0000-0000-0000-00000000001a', 'PM Plan - Atlas Copco GA 160 VSD+ Oil-Injected Rotary Screw Air Compressor #2 (MONTHLY)', 'monthly', 30, 1550.00, '[{"step":1,"task":"Clean and inspect hydraulic suction strainer and magnetic plug","tool":"Solvent & Lint-Free Cloth"},{"step":2,"task":"Measure spindle runout using dial test indicator (Tolerance < 0.003mm)","tool":"Mitutoyo 0.001mm DTI"},{"step":3,"task":"Torque check anchor bolts and foundation vibration dampeners","tool":"Torque Wrench 250Nm"},{"step":4,"task":"Verify safety interlock switches, emergency stop relays and door switches","tool":"Multimeter"},{"step":5,"task":"Top up central automatic grease lubrication reservoir with EP2 grease","tool":"Grease Pump"}]'::jsonb, '2026-10-15', CURRENT_DATE + INTERVAL '6 days', 3, TRUE),
  ('80000000-0000-0000-0000-00000000001b', 'PM-PLAN-027', '20000000-0000-0000-0000-00000000001b', 'PM Plan - Daikin EWAD-TZ Central Industrial Process Water Chiller 400TR (WEEKLY)', 'weekly', 7, 1600.00, '[{"step":1,"task":"Clean and inspect hydraulic suction strainer and magnetic plug","tool":"Solvent & Lint-Free Cloth"},{"step":2,"task":"Measure spindle runout using dial test indicator (Tolerance < 0.003mm)","tool":"Mitutoyo 0.001mm DTI"},{"step":3,"task":"Torque check anchor bolts and foundation vibration dampeners","tool":"Torque Wrench 250Nm"},{"step":4,"task":"Verify safety interlock switches, emergency stop relays and door switches","tool":"Multimeter"},{"step":5,"task":"Top up central automatic grease lubrication reservoir with EP2 grease","tool":"Grease Pump"}]'::jsonb, '2026-10-15', CURRENT_DATE + INTERVAL '7 days', 3, TRUE),
  ('80000000-0000-0000-0000-00000000001c', 'PM-PLAN-028', '20000000-0000-0000-0000-00000000001c', 'PM Plan - Pangborn Continuous Heavy Structural Steel Shot Blasting Chamber (QUARTERLY)', 'quarterly', 90, 1650.00, '[{"step":1,"task":"Clean and inspect hydraulic suction strainer and magnetic plug","tool":"Solvent & Lint-Free Cloth"},{"step":2,"task":"Measure spindle runout using dial test indicator (Tolerance < 0.003mm)","tool":"Mitutoyo 0.001mm DTI"},{"step":3,"task":"Torque check anchor bolts and foundation vibration dampeners","tool":"Torque Wrench 250Nm"},{"step":4,"task":"Verify safety interlock switches, emergency stop relays and door switches","tool":"Multimeter"},{"step":5,"task":"Top up central automatic grease lubrication reservoir with EP2 grease","tool":"Grease Pump"}]'::jsonb, '2026-10-15', CURRENT_DATE + INTERVAL '8 days', 3, TRUE),
  ('80000000-0000-0000-0000-00000000001d', 'PM-PLAN-029', '20000000-0000-0000-0000-00000000001d', 'PM Plan - Trumpf TruBend 5320 Heavy 320T CNC Hydraulic Press Brake (WEEKLY)', 'weekly', 7, 1700.00, '[{"step":1,"task":"Clean and inspect hydraulic suction strainer and magnetic plug","tool":"Solvent & Lint-Free Cloth"},{"step":2,"task":"Measure spindle runout using dial test indicator (Tolerance < 0.003mm)","tool":"Mitutoyo 0.001mm DTI"},{"step":3,"task":"Torque check anchor bolts and foundation vibration dampeners","tool":"Torque Wrench 250Nm"},{"step":4,"task":"Verify safety interlock switches, emergency stop relays and door switches","tool":"Multimeter"},{"step":5,"task":"Top up central automatic grease lubrication reservoir with EP2 grease","tool":"Grease Pump"}]'::jsonb, '2026-10-15', CURRENT_DATE + INTERVAL '9 days', 3, TRUE),
  ('80000000-0000-0000-0000-00000000001e', 'PM-PLAN-030', '20000000-0000-0000-0000-00000000001e', 'PM Plan - Kawasaki Heavy 7-Axis Gantry Welding Robot System (MONTHLY)', 'monthly', 30, 1750.00, '[{"step":1,"task":"Clean and inspect hydraulic suction strainer and magnetic plug","tool":"Solvent & Lint-Free Cloth"},{"step":2,"task":"Measure spindle runout using dial test indicator (Tolerance < 0.003mm)","tool":"Mitutoyo 0.001mm DTI"},{"step":3,"task":"Torque check anchor bolts and foundation vibration dampeners","tool":"Torque Wrench 250Nm"},{"step":4,"task":"Verify safety interlock switches, emergency stop relays and door switches","tool":"Multimeter"},{"step":5,"task":"Top up central automatic grease lubrication reservoir with EP2 grease","tool":"Grease Pump"}]'::jsonb, '2026-10-15', CURRENT_DATE + INTERVAL '10 days', 3, TRUE)
ON CONFLICT (plan_code) DO NOTHING;

-- 11. 30 Real Stock & Spare Part Transactions (part_id, transaction_type, quantity, performed_by)
INSERT INTO inventory_transactions (
  id, part_id, transaction_type, quantity, source_location, destination_location, 
  reference_work_order_id, performed_by, remarks, created_at
)
SELECT 
  t.id, 
  sp.id, 
  t.txn_type, 
  t.qty, 
  t.src, 
  t.dst, 
  t.wo_id, 
  t.performed_by, 
  t.remarks, 
  t.created_at
FROM (
  VALUES
    ('60000000-0000-0000-0000-000000000001'::uuid, 'PUN-PRT-001', 'ISSUE', 2, 'BIN-A-01-01', 'WO-2026-00201 Bay Location', '40000000-0000-0000-0000-000000000001'::uuid, 'f0000000-0000-0000-0000-000000000007'::uuid, 'Issued spare part to Maintenance Technician for Work Order WO-2026-00201. Authorized by Store In-Charge Mahesh A. Gaikwad.', NOW() - INTERVAL '9 days 2 hours'),
    ('60000000-0000-0000-0000-000000000002'::uuid, 'PUN-PRT-002', 'ISSUE', 3, 'BIN-B-02-05', 'WO-2026-00202 Bay Location', '40000000-0000-0000-0000-000000000002'::uuid, 'f0000000-0000-0000-0000-000000000008'::uuid, 'Issued spare part to Maintenance Technician for Work Order WO-2026-00202. Authorized by Store In-Charge Ganesh N. Jadhav.', NOW() - INTERVAL '8 days 2 hours'),
    ('60000000-0000-0000-0000-000000000003'::uuid, 'PUN-PRT-003', 'ISSUE', 1, 'BIN-C-01-10', 'WO-2026-00203 Bay Location', '40000000-0000-0000-0000-000000000003'::uuid, 'f0000000-0000-0000-0000-000000000009'::uuid, 'Issued spare part to Maintenance Technician for Work Order WO-2026-00203. Authorized by Store In-Charge Santosh K. Bhosale.', NOW() - INTERVAL '7 days 2 hours'),
    ('60000000-0000-0000-0000-000000000004'::uuid, 'PUN-PRT-004', 'STOCK_IN', 2, 'Supplier Truck Bay 1', 'BIN-A-03-02', '40000000-0000-0000-0000-000000000004'::uuid, 'f0000000-0000-0000-0000-00000000000a'::uuid, 'Received genuine OEM consignment for Work Order WO-2026-00204. Authorized by Store In-Charge Rahul T. Kadam.', NOW() - INTERVAL '6 days 2 hours'),
    ('60000000-0000-0000-0000-000000000005'::uuid, 'PUN-PRT-005', 'ISSUE', 3, 'BIN-D-01-08', 'WO-2026-00205 Bay Location', '40000000-0000-0000-0000-000000000005'::uuid, 'f0000000-0000-0000-0000-000000000007'::uuid, 'Issued spare part to Maintenance Technician for Work Order WO-2026-00205. Authorized by Store In-Charge Mahesh A. Gaikwad.', NOW() - INTERVAL '5 days 2 hours'),
    ('60000000-0000-0000-0000-000000000006'::uuid, 'PUN-PRT-006', 'ISSUE', 1, 'BIN-E-02-04', 'WO-2026-00206 Bay Location', '40000000-0000-0000-0000-000000000006'::uuid, 'f0000000-0000-0000-0000-000000000008'::uuid, 'Issued spare part to Maintenance Technician for Work Order WO-2026-00206. Authorized by Store In-Charge Ganesh N. Jadhav.', NOW() - INTERVAL '4 days 2 hours'),
    ('60000000-0000-0000-0000-000000000007'::uuid, 'PUN-PRT-007', 'ISSUE', 2, 'BIN-C-02-01', 'WO-2026-00207 Bay Location', '40000000-0000-0000-0000-000000000007'::uuid, 'f0000000-0000-0000-0000-000000000009'::uuid, 'Issued spare part to Maintenance Technician for Work Order WO-2026-00207. Authorized by Store In-Charge Santosh K. Bhosale.', NOW() - INTERVAL '3 days 2 hours'),
    ('60000000-0000-0000-0000-000000000008'::uuid, 'PUN-PRT-008', 'STOCK_IN', 3, 'Supplier Truck Bay 1', 'BIN-B-04-12', '40000000-0000-0000-0000-000000000008'::uuid, 'f0000000-0000-0000-0000-00000000000a'::uuid, 'Received genuine OEM consignment for Work Order WO-2026-00208. Authorized by Store In-Charge Rahul T. Kadam.', NOW() - INTERVAL '2 days 2 hours'),
    ('60000000-0000-0000-0000-000000000009'::uuid, 'PUN-PRT-009', 'ISSUE', 1, 'BIN-A-05-18', 'WO-2026-00209 Bay Location', '40000000-0000-0000-0000-000000000009'::uuid, 'f0000000-0000-0000-0000-000000000007'::uuid, 'Issued spare part to Maintenance Technician for Work Order WO-2026-00209. Authorized by Store In-Charge Mahesh A. Gaikwad.', NOW() - INTERVAL '1 days 2 hours'),
    ('60000000-0000-0000-0000-00000000000a'::uuid, 'PUN-PRT-010', 'ISSUE', 2, 'BIN-F-01-03', 'WO-2026-00210 Bay Location', '40000000-0000-0000-0000-00000000000a'::uuid, 'f0000000-0000-0000-0000-000000000008'::uuid, 'Issued spare part to Maintenance Technician for Work Order WO-2026-00210. Authorized by Store In-Charge Ganesh N. Jadhav.', NOW() - INTERVAL '0 days 2 hours'),
    ('60000000-0000-0000-0000-00000000000b'::uuid, 'PUN-PRT-011', 'ISSUE', 3, 'BIN-C-03-08', 'WO-2026-00211 Bay Location', '40000000-0000-0000-0000-00000000000b'::uuid, 'f0000000-0000-0000-0000-000000000009'::uuid, 'Issued spare part to Maintenance Technician for Work Order WO-2026-00211. Authorized by Store In-Charge Santosh K. Bhosale.', NOW() - INTERVAL '9 days 2 hours'),
    ('60000000-0000-0000-0000-00000000000c'::uuid, 'PUN-PRT-012', 'STOCK_IN', 1, 'Supplier Truck Bay 1', 'BIN-E-01-14', '40000000-0000-0000-0000-00000000000c'::uuid, 'f0000000-0000-0000-0000-00000000000a'::uuid, 'Received genuine OEM consignment for Work Order WO-2026-00212. Authorized by Store In-Charge Rahul T. Kadam.', NOW() - INTERVAL '8 days 2 hours'),
    ('60000000-0000-0000-0000-00000000000d'::uuid, 'PUN-PRT-013', 'ISSUE', 2, 'BIN-A-05-22', 'WO-2026-00213 Bay Location', '40000000-0000-0000-0000-00000000000d'::uuid, 'f0000000-0000-0000-0000-000000000007'::uuid, 'Issued spare part to Maintenance Technician for Work Order WO-2026-00213. Authorized by Store In-Charge Mahesh A. Gaikwad.', NOW() - INTERVAL '7 days 2 hours'),
    ('60000000-0000-0000-0000-00000000000e'::uuid, 'PUN-PRT-014', 'ISSUE', 3, 'BIN-C-04-06', 'WO-2026-00214 Bay Location', '40000000-0000-0000-0000-00000000000e'::uuid, 'f0000000-0000-0000-0000-000000000008'::uuid, 'Issued spare part to Maintenance Technician for Work Order WO-2026-00214. Authorized by Store In-Charge Ganesh N. Jadhav.', NOW() - INTERVAL '6 days 2 hours'),
    ('60000000-0000-0000-0000-00000000000f'::uuid, 'PUN-PRT-015', 'ISSUE', 1, 'BIN-F-02-11', 'WO-2026-00215 Bay Location', '40000000-0000-0000-0000-00000000000f'::uuid, 'f0000000-0000-0000-0000-000000000009'::uuid, 'Issued spare part to Maintenance Technician for Work Order WO-2026-00215. Authorized by Store In-Charge Santosh K. Bhosale.', NOW() - INTERVAL '5 days 2 hours'),
    ('60000000-0000-0000-0000-000000000010'::uuid, 'PUN-PRT-016', 'STOCK_IN', 2, 'Supplier Truck Bay 1', 'BIN-B-02-09', '40000000-0000-0000-0000-000000000010'::uuid, 'f0000000-0000-0000-0000-00000000000a'::uuid, 'Received genuine OEM consignment for Work Order WO-2026-00216. Authorized by Store In-Charge Rahul T. Kadam.', NOW() - INTERVAL '4 days 2 hours'),
    ('60000000-0000-0000-0000-000000000011'::uuid, 'PUN-PRT-017', 'ISSUE', 3, 'BIN-A-02-14', 'WO-2026-00217 Bay Location', '40000000-0000-0000-0000-000000000011'::uuid, 'f0000000-0000-0000-0000-000000000007'::uuid, 'Issued spare part to Maintenance Technician for Work Order WO-2026-00217. Authorized by Store In-Charge Mahesh A. Gaikwad.', NOW() - INTERVAL '3 days 2 hours'),
    ('60000000-0000-0000-0000-000000000012'::uuid, 'PUN-PRT-018', 'ISSUE', 1, 'BIN-E-03-05', 'WO-2026-00218 Bay Location', '40000000-0000-0000-0000-000000000012'::uuid, 'f0000000-0000-0000-0000-000000000008'::uuid, 'Issued spare part to Maintenance Technician for Work Order WO-2026-00218. Authorized by Store In-Charge Ganesh N. Jadhav.', NOW() - INTERVAL '2 days 2 hours'),
    ('60000000-0000-0000-0000-000000000013'::uuid, 'PUN-PRT-019', 'ISSUE', 2, 'BIN-C-01-04', 'WO-2026-00219 Bay Location', '40000000-0000-0000-0000-000000000013'::uuid, 'f0000000-0000-0000-0000-000000000009'::uuid, 'Issued spare part to Maintenance Technician for Work Order WO-2026-00219. Authorized by Store In-Charge Santosh K. Bhosale.', NOW() - INTERVAL '1 days 2 hours'),
    ('60000000-0000-0000-0000-000000000014'::uuid, 'PUN-PRT-020', 'STOCK_IN', 3, 'Supplier Truck Bay 1', 'BIN-D-03-01', '40000000-0000-0000-0000-000000000014'::uuid, 'f0000000-0000-0000-0000-00000000000a'::uuid, 'Received genuine OEM consignment for Work Order WO-2026-00220. Authorized by Store In-Charge Rahul T. Kadam.', NOW() - INTERVAL '0 days 2 hours'),
    ('60000000-0000-0000-0000-000000000015'::uuid, 'PUN-PRT-021', 'ISSUE', 1, 'BIN-B-05-02', 'WO-2026-00221 Bay Location', '40000000-0000-0000-0000-000000000015'::uuid, 'f0000000-0000-0000-0000-000000000007'::uuid, 'Issued spare part to Maintenance Technician for Work Order WO-2026-00221. Authorized by Store In-Charge Mahesh A. Gaikwad.', NOW() - INTERVAL '9 days 2 hours'),
    ('60000000-0000-0000-0000-000000000016'::uuid, 'PUN-PRT-022', 'ISSUE', 2, 'TC-01-A', 'WO-2026-00222 Bay Location', '40000000-0000-0000-0000-000000000016'::uuid, 'f0000000-0000-0000-0000-000000000008'::uuid, 'Issued spare part to Maintenance Technician for Work Order WO-2026-00222. Authorized by Store In-Charge Ganesh N. Jadhav.', NOW() - INTERVAL '8 days 2 hours'),
    ('60000000-0000-0000-0000-000000000017'::uuid, 'PUN-PRT-023', 'ISSUE', 3, 'BIN-F-03-08', 'WO-2026-00223 Bay Location', '40000000-0000-0000-0000-000000000017'::uuid, 'f0000000-0000-0000-0000-000000000009'::uuid, 'Issued spare part to Maintenance Technician for Work Order WO-2026-00223. Authorized by Store In-Charge Santosh K. Bhosale.', NOW() - INTERVAL '7 days 2 hours'),
    ('60000000-0000-0000-0000-000000000018'::uuid, 'PUN-PRT-024', 'STOCK_IN', 1, 'Supplier Truck Bay 1', 'CHM-01-DRUM', '40000000-0000-0000-0000-000000000018'::uuid, 'f0000000-0000-0000-0000-00000000000a'::uuid, 'Received genuine OEM consignment for Work Order WO-2026-00224. Authorized by Store In-Charge Rahul T. Kadam.', NOW() - INTERVAL '6 days 2 hours'),
    ('60000000-0000-0000-0000-000000000019'::uuid, 'PUN-PRT-025', 'ISSUE', 2, 'TC-02-B', 'WO-2026-00225 Bay Location', '40000000-0000-0000-0000-000000000019'::uuid, 'f0000000-0000-0000-0000-000000000007'::uuid, 'Issued spare part to Maintenance Technician for Work Order WO-2026-00225. Authorized by Store In-Charge Mahesh A. Gaikwad.', NOW() - INTERVAL '5 days 2 hours'),
    ('60000000-0000-0000-0000-00000000001a'::uuid, 'PUN-PRT-026', 'ISSUE', 3, 'BIN-C-05-02', 'WO-2026-00226 Bay Location', '40000000-0000-0000-0000-00000000001a'::uuid, 'f0000000-0000-0000-0000-000000000008'::uuid, 'Issued spare part to Maintenance Technician for Work Order WO-2026-00226. Authorized by Store In-Charge Ganesh N. Jadhav.', NOW() - INTERVAL '4 days 2 hours'),
    ('60000000-0000-0000-0000-00000000001b'::uuid, 'PUN-PRT-027', 'ISSUE', 1, 'BIN-B-01-18', 'WO-2026-00227 Bay Location', '40000000-0000-0000-0000-00000000001b'::uuid, 'f0000000-0000-0000-0000-000000000009'::uuid, 'Issued spare part to Maintenance Technician for Work Order WO-2026-00227. Authorized by Store In-Charge Santosh K. Bhosale.', NOW() - INTERVAL '3 days 2 hours'),
    ('60000000-0000-0000-0000-00000000001c'::uuid, 'PUN-PRT-028', 'STOCK_IN', 2, 'Supplier Truck Bay 1', 'BIN-A-04-10', '40000000-0000-0000-0000-00000000001c'::uuid, 'f0000000-0000-0000-0000-00000000000a'::uuid, 'Received genuine OEM consignment for Work Order WO-2026-00228. Authorized by Store In-Charge Rahul T. Kadam.', NOW() - INTERVAL '2 days 2 hours'),
    ('60000000-0000-0000-0000-00000000001d'::uuid, 'PUN-PRT-029', 'ISSUE', 3, 'BIN-C-04-12', 'WO-2026-00229 Bay Location', '40000000-0000-0000-0000-00000000001d'::uuid, 'f0000000-0000-0000-0000-000000000007'::uuid, 'Issued spare part to Maintenance Technician for Work Order WO-2026-00229. Authorized by Store In-Charge Mahesh A. Gaikwad.', NOW() - INTERVAL '1 days 2 hours'),
    ('60000000-0000-0000-0000-00000000001e'::uuid, 'PUN-PRT-030', 'ISSUE', 1, 'CHM-02-DRUM', 'WO-2026-00230 Bay Location', '40000000-0000-0000-0000-00000000001e'::uuid, 'f0000000-0000-0000-0000-000000000008'::uuid, 'Issued spare part to Maintenance Technician for Work Order WO-2026-00230. Authorized by Store In-Charge Ganesh N. Jadhav.', NOW() - INTERVAL '0 days 2 hours')
) AS t(id, part_no, txn_type, qty, src, dst, wo_id, performed_by, remarks, created_at)
JOIN spare_parts sp ON sp.part_number = t.part_no
ON CONFLICT (id) DO NOTHING;

-- 12. 30 Active Operator-Machine Shift Assignments & Permanent Sign-Ins
-- First ensure table exists if migration 015 was not yet applied
CREATE TABLE IF NOT EXISTS operator_machine_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  operator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  shift VARCHAR(50) DEFAULT 'Shift A',
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  signed_in_at TIMESTAMPTZ,
  assignment_type VARCHAR(50) NOT NULL DEFAULT 'temporary',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO operator_machine_assignments (
  id, operator_id, machine_id, shop_id, plant_id, shift, status, approved_by, approved_at, signed_in_at, assignment_type, notes
) VALUES
  ('90000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000015', '20000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000002', 'Shift A', 'approved', 'f0000000-0000-0000-0000-000000000003', NOW() - INTERVAL '1 days 7 hours 45 minutes', NOW() - INTERVAL '1 days 7 hours 30 minutes', 'permanent', 'Shift operational sign-in approved by Plant Maintenance Manager Rohan S. Kulkarni. Machine safe for production.'),
  ('90000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000016', '20000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000002', 'Shift A', 'approved', 'f0000000-0000-0000-0000-000000000004', NOW() - INTERVAL '0 days 7 hours 45 minutes', NOW() - INTERVAL '0 days 7 hours 30 minutes', 'permanent', 'Shift operational sign-in approved by Plant Maintenance Manager Swapnil M. Shinde. Machine safe for production.'),
  ('90000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000017', '20000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000013', 'b0000000-0000-0000-0000-000000000002', 'Shift A', 'approved', 'f0000000-0000-0000-0000-000000000005', NOW() - INTERVAL '6 days 7 hours 45 minutes', NOW() - INTERVAL '6 days 7 hours 30 minutes', 'permanent', 'Shift operational sign-in approved by Plant Maintenance Manager Amol V. More. Machine safe for production.'),
  ('90000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000018', '20000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000014', 'b0000000-0000-0000-0000-000000000002', 'Shift A', 'approved', 'f0000000-0000-0000-0000-000000000006', NOW() - INTERVAL '5 days 7 hours 45 minutes', NOW() - INTERVAL '5 days 7 hours 30 minutes', 'permanent', 'Shift operational sign-in approved by Plant Maintenance Manager Prashant B. Chavan. Machine safe for production.'),
  ('90000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000019', '20000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000015', 'b0000000-0000-0000-0000-000000000002', 'Shift A', 'approved', 'f0000000-0000-0000-0000-000000000003', NOW() - INTERVAL '4 days 7 hours 45 minutes', NOW() - INTERVAL '4 days 7 hours 30 minutes', 'permanent', 'Shift operational sign-in approved by Plant Maintenance Manager Rohan S. Kulkarni. Machine safe for production.'),
  ('90000000-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-00000000001a', '20000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000002', 'Shift A', 'approved', 'f0000000-0000-0000-0000-000000000004', NOW() - INTERVAL '3 days 7 hours 45 minutes', NOW() - INTERVAL '3 days 7 hours 30 minutes', 'permanent', 'Shift operational sign-in approved by Plant Maintenance Manager Swapnil M. Shinde. Machine safe for production.'),
  ('90000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-00000000001b', '20000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000002', 'Shift A', 'approved', 'f0000000-0000-0000-0000-000000000005', NOW() - INTERVAL '2 days 7 hours 45 minutes', NOW() - INTERVAL '2 days 7 hours 30 minutes', 'permanent', 'Shift operational sign-in approved by Plant Maintenance Manager Amol V. More. Machine safe for production.'),
  ('90000000-0000-0000-0000-000000000008', 'f0000000-0000-0000-0000-00000000001c', '20000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000013', 'b0000000-0000-0000-0000-000000000002', 'Shift A', 'approved', 'f0000000-0000-0000-0000-000000000006', NOW() - INTERVAL '1 days 7 hours 45 minutes', NOW() - INTERVAL '1 days 7 hours 30 minutes', 'permanent', 'Shift operational sign-in approved by Plant Maintenance Manager Prashant B. Chavan. Machine safe for production.'),
  ('90000000-0000-0000-0000-000000000009', 'f0000000-0000-0000-0000-00000000001d', '20000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000014', 'b0000000-0000-0000-0000-000000000002', 'Shift A', 'approved', 'f0000000-0000-0000-0000-000000000003', NOW() - INTERVAL '0 days 7 hours 45 minutes', NOW() - INTERVAL '0 days 7 hours 30 minutes', 'permanent', 'Shift operational sign-in approved by Plant Maintenance Manager Rohan S. Kulkarni. Machine safe for production.'),
  ('90000000-0000-0000-0000-00000000000a', 'f0000000-0000-0000-0000-00000000001e', '20000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-000000000015', 'b0000000-0000-0000-0000-000000000002', 'Shift A', 'approved', 'f0000000-0000-0000-0000-000000000004', NOW() - INTERVAL '6 days 7 hours 45 minutes', NOW() - INTERVAL '6 days 7 hours 30 minutes', 'permanent', 'Shift operational sign-in approved by Plant Maintenance Manager Swapnil M. Shinde. Machine safe for production.'),
  ('90000000-0000-0000-0000-00000000000b', 'f0000000-0000-0000-0000-000000000015', '20000000-0000-0000-0000-00000000000b', 'c0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000002', 'Shift A', 'approved', 'f0000000-0000-0000-0000-000000000005', NOW() - INTERVAL '5 days 7 hours 45 minutes', NOW() - INTERVAL '5 days 7 hours 30 minutes', 'shift', 'Shift operational sign-in approved by Plant Maintenance Manager Amol V. More. Machine safe for production.'),
  ('90000000-0000-0000-0000-00000000000c', 'f0000000-0000-0000-0000-000000000016', '20000000-0000-0000-0000-00000000000c', 'c0000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000002', 'Shift A', 'approved', 'f0000000-0000-0000-0000-000000000006', NOW() - INTERVAL '4 days 7 hours 45 minutes', NOW() - INTERVAL '4 days 7 hours 30 minutes', 'shift', 'Shift operational sign-in approved by Plant Maintenance Manager Prashant B. Chavan. Machine safe for production.'),
  ('90000000-0000-0000-0000-00000000000d', 'f0000000-0000-0000-0000-000000000017', '20000000-0000-0000-0000-00000000000d', 'c0000000-0000-0000-0000-000000000013', 'b0000000-0000-0000-0000-000000000002', 'Shift A', 'approved', 'f0000000-0000-0000-0000-000000000003', NOW() - INTERVAL '3 days 7 hours 45 minutes', NOW() - INTERVAL '3 days 7 hours 30 minutes', 'shift', 'Shift operational sign-in approved by Plant Maintenance Manager Rohan S. Kulkarni. Machine safe for production.'),
  ('90000000-0000-0000-0000-00000000000e', 'f0000000-0000-0000-0000-000000000018', '20000000-0000-0000-0000-00000000000e', 'c0000000-0000-0000-0000-000000000014', 'b0000000-0000-0000-0000-000000000002', 'Shift A', 'approved', 'f0000000-0000-0000-0000-000000000004', NOW() - INTERVAL '2 days 7 hours 45 minutes', NOW() - INTERVAL '2 days 7 hours 30 minutes', 'shift', 'Shift operational sign-in approved by Plant Maintenance Manager Swapnil M. Shinde. Machine safe for production.'),
  ('90000000-0000-0000-0000-00000000000f', 'f0000000-0000-0000-0000-000000000019', '20000000-0000-0000-0000-00000000000f', 'c0000000-0000-0000-0000-000000000015', 'b0000000-0000-0000-0000-000000000002', 'Shift A', 'approved', 'f0000000-0000-0000-0000-000000000005', NOW() - INTERVAL '1 days 7 hours 45 minutes', NOW() - INTERVAL '1 days 7 hours 30 minutes', 'shift', 'Shift operational sign-in approved by Plant Maintenance Manager Amol V. More. Machine safe for production.'),
  ('90000000-0000-0000-0000-000000000010', 'f0000000-0000-0000-0000-00000000001a', '20000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000002', 'Shift A', 'approved', 'f0000000-0000-0000-0000-000000000006', NOW() - INTERVAL '0 days 7 hours 45 minutes', NOW() - INTERVAL '0 days 7 hours 30 minutes', 'shift', 'Shift operational sign-in approved by Plant Maintenance Manager Prashant B. Chavan. Machine safe for production.'),
  ('90000000-0000-0000-0000-000000000011', 'f0000000-0000-0000-0000-00000000001b', '20000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000002', 'Shift A', 'approved', 'f0000000-0000-0000-0000-000000000003', NOW() - INTERVAL '6 days 7 hours 45 minutes', NOW() - INTERVAL '6 days 7 hours 30 minutes', 'shift', 'Shift operational sign-in approved by Plant Maintenance Manager Rohan S. Kulkarni. Machine safe for production.'),
  ('90000000-0000-0000-0000-000000000012', 'f0000000-0000-0000-0000-00000000001c', '20000000-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-000000000013', 'b0000000-0000-0000-0000-000000000002', 'Shift A', 'approved', 'f0000000-0000-0000-0000-000000000004', NOW() - INTERVAL '5 days 7 hours 45 minutes', NOW() - INTERVAL '5 days 7 hours 30 minutes', 'shift', 'Shift operational sign-in approved by Plant Maintenance Manager Swapnil M. Shinde. Machine safe for production.'),
  ('90000000-0000-0000-0000-000000000013', 'f0000000-0000-0000-0000-00000000001d', '20000000-0000-0000-0000-000000000013', 'c0000000-0000-0000-0000-000000000014', 'b0000000-0000-0000-0000-000000000002', 'Shift A', 'approved', 'f0000000-0000-0000-0000-000000000005', NOW() - INTERVAL '4 days 7 hours 45 minutes', NOW() - INTERVAL '4 days 7 hours 30 minutes', 'shift', 'Shift operational sign-in approved by Plant Maintenance Manager Amol V. More. Machine safe for production.'),
  ('90000000-0000-0000-0000-000000000014', 'f0000000-0000-0000-0000-00000000001e', '20000000-0000-0000-0000-000000000014', 'c0000000-0000-0000-0000-000000000015', 'b0000000-0000-0000-0000-000000000002', 'Shift A', 'approved', 'f0000000-0000-0000-0000-000000000006', NOW() - INTERVAL '3 days 7 hours 45 minutes', NOW() - INTERVAL '3 days 7 hours 30 minutes', 'shift', 'Shift operational sign-in approved by Plant Maintenance Manager Prashant B. Chavan. Machine safe for production.'),
  ('90000000-0000-0000-0000-000000000015', 'f0000000-0000-0000-0000-000000000015', '20000000-0000-0000-0000-000000000015', 'c0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000002', 'Shift A', 'approved', 'f0000000-0000-0000-0000-000000000003', NOW() - INTERVAL '2 days 7 hours 45 minutes', NOW() - INTERVAL '2 days 7 hours 30 minutes', 'shift', 'Shift operational sign-in approved by Plant Maintenance Manager Rohan S. Kulkarni. Machine safe for production.'),
  ('90000000-0000-0000-0000-000000000016', 'f0000000-0000-0000-0000-000000000016', '20000000-0000-0000-0000-000000000016', 'c0000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000002', 'Shift A', 'approved', 'f0000000-0000-0000-0000-000000000004', NOW() - INTERVAL '1 days 7 hours 45 minutes', NOW() - INTERVAL '1 days 7 hours 30 minutes', 'shift', 'Shift operational sign-in approved by Plant Maintenance Manager Swapnil M. Shinde. Machine safe for production.'),
  ('90000000-0000-0000-0000-000000000017', 'f0000000-0000-0000-0000-000000000017', '20000000-0000-0000-0000-000000000017', 'c0000000-0000-0000-0000-000000000013', 'b0000000-0000-0000-0000-000000000002', 'Shift A', 'approved', 'f0000000-0000-0000-0000-000000000005', NOW() - INTERVAL '0 days 7 hours 45 minutes', NOW() - INTERVAL '0 days 7 hours 30 minutes', 'shift', 'Shift operational sign-in approved by Plant Maintenance Manager Amol V. More. Machine safe for production.'),
  ('90000000-0000-0000-0000-000000000018', 'f0000000-0000-0000-0000-000000000018', '20000000-0000-0000-0000-000000000018', 'c0000000-0000-0000-0000-000000000014', 'b0000000-0000-0000-0000-000000000002', 'Shift A', 'approved', 'f0000000-0000-0000-0000-000000000006', NOW() - INTERVAL '6 days 7 hours 45 minutes', NOW() - INTERVAL '6 days 7 hours 30 minutes', 'shift', 'Shift operational sign-in approved by Plant Maintenance Manager Prashant B. Chavan. Machine safe for production.'),
  ('90000000-0000-0000-0000-000000000019', 'f0000000-0000-0000-0000-000000000019', '20000000-0000-0000-0000-000000000019', 'c0000000-0000-0000-0000-000000000015', 'b0000000-0000-0000-0000-000000000002', 'Shift A', 'approved', 'f0000000-0000-0000-0000-000000000003', NOW() - INTERVAL '5 days 7 hours 45 minutes', NOW() - INTERVAL '5 days 7 hours 30 minutes', 'shift', 'Shift operational sign-in approved by Plant Maintenance Manager Rohan S. Kulkarni. Machine safe for production.'),
  ('90000000-0000-0000-0000-00000000001a', 'f0000000-0000-0000-0000-00000000001a', '20000000-0000-0000-0000-00000000001a', 'c0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000002', 'Shift A', 'approved', 'f0000000-0000-0000-0000-000000000004', NOW() - INTERVAL '4 days 7 hours 45 minutes', NOW() - INTERVAL '4 days 7 hours 30 minutes', 'shift', 'Shift operational sign-in approved by Plant Maintenance Manager Swapnil M. Shinde. Machine safe for production.'),
  ('90000000-0000-0000-0000-00000000001b', 'f0000000-0000-0000-0000-00000000001b', '20000000-0000-0000-0000-00000000001b', 'c0000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000002', 'Shift A', 'approved', 'f0000000-0000-0000-0000-000000000005', NOW() - INTERVAL '3 days 7 hours 45 minutes', NOW() - INTERVAL '3 days 7 hours 30 minutes', 'shift', 'Shift operational sign-in approved by Plant Maintenance Manager Amol V. More. Machine safe for production.'),
  ('90000000-0000-0000-0000-00000000001c', 'f0000000-0000-0000-0000-00000000001c', '20000000-0000-0000-0000-00000000001c', 'c0000000-0000-0000-0000-000000000013', 'b0000000-0000-0000-0000-000000000002', 'Shift A', 'approved', 'f0000000-0000-0000-0000-000000000006', NOW() - INTERVAL '2 days 7 hours 45 minutes', NOW() - INTERVAL '2 days 7 hours 30 minutes', 'shift', 'Shift operational sign-in approved by Plant Maintenance Manager Prashant B. Chavan. Machine safe for production.'),
  ('90000000-0000-0000-0000-00000000001d', 'f0000000-0000-0000-0000-00000000001d', '20000000-0000-0000-0000-00000000001d', 'c0000000-0000-0000-0000-000000000014', 'b0000000-0000-0000-0000-000000000002', 'Shift A', 'approved', 'f0000000-0000-0000-0000-000000000003', NOW() - INTERVAL '1 days 7 hours 45 minutes', NOW() - INTERVAL '1 days 7 hours 30 minutes', 'shift', 'Shift operational sign-in approved by Plant Maintenance Manager Rohan S. Kulkarni. Machine safe for production.'),
  ('90000000-0000-0000-0000-00000000001e', 'f0000000-0000-0000-0000-00000000001e', '20000000-0000-0000-0000-00000000001e', 'c0000000-0000-0000-0000-000000000015', 'b0000000-0000-0000-0000-000000000002', 'Shift A', 'approved', 'f0000000-0000-0000-0000-000000000004', NOW() - INTERVAL '0 days 7 hours 45 minutes', NOW() - INTERVAL '0 days 7 hours 30 minutes', 'shift', 'Shift operational sign-in approved by Plant Maintenance Manager Swapnil M. Shinde. Machine safe for production.')
ON CONFLICT (id) DO NOTHING;

-- 13. Backfill Current Operator and Assignment References on Machines
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'machines' AND column_name = 'current_operator_id') THEN
  UPDATE machines m
  SET 
    current_operator_id = a.operator_id,
    assignment_status = 'occupied',
    current_assignment_id = a.id
  FROM operator_machine_assignments a
  WHERE a.machine_id = m.id AND a.status = 'approved';
END IF;

-- 14. Backfill Permanent Machine Assignment on Operators
IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'permanent_machine_id') THEN
  UPDATE users u
  SET permanent_machine_id = a.machine_id
  FROM operator_machine_assignments a
  WHERE a.operator_id = u.id AND a.assignment_type = 'permanent';
END IF;

END $$;
