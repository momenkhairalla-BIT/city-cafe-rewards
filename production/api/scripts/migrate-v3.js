import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.resolve(__dirname, '../../database/003_phase3_offers.sql');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')
    ? { rejectUnauthorized: false } : undefined,
});

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL required');
    process.exit(1);
  }
  const sql = fs.readFileSync(sqlPath, 'utf8');
  console.log('→ Running 003 Phase 3 offers migration...');
  await pool.query(sql);
  console.log('✅ Migration 003 complete');
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
