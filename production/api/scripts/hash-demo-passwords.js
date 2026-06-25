import dotenv from 'dotenv';
import pg from 'pg';
import { hashPassword } from '../src/services/auth.js';

dotenv.config();

const DEMO_USERS = [
  { username: 'admin', email: 'admin@citycafe.local', password: 'admin123', role: 'admin', fullName: 'Café Admin' },
  { username: 'staff', email: 'staff@citycafe.local', password: 'staff123', role: 'staff', fullName: 'Counter Staff' },
  { username: 'CU2024001', email: 'ahmad.faiz@student.city.edu.my', password: 'demo123', role: 'customer', fullName: 'Ahmad Faiz' },
  { username: 'general001', email: 'ali.rahman@email.com', password: 'demo123', role: 'customer', fullName: 'Ali Rahman' },
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
    if (updated.rowCount === 0) {
      await pool.query(
        `INSERT INTO users (username, email, password_hash, role, full_name, is_active)
         VALUES ($1, $2, $3, $4, $5, TRUE)`,
        [u.username, u.email, passwordHash, u.role, u.fullName]
      );
    }
    console.log(`✓ ${u.username} (${u.role})`);
  }
  console.log('\n✅ Demo passwords hashed. Same login credentials still work.\n');
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
