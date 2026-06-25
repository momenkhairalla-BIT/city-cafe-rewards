import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.resolve(__dirname, '../../database/002_members_upgrade.sql');
const fullSql = fs.readFileSync(sqlPath, 'utf8');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')
    ? { rejectUnauthorized: false } : undefined,
});

async function main() {
  console.log('→ Adding customer role enum value (separate transaction)...');
  await pool.query(`DO $$ BEGIN ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'customer'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
  console.log('→ Running 002 members upgrade migration...');
  const sqlWithoutEnum = fullSql.replace(/DO \$\$ BEGIN[\s\S]*?END \$\$;\s*/m, '');
  await pool.query(sqlWithoutEnum);
  console.log('✅ Migration 002 complete');
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
