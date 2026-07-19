/**
 * Capture UI preview screenshots (dev server must be on :5173).
 * Usage: node scripts/capture-preview-screens.mjs
 */
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.CAPTURE_URL || 'http://localhost:5173';
const OUT = path.resolve('docs_screenshots');

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

  await page.goto(`${BASE}/employee`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(OUT, 'terminal-enrol-preview.png'), fullPage: true });

  const enrol = page.getByLabel(/enrolment code/i);
  if (await enrol.count()) {
    await enrol.fill('AIDA-482731');
    await page.getByRole('button', { name: /activate terminal/i }).click();
    await page.getByRole('heading', { name: /sign in/i }).waitFor({ timeout: 10000 });
  }

  await page.getByLabel(/username/i).fill('preview.staff');
  await page.getByLabel(/^password$/i).fill('preview123');
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForURL(/\/pos/, { timeout: 15000 });
  await page.getByLabel(/opening float/i).fill('100');
  await page.getByRole('button', { name: /open shift/i }).click();
  await page.getByText(/aida counter|new sale|favourites/i).first().waitFor({ timeout: 15000 });
  await page.screenshot({ path: path.join(OUT, 'pos-1366.png'), fullPage: true });

  await page.goto(`${BASE}/employee`);
  // Re-login as admin — may need logout first
  const logout = page.getByRole('button', { name: /log out/i });
  if (await logout.count()) await logout.click();
  await page.goto(`${BASE}/employee`);
  if (await page.getByLabel(/enrolment code/i).count()) {
    // already enrolled in sessionStorage from prior step
  }
  if (await page.getByRole('heading', { name: /sign in/i }).count()) {
    await page.getByLabel(/username/i).fill('preview.admin');
    await page.getByLabel(/^password$/i).fill('preview123');
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await page.waitForURL(/\/admin/, { timeout: 15000 });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: path.join(OUT, 'admin-overview-1440.png'), fullPage: true });
  }

  await browser.close();
  console.log('Screenshots written to', OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
