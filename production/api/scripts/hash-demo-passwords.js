import dotenv from 'dotenv';
import pg from 'pg';
import { hashPassword } from '../src/services/auth.js';

dotenv.config();

const DEMO_USERS = [
  { username: 'admin', email: 'admin@citycafe.local', password: 'admin123', role: 'admin', fullName: 'Café Admin' },
  { username: 'staff', email: 'staff@citycafe.local', password: 'staff123', role: 'staff', fullName: 'Counter Staff' },
  { username: 'CU2024001', email: 'ahmad.faiz@student.city.edu.my', password: 'demo123', role: 'customer', fullName: 'Ahmad Faiz', linkStudentId: 'CU2024001' },
  { username: 'general001', email: 'ali.rahman@email.com', password: 'demo123', role: 'customer', fullName: 'Ali Rahman', linkMemberCode: 'GC-M-001' },
];

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')
    ? { rejectUnauthorized: false } : undefined,
});

async function main() {
  console.log('→ Hashing demo user passwords with bcrypt...\n');
  for (const u of DEMO_USERS) {
    const passwordHash = await hashPassword(u.password);
    const updated = await pool.query(
      `UPDATE users SET password_hash = $1, role = $2, full_name = $3, email = $4, username = $5, updated_at = NOW()
       WHERE username = $5 OR email = $4`,
      [passwordHash, u.role, u.fullName, u.email, u.username]
    );
    let userId;
    if (updated.rowCount === 0) {
      const inserted = await pool.query(
        `INSERT INTO users (username, email, password_hash, role, full_name, is_active)
         VALUES ($1, $2, $3, $4, $5, TRUE)
         RETURNING id`,
        [u.username, u.email, passwordHash, u.role, u.fullName]
      );
      userId = inserted.rows[0].id;
    } else {
      const row = await pool.query(`SELECT id FROM users WHERE username = $1 LIMIT 1`, [u.username]);
      userId = row.rows[0]?.id;
    }

    if (userId && u.linkStudentId) {
      await pool.query(
        `UPDATE students SET user_id = $1, updated_at = NOW()
         WHERE UPPER(student_id) = $2 AND (user_id IS NULL OR user_id = $1)`,
        [userId, u.linkStudentId.toUpperCase()]
      );
    }
    if (userId && u.linkMemberCode) {
      await pool.query(
        `UPDATE students SET user_id = $1, updated_at = NOW()
         WHERE UPPER(member_code) = $2 AND (user_id IS NULL OR user_id = $1)`,
        [userId, u.linkMemberCode.toUpperCase()]
      );
    }

    console.log(`✓ ${u.username} (${u.role})`);
  }
  console.log('\n✅ Demo passwords hashed and member links updated.\n');
  console.log('Login identifiers supported: username, student ID, member code, barcode, QR, phone.\n');
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
