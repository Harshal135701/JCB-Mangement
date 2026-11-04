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

// PostgreSQL Direct Pool
// If DATABASE_URL is not set on cloud (e.g. Vercel), don't fail immediately, handle pool creation safely
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  ssl: process.env.NODE_ENV === 'production' || process.env.DATABASE_URL?.includes('supabase.co') 
    ? { rejectUnauthorized: false } 
    : false,
});

pool.on('error', (err) => {
  console.warn('[PostgreSQL Pool Warning]:', err.message);
});

export const query = async (text: string, params?: any[]) => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is missing in server environment.');
  }

  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV === 'development') {
    console.log(`[SQL Query] (${duration}ms):`, text.slice(0, 100));
  }
  return res;
};
