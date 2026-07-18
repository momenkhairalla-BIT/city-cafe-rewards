/**
 * Lightweight OpenAPI 3.1 structural lint (no external deps).
 * Validates presence of required root fields and basic path/operation shape.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const openapiPath = path.resolve(__dirname, '../../../openapi.yaml');

function fail(msg) {
  console.error(`OpenAPI lint failed: ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(openapiPath)) fail(`missing file ${openapiPath}`);

const text = fs.readFileSync(openapiPath, 'utf8');

if (!/^openapi:\s*['"]?3\.1\.2['"]?\s*$/m.test(text)) {
  fail('openapi version must be 3.1.2');
}
if (!/^info:/m.test(text)) fail('missing info');
if (!/^paths:/m.test(text)) fail('missing paths');
if (!/^components:/m.test(text)) fail('missing components');

const requiredPaths = [
  '/api/v1/auth/login',
  '/api/v1/members',
  '/api/v1/menu',
  '/api/v1/offers',
  '/api/v1/orders/sales',
  '/api/v1/scan/{code}',
];

for (const p of requiredPaths) {
  // YAML keys may be quoted
  const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!new RegExp(`^\\s*${escaped}:`, 'm').test(text) && !text.includes(`${p}:`)) {
    fail(`missing path ${p}`);
  }
}

if (!text.includes('x-status: planned')) {
  fail('expected planned endpoints to be marked x-status: planned');
}
if (!text.includes('bearerAuth')) {
  fail('missing bearerAuth security scheme');
}
if (!text.includes('ErrorBody')) {
  fail('missing ErrorBody schema');
}

console.log('✅ OpenAPI lint passed:', openapiPath);
