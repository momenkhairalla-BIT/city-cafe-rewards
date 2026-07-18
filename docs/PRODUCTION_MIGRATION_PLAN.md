# Production Migration Plan — Team 2 POS / Admin Rewire

**Phase:** 0 (plan only — no production code changes in this document’s delivery)  
**Amended:** July 2026 (Phase 0 Review Amendments)  
**Baseline:** Aida Cafe Rewards `v1.5-demo-ready`  
**Target:** Production-ready Staff POS + Management Admin on shared Core API / Neon  
**Companion docs:** `CURRENT_STATE_AUDIT.md`, `GAP_MATRIX.md`, `ROLE_PERMISSION_MATRIX.md`, `BRANCH_SALES_POINT_MODEL.md`  
**Priority authority:** `GAP_MATRIX.md` §12 (P0 / P1 / P2 / P3)

---

## 1. Goals and non-goals

### Goals

1. Rebuild Staff POS and Admin as a React/TypeScript app (`apps/pos-admin-web`) without breaking Team 1 customer integration.
2. Introduce operational hierarchy: Branch → Sales Point → Terminal → Shift → Orders, with secure terminal enrolment.
3. Make every sale attributable, idempotent (scoped key + payload hash), and server-authoritative for money/loyalty/context.
4. Separate POS and Admin after employee authentication; separate employee sessions from Team 1 customer Bearer auth.
5. Publish OpenAPI 3.1.2 + `/api/v1`; one shared API and one migration authority.
6. Retire localStorage as production transaction truth.
7. Deliver P0 controls: rate limiting, request validation, production acceptance tests, append-only audit, shift concurrency.
8. Keep a rollback path until React POS/Admin passes regression.
9. Meet WCAG 2.2 AA for POS/Admin in the **first production release** (P1).

### Non-goals (this rewire)

- Rebuilding Team 1 Android/iOS customer UI.
- Implementing a payment gateway or storing card PAN/CVV.
- Claiming MyInvois / e-Invoice compliance.
- Full offline sale sync queue (design-ready only; not Phase 1–5 truth).
- Choosing final badge/NFC hardware (adapter boundary only).
- Treating `device_fingerprint` as authentication.

---

## 2. Guiding principles

| Principle | Rule |
|-----------|------|
| Additive migrations | Never edit live tables by hand; numbered SQL with rollback notes |
| One migration authority | Ordered SQL in this repository; shared-domain migrations need joint OpenAPI/approval |
| One shared API | Single Express Core API; neither team creates a second loyalty/order SOR |
| Dual-run | Legacy `index.html` Staff/Admin remain until Phase 5 sign-off |
| Server truth | Prices, discounts, loyalty, permissions, terminal/shift context enforced in API |
| Auth claims vs context | JWT/session holds stable identity + role (+ product selection); **never** treat `branchId` / `salesPointId` / `terminalId` / `shiftId` in a long-lived JWT as authoritative |
| Auth separation | Employee web sessions ≠ Team 1 customer Bearer |
| No silent offline sales | Production checkout requires API; demo mode explicitly labeled |
| Team boundary | Team 1: customer app; Team 2: POS/Admin/ops; shared domains: joint approval |
| Separate products | After login: staff → POS only; manager → Admin only |
| Preserve data | Historical orders and loyalty balances must survive |
| Audit immutability | Append-only; no UPDATE/DELETE via normal app routes or app DB role |

---

## 3. Target architecture

```text
┌────────────────────┐     ┌─────────────────────────────┐
│ Team 1 Customer App│     │ Team 2 apps/pos-admin-web   │
│ (Android / iOS)    │     │ React + TS — POS | Admin    │
│ Bearer JWT         │     │ Employee web session        │
└─────────┬──────────┘     └─────────────┬───────────────┘
          │ OpenAPI /api/v1              │ OpenAPI /api/v1
          │ customer auth endpoints      │ employee + terminal auth
          └──────────────┬───────────────┘
                         ▼
              Shared Core API (Express) — ONE API
              domain modules + RBAC + audit
              migration authority: this repo
                         │
                         ▼
                   Neon PostgreSQL — ONE SOR
          members · menu · offers · orders
          branches · sales_points · terminals
          shifts · audit_logs · credentials
```

Legacy path during migration:

```text
index.html (Customer shell + legacy Staff/Admin)
        │ still served by API for rollback / Team 1 web demo
        ▼
   Same Core API (compat routes kept)
```

### 3.1 Team ownership (authoritative)

| Domain | Owner |
|--------|-------|
| Android/iOS customer application + customer-specific integration | **Team 1** |
| POS, Admin, branches, terminals, shifts, operational APIs | **Team 2** |
| Shared Core API runtime + ordered DB migrations | **Single authority (this repo; Team 2 maintains ops modules)** |
| Members, menu, offers, loyalty, orders (schema/API contract) | **Shared** — OpenAPI review + **joint approval** before breaking changes |
| Loyalty / order source of truth | **Shared PostgreSQL only** — neither team may fork |

---

## 4. Phase plan

### Phase 0 — Audit and safe plan ✅ (amended)

**Deliverables:**

- `docs/CURRENT_STATE_AUDIT.md`
- `docs/GAP_MATRIX.md`
- `docs/PRODUCTION_MIGRATION_PLAN.md`
- `docs/ROLE_PERMISSION_MATRIX.md`
- `docs/BRANCH_SALES_POINT_MODEL.md`

**Exit criteria:** Stakeholders accept amended gaps, hierarchy, session/terminal/idempotency/audit rules before code changes.

---

### Phase 1 — Shared foundation

**Work (aligned to P0 where applicable):**

1. Scaffold `apps/pos-admin-web` (Vite, React, TS strict, Router, TanStack Query, RHF/Zod, Vitest).
2. Aida design tokens (CSS variables from existing pink/black brand).
3. API client + **employee** session layer (prefer httpOnly Secure SameSite cookies). Document Team 1 **customer Bearer** as a separate auth path.
4. Protected route shells: `/employee` welcome stub, `/pos/*`, `/admin/*`.
5. Additive migrations for:
   - `inventory_locations`, `branches`, `sales_points`, `terminals` (enrolment fields: credential hash, status, OTC workflow support)
   - `user_branch_access`, `users.is_global_manager` (explicit; never infer global from empty access)
   - nullable FKs on `orders` for branch/SP/terminal/shift + idempotency columns (populated in later phases)
6. Server permission helpers: role + `is_global_manager` OR explicit branch access rows.
7. Request validation scaffolding (schemas) for new `/api/v1` routes — **P0**.
8. Create `openapi.yaml` (OpenAPI 3.1.2); start `/api/v1` mounts; draft `TEAM_INTEGRATION_CONTRACT.md` for joint review.
9. Accessibility baseline: design tokens/components intended for WCAG 2.2 AA (full pass is P1 by first production release).

**Do not yet:** Remove legacy Staff/Admin UI; force shift workflow; treat device fingerprint as auth.

**Exit criteria:** Empty POS/Admin shells load behind employee auth stub; migrations apply on staging; OpenAPI published for Team 1 review; validation middleware pattern in place for v1.

**Rollback:** Drop new tables if empty; leave `orders` new columns nullable; continue using legacy UI.

---

### Phase 2 — Employee access, terminals, and shifts

**Work:**

1. Employee welcome screen (no customer registration).
2. Dedicated employee login endpoints; **reject employee accounts on customer login** — **P0**.
3. Credential adapter: password, keyboard-wedge badge token, barcode/QR employee card; PIN required for badge unless policy override; store hashes only.
4. Terminal secure enrolment: one-time registration code → server-issued revocable credential; store **credential hash/digest only**; registration, revocation, replacement, heartbeat (see branch model) — **P0**.
5. `device_fingerprint` optional telemetry only — **never authentication**.
6. Role routing: staff→POS, manager→Admin; dual-role explicit selection + audit.
7. Auth claims: stable identity + role (+ selected product). Operational context resolved server-side from enrolled terminal + open shift — **not** authoritative long-lived JWT location claims.
8. Shift open / resume / lock / close with float/variance; **transactional, race-safe**; DB constraints: one active open/locked shift per terminal; one active shift per employee (default); status CHECK; documented handover — **P0**.
9. `audit_logs` append-only (INSERT only; revoke UPDATE/DELETE from app role); minimize PII; never passwords/PINs/raw badges/secrets — **P0**.
10. Idle lock on POS/Admin sessions.
11. **Login rate limiting** on customer and employee auth endpoints — **P0**.
12. Restrict member APIs: staff scan/lookup min fields only; list/export/full profile/history → manager-only — **P0**.

**Exit criteria:** Employee cannot use customer login; terminal enrols with hashed credential; shift open is concurrency-safe; staff cannot list all members; audit rows exist and cannot be updated via API.

**Rollback:** Feature-flag new auth; legacy login remains for `index.html` during dual-run only.

---

### Phase 3 — POS migration

**Work:**

1. Port Staff flows: limited scan, guest sale (P1), menu/cart, offers, payment, receipt, redeem, shift-scoped history/summary.
2. Every sensitive POS op: validate employee session + terminal credential + resolve/validate open shift/location server-side.
3. Server-authoritative menu prices and totals (NUMERIC / money utility).
4. Always revalidate offers; reject unchecked client discounts.
5. Checkout idempotency — **P0**:
   - Client sends idempotency key.
   - Scope: actor (staff) + terminal (+ key).
   - Persist request payload hash.
   - Same key + same payload → return original result.
   - Same key + different payload → **HTTP 409**.
   - Enforce with DB uniqueness + transactional handling.
6. Populate `staff_user_id`, `branch_id`, `sales_point_id`, `terminal_id`, `shift_id` from **server-resolved** context.
7. Loyalty updates with row locks; single DB transaction.
8. Block production checkout when API/DB unavailable.
9. Void/refund **request** workflow (approval may complete in Phase 4) — P1 completion.
10. **Production acceptance tests** for P0 §16-equivalent items including idempotency 409, shift concurrency, member scan restriction, offline block — **P0**.
11. WCAG remediation pass on POS surfaces (continues into Phase 4/5 as needed for P1 release gate).

**Exit criteria:** React POS completes Neon sale with attribution; duplicate same-payload returns original; conflicting payload returns 409; offline cannot silently sell; acceptance tests green for P0 POS items.

**Rollback:** Point terminals back to legacy Staff UI; new attributed orders remain in DB.

---

### Phase 4 — Admin migration

**Work:**

1. Overview with branch/SP filters; use server analytics.
2. CRUD: branches, sales points, terminals (enrol/revoke/replace), employees, access, `is_global_manager`.
3. Shift monitoring and cash variance; handover visibility.
4. Members (full profile/export), menu, offers (harden; joint OpenAPI for shared domains).
5. Transactions, voids/refunds, approval queue.
6. Audit-log viewer (**read-only**).
7. Server-side CSV/Excel exports + export audit events (member exports manager-only).
8. Permission checks: global only via `is_global_manager`; branch managers later without schema rewrite.
9. WCAG 2.2 AA remediation for Admin UI (P1 first-release gate).

**Exit criteria:** Manager operates only in Admin app; can filter snack station vs main counter; exports audited; staff APIs still deny full member list.

**Rollback:** Legacy Admin shell remains until sign-off.

---

### Phase 5 — Integration and release

**Work:**

1. Contract tests against OpenAPI for Team 1 shared endpoints — **P0**.
2. Full **production acceptance** suite + Playwright + manual staff UAT — **P0** gate.
3. Confirm WCAG 2.2 AA pass for POS/Admin — **P1** first-release gate.
4. Update seed/demo data for branches/SP/terminals/shifts.
5. Production env validation (Render/Neon secrets, CORS, cookies, rate limits).
6. Deployment runbook + staff acceptance checklist.
7. Controlled retirement of legacy Staff/Admin routes in `index.html` (keep Customer shell until Team 1 confirms).
8. Strip demo quick-login credentials from production builds.

**Exit criteria:** Acceptance criteria in the master prompt §17 met; P0 backlog closed; WCAG P1 gate met; Team 1 signed off on shared contract; rollback plan documented for one release window.

---

## 5. Database migration strategy

### Rules

1. One ordered file per change: `006_branches_terminals.sql`, `007_shifts_audit.sql`, …
2. Prefer `ADD COLUMN IF NOT EXISTS`, new tables, backfills.
3. Do not drop/rename `students` in the first production cut. Options:
   - **Recommended:** keep table; add compatibility view `members` → `students`; update new code to use view/name alias.
   - Later: staged rename with dual-write period.
4. Every migration doc section: **Up**, **Down/rollback**, **Data risk**, **App version required**.
5. Apply on staging Neon before production; never rely on Render build alone until a migrate step is automated.
6. Timestamps stored UTC; UI displays `Asia/Kuala_Lumpur`.
7. Shared-domain migrations (members/menu/offers/loyalty/orders breaking changes) require **joint Team 1 + Team 2 approval** via OpenAPI review.
8. Audit table grants: application role `INSERT` + `SELECT` only; no `UPDATE`/`DELETE`.
9. Shift constraints and idempotency uniqueness must be in SQL, not only application code.

### Suggested migration sequence (names indicative)

| # | Migration | Depends on |
|---|-----------|------------|
| 006 | `inventory_locations`, `branches`, `sales_points`, `terminals` (credential hash, status), `user_branch_access`, `users.is_global_manager` | — |
| 007 | Seed main cafe + snack sales point + unenrolled terminal placeholders | 006 |
| 008 | `staff_credentials`, employee PIN fields | users |
| 009 | `shifts` + status CHECK + partial unique active-per-terminal + active-per-employee | terminals, users |
| 010 | `audit_logs` + revoke mutate grants | users |
| 011 | Order columns: branch/SP/terminal/shift/staff + idempotency key + payload hash | 006, 009 |
| 012 | Idempotency unique constraint (scoped) | 011 |
| 013 | Void/refund request tables (or order status extension) | orders |
| 014 | Optional `members` view over `students` | — |

### Order backfill policy

- Historical orders: leave new FKs **NULL** or backfill to “Main Cafe / Unknown terminal” sentinel rows created in seed migration.
- Never invent fake staff UUIDs for old rows; keep `cashier_name` text for history.

### Checkout idempotency (schema + behaviour)

| Element | Rule |
|---------|------|
| Key | Client-generated UUID (or equivalent), required on checkout |
| Scope | Unique on (`staff_user_id`, `terminal_id`, `idempotency_key`) for completed sales |
| Payload hash | Canonical hash of normalized request body (items, member, offer, payment fields) |
| Replay | Same scope key + same hash → return original order/result (200) |
| Conflict | Same scope key + different hash → **HTTP 409** with stable error code |
| Transaction | Insert idempotency row / order inside same DB transaction as loyalty updates |

### Shift concurrency (schema + behaviour)

| Element | Rule |
|---------|------|
| Status CHECK | `status IN ('open','locked','closed')` |
| Per terminal | At most one row with `status IN ('open','locked')` per `terminal_id` (partial unique index) |
| Per employee | At most one active `open`/`locked` shift per `staff_user_id` unless a future approved policy flag explicitly permits otherwise (default: **deny**) |
| Open | Single transaction; fail cleanly on unique violation |
| Handover | Close or complete documented handover before another employee opens on same terminal (see branch model) |

---

## 6. API versioning and Team 1 compatibility

| Period | Behavior |
|--------|----------|
| Phase 1–4 | `/api/*` legacy routes remain; `/api/v1/*` added |
| Team 1 migration window | Both supported; breaking changes only in v1 with joint notice |
| Post Phase 5 | Deprecation schedule for unused legacy Staff endpoints; customer-read endpoints kept stable |

**Artifacts:**

- `openapi.yaml` (OpenAPI 3.1.2)
- `docs/TEAM_INTEGRATION_CONTRACT.md` (Phase 1)
- Contract tests + production acceptance suite (P0)

**Shared identifiers (must stay stable):**

- Member: `member_code`, `student_id`, UUID `id`
- Menu: item UUID / slug
- Offer: UUID / slug
- Order: `order_number`, UUID `id`
- Roles: document mapping if `manager` alias introduced for `admin`

**Auth separation (contract must state):**

- Team 1: customer Bearer JWT on customer endpoints.
- Team 2: employee web session (cookies preferred) + terminal credential for POS devices.
- Employees must not authenticate via customer login endpoint.

---

## 7. Frontend migration strategy

```text
Phase 1: apps/pos-admin-web scaffold (empty protected shells)
Phase 2: employee auth + terminal enrolment + shift gates
Phase 3: replace Staff POS feature-by-feature
Phase 4: replace Admin feature-by-feature
Phase 5: stop linking legacy Staff/Admin; keep Customer web shell if needed
```

**Rules:**

- Do not port Customer mobile UI into the React app.
- Do not put Admin navigation inside POS routes.
- Shared design tokens only — not shared checkout components with Admin.
- Feature flags / env: `ENABLE_REACT_POS`, `ENABLE_LEGACY_POS`.
- WCAG 2.2 AA is a **first production release (P1)** requirement for POS and Admin.

---

## 8. Risk register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking Team 1 payloads | Customer app fails | OpenAPI + dual version + contract tests + joint approval |
| Loyalty race / double checkout | Wrong balances / duplicate orders | Scoped idempotency + payload hash + 409 + row locks + acceptance tests |
| Idempotency key reuse with different cart | Silent wrong replay | Payload hash mismatch → 409 |
| Price tampering during dual-run | Revenue loss | Server menu price lookup before cutover |
| Offline localStorage still used by staff | Ghost sales | Hard block + training + UI banner |
| JWT location claims spoofed | Wrong branch attribution | Server resolve from terminal credential + open shift only |
| Fingerprint treated as auth | Spoofed terminal | Credential hash enrolment only |
| Empty branch access treated as global | Privilege escalation | Require `is_global_manager` |
| Staff member list export | PDPA over-exposure | API deny list/export for staff |
| Migration applied incompletely (historically 004 skipped) | Auth/member link bugs | Checklist + verify-deploy + migration inventory |
| Cookie auth vs mobile Team 1 Bearer | Integration confusion | Contract: employee cookies vs customer Bearer |
| Free Render cold starts | Failed first sale | Paid tier / health warm-up before service |
| Dual-role manager confusion | Wrong surface used | Explicit role select + audit |
| Snack station mis-modeled as separate branch | Wrong financial consolidation | Follow `BRANCH_SALES_POINT_MODEL.md` |
| Scope creep (payments, NFC, MyInvois) | Delay | Adapters + labeled mocks only |

---

## 9. Rollback strategy

| Stage | Rollback action |
|-------|-----------------|
| After Phase 1 migrations | New tables unused → safe to ignore; UI still legacy |
| After Phase 2 | Disable React auth flag; use legacy login |
| After Phase 3 | Terminals open legacy Staff POS URL; new attributed orders remain in DB |
| After Phase 4 | Managers use legacy Admin; React Admin offline |
| After Phase 5 | Keep previous Render deploy + DB backup; re-enable legacy static routes for 1–2 weeks |

**Always:** take Neon backup before production migration apply.

---

## 10. Testing strategy

| Phase | Automated focus | Priority |
|-------|-----------------|----------|
| 1 | Permission helpers; migration apply; request validation on new routes | P0 foundations |
| 2 | Employee vs customer login split; rate limit; terminal enrol/revoke; shift concurrency; audit immutability; staff member list denied | P0 |
| 3 | Idempotent checkout + 409; atomic loyalty; offer revalidate; offline block; server context resolution | P0 |
| 4 | Branch filters; snack consolidation; export audit; manager-only member export | P0/P1 |
| 5 | Full production acceptance suite + Team 1 contract + WCAG evidence + UAT | P0 + P1 WCAG |

Manual UAT must include: staff sale at main counter, staff sale at snack sales point, manager report filter, duplicate button mash (same payload), conflicting idempotency payload (expect 409), API disconnect mid-cart, staff attempt to list all members (denied), employee login via customer endpoint (denied).

---

## 11. Decisions still pending (do not block architecture)

| Decision | Owner | Adapter approach until decided |
|----------|-------|--------------------------------|
| Badge/card hardware (HID / NFC ISO 14443) | Management + IT | Credential adapter + mock reader |
| Payment terminal provider | Finance | Soft POS payment method enum only |
| Future branch managers | Management | `user_branch_access` + `is_global_manager`; UI global for now |
| Separate stock per sales point | Operations | Shared `inventory_location_id` now |
| MyInvois legal path | University finance | Documented boundary only |
| Whether any policy will ever allow dual active shifts per employee | Management | Default deny constraint |
| OTC delivery channel for terminal enrolment (printed code vs admin UI) | Ops | Admin-generated OTC in Phase 2 |

---

## 12. Team 1 actions required

1. Review OpenAPI draft when Phase 1 lands; list endpoints Customer App uses today.
2. Confirm customer Bearer JWT remains for mobile; do not require employee cookies.
3. Agree compatibility window before any shared-domain response field removal (**joint approval**).
4. Provide staging build for contract tests in Phase 5.
5. Confirm whether web `#customer-app` must remain after React cutover.
6. Acknowledge employees will be rejected on customer login once Phase 2 ships (coordinate demo accounts).

---

## 13. Hardware / management decisions pending

1. POS tablet model and browser kiosk mode (idle lock behavior).
2. Receipt printer (browser print vs ESC/POS adapter).
3. Whether snack station gets its own registered terminal IDs on day one.
4. Opening float policy and variance approval threshold.
5. Whether demo mode remains in production builds at all.
6. Terminal replacement runbook ownership (who generates OTC).

---

## 14. Phase completion report template

After each implementation phase, report:

1. What was completed  
2. Files created or changed  
3. Database migrations added  
4. API contract changes  
5. Tests executed and results (include P0 acceptance items)  
6. Remaining risks or blockers  
7. Actions required from Team 1  
8. Hardware or management decisions still pending  

Do not mark features complete without implementation and test evidence.

---

## 15. Immediate next step after Phase 0 final approval

Begin **Phase 1** only after product owner confirms:

- [ ] Amended Phase 0 docs accepted (this revision)  
- [ ] Gap priorities accepted (rate limit / validation / acceptance tests = P0; WCAG = P1)  
- [ ] Branch/sales-point/terminal enrolment model accepted  
- [ ] Session model accepted (server-resolved context; separate employee vs customer auth)  
- [ ] Role matrix accepted (`is_global_manager`; staff scan-only members)  
- [ ] Dual-run / rollback approach accepted  
- [ ] Team 1 notified that OpenAPI + migration authority rules apply  

**Do not start Phase 1 until the above checklist is explicitly approved.**

---

## Phase 0 Review Amendments

| # | Correction |
|---|------------|
| 1 | Terminal enrolment lifecycle + credential hash; fingerprint never auth. |
| 2 | Auth claims vs server-resolved POS context; employee session ≠ customer Bearer. |
| 3 | Phase 2 includes staff member list denial + employee blocked from customer login. |
| 4 | `is_global_manager` required; empty access never global. |
| 5 | Shift concurrency SQL + transactional open + handover documented. |
| 6 | Idempotency key scope, payload hash, 200 replay vs 409 conflict specified. |
| 7 | Audit INSERT-only grants; no mutate via app. |
| 8 | Rate limiting, request validation, production acceptance tests scheduled as **P0**; WCAG as **P1** first-release gate; backlog aligned with `GAP_MATRIX.md`. |
| 9 | One shared API + one migration authority; joint approval for shared domains. |

---

*End of Production Migration Plan — Phase 0 (amended)*
