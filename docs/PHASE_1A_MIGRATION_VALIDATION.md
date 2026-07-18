# Phase 1A Migration Validation Notes

**Last updated:** 18 July 2026 — Neon temporary-branch PostgreSQL Validation Gate **PASSED**

## Safety rules

| Rule | Status |
|------|--------|
| Use `DISPOSABLE_DATABASE_URL` only (never parent/`DATABASE_URL` for this gate) | Enforced + verified |
| Require `ALLOW_DISPOSABLE_MIGRATE=1` | Enforced |
| Refuse if disposable URL equals `DATABASE_URL` | Enforced |
| Refuse if disposable host matches `DATABASE_URL` host | Enforced |
| Neon disposable requires `ALLOW_NEON_DISPOSABLE=1` | Enforced |
| Print only sanitised host + database name | Enforced |
| Rollback only on disposable branch | Enforced |

## Authorised disposable validation command

```powershell
cd production/api

$env:ALLOW_DISPOSABLE_MIGRATE = "1"
$env:ALLOW_NEON_DISPOSABLE = "1"
$env:CONFIRM_DISPOSABLE_TARGET = "1"
$env:DISPOSABLE_DATABASE_URL = "<temporary Neon branch connection — do not commit>"

npm run migrate:validate:disposable
```

Local embedded fallback (not used for this Neon evidence run):

```powershell
npm run migrate:validate:disposable:local
```

---

## Validation evidence — Neon temporary branch (18 July 2026)

### Neon preflight

| Item | Value |
|------|--------|
| neonctl | v2.34.1 |
| Auth | Verified (`neonctl me`) — tokens not displayed |
| Organization | single org (personal) |
| Selected project | **City_Cafw_Rewards** (`bold-art-73144837`, `aws-ap-southeast-1`) |
| Parent branch | **production** (`br-purple-leaf-aoswxd42`, DEFAULT/PRIMARY) |
| Selection note | Only one Neon project and one parent branch existed — no ambiguity |

### Temporary validation branch (retained for review)

| Field | Value |
|-------|--------|
| Name | `phase1a-validation-20260718` |
| Branch ID | `br-muddy-truth-aotvi2pm` |
| Parent ID | `br-purple-leaf-aoswxd42` (`production`) |
| Endpoint host | `ep-polished-wildflower-aoqhtu9r.c-2.ap-southeast-1.aws.neon.tech` |
| Database | `neondb` |
| Credentials | never printed |
| Differs from parent host | **Yes** — parent host is `ep-billowing-bread-aoyvj5iu.c-2.ap-southeast-1.aws.neon.tech` |
| Deleted after gate | **No** — retained until explicit review/approval |

### Migrations applied (temporary branch only)

| Step | Result |
|------|--------|
| Reset disposable `public` schema | Pass |
| Baseline through **005** (002 enum separate tx) | Pass |
| Migration **006** | Pass |
| Migration **007** | Pass |
| Migration **007** again (idempotency) | **Pass** |

### Schema and seed assertions

| Assertion | Result |
|-----------|--------|
| Main Cafe (`BR-MAIN`) exactly once | Pass |
| Main Counter (`SP-MAIN`) under Main Cafe exactly once | Pass |
| Snack Station (`SP-SNACK`) under Main Cafe exactly once | Pass |
| Snack Station is not a separate branch | Pass |
| Both sales points share `INV-MAIN` | Pass |
| Terminal / branch / sales-point FKs valid | Pass |
| Historical order attribution columns nullable | Pass |
| Required unique constraints + indexes | Pass |
| `is_global_manager` defaults to false | Pass |
| Empty `user_branch_access` never grants global | Pass |
| `timestamptz` defaults + CHECK constraints | Pass |

### Negative constraint tests

| Test | Result |
|------|--------|
| Duplicate branch code | Rejected (`23505`) |
| Duplicate terminal code | Rejected (`23505`) |
| Duplicate sales-point code within branch | Rejected (`23505`) |
| Invalid branch FK | Rejected (`23503`) |
| Invalid inventory FK | Rejected (`23503`) |
| Invalid sales_point FK | Rejected (`23503`) |
| Invalid terminal status CHECK | Rejected (`23514`) |

### Rollback / reapply (temporary branch only)

| Step | Result |
|------|--------|
| Documented rollback | Pass |
| Reapply 006 + 007 | Pass |
| Final structure/seed verification | Pass |

**Gate verdict:** `✅ Phase 1A PostgreSQL Validation Gate PASSED` on Neon branch `phase1a-validation-20260718`

### Parent / production untouched

| Check | Result |
|-------|--------|
| Validation target host ≠ parent host | Confirmed |
| Parent branch name still `production` / DEFAULT | Confirmed |
| Parent read-only: `public.branches` / `public.sales_points` | **null** (006 not present on parent) |
| Temporary branch retained; parent not deleted/reset | Confirmed |
| Shared demo production data not targeted by gate | Confirmed |

---

## Final verification suite (isolated validation API → temp Neon branch)

API process used `DATABASE_URL` = temporary branch only, on port **3011** (3001 was already occupied). Intentionally torn down after tests.

| Suite | Result |
|-------|--------|
| Migration validation (`migrate:validate:disposable`) | **PASSED** |
| Authorization (`test:authz`) | **13/13** |
| `/api/v1` security (`test:v1-security`) | **8/8** |
| Phase5 regression (`test:phase5`) | **12/12** (`ALLOW_TEST_MUTATIONS=1` on disposable only; creates `PHASE5SCAN001` on temp branch seed) |
| OpenAPI lint | **Pass** |
| React typecheck | **Pass** |
| React unit tests | **12/12** |
| React production build | **Pass** |

### Confirmations

- Phase 2 was **not** started.
- Parent/production Neon branch was **not** migrated, rolled back, or written by this gate.
- Temporary Neon branch **`phase1a-validation-20260718`** was **not** deleted (held for review).
- Shared demo / production `PHASE5SCAN001` policy unchanged; phase5 fixture writes in this run were against the temporary branch only.

---

## Test-data isolation (shared demo PHASE5SCAN001)

| Item | Detail |
|------|--------|
| Shared demo fixture | `PHASE5SCAN001` (created earlier on shared demo DB) |
| Policy | **Do not delete or alter shared demo fixture without explicit approval** |
| Mutations against shared/prod | Require `ALLOW_TEST_MUTATIONS=1`; production hosts also require `ALLOW_PRODUCTION_TEST_MUTATIONS=1` |

---

## Static SQL review (always applicable)

- Additive `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`
- FK order: branches → inventory_locations → sales_points → terminals → enrolment codes → user_branch_access
- `orders.shift_id` nullable **without** FK until Phase 2 `shifts` table
- Idempotent seed; snack is `SP-SNACK` under `BR-MAIN`
- `is_global_manager` explicit; empty access never grants global
