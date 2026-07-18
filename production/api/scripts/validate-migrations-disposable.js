/**
 * Phase 1A PostgreSQL Validation Gate — disposable database only.
 *
 * Required env:
 *   ALLOW_DISPOSABLE_MIGRATE=1
 *   DISPOSABLE_DATABASE_URL=<disposable postgres url>
 *
 * Optional:
 *   ALLOW_NEON_DISPOSABLE=1  — only for an explicitly disposable Neon branch
 *
 * Loads production/api/.env.disposable if present (never commit secrets).
 * Does NOT use DATABASE_URL for writes. Refuses if disposable URL === DATABASE_URL.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const dbDir = path.resolve(__dirname, '../../database');

// Load optional disposable env file first, then process env wins
const disposableEnvPath = path.join(apiRoot, '.env.disposable');
if (fs.existsSync(disposableEnvPath)) {
  dotenv.config({ path: disposableEnvPath });
}
dotenv.config({ path: path.join(apiRoot, '.env') });

function fail(msg) {
  console.error(`\n❌ Migration validation blocked: ${msg}\n`);
  process.exit(2);
}

function readSql(name) {
  return fs.readFileSync(path.join(dbDir, name), 'utf8');
}

function sanitizeTarget(connectionString) {
  try {
    const u = new URL(connectionString);
    return {
      host: u.hostname,
      port: u.port || '5432',
      database: decodeURIComponent((u.pathname || '/').replace(/^\//, '') || '(default)'),
    };
  } catch {
    fail('DISPOSABLE_DATABASE_URL is not a valid URL');
  }
}

function expectReject(promise, label) {
  return promise.then(
    () => {
      throw new Error(`Expected rejection for: ${label}`);
    },
    (err) => {
      console.log(`✓ rejected as expected: ${label} (${err.code || 'error'})`);
      return err;
    },
  );
}

// ---------------------------------------------------------------------------
// 1. Safety preflight
// ---------------------------------------------------------------------------
const allowed = process.env.ALLOW_DISPOSABLE_MIGRATE === '1';
const url = (process.env.DISPOSABLE_DATABASE_URL || '').trim();
const databaseUrl = (process.env.DATABASE_URL || '').trim();

if (!allowed) {
  fail(
    'ALLOW_DISPOSABLE_MIGRATE=1 is required.\n'
    + 'Set DISPOSABLE_DATABASE_URL to a disposable Postgres URL (or create .env.disposable).',
  );
}
if (!url) {
  fail('DISPOSABLE_DATABASE_URL is empty. Provide an explicitly disposable/test database URL.');
}
if (databaseUrl && url === databaseUrl) {
  fail('DISPOSABLE_DATABASE_URL must not equal DATABASE_URL (refusing shared/demo/production DB).');
}

const lower = url.toLowerCase();
const bannedFragments = [
  'onrender.com',
  'city-cafe-rewards',
  'shared-demo',
  'staging.aida',
];
for (const frag of bannedFragments) {
  if (lower.includes(frag)) {
    fail(`Refusing URL that appears to target a non-disposable environment (${frag}).`);
  }
}

// Production Neon host from known .env pattern — refuse unless disposable neon branch override
const dbHost = (() => {
  try { return new URL(databaseUrl).hostname; } catch { return ''; }
})();
if (dbHost && lower.includes(dbHost.toLowerCase())) {
  fail('Disposable URL host matches DATABASE_URL host. Use a separate disposable database/branch.');
}

if (lower.includes('neon.tech') && process.env.ALLOW_NEON_DISPOSABLE !== '1') {
  fail(
    'URL looks like Neon. For a disposable Neon *branch* only, set ALLOW_NEON_DISPOSABLE=1.\n'
    + 'Never point this at the production/shared demo Neon database.',
  );
}

// Require disposable/test naming signal in db name or host for non-local targets
const target = sanitizeTarget(url);
const isLocal = target.host === 'localhost' || target.host === '127.0.0.1';
const nameSignal = `${target.database} ${target.host}`.toLowerCase();
const looksDisposable = isLocal
  || nameSignal.includes('dispos')
  || nameSignal.includes('migrate_test')
  || nameSignal.includes('migrate-test')
  || nameSignal.includes('_test')
  || nameSignal.includes('-test')
  || process.env.CONFIRM_DISPOSABLE_TARGET === '1';

if (!looksDisposable) {
  fail(
    `Target does not look disposable (host=${target.host} db=${target.database}).\n`
    + 'Use a database name containing test/disposable, or set CONFIRM_DISPOSABLE_TARGET=1 after manual confirmation.',
  );
}

console.log('→ Phase 1A PostgreSQL Validation Gate');
console.log(`  sanitised target: host=${target.host} port=${target.port} database=${target.database}`);
console.log('  credentials: (hidden)');
console.log(`  local=${isLocal} allow_neon_disposable=${process.env.ALLOW_NEON_DISPOSABLE === '1'}`);

const pool = new pg.Pool({
  connectionString: url,
  ssl: !isLocal ? { rejectUnauthorized: false } : undefined,
});

async function q(sql, params) {
  return pool.query(sql, params);
}

async function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function verifyStructureAndSeed(tag) {
  console.log(`→ Verify structure/seed (${tag})…`);

  const branches = await q(`SELECT code FROM branches WHERE code = 'BR-MAIN'`);
  await assert(branches.rows.length === 1, 'Main Cafe branch must exist exactly once');

  const snackAsBranch = await q(`SELECT code FROM branches WHERE code ILIKE '%SNACK%'`);
  await assert(snackAsBranch.rows.length === 0, 'Snack Station must not be a separate branch');

  const sps = await q(`
    SELECT sp.code, b.code AS branch_code, inv.code AS inv_code,
           sp.consolidates_to_branch_id = b.id AS consolidates_ok
    FROM sales_points sp
    JOIN branches b ON b.id = sp.branch_id
    JOIN inventory_locations inv ON inv.id = sp.inventory_location_id
    WHERE b.code = 'BR-MAIN'
    ORDER BY sp.code
  `);
  await assert(sps.rows.length === 2, `expected exactly 2 sales points under Main Cafe, got ${sps.rows.length}`);
  await assert(sps.rows.some((r) => r.code === 'SP-MAIN'), 'Main Counter missing under Main Cafe');
  await assert(sps.rows.some((r) => r.code === 'SP-SNACK'), 'Snack Station missing under Main Cafe');
  await assert(sps.rows.filter((r) => r.code === 'SP-MAIN').length === 1, 'Main Counter not unique');
  await assert(sps.rows.filter((r) => r.code === 'SP-SNACK').length === 1, 'Snack Station not unique');
  await assert(sps.rows.every((r) => r.inv_code === 'INV-MAIN'), 'both sales points must share INV-MAIN');
  await assert(sps.rows.every((r) => r.consolidates_ok), 'sales points must consolidate to Main Cafe branch');

  const terms = await q(`
    SELECT t.code, sp.code AS sp_code
    FROM terminals t
    JOIN sales_points sp ON sp.id = t.sales_point_id
    JOIN branches b ON b.id = sp.branch_id
    WHERE t.code IN ('POS-MAIN-01','POS-SNACK-01')
  `);
  await assert(terms.rows.length === 2, 'expected seeded terminals with valid sales_point FKs');

  const cols = await q(`
    SELECT column_name, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders'
      AND column_name IN ('branch_id','sales_point_id','terminal_id','shift_id','idempotency_key','idempotency_payload_hash')
  `);
  const byName = Object.fromEntries(cols.rows.map((r) => [r.column_name, r.is_nullable]));
  for (const c of ['branch_id', 'sales_point_id', 'terminal_id', 'shift_id', 'idempotency_key', 'idempotency_payload_hash']) {
    await assert(byName[c] === 'YES', `${c} must remain nullable for historical orders`);
  }

  const idx = await q(`
    SELECT indexname FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname IN ('idx_orders_idempotency_scope','idx_sales_points_branch','idx_terminals_sales_point')
  `);
  await assert(idx.rows.length === 3, 'required indexes missing');

  const uniqBranch = await q(`SELECT COUNT(*)::int AS n FROM pg_indexes WHERE tablename='branches' AND indexdef ILIKE '%UNIQUE%' AND indexdef ILIKE '%code%'`);
  await assert(uniqBranch.rows[0].n >= 1, 'branches.code unique missing');

  const gm = await q(`
    SELECT column_default FROM information_schema.columns
    WHERE table_name='users' AND column_name='is_global_manager'
  `);
  await assert(gm.rows[0] && String(gm.rows[0].column_default).includes('false'), 'is_global_manager default must be false');

  // empty access never grants global
  let probeId;
  const existing = await q(`SELECT id FROM users WHERE username = 'phase1a_probe'`);
  if (existing.rows[0]) {
    probeId = existing.rows[0].id;
    await q(`UPDATE users SET is_global_manager = FALSE WHERE id = $1`, [probeId]);
  } else {
    const probe = await q(`
      INSERT INTO users (email, password_hash, role, full_name, username, is_active, is_global_manager)
      VALUES ('phase1a.probe@example.com', 'DEMO:x', 'admin', 'Probe', 'phase1a_probe', TRUE, FALSE)
      RETURNING id
    `);
    probeId = probe.rows[0].id;
  }
  await q(`DELETE FROM user_branch_access WHERE user_id = $1`, [probeId]);
  const accessCount = await q(`SELECT COUNT(*)::int AS n FROM user_branch_access WHERE user_id = $1`, [probeId]);
  const flag = await q(`SELECT is_global_manager FROM users WHERE id = $1`, [probeId]);
  await assert(accessCount.rows[0].n === 0 && flag.rows[0].is_global_manager === false, 'empty access must not grant global');

  // UTC timestamp defaults + CHECK constraints
  const tsCols = await q(`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'branches'
      AND column_name IN ('created_at', 'updated_at')
  `);
  await assert(tsCols.rows.length === 2, 'branches created_at/updated_at missing');
  await assert(
    tsCols.rows.every((r) => r.data_type === 'timestamp with time zone'),
    'branch timestamps must be timestamptz (UTC absolute storage)',
  );
  await assert(
    tsCols.rows.every((r) => String(r.column_default || '').toLowerCase().includes('now()')),
    'branch timestamps must default to NOW()',
  );
  const ts = await q(`SELECT created_at, updated_at FROM branches WHERE code = 'BR-MAIN'`);
  await assert(ts.rows[0]?.created_at, 'created_at default missing on seeded branch');
  // Session TZ may be non-UTC; force UTC session and confirm absolute instant round-trips
  await q(`SET TIME ZONE 'UTC'`);
  const utcProbe = await q(`
    SELECT EXTRACT(TIMEZONE FROM created_at)::int AS tz_secs
    FROM branches WHERE code = 'BR-MAIN'
  `);
  await assert(Number(utcProbe.rows[0].tz_secs) === 0, 'timestamptz under UTC session should show offset 0');

  const check = await q(`
    SELECT conname FROM pg_constraint
    WHERE conname = 'terminals_status_check'
  `);
  await assert(check.rows.length === 1, 'terminals_status_check missing');

  console.log(`✓ structure/seed OK (${tag})`);
}

async function negativeConstraintTests() {
  console.log('→ Negative constraint tests…');
  const branch = await q(`SELECT id FROM branches WHERE code = 'BR-MAIN'`);
  const inv = await q(`SELECT id FROM inventory_locations WHERE code = 'INV-MAIN'`);
  const sp = await q(`SELECT id FROM sales_points WHERE code = 'SP-MAIN'`);
  const branchId = branch.rows[0].id;
  const invId = inv.rows[0].id;
  const spId = sp.rows[0].id;

  await expectReject(
    q(`INSERT INTO branches (code, name) VALUES ('BR-MAIN', 'Dup')`),
    'duplicate branch code',
  );
  await expectReject(
    q(`INSERT INTO terminals (sales_point_id, code, name, status) VALUES ($1, 'POS-MAIN-01', 'Dup', 'pending_enrolment')`, [spId]),
    'duplicate terminal code',
  );
  await expectReject(
    q(`INSERT INTO sales_points (branch_id, code, name, inventory_location_id, consolidates_to_branch_id)
       VALUES ($1, 'SP-MAIN', 'Dup', $2, $1)`, [branchId, invId]),
    'duplicate sales-point code within branch',
  );
  await expectReject(
    q(`INSERT INTO sales_points (branch_id, code, name, inventory_location_id, consolidates_to_branch_id)
       VALUES ('00000000-0000-0000-0000-000000000099', 'SP-X', 'X', $1, '00000000-0000-0000-0000-000000000099')`, [invId]),
    'invalid branch FK',
  );
  await expectReject(
    q(`INSERT INTO sales_points (branch_id, code, name, inventory_location_id, consolidates_to_branch_id)
       VALUES ($1, 'SP-BADINV', 'X', '00000000-0000-0000-0000-000000000099', $1)`, [branchId]),
    'invalid inventory FK',
  );
  await expectReject(
    q(`INSERT INTO terminals (sales_point_id, code, name, status)
       VALUES ('00000000-0000-0000-0000-000000000099', 'POS-BAD', 'X', 'pending_enrolment')`),
    'invalid sales_point FK',
  );
  await expectReject(
    q(`INSERT INTO terminals (sales_point_id, code, name, status)
       VALUES ($1, 'POS-BADSTATUS', 'X', 'not-a-status')`, [spId]),
    'invalid terminal status CHECK',
  );
}

async function rollbackDisposableOnly() {
  console.log('→ Rollback on disposable DB only…');
  await q(`DELETE FROM terminal_enrolment_codes WHERE terminal_id IN (SELECT id FROM terminals WHERE code IN ('POS-MAIN-01','POS-SNACK-01'))`);
  await q(`DELETE FROM terminals WHERE code IN ('POS-MAIN-01','POS-SNACK-01')`);
  await q(`DELETE FROM sales_points WHERE code IN ('SP-MAIN','SP-SNACK')`);
  await q(`DELETE FROM inventory_locations WHERE code = 'INV-MAIN'`);
  await q(`DELETE FROM user_branch_access WHERE branch_id IN (SELECT id FROM branches WHERE code = 'BR-MAIN')`);
  await q(`UPDATE users SET is_global_manager = FALSE WHERE username = 'admin'`);
  await q(`DELETE FROM branches WHERE code = 'BR-MAIN'`);

  await q(`DROP INDEX IF EXISTS idx_orders_idempotency_scope`);
  await q(`ALTER TABLE orders DROP COLUMN IF EXISTS idempotency_payload_hash`);
  await q(`ALTER TABLE orders DROP COLUMN IF EXISTS idempotency_key`);
  await q(`ALTER TABLE orders DROP COLUMN IF EXISTS shift_id`);
  await q(`ALTER TABLE orders DROP COLUMN IF EXISTS terminal_id`);
  await q(`ALTER TABLE orders DROP COLUMN IF EXISTS sales_point_id`);
  await q(`ALTER TABLE orders DROP COLUMN IF EXISTS branch_id`);
  await q(`DROP TABLE IF EXISTS terminal_enrolment_codes`);
  await q(`DROP TABLE IF EXISTS terminals`);
  await q(`DROP TABLE IF EXISTS user_branch_access`);
  await q(`DROP TABLE IF EXISTS sales_points`);
  await q(`DROP TABLE IF EXISTS inventory_locations`);
  await q(`ALTER TABLE users DROP COLUMN IF EXISTS is_global_manager`);
  await q(`DROP TABLE IF EXISTS branches`);

  const gone = await q(`SELECT to_regclass('public.branches') AS b, to_regclass('public.sales_points') AS sp`);
  await assert(gone.rows[0].b === null && gone.rows[0].sp === null, 'rollback incomplete');
  console.log('✓ rollback complete on disposable DB');
}

async function main() {
  // Drop public schema objects for a clean disposable baseline when safe
  console.log('→ Resetting disposable public schema for clean baseline…');
  await q(`DROP SCHEMA IF EXISTS public CASCADE`);
  await q(`CREATE SCHEMA public`);
  await q(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

  console.log('→ Applying baseline through 005…');
  await q(readSql('schema.sql'));
  await q(readSql('seed.sql'));
  // Enum ADD VALUE must commit before use (same pattern as migrate-v2.js)
  console.log('→ Applying 002 enum ADD VALUE (separate transaction)…');
  await q(`DO $$ BEGIN ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'customer'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
  const sql002 = readSql('002_members_upgrade.sql').replace(/DO \$\$ BEGIN[\s\S]*?END \$\$;\s*/m, '');
  await q(sql002);
  await q(readSql('003_phase3_offers.sql'));
  await q(readSql('004_link_demo_users.sql'));
  await q(readSql('005_menu_images.sql'));

  console.log('→ Applying migration 006…');
  await q(readSql('006_branches_terminals.sql'));
  console.log('→ Applying migration 007…');
  await q(readSql('007_seed_main_cafe_locations.sql'));
  console.log('→ Re-applying migration 007 (idempotency)…');
  await q(readSql('007_seed_main_cafe_locations.sql'));
  console.log('✓ migration 007 idempotent');

  await verifyStructureAndSeed('post-006/007');
  await negativeConstraintTests();

  await rollbackDisposableOnly();

  console.log('→ Reapply 006 + 007 after rollback…');
  await q(readSql('006_branches_terminals.sql'));
  await q(readSql('007_seed_main_cafe_locations.sql'));
  await verifyStructureAndSeed('post-rollback-reapply');

  await pool.end();
  console.log('\n✅ Phase 1A PostgreSQL Validation Gate PASSED');
  console.log(`   sanitised target: host=${target.host} database=${target.database}\n`);
}

main().catch(async (e) => {
  console.error('\n❌ Validation failed:', e.message || e);
  try { await pool.end(); } catch { /* ignore */ }
  process.exit(1);
});
