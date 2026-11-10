import fs from 'fs';
import path from 'path';
import { pool } from './db';
import dotenv from 'dotenv';

dotenv.config();

export async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('[Migration] Starting automated database migration for JCB CMMS...');

    const migrationsDir = path.resolve(__dirname, '../../../database/migrations');
    const seedPath = path.resolve(__dirname, '../../../database/seeds/001_initial_seed.sql');

    if (fs.existsSync(migrationsDir)) {
      const migrationFiles = fs
        .readdirSync(migrationsDir)
        .filter((file) => file.endsWith('.sql'))
        .sort();

      for (const file of migrationFiles) {
        const filePath = path.join(migrationsDir, file);
        console.log(`[Migration] Executing migration ${file}...`);
        const sql = fs.readFileSync(filePath, 'utf8');
        await client.query(sql);
        console.log(`[Migration] Migration ${file} executed successfully.`);
      }
    } else {
      console.warn('[Migration Warning] Migrations directory not found at:', migrationsDir);
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
