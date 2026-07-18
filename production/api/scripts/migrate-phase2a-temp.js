/**
 * Apply Phase 2A migrations 008–011 ONLY to the authorised temporary Neon branch.
 * Never migrates production parent.
 *
 * Required:
 *   ALLOW_DISPOSABLE_MIGRATE=1
 *   DISPOSABLE_DATABASE_URL=<temp branch URL>
 *
 * Optional confirmation of expected temp host:
 *   EXPECTED_DISPOSABLE_HOST=ep-polished-wildflower-aoqhtu9r.c-2.ap-southeast-1.aws.neon.tech
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbDir = path.resolve(__dirname, '../../database');

const PRODUCTION_HOST = 'ep-billowing-bread-aoyvj5iu.c-2.ap-southeast-1.aws.neon.tech';
const DEFAULT_TEMP_HOST = 'ep-polished-wildflower-aoqhtu9r.c-2.ap-southeast-1.aws.neon.tech';

function fail(msg) {
  console.error(`\n❌ Phase 2A migrate blocked: ${msg}\n`);
  process.exit(2);
}

function sanitize(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    database: decodeURIComponent((u.pathname || '/').replace(/^\//, '') || '(default)'),
  };
}

if (process.env.ALLOW_DISPOSABLE_MIGRATE !== '1') {
  fail('ALLOW_DISPOSABLE_MIGRATE=1 is required');
}

const url = (process.env.DISPOSABLE_DATABASE_URL || '').trim();
if (!url) fail('DISPOSABLE_DATABASE_URL is required');

const databaseUrl = (process.env.DATABASE_URL || '').trim();
if (databaseUrl && url === databaseUrl) {
  fail('DISPOSABLE_DATABASE_URL must not equal DATABASE_URL');
}

let target;
try {
  target = sanitize(url);
} catch {
  fail('DISPOSABLE_DATABASE_URL is not a valid URL');
}

console.log(`→ Phase 2A migrate sanitised target: host=${target.host} database=${target.database}`);
console.log('  credentials: (hidden)');

if (target.host === PRODUCTION_HOST) {
  fail('Refusing production parent host');
}

const expected = (process.env.EXPECTED_DISPOSABLE_HOST || DEFAULT_TEMP_HOST).trim();
if (target.host !== expected) {
  fail(`Host ${target.host} does not match expected temporary branch host ${expected}`);
}

if (databaseUrl) {
  try {
    const prodHost = new URL(databaseUrl).hostname;
    if (target.host === prodHost) {
      fail('Disposable host matches DATABASE_URL host');
    }
  } catch {
    /* ignore parse of DATABASE_URL */
  }
}

const files = [
  '008_staff_credentials_sessions.sql',
  '009_terminal_credential_enhancements.sql',
  '010_shifts.sql',
  '011_audit_logs.sql',
];

const pool = new pg.Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  for (const file of files) {
    console.log(`→ Applying ${file}…`);
    const sql = fs.readFileSync(path.join(dbDir, file), 'utf8');
    await pool.query(sql);
    console.log(`✓ ${file}`);
  }
  await pool.end();
  console.log('\n✅ Phase 2A migrations 008–011 applied on temporary branch only\n');
}

main().catch(async (e) => {
  console.error('\n❌ Migration failed:', e.message || e);
  try { await pool.end(); } catch { /* ignore */ }
  process.exit(1);
});
