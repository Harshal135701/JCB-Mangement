-- ====================================================================
-- JCB SMART CMMS: 100% COMPLETE ALL-IN-ONE DATABASE SETUP SCRIPT
-- (INCLUDES ALL 18 MIGRATIONS + SCHEMA + STORE MANAGER + INITIAL SEED)
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
-- INITIAL SEED DATA (CORE 5 ROLES, PLANTS, SHOPS, MACHINES, PARTS)
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
-- 30 MAHARASHTRIAN PERSONNEL & PUNE HEAVY ASSET DATASET
-- ====================================================================

-- =====================================================================
-- JCB SMART CMMS: 30 MAHARASHTRIAN ENTERPRISE PERSONNEL & OPERATIONAL SEED DATA
-- Target Facility: JCB Pune Heavy Manufacturing Works (Talegaon Dabhade / Chakan Industrial Belt, Maharashtra)
-- Entities: Plants, Shops, 30 Users, 30 Machines, 30 Spare Parts, 30 Complaints, 30 Work Orders, 30 Inspections, 30 Stock Transactions
-- =====================================================================

DO $$
BEGIN

-- 1. Ensure Pune Plant exists
INSERT INTO plants (id, plant_code, plant_name, address, state, city, pin_code, plant_manager, contact_number, email)
VALUES ('b0000000-0000-0000-0000-000000000002', 'PLANT-PUNE', 'JCB Pune Heavy Manufacturing Works', 'Plot A-1, Talegaon Industrial Area, Chakan-Talegaon Road', 'Maharashtra', 'Pune', '410507', 'Sachin D. Patil', '+91-211-4668000', 'sachin.patil@jcb.com')
ON CONFLICT (plant_code) DO UPDATE SET plant_name = EXCLUDED.plant_name;

-- 2. Ensure Pune Shops exist
INSERT INTO shops (id, plant_id, shop_code, shop_name, description) VALUES
  ('c0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000002', 'PUN-SHP-HMC', 'Pune HMC & VMC Heavy Machining Shop', 'Precision CNC machining for 3DX backhoe loader chassis and transmission housings'),
  ('c0000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000002', 'PUN-SHP-ROB', 'Pune Robotic Welding & Arm Fabrication Shop', 'Automated Fanuc 6-axis robotic welding cells for structural booms and dippers'),
  ('c0000000-0000-0000-0000-000000000013', 'b0000000-0000-0000-0000-000000000002', 'PUN-SHP-PRS', 'Pune 1000T Hydraulic Stamping & Press Shop', 'Heavy forming and blanking presses for excavator cabins and ROPS/FOPS canopies'),
  ('c0000000-0000-0000-0000-000000000014', 'b0000000-0000-0000-0000-000000000002', 'PUN-SHP-PNT', 'Pune Automated Electrostatic Powder Coating Line', 'Automated 12-stage pre-treatment and JCB Classic Yellow powder coating plant'),
  ('c0000000-0000-0000-0000-000000000015', 'b0000000-0000-0000-0000-000000000002', 'PUN-SHP-ASM', 'Pune Heavy Excavator & Backhoe Final Assembly', 'Continuous moving takt-time assembly line and hydraulic test bays')
ON CONFLICT (shop_code) DO NOTHING;

-- 3. 30 Maharashtrian Enterprise Users (Core Roles: Admin, Manager, Store Manager, Technician, Operator)
INSERT INTO users (id, employee_code, full_name, email, phone, role, plant_id, shop_id, department, designation, shift, skills_json, password_hash, is_active, approval_status) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'EMP-MAH-001', 'Sachin D. Patil', 'sachin.patil@jcb.com', '+91-9822011001', 'admin', 'b0000000-0000-0000-0000-000000000002', NULL, 'Plant Systems & Governance', 'Enterprise VP & Plant Head', 'General', '[]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-000000000002', 'EMP-MAH-002', 'Aniket R. Deshmukh', 'aniket.deshmukh@jcb.com', '+91-9822011002', 'admin', 'b0000000-0000-0000-0000-000000000002', NULL, 'IT & Digital Operations', 'Principal Systems Architect', 'General', '[]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-000000000003', 'EMP-MAH-003', 'Rohan S. Kulkarni', 'rohan.kulkarni@jcb.com', '+91-9822011003', 'manager', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000011', 'Mechanical Maintenance', 'Plant Maintenance Manager', 'General', '[]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-000000000004', 'EMP-MAH-004', 'Swapnil M. Shinde', 'swapnil.shinde@jcb.com', '+91-9822011004', 'manager', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000012', 'Electrical & Automation', 'Automation Engineering Lead', 'General', '[]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-000000000005', 'EMP-MAH-005', 'Amol V. More', 'amol.more@jcb.com', '+91-9822011005', 'manager', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000013', 'Heavy Press & Tooling', 'Tooling & Reliability Manager', 'General', '[]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-000000000006', 'EMP-MAH-006', 'Prashant B. Chavan', 'prashant.chavan@jcb.com', '+91-9822011006', 'manager', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000015', 'Quality & Governance', 'Operations & Reliability In-Charge', 'General', '[]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-000000000007', 'EMP-MAH-007', 'Mahesh A. Gaikwad', 'mahesh.gaikwad@jcb.com', '+91-9822011007', 'store_manager', 'b0000000-0000-0000-0000-000000000002', NULL, 'Central Stores & Logistics', 'Chief Inventory Controller', 'General', '["Inventory Control", "ERP", "Logistics"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-000000000008', 'EMP-MAH-008', 'Ganesh N. Jadhav', 'ganesh.jadhav@jcb.com', '+91-9822011008', 'store_manager', 'b0000000-0000-0000-0000-000000000002', NULL, 'Spare Parts Warehouse', 'Senior Materials Manager', 'General', '["Material Inwarding", "Bin Management"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-000000000009', 'EMP-MAH-009', 'Santosh K. Bhosale', 'santosh.bhosale@jcb.com', '+91-9822011009', 'store_manager', 'b0000000-0000-0000-0000-000000000002', NULL, 'Tool Crib & Consumables', 'Tool Crib Supervisor', 'General', '["Tool Crib", "RDC Reconciliation"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-00000000000a', 'EMP-MAH-010', 'Rahul T. Kadam', 'rahul.kadam@jcb.com', '+91-9822011010', 'store_manager', 'b0000000-0000-0000-0000-000000000002', NULL, 'Inbound Logistics & Receiving', 'Receiving Store Officer', 'General', '["PO Verification", "Goods Receipt (GRN)"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-00000000000b', 'EMP-MAH-011', 'Nitin G. Pawar', 'nitin.pawar@jcb.com', '+91-9822011011', 'technician', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000011', 'Mechanical Maintenance', 'Senior Mechanical Technician', 'Shift A', '["Hydraulics", "Bearings", "Pneumatics"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-00000000000c', 'EMP-MAH-012', 'Vishal B. Mane', 'vishal.mane@jcb.com', '+91-9822011012', 'technician', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000012', 'Electrical Maintenance', 'PLC & Automation Specialist', 'Shift A', '["Siemens S7", "Fanuc Robot", "Sensors"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-00000000000d', 'EMP-MAH-013', 'Sandeep R. Thorat', 'sandeep.thorat@jcb.com', '+91-9822011013', 'technician', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000013', 'Hydraulics & Tooling', 'Lead Hydraulics Tech', 'Shift A', '["Rexroth Proportional Valves", "Pumps"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-00000000000e', 'EMP-MAH-014', 'Dattatray P. Khot', 'dattatray.khot@jcb.com', '+91-9822011014', 'technician', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000012', 'Robotic Welding Bay', 'Robotics Field Technician', 'Shift B', '["Robotic Arms", "Torch Servicing", "MIG"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-00000000000f', 'EMP-MAH-015', 'Mangesh D. Salunkhe', 'mangesh.salunkhe@jcb.com', '+91-9822011015', 'technician', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000011', 'CNC Machining Maintenance', 'Spindle & Tool Changer Tech', 'Shift B', '["Mazak Spindles", "Ball Screws"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-000000000010', 'EMP-MAH-016', 'Pravin V. Sawant', 'pravin.sawant@jcb.com', '+91-9822011016', 'technician', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000013', 'Press & Stamping Bay', 'Heavy Press Mechanical Tech', 'Shift B', '["1000T Ram Seals", "Lubrication"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-000000000011', 'EMP-MAH-017', 'Ajinkya C. Surve', 'ajinkya.surve@jcb.com', '+91-9822011017', 'technician', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000014', 'Powder Coating & Utilities', 'Plant Utilities Technician', 'Shift C', '["Compressors", "Chillers", "Boilers"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-000000000012', 'EMP-MAH-018', 'Yogesh S. Kamble', 'yogesh.kamble@jcb.com', '+91-9822011018', 'technician', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000011', 'Electrical & Instrumentation', 'Drives & VFD Tech', 'Shift C', '["ABB Drives", "Schneider VFD", "Wiring"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-000000000013', 'EMP-MAH-019', 'Akash N. Tambade', 'akash.tambade@jcb.com', '+91-9822011019', 'technician', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000015', 'Preventive Maintenance Group', 'Condition Monitoring Specialist', 'General', '["Vibration Analysis", "Thermography"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-000000000014', 'EMP-MAH-020', 'Siddhesh R. Gawade', 'siddhesh.gawade@jcb.com', '+91-9822011020', 'technician', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000012', 'Mechanical Fast Response Team', 'Emergency Breakdown Specialist', 'Shift A', '["Rapid Diagnostics", "Overhauling"]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-000000000015', 'EMP-MAH-021', 'Tushar H. Shingade', 'tushar.shingade@jcb.com', '+91-9822011021', 'operator', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000011', 'CNC Machining', 'Senior HMC Machine Operator', 'Shift A', '[]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-000000000016', 'EMP-MAH-022', 'Onkar S. Navale', 'onkar.navale@jcb.com', '+91-9822011022', 'operator', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000012', 'Robotic Welding', 'Automated Cell Operator', 'Shift A', '[]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-000000000017', 'EMP-MAH-023', 'Vijay K. Lokhande', 'vijay.lokhande@jcb.com', '+91-9822011023', 'operator', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000013', 'Heavy Press Bay', 'Schuler 1000T Press Operator', 'Shift A', '[]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-000000000018', 'EMP-MAH-024', 'Pradeep B. Wagh', 'pradeep.wagh@jcb.com', '+91-9822011024', 'operator', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000013', 'Laser & Plasma Cutting', 'Trumpf Laser Cutting Operator', 'Shift A', '[]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-000000000019', 'EMP-MAH-025', 'Suraj M. Khilare', 'suraj.khilare@jcb.com', '+91-9822011025', 'operator', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000012', 'Chassis Fabrication', 'Excavator Frame Operator', 'Shift B', '[]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-00000000001a', 'EMP-MAH-026', 'Kiran R. Ghadge', 'kiran.ghadge@jcb.com', '+91-9822011026', 'operator', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000014', 'Powder Coating Bay', 'Electrostatic Line Operator', 'Shift B', '[]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-00000000001b', 'EMP-MAH-027', 'Deepak N. Choudhary', 'deepak.choudhary@jcb.com', '+91-9822011027', 'operator', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000011', 'Transmission Assembly', 'Gearbox Line Operator', 'Shift B', '[]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-00000000001c', 'EMP-MAH-028', 'Chetan P. Kore', 'chetan.kore@jcb.com', '+91-9822011028', 'operator', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000015', 'Boom Assembly', 'Boom & Dipper Fitter Operator', 'Shift C', '[]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-00000000001d', 'EMP-MAH-029', 'Nilesh A. Dhale', 'nilesh.dhale@jcb.com', '+91-9822011029', 'operator', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000015', 'Cabin & Trim Fitment', 'ROPS/FOPS Cabin Line Operator', 'Shift C', '[]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved'),
  ('f0000000-0000-0000-0000-00000000001e', 'EMP-MAH-030', 'Harsh V. Zagade', 'harsh.zagade@jcb.com', '+91-9822011030', 'operator', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000015', 'Final Inspection & Road Track', 'Machine Test Track Operator', 'General', '[]'::jsonb, '$2a$12$g1l6RDlhupTVLSasbUQk8ueD5vZNSlSFrkPFwu3GUnKjwcUYN2m4e', TRUE, 'approved')
ON CONFLICT (email) DO UPDATE SET 
  full_name = EXCLUDED.full_name,
  is_active = TRUE,
  approval_status = 'approved',
  password_hash = EXCLUDED.password_hash;

-- 4. 30 Industrial Machines at JCB Pune Works
INSERT INTO machines (id, shop_id, machine_code, name, category, oem_manufacturer, model_number, serial_number, bay_line_location, criticality, status, operating_hours, qr_code_uid, description) VALUES
  ('20000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000011', 'PUN-MC-001', 'JCB Pune HMC Unit 1', 'HMC', 'Fanuc Robotics Japan', 'NEO-HMC-2026', 'JCB-MH-202601', 'Bay 2 / Line PUN-SHP-HMC', 'class_c', 'running', 1814.50, 'QR-PUN-MC-001-UID', 'High-throughput precision heavy industrial HMC operational asset at JCB Pune Talegaon works.'),
  ('20000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000012', 'PUN-MC-002', 'JCB Pune VMC Unit 2', 'VMC', 'Mazak Corporation', 'NEO-VMC-2026', 'JCB-MH-202602', 'Bay 3 / Line PUN-SHP-ROB', 'class_b', 'running', 2129.00, 'QR-PUN-MC-002-UID', 'High-throughput precision heavy industrial VMC operational asset at JCB Pune Talegaon works.'),
  ('20000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000013', 'PUN-MC-003', 'JCB Pune Robotic Welder Unit 3', 'Robotic Welder', 'Fanuc Robotics Japan', 'NEO-ROBOTICWELDER-2026', 'JCB-MH-202603', 'Bay 4 / Line PUN-SHP-PRS', 'class_a', 'running', 2443.50, 'QR-PUN-MC-003-UID', 'High-throughput precision heavy industrial Robotic Welder operational asset at JCB Pune Talegaon works.'),
  ('20000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000014', 'PUN-MC-004', 'JCB Pune Press Unit 4', 'Press', 'Mazak Corporation', 'NEO-PRESS-2026', 'JCB-MH-202604', 'Bay 5 / Line PUN-SHP-PNT', 'class_b', 'breakdown', 2758.00, 'QR-PUN-MC-004-UID', 'High-throughput precision heavy industrial Press operational asset at JCB Pune Talegaon works.'),
  ('20000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000015', 'PUN-MC-005', 'JCB Pune Laser Cutter Unit 5', 'Laser Cutter', 'Fanuc Robotics Japan', 'NEO-LASERCUTTER-2026', 'JCB-MH-202605', 'Bay 1 / Line PUN-SHP-ASM', 'class_c', 'running', 3072.50, 'QR-PUN-MC-005-UID', 'High-throughput precision heavy industrial Laser Cutter operational asset at JCB Pune Talegaon works.'),
  ('20000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000011', 'PUN-MC-006', 'JCB Pune Coating Booth Unit 6', 'Coating Booth', 'Mazak Corporation', 'NEO-COATINGBOOTH-2026', 'JCB-MH-202606', 'Bay 2 / Line PUN-SHP-HMC', 'class_a', 'running', 3387.00, 'QR-PUN-MC-006-UID', 'High-throughput precision heavy industrial Coating Booth operational asset at JCB Pune Talegaon works.'),
  ('20000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000012', 'PUN-MC-007', 'JCB Pune Assembly Rig Unit 7', 'Assembly Rig', 'Fanuc Robotics Japan', 'NEO-ASSEMBLYRIG-2026', 'JCB-MH-202607', 'Bay 3 / Line PUN-SHP-ROB', 'class_c', 'under_maintenance', 3701.50, 'QR-PUN-MC-007-UID', 'High-throughput precision heavy industrial Assembly Rig operational asset at JCB Pune Talegaon works.'),
  ('20000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000013', 'PUN-MC-008', 'JCB Pune HMC Unit 8', 'HMC', 'Mazak Corporation', 'NEO-HMC-2026', 'JCB-MH-202608', 'Bay 4 / Line PUN-SHP-PRS', 'class_b', 'running', 4016.00, 'QR-PUN-MC-008-UID', 'High-throughput precision heavy industrial HMC operational asset at JCB Pune Talegaon works.'),
  ('20000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000014', 'PUN-MC-009', 'JCB Pune VMC Unit 9', 'VMC', 'Fanuc Robotics Japan', 'NEO-VMC-2026', 'JCB-MH-202609', 'Bay 5 / Line PUN-SHP-PNT', 'class_a', 'running', 4330.50, 'QR-PUN-MC-009-UID', 'High-throughput precision heavy industrial VMC operational asset at JCB Pune Talegaon works.'),
  ('20000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-000000000015', 'PUN-MC-010', 'JCB Pune Robotic Welder Unit 10', 'Robotic Welder', 'Mazak Corporation', 'NEO-ROBOTICWELDER-2026', 'JCB-MH-202610', 'Bay 1 / Line PUN-SHP-ASM', 'class_b', 'running', 4645.00, 'QR-PUN-MC-010-UID', 'High-throughput precision heavy industrial Robotic Welder operational asset at JCB Pune Talegaon works.'),
  ('20000000-0000-0000-0000-00000000000b', 'c0000000-0000-0000-0000-000000000011', 'PUN-MC-011', 'JCB Pune Press Unit 11', 'Press', 'Fanuc Robotics Japan', 'NEO-PRESS-2026', 'JCB-MH-202611', 'Bay 2 / Line PUN-SHP-HMC', 'class_c', 'running', 4959.50, 'QR-PUN-MC-011-UID', 'High-throughput precision heavy industrial Press operational asset at JCB Pune Talegaon works.'),
  ('20000000-0000-0000-0000-00000000000c', 'c0000000-0000-0000-0000-000000000012', 'PUN-MC-012', 'JCB Pune Laser Cutter Unit 12', 'Laser Cutter', 'Mazak Corporation', 'NEO-LASERCUTTER-2026', 'JCB-MH-202612', 'Bay 3 / Line PUN-SHP-ROB', 'class_a', 'idle', 5274.00, 'QR-PUN-MC-012-UID', 'High-throughput precision heavy industrial Laser Cutter operational asset at JCB Pune Talegaon works.'),
  ('20000000-0000-0000-0000-00000000000d', 'c0000000-0000-0000-0000-000000000013', 'PUN-MC-013', 'JCB Pune Coating Booth Unit 13', 'Coating Booth', 'Fanuc Robotics Japan', 'NEO-COATINGBOOTH-2026', 'JCB-MH-202613', 'Bay 4 / Line PUN-SHP-PRS', 'class_c', 'running', 5588.50, 'QR-PUN-MC-013-UID', 'High-throughput precision heavy industrial Coating Booth operational asset at JCB Pune Talegaon works.'),
  ('20000000-0000-0000-0000-00000000000e', 'c0000000-0000-0000-0000-000000000014', 'PUN-MC-014', 'JCB Pune Assembly Rig Unit 14', 'Assembly Rig', 'Mazak Corporation', 'NEO-ASSEMBLYRIG-2026', 'JCB-MH-202614', 'Bay 5 / Line PUN-SHP-PNT', 'class_b', 'running', 5903.00, 'QR-PUN-MC-014-UID', 'High-throughput precision heavy industrial Assembly Rig operational asset at JCB Pune Talegaon works.'),
  ('20000000-0000-0000-0000-00000000000f', 'c0000000-0000-0000-0000-000000000015', 'PUN-MC-015', 'JCB Pune HMC Unit 15', 'HMC', 'Fanuc Robotics Japan', 'NEO-HMC-2026', 'JCB-MH-202615', 'Bay 1 / Line PUN-SHP-ASM', 'class_a', 'running', 6217.50, 'QR-PUN-MC-015-UID', 'High-throughput precision heavy industrial HMC operational asset at JCB Pune Talegaon works.'),
  ('20000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000011', 'PUN-MC-016', 'JCB Pune VMC Unit 16', 'VMC', 'Mazak Corporation', 'NEO-VMC-2026', 'JCB-MH-202616', 'Bay 2 / Line PUN-SHP-HMC', 'class_b', 'running', 6532.00, 'QR-PUN-MC-016-UID', 'High-throughput precision heavy industrial VMC operational asset at JCB Pune Talegaon works.'),
  ('20000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000012', 'PUN-MC-017', 'JCB Pune Robotic Welder Unit 17', 'Robotic Welder', 'Fanuc Robotics Japan', 'NEO-ROBOTICWELDER-2026', 'JCB-MH-202617', 'Bay 3 / Line PUN-SHP-ROB', 'class_c', 'running', 6846.50, 'QR-PUN-MC-017-UID', 'High-throughput precision heavy industrial Robotic Welder operational asset at JCB Pune Talegaon works.'),
  ('20000000-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-000000000013', 'PUN-MC-018', 'JCB Pune Press Unit 18', 'Press', 'Mazak Corporation', 'NEO-PRESS-2026', 'JCB-MH-202618', 'Bay 4 / Line PUN-SHP-PRS', 'class_a', 'running', 7161.00, 'QR-PUN-MC-018-UID', 'High-throughput precision heavy industrial Press operational asset at JCB Pune Talegaon works.'),
  ('20000000-0000-0000-0000-000000000013', 'c0000000-0000-0000-0000-000000000014', 'PUN-MC-019', 'JCB Pune Laser Cutter Unit 19', 'Laser Cutter', 'Fanuc Robotics Japan', 'NEO-LASERCUTTER-2026', 'JCB-MH-202619', 'Bay 5 / Line PUN-SHP-PNT', 'class_c', 'running', 7475.50, 'QR-PUN-MC-019-UID', 'High-throughput precision heavy industrial Laser Cutter operational asset at JCB Pune Talegaon works.'),
  ('20000000-0000-0000-0000-000000000014', 'c0000000-0000-0000-0000-000000000015', 'PUN-MC-020', 'JCB Pune Coating Booth Unit 20', 'Coating Booth', 'Mazak Corporation', 'NEO-COATINGBOOTH-2026', 'JCB-MH-202620', 'Bay 1 / Line PUN-SHP-ASM', 'class_b', 'running', 7790.00, 'QR-PUN-MC-020-UID', 'High-throughput precision heavy industrial Coating Booth operational asset at JCB Pune Talegaon works.'),
  ('20000000-0000-0000-0000-000000000015', 'c0000000-0000-0000-0000-000000000011', 'PUN-MC-021', 'JCB Pune Assembly Rig Unit 21', 'Assembly Rig', 'Fanuc Robotics Japan', 'NEO-ASSEMBLYRIG-2026', 'JCB-MH-202621', 'Bay 2 / Line PUN-SHP-HMC', 'class_a', 'running', 8104.50, 'QR-PUN-MC-021-UID', 'High-throughput precision heavy industrial Assembly Rig operational asset at JCB Pune Talegaon works.'),
  ('20000000-0000-0000-0000-000000000016', 'c0000000-0000-0000-0000-000000000012', 'PUN-MC-022', 'JCB Pune HMC Unit 22', 'HMC', 'Mazak Corporation', 'NEO-HMC-2026', 'JCB-MH-202622', 'Bay 3 / Line PUN-SHP-ROB', 'class_b', 'running', 8419.00, 'QR-PUN-MC-022-UID', 'High-throughput precision heavy industrial HMC operational asset at JCB Pune Talegaon works.'),
  ('20000000-0000-0000-0000-000000000017', 'c0000000-0000-0000-0000-000000000013', 'PUN-MC-023', 'JCB Pune VMC Unit 23', 'VMC', 'Fanuc Robotics Japan', 'NEO-VMC-2026', 'JCB-MH-202623', 'Bay 4 / Line PUN-SHP-PRS', 'class_c', 'running', 8733.50, 'QR-PUN-MC-023-UID', 'High-throughput precision heavy industrial VMC operational asset at JCB Pune Talegaon works.'),
  ('20000000-0000-0000-0000-000000000018', 'c0000000-0000-0000-0000-000000000014', 'PUN-MC-024', 'JCB Pune Robotic Welder Unit 24', 'Robotic Welder', 'Mazak Corporation', 'NEO-ROBOTICWELDER-2026', 'JCB-MH-202624', 'Bay 5 / Line PUN-SHP-PNT', 'class_a', 'running', 9048.00, 'QR-PUN-MC-024-UID', 'High-throughput precision heavy industrial Robotic Welder operational asset at JCB Pune Talegaon works.'),
  ('20000000-0000-0000-0000-000000000019', 'c0000000-0000-0000-0000-000000000015', 'PUN-MC-025', 'JCB Pune Press Unit 25', 'Press', 'Fanuc Robotics Japan', 'NEO-PRESS-2026', 'JCB-MH-202625', 'Bay 1 / Line PUN-SHP-ASM', 'class_c', 'running', 9362.50, 'QR-PUN-MC-025-UID', 'High-throughput precision heavy industrial Press operational asset at JCB Pune Talegaon works.'),
  ('20000000-0000-0000-0000-00000000001a', 'c0000000-0000-0000-0000-000000000011', 'PUN-MC-026', 'JCB Pune Laser Cutter Unit 26', 'Laser Cutter', 'Mazak Corporation', 'NEO-LASERCUTTER-2026', 'JCB-MH-202626', 'Bay 2 / Line PUN-SHP-HMC', 'class_b', 'running', 9677.00, 'QR-PUN-MC-026-UID', 'High-throughput precision heavy industrial Laser Cutter operational asset at JCB Pune Talegaon works.'),
  ('20000000-0000-0000-0000-00000000001b', 'c0000000-0000-0000-0000-000000000012', 'PUN-MC-027', 'JCB Pune Coating Booth Unit 27', 'Coating Booth', 'Fanuc Robotics Japan', 'NEO-COATINGBOOTH-2026', 'JCB-MH-202627', 'Bay 3 / Line PUN-SHP-ROB', 'class_a', 'running', 9991.50, 'QR-PUN-MC-027-UID', 'High-throughput precision heavy industrial Coating Booth operational asset at JCB Pune Talegaon works.'),
  ('20000000-0000-0000-0000-00000000001c', 'c0000000-0000-0000-0000-000000000013', 'PUN-MC-028', 'JCB Pune Assembly Rig Unit 28', 'Assembly Rig', 'Mazak Corporation', 'NEO-ASSEMBLYRIG-2026', 'JCB-MH-202628', 'Bay 4 / Line PUN-SHP-PRS', 'class_b', 'running', 10306.00, 'QR-PUN-MC-028-UID', 'High-throughput precision heavy industrial Assembly Rig operational asset at JCB Pune Talegaon works.'),
  ('20000000-0000-0000-0000-00000000001d', 'c0000000-0000-0000-0000-000000000014', 'PUN-MC-029', 'JCB Pune HMC Unit 29', 'HMC', 'Fanuc Robotics Japan', 'NEO-HMC-2026', 'JCB-MH-202629', 'Bay 5 / Line PUN-SHP-PNT', 'class_c', 'running', 10620.50, 'QR-PUN-MC-029-UID', 'High-throughput precision heavy industrial HMC operational asset at JCB Pune Talegaon works.'),
  ('20000000-0000-0000-0000-00000000001e', 'c0000000-0000-0000-0000-000000000015', 'PUN-MC-030', 'JCB Pune VMC Unit 30', 'VMC', 'Mazak Corporation', 'NEO-VMC-2026', 'JCB-MH-202630', 'Bay 1 / Line PUN-SHP-ASM', 'class_a', 'running', 10935.00, 'QR-PUN-MC-030-UID', 'High-throughput precision heavy industrial VMC operational asset at JCB Pune Talegaon works.')
ON CONFLICT (machine_code) DO NOTHING;

-- 5. 30 Heavy Industrial Spare Parts in JCB Pune Stores
INSERT INTO spare_parts (part_number, oem_part_number, name, description, category, subcategory, warehouse_zone, bin_location, current_physical_stock, reserved_stock, quarantined_stock, min_reorder_level, unit_cost) VALUES
  ('PUN-PRT-001', 'REX-4WRKE-25-M1', 'Bosch Rexroth 4WRKE-25 Proportional Valve (Series 1)', 'Genuine JCB OEM Bosch Rexroth 4WRKE-25 Proportional Valve engineered for high reliability in harsh manufacturing duty cycles.', 'Hydraulics', 'Proportional Valves', 'Store Bay B', 'BIN-B-01', 13, 0, 0, 6, 18550.50),
  ('PUN-PRT-002', 'SKF-7014-CE-M2', 'SKF High-Speed Ceramic Angular Contact Bearing 7014 (Series 2)', 'Genuine JCB OEM SKF High-Speed Ceramic Angular Contact Bearing 7014 engineered for high reliability in harsh manufacturing duty cycles.', 'Bearings', 'Spindle Bearings', 'Store Bay C', 'BIN-C-02', 16, 0, 0, 7, 42801.00),
  ('PUN-PRT-003', 'FAN-A06B-6114-M3', 'Fanuc Alpha i-Series Servo Drive Module (Series 3)', 'Genuine JCB OEM Fanuc Alpha i-Series Servo Drive Module engineered for high reliability in harsh manufacturing duty cycles.', 'Electrical', 'Servo Drives', 'Store Bay D', 'BIN-D-03', 19, 0, 0, 8, 89451.50),
  ('PUN-PRT-004', 'PAR-P14P-100-M4', 'Parker Denison Gold Cup Axial Piston Pump (Series 4)', 'Genuine JCB OEM Parker Denison Gold Cup Axial Piston Pump engineered for high reliability in harsh manufacturing duty cycles.', 'Hydraulics', 'High Pressure Pumps', 'Store Bay A', 'BIN-A-04', 22, 2, 0, 9, 65602.00),
  ('PUN-PRT-005', 'HAL-PU-120MM-M5', 'Hallite Polyurethane 120mm Heavy Ram Seal Kit (Series 5)', 'Genuine JCB OEM Hallite Polyurethane 120mm Heavy Ram Seal Kit engineered for high reliability in harsh manufacturing duty cycles.', 'Seals', 'Cylinder Seal Kits', 'Store Bay B', 'BIN-B-05', 25, 0, 0, 10, 7952.50),
  ('PUN-PRT-006', 'FES-ISO-24V-M6', 'Festo ISO 5599 Pneumatic Solenoid Valve 24VDC (Series 6)', 'Genuine JCB OEM Festo ISO 5599 Pneumatic Solenoid Valve 24VDC engineered for high reliability in harsh manufacturing duty cycles.', 'Pneumatics', 'Solenoid Valves', 'Store Bay C', 'BIN-C-06', 28, 0, 0, 5, 5703.00),
  ('PUN-PRT-007', 'SIE-6ES7-515F-M7', 'Siemens SIMATIC S7-1500 Fail-Safe CPU 1515F (Series 7)', 'Genuine JCB OEM Siemens SIMATIC S7-1500 Fail-Safe CPU 1515F engineered for high reliability in harsh manufacturing duty cycles.', 'Electrical', 'PLC CPU Modules', 'Store Bay D', 'BIN-D-07', 31, 0, 0, 6, 116053.50),
  ('PUN-PRT-008', 'THK-BS-4015-M8', 'THK Ground Precision Ball Screw 40mm x 1500mm (Series 8)', 'Genuine JCB OEM THK Ground Precision Ball Screw 40mm x 1500mm engineered for high reliability in harsh manufacturing duty cycles.', 'Mechanical', 'Ball Screws', 'Store Bay A', 'BIN-A-08', 34, 2, 0, 7, 59204.00),
  ('PUN-PRT-009', 'DON-P164378-M9', 'Donaldson 10-Micron Synthetic Hydraulic Return Filter (Series 9)', 'Genuine JCB OEM Donaldson 10-Micron Synthetic Hydraulic Return Filter engineered for high reliability in harsh manufacturing duty cycles.', 'Filtration', 'Oil Filters', 'Store Bay B', 'BIN-B-09', 37, 0, 0, 8, 4954.50),
  ('PUN-PRT-010', 'FRO-ROB-440W-M10', 'Fronius Robacta Drive MIG/MAG Water-Cooled Robotic Torch (Series 10)', 'Genuine JCB OEM Fronius Robacta Drive MIG/MAG Water-Cooled Robotic Torch engineered for high reliability in harsh manufacturing duty cycles.', 'Welding', 'MIG Torches', 'Store Bay C', 'BIN-C-10', 40, 0, 0, 9, 50005.00),
  ('PUN-PRT-011', 'REX-4WRKE-25-M11', 'Bosch Rexroth 4WRKE-25 Proportional Valve (Series 11)', 'Genuine JCB OEM Bosch Rexroth 4WRKE-25 Proportional Valve engineered for high reliability in harsh manufacturing duty cycles.', 'Hydraulics', 'Proportional Valves', 'Store Bay D', 'BIN-D-11', 43, 0, 0, 10, 20055.50),
  ('PUN-PRT-012', 'SKF-7014-CE-M12', 'SKF High-Speed Ceramic Angular Contact Bearing 7014 (Series 12)', 'Genuine JCB OEM SKF High-Speed Ceramic Angular Contact Bearing 7014 engineered for high reliability in harsh manufacturing duty cycles.', 'Bearings', 'Spindle Bearings', 'Store Bay A', 'BIN-A-12', 46, 2, 0, 5, 44306.00),
  ('PUN-PRT-013', 'FAN-A06B-6114-M13', 'Fanuc Alpha i-Series Servo Drive Module (Series 13)', 'Genuine JCB OEM Fanuc Alpha i-Series Servo Drive Module engineered for high reliability in harsh manufacturing duty cycles.', 'Electrical', 'Servo Drives', 'Store Bay B', 'BIN-B-13', 49, 0, 0, 6, 90956.50),
  ('PUN-PRT-014', 'PAR-P14P-100-M14', 'Parker Denison Gold Cup Axial Piston Pump (Series 14)', 'Genuine JCB OEM Parker Denison Gold Cup Axial Piston Pump engineered for high reliability in harsh manufacturing duty cycles.', 'Hydraulics', 'High Pressure Pumps', 'Store Bay C', 'BIN-C-14', 12, 0, 0, 7, 67107.00),
  ('PUN-PRT-015', 'HAL-PU-120MM-M15', 'Hallite Polyurethane 120mm Heavy Ram Seal Kit (Series 15)', 'Genuine JCB OEM Hallite Polyurethane 120mm Heavy Ram Seal Kit engineered for high reliability in harsh manufacturing duty cycles.', 'Seals', 'Cylinder Seal Kits', 'Store Bay D', 'BIN-D-15', 15, 0, 0, 8, 9457.50),
  ('PUN-PRT-016', 'FES-ISO-24V-M16', 'Festo ISO 5599 Pneumatic Solenoid Valve 24VDC (Series 16)', 'Genuine JCB OEM Festo ISO 5599 Pneumatic Solenoid Valve 24VDC engineered for high reliability in harsh manufacturing duty cycles.', 'Pneumatics', 'Solenoid Valves', 'Store Bay A', 'BIN-A-16', 18, 2, 0, 9, 7208.00),
  ('PUN-PRT-017', 'SIE-6ES7-515F-M17', 'Siemens SIMATIC S7-1500 Fail-Safe CPU 1515F (Series 17)', 'Genuine JCB OEM Siemens SIMATIC S7-1500 Fail-Safe CPU 1515F engineered for high reliability in harsh manufacturing duty cycles.', 'Electrical', 'PLC CPU Modules', 'Store Bay B', 'BIN-B-17', 21, 0, 0, 10, 117558.50),
  ('PUN-PRT-018', 'THK-BS-4015-M18', 'THK Ground Precision Ball Screw 40mm x 1500mm (Series 18)', 'Genuine JCB OEM THK Ground Precision Ball Screw 40mm x 1500mm engineered for high reliability in harsh manufacturing duty cycles.', 'Mechanical', 'Ball Screws', 'Store Bay C', 'BIN-C-18', 24, 0, 0, 5, 60709.00),
  ('PUN-PRT-019', 'DON-P164378-M19', 'Donaldson 10-Micron Synthetic Hydraulic Return Filter (Series 19)', 'Genuine JCB OEM Donaldson 10-Micron Synthetic Hydraulic Return Filter engineered for high reliability in harsh manufacturing duty cycles.', 'Filtration', 'Oil Filters', 'Store Bay D', 'BIN-D-19', 27, 0, 0, 6, 6459.50),
  ('PUN-PRT-020', 'FRO-ROB-440W-M20', 'Fronius Robacta Drive MIG/MAG Water-Cooled Robotic Torch (Series 20)', 'Genuine JCB OEM Fronius Robacta Drive MIG/MAG Water-Cooled Robotic Torch engineered for high reliability in harsh manufacturing duty cycles.', 'Welding', 'MIG Torches', 'Store Bay A', 'BIN-A-20', 30, 2, 0, 7, 51510.00),
  ('PUN-PRT-021', 'REX-4WRKE-25-M21', 'Bosch Rexroth 4WRKE-25 Proportional Valve (Series 21)', 'Genuine JCB OEM Bosch Rexroth 4WRKE-25 Proportional Valve engineered for high reliability in harsh manufacturing duty cycles.', 'Hydraulics', 'Proportional Valves', 'Store Bay B', 'BIN-B-21', 33, 0, 0, 8, 21560.50),
  ('PUN-PRT-022', 'SKF-7014-CE-M22', 'SKF High-Speed Ceramic Angular Contact Bearing 7014 (Series 22)', 'Genuine JCB OEM SKF High-Speed Ceramic Angular Contact Bearing 7014 engineered for high reliability in harsh manufacturing duty cycles.', 'Bearings', 'Spindle Bearings', 'Store Bay C', 'BIN-C-22', 36, 0, 0, 9, 45811.00),
  ('PUN-PRT-023', 'FAN-A06B-6114-M23', 'Fanuc Alpha i-Series Servo Drive Module (Series 23)', 'Genuine JCB OEM Fanuc Alpha i-Series Servo Drive Module engineered for high reliability in harsh manufacturing duty cycles.', 'Electrical', 'Servo Drives', 'Store Bay D', 'BIN-D-23', 39, 0, 0, 10, 92461.50),
  ('PUN-PRT-024', 'PAR-P14P-100-M24', 'Parker Denison Gold Cup Axial Piston Pump (Series 24)', 'Genuine JCB OEM Parker Denison Gold Cup Axial Piston Pump engineered for high reliability in harsh manufacturing duty cycles.', 'Hydraulics', 'High Pressure Pumps', 'Store Bay A', 'BIN-A-24', 42, 2, 0, 5, 68612.00),
  ('PUN-PRT-025', 'HAL-PU-120MM-M25', 'Hallite Polyurethane 120mm Heavy Ram Seal Kit (Series 25)', 'Genuine JCB OEM Hallite Polyurethane 120mm Heavy Ram Seal Kit engineered for high reliability in harsh manufacturing duty cycles.', 'Seals', 'Cylinder Seal Kits', 'Store Bay B', 'BIN-B-25', 45, 0, 0, 6, 10962.50),
  ('PUN-PRT-026', 'FES-ISO-24V-M26', 'Festo ISO 5599 Pneumatic Solenoid Valve 24VDC (Series 26)', 'Genuine JCB OEM Festo ISO 5599 Pneumatic Solenoid Valve 24VDC engineered for high reliability in harsh manufacturing duty cycles.', 'Pneumatics', 'Solenoid Valves', 'Store Bay C', 'BIN-C-26', 48, 0, 0, 7, 8713.00),
  ('PUN-PRT-027', 'SIE-6ES7-515F-M27', 'Siemens SIMATIC S7-1500 Fail-Safe CPU 1515F (Series 27)', 'Genuine JCB OEM Siemens SIMATIC S7-1500 Fail-Safe CPU 1515F engineered for high reliability in harsh manufacturing duty cycles.', 'Electrical', 'PLC CPU Modules', 'Store Bay D', 'BIN-D-27', 11, 0, 0, 8, 119063.50),
  ('PUN-PRT-028', 'THK-BS-4015-M28', 'THK Ground Precision Ball Screw 40mm x 1500mm (Series 28)', 'Genuine JCB OEM THK Ground Precision Ball Screw 40mm x 1500mm engineered for high reliability in harsh manufacturing duty cycles.', 'Mechanical', 'Ball Screws', 'Store Bay A', 'BIN-A-28', 14, 2, 0, 9, 62214.00),
  ('PUN-PRT-029', 'DON-P164378-M29', 'Donaldson 10-Micron Synthetic Hydraulic Return Filter (Series 29)', 'Genuine JCB OEM Donaldson 10-Micron Synthetic Hydraulic Return Filter engineered for high reliability in harsh manufacturing duty cycles.', 'Filtration', 'Oil Filters', 'Store Bay B', 'BIN-B-29', 17, 0, 0, 10, 7964.50),
  ('PUN-PRT-030', 'FRO-ROB-440W-M30', 'Fronius Robacta Drive MIG/MAG Water-Cooled Robotic Torch (Series 30)', 'Genuine JCB OEM Fronius Robacta Drive MIG/MAG Water-Cooled Robotic Torch engineered for high reliability in harsh manufacturing duty cycles.', 'Welding', 'MIG Torches', 'Store Bay C', 'BIN-C-30', 20, 0, 0, 5, 53015.00)
ON CONFLICT (part_number) DO NOTHING;

-- 6. 30 Real Breakdown Complaints (Reported by Maharashtrian Operators)
INSERT INTO maintenance_requests (id, complaint_number, machine_id, reported_by_id, shift, issue_category, priority, status, breakdown_occurred_at, reported_at, hour_meter_reading, temperature, pressure, problem_title, description) VALUES
  ('30000000-0000-0000-0000-000000000001', 'CMP-2026-00101', '20000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000015', 'Shift A', 'Hydraulic', 'critical', 'converted_to_wo', NOW() - INTERVAL '14 days 4 hours', NOW() - INTERVAL '14 days 3 hours 45 minutes', 1695.50, 43.50, 53.00, 'Hydraulic main relief valve chattering under load', 'During operational shift inspection by Tushar H. Shingade, anomaly detected on machine PUN-MC-001: Hydraulic main relief valve chattering under load. Immediate attention required.'),
  ('30000000-0000-0000-0000-000000000002', 'CMP-2026-00102', '20000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000016', 'Shift A', 'Mechanical', 'high', 'converted_to_wo', NOW() - INTERVAL '13 days 4 hours', NOW() - INTERVAL '13 days 3 hours 45 minutes', 2018.50, 44.50, 54.00, 'Spindle bearing high vibration alarm exceeding ISO limit', 'During operational shift inspection by Onkar S. Navale, anomaly detected on machine PUN-MC-002: Spindle bearing high vibration alarm exceeding ISO limit. Immediate attention required.'),
  ('30000000-0000-0000-0000-000000000003', 'CMP-2026-00103', '20000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000017', 'Shift A', 'Electrical', 'medium', 'converted_to_wo', NOW() - INTERVAL '12 days 4 hours', NOW() - INTERVAL '12 days 3 hours 45 minutes', 2341.50, 45.50, 55.00, 'Fanuc robot joint 3 servo collision emergency stop', 'During operational shift inspection by Vijay K. Lokhande, anomaly detected on machine PUN-MC-003: Fanuc robot joint 3 servo collision emergency stop. Immediate attention required.'),
  ('30000000-0000-0000-0000-000000000004', 'CMP-2026-00104', '20000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000018', 'Shift A', 'Pneumatic', 'low', 'converted_to_wo', NOW() - INTERVAL '11 days 4 hours', NOW() - INTERVAL '11 days 3 hours 45 minutes', 2664.50, 46.50, 56.00, '1000T hydraulic forming press ram seal oil leak', 'During operational shift inspection by Pradeep B. Wagh, anomaly detected on machine PUN-MC-004: 1000T hydraulic forming press ram seal oil leak. Immediate attention required.'),
  ('30000000-0000-0000-0000-000000000005', 'CMP-2026-00105', '20000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000019', 'Shift A', 'Automation', 'critical', 'converted_to_wo', NOW() - INTERVAL '10 days 4 hours', NOW() - INTERVAL '10 days 3 hours 45 minutes', 2987.50, 47.50, 57.00, 'Trumpf laser cutting optical head lens contamination', 'During operational shift inspection by Suraj M. Khilare, anomaly detected on machine PUN-MC-005: Trumpf laser cutting optical head lens contamination. Immediate attention required.'),
  ('30000000-0000-0000-0000-000000000006', 'CMP-2026-00106', '20000000-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-00000000001a', 'Shift A', 'Coolant', 'high', 'converted_to_wo', NOW() - INTERVAL '9 days 4 hours', NOW() - INTERVAL '9 days 3 hours 45 minutes', 3310.50, 48.50, 58.00, 'Siemens PLC Profinet communication bus fault on station 4', 'During operational shift inspection by Kiran R. Ghadge, anomaly detected on machine PUN-MC-006: Siemens PLC Profinet communication bus fault on station 4. Immediate attention required.'),
  ('30000000-0000-0000-0000-000000000007', 'CMP-2026-00107', '20000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-00000000001b', 'Shift A', 'Hydraulic', 'medium', 'converted_to_wo', NOW() - INTERVAL '8 days 4 hours', NOW() - INTERVAL '8 days 3 hours 45 minutes', 3633.50, 49.50, 59.00, 'Pneumatic die clamp cylinder pressure loss during cycle', 'During operational shift inspection by Deepak N. Choudhary, anomaly detected on machine PUN-MC-007: Pneumatic die clamp cylinder pressure loss during cycle. Immediate attention required.'),
  ('30000000-0000-0000-0000-000000000008', 'CMP-2026-00108', '20000000-0000-0000-0000-000000000008', 'f0000000-0000-0000-0000-00000000001c', 'Shift A', 'Mechanical', 'low', 'converted_to_wo', NOW() - INTERVAL '7 days 4 hours', NOW() - INTERVAL '7 days 3 hours 45 minutes', 3956.50, 50.50, 60.00, 'Chiller refrigerant leak causing spindle overtemperature', 'During operational shift inspection by Chetan P. Kore, anomaly detected on machine PUN-MC-008: Chiller refrigerant leak causing spindle overtemperature. Immediate attention required.'),
  ('30000000-0000-0000-0000-000000000009', 'CMP-2026-00109', '20000000-0000-0000-0000-000000000009', 'f0000000-0000-0000-0000-00000000001d', 'Shift A', 'Electrical', 'critical', 'converted_to_wo', NOW() - INTERVAL '6 days 4 hours', NOW() - INTERVAL '6 days 3 hours 45 minutes', 4279.50, 51.50, 61.00, 'Electrostatic powder spray gun nozzle clogging', 'During operational shift inspection by Nilesh A. Dhale, anomaly detected on machine PUN-MC-009: Electrostatic powder spray gun nozzle clogging. Immediate attention required.'),
  ('30000000-0000-0000-0000-00000000000a', 'CMP-2026-00110', '20000000-0000-0000-0000-00000000000a', 'f0000000-0000-0000-0000-00000000001e', 'Shift A', 'Pneumatic', 'high', 'converted_to_wo', NOW() - INTERVAL '5 days 4 hours', NOW() - INTERVAL '5 days 3 hours 45 minutes', 4602.50, 52.50, 62.00, 'Automatic tool changer arm stuck mid-rotation during tool 12', 'During operational shift inspection by Harsh V. Zagade, anomaly detected on machine PUN-MC-010: Automatic tool changer arm stuck mid-rotation during tool 12. Immediate attention required.'),
  ('30000000-0000-0000-0000-00000000000b', 'CMP-2026-00111', '20000000-0000-0000-0000-00000000000b', 'f0000000-0000-0000-0000-000000000015', 'Shift A', 'Automation', 'medium', 'converted_to_wo', NOW() - INTERVAL '4 days 4 hours', NOW() - INTERVAL '4 days 3 hours 45 minutes', 4925.50, 53.50, 63.00, 'Hydraulic main relief valve chattering under load', 'During operational shift inspection by Tushar H. Shingade, anomaly detected on machine PUN-MC-011: Hydraulic main relief valve chattering under load. Immediate attention required.'),
  ('30000000-0000-0000-0000-00000000000c', 'CMP-2026-00112', '20000000-0000-0000-0000-00000000000c', 'f0000000-0000-0000-0000-000000000016', 'Shift A', 'Coolant', 'low', 'converted_to_wo', NOW() - INTERVAL '3 days 4 hours', NOW() - INTERVAL '3 days 3 hours 45 minutes', 5248.50, 54.50, 64.00, 'Spindle bearing high vibration alarm exceeding ISO limit', 'During operational shift inspection by Onkar S. Navale, anomaly detected on machine PUN-MC-012: Spindle bearing high vibration alarm exceeding ISO limit. Immediate attention required.'),
  ('30000000-0000-0000-0000-00000000000d', 'CMP-2026-00113', '20000000-0000-0000-0000-00000000000d', 'f0000000-0000-0000-0000-000000000017', 'Shift A', 'Hydraulic', 'critical', 'converted_to_wo', NOW() - INTERVAL '2 days 4 hours', NOW() - INTERVAL '2 days 3 hours 45 minutes', 5571.50, 55.50, 65.00, 'Fanuc robot joint 3 servo collision emergency stop', 'During operational shift inspection by Vijay K. Lokhande, anomaly detected on machine PUN-MC-013: Fanuc robot joint 3 servo collision emergency stop. Immediate attention required.'),
  ('30000000-0000-0000-0000-00000000000e', 'CMP-2026-00114', '20000000-0000-0000-0000-00000000000e', 'f0000000-0000-0000-0000-000000000018', 'Shift A', 'Mechanical', 'high', 'converted_to_wo', NOW() - INTERVAL '1 days 4 hours', NOW() - INTERVAL '1 days 3 hours 45 minutes', 5894.50, 56.50, 66.00, '1000T hydraulic forming press ram seal oil leak', 'During operational shift inspection by Pradeep B. Wagh, anomaly detected on machine PUN-MC-014: 1000T hydraulic forming press ram seal oil leak. Immediate attention required.'),
  ('30000000-0000-0000-0000-00000000000f', 'CMP-2026-00115', '20000000-0000-0000-0000-00000000000f', 'f0000000-0000-0000-0000-000000000019', 'Shift A', 'Electrical', 'medium', 'converted_to_wo', NOW() - INTERVAL '0 days 4 hours', NOW() - INTERVAL '0 days 3 hours 45 minutes', 6217.50, 57.50, 52.00, 'Trumpf laser cutting optical head lens contamination', 'During operational shift inspection by Suraj M. Khilare, anomaly detected on machine PUN-MC-015: Trumpf laser cutting optical head lens contamination. Immediate attention required.'),
  ('30000000-0000-0000-0000-000000000010', 'CMP-2026-00116', '20000000-0000-0000-0000-000000000010', 'f0000000-0000-0000-0000-00000000001a', 'Shift A', 'Pneumatic', 'low', 'converted_to_wo', NOW() - INTERVAL '14 days 4 hours', NOW() - INTERVAL '14 days 3 hours 45 minutes', 6413.00, 58.50, 53.00, 'Siemens PLC Profinet communication bus fault on station 4', 'During operational shift inspection by Kiran R. Ghadge, anomaly detected on machine PUN-MC-016: Siemens PLC Profinet communication bus fault on station 4. Immediate attention required.'),
  ('30000000-0000-0000-0000-000000000011', 'CMP-2026-00117', '20000000-0000-0000-0000-000000000011', 'f0000000-0000-0000-0000-00000000001b', 'Shift A', 'Automation', 'critical', 'converted_to_wo', NOW() - INTERVAL '13 days 4 hours', NOW() - INTERVAL '13 days 3 hours 45 minutes', 6736.00, 59.50, 54.00, 'Pneumatic die clamp cylinder pressure loss during cycle', 'During operational shift inspection by Deepak N. Choudhary, anomaly detected on machine PUN-MC-017: Pneumatic die clamp cylinder pressure loss during cycle. Immediate attention required.'),
  ('30000000-0000-0000-0000-000000000012', 'CMP-2026-00118', '20000000-0000-0000-0000-000000000012', 'f0000000-0000-0000-0000-00000000001c', 'Shift A', 'Coolant', 'high', 'converted_to_wo', NOW() - INTERVAL '12 days 4 hours', NOW() - INTERVAL '12 days 3 hours 45 minutes', 7059.00, 60.50, 55.00, 'Chiller refrigerant leak causing spindle overtemperature', 'During operational shift inspection by Chetan P. Kore, anomaly detected on machine PUN-MC-018: Chiller refrigerant leak causing spindle overtemperature. Immediate attention required.'),
  ('30000000-0000-0000-0000-000000000013', 'CMP-2026-00119', '20000000-0000-0000-0000-000000000013', 'f0000000-0000-0000-0000-00000000001d', 'Shift A', 'Hydraulic', 'medium', 'converted_to_wo', NOW() - INTERVAL '11 days 4 hours', NOW() - INTERVAL '11 days 3 hours 45 minutes', 7382.00, 61.50, 56.00, 'Electrostatic powder spray gun nozzle clogging', 'During operational shift inspection by Nilesh A. Dhale, anomaly detected on machine PUN-MC-019: Electrostatic powder spray gun nozzle clogging. Immediate attention required.'),
  ('30000000-0000-0000-0000-000000000014', 'CMP-2026-00120', '20000000-0000-0000-0000-000000000014', 'f0000000-0000-0000-0000-00000000001e', 'Shift A', 'Mechanical', 'low', 'converted_to_wo', NOW() - INTERVAL '10 days 4 hours', NOW() - INTERVAL '10 days 3 hours 45 minutes', 7705.00, 62.50, 57.00, 'Automatic tool changer arm stuck mid-rotation during tool 12', 'During operational shift inspection by Harsh V. Zagade, anomaly detected on machine PUN-MC-020: Automatic tool changer arm stuck mid-rotation during tool 12. Immediate attention required.'),
  ('30000000-0000-0000-0000-000000000015', 'CMP-2026-00121', '20000000-0000-0000-0000-000000000015', 'f0000000-0000-0000-0000-000000000015', 'Shift A', 'Electrical', 'critical', 'in_review', NOW() - INTERVAL '9 days 4 hours', NOW() - INTERVAL '9 days 3 hours 45 minutes', 8028.00, 63.50, 58.00, 'Hydraulic main relief valve chattering under load', 'During operational shift inspection by Tushar H. Shingade, anomaly detected on machine PUN-MC-021: Hydraulic main relief valve chattering under load. Immediate attention required.'),
  ('30000000-0000-0000-0000-000000000016', 'CMP-2026-00122', '20000000-0000-0000-0000-000000000016', 'f0000000-0000-0000-0000-000000000016', 'Shift A', 'Pneumatic', 'high', 'in_review', NOW() - INTERVAL '8 days 4 hours', NOW() - INTERVAL '8 days 3 hours 45 minutes', 8351.00, 64.50, 59.00, 'Spindle bearing high vibration alarm exceeding ISO limit', 'During operational shift inspection by Onkar S. Navale, anomaly detected on machine PUN-MC-022: Spindle bearing high vibration alarm exceeding ISO limit. Immediate attention required.'),
  ('30000000-0000-0000-0000-000000000017', 'CMP-2026-00123', '20000000-0000-0000-0000-000000000017', 'f0000000-0000-0000-0000-000000000017', 'Shift A', 'Automation', 'medium', 'in_review', NOW() - INTERVAL '7 days 4 hours', NOW() - INTERVAL '7 days 3 hours 45 minutes', 8674.00, 65.50, 60.00, 'Fanuc robot joint 3 servo collision emergency stop', 'During operational shift inspection by Vijay K. Lokhande, anomaly detected on machine PUN-MC-023: Fanuc robot joint 3 servo collision emergency stop. Immediate attention required.'),
  ('30000000-0000-0000-0000-000000000018', 'CMP-2026-00124', '20000000-0000-0000-0000-000000000018', 'f0000000-0000-0000-0000-000000000018', 'Shift A', 'Coolant', 'low', 'in_review', NOW() - INTERVAL '6 days 4 hours', NOW() - INTERVAL '6 days 3 hours 45 minutes', 8997.00, 66.50, 61.00, '1000T hydraulic forming press ram seal oil leak', 'During operational shift inspection by Pradeep B. Wagh, anomaly detected on machine PUN-MC-024: 1000T hydraulic forming press ram seal oil leak. Immediate attention required.'),
  ('30000000-0000-0000-0000-000000000019', 'CMP-2026-00125', '20000000-0000-0000-0000-000000000019', 'f0000000-0000-0000-0000-000000000019', 'Shift A', 'Hydraulic', 'critical', 'in_review', NOW() - INTERVAL '5 days 4 hours', NOW() - INTERVAL '5 days 3 hours 45 minutes', 9320.00, 42.50, 62.00, 'Trumpf laser cutting optical head lens contamination', 'During operational shift inspection by Suraj M. Khilare, anomaly detected on machine PUN-MC-025: Trumpf laser cutting optical head lens contamination. Immediate attention required.'),
  ('30000000-0000-0000-0000-00000000001a', 'CMP-2026-00126', '20000000-0000-0000-0000-00000000001a', 'f0000000-0000-0000-0000-00000000001a', 'Shift A', 'Mechanical', 'high', 'in_review', NOW() - INTERVAL '4 days 4 hours', NOW() - INTERVAL '4 days 3 hours 45 minutes', 9643.00, 43.50, 63.00, 'Siemens PLC Profinet communication bus fault on station 4', 'During operational shift inspection by Kiran R. Ghadge, anomaly detected on machine PUN-MC-026: Siemens PLC Profinet communication bus fault on station 4. Immediate attention required.'),
  ('30000000-0000-0000-0000-00000000001b', 'CMP-2026-00127', '20000000-0000-0000-0000-00000000001b', 'f0000000-0000-0000-0000-00000000001b', 'Shift A', 'Electrical', 'medium', 'new', NOW() - INTERVAL '3 days 4 hours', NOW() - INTERVAL '3 days 3 hours 45 minutes', 9966.00, 44.50, 64.00, 'Pneumatic die clamp cylinder pressure loss during cycle', 'During operational shift inspection by Deepak N. Choudhary, anomaly detected on machine PUN-MC-027: Pneumatic die clamp cylinder pressure loss during cycle. Immediate attention required.'),
  ('30000000-0000-0000-0000-00000000001c', 'CMP-2026-00128', '20000000-0000-0000-0000-00000000001c', 'f0000000-0000-0000-0000-00000000001c', 'Shift A', 'Pneumatic', 'low', 'new', NOW() - INTERVAL '2 days 4 hours', NOW() - INTERVAL '2 days 3 hours 45 minutes', 10289.00, 45.50, 65.00, 'Chiller refrigerant leak causing spindle overtemperature', 'During operational shift inspection by Chetan P. Kore, anomaly detected on machine PUN-MC-028: Chiller refrigerant leak causing spindle overtemperature. Immediate attention required.'),
  ('30000000-0000-0000-0000-00000000001d', 'CMP-2026-00129', '20000000-0000-0000-0000-00000000001d', 'f0000000-0000-0000-0000-00000000001d', 'Shift A', 'Automation', 'critical', 'new', NOW() - INTERVAL '1 days 4 hours', NOW() - INTERVAL '1 days 3 hours 45 minutes', 10612.00, 46.50, 66.00, 'Electrostatic powder spray gun nozzle clogging', 'During operational shift inspection by Nilesh A. Dhale, anomaly detected on machine PUN-MC-029: Electrostatic powder spray gun nozzle clogging. Immediate attention required.'),
  ('30000000-0000-0000-0000-00000000001e', 'CMP-2026-00130', '20000000-0000-0000-0000-00000000001e', 'f0000000-0000-0000-0000-00000000001e', 'Shift A', 'Coolant', 'high', 'new', NOW() - INTERVAL '0 days 4 hours', NOW() - INTERVAL '0 days 3 hours 45 minutes', 10935.00, 47.50, 52.00, 'Automatic tool changer arm stuck mid-rotation during tool 12', 'During operational shift inspection by Harsh V. Zagade, anomaly detected on machine PUN-MC-030: Automatic tool changer arm stuck mid-rotation during tool 12. Immediate attention required.')
ON CONFLICT (complaint_number) DO NOTHING;

-- 7. 30 Work Orders (Assigned to Maharashtrian Lead Technicians & Managers)
INSERT INTO work_orders (id, wo_number, complaint_id, machine_id, assigned_technician_id, assigned_manager_id, priority, status, classification, is_major_breakdown, work_instructions, breakdown_time, reported_time, manager_ack_time, technician_assigned_time, travel_started_time, completed_at) VALUES
  ('40000000-0000-0000-0000-000000000001', 'WO-2026-00201', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-00000000000b', 'f0000000-0000-0000-0000-000000000003', 'critical', 'completed', 'minor_breakdown', false, 'Assigned Lead Technician Nitin G. Pawar to carry out precision diagnostic and repair work on JCB Pune HMC Unit 1. Supervisor: Rohan S. Kulkarni. Follow JCB Safety Lockout-Tagout (LOTO) procedure strictly.', NOW() - INTERVAL '14 days 4 hours', NOW() - INTERVAL '14 days 3 hours 45 minutes', NOW() - INTERVAL '1 days 3 hours', NOW() - INTERVAL '1 days 2 hours 30 minutes', NOW() - INTERVAL '1 days 2 hours', NOW() - INTERVAL '1 days 30 minutes'),
  ('40000000-0000-0000-0000-000000000002', 'WO-2026-00202', '30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-00000000000c', 'f0000000-0000-0000-0000-000000000004', 'high', 'completed', 'minor_breakdown', false, 'Assigned Lead Technician Vishal B. Mane to carry out precision diagnostic and repair work on JCB Pune VMC Unit 2. Supervisor: Swapnil M. Shinde. Follow JCB Safety Lockout-Tagout (LOTO) procedure strictly.', NOW() - INTERVAL '13 days 4 hours', NOW() - INTERVAL '13 days 3 hours 45 minutes', NOW() - INTERVAL '0 days 3 hours', NOW() - INTERVAL '0 days 2 hours 30 minutes', NOW() - INTERVAL '0 days 2 hours', NOW() - INTERVAL '0 days 30 minutes'),
  ('40000000-0000-0000-0000-000000000003', 'WO-2026-00203', '30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-00000000000d', 'f0000000-0000-0000-0000-000000000005', 'medium', 'in_progress', 'minor_breakdown', false, 'Assigned Lead Technician Sandeep R. Thorat to carry out precision diagnostic and repair work on JCB Pune Robotic Welder Unit 3. Supervisor: Amol V. More. Follow JCB Safety Lockout-Tagout (LOTO) procedure strictly.', NOW() - INTERVAL '12 days 4 hours', NOW() - INTERVAL '12 days 3 hours 45 minutes', NOW() - INTERVAL '13 days 3 hours', NOW() - INTERVAL '13 days 2 hours 30 minutes', NOW() - INTERVAL '13 days 2 hours', NULL),
  ('40000000-0000-0000-0000-000000000004', 'WO-2026-00204', '30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-00000000000e', 'f0000000-0000-0000-0000-000000000006', 'low', 'assigned', 'minor_breakdown', false, 'Assigned Lead Technician Dattatray P. Khot to carry out precision diagnostic and repair work on JCB Pune Press Unit 4. Supervisor: Prashant B. Chavan. Follow JCB Safety Lockout-Tagout (LOTO) procedure strictly.', NOW() - INTERVAL '11 days 4 hours', NOW() - INTERVAL '11 days 3 hours 45 minutes', NOW() - INTERVAL '12 days 3 hours', NOW() - INTERVAL '12 days 2 hours 30 minutes', NOW() - INTERVAL '12 days 2 hours', NULL),
  ('40000000-0000-0000-0000-000000000005', 'WO-2026-00205', '30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-00000000000f', 'f0000000-0000-0000-0000-000000000003', 'critical', 'pending_parts', 'major_breakdown', true, 'Assigned Lead Technician Mangesh D. Salunkhe to carry out precision diagnostic and repair work on JCB Pune Laser Cutter Unit 5. Supervisor: Rohan S. Kulkarni. Follow JCB Safety Lockout-Tagout (LOTO) procedure strictly.', NOW() - INTERVAL '10 days 4 hours', NOW() - INTERVAL '10 days 3 hours 45 minutes', NOW() - INTERVAL '11 days 3 hours', NOW() - INTERVAL '11 days 2 hours 30 minutes', NOW() - INTERVAL '11 days 2 hours', NULL),
  ('40000000-0000-0000-0000-000000000006', 'WO-2026-00206', '30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-000000000010', 'f0000000-0000-0000-0000-000000000004', 'high', 'closed', 'minor_breakdown', false, 'Assigned Lead Technician Pravin V. Sawant to carry out precision diagnostic and repair work on JCB Pune Coating Booth Unit 6. Supervisor: Swapnil M. Shinde. Follow JCB Safety Lockout-Tagout (LOTO) procedure strictly.', NOW() - INTERVAL '9 days 4 hours', NOW() - INTERVAL '9 days 3 hours 45 minutes', NOW() - INTERVAL '10 days 3 hours', NOW() - INTERVAL '10 days 2 hours 30 minutes', NOW() - INTERVAL '10 days 2 hours', NOW() - INTERVAL '10 days 30 minutes'),
  ('40000000-0000-0000-0000-000000000007', 'WO-2026-00207', '30000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000011', 'f0000000-0000-0000-0000-000000000005', 'medium', 'completed', 'minor_breakdown', false, 'Assigned Lead Technician Ajinkya C. Surve to carry out precision diagnostic and repair work on JCB Pune Assembly Rig Unit 7. Supervisor: Amol V. More. Follow JCB Safety Lockout-Tagout (LOTO) procedure strictly.', NOW() - INTERVAL '8 days 4 hours', NOW() - INTERVAL '8 days 3 hours 45 minutes', NOW() - INTERVAL '9 days 3 hours', NOW() - INTERVAL '9 days 2 hours 30 minutes', NOW() - INTERVAL '9 days 2 hours', NOW() - INTERVAL '9 days 30 minutes'),
  ('40000000-0000-0000-0000-000000000008', 'WO-2026-00208', '30000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000008', 'f0000000-0000-0000-0000-000000000012', 'f0000000-0000-0000-0000-000000000006', 'low', 'completed', 'minor_breakdown', false, 'Assigned Lead Technician Yogesh S. Kamble to carry out precision diagnostic and repair work on JCB Pune HMC Unit 8. Supervisor: Prashant B. Chavan. Follow JCB Safety Lockout-Tagout (LOTO) procedure strictly.', NOW() - INTERVAL '7 days 4 hours', NOW() - INTERVAL '7 days 3 hours 45 minutes', NOW() - INTERVAL '8 days 3 hours', NOW() - INTERVAL '8 days 2 hours 30 minutes', NOW() - INTERVAL '8 days 2 hours', NOW() - INTERVAL '8 days 30 minutes'),
  ('40000000-0000-0000-0000-000000000009', 'WO-2026-00209', '30000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000009', 'f0000000-0000-0000-0000-000000000013', 'f0000000-0000-0000-0000-000000000003', 'critical', 'in_progress', 'minor_breakdown', false, 'Assigned Lead Technician Akash N. Tambade to carry out precision diagnostic and repair work on JCB Pune VMC Unit 9. Supervisor: Rohan S. Kulkarni. Follow JCB Safety Lockout-Tagout (LOTO) procedure strictly.', NOW() - INTERVAL '6 days 4 hours', NOW() - INTERVAL '6 days 3 hours 45 minutes', NOW() - INTERVAL '7 days 3 hours', NOW() - INTERVAL '7 days 2 hours 30 minutes', NOW() - INTERVAL '7 days 2 hours', NULL),
  ('40000000-0000-0000-0000-00000000000a', 'WO-2026-00210', '30000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', 'f0000000-0000-0000-0000-000000000014', 'f0000000-0000-0000-0000-000000000004', 'high', 'assigned', 'major_breakdown', true, 'Assigned Lead Technician Siddhesh R. Gawade to carry out precision diagnostic and repair work on JCB Pune Robotic Welder Unit 10. Supervisor: Swapnil M. Shinde. Follow JCB Safety Lockout-Tagout (LOTO) procedure strictly.', NOW() - INTERVAL '5 days 4 hours', NOW() - INTERVAL '5 days 3 hours 45 minutes', NOW() - INTERVAL '6 days 3 hours', NOW() - INTERVAL '6 days 2 hours 30 minutes', NOW() - INTERVAL '6 days 2 hours', NULL),
  ('40000000-0000-0000-0000-00000000000b', 'WO-2026-00211', '30000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-00000000000b', 'f0000000-0000-0000-0000-00000000000b', 'f0000000-0000-0000-0000-000000000005', 'medium', 'pending_parts', 'minor_breakdown', false, 'Assigned Lead Technician Nitin G. Pawar to carry out precision diagnostic and repair work on JCB Pune Press Unit 11. Supervisor: Amol V. More. Follow JCB Safety Lockout-Tagout (LOTO) procedure strictly.', NOW() - INTERVAL '4 days 4 hours', NOW() - INTERVAL '4 days 3 hours 45 minutes', NOW() - INTERVAL '5 days 3 hours', NOW() - INTERVAL '5 days 2 hours 30 minutes', NOW() - INTERVAL '5 days 2 hours', NULL),
  ('40000000-0000-0000-0000-00000000000c', 'WO-2026-00212', '30000000-0000-0000-0000-00000000000c', '20000000-0000-0000-0000-00000000000c', 'f0000000-0000-0000-0000-00000000000c', 'f0000000-0000-0000-0000-000000000006', 'low', 'closed', 'minor_breakdown', false, 'Assigned Lead Technician Vishal B. Mane to carry out precision diagnostic and repair work on JCB Pune Laser Cutter Unit 12. Supervisor: Prashant B. Chavan. Follow JCB Safety Lockout-Tagout (LOTO) procedure strictly.', NOW() - INTERVAL '3 days 4 hours', NOW() - INTERVAL '3 days 3 hours 45 minutes', NOW() - INTERVAL '4 days 3 hours', NOW() - INTERVAL '4 days 2 hours 30 minutes', NOW() - INTERVAL '4 days 2 hours', NOW() - INTERVAL '4 days 30 minutes'),
  ('40000000-0000-0000-0000-00000000000d', 'WO-2026-00213', '30000000-0000-0000-0000-00000000000d', '20000000-0000-0000-0000-00000000000d', 'f0000000-0000-0000-0000-00000000000d', 'f0000000-0000-0000-0000-000000000003', 'critical', 'completed', 'minor_breakdown', false, 'Assigned Lead Technician Sandeep R. Thorat to carry out precision diagnostic and repair work on JCB Pune Coating Booth Unit 13. Supervisor: Rohan S. Kulkarni. Follow JCB Safety Lockout-Tagout (LOTO) procedure strictly.', NOW() - INTERVAL '2 days 4 hours', NOW() - INTERVAL '2 days 3 hours 45 minutes', NOW() - INTERVAL '3 days 3 hours', NOW() - INTERVAL '3 days 2 hours 30 minutes', NOW() - INTERVAL '3 days 2 hours', NOW() - INTERVAL '3 days 30 minutes'),
  ('40000000-0000-0000-0000-00000000000e', 'WO-2026-00214', '30000000-0000-0000-0000-00000000000e', '20000000-0000-0000-0000-00000000000e', 'f0000000-0000-0000-0000-00000000000e', 'f0000000-0000-0000-0000-000000000004', 'high', 'completed', 'minor_breakdown', false, 'Assigned Lead Technician Dattatray P. Khot to carry out precision diagnostic and repair work on JCB Pune Assembly Rig Unit 14. Supervisor: Swapnil M. Shinde. Follow JCB Safety Lockout-Tagout (LOTO) procedure strictly.', NOW() - INTERVAL '1 days 4 hours', NOW() - INTERVAL '1 days 3 hours 45 minutes', NOW() - INTERVAL '2 days 3 hours', NOW() - INTERVAL '2 days 2 hours 30 minutes', NOW() - INTERVAL '2 days 2 hours', NOW() - INTERVAL '2 days 30 minutes'),
  ('40000000-0000-0000-0000-00000000000f', 'WO-2026-00215', '30000000-0000-0000-0000-00000000000f', '20000000-0000-0000-0000-00000000000f', 'f0000000-0000-0000-0000-00000000000f', 'f0000000-0000-0000-0000-000000000005', 'medium', 'in_progress', 'major_breakdown', true, 'Assigned Lead Technician Mangesh D. Salunkhe to carry out precision diagnostic and repair work on JCB Pune HMC Unit 15. Supervisor: Amol V. More. Follow JCB Safety Lockout-Tagout (LOTO) procedure strictly.', NOW() - INTERVAL '0 days 4 hours', NOW() - INTERVAL '0 days 3 hours 45 minutes', NOW() - INTERVAL '1 days 3 hours', NOW() - INTERVAL '1 days 2 hours 30 minutes', NOW() - INTERVAL '1 days 2 hours', NULL),
  ('40000000-0000-0000-0000-000000000010', 'WO-2026-00216', '30000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000010', 'f0000000-0000-0000-0000-000000000010', 'f0000000-0000-0000-0000-000000000006', 'low', 'assigned', 'minor_breakdown', false, 'Assigned Lead Technician Pravin V. Sawant to carry out precision diagnostic and repair work on JCB Pune VMC Unit 16. Supervisor: Prashant B. Chavan. Follow JCB Safety Lockout-Tagout (LOTO) procedure strictly.', NOW() - INTERVAL '14 days 4 hours', NOW() - INTERVAL '14 days 3 hours 45 minutes', NOW() - INTERVAL '0 days 3 hours', NOW() - INTERVAL '0 days 2 hours 30 minutes', NOW() - INTERVAL '0 days 2 hours', NULL),
  ('40000000-0000-0000-0000-000000000011', 'WO-2026-00217', '30000000-0000-0000-0000-000000000011', '20000000-0000-0000-0000-000000000011', 'f0000000-0000-0000-0000-000000000011', 'f0000000-0000-0000-0000-000000000003', 'critical', 'pending_parts', 'minor_breakdown', false, 'Assigned Lead Technician Ajinkya C. Surve to carry out precision diagnostic and repair work on JCB Pune Robotic Welder Unit 17. Supervisor: Rohan S. Kulkarni. Follow JCB Safety Lockout-Tagout (LOTO) procedure strictly.', NOW() - INTERVAL '13 days 4 hours', NOW() - INTERVAL '13 days 3 hours 45 minutes', NOW() - INTERVAL '13 days 3 hours', NOW() - INTERVAL '13 days 2 hours 30 minutes', NOW() - INTERVAL '13 days 2 hours', NULL),
  ('40000000-0000-0000-0000-000000000012', 'WO-2026-00218', '30000000-0000-0000-0000-000000000012', '20000000-0000-0000-0000-000000000012', 'f0000000-0000-0000-0000-000000000012', 'f0000000-0000-0000-0000-000000000004', 'high', 'closed', 'minor_breakdown', false, 'Assigned Lead Technician Yogesh S. Kamble to carry out precision diagnostic and repair work on JCB Pune Press Unit 18. Supervisor: Swapnil M. Shinde. Follow JCB Safety Lockout-Tagout (LOTO) procedure strictly.', NOW() - INTERVAL '12 days 4 hours', NOW() - INTERVAL '12 days 3 hours 45 minutes', NOW() - INTERVAL '12 days 3 hours', NOW() - INTERVAL '12 days 2 hours 30 minutes', NOW() - INTERVAL '12 days 2 hours', NOW() - INTERVAL '12 days 30 minutes'),
  ('40000000-0000-0000-0000-000000000013', 'WO-2026-00219', '30000000-0000-0000-0000-000000000013', '20000000-0000-0000-0000-000000000013', 'f0000000-0000-0000-0000-000000000013', 'f0000000-0000-0000-0000-000000000005', 'medium', 'completed', 'minor_breakdown', false, 'Assigned Lead Technician Akash N. Tambade to carry out precision diagnostic and repair work on JCB Pune Laser Cutter Unit 19. Supervisor: Amol V. More. Follow JCB Safety Lockout-Tagout (LOTO) procedure strictly.', NOW() - INTERVAL '11 days 4 hours', NOW() - INTERVAL '11 days 3 hours 45 minutes', NOW() - INTERVAL '11 days 3 hours', NOW() - INTERVAL '11 days 2 hours 30 minutes', NOW() - INTERVAL '11 days 2 hours', NOW() - INTERVAL '11 days 30 minutes'),
  ('40000000-0000-0000-0000-000000000014', 'WO-2026-00220', '30000000-0000-0000-0000-000000000014', '20000000-0000-0000-0000-000000000014', 'f0000000-0000-0000-0000-000000000014', 'f0000000-0000-0000-0000-000000000006', 'low', 'completed', 'major_breakdown', true, 'Assigned Lead Technician Siddhesh R. Gawade to carry out precision diagnostic and repair work on JCB Pune Coating Booth Unit 20. Supervisor: Prashant B. Chavan. Follow JCB Safety Lockout-Tagout (LOTO) procedure strictly.', NOW() - INTERVAL '10 days 4 hours', NOW() - INTERVAL '10 days 3 hours 45 minutes', NOW() - INTERVAL '10 days 3 hours', NOW() - INTERVAL '10 days 2 hours 30 minutes', NOW() - INTERVAL '10 days 2 hours', NOW() - INTERVAL '10 days 30 minutes'),
  ('40000000-0000-0000-0000-000000000015', 'WO-2026-00221', '30000000-0000-0000-0000-000000000015', '20000000-0000-0000-0000-000000000015', 'f0000000-0000-0000-0000-00000000000b', 'f0000000-0000-0000-0000-000000000003', 'critical', 'in_progress', 'minor_breakdown', false, 'Assigned Lead Technician Nitin G. Pawar to carry out precision diagnostic and repair work on JCB Pune Assembly Rig Unit 21. Supervisor: Rohan S. Kulkarni. Follow JCB Safety Lockout-Tagout (LOTO) procedure strictly.', NOW() - INTERVAL '9 days 4 hours', NOW() - INTERVAL '9 days 3 hours 45 minutes', NOW() - INTERVAL '9 days 3 hours', NOW() - INTERVAL '9 days 2 hours 30 minutes', NOW() - INTERVAL '9 days 2 hours', NULL),
  ('40000000-0000-0000-0000-000000000016', 'WO-2026-00222', '30000000-0000-0000-0000-000000000016', '20000000-0000-0000-0000-000000000016', 'f0000000-0000-0000-0000-00000000000c', 'f0000000-0000-0000-0000-000000000004', 'high', 'assigned', 'minor_breakdown', false, 'Assigned Lead Technician Vishal B. Mane to carry out precision diagnostic and repair work on JCB Pune HMC Unit 22. Supervisor: Swapnil M. Shinde. Follow JCB Safety Lockout-Tagout (LOTO) procedure strictly.', NOW() - INTERVAL '8 days 4 hours', NOW() - INTERVAL '8 days 3 hours 45 minutes', NOW() - INTERVAL '8 days 3 hours', NOW() - INTERVAL '8 days 2 hours 30 minutes', NOW() - INTERVAL '8 days 2 hours', NULL),
  ('40000000-0000-0000-0000-000000000017', 'WO-2026-00223', '30000000-0000-0000-0000-000000000017', '20000000-0000-0000-0000-000000000017', 'f0000000-0000-0000-0000-00000000000d', 'f0000000-0000-0000-0000-000000000005', 'medium', 'pending_parts', 'minor_breakdown', false, 'Assigned Lead Technician Sandeep R. Thorat to carry out precision diagnostic and repair work on JCB Pune VMC Unit 23. Supervisor: Amol V. More. Follow JCB Safety Lockout-Tagout (LOTO) procedure strictly.', NOW() - INTERVAL '7 days 4 hours', NOW() - INTERVAL '7 days 3 hours 45 minutes', NOW() - INTERVAL '7 days 3 hours', NOW() - INTERVAL '7 days 2 hours 30 minutes', NOW() - INTERVAL '7 days 2 hours', NULL),
  ('40000000-0000-0000-0000-000000000018', 'WO-2026-00224', '30000000-0000-0000-0000-000000000018', '20000000-0000-0000-0000-000000000018', 'f0000000-0000-0000-0000-00000000000e', 'f0000000-0000-0000-0000-000000000006', 'low', 'closed', 'minor_breakdown', false, 'Assigned Lead Technician Dattatray P. Khot to carry out precision diagnostic and repair work on JCB Pune Robotic Welder Unit 24. Supervisor: Prashant B. Chavan. Follow JCB Safety Lockout-Tagout (LOTO) procedure strictly.', NOW() - INTERVAL '6 days 4 hours', NOW() - INTERVAL '6 days 3 hours 45 minutes', NOW() - INTERVAL '6 days 3 hours', NOW() - INTERVAL '6 days 2 hours 30 minutes', NOW() - INTERVAL '6 days 2 hours', NOW() - INTERVAL '6 days 30 minutes'),
  ('40000000-0000-0000-0000-000000000019', 'WO-2026-00225', '30000000-0000-0000-0000-000000000019', '20000000-0000-0000-0000-000000000019', 'f0000000-0000-0000-0000-00000000000f', 'f0000000-0000-0000-0000-000000000003', 'critical', 'completed', 'major_breakdown', true, 'Assigned Lead Technician Mangesh D. Salunkhe to carry out precision diagnostic and repair work on JCB Pune Press Unit 25. Supervisor: Rohan S. Kulkarni. Follow JCB Safety Lockout-Tagout (LOTO) procedure strictly.', NOW() - INTERVAL '5 days 4 hours', NOW() - INTERVAL '5 days 3 hours 45 minutes', NOW() - INTERVAL '5 days 3 hours', NOW() - INTERVAL '5 days 2 hours 30 minutes', NOW() - INTERVAL '5 days 2 hours', NOW() - INTERVAL '5 days 30 minutes'),
  ('40000000-0000-0000-0000-00000000001a', 'WO-2026-00226', '30000000-0000-0000-0000-00000000001a', '20000000-0000-0000-0000-00000000001a', 'f0000000-0000-0000-0000-000000000010', 'f0000000-0000-0000-0000-000000000004', 'high', 'completed', 'minor_breakdown', false, 'Assigned Lead Technician Pravin V. Sawant to carry out precision diagnostic and repair work on JCB Pune Laser Cutter Unit 26. Supervisor: Swapnil M. Shinde. Follow JCB Safety Lockout-Tagout (LOTO) procedure strictly.', NOW() - INTERVAL '4 days 4 hours', NOW() - INTERVAL '4 days 3 hours 45 minutes', NOW() - INTERVAL '4 days 3 hours', NOW() - INTERVAL '4 days 2 hours 30 minutes', NOW() - INTERVAL '4 days 2 hours', NOW() - INTERVAL '4 days 30 minutes'),
  ('40000000-0000-0000-0000-00000000001b', 'WO-2026-00227', '30000000-0000-0000-0000-00000000001b', '20000000-0000-0000-0000-00000000001b', 'f0000000-0000-0000-0000-000000000011', 'f0000000-0000-0000-0000-000000000005', 'medium', 'in_progress', 'minor_breakdown', false, 'Assigned Lead Technician Ajinkya C. Surve to carry out precision diagnostic and repair work on JCB Pune Coating Booth Unit 27. Supervisor: Amol V. More. Follow JCB Safety Lockout-Tagout (LOTO) procedure strictly.', NOW() - INTERVAL '3 days 4 hours', NOW() - INTERVAL '3 days 3 hours 45 minutes', NOW() - INTERVAL '3 days 3 hours', NOW() - INTERVAL '3 days 2 hours 30 minutes', NOW() - INTERVAL '3 days 2 hours', NULL),
  ('40000000-0000-0000-0000-00000000001c', 'WO-2026-00228', '30000000-0000-0000-0000-00000000001c', '20000000-0000-0000-0000-00000000001c', 'f0000000-0000-0000-0000-000000000012', 'f0000000-0000-0000-0000-000000000006', 'low', 'assigned', 'minor_breakdown', false, 'Assigned Lead Technician Yogesh S. Kamble to carry out precision diagnostic and repair work on JCB Pune Assembly Rig Unit 28. Supervisor: Prashant B. Chavan. Follow JCB Safety Lockout-Tagout (LOTO) procedure strictly.', NOW() - INTERVAL '2 days 4 hours', NOW() - INTERVAL '2 days 3 hours 45 minutes', NOW() - INTERVAL '2 days 3 hours', NOW() - INTERVAL '2 days 2 hours 30 minutes', NOW() - INTERVAL '2 days 2 hours', NULL),
  ('40000000-0000-0000-0000-00000000001d', 'WO-2026-00229', '30000000-0000-0000-0000-00000000001d', '20000000-0000-0000-0000-00000000001d', 'f0000000-0000-0000-0000-000000000013', 'f0000000-0000-0000-0000-000000000003', 'critical', 'pending_parts', 'minor_breakdown', false, 'Assigned Lead Technician Akash N. Tambade to carry out precision diagnostic and repair work on JCB Pune HMC Unit 29. Supervisor: Rohan S. Kulkarni. Follow JCB Safety Lockout-Tagout (LOTO) procedure strictly.', NOW() - INTERVAL '1 days 4 hours', NOW() - INTERVAL '1 days 3 hours 45 minutes', NOW() - INTERVAL '1 days 3 hours', NOW() - INTERVAL '1 days 2 hours 30 minutes', NOW() - INTERVAL '1 days 2 hours', NULL),
  ('40000000-0000-0000-0000-00000000001e', 'WO-2026-00230', '30000000-0000-0000-0000-00000000001e', '20000000-0000-0000-0000-00000000001e', 'f0000000-0000-0000-0000-000000000014', 'f0000000-0000-0000-0000-000000000004', 'high', 'closed', 'major_breakdown', true, 'Assigned Lead Technician Siddhesh R. Gawade to carry out precision diagnostic and repair work on JCB Pune VMC Unit 30. Supervisor: Swapnil M. Shinde. Follow JCB Safety Lockout-Tagout (LOTO) procedure strictly.', NOW() - INTERVAL '0 days 4 hours', NOW() - INTERVAL '0 days 3 hours 45 minutes', NOW() - INTERVAL '0 days 3 hours', NOW() - INTERVAL '0 days 2 hours 30 minutes', NOW() - INTERVAL '0 days 2 hours', NOW() - INTERVAL '0 days 30 minutes')
ON CONFLICT (wo_number) DO NOTHING;

-- 8. 30 Real Stock / Inventory Issuance Transactions (Managed by Maharashtrian Store Managers)
INSERT INTO inventory_transactions (id, spare_part_id, transaction_type, quantity, performed_by_id, reference_document, work_order_id, notes, created_at)
SELECT 
  t.id, 
  sp.id, 
  t.txn_type::inventory_transaction_type, 
  t.qty, 
  t.performed_by, 
  t.ref, 
  t.wo_id, 
  t.notes, 
  t.created_at
FROM (
  VALUES
    ('60000000-0000-0000-0000-000000000001'::uuid, 'PUN-PRT-001', 'issue', 2, 'f0000000-0000-0000-0000-000000000007'::uuid, 'REF-PUN-202601', '40000000-0000-0000-0000-000000000001'::uuid, 'Issued spare part Bosch Rexroth 4WRKE-25 Proportional Valve (Series 1) to Maintenance Work Order WO-2026-00201. Authorized by Store In-Charge Mahesh A. Gaikwad.', NOW() - INTERVAL '9 days 1 hour'),
    ('60000000-0000-0000-0000-000000000002'::uuid, 'PUN-PRT-002', 'issue', 3, 'f0000000-0000-0000-0000-000000000008'::uuid, 'REF-PUN-202602', '40000000-0000-0000-0000-000000000002'::uuid, 'Issued spare part SKF High-Speed Ceramic Angular Contact Bearing 7014 (Series 2) to Maintenance Work Order WO-2026-00202. Authorized by Store In-Charge Ganesh N. Jadhav.', NOW() - INTERVAL '8 days 1 hour'),
    ('60000000-0000-0000-0000-000000000003'::uuid, 'PUN-PRT-003', 'receipt', 4, 'f0000000-0000-0000-0000-000000000009'::uuid, 'REF-PUN-202603', '40000000-0000-0000-0000-000000000003'::uuid, 'Issued spare part Fanuc Alpha i-Series Servo Drive Module (Series 3) to Maintenance Work Order WO-2026-00203. Authorized by Store In-Charge Santosh K. Bhosale.', NOW() - INTERVAL '7 days 1 hour'),
    ('60000000-0000-0000-0000-000000000004'::uuid, 'PUN-PRT-004', 'issue', 1, 'f0000000-0000-0000-0000-00000000000a'::uuid, 'REF-PUN-202604', '40000000-0000-0000-0000-000000000004'::uuid, 'Issued spare part Parker Denison Gold Cup Axial Piston Pump (Series 4) to Maintenance Work Order WO-2026-00204. Authorized by Store In-Charge Rahul T. Kadam.', NOW() - INTERVAL '6 days 1 hour'),
    ('60000000-0000-0000-0000-000000000005'::uuid, 'PUN-PRT-005', 'issue', 2, 'f0000000-0000-0000-0000-000000000007'::uuid, 'REF-PUN-202605', '40000000-0000-0000-0000-000000000005'::uuid, 'Issued spare part Hallite Polyurethane 120mm Heavy Ram Seal Kit (Series 5) to Maintenance Work Order WO-2026-00205. Authorized by Store In-Charge Mahesh A. Gaikwad.', NOW() - INTERVAL '5 days 1 hour'),
    ('60000000-0000-0000-0000-000000000006'::uuid, 'PUN-PRT-006', 'receipt', 3, 'f0000000-0000-0000-0000-000000000008'::uuid, 'REF-PUN-202606', '40000000-0000-0000-0000-000000000006'::uuid, 'Issued spare part Festo ISO 5599 Pneumatic Solenoid Valve 24VDC (Series 6) to Maintenance Work Order WO-2026-00206. Authorized by Store In-Charge Ganesh N. Jadhav.', NOW() - INTERVAL '4 days 1 hour'),
    ('60000000-0000-0000-0000-000000000007'::uuid, 'PUN-PRT-007', 'issue', 4, 'f0000000-0000-0000-0000-000000000009'::uuid, 'REF-PUN-202607', '40000000-0000-0000-0000-000000000007'::uuid, 'Issued spare part Siemens SIMATIC S7-1500 Fail-Safe CPU 1515F (Series 7) to Maintenance Work Order WO-2026-00207. Authorized by Store In-Charge Santosh K. Bhosale.', NOW() - INTERVAL '3 days 1 hour'),
    ('60000000-0000-0000-0000-000000000008'::uuid, 'PUN-PRT-008', 'issue', 1, 'f0000000-0000-0000-0000-00000000000a'::uuid, 'REF-PUN-202608', '40000000-0000-0000-0000-000000000008'::uuid, 'Issued spare part THK Ground Precision Ball Screw 40mm x 1500mm (Series 8) to Maintenance Work Order WO-2026-00208. Authorized by Store In-Charge Rahul T. Kadam.', NOW() - INTERVAL '2 days 1 hour'),
    ('60000000-0000-0000-0000-000000000009'::uuid, 'PUN-PRT-009', 'receipt', 2, 'f0000000-0000-0000-0000-000000000007'::uuid, 'REF-PUN-202609', '40000000-0000-0000-0000-000000000009'::uuid, 'Issued spare part Donaldson 10-Micron Synthetic Hydraulic Return Filter (Series 9) to Maintenance Work Order WO-2026-00209. Authorized by Store In-Charge Mahesh A. Gaikwad.', NOW() - INTERVAL '1 days 1 hour'),
    ('60000000-0000-0000-0000-00000000000a'::uuid, 'PUN-PRT-010', 'issue', 3, 'f0000000-0000-0000-0000-000000000008'::uuid, 'REF-PUN-202610', '40000000-0000-0000-0000-00000000000a'::uuid, 'Issued spare part Fronius Robacta Drive MIG/MAG Water-Cooled Robotic Torch (Series 10) to Maintenance Work Order WO-2026-00210. Authorized by Store In-Charge Ganesh N. Jadhav.', NOW() - INTERVAL '0 days 1 hour'),
    ('60000000-0000-0000-0000-00000000000b'::uuid, 'PUN-PRT-011', 'issue', 4, 'f0000000-0000-0000-0000-000000000009'::uuid, 'REF-PUN-202611', '40000000-0000-0000-0000-00000000000b'::uuid, 'Issued spare part Bosch Rexroth 4WRKE-25 Proportional Valve (Series 11) to Maintenance Work Order WO-2026-00211. Authorized by Store In-Charge Santosh K. Bhosale.', NOW() - INTERVAL '9 days 1 hour'),
    ('60000000-0000-0000-0000-00000000000c'::uuid, 'PUN-PRT-012', 'receipt', 1, 'f0000000-0000-0000-0000-00000000000a'::uuid, 'REF-PUN-202612', '40000000-0000-0000-0000-00000000000c'::uuid, 'Issued spare part SKF High-Speed Ceramic Angular Contact Bearing 7014 (Series 12) to Maintenance Work Order WO-2026-00212. Authorized by Store In-Charge Rahul T. Kadam.', NOW() - INTERVAL '8 days 1 hour'),
    ('60000000-0000-0000-0000-00000000000d'::uuid, 'PUN-PRT-013', 'issue', 2, 'f0000000-0000-0000-0000-000000000007'::uuid, 'REF-PUN-202613', '40000000-0000-0000-0000-00000000000d'::uuid, 'Issued spare part Fanuc Alpha i-Series Servo Drive Module (Series 13) to Maintenance Work Order WO-2026-00213. Authorized by Store In-Charge Mahesh A. Gaikwad.', NOW() - INTERVAL '7 days 1 hour'),
    ('60000000-0000-0000-0000-00000000000e'::uuid, 'PUN-PRT-014', 'issue', 3, 'f0000000-0000-0000-0000-000000000008'::uuid, 'REF-PUN-202614', '40000000-0000-0000-0000-00000000000e'::uuid, 'Issued spare part Parker Denison Gold Cup Axial Piston Pump (Series 14) to Maintenance Work Order WO-2026-00214. Authorized by Store In-Charge Ganesh N. Jadhav.', NOW() - INTERVAL '6 days 1 hour'),
    ('60000000-0000-0000-0000-00000000000f'::uuid, 'PUN-PRT-015', 'receipt', 4, 'f0000000-0000-0000-0000-000000000009'::uuid, 'REF-PUN-202615', '40000000-0000-0000-0000-00000000000f'::uuid, 'Issued spare part Hallite Polyurethane 120mm Heavy Ram Seal Kit (Series 15) to Maintenance Work Order WO-2026-00215. Authorized by Store In-Charge Santosh K. Bhosale.', NOW() - INTERVAL '5 days 1 hour'),
    ('60000000-0000-0000-0000-000000000010'::uuid, 'PUN-PRT-016', 'issue', 1, 'f0000000-0000-0000-0000-00000000000a'::uuid, 'REF-PUN-202616', '40000000-0000-0000-0000-000000000010'::uuid, 'Issued spare part Festo ISO 5599 Pneumatic Solenoid Valve 24VDC (Series 16) to Maintenance Work Order WO-2026-00216. Authorized by Store In-Charge Rahul T. Kadam.', NOW() - INTERVAL '4 days 1 hour'),
    ('60000000-0000-0000-0000-000000000011'::uuid, 'PUN-PRT-017', 'issue', 2, 'f0000000-0000-0000-0000-000000000007'::uuid, 'REF-PUN-202617', '40000000-0000-0000-0000-000000000011'::uuid, 'Issued spare part Siemens SIMATIC S7-1500 Fail-Safe CPU 1515F (Series 17) to Maintenance Work Order WO-2026-00217. Authorized by Store In-Charge Mahesh A. Gaikwad.', NOW() - INTERVAL '3 days 1 hour'),
    ('60000000-0000-0000-0000-000000000012'::uuid, 'PUN-PRT-018', 'receipt', 3, 'f0000000-0000-0000-0000-000000000008'::uuid, 'REF-PUN-202618', '40000000-0000-0000-0000-000000000012'::uuid, 'Issued spare part THK Ground Precision Ball Screw 40mm x 1500mm (Series 18) to Maintenance Work Order WO-2026-00218. Authorized by Store In-Charge Ganesh N. Jadhav.', NOW() - INTERVAL '2 days 1 hour'),
    ('60000000-0000-0000-0000-000000000013'::uuid, 'PUN-PRT-019', 'issue', 4, 'f0000000-0000-0000-0000-000000000009'::uuid, 'REF-PUN-202619', '40000000-0000-0000-0000-000000000013'::uuid, 'Issued spare part Donaldson 10-Micron Synthetic Hydraulic Return Filter (Series 19) to Maintenance Work Order WO-2026-00219. Authorized by Store In-Charge Santosh K. Bhosale.', NOW() - INTERVAL '1 days 1 hour'),
    ('60000000-0000-0000-0000-000000000014'::uuid, 'PUN-PRT-020', 'issue', 1, 'f0000000-0000-0000-0000-00000000000a'::uuid, 'REF-PUN-202620', '40000000-0000-0000-0000-000000000014'::uuid, 'Issued spare part Fronius Robacta Drive MIG/MAG Water-Cooled Robotic Torch (Series 20) to Maintenance Work Order WO-2026-00220. Authorized by Store In-Charge Rahul T. Kadam.', NOW() - INTERVAL '0 days 1 hour'),
    ('60000000-0000-0000-0000-000000000015'::uuid, 'PUN-PRT-021', 'receipt', 2, 'f0000000-0000-0000-0000-000000000007'::uuid, 'REF-PUN-202621', '40000000-0000-0000-0000-000000000015'::uuid, 'Issued spare part Bosch Rexroth 4WRKE-25 Proportional Valve (Series 21) to Maintenance Work Order WO-2026-00221. Authorized by Store In-Charge Mahesh A. Gaikwad.', NOW() - INTERVAL '9 days 1 hour'),
    ('60000000-0000-0000-0000-000000000016'::uuid, 'PUN-PRT-022', 'issue', 3, 'f0000000-0000-0000-0000-000000000008'::uuid, 'REF-PUN-202622', '40000000-0000-0000-0000-000000000016'::uuid, 'Issued spare part SKF High-Speed Ceramic Angular Contact Bearing 7014 (Series 22) to Maintenance Work Order WO-2026-00222. Authorized by Store In-Charge Ganesh N. Jadhav.', NOW() - INTERVAL '8 days 1 hour'),
    ('60000000-0000-0000-0000-000000000017'::uuid, 'PUN-PRT-023', 'issue', 4, 'f0000000-0000-0000-0000-000000000009'::uuid, 'REF-PUN-202623', '40000000-0000-0000-0000-000000000017'::uuid, 'Issued spare part Fanuc Alpha i-Series Servo Drive Module (Series 23) to Maintenance Work Order WO-2026-00223. Authorized by Store In-Charge Santosh K. Bhosale.', NOW() - INTERVAL '7 days 1 hour'),
    ('60000000-0000-0000-0000-000000000018'::uuid, 'PUN-PRT-024', 'receipt', 1, 'f0000000-0000-0000-0000-00000000000a'::uuid, 'REF-PUN-202624', '40000000-0000-0000-0000-000000000018'::uuid, 'Issued spare part Parker Denison Gold Cup Axial Piston Pump (Series 24) to Maintenance Work Order WO-2026-00224. Authorized by Store In-Charge Rahul T. Kadam.', NOW() - INTERVAL '6 days 1 hour'),
    ('60000000-0000-0000-0000-000000000019'::uuid, 'PUN-PRT-025', 'issue', 2, 'f0000000-0000-0000-0000-000000000007'::uuid, 'REF-PUN-202625', '40000000-0000-0000-0000-000000000019'::uuid, 'Issued spare part Hallite Polyurethane 120mm Heavy Ram Seal Kit (Series 25) to Maintenance Work Order WO-2026-00225. Authorized by Store In-Charge Mahesh A. Gaikwad.', NOW() - INTERVAL '5 days 1 hour'),
    ('60000000-0000-0000-0000-00000000001a'::uuid, 'PUN-PRT-026', 'issue', 3, 'f0000000-0000-0000-0000-000000000008'::uuid, 'REF-PUN-202626', '40000000-0000-0000-0000-00000000001a'::uuid, 'Issued spare part Festo ISO 5599 Pneumatic Solenoid Valve 24VDC (Series 26) to Maintenance Work Order WO-2026-00226. Authorized by Store In-Charge Ganesh N. Jadhav.', NOW() - INTERVAL '4 days 1 hour'),
    ('60000000-0000-0000-0000-00000000001b'::uuid, 'PUN-PRT-027', 'receipt', 4, 'f0000000-0000-0000-0000-000000000009'::uuid, 'REF-PUN-202627', '40000000-0000-0000-0000-00000000001b'::uuid, 'Issued spare part Siemens SIMATIC S7-1500 Fail-Safe CPU 1515F (Series 27) to Maintenance Work Order WO-2026-00227. Authorized by Store In-Charge Santosh K. Bhosale.', NOW() - INTERVAL '3 days 1 hour'),
    ('60000000-0000-0000-0000-00000000001c'::uuid, 'PUN-PRT-028', 'issue', 1, 'f0000000-0000-0000-0000-00000000000a'::uuid, 'REF-PUN-202628', '40000000-0000-0000-0000-00000000001c'::uuid, 'Issued spare part THK Ground Precision Ball Screw 40mm x 1500mm (Series 28) to Maintenance Work Order WO-2026-00228. Authorized by Store In-Charge Rahul T. Kadam.', NOW() - INTERVAL '2 days 1 hour'),
    ('60000000-0000-0000-0000-00000000001d'::uuid, 'PUN-PRT-029', 'issue', 2, 'f0000000-0000-0000-0000-000000000007'::uuid, 'REF-PUN-202629', '40000000-0000-0000-0000-00000000001d'::uuid, 'Issued spare part Donaldson 10-Micron Synthetic Hydraulic Return Filter (Series 29) to Maintenance Work Order WO-2026-00229. Authorized by Store In-Charge Mahesh A. Gaikwad.', NOW() - INTERVAL '1 days 1 hour'),
    ('60000000-0000-0000-0000-00000000001e'::uuid, 'PUN-PRT-030', 'receipt', 3, 'f0000000-0000-0000-0000-000000000008'::uuid, 'REF-PUN-202630', '40000000-0000-0000-0000-00000000001e'::uuid, 'Issued spare part Fronius Robacta Drive MIG/MAG Water-Cooled Robotic Torch (Series 30) to Maintenance Work Order WO-2026-00230. Authorized by Store In-Charge Ganesh N. Jadhav.', NOW() - INTERVAL '0 days 1 hour')
) AS t(id, part_no, txn_type, qty, performed_by, ref, wo_id, notes, created_at)
JOIN spare_parts sp ON sp.part_number = t.part_no
ON CONFLICT (id) DO NOTHING;

END $$;
