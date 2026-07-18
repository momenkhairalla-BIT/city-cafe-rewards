import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.resolve(__dirname, '../../database/006_branches_terminals.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required. Refusing to run (never invent a production URL).');
  process.exit(1);
}

const isLocal =
  process.env.DATABASE_URL.includes('localhost') ||
  process.env.DATABASE_URL.includes('127.0.0.1');

if (process.env.ALLOW_NONLOCAL_MIGRATE !== '1' && !isLocal) {
  console.error(
    'Refusing to apply migration 006 to a non-local DATABASE_URL.\n' +
      'Use a disposable/local/staging database.\n' +
      'For an explicit staging target only: set ALLOW_NONLOCAL_MIGRATE=1',
  );
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: !isLocal ? { rejectUnauthorized: false } : undefined,
});

async function main() {
  console.log('→ Running 006 branches/terminals migration...');
  await pool.query(sql);
  console.log('✅ Migration 006 complete');
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
