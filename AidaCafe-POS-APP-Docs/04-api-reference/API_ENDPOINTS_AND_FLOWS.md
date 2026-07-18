# API Endpoints & Core Flows — Aida Cafe Rewards

Base URL (production): `https://city-cafe-rewards.onrender.com`  
Base URL (local): `http://localhost:3001`

Auth header (protected routes):
```http
Authorization: Bearer <jwt>
```

Unless noted, `/api/*` requires a valid JWT.

---

## 1. System

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Public | Serves `index.html` (Customer + Staff + Admin UI) |
| GET | `/health` | Public | DB status + `version` / `appVersion` (`v1.5-demo-ready`) |
| GET | `/js/*` | Public | Static JS |
| GET | `/assets/*` | Public | Static assets |

---

## 2. Auth (`/api/auth`)

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| POST | `/api/auth/login` | Public | — | Login; body `{ username, password }` (username can be any member identifier) |
| POST | `/api/auth/register` | Public | — | Customer self-register (student or general) |
| GET | `/api/auth/me` | JWT | any | Current user + linked member profile |

**Login resolution order (conceptual):**
1. Match `users` by username/email
2. If not found, resolve identifier → member (`students`) via scan fields
3. Resolve linked login user for that member
4. Verify bcrypt password → issue JWT with role

---

## 3. Menu (`/api/menu`)

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/api/menu` | any authenticated | List menu items (POS uses active ones) |
| POST | `/api/menu` | admin | Create item (supports image_data / image_url) |
| PUT | `/api/menu/:id` | admin | Update item |
| PATCH | `/api/menu/:id/status` | admin | Activate/deactivate |

Image rules: PNG/JPG/JPEG/WEBP, max ~500KB, stored as base64 `image_data` or URL.

---

## 4. Members & students

### Members (`/api/members`)

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/api/members` | staff, admin | List all members |
| GET | `/api/members/:code` | authenticated | Get one member by code/id |
| POST | `/api/members` | admin | Create member |
| PUT | `/api/members/:id` | admin | Update member |
| PATCH | `/api/members/:id/status` | admin | Active/inactive |

### Students (legacy-compatible member API)

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/api/students` | staff, admin | List members |
| GET | `/api/students/:studentCode` | authenticated | Member profile |
| GET | `/api/students/:studentCode/history` | authenticated | Transaction history |

> Note: table name is still `students`, but it stores both student and general members.

---

## 5. Scan (`/api/scan`) — Staff POS entry

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/api/scan/:code` | staff, admin | Lookup member by student ID, member code, barcode, QR, or phone |

Returns member loyalty fields used to start a POS sale.

---

## 6. Offers (`/api/offers`)

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/api/offers` | authenticated | List offers |
| POST | `/api/offers` | admin | Create offer |
| PUT | `/api/offers/:id` | admin | Update offer |
| PATCH | `/api/offers/:id/status` | admin | Enable/disable |

**Offer fields (conceptual):**
- `offer_name`, `slug`
- `customer_type_eligibility`: `city_student` | `general_customer` | `all`
- `discount_type`: `percentage` | `fixed_amount` | `double_points` | `special_price`
- `discount_value`, `applies_to_category`, date range, `is_active`

POS must re-validate eligibility on the server when recording a sale.

---

## 7. Orders / POS (`/api/orders`)

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/api/orders/sales` | staff, admin | **Record POS sale** — create order, items, apply loyalty |
| POST | `/api/orders/redeem` | staff, admin | Redeem voucher or free drink |
| GET | `/api/orders/sales` | staff, admin | Sales list |
| GET | `/api/orders/transactions` | staff, admin | Broader transaction list |

### Sale request (conceptual body)

```json
{
  "memberCode": "CU2024001",
  "items": [
    { "name": "Latte", "category": "Coffee", "qty": 1, "unitPrice": 8 }
  ],
  "paymentMethod": "Cash",
  "cashReceived": 50,
  "discount": 0.8,
  "offerId": "<uuid-or-null>",
  "note": ""
}
```

### Sale side effects

1. Insert `orders` + `order_items`
2. Compute total after validated offer/discount
3. Award points (`floor(total * multiplier)`)
4. +1 stamp; if stamps ≥ 10 → free drink +1, stamps = 0
5. Return receipt payload (order number, points, stamps, etc.)

### Redeem side effects

- Voucher (`Reward`): deduct `points_required` if enough points
- Free drink: decrement `free_drinks_available` if ≥ 1
- Write corresponding order/transaction row

---

## 8. Analytics (`/api/analytics`)

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/api/analytics/overview` | admin | KPIs: revenue, orders, AOV, points, redemptions, members, status |

---

## 9. End-to-end flows (for ChatGPT)

### A) Staff POS sale

```text
Login (staff)
  → Scan GET /api/scan/CU2024001
  → Load menu GET /api/menu
  → Build cart + select offer (UI)
  → Confirm payment
  → POST /api/orders/sales
  → Show receipt; member points/stamps updated in Neon
```

### B) Customer checks balance

```text
Login (CU2024001)
  → GET /api/auth/me  (and/or student/member endpoints)
  → Home shows points, stamp bar, free drinks
  → History via /api/students/:code/history
```

### C) Staff redeems free drink

```text
Scan member
  → Confirm free_drinks_available ≥ 1
  → POST /api/orders/redeem { type: free drink }
  → Counter serves drink; balance decremented
```

### D) Admin updates menu image

```text
Login (admin)
  → PUT /api/menu/:id with image_data (base64)
  → Staff POS refreshes menu → image visible everywhere
```

---

## 10. Error / ops notes

- Invalid credentials → login fails (after DB reset, run `npm run hash-passwords`)
- Insufficient points / no free drinks → redeem rejected
- Offer not eligible for member type → sale should not apply that discount
- `/health` returns 503 if `DATABASE_URL` missing or DB unreachable
- Offline UI mode does **not** hit these endpoints; data stays in localStorage

---

## 11. Related source files (in the real repo)

| Concern | File |
|---------|------|
| Mount routes | `production/api/src/index.js` |
| JWT middleware | `production/api/src/middleware/auth.js` |
| Sales + redeem | `production/api/src/routes/orders.js` |
| Loyalty math | `production/api/src/services/loyalty.js` |
| Offer validation | `production/api/src/services/offers.js` |
| Member scan | `production/api/src/services/members.js` + `routes/scan.js` |
| Frontend checkout | `js/city-cafe-v2.js` → `posCheckout` |

---

*Pair this file with `SYSTEM_ARCHITECTURE_AND_CODE_MAP.md` and `03-database/schema.sql` (+ upgrade SQLs).*
