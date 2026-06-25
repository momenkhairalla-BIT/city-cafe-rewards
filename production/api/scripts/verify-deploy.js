#!/usr/bin/env node
/** Pre-deploy check — run: node scripts/verify-deploy.js */
import dotenv from 'dotenv';
dotenv.config();

const required = ['DATABASE_URL'];
const productionRequired = ['JWT_SECRET'];

let ok = true;

for (const key of required) {
  if (!process.env[key]) {
    console.error(`✗ Missing ${key}`);
    ok = false;
  } else {
    console.log(`✓ ${key} is set`);
  }
}

if (process.env.NODE_ENV === 'production') {
  for (const key of productionRequired) {
    if (!process.env[key]) {
      console.error(`✗ Missing ${key} (required in production)`);
      ok = false;
    } else {
      console.log(`✓ ${key} is set`);
    }
  }
}

if (ok) {
  console.log('\n✅ Ready to deploy\n');
  process.exit(0);
} else {
  console.log('\n❌ Fix environment variables before deploying\n');
  process.exit(1);
}
