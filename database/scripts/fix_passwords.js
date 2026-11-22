const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const url = 'postgresql://postgres.loxyaxyjnripthmabxne:Aniket%40%257075@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres';
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

async function fixPasswords() {
  const hash = bcrypt.hashSync('password123', 10);
  console.log('Generated hash for password123:', hash);
  const res = await pool.query('UPDATE users SET password_hash = $1', [hash]);
  console.log('Updated users with valid password123 hash, count:', res.rowCount);

  // Test one user
  const u = await pool.query('SELECT email, employee_code, full_name, role, password_hash FROM users WHERE email = $1', ['sachin.patil@jcb.com']);
  const isMatch = bcrypt.compareSync('password123', u.rows[0].password_hash);
  console.log('Login test for sachin.patil@jcb.com with password123:', isMatch);

  await pool.end();
}

fixPasswords().catch(err => {
  console.error(err);
  pool.end();
});
