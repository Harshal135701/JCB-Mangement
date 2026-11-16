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
