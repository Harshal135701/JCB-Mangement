const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DATABASE_URL = 'postgresql://postgres:Aniket%407075@db.enarwtsppwwwldvtmoee.supabase.co:5432/postgres';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    console.log('Connecting to Supabase PostgreSQL...');
    const test = await pool.query('SELECT NOW()');
    console.log('Connected! Server time:', test.rows[0].now);

    console.log('Reading migration file...');
    const schemaSql = fs.readFileSync(path.join(__dirname, '../../database/migrations/001_initial_schema.sql'), 'utf8');
    console.log('Executing schema migration...');
    await pool.query(schemaSql);
    console.log('Schema migration completed successfully!');

    console.log('Reading seeds file...');
    const seedSql = fs.readFileSync(path.join(__dirname, '../../database/seeds/001_initial_seed.sql'), 'utf8');
    console.log('Executing seed data...');
    await pool.query(seedSql);
    console.log('Seed data inserted successfully!');

    const tablesRes = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
    console.log('All Public Tables in Supabase:', tablesRes.rows.map(r => r.table_name));

    const usersRes = await pool.query('SELECT email, role, full_name FROM users');
    console.log('Seeded Users in DB:', usersRes.rows);

    const machinesRes = await pool.query('SELECT count(*) FROM machines');
    console.log('Seeded Machines Count:', machinesRes.rows[0].count);

    const partsRes = await pool.query('SELECT count(*) FROM spare_parts');
    console.log('Seeded Spare Parts Count:', partsRes.rows[0].count);

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
  }
}

main();

