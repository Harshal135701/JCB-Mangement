-- =====================================================================
-- JCB SMART CMMS MIGRATION 007: STORE MANAGER ROLE & ADVANCED INVENTORY
-- Safe, additive, idempotent, non-destructive migration.
-- 1. Adds 'store_manager' to user_role enum.
-- 2. Adds plant_id to spare_parts for store/plant isolation.
-- 3. Creates stock_transfers ledger for inter-location movements.
-- 4. Creates damaged_stock_items for damaged/expired quarantine tracking.
-- 5. Creates vendors master table for procurement vendor management.
-- =====================================================================

-- 1. Add 'store_manager' to user_role enum safely
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
    WHERE pg_type.typname = 'user_role' AND pg_enum.enumlabel = 'store_manager'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'store_manager' AFTER 'manager';
  END IF;
END $$;

-- 2. Add plant_id to spare_parts catalog for multi-plant store isolation
ALTER TABLE spare_parts ADD COLUMN IF NOT EXISTS plant_id UUID REFERENCES plants(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_spare_parts_plant_id ON spare_parts(plant_id);

-- Backfill existing spare parts to default Ballabgarh plant if null
UPDATE spare_parts
SET plant_id = 'b0000000-0000-0000-0000-000000000001'
WHERE plant_id IS NULL AND EXISTS (SELECT 1 FROM plants WHERE id = 'b0000000-0000-0000-0000-000000000001');

-- 3. Create stock_transfers table (Inter-bin, inter-zone, inter-plant movements)
CREATE TABLE IF NOT EXISTS stock_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transfer_number VARCHAR(50) UNIQUE NOT NULL, -- TRF-YYYY-XXXXX
  part_id UUID NOT NULL REFERENCES spare_parts(id) ON DELETE RESTRICT,
  source_plant_id UUID REFERENCES plants(id) ON DELETE SET NULL,
  destination_plant_id UUID REFERENCES plants(id) ON DELETE SET NULL,
  source_location VARCHAR(100) NOT NULL,
  destination_location VARCHAR(100) NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  status VARCHAR(50) NOT NULL DEFAULT 'completed' CHECK (LOWER(status) IN ('pending', 'in_transit', 'completed', 'cancelled')),
  transferred_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  received_by UUID REFERENCES users(id) ON DELETE SET NULL,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_transfers_part_id ON stock_transfers(part_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_source_plant ON stock_transfers(source_plant_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_destination_plant ON stock_transfers(destination_plant_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_created_at ON stock_transfers(created_at DESC);

-- 4. Create damaged_stock_items table (Damaged, expired, obsolete stock tracking)
CREATE TABLE IF NOT EXISTS damaged_stock_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_number VARCHAR(50) UNIQUE NOT NULL, -- DMG-YYYY-XXXXX
  part_id UUID NOT NULL REFERENCES spare_parts(id) ON DELETE RESTRICT,
  plant_id UUID REFERENCES plants(id) ON DELETE SET NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  damage_type VARCHAR(50) NOT NULL CHECK (LOWER(damage_type) IN ('damaged', 'expired', 'obsolete', 'defective', 'scrap')),
  disposition VARCHAR(50) NOT NULL DEFAULT 'quarantined' CHECK (LOWER(disposition) IN ('quarantined', 'scrapped', 'returned_to_vendor', 'written_off')),
  reason TEXT NOT NULL,
  location VARCHAR(100),
  batch_lot_number VARCHAR(100),
  reported_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_damaged_stock_part_id ON damaged_stock_items(part_id);
CREATE INDEX IF NOT EXISTS idx_damaged_stock_plant_id ON damaged_stock_items(plant_id);
CREATE INDEX IF NOT EXISTS idx_damaged_stock_created_at ON damaged_stock_items(created_at DESC);

-- 5. Create vendors master table
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  gstin VARCHAR(50),
  payment_terms VARCHAR(100) DEFAULT 'Net 30',
  status VARCHAR(20) DEFAULT 'active' CHECK (LOWER(status) IN ('active', 'inactive', 'blacklisted')),
  plant_id UUID REFERENCES plants(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendors_name ON vendors(name);
CREATE INDEX IF NOT EXISTS idx_vendors_status ON vendors(status);

-- 6. Populate default vendors if table is newly created
INSERT INTO vendors (vendor_code, name, contact_person, email, phone, address, gstin, payment_terms, status)
VALUES
  ('VEN-001', 'JCB Genuine Parts', 'Operations Head', 'genuine.spares@jcb.com', '+91-129-4299100', 'Plot 23/7 Mathura Road, Ballabgarh, Haryana', '06AAACJ1234F1Z1', 'Net 30', 'active'),
  ('VEN-002', 'Bosch Rexroth India', 'Industrial Sales', 'sales@boschrexroth.co.in', '+91-80-67500000', 'Sanand Industrial Estate, Ahmedabad, Gujarat', '24AAACB9876G1Z2', 'Net 45', 'active'),
  ('VEN-003', 'SKF India Limited', 'Industrial Bearings Div', 'spares@skf.com', '+91-20-66112500', 'Chinchwad, Pune, Maharashtra', '27AAACS4321H1Z3', 'Net 30', 'active'),
  ('VEN-004', 'Fanuc India Private Limited', 'Automation Service Desk', 'service@fanucindia.com', '+91-80-40521200', 'Electronic City, Bengaluru, Karnataka', '29AAACF5544J1Z4', 'Net 60', 'active'),
  ('VEN-005', 'Parker Hannifin India', 'Fluid Power Division', 'orders@parker.com', '+91-22-65137000', 'Mahape, Navi Mumbai, Maharashtra', '27AAACP9988K1Z5', 'Net 30', 'active')
ON CONFLICT (vendor_code) DO NOTHING;
