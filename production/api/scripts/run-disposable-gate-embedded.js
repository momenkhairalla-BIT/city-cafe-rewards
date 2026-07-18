/**
 * Boots a local embedded PostgreSQL (disposable) and runs the Phase 1A validation gate.
 * Used when DISPOSABLE_DATABASE_URL is not injected into the environment.
 * Never touches DATABASE_URL / production Neon.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import EmbeddedPostgres from 'embedded-postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const dataDir = path.join(apiRoot, '.tmp-disposable-pg');
const port = Number(process.env.DISPOSABLE_PG_PORT || 55432);
const user = 'phase1a';
const password = 'phase1a_disposable';
const database = 'citycafe_migrate_test';

async function main() {
  if (fs.existsSync(dataDir)) {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
  fs.mkdirSync(dataDir, { recursive: true });

  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user,
    password,
    port,
    persistent: false,
  });

  console.log('→ Starting embedded disposable PostgreSQL…');
  await pg.initialise();
  await pg.start();
  await pg.createDatabase(database);

  const url = `postgresql://${user}:${password}@127.0.0.1:${port}/${database}`;
  console.log(`→ Sanitised target: host=127.0.0.1 port=${port} database=${database}`);
  console.log('→ credentials: (hidden)');

  const env = {
    ...process.env,
    ALLOW_DISPOSABLE_MIGRATE: '1',
    DISPOSABLE_DATABASE_URL: url,
    // Ensure we do not accidentally prefer a matching DATABASE_URL
    CONFIRM_DISPOSABLE_TARGET: '1',
  };

  const exitCode = await new Promise((resolve) => {
    const child = spawn(process.execPath, ['scripts/validate-migrations-disposable.js'], {
      cwd: apiRoot,
      env,
      stdio: 'inherit',
    });
    child.on('exit', (code) => resolve(code ?? 1));
  });

  try {
    await pg.stop();
  } catch {
    /* ignore */
  }
  try {
    fs.rmSync(dataDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }

  process.exit(exitCode);
}

main().catch((err) => {
  console.error('\n❌ Embedded disposable gate failed:', err.message || err);
  process.exit(1);
});
