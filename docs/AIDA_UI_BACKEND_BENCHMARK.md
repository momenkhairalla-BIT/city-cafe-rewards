# Aida UI ↔ Backend Behaviour Benchmark

**Audience:** Team 2 (API / database)  
**Owner of this UI work:** Team 1 (React POS / Admin UI only)  
**Status:** UI preview repositories simulate behaviour until Team 2 connects live adapters.

Team 1 must **not** apply migrations, modify `production/api`, access Neon, or mint production OTCs.

---

## 1. Terminal enrolment (required live behaviour)

| Behaviour | UI preview simulation | Required Team 2 API behaviour |
|-----------|----------------------|-------------------------------|
| Manager-issued OTC | Sample `AIDA-482731` | `POST /api/v1/terminals/:id/enrolment-codes` returns code once |
| Device cannot invent code | Enforced in copy + UI | Reject client-generated secrets |
| Single-use | Second use of sample → consumed error | Consume OTC on successful enrol; reject reuse |
| Expiry | Countdown + `AIDA-EXPIRED` / simulate button | Reject expired OTC with clear code |
| Invalid code | Any other string | `INVALID_ENROLMENT_CODE` (or equivalent) |
| Success binding | Main Café · Main Counter · `POS-MAIN-01` | Resolve branch/sales point/terminal server-side |
| Credential storage | sessionStorage flag only (preview) | HttpOnly terminal cookie; **never** JSON secret |
| Fingerprint | Not used to authenticate | Telemetry only |

### Adapter interface (UI)

See `apps/pos-admin-web/src/preview/repositories/terminalAdapter.ts`:

- `getStatus()`
- `enrol(enrolmentCode)`

Live implementation should wrap:

- `GET /api/v1/terminals/status`
- `POST /api/v1/terminals/enrol`
- `GET /api/v1/terminals/current`

---

## 2. Employee authentication (required live behaviour)

| Behaviour | UI preview | Required Team 2 |
|-----------|------------|-----------------|
| Password login | Demo users below | `POST /api/v1/auth/employee/login` + session cookie |
| Badge + PIN | `PREVIEW-BADGE` / `4821` | `POST /api/v1/auth/employee/login/badge` |
| Session refresh | In-memory preview session | `GET /api/v1/auth/employee/session` |
| Logout | Clears preview session | `POST /api/v1/auth/employee/logout` |
| Dual-role select | Preview dual user | `POST /api/v1/auth/employee/product-select` |
| CSRF | N/A in preview | Origin check on mutating cookie routes |
| Secrets | Demo passwords labelled | No password/PIN/hashes in UI responses |

### Demonstration credentials (preview only)

These are **not** production authentication:

| Role | Username | Password |
|------|----------|----------|
| Sample Admin | `preview.admin` | `preview123` |
| Sample Staff | `preview.staff` | `preview123` |
| Sample Dual-role | `preview.dual` | `preview123` |

---

## 3. Shifts (required live behaviour)

| Behaviour | UI preview | Required Team 2 |
|-----------|------------|-----------------|
| Open / lock / resume / close | In-memory preview shift | `/api/v1/shifts/*` |
| Location from terminal | Bound to preview Main Counter | Server resolves from terminal cookie |
| Block sales without open shift | Counter only when open | Enforce on `POST /api/v1/pos/sales` |

---

## 4. POS sales (out of Team 1 UI scope for live write)

| Behaviour | UI today | Required Team 2 |
|-----------|----------|-----------------|
| Soft payment UI | Preview receipt only | `POST /api/v1/pos/sales` behind `ENABLE_POS_SALES` |
| Pricing / loyalty | Display fixtures | Server-authoritative |
| Modifiers | UI-concept models | Shared contract pending |

---

## 5. Production fail-closed

- `VITE_UI_PREVIEW_MODE=true` is **rejected** on production Vite builds (`vite.config.ts`).
- Preview fixtures must never mix with live KPI numbers on the same page.

---

## 6. Acceptance checklist for Team 2 handoff

- [ ] OTC issue + enrol + single-use + expiry match matrix above  
- [ ] Terminal cookie HttpOnly; no credential in JSON  
- [ ] Employee cookie session + CSRF  
- [ ] Shift lifecycle attributed from terminal  
- [ ] Empty branch access ≠ global manager  
- [ ] POS sales remain flag-gated until approved  
