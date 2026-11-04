import { Pool } from 'pg';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from './env';

// Database URL read strictly from validated configuration
export const DATABASE_URL = config.databaseUrl;

// Supabase URL & Keys strictly from environment (no hardcoded credentials or fallbacks)
export const SUPABASE_URL = process.env.SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Supabase Client initialized only when valid environment credentials are provided
export const supabase: SupabaseClient | null =
  SUPABASE_URL && (SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY)
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : null;

// PostgreSQL Direct Pool using environment credentials only
export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  // Safe warning logging without exposing connection strings or passwords
  console.warn('[PostgreSQL Pool Warning]:', err.message);
});

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (config.nodeEnv === 'development') {
    // Log statement type and timing without logging parameters that could contain sensitive values
    const queryHeader = text.trim().split(/\s+/).slice(0, 3).join(' ');
    console.log(`[SQL Query] (${duration}ms): ${queryHeader}...`);
  }
  return res;
};
