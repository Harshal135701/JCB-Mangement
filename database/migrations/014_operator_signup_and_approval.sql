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
