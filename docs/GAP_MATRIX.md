# Gap Matrix — Prototype v1.5 → Production POS / Admin

**Phase:** 0  
**Amended:** July 2026 (Phase 0 Review Amendments)  
**Source requirements:** `AIDA_CAFE_TEAM2_PRODUCTION_REWIRE_CURSOR_PROMPT.md` + Phase 0 review corrections  
**Baseline:** `docs/CURRENT_STATE_AUDIT.md`  
**Legend:**

| Status | Meaning |
|--------|---------|
| **Done** | Present and usable in current demo |
| **Partial** | Exists but incomplete / unsafe for production |
| **Missing** | Not implemented |
| **N/A** | Out of Team 2 scope (Team 1 / future / deferred) |

**Priority definitions (authoritative for this pack):**

| Priority | Meaning |
|----------|---------|
| **P0** | Must land before production operations (blocks go-live) |
| **P1** | Required for the **first production release** (includes WCAG 2.2 AA pass) |
| **P2** | Soon after first production release |
| **P3** | Future / configurable |

---

## 1. Product separation and employee access

| Requirement | Current | Gap | Priority | Phase |
|-------------|---------|-----|----------|-------|
| Separate Staff POS and Admin products after login | One SPA; role switcher mixes shells | Split apps/routes; no Admin nav in POS | P0 | 1–2 |
| Unified employee welcome screen | Shared login with customer register + demo buttons | Employee-only welcome; no customer controls | P0 | 2 |
| Employees must not use customer login endpoint | Same `POST /api/auth/login` | Dedicated employee auth; reject employee on customer login | P0 | 2 |
| Staff → POS only; Manager → Admin only | `staff`/`admin` route; admin can open staff UI | Enforce routing + server permissions; dual-role explicit | P0 | 2 |
| Badge/card + PIN credential adapter | Username/password only | Adapter interface + PIN; hash stored credentials | P1 | 2 |
| Secure terminal enrolment (OTC → revocable credential hash) | Missing / fake “Counter 1” | Enrolment, revoke, replace, heartbeat | P0 | 1–2 |
| `device_fingerprint` never used as authentication | N/A (no terminals) | Optional telemetry only; auth = terminal credential | P0 | 1–2 |
| Terminal resolves branch / sales point after enrolment | Hardcoded label | Registry + server-side resolution | P0 | 1–2 |
| Authorized location dropdown fallback | Missing | Branch access list + UI | P0 | 2 |
| Shift open before checkout | Missing | Shifts required for POS | P0 | 2–3 |
| Session audit (login method, terminal, IP, role) | Missing | `audit_logs` + auth events | P0 | 2 |
| Idle lock / short employee sessions | 7d JWT in localStorage | Idle lock + secure employee web session | P0 | 1–2 |
| Location/shift not authoritative in long-lived JWT | N/A | Auth claims = identity/role; resolve context server-side | P0 | 1–3 |
| Employee web session ≠ Team 1 customer Bearer | Same Bearer pattern | Separate mechanisms documented and enforced | P0 | 1–2 |
| Customer accounts blocked from employee flow | Customers use same login screen | Separate employee auth entry | P0 | 2 |

---

## 2. Branch / sales point / terminal model

| Requirement | Current | Gap | Priority | Phase |
|-------------|---------|-----|----------|-------|
| Hierarchy: Branch → Sales Point → Terminal → Shift → Orders | Flat single-café assumption | New tables + FKs on orders | P0 | 1 |
| Second-floor snack as sales point under main cafe | Missing | Seed model + reporting rules | P0 | 1 |
| Shared `inventory_location_id` on sales points | Missing | Schema field (inventory later) | P1 | 1 |
| Order fields: branch, sales_point, terminal, shift, staff_user_id, idempotency | Only unused `staff_user_id` | Additive migration + API; server-injected IDs | P0 | 1–3 |
| Location locked after shift open | Missing | Server enforcement via open shift row | P0 | 2 |
| Explicit `is_global_manager` for global scope | Missing | Flag/capability required; **never** empty access = global | P0 | 1–2 |
| Future branch-scoped managers | Missing | Permission helpers + access table | P1 | 1 |

See `docs/BRANCH_SALES_POINT_MODEL.md`.

---

## 3. Shifts, duty logging, audit

| Requirement | Current | Gap | Priority | Phase |
|-------------|---------|-----|----------|-------|
| Shift open with cash float | Missing | `shifts` table + API | P0 | 2 |
| ≤1 active (`open`/`locked`) shift per terminal | Missing | Partial unique index + transactional open | P0 | 2 |
| Same employee cannot open simultaneous active shifts | Missing | Constraint + policy (default deny) | P0 | 2 |
| Status CHECK (`open`/`locked`/`closed`) | Missing | DB CHECK + handover process | P0 | 2 |
| Shift resume / lock / close + variance | Missing | Full shift lifecycle | P0 | 2 |
| Per-shift sales / payment summary | Today summary is client aggregate | Shift-scoped server summary | P0 | 2–3 |
| Append-only `audit_logs` | Missing | INSERT-only; no UPDATE/DELETE via app or app DB role | P0 | 2 |
| Audit: login/logout, sale, redeem, discount, void, export, etc. | Missing | Event taxonomy; minimize PII; never secrets | P0 | 2–4 |
| No UI to edit/delete audit | N/A (no audit) | Enforce at API + DB grants | P0 | 2 |
| Real staff attribution on orders | Hardcoded `Counter Staff` | Populate `staff_user_id` from authenticated employee | P0 | 3 |

---

## 4. Staff POS capabilities

| Requirement | Current | Gap | Priority | Phase |
|-------------|---------|-----|----------|-------|
| Touch-optimized tablet POS | Partial | Enlarge targets; remove customer chrome | P1 | 3 |
| WCAG 2.2 AA pass (POS + Admin) | Not assessed | Accessibility in **first production release** | P1 | 3–5 |
| Show employee, branch, SP, terminal, shift | Missing / fake labels | Context bar from **server-resolved** context | P0 | 2–3 |
| Limited member lookup/scan only (min fields) | Scan + **full member list** | Restrict list/export; POS DTO only | P0 | 2–3 |
| Member scan + guest sale | Member only; over-broad list | Guest path P1; scan minimize fields P0 | P0/P1 | 3 |
| Menu categories, search, availability | Categories yes; search weak | Search + availability flags | P1 | 3 |
| Server-authoritative totals / prices | Client `unitPrice` trusted | Lookup menu prices server-side | P0 | 3 |
| Server-validated offers | Partial (when `offerId` sent) | Always revalidate; reject client discount bypass | P0 | 3 |
| Decimal / NUMERIC money utility | JS `Number` | Central money helper or integer sen | P0 | 3 |
| Idempotent checkout (key + actor/terminal + payload hash) | Missing | Same key+payload → original; mismatch → **409** | P0 | 3 |
| Atomic sale + loyalty | Transaction exists; no row locks | `FOR UPDATE` / atomic updates | P0 | 3 |
| Payment method recording (soft POS) | Done | Keep; no PAN storage | — | — |
| Receipt + print adapter | Browser print | Adapter interface for future printer | P2 | 3 |
| Redeem staff-only | Done | Keep | — | — |
| Void / refund request + approval | Missing | Workflow + audit | P1 | 3–4 |
| Held orders (durable) | In-memory demo hold | Persist held carts | P2 | 3 |
| Block checkout when API unavailable | Offline still “sells” locally | Hard block production checkout | P0 | 3 |
| Server validates terminal credential + open shift on sale | Missing | Every sensitive POS op | P0 | 3 |

---

## 5. Admin capabilities

| Requirement | Current | Gap | Priority | Phase |
|-------------|---------|-----|----------|-------|
| Desktop management layout (not cashier UI) | Partial (sidebar) | Dedicated Admin app; no POS controls | P0 | 1–4 |
| Full member profiles, management, exports, complete history | Staff can also list today | **Manager-only** | P0 | 2–4 |
| Company overview + branch/SP filters | Single-location KPIs | Multi-location analytics | P0 | 4 |
| Sales by branch, SP, staff, terminal, shift, hour, product, payment | Flat client charts | Server reporting queries | P0 | 4 |
| Manage branches, sales points, terminals (enrol/revoke/replace) | Missing | Admin CRUD + terminal lifecycle | P0 | 2–4 |
| Employee accounts + location assignment + `is_global_manager` | Seed/scripts only | Admin employee CRUD + explicit global flag | P0 | 2–4 |
| Shift monitoring + cash variance | Missing | Admin views | P0 | 4 |
| Member / menu / offers management | Done (demo quality) | Harden validation; joint OpenAPI for shared domains | P1 | 4 |
| Branch-specific offers (future) | Global offers only | Schema ready later | P3 | Later |
| Transactions, voids, refunds | Transactions only | Voids/refunds | P1 | 4 |
| Approval queue | Missing | Manager approvals | P1 | 4 |
| Audit-log viewer (read-only) | Missing | Read-only; no mutate | P0 | 4 |
| CSV/Excel exports with export audit | Client CSV; staff can export members offline | Server export + audit; manager-only for members | P0 | 4 |
| System health / integration status | Partial (`/health`, UI badge) | Admin status panel | P2 | 4 |
| Wire overview to analytics API | Not used by UI | Use `/api/.../analytics` | P1 | 4 |

---

## 6. Integration (Team 1) and ownership

| Requirement | Current | Gap | Priority | Phase |
|-------------|---------|-----|----------|-------|
| One shared API + one DB migration authority | One API; ad hoc migrations | Formal authority + joint shared-domain approval | P0 | 1 |
| OpenAPI 3.1.2 contract | Missing | `openapi.yaml`; joint review for members/menu/offers/loyalty/orders | P0 | 1 |
| Versioned `/api/v1` | Flat `/api` | Add v1; keep legacy during compat | P0 | 1 |
| `TEAM_INTEGRATION_CONTRACT.md` | Missing | Document shared payloads + auth separation | P0 | 1 |
| Contract tests for shared endpoints | Phase scripts only | Formal contract suite | P0 | 5 |
| Production acceptance tests (§16) | Partial smoke scripts | Full acceptance suite is **P0** | P0 | 3–5 |
| No breaking Team 1 payloads without versioning | Single unversioned API | Compatibility period | P0 | 1–5 |
| Neither team creates separate loyalty/order SOR | One DB today | Preserve; enforce in contract | P0 | All |
| Loyalty calc server-only | Partial (client preview + offline) | Offline must not mutate loyalty in prod | P0 | 3 |
| Customer App reads own history only | Partially enforced | Keep/strengthen | P0 | 1 |
| Login rate limiting | Missing | Middleware on customer + employee login | P0 | 2 |
| Request validation (schemas) | Ad-hoc | Zod/Joi (or equivalent) on APIs | P0 | 1–2 |

---

## 7. Security and standards

| Requirement | Current | Gap | Priority | Phase |
|-------------|---------|-----|----------|-------|
| OWASP ASVS L2 baseline | Partial JWT/RBAC | Rate limits, validation, headers, session | P0 | 1–2 |
| PCI DSS posture (no card data) | Soft POS; no PAN | Document + keep external terminals | P0 | Docs + 3 |
| HttpOnly Secure cookies for employee web | Bearer localStorage | Prefer cookies for POS/Admin; Team 1 keeps Bearer | P0 | 1–2 |
| Server-side RBAC + branch scope | Role only | `is_global_manager` OR explicit access rows | P0 | 1 |
| Never log secrets / PIN / raw badge / passwords | Not systematically audited | Logging + audit policy | P0 | 2 |
| WCAG 2.2 AA | Not assessed | **First production release (P1)** | P1 | 3–5 |
| PDPA handling | Not documented | Data retention / export policy; minimize POS member fields | P1 | 5 |
| MyInvois boundary | Not present | Document integration boundary only | P3 | Docs |

---

## 8. Offline and reliability

| Requirement | Current | Gap | Priority | Phase |
|-------------|---------|-----|----------|-------|
| Degraded status when API down | Badge exists | Clearer POS lockout UX | P0 | 3 |
| No silent localStorage production sales | Offline sales allowed | Block checkout; labeled demo mode only | P0 | 3 |
| Future offline queue | N/A | Design later; not Phase 1–5 truth | P3 | Future |

---

## 9. Database / money integrity

| Requirement | Current | Gap | Priority | Phase |
|-------------|---------|-----|----------|-------|
| Additive ordered migrations (single authority) | Partial (002–005) | Continue numbered migrations + rollback notes | P0 | 1+ |
| Safe `students` → `members` path | Still `students` | View/alias staged rename | P2 | 1 / later |
| Preserve historical orders | Present | Do not destructive-migrate | P0 | All |
| UTC store / Asia/Kuala_Lumpur display | Timestamps UTC-ish | Standardize display TZ | P1 | 1 |
| Menu-price authority on sale | Client prices | Server lookup | P0 | 3 |
| Row locking on loyalty | Missing | Add | P0 | 3 |
| Idempotency unique scope + payload hash | Missing | DB constraints + transactional handling | P0 | 3 |

---

## 10. Frontend technology migration

| Requirement | Current | Gap | Priority | Phase |
|-------------|---------|-----|----------|-------|
| React + TS + Vite POS/Admin | Monolith HTML/JS | `apps/pos-admin-web` | P0 | 1 |
| React Router protected routes | Custom `showView` | Protected route tree | P0 | 1 |
| TanStack Query | Manual sync cache | Adopt | P1 | 1–3 |
| RHF + Zod (client) + server schemas | Ad-hoc forms | Adopt; server validation is P0 | P0/P1 | 1–4 |
| Vitest + RTL + Playwright + production acceptance | Script-based API tests | Acceptance suite **P0**; component tests P1 | P0 | 1–5 |
| Staged migration; keep legacy until regression pass | N/A | Dual-run until Phase 5 | P0 | 1–5 |
| Do not delete Team 1 customer UI early | Customer shell present | Leave `#customer-app` until Team 1 cutover | P0 | All |

---

## 11. Testing acceptance gaps (from prompt §16)

| # | Test requirement | Current coverage | Priority |
|---|------------------|------------------|----------|
| 1 | Staff login → POS only | Partial client routing | P0 |
| 2 | Manager → Admin only | Partial | P0 |
| 3 | Unauthorized roles blocked on APIs | Partial (`requireRole`) | P0 |
| 4 | Terminal auto-selects location (after enrolment) | Missing | P0 |
| 5 | Staff sees only permitted locations | Missing | P0 |
| 6 | Location locked during open shift | Missing | P0 |
| 7 | Sale records staff/shift/terminal/SP/branch | Missing | P0 |
| 8 | Snack SP filterable; totals consolidate to main cafe | Missing | P0 |
| 9 | Duplicate checkout → one order (same key+payload) | Missing | P0 |
| 9b | Same key + different payload → HTTP 409 | Missing | P0 |
| 10 | Checkout + loyalty atomic | Partial (txn, no locks) | P0 |
| 11 | Offers revalidated server-side | Partial | P0 |
| 12 | Refund/void/approval audited | Missing | P1 |
| 13 | Customer App contract compatible | No OpenAPI | P0 |
| 14 | No silent localStorage checkout | Fails today | P0 |
| 15 | Audit logs immutable via normal APIs | Missing | P0 |
| 16 | Staff cannot list/export all members | Fails today | P0 |
| 17 | Employee rejected on customer login endpoint | Fails today | P0 |
| 18 | Login rate limiting effective | Missing | P0 |
| 19 | Request validation rejects malformed POS payloads | Missing | P0 |
| 20 | Shift concurrency: one active per terminal; no dual employee shifts | Missing | P0 |

---

## 12. Priority backlog (rolled up) — authoritative

### P0 — block production ops / go-live

1. Split POS vs Admin + employee-only auth (employees blocked from customer login)  
2. Secure terminal enrolment (OTC → revocable credential hash; heartbeat; revoke/replace)  
3. Branch / sales point / terminal / shift schema + order FKs; snack under main cafe  
4. Explicit `is_global_manager`; never empty access = global  
5. Shift concurrency constraints + transactional open + handover  
6. Append-only audit logs (no UPDATE/DELETE via app/DB role)  
7. Server-resolved terminal/location/shift on every sensitive POS op (not JWT-authoritative)  
8. Separate employee web sessions from Team 1 customer Bearer  
9. Staff limited scan DTO only; no list/export all members  
10. Server price authority + scoped idempotency (409 on payload mismatch) + loyalty locking  
11. Block offline localStorage as production sale truth  
12. **Login rate limiting** + **request schema validation**  
13. OpenAPI + `/api/v1` + Team 1 contract; one migration authority  
14. **Production acceptance tests** covering §11 items marked P0  

### P1 — first production release

- Badge/PIN credential adapter  
- Guest sale  
- Void/refund + approval queue  
- Server exports with audit (manager member exports)  
- Employee admin CRUD + branch access UI  
- **WCAG 2.2 AA accessibility pass** for POS and Admin  
- Component/unit test depth beyond acceptance suite  
- PDPA retention/export policy documentation  

### P2 / P3

- Durable held orders, print adapters  
- Branch-specific offers, separate inventory per SP  
- Offline sync queue, MyInvois, payment-provider SDK  

---

## 13. Explicit non-gaps (already acceptable for soft POS)

- Soft payment method selection after external payment (Cash/Card/E-wallet/Student Wallet)  
- Staff-controlled reward redemption  
- Shared Neon DB as single system of record for members/menu/offers/orders  
- Server offer eligibility engine (foundation exists in `services/offers.js`)  
- Loyalty rules: RM1=1pt, 10 stamps = free drink  

---

## Phase 0 Review Amendments

| # | Correction |
|---|------------|
| 1 | Added secure terminal enrolment / revoke / replace / heartbeat; fingerprint ≠ auth. |
| 2 | Added server-side context resolution; JWT must not authoritatively carry location/shift. |
| 3 | Staff member list/export demoted from allowed → **P0 gap**; scan-only min fields. |
| 4 | Global manager requires explicit `is_global_manager`; empty access ≠ global. |
| 5 | Shift concurrency constraints and handover called out as P0. |
| 6 | Idempotency: payload hash + 409 conflict behaviour as P0 (test 9b). |
| 7 | Audit immutability at API + DB role level as P0. |
| 8 | Rate limiting, request validation, production acceptance tests moved to **P0**; WCAG to **P1** (first production release); removed prior P1/P2 contradictions in backlog. |
| 9 | Ownership rows: one API, one migration authority, joint shared-domain OpenAPI approval. |

---

*End of Gap Matrix — Phase 0 (amended)*
