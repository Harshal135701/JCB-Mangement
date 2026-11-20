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
