import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

function getConnectionString() {
  const url = (process.env.DATABASE_URL || '').trim();
  if (!url && process.env.NODE_ENV === 'production') {
    console.error('⚠ DATABASE_URL is not set — database endpoints will fail');
  }
  return url || undefined;
}

const connectionString = getConnectionString();
const useSsl = connectionString && !connectionString.includes('localhost');

export const pool = new Pool({
  connectionString,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  max: process.env.NODE_ENV === 'production' ? 5 : 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
});

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err.message);
});

export async function query(text, params) {
  return pool.query(text, params);
}

export function isDatabaseConfigured() {
  return Boolean(connectionString);
}

export async function checkDatabaseConnection() {
  if (!connectionString) return { ok: false, reason: 'DATABASE_URL not set' };
  try {
    await pool.query('SELECT 1');
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}
