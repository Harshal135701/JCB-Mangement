-- =====================================================================
-- JCB SMART CMMS MIGRATION 012: QC DEFECTIVE QUANTITY CHECK CONSTRAINT
-- Additive, idempotent, non-destructive migration.
-- Enforces that defective_quantity is non-negative and does not exceed
-- the total rejected and damaged quantity (since defective quantity is
-- a classified sub-category within non-conforming goods).
-- =====================================================================

ALTER TABLE grn_receipts DROP CONSTRAINT IF EXISTS chk_grn_defective_quantity;
ALTER TABLE grn_receipts ADD CONSTRAINT chk_grn_defective_quantity
  CHECK (defective_quantity >= 0 AND defective_quantity <= (rejected_quantity + COALESCE(damaged_quantity, 0)));

CREATE INDEX IF NOT EXISTS idx_grn_receipts_defective_qty ON grn_receipts(defective_quantity) WHERE defective_quantity > 0;
