# Branch & Sales Point Model — Aida Cafe

**Phase:** 0  
**Amended:** July 2026 (Phase 0 Review Amendments)  
**Purpose:** Define the operational location hierarchy for production POS/Admin, including the second-floor snack station, secure terminal enrolment, inventory sharing, order attribution, shift concurrency, and reporting rules.  
**Status:** Planning model only — schema not applied in Phase 0.

---

## 1. Business context

Aida Cafe (City University Malaysia) operates as one brand with **multiple service locations**. Today’s v1.5 system assumes a single flat café. Production must support:

- Multiple **branches** (physical / organizational locations).
- Multiple **sales points** (counters/stations) per branch.
- Multiple **POS terminals** per sales point, each with **secure enrolment**.
- Employee **shifts** bound to a terminal (and thus to branch + sales point), with concurrency constraints.
- One current **global manager** identified by explicit `is_global_manager` (never by empty access).
- Future **branch-scoped managers** without a schema rewrite.

Special case:

> The **second-floor snack station** is a **sales point under the main cafe branch**.  
> It records its own sales-point and terminal data for operational reporting, but **financial totals and inventory are consolidated into the main cafe** for now.

---

## 2. Hierarchy

```text
Aida Cafe (organization)
  └── Branch
        ├── inventory_location (stock pool)
        └── Sales Point / Station
              └── POS Terminal (enrolled credential)
                    └── Employee Shift (≤1 active per terminal)
                          └── Orders & staff actions
```

### Entity definitions

| Entity | Meaning | Example |
|--------|---------|---------|
| **Organization** | Brand / legal café business | Aida Cafe |
| **Branch** | Primary operating location for staffing, reporting rollups, and (usually) inventory | Main Cafe |
| **Sales Point** | Distinct counter/station where sales are taken | Main Counter, Snack Station (Level 2) |
| **Terminal** | Registered device/browser instance used for POS | `POS-MAIN-01`, `POS-SNACK-01` |
| **Shift** | Duty period for one employee on one terminal | Morning shift with opening float |
| **Inventory Location** | Stock pool referenced by sales points | Main Cafe Store |

---

## 3. Recommended schema (target)

IDs are UUID primary keys. Names are display-only — **never use names as foreign keys**.

### 3.1 `inventory_locations`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `code` | TEXT UNIQUE | e.g. `INV-MAIN` |
| `name` | TEXT | Main Cafe Store |
| `branch_id` | UUID NULL FK → branches | Optional owning branch |
| `is_active` | BOOLEAN | |
| `created_at` / `updated_at` | TIMESTAMPTZ UTC | |

### 3.2 `branches`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `code` | TEXT UNIQUE | e.g. `BR-MAIN` |
| `name` | TEXT | Main Cafe |
| `timezone` | TEXT | default `Asia/Kuala_Lumpur` |
| `is_active` | BOOLEAN | |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

### 3.3 `sales_points`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `branch_id` | UUID FK → branches | Required |
| `code` | TEXT | Unique per branch, e.g. `SP-MAIN`, `SP-SNACK` |
| `name` | TEXT | Main Counter / Snack Station L2 |
| `inventory_location_id` | UUID FK → inventory_locations | **Shared stock key** |
| `consolidates_to_branch_id` | UUID FK → branches | Usually same as `branch_id`; supports future exceptions |
| `is_active` | BOOLEAN | |
| `sort_order` | INT | |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

Unique: (`branch_id`, `code`).

### 3.4 `terminals` (secure enrolment)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `sales_point_id` | UUID FK → sales_points | |
| `code` | TEXT UNIQUE | Human registry code e.g. `POS-MAIN-01` |
| `name` | TEXT | |
| `status` | TEXT | CHECK: `pending_enrolment`, `active`, `revoked`, `replaced` |
| `credential_hash` | TEXT NULL | **Hash/digest only** of server-issued terminal credential; never store raw secret |
| `credential_issued_at` | TIMESTAMPTZ NULL | |
| `credential_revoked_at` | TIMESTAMPTZ NULL | |
| `replaced_by_terminal_id` | UUID NULL FK → terminals | Replacement chain |
| `device_fingerprint` | TEXT NULL | **Optional telemetry / support aid only — never authentication** |
| `last_heartbeat_at` | TIMESTAMPTZ NULL | |
| `is_active` | BOOLEAN | Convenience; must align with `status` |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

Supporting table (recommended): `terminal_enrolment_codes`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `terminal_id` | UUID FK | |
| `code_hash` | TEXT | Hash of one-time registration code |
| `expires_at` | TIMESTAMPTZ | Short TTL |
| `consumed_at` | TIMESTAMPTZ NULL | |
| `created_by_user_id` | UUID FK → users | Manager who generated OTC |
| `created_at` | TIMESTAMPTZ | |

#### Terminal lifecycle

| Step | Behaviour |
|------|-----------|
| **Register (admin)** | Manager creates terminal row under a sales point with `status = pending_enrolment`. System issues a **one-time registration code** (OTC); store only `code_hash`. Show OTC once to installer. |
| **Enrol (device)** | POS device submits OTC (+ optional fingerprint telemetry). Server validates OTC (unexpired, unconsumed), generates a high-entropy **terminal credential**, stores **`credential_hash` only**, marks OTC consumed, sets `status = active`, returns credential **once** to the device for secure local storage. |
| **Authenticate** | Subsequent POS calls present terminal credential; server verifies against `credential_hash`. **`device_fingerprint` must never grant access.** |
| **Heartbeat** | Periodic call updates `last_heartbeat_at` after successful credential verification. Stale heartbeat may surface as degraded in Admin; policy may lock new shifts if heartbeat SLA breached (configurable). |
| **Revoke** | Manager sets `status = revoked`, clears ability to verify credential (rotate/invalidate hash), sets `credential_revoked_at`. Open shifts on that terminal must be force-closed/handover per ops policy. Audit event required. |
| **Replace** | Create new terminal (or new enrolment on same row per implementation choice); link `replaced_by_terminal_id`; old status `replaced`/`revoked`; new OTC → new credential hash. Audit both sides. |

### 3.5 `users` global flag + `user_branch_access`

On `users` (additive):

| Column | Type | Notes |
|--------|------|-------|
| `is_global_manager` | BOOLEAN NOT NULL DEFAULT FALSE | **Required** for cross-branch admin |

`user_branch_access`:

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `user_id` | UUID FK → users | |
| `branch_id` | UUID FK → branches | |
| `can_operate_pos` | BOOLEAN | |
| `can_manage` | BOOLEAN | Admin-style within branch |
| `is_default` | BOOLEAN | Default branch for employee |
| `created_at` | TIMESTAMPTZ | |

Unique: (`user_id`, `branch_id`).

**Global manager rule (authoritative):**

- Cross-branch Admin access requires `is_global_manager = TRUE`.
- **Never** interpret missing or empty `user_branch_access` as global access.
- Staff POS location authorization uses explicit access rows (and terminal membership), not the global flag alone.

### 3.6 `shifts` (concurrency-safe)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `terminal_id` | UUID FK | |
| `sales_point_id` | UUID FK | Denormalized for query speed |
| `branch_id` | UUID FK | Denormalized |
| `staff_user_id` | UUID FK → users | |
| `opened_at` / `closed_at` | TIMESTAMPTZ | |
| `status` | TEXT | **CHECK** `status IN ('open','locked','closed')` |
| `opening_float` | NUMERIC(12,2) | |
| `closing_expected_cash` | NUMERIC(12,2) | |
| `closing_actual_cash` | NUMERIC(12,2) | |
| `cash_variance` | NUMERIC(12,2) | |
| `notes` | TEXT | |
| `handover_notes` | TEXT | |
| `handover_to_user_id` | UUID NULL FK → users | Optional |
| `handover_at` | TIMESTAMPTZ NULL | |

**Required constraints:**

1. `CHECK (status IN ('open','locked','closed'))`
2. **At most one active shift per terminal:** partial unique index on `terminal_id` WHERE `status IN ('open','locked')`
3. **At most one active shift per employee (default policy):** partial unique index on `staff_user_id` WHERE `status IN ('open','locked')`  
   - Future exception only via approved policy + migration that relaxes/replaces this constraint — not silent app bypass.
4. Shift **open** must run in a **single DB transaction** (insert + validations); unique violations map to stable `409`/`409 CONFLICT` style API errors.

#### Handover process

1. Outgoing employee initiates **close** or **handover** on the open/locked shift (cash count, variance, notes).
2. If handover: record `handover_notes`, optional `handover_to_user_id`, `handover_at`; set status `closed` (or intermediate locked→closed per UI).
3. Only after the terminal has **no** active `open`/`locked` shift may the incoming employee **open** a new shift on that terminal (enforced by unique index).
4. Incoming employee opens new shift with their own float; audit both close/handover and open.
5. Manager may force-close a stuck shift (audited) after revoke/crash; still ends active unique slot before reopen.

### 3.7 Order attribution columns (additive on `orders`)

| Column | Required on new sales | Notes |
|--------|----------------------|-------|
| `branch_id` | YES | From **server-resolved** open shift / terminal |
| `sales_point_id` | YES | |
| `terminal_id` | YES | From verified terminal credential |
| `shift_id` | YES | From open/locked shift row |
| `staff_user_id` | YES | From authenticated employee (exists today, unused) |
| `idempotency_key` | YES | Client key |
| `idempotency_payload_hash` | YES | Canonical hash of normalized request |

Historical orders: NULL allowed for new columns; optional backfill to Main Cafe / Unknown Terminal sentinel.

#### Checkout idempotency (with location model)

| Element | Rule |
|---------|------|
| Scope | Unique on (`staff_user_id`, `terminal_id`, `idempotency_key`) among recorded checkouts |
| Payload hash | Hash of normalized sale payload |
| Same key + same hash | Return original result |
| Same key + different hash | **HTTP 409** |
| Context | Branch/SP/shift IDs taken from server-resolved shift, not from client body |

---

## 4. Seed model for Aida day-one

```text
Branch: BR-MAIN — "Aida Cafe Main"
  Inventory location: INV-MAIN — "Main Cafe Store"

  Sales point: SP-MAIN — "Main Counter"
    inventory_location_id = INV-MAIN
    consolidates_to_branch_id = BR-MAIN
    Terminal: POS-MAIN-01 (pending_enrolment → enrol on site)

  Sales point: SP-SNACK — "Snack Station (Level 2)"
    inventory_location_id = INV-MAIN          ← shared stock with main
    consolidates_to_branch_id = BR-MAIN       ← financial rollup to main
    Terminal: POS-SNACK-01 (pending_enrolment → enrol on site)

Manager user: is_global_manager = TRUE
Staff users: explicit user_branch_access for BR-MAIN (can_operate_pos)
```

Additional branches (future) get their own `branches` rows and usually their own inventory locations.

---

## 5. Branch-selection policy (runtime)

Implement exactly:

1. **Enrolled terminal is primary.** POS presents terminal credential → server resolves terminal → sales point → branch.
2. **Employee profile** has default branch + permitted branch list via **explicit** `user_branch_access` rows.
3. If terminal location ∈ employee permitted set → **auto-select** (no dropdown).
4. If employee has a permitted temporary assignment that includes other locations → show **authorized dropdown only**.
5. **Never** show unauthorized branches/sales points.
6. After **shift open**, location context is the open shift row; client display values are non-authoritative.
7. Changing location requires **shift close/handover** or **management authorization** (audited).
8. Record every selection/override, enrolment, revoke, and heartbeat anomaly policy action in `audit_logs`.
9. On every sensitive POS operation, **re-validate** terminal credential + active shift + employee permission server-side.

### Manager behavior

- Current manager: `is_global_manager = TRUE` for Admin reports across branches.
- Empty access rows never imply global.
- Manager does not use POS location dropdown unless in an explicit dual-role POS session with permitted access.
- Do not build full branch-manager UI in v1; keep access table ready.

---

## 6. Reporting rules

### 6.1 Operational filters (Admin)

Users can filter sales by:

- Branch
- Sales point (e.g. Snack Station only)
- Terminal
- Staff
- Shift
- Hour / product / payment method

### 6.2 Financial consolidation (current policy)

| Question | Answer |
|----------|--------|
| Do snack station sales appear in Main Cafe branch totals? | **Yes** — via `consolidates_to_branch_id = BR-MAIN` and/or same `branch_id` |
| Can snack station sales be listed separately? | **Yes** — filter `sales_point_id = SP-SNACK` |
| Does snack station have separate inventory accounting today? | **No** — same `inventory_location_id` |
| Can snack get its own inventory later? | **Yes** — change `inventory_location_id` only; no redesign |

### 6.3 Recommended report metrics

| Metric | Grain |
|--------|-------|
| Gross sales (financial) | `consolidates_to_branch_id` or branch |
| Station performance | `sales_point_id` |
| Cashier performance | `staff_user_id` + shift |
| Terminal reliability | `terminal_id` + heartbeat |
| Inventory deductions (future) | `inventory_location_id` |

### 6.4 Acceptance example (from prompt)

> Second-floor snack sales are filterable by sales point but consolidate into the main cafe totals.

Test: create sale on enrolled `POS-SNACK-01` → appears in SP-SNACK filter → included in BR-MAIN consolidated revenue.

---

## 7. Inventory sharing design

```text
Today:
  SP-MAIN  ──┐
             ├──► INV-MAIN
  SP-SNACK ──┘

Future (optional):
  SP-MAIN  ──► INV-MAIN
  SP-SNACK ──► INV-SNACK   (new location row; update FK only)
```

Phase 0–5 do **not** require a full inventory module. Only the FK readiness is required so stock can split later without rewriting orders or sales points.

---

## 8. Mapping from current v1.5

| Current | Production mapping |
|---------|-------------------|
| Implicit single café | `BR-MAIN` |
| UI label “Counter 1” | Enrolled `terminals.code/name` + credential |
| `cashierName = 'Counter Staff'` | `staff_user_id` + display name from `users` |
| No sales point dimension | Add `SP-MAIN` + `SP-SNACK` |
| Orders without location | Additive NULLable FKs; new sales require FKs from server context |
| Admin “all data” | `is_global_manager = TRUE` view over all branches |

No data is discarded. Old orders remain queryable; location dimensions may be null/sentinel.

---

## 9. API implications (target)

Terminal enrol:

```http
POST /api/v1/terminals/{id}/enrol
{ "oneTimeCode": "..." }
→ { terminalId, terminalCredential }  # credential shown once
```

Heartbeat / current context:

```http
POST /api/v1/terminals/heartbeat
Authorization: employee session
X-Terminal-Credential: <secret>
→ { terminalId, salesPoint, branch, lastHeartbeatAt, openShift? }
```

Shift open (transactional):

```http
POST /api/v1/shifts/open
{ "openingFloat": 200.00 }
→ binds server-resolved branch/salesPoint/terminal; fails if active shift exists
```

Sale:

```http
POST /api/v1/orders/sales
Idempotency-Key: <uuid>
X-Terminal-Credential: <secret>
{ memberCode, items, paymentMethod, ... }
→ server injects branch/salesPoint/terminal/shift/staff from verified context;
  ignores client spoofing of those IDs;
  same key+payload → original; same key+different payload → 409
```

**Security:** Client may display context IDs for UX; server **must** verify terminal credential + open shift + employee permissions on every sensitive POS operation.

---

## 10. UI implications

### POS

- Persistent context bar: Employee · Role · Branch · Sales Point · Terminal · Shift status (from server context).
- Enrolment screen when terminal `pending_enrolment` / missing credential.
- No branch list unless policy requires authorized dropdown before shift open.
- Snack terminal looks like any POS; difference is registered sales point.
- Clear degraded state if heartbeat/API fails — **no offline production checkout**.

### Admin

- Default view: consolidated company / main cafe for `is_global_manager`.
- Filters: Branch, Sales Point (includes Snack Station).
- Terminal management: create, generate OTC, revoke, replace, heartbeat status.
- Do not present snack station as a separate branch in day-one seed.

---

## 11. Migration notes

1. Create tables in Phase 1–2 (`006` / `007` / `009` style migrations).
2. Seed BR-MAIN, INV-MAIN, SP-MAIN, SP-SNACK, sample terminals as `pending_enrolment`.
3. Set designated manager `is_global_manager = TRUE`.
4. Grant demo staff **explicit** `user_branch_access` for BR-MAIN.
5. Add shift CHECK + partial unique indexes; order idempotency columns + scoped unique constraint.
6. Add nullable order FK columns; enforce required context on new API path.
7. Rollback: drop new tables if no production dependence; order columns remain nullable harmlessly.

---

## 12. Open decisions (configurable)

| Decision | Default in this model | Change impact |
|----------|----------------------|---------------|
| Snack is sales point under main | **Yes** | Do not seed as second branch |
| Shared inventory with main | **Yes** (`INV-MAIN`) | Later FK change only |
| Separate financial entity for snack | **No** | Would require new branch + consolidation rules |
| How many terminals per SP on day one | At least 1 each | Add `terminals` rows |
| Temporary cross-branch assignment UX | Authorized dropdown | Access table rows |
| Dual active shifts per employee | **Denied** by unique index | Needs approved policy + migration to relax |
| Heartbeat SLA before blocking new shifts | Configurable | Ops policy |
| OTC delivery channel | Admin UI reveal once | Printed sealed code optional |

---

## 13. Summary diagram

```text
                    ┌─────────────────────────┐
                    │ Branch: Aida Cafe Main  │
                    │ code: BR-MAIN           │
                    └───────────┬─────────────┘
                                │
                 ┌──────────────┴──────────────┐
                 │ Inventory: INV-MAIN         │
                 └──────────────┬──────────────┘
           ┌─────────────────────┴─────────────────────┐
           ▼                                           ▼
 ┌───────────────────┐                     ┌───────────────────────┐
 │ SP-MAIN           │                     │ SP-SNACK (Level 2)    │
 │ Main Counter      │                     │ Snack Station         │
 │ inv → INV-MAIN    │                     │ inv → INV-MAIN (same) │
 └─────────┬─────────┘                     └───────────┬───────────┘
           ▼                                           ▼
    Terminal POS-MAIN-01                        Terminal POS-SNACK-01
    (credential_hash)                           (credential_hash)
           │                                           │
           └──── ≤1 active shift each → orders ────────┘
                              │
                              ▼
                     Reports:
                     - Filter by SP-SNACK
                     - Totals roll into BR-MAIN
```

---

## Phase 0 Review Amendments

| # | Correction |
|---|------------|
| 1 | Secure terminal enrolment (OTC → revocable credential hash); fingerprint telemetry only; register/revoke/replace/heartbeat documented. |
| 2 | Server-resolved terminal/location/shift on sensitive ops; client/JWT location IDs non-authoritative. |
| 3 | (Member field minimization referenced via role matrix; POS uses enrolled terminal context.) |
| 4 | `is_global_manager` required; empty `user_branch_access` never means global. |
| 5 | Shift CHECK + partial unique active-per-terminal and active-per-employee; transactional open; handover process. |
| 6 | Order idempotency key scope + payload hash + 409 conflict tied to terminal/staff. |
| 7 | Audit events required for terminal lifecycle and shift/handover (immutability in role/migration docs). |
| 8 | (Priority consistency owned in GAP_MATRIX / migration plan.) |
| 9 | Model supports single shared SOR; Team 2 owns operational entities; shared order attribution columns remain joint-contract sensitive. |

---

*End of Branch & Sales Point Model — Phase 0 (amended)*
