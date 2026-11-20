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
