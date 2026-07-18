import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distJs = path.join(root, 'dist/assets');
if (!fs.existsSync(distJs)) {
  console.error('dist/assets missing — run build first');
  process.exit(1);
}

let blob = '';
for (const f of fs.readdirSync(distJs)) {
  if (f.endsWith('.js')) blob += fs.readFileSync(path.join(distJs, f), 'utf8');
}

if (blob.includes('legacyAccessToken')) {
  console.error('FATAL: production bundle contains legacyAccessToken');
  process.exit(1);
}
// Employee auth must not persist via localStorage.setItem patterns in bundle for our session key
if (/localStorage\.setItem\([^)]*employee/i.test(blob)) {
  console.error('FATAL: production bundle writes employee data to localStorage');
  process.exit(1);
}
console.log('✅ Bundle check: no legacyAccessToken; no employee localStorage writes');
