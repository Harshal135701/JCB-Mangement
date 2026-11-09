-- =====================================================================
-- JCB SMART CMMS MIGRATION 003: REAL-TIME NOTIFICATIONS ENHANCEMENT
-- Enhances notifications schema with entity context, plant/shop isolation,
-- read timestamps, and high-performance filtering indexes.
-- =====================================================================

-- 1. Extend notifications table with relational entity links & facility context
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS entity_id UUID;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS plant_id UUID REFERENCES plants(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES shops(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- 2. Performance Indexes for Real-Time Notification Retrieval & Inbox Queries
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread 
  ON notifications(recipient_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_type 
  ON notifications(recipient_id, type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_entity 
  ON notifications(entity_type, entity_id) 
  WHERE entity_type IS NOT NULL;
