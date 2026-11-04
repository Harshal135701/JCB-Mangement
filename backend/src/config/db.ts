import { Pool } from 'pg';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Supabase URL & Keys
export const SUPABASE_URL = process.env.SUPABASE_URL || 'https://enarwtsppwwwldvtmoee.supabase.co';
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Supabase Admin Client
export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY || 'dummy_key_for_init',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

// Default Supabase PostgreSQL connection string with password Aniket@7075 URL-encoded (%40)
const DEFAULT_SUPABASE_DB_URL = 'postgresql://postgres:Aniket%407075@db.enarwtsppwwwldvtmoee.supabase.co:5432/postgres';
export const DATABASE_URL = process.env.DATABASE_URL || DEFAULT_SUPABASE_DB_URL;

// PostgreSQL Direct Pool
export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.warn('[PostgreSQL Pool Warning]:', err.message);
});

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV === 'development') {
    console.log(`[SQL Query] (${duration}ms):`, text.slice(0, 100));
  }
  return res;
};
