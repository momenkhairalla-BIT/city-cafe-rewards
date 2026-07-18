/**
 * Apply Phase 3A migration 012 ONLY to the authorised temporary Neon branch.
 * Never migrates production parent.
 *
 * Required:
 *   ALLOW_DISPOSABLE_MIGRATE=1
 *   DISPOSABLE_DATABASE_URL=<temp branch URL>
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
  console.error(`\n❌ Phase 3A migrate blocked: ${msg}\n`);
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

console.log(`→ Phase 3A migrate sanitised target: host=${target.host} database=${target.database}`);

if (target.host === PRODUCTION_HOST) {
  fail('Refusing production parent host');
}

const expected = (process.env.EXPECTED_DISPOSABLE_HOST || DEFAULT_TEMP_HOST).trim();
if (target.host !== expected) {
  fail(`Host ${target.host} does not match expected temporary branch host ${expected}`);
}

const file = path.join(dbDir, '012_pos_sales_core.sql');
if (!fs.existsSync(file)) fail(`Missing ${file}`);

const sql = fs.readFileSync(file, 'utf8');
const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  console.log('→ Applying 012_pos_sales_core.sql …');
  await client.query(sql);
  console.log('→ Re-applying (idempotent) …');
  await client.query(sql);
  const checks = await client.query(`
    SELECT
      (SELECT data_type FROM information_schema.columns
        WHERE table_name='orders' AND column_name='student_id') AS student_id_type,
      (SELECT is_nullable FROM information_schema.columns
        WHERE table_name='orders' AND column_name='student_id') AS student_id_nullable,
      to_regclass('public.voucher_redemptions') AS voucher_redemptions,
      (SELECT COUNT(*) FROM pg_class WHERE relkind='S' AND relname='order_number_seq') AS seq_ok
  `);
  console.log('→ Checks:', checks.rows[0]);
  console.log('\n✅ Phase 3A migration 012 applied (idempotent reapply OK)\n');
} finally {
  await client.end();
}
