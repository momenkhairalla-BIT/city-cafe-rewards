import type { EmployeeIdentity } from './types';
import { isUiPreviewMode } from '../preview/uiPreviewMode';
import { previewAuthRepository } from '../preview/repositories/previewAuthRepository';

/**
 * Cookie-based employee session client.
 * Never stores employee tokens in localStorage / sessionStorage / IndexedDB.
 * Never reads or writes legacyAccessToken.
 * Terminal identity is a separate HttpOnly cookie (credentials: 'include' only).
 */
export type SessionStatus = 'unknown' | 'anonymous' | 'authenticated' | 'locked';

export interface EmployeeSessionState {
  status: SessionStatus;
  identity: EmployeeIdentity | null;
  idleLocked: boolean;
  lastErrorCode: string | null;
}

type Listener = (state: EmployeeSessionState) => void;

const IDLE_MS = Number(import.meta.env.VITE_EMPLOYEE_IDLE_MS || 15 * 60 * 1000);

let state: EmployeeSessionState = {
  status: 'unknown',
  identity: null,
  idleLocked: false,
  lastErrorCode: null,
};

const listeners = new Set<Listener>();
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let activityBound = false;

function emit() {
  for (const listener of listeners) listener(state);
}

function setState(next: Partial<EmployeeSessionState>) {
  state = { ...state, ...next };
  emit();
}

export function getEmployeeSession(): EmployeeSessionState {
  return state;
}

export function subscribeEmployeeSession(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setEmployeeIdentity(identity: EmployeeIdentity | null) {
  setState({
    status: identity ? 'authenticated' : 'anonymous',
    identity,
    idleLocked: false,
    lastErrorCode: null,
  });
  if (identity) armIdleTimer();
  else clearIdleTimer();
}

export function clearEmployeeSession() {
  setEmployeeIdentity(null);
}

function clearIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
}

function armIdleTimer() {
  clearIdleTimer();
  if (!activityBound && typeof window !== 'undefined') {
    activityBound = true;
    for (const evt of ['pointerdown', 'keydown', 'touchstart']) {
      window.addEventListener(evt, onActivity, { passive: true });
    }
  }
  idleTimer = setTimeout(() => {
    if (state.status === 'authenticated') {
      setState({ idleLocked: true, status: 'locked' });
    }
  }, IDLE_MS);
}

function onActivity() {
  if (state.status === 'authenticated' && !state.idleLocked) {
    armIdleTimer();
  }
}

export function unlockIdleSession() {
  if (state.identity) {
    setState({ idleLocked: false, status: 'authenticated' });
    armIdleTimer();
  }
}

function mapEmployee(raw: Record<string, unknown>): EmployeeIdentity {
  return {
    id: String(raw.id),
    username: String(raw.username || ''),
    role: raw.role as EmployeeIdentity['role'],
    fullName: String(raw.fullName || raw.full_name || ''),
    isGlobalManager: Boolean(raw.isGlobalManager),
    dualRolePosEnabled: Boolean(raw.dualRolePosEnabled),
    selectedProduct: (raw.selectedProduct as 'pos' | 'admin' | null) ?? null,
    assignedBranchIds: Array.isArray(raw.assignedBranchIds)
      ? raw.assignedBranchIds.map(String)
      : [],
    requiresProductSelection: Boolean(raw.requiresProductSelection),
    authMethod: raw.authMethod ? String(raw.authMethod) : undefined,
  };
}

/** Employee API fetch — cookie credentials + Origin for CSRF. */
export async function employeeFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {});
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const res = await fetch(input, {
    ...init,
    credentials: 'include',
    headers,
  });

  if (res.status === 401) {
    const body = await res.clone().json().catch(() => ({}));
    const code = body?.code || 'EMPLOYEE_SESSION_EXPIRED';
    if (code === 'EMPLOYEE_SESSION_EXPIRED' || code === 'EMPLOYEE_SESSION_REQUIRED') {
      setState({ status: 'anonymous', identity: null, idleLocked: false, lastErrorCode: code });
      clearIdleTimer();
    }
  }
  return res;
}

export async function refreshEmployeeSessionFromServer(): Promise<EmployeeSessionState> {
  if (isUiPreviewMode()) {
    const preview = previewAuthRepository.getSession();
    if (preview) {
      setEmployeeIdentity(preview);
      return state;
    }
    // Keep in-memory identity if already set this page session
    if (state.identity && state.status === 'authenticated') {
      return state;
    }
    setState({ status: 'anonymous', identity: null, idleLocked: false, lastErrorCode: null });
    return state;
  }

  try {
    const res = await employeeFetch('/api/v1/auth/employee/session');
    if (!res.ok) {
      setState({ status: 'anonymous', identity: null, idleLocked: false, lastErrorCode: 'EMPLOYEE_SESSION_EXPIRED' });
      return state;
    }
    const body = await res.json();
    const employee = body?.data?.employee;
    if (!employee) {
      setState({ status: 'anonymous', identity: null, idleLocked: false, lastErrorCode: null });
      return state;
    }
    setEmployeeIdentity(mapEmployee(employee));
    return state;
  } catch {
    setState({ status: 'anonymous', identity: null, idleLocked: false, lastErrorCode: 'NETWORK_ERROR' });
    return state;
  }
}

export async function loginWithPassword(username: string, password: string) {
  if (isUiPreviewMode()) {
    const employee = previewAuthRepository.loginWithPassword(username, password);
    setEmployeeIdentity(employee);
    return { employee, session: { preview: true } };
  }

  const res = await employeeFetch('/api/v1/auth/employee/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || 'Login failed') as Error & { code?: string };
    err.code = body.code || 'INVALID_CREDENTIALS';
    throw err;
  }
  // Cookie session only — ignore any unexpected token fields from the payload
  setEmployeeIdentity(mapEmployee(body.data.employee));
  return { employee: body.data.employee, session: body.data.session };
}

export async function loginWithBadge(badgeValue: string, pin: string) {
  if (isUiPreviewMode()) {
    const employee = previewAuthRepository.loginWithBadge(badgeValue, pin);
    setEmployeeIdentity(employee);
    return { employee, session: { preview: true } };
  }

  const res = await employeeFetch('/api/v1/auth/employee/login/badge', {
    method: 'POST',
    body: JSON.stringify({ badgeValue, pin }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || 'Login failed') as Error & { code?: string };
    err.code = body.code || 'INVALID_CREDENTIALS';
    throw err;
  }
  setEmployeeIdentity(mapEmployee(body.data.employee));
  return { employee: body.data.employee, session: body.data.session };
}

export async function logoutEmployee() {
  if (isUiPreviewMode()) {
    previewAuthRepository.logout();
    clearEmployeeSession();
    return;
  }
  try {
    await employeeFetch('/api/v1/auth/employee/logout', { method: 'POST', body: '{}' });
  } finally {
    clearEmployeeSession();
  }
}

export async function selectProduct(product: 'pos' | 'admin') {
  if (isUiPreviewMode()) {
    const employee = previewAuthRepository.selectProduct(product);
    setEmployeeIdentity(employee);
    return { employee };
  }

  const res = await employeeFetch('/api/v1/auth/employee/product-select', {
    method: 'POST',
    body: JSON.stringify({ product }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || 'Product selection failed') as Error & { code?: string };
    err.code = body.code;
    throw err;
  }
  setEmployeeIdentity(mapEmployee(body.data.employee));
  return body.data;
}

export async function reauthenticateForUnlock(username: string, password: string) {
  await loginWithPassword(username, password);
  unlockIdleSession();
}
