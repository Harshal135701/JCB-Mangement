
require('dotenv').config();

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function readHidden(prompt) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;

    if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
      reject(new Error('Run this script in an interactive CMD terminal.'));
      return;
    }

    let password = '';
    process.stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    function cleanup() {
      stdin.removeListener('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write('\n');
    }

    function onData(chunk) {
      for (const char of chunk) {
        if (char === '\u0003') {
          cleanup();
          reject(new Error('Cancelled.'));
          return;
        }

        if (char === '\r' || char === '\n') {
          cleanup();
          resolve(password);
          return;
        }

        if (char === '\u007f' || char === '\b') {
          password = password.slice(0, -1);
        } else {
          password += char;
        }
      }
    }

    stdin.on('data', onData);
  });
}

async function createAdmin() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing. Check backend/.env');
  }

  const email = 'admin@jcb.com';
  const employeeCode = 'JCB-ADMIN-001';
  const fullName = 'JCB Administrator';

  const password = await readHidden('Enter admin password: ');

  if (password.length < 12 || password.length > 128) {
    throw new Error('Password must be between 12 and 128 characters.');
  }

  const confirm = await readHidden('Confirm admin password: ');

  if (password !== confirm) {
    throw new Error('Passwords do not match.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existing = await client.query(
      `SELECT id, email, employee_code
       FROM public.users
       WHERE LOWER(email) = LOWER($1) OR employee_code = $2`,
      [email, employeeCode]
    );

    if (existing.rowCount > 0) {
      throw new Error('Admin email or employee code already exists.');
    }

    const result = await client.query(
      `INSERT INTO public.users
       (employee_code, full_name, email, role, password_hash,
        is_active, is_available, shift, skills_json, max_active_assignments)
       VALUES ($1, $2, $3, 'admin', $4, TRUE, TRUE, 'Shift A', '[]'::jsonb, 5)
       RETURNING id, employee_code, full_name, email, role`,
      [employeeCode, fullName, email, passwordHash]
    );

    await client.query('COMMIT');

    console.log('\nAdmin created successfully!');
    console.table(result.rows);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

createAdmin()
  .catch((error) => {
    console.error('\nAdmin creation failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
