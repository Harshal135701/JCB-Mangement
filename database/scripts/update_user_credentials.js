const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../backend/.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.loxyaxyjnripthmabxne:Aniket%40%257075@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

const newPassword = 'ValidPassword123!';

const emailMapping = [
  // Admins
  { code: 'EMP-MAH-001', newEmail: 'admin@jcb.com' },
  { code: 'EMP-MAH-002', newEmail: 'admin2@jcb.com' },

  // Managers
  { code: 'EMP-MAH-003', newEmail: 'manager@jcb.com' },
  { code: 'EMP-MAH-004', newEmail: 'manager2@jcb.com' },
  { code: 'EMP-MAH-005', newEmail: 'manager3@jcb.com' },
  { code: 'EMP-MAH-006', newEmail: 'manager4@jcb.com' },

  // Store Managers
  { code: 'EMP-MAH-007', newEmail: 'store@jcb.com' },
  { code: 'EMP-MAH-008', newEmail: 'store2@jcb.com' },
  { code: 'EMP-MAH-009', newEmail: 'store3@jcb.com' },
  { code: 'EMP-MAH-010', newEmail: 'store4@jcb.com' },

  // Technicians
  { code: 'EMP-MAH-011', newEmail: 'technician@jcb.com' },
  { code: 'EMP-MAH-012', newEmail: 'technician2@jcb.com' },
  { code: 'EMP-MAH-013', newEmail: 'technician3@jcb.com' },
  { code: 'EMP-MAH-014', newEmail: 'technician4@jcb.com' },
  { code: 'EMP-MAH-015', newEmail: 'technician5@jcb.com' },
  { code: 'EMP-MAH-016', newEmail: 'technician6@jcb.com' },
  { code: 'EMP-MAH-017', newEmail: 'technician7@jcb.com' },
  { code: 'EMP-MAH-018', newEmail: 'technician8@jcb.com' },
  { code: 'EMP-MAH-019', newEmail: 'technician9@jcb.com' },
  { code: 'EMP-MAH-020', newEmail: 'technician10@jcb.com' },

  // Operators
  { code: 'EMP-MAH-021', newEmail: 'operator@jcb.com' },
  { code: 'EMP-MAH-022', newEmail: 'operator2@jcb.com' },
  { code: 'EMP-MAH-023', newEmail: 'operator3@jcb.com' },
  { code: 'EMP-MAH-024', newEmail: 'operator4@jcb.com' },
  { code: 'EMP-MAH-025', newEmail: 'operator5@jcb.com' },
  { code: 'EMP-MAH-026', newEmail: 'operator6@jcb.com' },
  { code: 'EMP-MAH-027', newEmail: 'operator7@jcb.com' },
  { code: 'EMP-MAH-028', newEmail: 'operator8@jcb.com' },
  { code: 'EMP-MAH-029', newEmail: 'operator9@jcb.com' },
  { code: 'EMP-MAH-030', newEmail: 'operator10@jcb.com' },
];

async function updateCredentials() {
  console.log(`Hashing new password: "${newPassword}"...`);
  const passwordHash = bcrypt.hashSync(newPassword, 10);
  console.log('Hash generated successfully.');

  console.log('Updating all users with new password hash and active/approved status...');
  await pool.query(
    `UPDATE users 
     SET password_hash = $1, is_active = TRUE, approval_status = 'approved'`,
    [passwordHash]
  );

  console.log('Updating email addresses for standard role-based logins...');
  for (const item of emailMapping) {
    await pool.query(
      `UPDATE users SET email = $1 WHERE employee_code = $2`,
      [item.newEmail, item.code]
    );
  }

  console.log('\n--- VERIFICATION OF UPDATED USERS ---');
  const res = await pool.query(
    `SELECT employee_code, full_name, email, role, password_hash 
     FROM users 
     ORDER BY role, employee_code`
  );

  console.table(res.rows.map(r => ({
    Code: r.employee_code,
    Name: r.full_name,
    Email: r.email,
    Role: r.role,
    PasswordValid: bcrypt.compareSync(newPassword, r.password_hash)
  })));

  await pool.end();
  console.log('\nAll user credentials successfully updated!');
}

updateCredentials().catch(err => {
  console.error('Update failed:', err);
  pool.end();
});
