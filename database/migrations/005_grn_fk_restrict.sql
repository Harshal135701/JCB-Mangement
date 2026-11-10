-- =====================================================================
-- JCB SMART CMMS MIGRATION 005: STRENGTHEN GRN AUDIT INTEGRITY
-- Changes foreign key constraint on grn_receipts(pr_id) from 
-- ON DELETE CASCADE to ON DELETE RESTRICT to preserve regulatory audit trails.
-- =====================================================================

DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  -- 1. Identify existing foreign key constraint referencing purchase_requisitions
  SELECT tc.constraint_name INTO v_constraint_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name 
    AND tc.table_schema = kcu.table_schema
  WHERE tc.table_name = 'grn_receipts'
    AND kcu.column_name = 'pr_id'
    AND tc.constraint_type = 'FOREIGN KEY'
  LIMIT 1;

  -- 2. Drop existing constraint if present
  IF v_constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE grn_receipts DROP CONSTRAINT ' || quote_ident(v_constraint_name);
  END IF;

  -- 3. Re-add with ON DELETE RESTRICT
  ALTER TABLE grn_receipts
    ADD CONSTRAINT grn_receipts_pr_id_fkey
    FOREIGN KEY (pr_id) REFERENCES purchase_requisitions(id)
    ON DELETE RESTRICT;
END $$;
