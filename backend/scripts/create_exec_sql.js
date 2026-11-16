require('dotenv').config({ path: 'd:/jcb project/jcb/backend/.env' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function createFunc() {
  const sql = `
    CREATE OR REPLACE FUNCTION public.exec_sql(query_text text)
    RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    DECLARE
      result jsonb;
      trimmed_query text;
      upper_query text;
    BEGIN
      trimmed_query := rtrim(trim(query_text), '; ');
      upper_query := upper(trimmed_query);

      -- If query has RETURNING clause (e.g. INSERT ... RETURNING * or UPDATE ... RETURNING *)
      IF upper_query LIKE '%RETURNING%' THEN
        EXECUTE 'WITH affected_rows AS (' || trimmed_query || ') SELECT coalesce(jsonb_agg(to_jsonb(affected_rows)), jsonb_build_array()) FROM affected_rows' INTO result;
        RETURN result;
      END IF;

      -- If query is a SELECT
      IF upper_query LIKE 'SELECT%' OR upper_query LIKE 'WITH%' THEN
        EXECUTE 'SELECT coalesce(jsonb_agg(to_jsonb(t)), jsonb_build_array()) FROM (' || trimmed_query || ') t' INTO result;
        RETURN result;
      END IF;

      -- Non-returning statements (INSERT, UPDATE, DELETE, DDL)
      EXECUTE trimmed_query;
      RETURN jsonb_build_array(jsonb_build_object('success', true));
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION '%', SQLERRM;
    END;
    $$;
  `;
  try {
    await pool.query(sql);
    console.log('Successfully updated public.exec_sql with rtrim in Supabase!');
  } catch(e) {
    console.error('Error updating function:', e.message);
  } finally {
    await pool.end();
  }
}
createFunc();
