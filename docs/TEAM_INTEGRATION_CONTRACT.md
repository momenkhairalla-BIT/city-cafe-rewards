# Team Integration Contract — Aida Cafe Shared Core API

**Version:** Phase 3A  
**OpenAPI:** `openapi.yaml` (OpenAPI 3.1.2)  
**Base paths:** Legacy `/api/*` (supported) · Preferred `/api/v1/*`  
**Authority:** Amended Phase 0 documents + this contract  
**Team 1 compatibility diff:** `docs/PHASE_3A_OPENAPI_DIFF.md`

---

## 1. Ownership

| Domain | Owner |
|--------|-------|
| Android / iOS customer application and customer-specific integration | **Team 1** |
| Staff POS, Management Admin, branches, terminals, shifts, operational APIs | **Team 2** |
| Shared Core API runtime + ordered PostgreSQL migrations | **Single authority (this repository)** — Team 2 maintains operational modules |
| Members, menu, offers, loyalty, orders (shared domains) | **Joint** — OpenAPI review and approval before breaking changes |

**Hard rules:**

1. The **shared API** and **shared PostgreSQL database** are the **only** sources of truth for members, menu, offers, loyalty balances, and orders.
2. **Neither team** may create a separate loyalty engine or order store.
3. **Team 1 must never connect directly to the production database.** All access is via the versioned HTTP API.
4. Shared-domain request/response changes require **OpenAPI review** and joint approval, with a compatibility window when breaking.

---

## 2. Authentication boundaries

| Audience | Mechanism (Phase 2A) | Notes |
|----------|----------------------|-------|
| Customer (Team 1) | Bearer JWT from `/api/v1/auth/login` or `/api/auth/login` | Employees with valid password → `EMPLOYEE_LOGIN_REQUIRED`; wrong password → `INVALID_CREDENTIALS` |
| Employee web POS/Admin (Team 2) | HttpOnly cookie via `/api/v1/auth/employee/*` | **Not** localStorage; CSRF Origin required on mutating cookie routes |
| POS terminal device | HttpOnly terminal cookie (`aida_terminal` / `__Host-aida_terminal`) | Hash stored server-side; JS never reads secret; fingerprint never authenticates |
| Employee POS sale (Phase 3A) | `POST /api/v1/pos/sales` | Requires `ENABLE_POS_SALES=1` + employee cookie + terminal cookie + open shift + `Idempotency-Key` |

**CSRF:** Cookie-authenticated `POST`/`PUT`/`PATCH`/`DELETE` under `/api/v1` employee/terminal-management routes require an allowed `Origin` (or Referer origin).

**Dual-run (deprecated):** `POST /api/v1/auth/employee/legacy-login` issues a short-lived Bearer token for the legacy `index.html` SPA only when `ENABLE_LEGACY_EMPLOYEE_LOGIN=1`. Password only; badge/PIN forbidden. **Removal scheduled: Phase 5.** React POS/Admin must use the cookie session exclusively and must never call this endpoint or store its token.

**Authoritative context:** `branchId`, `salesPointId`, `terminalId`, and `shiftId` are **never** trusted from client body/JWT. Server resolves them from enrolled terminal + open shift.

---

## 3. Stable identifiers

| Entity | Stable IDs |
|--------|------------|
| Member | UUID `id`, `member_code`, `student_id` (nullable for general customers) |
| Menu item | UUID `id`, `slug` |
| Offer | UUID `id`, `slug` |
| Order | UUID `id`, `order_number` |
| Branch / sales point / terminal | UUID `id`, stable `code` (e.g. `BR-MAIN`, `SP-SNACK`) |

Do not use display names as foreign keys or integration keys.

**Note:** Members are stored in the `students` table today. Do not assume a rename; a compatibility view may be added later without breaking IDs.

---

## 4. Shared domains (current behaviour)

### 4.1 Members / loyalty snapshot

- Customer may read **own** profile and history.
- Staff currently can list members (legacy). **Contract intent (Phase 2+):** POS uses **limited scan/lookup** only; full list/export/history is manager-only.
- Loyalty balances (points, stamps, free drinks) change only through server sale/redeem (or future approved adjustments).

### 4.2 Menu

- Admin writes menu (including images).
- Customer App and POS **read** through the API.
- Active items are the default customer/POS catalog.

### 4.3 Offers

- Admin writes offers.
- Eligibility and discount math are **server-side** for sales when `offerId` is supplied.
- Do not duplicate authoritative offer calculation in Team 1 or Team 2 clients.

### 4.4 Orders / loyalty

- **Single source of truth:** PostgreSQL `orders` / `order_items` / `students` loyalty columns (no second ledger).
- Legacy Bearer path: `POST /api/v1/orders/sales` (Team 1 / legacy SPA) — shape frozen.
- New employee POS path: `POST /api/v1/pos/sales` — server prices from `menu_items`, attribution from terminal/shift, scoped idempotency.
- Customer App reads the authenticated member’s own history.
- Soft payment methods only: `Cash`, `Card`, `E-wallet`, `Student Wallet` — recorded method ≠ gateway settlement; no PAN/CVV storage.
- Guest sales: `orders.student_id` nullable; no loyalty mutation.

---

## 5. Standard errors

Typical JSON error body:

```json
{
  "error": "Human-readable message",
  "code": "STABLE_CODE_OPTIONAL"
}
```

| HTTP | Meaning |
|------|---------|
| 400 | Validation / bad request |
| 401 | Missing or invalid authentication |
| 403 | Authenticated but forbidden |
| 404 | Not found |
| 409 | Conflict (idempotency key reused with different payload; voucher already redeemed) |
| 501 | Planned endpoint not implemented |

Clients must not assume undocumented fields are stable. Prefer `code` when present.

---

## 6. Pagination

Current list endpoints primarily accept a `limit` query parameter (caps enforced server-side).

**Forward compatibility:** New `/api/v1` list endpoints SHOULD adopt explicit pagination metadata (`limit`, `offset` or cursor, optional `total`). Until then, Team 1 must tolerate responses without pagination envelopes.

---

## 7. Compatibility rules

1. Prefer `/api/v1` for new Team 1 work.
2. Legacy `/api` remains during the dual-run period; do not remove without a deprecation notice.
3. Additive response fields are allowed without a major version bump.
4. Removing/renaming fields or changing auth requirements for shared domains requires OpenAPI update + joint approval + compatibility period.
5. Endpoints marked `x-status: planned` in `openapi.yaml` are **not production-ready** — do not advertise or call them as live.

---

## 8. Implemented vs planned (Phase 1A)

**Implemented (safe to integrate with current behaviour):**

- Auth login / register / me  
- Menu, members, students, scan, offers  
- Orders sales / redeem / lists  
- Analytics overview (admin)  
- `GET /api/v1` catalog  

**Planned (not implemented — do not use):**

- `POST /api/v1/auth/employee/login`  
- Terminal enrol / heartbeat / revoke  
- Shift open / lock / close  
- Audit log APIs  

---

## 9. Database and migrations

- Migrations live as ordered SQL under `production/database/`.
- **Never apply experimental migrations to production Neon without a release process.**
- Team 1 does not run migrations against production.
- Shared-domain schema changes require joint review.

Staging apply example (disposable DB only):

```powershell
cd production/api
# DATABASE_URL must point to local/staging — migrate-v6/v7 refuse non-local unless ALLOW_NONLOCAL_MIGRATE=1
npm run migrate-v6
npm run migrate-v7
```

---

## 10. Team 1 checklist

- [ ] Consume `openapi.yaml` and this contract in the mobile app repo.
- [ ] List every endpoint the Customer App calls today.
- [ ] Confirm Bearer JWT remains the customer auth model.
- [ ] Never embed production `DATABASE_URL` or connect to Postgres from the app.
- [ ] Ignore `x-status: planned` operations until Team 2 marks them implemented.
- [ ] Join OpenAPI review before any shared-domain breaking change.

---

## 11. Team 2 checklist

- [ ] Keep legacy `/api` working during dual-run.
- [ ] Do not store employee tokens in localStorage in `apps/pos-admin-web`.
- [ ] Enforce authorization on the server; UI routes are not security controls.
- [ ] Update OpenAPI when implementing planned endpoints.
- [ ] Keep snack station modeled as a sales point under Main Cafe.

---

*End of Team Integration Contract — Phase 1A*
