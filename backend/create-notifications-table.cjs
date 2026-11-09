
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        recipient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'info'
          CHECK (LOWER(type) IN (
            'info', 'warning', 'critical', 'assignment',
            'approval', 'system', 'alert'
          )),
        is_read BOOLEAN DEFAULT FALSE,
        link_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        entity_type VARCHAR(50),
        entity_id UUID,
        plant_id UUID REFERENCES public.plants(id) ON DELETE SET NULL,
        shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
        read_at TIMESTAMPTZ
      );

      CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
      ON public.notifications(recipient_id, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_notifications_unread
      ON public.notifications(recipient_id)
      WHERE is_read = FALSE;

      CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
      ON public.notifications(recipient_id, is_read, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_notifications_recipient_type
      ON public.notifications(recipient_id, type, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_notifications_entity
      ON public.notifications(entity_type, entity_id)
      WHERE entity_type IS NOT NULL;
    `);

    await client.query('COMMIT');
    console.log('SUCCESS: Notifications table and indexes created.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('FAILED:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
