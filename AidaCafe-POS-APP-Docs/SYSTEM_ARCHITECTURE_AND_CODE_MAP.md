# System Architecture & Code Map — Aida Cafe Rewards

Use this file to understand how the **Customer App**, **Staff POS**, and **Admin** share one backend and database.

---

## 1. High-level architecture

```text
┌─────────────────────────────────────────────────────────────┐
│  Browser                                                     │
│  index.html  +  js/city-cafe-v2.js                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Customer app │  │ Staff POS    │  │ Admin dashboard  │  │
│  │ (mobile UI)  │  │ (tablet UI)  │  │ (desktop UI)     │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS + JWT Bearer
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Node.js Express API  (Render / localhost:3001)             │
│  production/api/src/index.js                                 │
│  Serves: GET / → index.html, /js, /assets, /health, /api/*  │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Neon PostgreSQL (ap-southeast-1)                            │
│  users · students(members) · menu_items · vouchers ·        │
│  offers · orders · order_items · loyalty_transactions view  │
└─────────────────────────────────────────────────────────────┘
```

**Connection modes (frontend):**
- **Live** — logged in + API reachable → reads/writes Neon (`● Live · Neon DB`)
- **Offline demo** — API down or file opened as `file://` → localStorage only (`○ Offline · localStorage`)

---

## 2. Repo file map (source project)

```text
CityCafePrototype/
├── index.html                 # Full UI: login + customer + staff POS + admin (CSS + HTML shells)
├── js/city-cafe-v2.js         # Auth session, login/register, offers helpers, POS checkout bridge, routing
├── assets/                    # Logos, images
├── PRD.md                     # Product source of truth
├── start-app.ps1              # Local helper script (if present)
├── Dockerfile / railway.toml / render.yaml
└── production/
    ├── README.md, DEPLOY.md, docker-compose.yml
    ├── database/
    │   ├── schema.sql
    │   ├── seed.sql
    │   └── 002…005_*.sql     # Incremental upgrades
    └── api/
        ├── package.json
        ├── .env.example       # Template only (never commit real .env)
        ├── scripts/           # setup-db, migrate-v*, hash-demo-passwords, test-phase*
        └── src/
            ├── index.js       # Express app: static UI + mount routes
            ├── version.js     # APP_VERSION = v1.5-demo-ready
            ├── db/pool.js     # pg pool + health check
            ├── middleware/auth.js   # requireAuth, requireRole
            ├── routes/        # HTTP endpoints
            └── services/      # Business logic (loyalty, members, offers, auth)
```

---

## 3. Frontend structure (single-page app)

### 3.1 Shells in `index.html`

| Element ID | Role |
|------------|------|
| `#login-screen` | Login + register entry |
| `#customer-app` | Mobile-style customer experience |
| `#staff-app` | Staff tabs: Scan, POS, Redeem, History, Summary |
| `#admin-app` | Sidebar: Overview, Members, Offers, Transactions, Menu, Demo, SOP, Settings |

Large parts of UI are rendered by JS into `#customer-content`, `#staff-content`, `#admin-content`.

### 3.2 Key frontend responsibilities (`js/city-cafe-v2.js`)

| Concern | Functions / behavior |
|---------|----------------------|
| Auth session | `getAuthSession`, `setAuthSession`, JWT stored in browser |
| Login / register | `doLogin`, `submitLogin`, `submitRegister`, `demoLogin` |
| Role routing | `routeAfterLogin`, `showView(role)` → customer / staff / admin |
| Offers (client preview) | `getEligibleOffers`, `calcOfferDiscount`, `applySelectedPosOffer` |
| POS sale | `posCheckout` → `POST /api/orders/sales` when live |
| Member lookup helpers | `findMemberLocal`, barcode/QR rendering |
| Logout | `logoutUser` |

### 3.3 Role UX summary

**Customer tabs:** Home · My QR · Rewards · History · Profile  
**Staff tabs:** Scan Member · POS / New Sale · Redeem · Sales History · Today Summary (+ Demo Help)  
**Admin sections:** Overview KPIs · Members · Offers · Transactions · Menu (images) · Demo Guide · SOP · Settings/Export

---

## 4. Backend structure

### 4.1 Entry (`production/api/src/index.js`)

- CORS + JSON body (limit 10mb for menu image base64)
- Static: `/js`, `/assets`
- Public: `GET /health`, `POST /api/auth/login`, `POST /api/auth/register`
- All other `/api/*` behind `requireAuth`
- Extra role gates: `/api/scan` → staff|admin; `/api/analytics` → admin
- Serves `index.html` at `/`

### 4.2 Routes → services

| Route module | Mount | Main service logic |
|--------------|-------|--------------------|
| `routes/auth.js` | `/api/auth` | Login, register, `/me` |
| `routes/menu.js` | `/api/menu` | CRUD menu + images |
| `routes/members.js` | `/api/members` | List/create/update members |
| `routes/students.js` | `/api/students` | Legacy member lookup + history |
| `routes/scan.js` | `/api/scan` | Staff scan by any identifier |
| `routes/offers.js` | `/api/offers` | Admin offer CRUD |
| `routes/orders.js` | `/api/orders` | **POS sales**, redeem, lists |
| `routes/analytics.js` | `/api/analytics` | Admin overview KPIs |

| Service | Responsibility |
|---------|----------------|
| `services/loyalty.js` | Points, stamps, free drinks, order numbers |
| `services/members.js` | Scan/multi-identifier member find |
| `services/offers.js` | Server-side offer eligibility + discount calc |
| `services/auth.js` / `auth-users.js` | JWT + user records / password hashing links |

### 4.3 Loyalty engine (server truth)

From `services/loyalty.js`:
- Points earned = `floor(totalAmount * pointsMultiplier)`
- Stamp +1 per purchase; if progress ≥ 10 → free drink +1 and stamp → 0
- Redeem voucher: subtract points if sufficient
- Redeem free drink: decrement `free_drinks_available`

**POS sale flow (staff):**
1. Staff scans/enters member code → `GET /api/scan/:code`
2. Builds cart in UI (menu from `GET /api/menu`)
3. Selects eligible offer (server re-validates on sale)
4. Chooses payment method (+ cash received/change if Cash)
5. `POST /api/orders/sales` → creates order + items, updates member loyalty
6. Receipt shown; history reflects Neon data

**Redeem flow:**
1. Staff selects voucher or free drink
2. `POST /api/orders/redeem` with validation
3. Transaction type `Reward` or `Free Drink`

---

## 5. Data model (conceptual)

### Core entities

| Entity | Table | Notes |
|--------|-------|-------|
| Login account | `users` | username/email, password_hash, role |
| Member profile | `students` | points, stamps, free drinks, customer_type, codes |
| Menu product | `menu_items` | price, category, images, flags |
| Offer | `offers` | eligibility, discount_type/value, dates |
| Voucher catalog | `vouchers` | points_required |
| Sale / redeem | `orders` + `order_items` | full POS receipt fields |

### Member identifiers (scan/login)

A member can be found by any of:
- `student_id` (e.g. CU2024001)
- `member_code` (e.g. CU-M-2024001, GC-M-001)
- `barcode_value` / `qr_value`
- `phone`
- Linked `users.username`

### Customer types

| `customer_type` | Meaning | Offer access |
|-----------------|---------|--------------|
| `city_student` | Student Member | Student-only + all |
| `general_customer` | General Customer | Non-student / all offers |

### Offer discount types

| `discount_type` | Effect |
|-----------------|--------|
| `percentage` | % off subtotal or category |
| `fixed_amount` | Flat RM off (capped) |
| `double_points` | Points multiplier (e.g. 2×) |
| `special_price` | Bundle/combo set price |

---

## 6. Auth & access control

| Item | Detail |
|------|--------|
| Tokens | JWT Bearer, ~7-day expiry |
| Passwords | bcrypt (`bcryptjs`) |
| Roles | `admin`, `staff`, `customer` |
| Login IDs | username, student ID, member code, barcode, QR, phone |
| Register | Self-service customers only (student or general) |

Role capabilities:
- **customer** — view own loyalty data; cannot record sales or deduct points
- **staff** — scan, POS sales, redeem, sales lists
- **admin** — everything staff can do + members/menu/offers/analytics/exports

---

## 7. Environment & deploy

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon Postgres connection string |
| `JWT_SECRET` | Required in production |
| `NODE_ENV` | `production` on Render |
| `CORS_ORIGIN` | Optional allow-list |
| `PORT` | Default 3001 locally; Render sets this |

Deploy path: GitHub → Render Blueprint (`render.yaml`) → Root `production/api` → `npm start` → Neon.

Local:
```powershell
cd production/api
npm install
npm run setup-db      # first time
npm run migrate-v2
# … migrate-v3..v5 as needed
npm run hash-passwords
npm run dev
# open http://localhost:3001
```

---

## 8. Mental model for AI assistants

When proposing features or debugging:

1. **UI shells live in `index.html`**; interaction glue and API calls in `js/city-cafe-v2.js`.
2. **Money/loyalty truth is always the API + Postgres**, not localStorage (except offline demo).
3. **`students` table = members** (both student and general).
4. **POS is soft POS**: recording a sale assumes payment already happened at the counter.
5. **Offer eligibility must be enforced server-side** in `services/offers.js` / `orders` route, not only in the browser.
6. Prefer extending existing routes/services over inventing a second app stack unless asked.

---

## 9. Out of scope today (do not assume they exist)

- Payment gateways (TnG, GrabPay, FPX, Stripe)
- Camera QR scanning (manual/USB keyboard wedge works)
- Inventory / multi-branch / SSO / MFA
- Native mobile apps (current UI is responsive web mimicking mobile/tablet)

---

*See also: `01-product/PRD.md` and `04-api-reference/API_ENDPOINTS_AND_FLOWS.md`*
