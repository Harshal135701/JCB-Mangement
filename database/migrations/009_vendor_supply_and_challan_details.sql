-- =====================================================================
-- JCB SMART CMMS MIGRATION 009: VENDOR SUPPLY & CHALLAN DETAILS
-- Enhances Purchase Orders & Goods Receipt Note (GRN) with vendor supply,
-- delivery document, challan classification, and transport metadata.
-- =====================================================================

-- 1. Extend purchase_requisitions with Vendor Supply & Delivery Details
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS supply_method VARCHAR(100);
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS delivery_document_type VARCHAR(100);
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS challan_type VARCHAR(50);
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS vendor_challan_number VARCHAR(100);
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS expected_dispatch_date DATE;
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS transporter_name VARCHAR(255);
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS vehicle_number VARCHAR(100);
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS lr_tracking_number VARCHAR(100);
ALTER TABLE purchase_requisitions ADD COLUMN IF NOT EXISTS delivery_remarks TEXT;

-- 2. Extend grn_receipts with verified receipt document and carrier details
ALTER TABLE grn_receipts ADD COLUMN IF NOT EXISTS vendor_challan_number VARCHAR(100);
ALTER TABLE grn_receipts ADD COLUMN IF NOT EXISTS supply_method VARCHAR(100);
ALTER TABLE grn_receipts ADD COLUMN IF NOT EXISTS delivery_document_type VARCHAR(100);
ALTER TABLE grn_receipts ADD COLUMN IF NOT EXISTS challan_type VARCHAR(50);
ALTER TABLE grn_receipts ADD COLUMN IF NOT EXISTS vehicle_number VARCHAR(100);
ALTER TABLE grn_receipts ADD COLUMN IF NOT EXISTS lr_tracking_number VARCHAR(100);
ALTER TABLE grn_receipts ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_purchase_req_vendor_challan ON purchase_requisitions(vendor_challan_number) WHERE vendor_challan_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_req_supply_method ON purchase_requisitions(supply_method) WHERE supply_method IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_grn_receipts_challan_no ON grn_receipts(vendor_challan_number) WHERE vendor_challan_number IS NOT NULL;
