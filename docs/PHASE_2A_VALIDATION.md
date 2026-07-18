# Phase 2A Validation Evidence

**Date:** 18 July 2026  
**Status:** PASSED on temporary Neon branch only  
**Phase 2B / employee React UI:** not started  
**Production parent:** not migrated

## Target

| Item | Value |
|------|--------|
| Project | `bold-art-73144837` (`City_Cafw_Rewards`) |
| Branch | `phase1a-validation-20260718` (`br-muddy-truth-aotvi2pm`) |
| Host (sanitised) | `ep-polished-wildflower-aoqhtu9r.c-2.ap-southeast-1.aws.neon.tech` |
| Database | `neondb` |
| Parent host (untouched) | `ep-billowing-bread-aoyvj5iu.c-2.ap-southeast-1.aws.neon.tech` |

Credentials and full connection strings were never printed.

## Migrations applied (temp only)

| File | Result |
|------|--------|
| `008_staff_credentials_sessions.sql` | Applied (+ idempotent reapply) |
| `009_terminal_credential_enhancements.sql` | Applied (+ idempotent reapply) |
| `010_shifts.sql` | Applied (+ idempotent reapply) |
| `011_audit_logs.sql` | Applied (+ idempotent reapply) |

Script: `npm run migrate:phase2a:temp`  
Guards: `ALLOW_DISPOSABLE_MIGRATE=1`, host must match expected temp host, refuses production parent host.

## Test counts

| Suite | Result |
|-------|--------|
| `test:authz` (permissions + rateLimit unit) | **14/14** |
| `test:phase2a` | **24/24** |
| `test:v1-security` | **10/10** |
| `test:phase5` | **12/12** |
| OpenAPI lint | **Pass** |
| React typecheck / unit / build | **Pass / 12/12 / Pass** |

Note: Full Phase 1A `migrate:validate:disposable` was **not** re-run here because it resets `public` and would wipe Phase 2A objects. Phase 1A gate previously passed on this same temp branch; Phase 2A migrations were applied additively afterward.

## Design summary

- **Customer auth:** Bearer JWT; employees rejected.
- **Employee auth:** Opaque cookie session (`aida_employee_session`); CSRF Origin on mutating routes; rate limits on login/PIN/enrol.
- **Terminal:** OTC hash, single-use, expiry; credential hash; fingerprint never authenticates.
- **Shifts:** Partial unique indexes; transactional open; location from terminal; variance on close; audit on each transition.
- **Audit:** Append-only trigger rejects UPDATE/DELETE.

## Confirmations

- Temporary Neon branch **retained** (not deleted).
- Production parent **not** written by Phase 2A migrate script.
- Phase 2B UI **not** started.
- Team 1 customer login/register/me contract shape retained (employees now correctly denied on customer login).
