import fs from 'fs';
import path from 'path';
import { pool } from './db';
import dotenv from 'dotenv';

dotenv.config();

export async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('[Migration] Starting automated database migration for JCB CMMS...');

    const schemaPath = path.resolve(__dirname, '../../../database/migrations/001_initial_schema.sql');
    const seedPath = path.resolve(__dirname, '../../../database/seeds/001_initial_seed.sql');

    if (fs.existsSync(schemaPath)) {
      console.log('[Migration] Executing 001_initial_schema.sql...');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await client.query(schemaSql);
      console.log('[Migration] Schema created successfully.');
    } else {
      console.warn('[Migration Warning] Schema file not found at:', schemaPath);
    }

    if (fs.existsSync(seedPath)) {
      console.log('[Migration] Executing 001_initial_seed.sql...');
      const seedSql = fs.readFileSync(seedPath, 'utf8');
      await client.query(seedSql);
      console.log('[Migration] Initial seed data inserted successfully.');
    }

    console.log('[Migration] All migrations completed successfully!');
  } catch (err: any) {
    console.error('[Migration Error]:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
