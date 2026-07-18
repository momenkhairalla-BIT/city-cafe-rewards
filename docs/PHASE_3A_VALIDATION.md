# Phase 3A Validation Evidence

**Date:** 18 July 2026  
**Neon branch:** `phase1a-validation-20260718` (`br-muddy-truth-aotvi2pm`)  
**Host (sanitised):** `ep-polished-wildflower-aoqhtu9r.c-2.ap-southeast-1.aws.neon.tech`  
**Production:** not migrated / not deployed  
**React POS checkout UI:** not started  
**Temp branch:** retained

## Endpoint

`POST /api/v1/pos/sales`  
Requires: `ENABLE_POS_SALES=1`, employee cookie, terminal cookie, CSRF Origin, open shift, `Idempotency-Key`.

## Migration

| Item | Result |
|------|--------|
| File | `production/database/012_pos_sales_core.sql` |
| Apply script | `npm run migrate:phase3a:temp` (host-gated) |
| Apply + idempotent reapply | **PASSED** on temp branch |
| `orders.student_id` nullable | **YES** |
| `order_number_seq` | created |
| `voucher_redemptions` | created |
| Shift sale totals columns | created |
| Production host | refused by script |

## Test results

| Suite | Result |
|-------|--------|
| `test:phase3a` (+ money) | **26/26** |
| `test:authz` | **14/14** |
| `test:phase2a` | **24/24** |
| `test:terminal-cookie` | **7/7** |
| `test:dual-role` | **4/4** |
| `test:legacy-employee` | **7/7** |
| `test:v1-security` | **10/10** |
| `test:phase5` | **12/12** |
| OpenAPI lint | **Pass** |
| React typecheck / unit / build | **Pass / 19/19 / Pass** |
| Playwright E2E | **9/9** |

## Team 1 review

**Pending.** Diff: `docs/PHASE_3A_OPENAPI_DIFF.md`. Keep `ENABLE_POS_SALES` off outside temp until accepted.

## Planned (out of scope)

- React cart/checkout UI  
- Void/refund approval  
- Payment gateway settlement  
- Offline queue  
