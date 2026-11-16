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
