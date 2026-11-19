require('dotenv').config({
  path: require('path').join(__dirname, '../.env'),
  override: true
});
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function applyMigrations() {
  const client = await pool.connect();
  try {
    console.log('Testing connection to PostgreSQL...');
    const now = await client.query('SELECT NOW()');
    console.log('Connected! Server time:', now.rows[0].now);

    console.log('\n--- Checking Migration 014 ---');
    const m14Path = path.join(__dirname, '../../database/migrations/014_operator_signup_and_approval.sql');
    const m14Sql = fs.readFileSync(m14Path, 'utf8');
    await client.query(m14Sql);
    console.log('Migration 014 applied successfully.');

    console.log('\n--- Applying Migration 015 ---');
    const m15Path = path.join(__dirname, '../../database/migrations/015_operator_machine_signin_and_approval.sql');
    const m15Sql = fs.readFileSync(m15Path, 'utf8');
    await client.query(m15Sql);
    console.log('Migration 015 applied successfully.');

    console.log('\n--- Applying Migration 016 ---');
    const m16Path = path.join(__dirname, '../../database/migrations/016_operator_signup_requested_machine.sql');
    const m16Sql = fs.readFileSync(m16Path, 'utf8');
    await client.query(m16Sql);
    console.log('Migration 016 applied successfully.');

    console.log('\n--- Applying Migration 017 ---');
    const m17Path = path.join(__dirname, '../../database/migrations/017_operator_permanent_and_temporary_assignment.sql');
    const m17Sql = fs.readFileSync(m17Path, 'utf8');
    await client.query(m17Sql);
    console.log('Migration 017 applied successfully.');

    console.log('\n--- Verifying Schema ---');
    const omaCheck = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'operator_machine_assignments' 
      ORDER BY ordinal_position
    `);
    console.log('operator_machine_assignments columns count:', omaCheck.rows.length);
    console.table(omaCheck.rows);

    const userColCheck = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name IN ('requested_machine_id', 'permanent_machine_id', 'approval_status', 'approved_by', 'approved_at', 'rejection_reason')
      ORDER BY column_name
    `);
    console.log('users columns verified:');
    console.table(userColCheck.rows);

    const machineColCheck = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'machines' AND column_name IN ('current_operator_id', 'assignment_status', 'current_assignment_id')
      ORDER BY column_name
    `);
    console.log('machines columns verified:');
    console.table(machineColCheck.rows);

    const indexCheck = await client.query(`
      SELECT indexname, tablename
      FROM pg_indexes 
      WHERE tablename IN ('operator_machine_assignments', 'users', 'machines')
        AND indexname IN (
          'idx_oma_operator_id', 'idx_oma_machine_id', 'idx_oma_shop_id', 'idx_oma_plant_id',
          'idx_oma_status', 'idx_oma_plant_status', 'idx_unique_active_or_pending_machine',
          'idx_unique_active_or_pending_operator', 'idx_machines_current_operator',
          'idx_machines_assignment_status', 'idx_users_requested_machine', 'idx_users_approval_status'
        )
      ORDER BY tablename, indexname
    `);
    console.log('Verified indexes:');
    console.table(indexCheck.rows);

  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

applyMigrations();
