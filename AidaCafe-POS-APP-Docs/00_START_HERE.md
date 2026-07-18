# Aida Cafe Rewards — Documentation Pack for AI / ChatGPT

**Purpose of this zip:** Give ChatGPT (or any AI) enough context to understand the **whole POS + Customer App + Admin** system without needing the full source repo.

**Product name:** Aida Cafe Rewards (loyalty + soft POS)  
**App version:** `v1.5-demo-ready`  
**Live URL:** https://city-cafe-rewards.onrender.com  
**Stack:** `index.html` + `js/city-cafe-v2.js` frontend · Node.js/Express API · Neon PostgreSQL · Render hosting · JWT auth

---

## How to use this pack with ChatGPT

1. Extract this zip into a folder.
2. Upload the folder (or key files) into ChatGPT / a project knowledge base.
3. Start with this prompt:

> You are helping me work on **Aida Cafe Rewards**, a café loyalty + POS system.  
> Read `00_START_HERE.md` and `SYSTEM_ARCHITECTURE_AND_CODE_MAP.md` first, then `01-product/PRD.md`.  
> Treat those as the source of truth for product, roles, loyalty rules, API, and file layout.  
> Answer questions and propose changes in that context.

4. For deep product questions → `01-product/PRD.md`  
5. For API / code structure → `SYSTEM_ARCHITECTURE_AND_CODE_MAP.md` + `04-api-reference/`  
6. For schema / tables → `03-database/`  
7. For deploy / demo ops → `02-ops-deploy/`

---

## What this system is

One web app, three experiences, one database:

| Experience | UI style | Who | Main jobs |
|------------|----------|-----|-----------|
| **Customer app** | Mobile phone frame | Students + general customers | Points, stamps, QR/member code, rewards, history |
| **Staff POS** | Tablet counter | Café staff | Scan member → build cart → apply offer → record sale → redeem |
| **Admin** | Desktop dashboard | Owner/admin | KPIs, members, menu (+ images), offers, transactions, CSV/JSON export |

**Loyalty core rules:**
- RM 1 spent = 1 point (can be multiplied by double-points offers)
- 1 stamp per purchase; every 10 stamps = 1 free drink (stamp resets)
- Voucher / free-drink redemption is **staff-only** (validated on server)
- Offers filtered by member type (`city_student` vs `general_customer`)

**Payment today:** Soft POS — staff selects Cash / Card / E-wallet / Student Wallet after real-world payment. No payment gateway yet.

---

## Folder map (this zip)

```
AidaCafe-POS-APP-Docs/
├── 00_START_HERE.md                      ← You are here
├── SYSTEM_ARCHITECTURE_AND_CODE_MAP.md   ← Technical map of POS + App + API
├── 01-product/
│   ├── PRD.md                            ← Current product source of truth (read this)
│   ├── City_Cafe_Rewards_PRD.md          ← Historical prototype PRD
│   ├── DEMO_SCRIPT.md                    ← Merchant demo speaking script
│   └── MERCHANT_HANDOVER.md              ← Handover + demo accounts
├── 02-ops-deploy/
│   ├── production-README.md              ← Local run + scripts
│   ├── DEPLOY.md                         ← Render + Neon deploy
│   └── PRODUCTION_CHECKLIST.md           ← Pre-demo checklist
├── 03-database/
│   ├── schema.sql                        ← Base PostgreSQL schema
│   ├── seed.sql                          ← Demo seed data
│   ├── 002_members_upgrade.sql           ← Member types, codes, offers table
│   ├── 003_phase3_offers.sql             ← Offer metadata on orders
│   ├── 004_link_demo_users.sql           ← Link demo users ↔ members
│   └── 005_menu_images.sql               ← Menu image columns
└── 04-api-reference/
    └── API_ENDPOINTS_AND_FLOWS.md        ← Routes, roles, sale/redeem flows
```

---

## Demo accounts (for understanding flows)

| Role | Login | Password |
|------|-------|----------|
| Admin | `admin` | `admin123` |
| Staff | `staff` | `staff123` |
| Student member | `CU2024001` | `demo123` |
| General customer | `general001` or phone `60123456789` | `demo123` |

---

## Important naming notes

- Branding in UI: **Aida Cafe**. Older docs/repos may still say “City Café / City Cafe”.
- DB table `students` stores **all members** (students and general customers). Prefer thinking of it as the **members** table.
- Roles in auth: `admin`, `staff`, `customer` (legacy enum also had `student`).

---

## What is intentionally NOT in this zip

- Full source code (`index.html`, `js/`, API JS) — too large for many chat uploads; architecture docs describe it.
- Secrets (`.env`, `JWT_SECRET`, real `DATABASE_URL`) — never share these with ChatGPT.
- `node_modules`

If ChatGPT needs exact code later, paste specific files or attach them separately.

---

*Pack generated for AI context — Aida Cafe Rewards v1.5-demo-ready*
