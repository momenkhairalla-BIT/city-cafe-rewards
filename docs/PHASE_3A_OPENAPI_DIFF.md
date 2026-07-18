# Phase 3A OpenAPI Compatibility Diff (Team 1)

**Date:** 18 July 2026  
**Audience:** Team 1 (Customer App) + Team 2 (POS/Admin)  
**Status:** Additive only — Team 1 shapes frozen  
**Feature flag:** `ENABLE_POS_SALES=1` required; keep **off** outside temporary Neon until Team 1 review

## Unchanged (Team 1 contract freeze)

No request/response shape changes to:

| Endpoint | Notes |
|----------|--------|
| `POST /api/v1/auth/login` | Customer login (employees → `EMPLOYEE_LOGIN_REQUIRED` when password valid — Phase 2B) |
| `POST /api/v1/auth/register` | Unchanged |
| `GET /api/v1/auth/me` | Unchanged |
| `GET /api/v1/menu` (+ admin mutations) | Unchanged |
| `GET/POST/PUT/PATCH /api/v1/offers…` | Unchanged response shapes |
| `POST /api/v1/orders/sales` | Legacy Bearer sale — **still present**; not modified for Team 1 |
| `POST /api/v1/orders/redeem` | Unchanged |
| `GET /api/v1/orders/transactions` | Unchanged |
| Member / student / scan / analytics | Unchanged |

## Added (employee POS only)

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `POST /api/v1/pos/sales` | Employee HttpOnly cookie + terminal HttpOnly cookie + CSRF Origin + open shift + `ENABLE_POS_SALES=1` | Server-authoritative soft POS sale |

### Request (business inputs only)

- Optional `memberCode` / guest sale
- `items[]`: `menuItemId`, `quantity` (optional `modifierIds` — currently rejected)
- Optional `offerId` / `offerSlug`, `voucherSlug`
- Soft `paymentMethod`, optional `cashReceived`, optional non-sensitive `externalPaymentRef`

### Rejected (stable errors)

Client `unitPrice` / totals / discount / points / branch / terminal / shift / staff / PAN-like fields.

### Idempotency

Header `Idempotency-Key` required; scope `(staff_user_id, terminal_id, key)`; same payload → replay `200`; different → `409`.

## Planned (not in Phase 3A)

- React POS cart/checkout UI
- Void/refund approval
- Payment gateway settlement / terminal SDK
- Offline sale queue

## Team 1 review status

**Pending review.** Until accepted, `ENABLE_POS_SALES` must remain enabled only on the temporary validation environment.
