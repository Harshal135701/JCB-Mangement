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
