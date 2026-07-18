/**
 * Idempotent dual-role POS fixture for temporary Neon branch ONLY.
 * Never add to production seeds.
 *
 * Requires: DATABASE_URL pointing at ep-polished-wildflower... (temp branch)
 * Creates/updates user dualrole with dual_role_pos_enabled=true.
 */
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { pool, query } from '../src/db/pool.js';

dotenv.config();

const EXPECTED_HOST = 'ep-polished-wildflower-aoqhtu9r.c-2.ap-southeast-1.aws.neon.tech';
const FORBIDDEN_HOST = 'ep-billowing-bread-aoyvj5iu.c-2.ap-southeast-1.aws.neon.tech';

const url = process.env.DATABASE_URL || '';
let host = '';
try {
  host = new URL(url).hostname;
} catch {
  console.error('Invalid DATABASE_URL');
  process.exit(1);
}

if (host === FORBIDDEN_HOST || host.includes('billowing-bread')) {
  console.error('Refusing: production Neon parent host.');
  process.exit(1);
}
if (host !== EXPECTED_HOST && process.env.ALLOW_DUAL_ROLE_FIXTURE_ANY_TEMP !== '1') {
  console.error(`Refusing: host ${host} is not the authorised temp branch.`);
  process.exit(1);
}

const USERNAME = 'dualrole';
const PASSWORD = 'dualrole123';
const hash = await bcrypt.hash(PASSWORD, 10);

const existing = await query(`SELECT id FROM users WHERE username = $1`, [USERNAME]);
if (existing.rows[0]) {
  await query(
    `UPDATE users SET
       password_hash = $2,
       role = 'admin',
       is_active = true,
       is_global_manager = true,
       dual_role_pos_enabled = true,
       full_name = 'Dual Role Fixture',
       email = COALESCE(email, 'dualrole@temp.local')
     WHERE username = $1`,
    [USERNAME, hash],
  );
} else {
  await query(
    `INSERT INTO users (username, email, password_hash, role, full_name, is_active, is_global_manager, dual_role_pos_enabled)
     VALUES ($1, $2, $3, 'admin', 'Dual Role Fixture', true, true, true)`,
    [USERNAME, 'dualrole@temp.local', hash],
  );
}

const { rows } = await query(
  `SELECT id, username, dual_role_pos_enabled FROM users WHERE username = $1`,
  [USERNAME],
);
console.log('Dual-role fixture ready:', {
  username: rows[0].username,
  dual_role_pos_enabled: rows[0].dual_role_pos_enabled,
  host,
});
await pool.end();
