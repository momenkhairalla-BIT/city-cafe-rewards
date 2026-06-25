import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')
    ? { rejectUnauthorized: false }
    : undefined,
  max: 10,
});

pool.on('error', (err) => {
  console.error('Unexpected database error', err);
});

export async function query(text, params) {
  return pool.query(text, params);
}
