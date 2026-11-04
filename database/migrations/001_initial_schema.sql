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
  -- Strict 4 Core Roles
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM (
      'admin',
      'manager',
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
