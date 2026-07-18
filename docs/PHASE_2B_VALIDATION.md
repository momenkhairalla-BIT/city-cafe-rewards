# Phase 2B Validation Evidence

**Date:** 18 July 2026  
**Gate:** Phase 2B Closure Gate  
**Neon branch:** `phase1a-validation-20260718` (`br-muddy-truth-aotvi2pm`)  
**Host (sanitised):** `ep-polished-wildflower-aoqhtu9r.c-2.ap-southeast-1.aws.neon.tech`  
**Production:** not migrated / not deployed / not written  
**Temp branch:** retained  
**Phase 3:** not started

## A. Terminal HttpOnly cookie identity

| Item | Detail |
|------|--------|
| Cookie name (dev) | `aida_terminal` |
| Cookie name (prod) | `__Host-aida_terminal` when `TERMINAL_COOKIE_HOST_PREFIX≠0` |
| Flags | HttpOnly, SameSite=Strict, Path=/, no Domain; Secure in production / `__Host-` |
| Expiry | `TERMINAL_COOKIE_MAX_AGE_MS` (default 180 days) |
| Server storage | credential **hash** only (`terminals.credential_hash`) |
| JS | never receives secret; `credentials: 'include'`; probe via `GET /api/v1/terminals/status` |
| Revoke / replace / clear | invalidates old hash; clears cookie |
| Fingerprint | telemetry only |

## B. Legacy login fallback correction

| Item | Detail |
|------|--------|
| Customer login | Still customer-only |
| Valid employee password on customer login | `401` + `EMPLOYEE_LOGIN_REQUIRED` (stable signal) |
| Wrong password / customer rate-limit | `INVALID_CREDENTIALS` / `429` — **no** employee fallback |
| Legacy SPA | Explicit Admin/Staff demo buttons → legacy endpoint; form path falls back **only** on `EMPLOYEE_LOGIN_REQUIRED` |
| Legacy endpoint | `ENABLE_LEGACY_EMPLOYEE_LOGIN=1`, password-only, rate-limited, audited, deprecated Phase 5 |
| React | Never uses `legacyAccessToken` (bundle guard) |

## C. Dual-role fixture (temp branch only)

| Item | Detail |
|------|--------|
| Script | `npm run seed:dual-role:temp` (host-gated to temp Neon) |
| User | `dualrole` / `dualrole123`, `dual_role_pos_enabled=true` |
| Production seeds | **not** modified |

## D. React test-count (12 → 8 → restored)

| Phase | Count | Explanation |
|-------|------:|-------------|
| Phase 1A Closure | **12** | `authMode` + early permission/session/shell coverage |
| Phase 2B initial | **8** | Phase 2B rewrite replaced memory-terminal tests and narrowed `authMode` / session files; earlier cases were overwritten, not intentionally deleted as obsolete |
| Closure Gate | **19** | Restored Phase 1A fail-closed authMode (4) + permissions (5) + session/terminal cookie client + routing + a11y smoke; obsolete memory `get/setTerminalCredential` tests removed because behaviour intentionally changed to HttpOnly cookies |

## E. Test results (Closure Gate)

| Suite | Result |
|-------|--------|
| `test:authz` | **14/14** |
| `test:phase2a` | **24/24** |
| `test:terminal-cookie` | **7/7** |
| `test:dual-role` | **4/4** |
| `test:legacy-employee` | **7/7** (flag-on dual-run; flag-disabled path asserted when server started without flag) |
| `test:v1-security` | **10/10** |
| `test:phase5` | **12/12** |
| OpenAPI lint | **Pass** |
| React typecheck | **Pass** |
| React unit tests | **19/19** |
| React production build + bundle guard | **Pass** |
| Playwright E2E | **9/9** (`npm run test:e2e` against temp API `:3011` + Vite `:5173`) |
| Legacy flag-off | **Pass** — `LEGACY_EMPLOYEE_LOGIN_DISABLED` on port 3013 without `ENABLE_LEGACY_EMPLOYEE_LOGIN` |

## F. Accessibility

Automated smoke (Vitest): terminal activation heading/labels; idle-lock `role="dialog"` + `aria-modal`; password label.  
CSS retains ≥48px touch targets, `focus-visible` gold outlines, `role="alert"` on form errors.

## G. Confirmations

- Production parent not migrated/deployed
- Temp Neon branch retained
- POS checkout / Admin modules not ported (shells only)
- Phase 3 not started
- Dual-role fixture not in production seeds
