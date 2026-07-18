# PRD — Aida Cafe Rewards

**Aida Cafe Loyalty System**

**Document purpose:** Single source of truth for the product. Share this file with stakeholders or AI tools to ask questions about the product, the production build, POS integration, payments, architecture, or next steps.

**Version:** `v1.5-demo-ready`
**Last updated:** June 2026
**Status:** Live production deployment, merchant demo-ready
**Live URL:** https://city-cafe-rewards.onrender.com

> Note: This document supersedes the earlier prototype-only PRD (`City_Cafe_Rewards_PRD.md`), which is retained for historical reference.

---

## 1. Executive Summary

Aida Cafe Rewards is a loyalty and point-of-sale (POS) system for **Aida Cafe**. It serves three audiences from one shared database: **customers** (students and general customers) earn points and stamp progress and redeem rewards; **counter staff** record sales through a POS; and the **admin/owner** manages members, menu, offers, and views analytics.

The project began as an approved interactive prototype and has been built into a **real, deployed production system** running on a Node.js + Express API backed by **Neon PostgreSQL**, hosted on **Render**, with JWT authentication. The original single-page UI is still the production frontend, now connected live to the database and protected by login.

---

## 2. Business Context

| Item | Detail |
|------|--------|
| Client | Aida Cafe café (merchant) |
| Location | Malaysia |
| Users | Students, general customers, café counter staff, café admin/owner |
| Goal | Replace manual loyalty tracking with a digital, multi-role system |
| Prototype status | Built and approved by merchant |
| Production status | Live on Render + Neon, demo-ready (`v1.5-demo-ready`) |

**Open strategic questions (future phases):**
- Real POS hardware integration
- Real payment integration (Touch 'n Go, GrabPay, FPX, card terminals)
- Custom build vs. buy existing POS (StoreHub, Qashier, etc.)
- Student verification (manual vs. university SSO / student DB)

---

## 3. Product Vision

A realistic café loyalty + POS workflow:

1. Customer shows QR / member code / student ID (or logs in to the app).
2. Staff scans or enters the member identifier at the counter.
3. Staff builds the order in the POS and records the sale after payment.
4. System awards points (RM 1 = 1 point) and applies eligible offers.
5. System adds 1 stamp per purchase; every 10 stamps = 1 free drink (stamp counter resets).
6. Customer views points, stamp progress, rewards, and history in a mobile-style app.
7. Staff redeems vouchers and free drinks at the counter (with validation).
8. Admin monitors KPIs, manages members/menu/offers, and exports CSV reports.

---

## 4. Target Users & Roles

The system has three authenticated roles: **admin**, **staff**, **customer**. Customers are further split into two **member types**.

### 4.1 Customer (member types: Student Member / General Customer)
- View points, stamp progress, free drinks available
- Show QR / member code / student ID to staff
- Browse rewards and request redemption (staff confirms)
- View transaction history and profile
- Self-register and log in
- **Cannot** add points or record purchases directly
- **Student Member** members are eligible for student-only offers; **General Customers** are not

### 4.2 Staff / Counter
- Scan or enter a member identifier
- Use the POS: categories, product grid with images, cart, discount, payment method
- Apply eligible offers; confirm sale → points and stamps update automatically
- Redeem vouchers and free drinks
- View sales history and today's summary
- Access an in-app Demo Help guide

### 4.3 Admin / Owner
- Overview KPIs: revenue, orders, AOV, points issued, redemptions, members, system status
- Manage members (students and general customers)
- Manage menu items, including product images, categories, best-seller / student-offer flags
- Manage offers/promotions and voucher rules
- View transactions with filters
- Export CSV (sales, members, redemptions, daily summary) + JSON backup
- View SOP, Demo Guide, and settings

---

## 5. Authentication & Access Control

| Aspect | Detail |
|--------|--------|
| Mechanism | JWT (Bearer token), 7-day expiry |
| Password storage | bcrypt hashing (`bcryptjs`) |
| Roles | `admin`, `staff`, `customer` |
| Login identifiers | username, student ID, member code, barcode value, QR value, or phone |
| Registration | Self-service for customers (Student Member or General Customer) |
| API protection | All `/api/*` routes require a valid token; sensitive routes are role-gated |
| Frontend fallback | If the API is unreachable, the app runs in offline localStorage demo mode |

**Multi-identifier login flow:** the API first matches a user directly (username/email); if not found, it resolves the identifier to a member record (scan lookup), then to the linked login user.

> Operational note: after any database reset/re-seed, run `npm run hash-passwords` (in `production/api`) to (re)apply bcrypt password hashes and member links for demo accounts, or demo logins will fail with "Invalid credentials".

---

## 6. Demo Accounts

| Role | Login identifier(s) | Password |
|------|--------------------|----------|
| Admin | `admin` | `admin123` |
| Staff | `staff` | `staff123` |
| Student Member (Ahmad Faiz) | `CU2024001`, `CU-M-2024001` | `demo123` |
| General Customer (Ali Rahman) | `general001`, `60123456789`, `GC-M-001`, `GC001` | `demo123` |

---

## 7. Loyalty Rules

| Rule | Detail |
|------|--------|
| Points | RM 1 spent = 1 point |
| Stamps | 1 stamp per completed purchase |
| Free drink | Every 10 stamps → 1 free drink; stamp counter resets to 0 |
| Vouchers | RM 5 = 100 pts · RM 10 = 180 pts · Free pastry = 150 pts |
| Redemption | Staff-only; customers can request but cannot deduct points |
| Payment | Manual selection: Cash, Card, E-wallet, Student Wallet (no gateway yet) |
| Offers | Applied at POS based on member type and offer rules (see §8) |

---

## 8. Offers & Promotions

Offers are managed by admin and applied at the POS. Eligibility depends on member type (`city_student`, `general_customer`, or `all`) and active date range.

**Supported discount types:**

| Type | Behaviour |
|------|-----------|
| `percentage` | % off subtotal or a specific category (e.g. 10% off student drinks: Coffee + Iced Drinks) |
| `fixed_amount` | Flat RM amount off (capped at subtotal) |
| `double_points` | Points multiplier (e.g. 2×) instead of a price discount |
| `special_price` | Bundle/combo price (e.g. coffee + croissant for a set price) |

Student-only offers are hidden/blocked for general customers; the POS validates eligibility before applying.

---

## 9. Menu (POS Products)

**Coffee:** Latte RM 8 · Americano RM 6 · Cappuccino RM 9 · Mocha RM 10
**Iced Drinks:** Iced Coffee RM 7 · Iced Latte RM 9 · Matcha Latte RM 10 · Chocolate Ice RM 8
**Food:** Sandwich RM 12 · Croissant RM 6 · Muffin RM 5 · Chicken Wrap RM 14
**Add-ons:** Extra Shot RM 2 · Oat Milk RM 3 · Whipped Cream RM 2

Each menu item supports: name, price, category, description, **product image**, image alt text, active flag, best-seller flag, and student-offer-eligible flag. The POS shows only active items; products without an image show a category placeholder.

### Menu image management
- Upload formats: PNG, JPG, JPEG, WEBP
- Max size: 500 KB (validated client- and server-side)
- Stored as base64 data (`image_data`) or external URL (`image_url`) in the database
- Images are shared across all devices via the database (admin uploads → visible to everyone)

---

## 10. What Is Built Today

### 10.1 Frontend (`index.html` + `js/city-cafe-v2.js`)

Single-page app with three role experiences, served by the API and protected by login.

**Login / registration** — username + password; customer self-registration (student or general); friendly error messages; in-app **Demo Guide**.

**Customer app (mobile style)** — Home, My QR, Rewards, History, Profile; membership card, stamp progress bar, bottom navigation.

**Staff counter (tablet POS)** — Scan Member; **POS / New Sale** (categories, product grid with images, cart with quantity/discount, payment method, cash change, hold/resume, receipt); Redeem; Sales History; Today Summary; Demo Help.

**Admin dashboard (desktop)** — Overview (KPIs + system status), Members, Offers & Promotions, Transactions, Menu Management (with image upload), Demo Guide, SOP, Settings & Export. Charts are pure CSS/HTML (no external chart libraries).

**Exports (CSV + JSON):** sales transactions, members, redemptions, daily summary, full JSON backup + restore.

**Connection model:** when logged in and the API is reachable, the app reads/writes the live Neon database and shows **● Live · Neon DB**. If the server is unreachable or opened as a local file, it falls back to **○ Offline · localStorage** demo mode. Menu data refreshes on entering POS/Menu tabs and on window focus.

### 10.2 Backend (`production/api`)

| Component | Technology |
|-----------|------------|
| Database | PostgreSQL on **Neon** (ap-southeast-1) |
| API | Node.js + Express (ES modules) |
| Auth | JWT + bcrypt, role-based middleware |
| Hosting | **Render** (production) / `localhost:3001` (dev) |
| Version surface | `/health` returns `version` and `appVersion` = `v1.5-demo-ready` |

**Database tables:** `users`, `students` (members), `menu_items`, `vouchers`, `orders`, `order_items`, `offers`, plus the `loyalty_transactions` view. Members support two customer types and fields for member code, barcode, QR, and phone.

### 10.3 API Endpoints (high level)

| Area | Examples |
|------|----------|
| System | `GET /` (UI), `GET /health` (status + version) |
| Auth | `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/me` |
| Menu | `GET /api/menu`, `POST /api/menu`, `PUT /api/menu/:id`, `PATCH /api/menu/:id/status` (image fields included) |
| Members/Students | `GET /api/members`, `GET /api/members/:code`, `GET /api/students`, `GET /api/students/:code/history` |
| Scan | `GET /api/scan/...` (staff/admin only) |
| Offers | `GET /api/offers` |
| Orders | `POST /api/orders/sales`, `POST /api/orders/redeem`, `GET /api/orders/transactions` |
| Analytics | `GET /api/analytics/overview` (admin only) |

All `/api/*` routes require authentication; scan and analytics are role-restricted.

---

## 11. System Architecture

### Current (deployed)
```text
Browser (index.html + js/city-cafe-v2.js)
        │  HTTPS + JWT Bearer token
        ▼
Node.js Express API (Render)
        │
        ▼
PostgreSQL — Neon (cloud, ap-southeast-1)
```

### Target future architecture
```text
Customer PWA / mobile  ──┐
Staff POS web app        ──┼──► Backend API ──► PostgreSQL
Admin dashboard          ──┘         │
                                     ▼
                          Payment Gateway (future)
                          (iPay88 / Razer / TnG / FPX)
```

---

## 12. Sale Transaction Data Model

Every POS sale records:
```
order_number, transaction_type: "Purchase", created_at,
student_id, staff_user_id, cashier_name,
items: [{ item_name, category, quantity, unit_price, line_total }],
subtotal, discount, discount_type, total, payment_method,
cash_received, change_amount, points_earned,
stamp_before, stamp_after, free_drink_unlocked, note
```

Redemption transactions record:
```
transaction_type: "Reward" | "Free Drink",
points_used, reward_name, student_id, created_at, cashier_name
```

---

## 13. How to Run (Developer)

```powershell
# 1. Start API (from production/api)
cd production/api
npm install
npm run dev

# 2. Open in a browser (NOT as a file)
http://localhost:3001

# 3. Log in (e.g. admin / admin123) and confirm badge: ● Live · Neon DB
```

**Database setup / migrations (one-time per environment):**
```powershell
cd production/api
npm run setup-db        # base schema + seed
npm run migrate-v2      # members upgrade (customer types, codes)
npm run migrate-v3      # offers / promotions
npm run migrate-v4      # (menu phase prep)
npm run migrate-v5      # menu image columns
npm run hash-passwords  # bcrypt demo passwords + member links
```

**Deployment:** push to the `main` branch on GitHub; Render auto-deploys. Required env vars on Render: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV=production`.

---

## 14. Phase History & Roadmap

| Phase | Status | Scope |
|-------|--------|-------|
| Phase 0 | Done | Interactive prototype, merchant approval |
| Phase 1 | Done | Neon PostgreSQL + Node API + frontend connected |
| Phase 2 | Done | JWT auth, multi-identifier login, member types (student + general) |
| Phase 3 | Done | Student offers & POS discounts (percentage, fixed, double points, special price) |
| Phase 4 | Done | Menu image management (upload, validation, shared storage) |
| Phase 5 | Done | Merchant demo prep: in-app Demo Guide, KPIs, system status, health version, deployment hardening |
| Future | Planned | Payment gateway, real QR camera scan, university SSO, native/PWA app, notifications, inventory |

---

## 15. POS & Payments Strategy (future)

**Now:** Soft POS — staff records the sale; payment happens separately (cash/card/TnG at the counter); staff selects the payment method manually.

**Future real-payment options:**

| Method | Integration approach |
|--------|---------------------|
| Cash | Manual — no integration |
| Debit/credit card | Bank terminal (Maybank, CIMB) or Razer Merchant Services |
| Touch 'n Go / GrabPay | Merchant QR via gateway; webhook confirms payment |
| FPX (online banking) | iPay88, Billplz, Senangpay |
| Hardware POS | StoreHub, Qashier, Soft Space — via API or CSV |

**Prerequisites before payment integration:** SSM business registration, business bank account, merchant account with chosen gateway. **Do not** build custom payment processing — use a gateway.

---

## 16. Tech Stack Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Database | PostgreSQL on Neon | Free tier, no Supabase/Firebase limits, Singapore region |
| Backend | Node.js + Express | Simple, full ownership, easy to deploy |
| Auth | JWT + bcrypt | Standard, stateless, role-based |
| Hosting | Render | Simple Git-based deploys, free tier |
| Frontend (current) | Single `index.html` + `js/city-cafe-v2.js` | Reuses approved prototype UI |
| Frontend (future) | React / Next.js + PWA | Production apps |
| Avoided | Supabase, Firebase | Usage limits |

---

## 17. Project File Structure

```
CityCafePrototype/
├── PRD.md                       ← This file (current source of truth)
├── City_Cafe_Rewards_PRD.md     ← Original prototype-only PRD (historical)
├── index.html                   ← Full UI (Customer + Staff POS + Admin)
├── js/city-cafe-v2.js           ← Auth, registration, members, offers, QR/barcode
├── DEMO_SCRIPT.md               ← Merchant demo speaking script
├── MERCHANT_HANDOVER.md         ← Handover guide
├── PRODUCTION_CHECKLIST.md      ← Pre-demo checklist
└── production/
    ├── README.md / DEPLOY.md
    ├── database/
    │   ├── schema.sql           ← Base schema
    │   ├── seed.sql             ← Demo data
    │   ├── 002_members_upgrade.sql
    │   ├── 003_phase3_offers.sql
    │   ├── 004_link_demo_users.sql
    │   └── 005_menu_images.sql
    └── api/
        ├── src/index.js         ← Express server + serves index.html + /health
        ├── src/version.js       ← APP_VERSION = v1.5-demo-ready
        ├── src/middleware/auth.js
        ├── src/services/        ← auth, auth-users, members
        ├── src/routes/          ← auth, menu, students, members, scan, offers, orders, analytics
        └── scripts/             ← setup-db, migrate-v*, hash-demo-passwords, test-phase2..5
```

---

## 18. Acceptance Criteria

- Three working role experiences: Customer, Staff, Admin (shared live data)
- JWT authentication with role-based access; multi-identifier login
- Two member types (Student Member, General Customer) with correct offer eligibility
- Professional POS: cart, discounts, offers, payment, receipt, product images
- Correct points, stamps, and free-drink logic
- Staff redemption with validation
- Admin analytics, member/menu/offer management, and CSV/JSON export
- Menu images shared across devices via the database
- In-app Demo Guide; `/health` reports `version`/`appVersion`
- Pink/black Aida Cafe branding
- Deployed and reachable on Render with Neon database

---

## 19. Out of Scope (current)

- Real payment gateway integration
- Real QR camera scanning (codes are simulated/manual entry)
- University SSO / live student database verification
- Native iOS/Android apps
- Email/SMS notifications
- Inventory management, kitchen display, multi-branch

---

## 20. Known Constraints & Operational Notes

- **Free-tier hosting:** Render free instances can cold-start; the first request after idle may be slow.
- **Demo passwords:** must be re-hashed (`npm run hash-passwords`) after any DB reset/re-seed.
- **Offline mode:** if the API is unreachable or the file is opened directly, the app runs in localStorage demo mode and data is per-browser (not shared).
- **Secrets:** `JWT_SECRET` and `DATABASE_URL` are environment variables; never commit real secrets.

---

## 21. Branding

| Element | Value |
|---------|-------|
| App name | Aida Cafe Rewards |
| Subtitle | Aida Cafe Loyalty System |
| Black | `#0B0B0D` |
| Pink | `#E91E63` |
| Soft Pink | `#FCE4EC` |
| White | `#FFFFFF` |
| Light Grey | `#F4F4F4` |
| Dark Grey | `#333333` |

UI style: Customer = mobile app · Staff = tablet POS · Admin = desktop dashboard. Pink highlights active role/navigation; black headers with pink accent buttons.

---

*End of PRD — Aida Cafe Rewards (`v1.5-demo-ready`)*
