# Current State Audit — Aida Cafe Rewards v1.5

**Phase:** 0 (Audit and safe plan)  
**Audited:** July 2026  
**Amended:** July 2026 (Phase 0 Review Amendments)  
**App version:** `v1.5-demo-ready`  
**Live URL:** https://city-cafe-rewards.onrender.com  
**Scope:** Existing monolith before Team 2 POS/Admin production rewire  
**Status:** Documentation only — no production code changed in Phase 0

---

## 1. Executive verdict

The system is a **working soft-POS loyalty demo** on Render + Neon. It correctly demonstrates Customer / Staff / Admin roles, JWT auth, member scan, offers, sales recording, and loyalty updates against a shared PostgreSQL database.

It is **not yet production-ready** for multi-branch café operations. Critical gaps: no secure terminal enrolment, no branches/sales points/shifts with concurrency rules, no append-only audit log, client-trusted cart prices, no checkout idempotency with payload hashing, JWT in `localStorage` with no idle lock, staff can list all members today, offline localStorage can silently become “sale truth,” and Staff POS + Admin + Customer share one SPA and one login endpoint.

---

## 2. System inventory

### 2.1 Architecture (as deployed)

```text
Browser (index.html + js/city-cafe-v2.js)
        │  HTTPS + JWT Bearer (localStorage)
        ▼
Node.js Express API (Render) — production/api/src/index.js
        │
        ▼
Neon PostgreSQL (ap-southeast-1)
```

| Layer | Technology | Location |
|-------|------------|----------|
| Frontend | Single HTML/JS SPA | `index.html` (~4307 lines), `js/city-cafe-v2.js` (~556 lines) |
| API | Express ESM, Node ≥20 | `production/api/src/` |
| DB | PostgreSQL on Neon | `production/database/*.sql` |
| Auth | JWT + bcryptjs | `services/auth.js`, `middleware/auth.js` |
| Hosting | Render free tier | `render.yaml` |
| Version | `v1.5-demo-ready` | `production/api/src/version.js` |

### 2.2 Roles today

| Role (JWT) | UI shell | Notes |
|------------|----------|-------|
| `customer` | `#customer-app` | Team 1 domain (leave alone in rewire) |
| `staff` | `#staff-app` | Soft POS; can list all members via API |
| `admin` | `#admin-app` | Management + can also open staff/customer via role switcher |
| Legacy enum `student` | — | Exists in DB enum history; app uses `customer` |

There is **no** `cashier` / `manager` distinction beyond `staff` / `admin`. There is **no** `is_global_manager` flag. Employee and customer accounts share `POST /api/auth/login`.

### 2.3 Data domains present

| Domain | System of record | Notes |
|--------|------------------|-------|
| Login users | `users` | username, email, password_hash, role |
| Members / loyalty | `students` | **All members** live here (students + general) |
| Menu | `menu_items` | Includes base64 images |
| Offers | `offers` | eligibility + discount types |
| Vouchers | `vouchers` | points catalog |
| Orders | `orders` + `order_items` | Purchase / Reward / Free Drink |
| Analytics view | `loyalty_transactions` | SQL view over orders |

**Absent:** `branches`, `sales_points`, `terminals` (with enrolment credentials), `shifts`, `staff_credentials`, `user_branch_access`, `is_global_manager`, `audit_logs`, `inventory_locations`, void/refund tables, idempotency store with payload hash.

---

## 3. Frontend audit (Team 2 focus)

### 3.1 Structure

| Shell | Element ID | Layout |
|-------|------------|--------|
| Login | `#login-screen` | Shared customer + employee + demo quick-login |
| Entry / role picker | `#entry-screen` | Demo-oriented |
| Customer | `#customer-app` | Mobile frame — **Team 1** |
| Staff POS | `#staff-app` | Tablet tabs |
| Admin | `#admin-app` | Desktop sidebar |
| Role switcher | `#role-switcher` | Always visible when logged in |

**Finding:** POS and Admin are **not separate products**. They share one SPA, globals (`loadData`, `apiEnabled`, `posCart`), and a top role switcher. Admin sessions may open Staff and Customer views client-side. Employee and customer authentication are not separated.

### 3.2 Where logic actually lives

| Concern | Primary location |
|---------|------------------|
| Data/API sync, staff POS UI, admin UI | Inline `<script>` in `index.html` (~L1377–4295) |
| Auth session, login/register, offer helpers, `showView`/`posCheckout` patches | `js/city-cafe-v2.js` |
| Staff POS render/actions | `index.html` ~L2485–3159 |
| Admin render/actions | `index.html` ~L3161–4249 |
| Customer UI | `index.html` ~L2268–2480 — **do not rewrite for Team 2** |

### 3.3 Staff POS — what works today

| Feature | Status | Live path | Offline path |
|---------|--------|-----------|--------------|
| Member scan (ID/code/phone) | Working | `GET /api/scan/:code` | localStorage lookup |
| List all members | Working (over-privileged) | `GET /api/members`, `GET /api/students` | local list |
| Camera QR | Not implemented | Decorative UI only | — |
| Menu categories + cart | Working | Menu synced from API | local menu |
| Product images | Working | From DB | local |
| Offers preview | Working | Client calc + server revalidate if `offerId` | Client-only |
| Soft payment methods | Working | Stored on order | local tx |
| Cash + change | Working | Client + stored | local |
| Checkout | Working | `POST /api/orders/sales` | Mutates localStorage |
| Receipt / print / download | Working | From response or local | local |
| Redeem voucher / free drink | Working | `POST /api/orders/redeem` | local mutate |
| Sales history / today summary | Working | Synced transactions | local aggregate |
| Hold / resume cart | Demo-only | In-memory single slot | Lost on refresh |
| Cashier identity | Fake | Hardcoded `CASHIER_NAME = 'Counter Staff'` | Same |
| Counter / terminal label | Fake | UI shows “Counter 1” — not enrolled | — |
| Secure terminal enrolment | Missing | — | — |
| Shift open/close | Missing | — | — |
| Guest sale (no member) | Missing | Member required | — |
| Void / refund | Missing | — | — |
| Idempotent checkout | Missing | Double-submit risk | — |

### 3.4 Admin — what works today

| Feature | Status | Notes |
|---------|--------|-------|
| Overview KPIs / charts | Partial | Client-side from synced data; **does not call** `GET /api/analytics/overview` |
| Members CRUD + full list/export | Working | API when live; staff also over-privileged today |
| Offers CRUD | Working | API when live |
| Menu + image upload | Working | Base64 in DB; 500KB limit |
| Transactions list | Working | Synced list |
| CSV / JSON export | Working | **Browser-side** from `loadData()`, not server export API |
| Import backup / reset demo | Demo tools | Dangerous on shared admin session |
| SOP / Demo Guide | Static | Content in UI |
| Branch / terminal / shift admin | Missing | — |
| Employee / access management | Missing | Only demo users via seed/scripts |
| Audit log viewer | Missing | — |
| Approval queue (void/refund) | Missing | — |
| Voucher points edit | Local-only | Does not persist to Neon via API |

### 3.5 Auth session (frontend)

| Item | Current behavior |
|------|------------------|
| Token storage | `localStorage` key `cityCafeAuthSession` |
| Transport | `Authorization: Bearer <jwt>` (same pattern for all roles) |
| Expiry | Server JWT default `7d` (`JWT_EXPIRES_IN`) |
| Idle lock | **None** |
| Logout | Clears session key |
| Role routing | `routeAfterLogin` → admin / staff / customer |
| Client gate | Patched `showView` checks role (advisory) |
| Server gate | Real enforcement via `requireAuth` / `requireRole` |
| Location/shift in token | N/A today (no such fields) |

**Target note (not implemented):** Employee web sessions and Team 1 customer Bearer auth must remain separate. Operational context (`branchId`, `salesPointId`, `terminalId`, `shiftId`) must **not** be treated as authoritative if placed in a long-lived JWT; the server must resolve and validate them on every sensitive POS operation.

### 3.6 Offline / demo mode (critical)

Activated when:

- Page opened as `file://`
- `/health` fails
- Sync fails after login
- No token (partial “live but login required” state)

When `apiEnabled === false`, scan/sale/redeem write **only to localStorage**. Toasts still look like successful production sales. **There is no sync-back queue.** This must not remain production transaction truth (see migration plan).

---

## 4. Backend audit

### 4.1 Endpoint inventory

| Method | Path | Auth | Roles | Purpose |
|--------|------|------|-------|---------|
| GET | `/health` | Public | — | DB + version |
| GET | `/` | Public | — | Serves UI |
| POST | `/api/auth/register` | Public | — | Customer register |
| POST | `/api/auth/login` | Public | — | **Shared** multi-identifier login (customer + staff + admin) |
| GET | `/api/auth/me` | JWT | any | Current user + member |
| GET | `/api/menu` | JWT | any | List menu (`?all=` staff/admin) |
| POST/PUT/PATCH | `/api/menu…` | JWT | admin | Menu CRUD / status |
| GET | `/api/students` | JWT | **staff, admin** | List **all** members (over-privileged for POS) |
| GET | `/api/students/:code…` | JWT | staff/admin or own | Profile / history |
| GET | `/api/members` | JWT | **staff, admin** | List **all** members (over-privileged for POS) |
| GET/POST/PUT/PATCH | `/api/members…` | JWT | staff/admin or own | Member API |
| GET | `/api/scan/:code` | JWT | staff, admin | POS member lookup (keep; minimize fields in target) |
| GET/POST/PUT/PATCH | `/api/offers…` | JWT | write=admin | Offers |
| POST | `/api/orders/sales` | JWT | staff, admin | Soft-POS sale |
| POST | `/api/orders/redeem` | JWT | staff, admin | Redeem |
| GET | `/api/orders/sales` | JWT | staff, admin | Purchase list |
| GET | `/api/orders/transactions` | JWT | staff, admin | All tx types |
| GET | `/api/analytics/overview` | JWT | admin | KPI overview |

**Missing APIs for production POS/Admin:** separate employee login, terminal enrolment/revocation/heartbeat, shifts with concurrency constraints, branch access + `is_global_manager`, void/refund/approvals, append-only audit logs, server-side exports, logout/revoke, **login rate limiting (P0)**, **request schema validation (P0)**, `/api/v1` versioning, OpenAPI contract, production acceptance test suite (P0).

### 4.2 Reusable modules (keep and extend)

| Module | Path | Why keep |
|--------|------|----------|
| Auth middleware | `middleware/auth.js` | Clean `requireAuth` / `requireRole` |
| Password/JWT helpers | `services/auth.js` | bcrypt + JWT pattern |
| Login resolution | `services/auth-users.js` | Multi-identifier login (split customer vs employee entry) |
| Member scan | `services/members.js` | Core identity lookup (restrict response DTO for POS) |
| Offer engine | `services/offers.js` | Server eligibility + discount calc |
| Loyalty rules | `services/loyalty.js` | Points/stamps/free drink rules |
| Menu routes | `routes/menu.js` | Admin CRUD + image validation |
| Scan route | `routes/scan.js` | POS entry point (narrow fields) |
| DB pool | `db/pool.js` | Neon connectivity |
| Phase regression scripts | `scripts/test-phase*.js` | Pattern for contract + acceptance tests |

### 4.3 Redesign candidates

| Area | Path | Why redesign |
|------|------|--------------|
| Shared login | `routes/auth.js` | Split customer vs employee auth; block employees on customer login |
| Member list APIs | `routes/members.js`, `students.js` | Staff must not list/export all members |
| Sales/redeem | `routes/orders.js` | Client prices; no scoped idempotency; unused `staff_user_id`; no server-resolved terminal/shift |
| Loyalty mutations | `services/loyalty.js` | No `SELECT … FOR UPDATE`; race on concurrent redeem/sale |
| Session model | Frontend + auth | Separate employee web session vs Team 1 Bearer; no authoritative location claims in long-lived JWT |
| Analytics | `routes/analytics.js` | Too thin for multi-branch POS reporting |
| Schema naming | `students` table | Document staged path to `members` |
| Static monolith serve | `index.js` | Eventually split `apps/pos-admin-web` from API |

### 4.4 Sale path details (verified)

File: `production/api/src/routes/orders.js`

1. Begins DB transaction.
2. Resolves member by scan code.
3. Computes subtotal from **request body** `unitPrice × quantity` (not `menu_items` lookup).
4. If `offerId` present → server validates offer and recalculates discount.
5. Else → may accept client `discount` / `pointsMultiplier`.
6. Applies loyalty via `applyPurchaseLoyalty`.
7. Inserts `orders` + `order_items`.
8. Commits.

**Gaps verified in code:**

- `cashierName` defaults to `'Counter Staff'`; free text from client.
- Schema column `orders.staff_user_id` exists but is **not populated** from `req.user.id`.
- No `idempotency_key`, request payload hash, actor/terminal scope uniqueness.
- No `branch_id`, `sales_point_id`, `terminal_id`, `shift_id`.
- Order number: `ORD-${Date.now()…}` — collision risk under concurrency.
- No server-side resolution of enrolled terminal or open shift.

---

## 5. Database audit

### 5.1 Migration chain

| File | Purpose |
|------|---------|
| `schema.sql` | Base tables + `loyalty_transactions` view |
| `002_members_upgrade.sql` | Member fields, `offers`, `customer` role, demo users |
| `003_phase3_offers.sql` | `orders.discount_type` |
| `004_link_demo_users.sql` | Link demo members ↔ users |
| `005_menu_images.sql` | Image URL/alt columns |
| `seed.sql` | Menu, vouchers, sample students |

**Operational notes:**

- `setup-db.js` applies schema + seed + 002 + 003 + 005; **004 is separate** (`migrate-v4`).
- `docker-compose.yml` mounts schema + seed only — migrations not auto-applied on compose.
- **Target:** one shared database migration authority (Team 2 operational ownership of migration files; shared-domain changes require joint OpenAPI review — see ownership section).

### 5.2 Important schema facts

- `students` = all loyalty members (`customer_type`: `city_student` | `general_customer`).
- `order_items` denormalizes name/price; **no FK to `menu_items`**.
- Money columns are `NUMERIC(10,2)` in DB; application math uses JavaScript `Number`.
- `users.role` enum historically included `student`; app roles are `admin` / `staff` / `customer`.

---

## 6. Security audit (current)

| Control | Status | Risk |
|---------|--------|------|
| JWT required on `/api/*` (except login/register) | Present | Baseline OK |
| Role gates on scan/orders/analytics/menu writes | Present | Baseline OK |
| bcrypt passwords | Present | OK; `DEMO:` plaintext hashes still accepted as legacy |
| Separate employee vs customer login | **Absent** | Employees use customer login endpoint |
| Rate limiting on login | **Absent** | Brute force — **P0** |
| Request schema validation (Zod/Joi) | **Absent** | Ad-hoc checks only — **P0** |
| Helmet / security headers | **Absent** | Baseline hardening gap |
| CORS default `origin: true` | Loose | Tighten for production |
| Employee JWT in localStorage | Present | XSS / shared-terminal theft |
| Idle lock / short sessions | **Absent** | Walk-away risk |
| Secure terminal credential | **Absent** | Device fingerprint alone is not auth |
| Audit log (append-only) | **Absent** | No attribution trail |
| Client-trusted prices | Present | Price tampering |
| Staff can list all members | Present | PDPA / over-exposure |
| Offline sales as local truth | Present | Financial integrity |
| PAN/CVV storage | Not present | Soft POS only — keep it that way |
| Demo credentials on login UI | Present | Must strip from production builds |

---

## 7. Testing and deploy audit

### 7.1 Tests

| Script | Coverage |
|--------|----------|
| `test:acceptance` | Health, auth gates, scan, sale+offer, register, menu, analytics 403 |
| `test:phase2` | Multi-identifier login, member compat |
| `test:phase3` | Offer eligibility and discount math |
| `test:phase4` | Menu images |
| `test:phase5` | Demo/version smoke |
| `test:production(:live)` | Live smoke; optional writes |

**Gaps (P0 for production acceptance):** no production acceptance suite covering prompt §16 items; no concurrency/idempotency/payload-conflict tests; no price-tamper tests; no Playwright E2E; no OpenAPI contract tests; redeem race not covered. Existing phase scripts are useful precursors but are **not** a substitute for P0 production acceptance tests.

### 7.2 Deploy

| Artifact | Notes |
|----------|-------|
| `render.yaml` | Root `production/api`; health `/health`; `DATABASE_URL` + `JWT_SECRET` |
| `Dockerfile` | Copies API + `index.html` + `js` + `assets` |
| `railway.toml` | Alternate host path |
| Migrations on deploy | **Manual / out-of-band** — not in Render build |

---

## 8. Team ownership boundary (as-is vs target)

| Domain | Today | Target ownership |
|--------|-------|------------------|
| Shared Core API | One Express API | **One shared API** — both teams consume; Team 2 maintains operational modules |
| Database migrations | Team 2 repo files (ad hoc) | **One migration authority** (this repo’s ordered SQL); shared-domain migrations require joint approval |
| Customer mobile UI | Same SPA `#customer-app` | **Team 1** Android/iOS + customer-specific integration |
| Staff POS UI | Same SPA `#staff-app` | **Team 2** → `apps/pos-admin-web` |
| Admin UI | Same SPA `#admin-app` | **Team 2** → `apps/pos-admin-web` |
| Branches, terminals, shifts, operational APIs | Missing | **Team 2** |
| Members, menu, offers, loyalty, orders | Shared tables/APIs | **Shared domains** — OpenAPI review + joint approval; neither team may create a separate loyalty or order source of truth |
| Loyalty / offers calc | Server services (+ client preview) | Server-only authority in shared API |
| Customer auth (Bearer) | Shared login | **Team 1** customer endpoints — separate from employee web sessions |
| Employee auth / POS session | Same login | **Team 2** employee endpoints + terminal-bound context |

---

## 9. Files that will change in later phases (preview)

Phase 0 creates/revises docs only. Later phases will touch (not exhaustive):

| Area | Likely paths |
|------|----------------|
| New React app | `apps/pos-admin-web/**` (new) |
| Migrations | `production/database/006_*.sql` onward (single authority) |
| Orders/loyalty | `production/api/src/routes/orders.js`, `services/loyalty.js` |
| New modules | terminals (enrolment), shifts, branches, audit, employee auth |
| OpenAPI | `openapi.yaml`, `/api/v1/*` (joint review for shared domains) |
| Legacy UI | Keep `index.html` until Phase 5 retirement; **do not delete Customer shell early** |
| Deploy docs | `production/DEPLOY.md`, runbooks |

---

## 10. Summary of reusable assets

**Keep:** Neon schema foundation, JWT/RBAC middleware, member scan foundation, offer engine, loyalty rules, menu CRUD, phase test scripts, soft payment method model (as external-payment recording), Aida branding tokens in CSS.

**Replace for production:** Monolithic Staff+Admin SPA shells, shared customer/employee login, localStorage-as-sale-truth, hardcoded cashier, client price authority, staff full-member list access, missing operational hierarchy with secure terminal enrolment, missing append-only auditability, missing scoped checkout idempotency.

---

## 11. Phase 0 deliverables cross-reference

| Document | Purpose |
|----------|---------|
| `docs/CURRENT_STATE_AUDIT.md` | This file |
| `docs/GAP_MATRIX.md` | Requirement vs current vs priority |
| `docs/PRODUCTION_MIGRATION_PLAN.md` | Phased plan, risks, rollback |
| `docs/ROLE_PERMISSION_MATRIX.md` | Target RBAC |
| `docs/BRANCH_SALES_POINT_MODEL.md` | Location hierarchy + terminal enrolment + snack station |

---

## Phase 0 Review Amendments

| # | Correction |
|---|------------|
| 1 | Documented absence of secure terminal enrolment; `device_fingerprint` must never be authentication (see branch model). |
| 2 | Clarified that location/shift must not be authoritative in long-lived JWT; employee web sessions ≠ Team 1 Bearer. |
| 3 | Flagged staff over-privilege: list-all-members APIs; target is limited scan DTO only. |
| 4 | Noted missing `is_global_manager`; empty branch access must never mean global. |
| 5 | Noted missing shift concurrency constraints (documented in branch/role/migration docs). |
| 6 | Noted missing scoped idempotency + payload-hash / 409 behaviour. |
| 7 | Noted missing append-only audit immutability controls. |
| 8 | Marked login rate limiting, request validation, and production acceptance tests as **P0** gaps. |
| 9 | Defined one shared API + one migration authority; Team 1 vs Team 2 vs joint shared-domain approval. |

---

*End of Current State Audit — Phase 0 (amended)*
