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
