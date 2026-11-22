const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const url = 'postgresql://postgres.loxyaxyjnripthmabxne:Aniket%40%257075@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres';
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

async function run() {
  console.log('Connecting to Supabase at aws-1-ap-northeast-1...');
  
  // 1. Grants
  console.log('1. Applying grants to public schema...');
  const grantSql = `
    GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
    GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO postgres, anon, authenticated, service_role;
  `;
  await pool.query(grantSql);
  console.log('Grants successfully applied!');

  // 2. Check users count
  const countBefore = await pool.query('SELECT count(*) FROM users;');
  console.log('Users count before seed:', countBefore.rows[0].count);

  if (parseInt(countBefore.rows[0].count, 10) === 0) {
    console.log('2. Running 002_maharashtra_enterprise_seed.sql...');
    const seedPath = path.join(__dirname, '../seeds/002_maharashtra_enterprise_seed.sql');
    const seedSql = fs.readFileSync(seedPath, 'utf8');
    await pool.query(seedSql);
    console.log('Seed executed successfully!');
  } else {
    console.log('Users already exist in database, skipping seed insertion.');
  }

  // 3. Verify counts
  const tables = ['plants', 'shops', 'users', 'machines', 'spare_parts', 'maintenance_requests', 'work_orders'];
  for (const t of tables) {
    try {
      const res = await pool.query(`SELECT count(*) FROM ${t};`);
      console.log(`Table ${t.padEnd(25)}: ${res.rows[0].count} records`);
    } catch (e) {
      console.log(`Table ${t.padEnd(25)}: ERROR - ${e.message}`);
    }
  }

  await pool.end();
  console.log('All operations complete!');
}

run().catch(err => {
  console.error('Fatal error:', err);
  pool.end();
});
