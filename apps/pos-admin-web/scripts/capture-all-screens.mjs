/**
 * Capture every POS + Admin preview screen, then zip them.
 * Requires: npm run dev on :5173 and Playwright Chromium installed.
 *
 * Usage: node scripts/capture-all-screens.mjs
 */
import { chromium } from '@playwright/test';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BASE = process.env.CAPTURE_URL || 'http://localhost:5173';
const OUT = path.join(ROOT, 'docs_screenshots', 'all-screens');
const ZIP = path.join(ROOT, 'docs_screenshots', 'aida-pos-admin-all-screens.zip');

const ADMIN_ROUTES = [
  ['01-dashboard', '/admin'],
  ['02-live-ops', '/admin/live'],
  ['03-reports-sales', '/admin/reports/sales'],
  ['04-reports-transactions', '/admin/reports/transactions'],
  ['05-reports-products', '/admin/reports/products'],
  ['06-reports-members', '/admin/reports/members'],
  ['07-ops-branches', '/admin/operations/branches'],
  ['08-ops-terminals', '/admin/operations/terminals'],
  ['09-ops-shifts', '/admin/operations/shifts'],
  ['10-ops-employees', '/admin/operations/employees'],
  ['11-catalogue-menu', '/admin/catalogue/menu'],
  ['12-catalogue-categories', '/admin/catalogue/categories'],
  ['13-catalogue-variants', '/admin/catalogue/variants'],
  ['14-rewards-loyalty', '/admin/rewards/loyalty'],
  ['15-rewards-stamps', '/admin/rewards/stamps'],
  ['16-rewards-offers', '/admin/rewards/offers'],
  ['17-rewards-campaigns', '/admin/rewards/campaigns'],
  ['18-system-audit', '/admin/system/audit'],
  ['19-system-integrations', '/admin/system/integrations'],
  ['20-system-settings', '/admin/system/settings'],
];

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.waitForTimeout(350);
  await page.screenshot({ path: file, fullPage: true });
  console.log('  ✓', name);
  return file;
}

async function clearStorage(page) {
  await page.goto(`${BASE}/employee`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    try {
      sessionStorage.clear();
      localStorage.clear();
    } catch {
      /* ignore */
    }
  });
}

async function enrol(page) {
  await page.goto(`${BASE}/employee`, { waitUntil: 'networkidle' });
  const enrol = page.getByLabel(/enrolment code/i);
  if (await enrol.count()) {
    await enrol.fill('AIDA-482731');
    await page.getByRole('button', { name: /activate terminal/i }).click();
    await page.getByRole('heading', { name: /sign in/i }).waitFor({ timeout: 15000 });
  }
}

async function login(page, username, password) {
  await page.getByLabel(/username/i).fill(username);
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
}

async function logoutIfPresent(page) {
  const logout = page.getByRole('button', { name: /log out/i });
  if (await logout.count()) {
    await logout.first().click();
    await page.waitForTimeout(400);
  }
}

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  console.log('Employee / auth screens…');
  await clearStorage(page);
  await page.goto(`${BASE}/employee`, { waitUntil: 'networkidle' });
  await shot(page, '00-employee-terminal-enrol');

  await page.getByLabel(/enrolment code/i).fill('AIDA-EXPIRED');
  await page.getByRole('button', { name: /activate terminal/i }).click();
  await page.waitForTimeout(500);
  await shot(page, '00-employee-terminal-enrol-expired');

  await page.getByRole('button', { name: /reset preview terminal/i }).click();
  await page.getByLabel(/enrolment code/i).fill('AIDA-482731');
  await page.getByRole('button', { name: /activate terminal/i }).click();
  await page.getByRole('heading', { name: /sign in/i }).waitFor({ timeout: 15000 });
  await shot(page, '00-employee-sign-in-password');

  await page.getByRole('tab', { name: /badge \+ pin/i }).click();
  await page.waitForTimeout(200);
  await shot(page, '00-employee-sign-in-badge');

  console.log('Role select…');
  await page.getByRole('tab', { name: /^password$/i }).click();
  await login(page, 'preview.dual', 'preview123');
  await page.waitForURL(/select-role|\/pos|\/admin/, { timeout: 15000 });
  if (page.url().includes('select-role')) {
    await shot(page, '00-employee-role-select');
    await logoutIfPresent(page);
  } else {
    await logoutIfPresent(page);
  }

  console.log('POS screens…');
  await clearStorage(page);
  await enrol(page);
  await login(page, 'preview.staff', 'preview123');
  await page.waitForURL(/\/pos/, { timeout: 15000 });
  await page.getByRole('heading', { name: /open shift|aida counter/i }).first().waitFor({ timeout: 15000 });
  await shot(page, '10-pos-open-shift');

  await page.getByLabel(/opening float/i).fill('100');
  await page.getByRole('button', { name: /open shift/i }).click();
  await page.getByText(/new sale|favourites|menu/i).first().waitFor({ timeout: 15000 });
  await shot(page, '11-pos-counter-new-sale');

  await page.getByRole('button', { name: /^Coffee$/i }).click().catch(() => {});
  await page.waitForTimeout(200);
  await shot(page, '12-pos-menu-coffee');

  await page.getByRole('button', { name: /Salted Caramel Latte/i }).click();
  await page.getByRole('dialog').waitFor({ timeout: 8000 });
  await shot(page, '13-pos-modifier-sheet');

  // Confirm size Medium if needed, then add
  const medium = page.getByLabel(/^Medium$/i);
  if (await medium.count()) await medium.check().catch(async () => medium.click());
  await page.getByRole('button', { name: /add to order|confirm|add$/i }).click();
  await page.waitForTimeout(400);
  await shot(page, '14-pos-cart-with-item');

  await page.getByRole('button', { name: /^Orders$/i }).click();
  await page.getByRole('heading', { name: /recent orders/i }).waitFor({ timeout: 8000 });
  await shot(page, '15-pos-orders');

  await page.getByRole('button', { name: /^Member$/i }).click();
  await page.getByRole('heading', { name: /member|rewards/i }).waitFor({ timeout: 8000 });
  await shot(page, '16-pos-member-empty');

  await page.getByPlaceholder(/search by name/i).fill('A');
  await page.waitForTimeout(400);
  const option = page.getByRole('option').first();
  if (await option.count()) {
    await option.click();
    await page.waitForTimeout(300);
    await shot(page, '17-pos-member-selected');
  }

  await page.getByRole('button', { name: /^New Sale$/i }).click();
  await page.getByRole('button', { name: /^Pay$/i }).click();
  await page.getByRole('heading', { name: /payment/i }).waitFor({ timeout: 8000 });
  await shot(page, '18-pos-payment');

  await page.getByRole('button', { name: /complete sale/i }).click();
  await page.getByRole('heading', { name: /sale complete/i }).waitFor({ timeout: 8000 });
  await shot(page, '19-pos-receipt');

  await page.locator('button.btn-primary', { hasText: /^New sale$/i }).click();
  await page.getByRole('button', { name: /^Shift$/i }).click();
  await page.getByRole('heading', { name: /shift controls/i }).waitFor({ timeout: 8000 });
  await shot(page, '20-pos-shift-controls');

  await page.getByRole('button', { name: /^Terminal$/i }).click();
  await page.getByRole('heading', { name: /^Terminal$/i }).waitFor({ timeout: 8000 });
  await shot(page, '21-pos-terminal-info');

  await page.getByRole('button', { name: /^Help$/i }).click();
  await page.waitForTimeout(300);
  await shot(page, '22-pos-help');

  await page.getByRole('button', { name: /^Shift$/i }).click();
  await page.getByRole('button', { name: /lock shift/i }).click();
  await page.getByRole('heading', { name: /shift locked/i }).waitFor({ timeout: 10000 });
  await shot(page, '23-pos-shift-locked');

  await page.getByRole('button', { name: /resume shift/i }).click();
  await page.getByText(/new sale/i).first().waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: /^Shift$/i }).click();
  await page.getByRole('button', { name: /close shift/i }).click();
  await page.getByRole('heading', { name: /close shift/i }).waitFor({ timeout: 10000 });
  await shot(page, '24-pos-close-shift');

  await page.getByLabel(/expected cash/i).fill('150');
  await page.getByLabel(/actual cash/i).fill('148');
  await page.getByRole('button', { name: /review & close/i }).click();
  await page.waitForTimeout(300);
  await shot(page, '25-pos-close-shift-confirm');

  await page.getByRole('button', { name: /confirm close shift/i }).click();
  await page.getByRole('heading', { name: /shift closed/i }).waitFor({ timeout: 10000 });
  await shot(page, '26-pos-shift-closed');

  console.log('Admin screens…');
  await logoutIfPresent(page);
  await clearStorage(page);
  await enrol(page);
  await login(page, 'preview.admin', 'preview123');
  await page.waitForURL(/\/admin/, { timeout: 15000 });
  await page.setViewportSize({ width: 1440, height: 900 });

  for (const [name, route] of ADMIN_ROUTES) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
    await shot(page, `30-admin-${name}`);
  }

  await browser.close();

  // Manifest
  await writeFile(
    path.join(OUT, 'README.txt'),
    [
      'Aida Counter (POS) + Aida Office (Admin) — full UI preview screenshots',
      `Captured: ${new Date().toISOString()}`,
      `Base URL: ${BASE}`,
      '',
      'Preview mode only (sample data). Not production.',
      'Enrol: AIDA-482731 | Staff: preview.staff/preview123 | Admin: preview.admin/preview123',
      '',
    ].join('\n'),
  );

  // Zip with PowerShell Compress-Archive
  console.log('Creating zip…');
  try {
    await rm(ZIP, { force: true });
  } catch {
    /* ignore */
  }
  execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      `Compress-Archive -Path '${OUT}\\*' -DestinationPath '${ZIP}' -Force`,
    ],
    { stdio: 'inherit' },
  );

  console.log('\nDone.');
  console.log('Folder:', OUT);
  console.log('Zip:   ', ZIP);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
