-- =====================================================================
-- JCB SMART CMMS MIGRATION 011: PROCUREMENT SHIPMENT & QC ENHANCEMENTS
-- Additive, idempotent, non-destructive migration.
-- 1. Adds shipment and transportation tracking columns to purchase_requisitions.
-- 2. Adds shipment, transportation, and QC inspection columns to grn_receipts.
-- 3. Updates grn_receipts check constraint to support damaged/defective quantities.
-- =====================================================================

-- 1. Extend purchase_requisitions with realistic Shipment & Transportation Details
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS dispatch_location VARCHAR(255);
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS destination_plant_name VARCHAR(255);
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS transport_mode VARCHAR(100);
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS freight_cost NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS overall_shipment_cost NUMERIC(12, 2) DEFAULT 0.00;

-- 2. Extend grn_receipts with verified Shipment, Transportation, and QC Inspection Details
ALTER TABLE grn_receipts ADD COLUMN IF NOT EXISTS dispatch_location VARCHAR(255);
ALTER TABLE grn_receipts ADD COLUMN IF NOT EXISTS destination_plant_name VARCHAR(255);
ALTER TABLE grn_receipts ADD COLUMN IF NOT EXISTS transport_mode VARCHAR(100);
ALTER TABLE grn_receipts ADD COLUMN IF NOT EXISTS transporter_name VARCHAR(255);
ALTER TABLE grn_receipts ADD COLUMN IF NOT EXISTS freight_cost NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE grn_receipts ADD COLUMN IF NOT EXISTS overall_shipment_cost NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE grn_receipts ADD COLUMN IF NOT EXISTS damaged_quantity INT NOT NULL DEFAULT 0;
ALTER TABLE grn_receipts ADD COLUMN IF NOT EXISTS defective_quantity INT NOT NULL DEFAULT 0;
ALTER TABLE grn_receipts ADD COLUMN IF NOT EXISTS inspection_status VARCHAR(50) DEFAULT 'passed';
ALTER TABLE grn_receipts ADD COLUMN IF NOT EXISTS inspection_remarks TEXT;

-- 3. Update grn_receipts quantity constraint to include damaged quantity
ALTER TABLE grn_receipts DROP CONSTRAINT IF EXISTS chk_grn_quantities;
ALTER TABLE grn_receipts ADD CONSTRAINT chk_grn_quantities
  CHECK (received_quantity = accepted_quantity + rejected_quantity + COALESCE(damaged_quantity, 0));

-- Ensure damaged_quantity is non-negative
ALTER TABLE grn_receipts DROP CONSTRAINT IF EXISTS chk_grn_damaged_quantity;
ALTER TABLE grn_receipts ADD CONSTRAINT chk_grn_damaged_quantity
  CHECK (damaged_quantity >= 0);

-- 4. Create Indexes for fast retrieval
CREATE INDEX IF NOT EXISTS idx_purchase_req_transport_mode ON purchase_requisitions(transport_mode) WHERE transport_mode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_grn_receipts_inspection_status ON grn_receipts(inspection_status) WHERE inspection_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_grn_receipts_transport_mode ON grn_receipts(transport_mode) WHERE transport_mode IS NOT NULL;
