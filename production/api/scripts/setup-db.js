import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbDir = path.resolve(__dirname, '../../database');

if (!process.env.DATABASE_URL) {
  console.error('\n❌ DATABASE_URL is missing in production/api/.env\n');
  console.error('Steps:');
  console.error('  1. Go to https://neon.tech and create a free project');
  console.error('  2. Copy the connection string (PostgreSQL)');
  console.error('  3. Paste it in production/api/.env as:');
  console.error('     DATABASE_URL=postgresql://...\n');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function runSqlFile(label, filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  console.log(`→ Running ${label}...`);
  await pool.query(sql);
  console.log(`✓ ${label} done`);
}

async function main() {
  try {
    await pool.query('SELECT 1');
    console.log('✓ Connected to Neon PostgreSQL\n');

    await runSqlFile('schema', path.join(dbDir, 'schema.sql'));
    await runSqlFile('seed', path.join(dbDir, 'seed.sql'));

    const migrationPath = path.join(dbDir, '002_members_upgrade.sql');
    if (fs.existsSync(migrationPath)) {
      await runSqlFile('002_members_upgrade', migrationPath);
    }

    const counts = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM students) AS students,
        (SELECT COUNT(*) FROM menu_items) AS menu_items,
        (SELECT COUNT(*) FROM vouchers) AS vouchers
    `);
    const { students, menu_items, vouchers } = counts.rows[0];
    console.log(`\n✅ Database ready — ${students} students, ${menu_items} menu items, ${vouchers} vouchers\n`);
    console.log('Next: npm run dev');
  } catch (err) {
    if (err.message?.includes('already exists')) {
      console.error('\n⚠ Tables already exist. If you need a fresh start, drop tables in Neon SQL Editor first.\n');
    } else {
      console.error('\n❌ Setup failed:', err.message, '\n');
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
