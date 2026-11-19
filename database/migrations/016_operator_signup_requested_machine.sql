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
