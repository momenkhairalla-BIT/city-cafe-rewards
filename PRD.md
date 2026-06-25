# PRD — City Café Rewards
**City University Malaysia Café Loyalty System**

**Document purpose:** Share this file with ChatGPT or other AI tools to ask questions about the product, production build, POS integration, payments, architecture, or next steps.

**Last updated:** June 2026  
**Project status:** Prototype approved by merchant → Phase 1 production in progress

---

## 1. Executive Summary

City Café Rewards is a loyalty system for a university café at **City University Malaysia**. Students earn points and stamp progress on purchases, unlock free drinks, and redeem voucher rewards. Staff use a counter POS to record sales. Admin views analytics and exports reports.

The merchant approved the interactive prototype. The team is now building a **real production version** with a PostgreSQL database (Neon) and Node.js API, while keeping the same UI prototype as the frontend.

---

## 2. Business Context

| Item | Detail |
|------|--------|
| Client | City University Malaysia café (merchant) |
| Location | Malaysia |
| Users | Students, café counter staff, café admin/owner |
| Goal | Replace manual loyalty tracking with a digital system |
| Prototype status | ✅ Built and demo-ready |
| Production status | 🔄 Phase 1 — database + API live; frontend connected |

**Key merchant questions still open:**
- How to integrate real POS hardware
- How to connect bank / e-wallet payments (Touch 'n Go, GrabPay, FPX, card terminals)
- Whether to use custom build vs buy existing POS (StoreHub, Qashier, etc.)
- Student verification (manual ID vs university database SSO)

---

## 3. Product Vision

A realistic café loyalty workflow:

1. Student shows QR code or student ID at counter
2. Staff scans / enters student ID
3. Staff records purchase in POS after payment
4. System awards points (1 RM = 1 point)
5. System adds 1 stamp per purchase; every 10 stamps = 1 free drink
6. Student views points, history, and rewards in mobile-style app
7. Staff redeems vouchers and free drinks at counter
8. Admin monitors sales, loyalty KPIs, and exports CSV reports

---

## 4. Target Users

### 4.1 Customer / Student
- View points, stamp progress, free drinks available
- Show QR code / student ID to staff
- Browse rewards and request redemption (staff confirms)
- View transaction history and profile
- **Cannot** manually add points or record purchases

### 4.2 Staff / Counter
- Scan or enter student ID
- Use professional POS to add products, apply discount, select payment method
- Confirm sale → points and stamps update automatically
- Redeem vouchers and free drinks
- View sales history and today’s summary

### 4.3 Admin / Owner
- Dashboard KPIs: revenue, orders, AOV, points, redemptions, loyalty impact
- Manage students, transactions, menu, voucher rules
- Export CSV (sales, students, redemptions, daily summary, JSON backup)
- View SOP and prototype settings

---

## 5. Branding & UI Theme

| Element | Value |
|---------|-------|
| App name | City Café Rewards |
| Subtitle | City University Malaysia Café Loyalty System |
| Black | `#0B0B0D` |
| Pink | `#E91E63` |
| Soft Pink | `#FCE4EC` |
| White | `#FFFFFF` |
| Light Grey | `#F4F4F4` |
| Dark Grey | `#333333` |

**UI style:** Customer = mobile app · Staff = tablet POS · Admin = desktop dashboard

---

## 6. Loyalty Rules

| Rule | Detail |
|------|--------|
| Points | 1 RM spent = 1 point |
| Stamps | 1 stamp per completed purchase |
| Free drink | Every 10 stamps → 1 free drink; stamp counter resets to 0 |
| Vouchers | RM 5 = 100 pts · RM 10 = 180 pts · Free pastry = 150 pts |
| Redemption | Staff-only; customer can request but cannot deduct points |
| Payment (Phase 1) | Manual selection: Cash, Card, E-wallet, Student Wallet |

---

## 7. Demo Students

| Name | Student ID | Programme | Email |
|------|------------|-----------|-------|
| Ahmad Faiz | CU2024001 | Bachelor of IT | ahmad.faiz@student.city.edu.my |
| Sarah Lim | CU2024002 | Diploma in Business | sarah.lim@student.city.edu.my |
| Kumar Raj | CU2024003 | Bachelor of Computer Science | kumar.raj@student.city.edu.my |
| Nur Aina | CU2024004 | Diploma in IT | nur.aina@student.city.edu.my |
| Moimen Ali | CU2024005 | Master of IT | moimen.ali@student.city.edu.my |

---

## 8. Menu (POS Products)

### Coffee
Latte RM 8 · Americano RM 6 · Cappuccino RM 9 · Mocha RM 10

### Iced Drinks
Iced Coffee RM 7 · Iced Latte RM 9 · Matcha Latte RM 10 · Chocolate Ice RM 8

### Food
Sandwich RM 12 · Croissant RM 6 · Muffin RM 5 · Chicken Wrap RM 14

### Add-ons
Extra Shot RM 2 · Oat Milk RM 3 · Whipped Cream RM 2

Admin can add/edit/deactivate menu items. POS shows active items only.

---

## 9. What Is Built Today

### 9.1 Frontend Prototype (`index.html`)
Single-file HTML/CSS/JS app with three interfaces:

**Entry screen** — role picker: Customer, Staff Counter, Admin

**Customer app** (mobile style)
- Home, My QR, Rewards, History, Profile
- Bottom navigation, membership card, stamp progress bar

**Staff counter** (tablet POS)
- Scan Student
- **POS / New Sale** — professional cashier UI with categories, cart, payment, receipt
- Redeem
- Sales History
- Today Summary

**Admin dashboard** (desktop)
- Overview, Students, Transactions, Menu & Rewards, SOP, Prototype Settings
- Export Center (6 export types)
- CSS/HTML charts (no external chart libraries)

**POS features included:**
- Category filters (Coffee, Iced Drinks, Food, Add-ons)
- Cart with +/- quantity, discount, payment methods
- Cash change calculation
- Hold / resume sale
- Receipt modal (print + download as text)
- Full sale transaction data saved

**Export features (CSV + JSON):**
- `city-cafe-sales-transactions.csv`
- `city-cafe-students.csv`
- `city-cafe-redemptions.csv`
- `city-cafe-daily-summary.csv`
- `city-cafe-backup.json` + import restore

### 9.2 Production Backend (`production/`)

| Component | Technology |
|-----------|------------|
| Database | PostgreSQL on **Neon** (Singapore region) |
| API | Node.js + Express |
| Hosting (dev) | `localhost:3001` |
| Auth | Not yet implemented (Phase 3) |
| Payments | Manual recording only (Phase 1) |

**Database tables:** `users`, `students`, `menu_items`, `vouchers`, `orders`, `order_items`

**API endpoints:**

| Method | URL | Purpose |
|--------|-----|---------|
| GET | `/` | Serves prototype UI |
| GET | `/health` | API + DB status |
| GET | `/api/menu` | Active menu items |
| GET | `/api/students` | All students |
| GET | `/api/students/:code` | Single student |
| GET | `/api/students/:code/history` | Student transaction history |
| POST | `/api/orders/sales` | Record POS sale |
| POST | `/api/orders/redeem` | Redeem voucher or free drink |
| GET | `/api/orders/sales` | Purchase list |
| GET | `/api/orders/transactions` | All transaction types |
| GET | `/api/analytics/overview` | Admin KPIs |

### 9.3 Frontend ↔ Backend Connection

- Prototype connects to API when opened at **`http://localhost:3001`**
- Badge shows **● Live · Neon DB** when connected
- Badge shows **○ Offline · localStorage** if API down or opened as file
- Sales and redemptions save to Neon PostgreSQL
- Role switching refreshes data from server

---

## 10. System Architecture

### Current (Phase 1)
```text
Browser (index.html at localhost:3001)
        │
        ▼
Node.js Express API (production/api)
        │
        ▼
PostgreSQL — Neon (cloud, ap-southeast-1)
```

### Target Production Architecture
```text
Student App (PWA / Flutter)  ──┐
Staff POS Web App            ──┼──► Backend API ──► PostgreSQL
Admin Dashboard              ──┘         │
                                         ▼
                              Payment Gateway (Phase 4)
                              (iPay88 / Razer / TnG / FPX)
```

---

## 11. Sale Transaction Data Model

Every POS sale saves:

```
orderId, transactionType: "Purchase", createdAt,
studentId, studentName, programme, cashierName,
items: [{ itemName, category, quantity, unitPrice, lineTotal }],
subtotal, discount, total, paymentMethod,
cashReceived, changeAmount, pointsEarned,
stampBefore, stampAfter, freeDrinkUnlocked, note
```

Redemption transactions save:
```
transactionType: "Reward" | "Free Drink",
pointsUsed, rewardName, studentId, studentName,
createdAt, cashierName
```

---

## 12. How to Run (Developer)

```powershell
# 1. Start API
cd production/api
npm run dev

# 2. Open in browser (IMPORTANT — not as file)
http://localhost:3001

# 3. Demo flow
Staff Counter → Scan CU2024001 → POS / New Sale
→ Add Latte + Croissant → Cash → Confirm Payment
→ Switch to Customer → see updated points
→ Switch to Admin → see analytics
```

**Database setup (one time):**
```powershell
cd production/api
npm run setup-db
```

---

## 13. Production Roadmap

| Phase | Status | Scope |
|-------|--------|-------|
| **Phase 0** | ✅ Done | Interactive prototype, merchant approval |
| **Phase 1** | 🔄 In progress | Neon PostgreSQL + Node API + frontend connected |
| **Phase 2** | Planned | Dedicated React staff POS + admin apps |
| **Phase 3** | Planned | Student login, real auth, mobile PWA |
| **Phase 4** | Planned | Payment gateway (TnG, FPX, card) |
| **Phase 5** | Planned | University student DB integration, QR camera |

---

## 14. POS & Payments Strategy (For GPT Questions)

### Recommended approach for Malaysia café

**Phase 1 (now):** Soft POS — staff records sale in app; payment happens separately (cash/card/TnG at counter); staff selects payment method manually.

**Phase 2 options for real payments:**

| Method | Integration approach |
|--------|---------------------|
| Cash | Manual — no integration needed |
| Debit/credit card | Bank terminal (Maybank, CIMB) or Razer Merchant Services |
| Touch 'n Go / GrabPay | Merchant QR via payment gateway; webhook confirms payment |
| FPX (online banking) | iPay88, Billplz, Senangpay |
| Hardware POS | StoreHub, Qashier, Soft Space — integrate via API or CSV |

**Malaysia payment gateway options:** iPay88, Razer Merchant Services, Billplz, Senangpay, Revenue Monster

**Requirements before payment integration:**
- Business registration (SSM)
- Business bank account
- Merchant account with chosen gateway

**What NOT to build:** Custom payment processing or direct bank API integration

---

## 15. Tech Stack Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Database | PostgreSQL on Neon | Free tier, no Supabase/Firebase limits, Singapore region |
| Backend | Node.js + Express | Simple, full ownership, easy to deploy |
| Frontend (current) | Single index.html | Fast prototype, already built |
| Frontend (future) | React or Next.js | Production apps |
| Student app (future) | PWA or Flutter | Mobile-friendly |
| Avoided | Supabase, Firebase | Usage limits exceeded |

---

## 16. Project File Structure

```
CityCafePrototype/
├── PRD.md                    ← This file (share with GPT)
├── index.html                ← Full prototype UI (Customer + Staff POS + Admin)
├── City_Cafe_Rewards_PRD.md  ← Original prototype-only PRD
└── production/
    ├── docker-compose.yml    ← Optional local Postgres
    ├── database/
    │   ├── schema.sql        ← PostgreSQL schema
    │   └── seed.sql          ← Demo data
    └── api/
        ├── src/index.js      ← Express server + serves index.html
        ├── src/routes/       ← menu, students, orders, analytics
        └── scripts/setup-db.js
```

---

## 17. Demo Testing Flow

1. Start API: `cd production/api && npm run dev`
2. Open `http://localhost:3001`
3. Confirm badge: **● Live · Neon DB**
4. Staff Counter → Scan **CU2024001**
5. POS / New Sale → add Latte + Croissant
6. Payment: Cash RM 20 → Confirm Payment & Record Sale
7. Receipt modal appears
8. Customer → select Ahmad Faiz → verify points and history
9. Admin → Overview → verify revenue KPIs
10. Admin → Prototype Settings → Export Sales CSV

---

## 18. Open Questions (Good for GPT Discussion)

1. What is the best POS hardware setup for a small university café in Malaysia?
2. Should we integrate Touch 'n Go first or card terminal first?
3. How to connect loyalty system to StoreHub or Qashier POS?
4. What is the cost estimate for full production build (Phase 1–4)?
5. How to integrate with City University student database for real student verification?
6. Do we need a native mobile app or is PWA enough for students?
7. What are PCI/compliance requirements for storing payment data? (Answer: don't store — use gateway)
8. How to deploy Node.js API + Neon for production (Railway, Render, VPS)?
9. What staff/admin authentication approach is best (email/password, PIN, SSO)?
10. How to handle offline mode if café internet drops?

---

## 19. Constraints & Out of Scope (Current)

**Not yet built:**
- Real payment gateway integration
- Real QR camera scanning
- Student/staff login and authentication
- Native iOS/Android apps
- University SSO integration
- Email/SMS notifications
- Inventory management
- Kitchen display system
- Multi-branch support

**Prototype limitations:**
- Admin menu edits in API mode are local-only (not synced to server yet)
- Student names derived from email (no name field in DB yet)
- No role-based API security (open endpoints in dev)

---

## 20. Acceptance Criteria (Merchant Approved Prototype)

- ✅ Three working interfaces: Customer, Staff, Admin
- ✅ Shared data across all roles
- ✅ Professional POS with cart, payment, receipt
- ✅ Points, stamps, free drink logic correct
- ✅ Staff redemption with validation
- ✅ Admin analytics and CSV export
- ✅ Pink/black City University Malaysia branding
- ✅ Presentation-ready and clickable
- 🔄 Production database connected (Phase 1)

---

## 21. Sample GPT Prompts You Can Use

Copy any of these when sharing this PRD with GPT:

> "Based on this PRD, what is the best payment integration strategy for a university café in Malaysia with no SSM yet?"

> "Review this City Café Rewards PRD and estimate development time and cost for Phases 2–4."

> "How should I integrate Touch 'n Go eWallet with this Node.js + Neon loyalty system?"

> "Compare building custom POS vs using StoreHub for this café loyalty project."

> "What security and authentication should I add before going live with real students?"

> "Write a technical architecture document for Phase 2 based on this PRD."

> "What are the risks and mitigations for deploying this system at City University Malaysia café?"

---

*End of PRD — City Café Rewards*
