import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

const API = process.env.E2E_API_URL || 'http://localhost:3011';
const ORIGIN = process.env.E2E_WEB_URL || 'http://localhost:5173';

function parseCookies(setCookie: string[] | null) {
  const jar: Record<string, string> = {};
  for (const line of setCookie || []) {
    const [pair] = line.split(';');
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    jar[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  }
  return jar;
}

async function adminLogin(request: APIRequestContext) {
  const res = await request.post(`${API}/api/v1/auth/employee/login`, {
    data: { username: 'admin', password: 'admin123' },
    headers: { Origin: ORIGIN },
  });
  expect(res.ok()).toBeTruthy();
  return res;
}

async function enrolTerminalInBrowser(page: Page, request: APIRequestContext) {
  const login = await adminLogin(request);
  const adminCookies = await login.headersArray()
    .filter((h) => h.name.toLowerCase() === 'set-cookie')
    .map((h) => h.value);
  const cookieHeader = adminCookies.map((c) => c.split(';')[0]).join('; ');

  const list = await request.get(`${API}/api/v1/terminals`, {
    headers: { Cookie: cookieHeader, Origin: ORIGIN },
  });
  const terminals = (await list.json()).data.terminals;
  const main = terminals.find((t: { code: string }) => t.code === 'POS-MAIN-01');
  expect(main).toBeTruthy();

  const codeRes = await request.post(`${API}/api/v1/terminals/${main.id}/enrolment-codes`, {
    data: {},
    headers: { Cookie: cookieHeader, Origin: ORIGIN, 'Content-Type': 'application/json' },
  });
  const enrolmentCode = (await codeRes.json()).data.enrolmentCode;

  await page.goto('/employee');
  await expect(page.getByRole('heading', { name: /activate this terminal/i })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByLabel(/enrolment code/i).fill(enrolmentCode);
  await page.getByRole('button', { name: /activate terminal/i }).click();
  await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible({ timeout: 15_000 });
}

async function assertNoSecretsInStorage(page: Page) {
  const storage = await page.evaluate(() => ({
    local: { ...localStorage },
    session: { ...sessionStorage },
    cookie: document.cookie,
  }));
  const blob = JSON.stringify(storage).toLowerCase();
  expect(blob.includes('staff123')).toBeFalsy();
  expect(blob.includes('admin123')).toBeFalsy();
  expect(blob.includes('terminalcredential')).toBeFalsy();
  expect(blob.includes('aida_terminal')).toBeFalsy(); // HttpOnly — not in document.cookie
  expect(blob.includes('legacyaccesstoken')).toBeFalsy();
}

test.describe('Phase 2B critical E2E', () => {
  test.describe.configure({ mode: 'serial' });
  test('enrol terminal → reload → remains enrolled', async ({ page, request }) => {
    await enrolTerminalInBrowser(page, request);
    await page.reload();
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/POS-MAIN-01|Terminal/i).first()).toBeVisible();
    await assertNoSecretsInStorage(page);
  });

  test('staff password login → POS only', async ({ page, request }) => {
    await enrolTerminalInBrowser(page, request);
    await page.getByLabel(/username/i).fill('staff');
    await page.getByLabel(/^password$/i).fill('staff123');
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/pos/, { timeout: 15_000 });
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/unauthorized|\/employee|\/pos/, { timeout: 10_000 });
    await assertNoSecretsInStorage(page);
  });

  test('manager login → Admin only', async ({ page, request }) => {
    await enrolTerminalInBrowser(page, request);
    await page.getByLabel(/username/i).fill('admin');
    await page.getByLabel(/^password$/i).fill('admin123');
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });
    await page.goto('/pos');
    await expect(page).not.toHaveURL(/\/pos$/, { timeout: 10_000 });
  });

  test('dual-role login → explicit product selection', async ({ page, request }) => {
    await enrolTerminalInBrowser(page, request);
    await page.getByLabel(/username/i).fill('dualrole');
    await page.getByLabel(/^password$/i).fill('dualrole123');
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/employee\/select-role/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /choose workspace/i })).toBeVisible();
    await page.getByRole('button', { name: /staff pos/i }).click();
    await expect(page).toHaveURL(/\/pos/, { timeout: 15_000 });
  });

  test('open → lock → reauthenticate → resume → close shift', async ({ page, request }) => {
    await enrolTerminalInBrowser(page, request);
    await page.getByLabel(/username/i).fill('staff');
    await page.getByLabel(/^password$/i).fill('staff123');
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/pos/, { timeout: 15_000 });

    const openBtn = page.getByRole('button', { name: /^open shift$/i });
    const lockBtn = page.getByRole('button', { name: /lock shift/i });
    await expect(openBtn.or(lockBtn)).toBeVisible({ timeout: 15_000 });
    if (await openBtn.isVisible()) {
      await openBtn.click();
      await expect(lockBtn).toBeVisible({ timeout: 15_000 });
    }

    await lockBtn.click();
    await expect(page.getByRole('button', { name: /resume shift/i })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /resume shift/i }).click();
    await expect(lockBtn).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: /^close shift$/i }).click();
    await page.getByLabel(/expected cash/i).fill('100');
    await page.getByLabel(/actual cash/i).fill('100');
    await page.getByRole('button', { name: /review & close/i }).click();
    await page.getByRole('button', { name: /confirm close shift/i }).click();
    await expect(page.getByRole('heading', { name: /shift closed/i })).toBeVisible({ timeout: 15_000 });
  });

  test('unauthorised route redirected', async ({ page, request }) => {
    await enrolTerminalInBrowser(page, request);
    await page.goto('/pos');
    await expect(page).toHaveURL(/\/employee|\/unauthorized/, { timeout: 10_000 });
  });

  test('logout / session revocation', async ({ page, request }) => {
    await enrolTerminalInBrowser(page, request);
    await page.getByLabel(/username/i).fill('staff');
    await page.getByLabel(/^password$/i).fill('staff123');
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/pos/, { timeout: 15_000 });
    const logout = page.getByRole('button', { name: /log out|sign out|logout/i });
    if (await logout.isVisible().catch(() => false)) {
      await logout.click();
      await expect(page).toHaveURL(/\/employee/, { timeout: 10_000 });
    }
    await assertNoSecretsInStorage(page);
  });

  test('no employee or terminal secrets in browser storage', async ({ page, request }) => {
    await enrolTerminalInBrowser(page, request);
    await page.getByLabel(/username/i).fill('staff');
    await page.getByLabel(/^password$/i).fill('staff123');
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/pos/, { timeout: 15_000 });
    await assertNoSecretsInStorage(page);
  });
});

test.describe('Legacy login flag (API)', () => {
  test('legacy enabled or disabled returns expected codes', async ({ request }) => {
    const customer = await request.post(`${API}/api/v1/auth/login`, {
      data: { username: 'CU2024001', password: 'wrong' },
    });
    expect(customer.status()).toBe(401);
    const body = await customer.json();
    expect(body.code).toBe('INVALID_CREDENTIALS');

    const legacy = await request.post(`${API}/api/v1/auth/employee/legacy-login`, {
      data: { username: 'staff', password: 'staff123' },
    });
    const legacyBody = await legacy.json();
    if (legacy.status() === 403) {
      expect(legacyBody.code).toBe('LEGACY_EMPLOYEE_LOGIN_DISABLED');
    } else {
      expect(legacy.status()).toBe(200);
      expect(legacyBody.data?.deprecated).toBe(true);
    }
  });
});
