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
