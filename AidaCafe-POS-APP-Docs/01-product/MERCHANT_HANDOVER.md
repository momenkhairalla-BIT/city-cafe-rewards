# City Café Rewards — Merchant Handover

**Document version:** Phase 5 (v1.5-demo-ready)  
**Last updated:** June 2026

---

## Live URL

| Item | Value |
|------|-------|
| **Production app** | https://city-cafe-rewards.onrender.com |
| **Health check** | https://city-cafe-rewards.onrender.com/health |
| **GitHub** | https://github.com/momenkhairalla-BIT/city-cafe-rewards |
| **Database** | Neon PostgreSQL (ap-southeast-1) |

---

## Demo accounts

| Role | Username / identifier | Password | Notes |
|------|----------------------|----------|-------|
| Admin | admin | admin123 | Full dashboard, exports, menu, offers |
| Staff | staff | staff123 | Scan, POS, redemptions |
| City Student | CU2024001 or CU-M-2024001 | demo123 | Ahmad Faiz — student offers |
| General Customer | general001, GC-M-001, or 60123456789 | demo123 | Ali Rahman — no student offers |

Passwords are bcrypt-hashed in Neon. Re-hash after changes: `npm run hash-passwords` (from `production/api`).

---

## What is included

- Single web app: Customer, Staff POS, Admin dashboard
- JWT authentication with role-based access
- Neon PostgreSQL shared database
- Member types: City University student + general customer
- Scan/lookup: student ID, member code, barcode, QR value, phone
- Registration and multi-identifier login
- Student offers with server-side POS discount validation
- Menu management with product images (Base64 storage)
- Admin KPIs, merchant insights, CSV exports, JSON backup
- Built-in Demo Guide and System Status panel
- Render cloud deployment

---

## What is not included yet

- Payment gateway (Stripe, FPX, Touch 'n Go, etc.)
- Real bank/e-wallet payment confirmation
- Camera-based QR scanning (keyboard/USB scanner works)
- Inventory / stock management
- Multi-branch / franchise support
- Enterprise SSO or MFA
- CDN image storage (images stored as Base64 in database for demo)
- SLA / paid hosting tier (currently Render free tier)

---

## How to test

### Quick UI smoke test

1. Open https://city-cafe-rewards.onrender.com
2. Login staff → scan CU2024001 → POS sale → receipt
3. Login admin → Overview → Transactions
4. Login CU2024001 → check points/history

### Automated tests (from `production/api`)

```powershell
# Read-only (safe for live)
npm run test:production:live
npm run test:phase2
npm run test:phase3
npm run test:phase4
npm run test:phase5

# Local with writes (localhost only recommended)
$env:ALLOW_WRITE_TESTS = "1"
npm run test:phase4
Remove-Item Env:ALLOW_WRITE_TESTS -ErrorAction SilentlyContinue
```

---

## How to export reports

1. Login as **admin**
2. Go to **Settings & Export**
3. Choose export type:
   - **Sales CSV** — all transactions
   - **Members CSV** — loyalty members
   - **Menu CSV** — products (Has Image = Yes/No, no image files)
   - **Offers CSV** — promotion rules
   - **Redemptions CSV** — reward usage
   - **Full Backup JSON** — complete demo data including images

CSV files include UTF-8 BOM and open directly in Microsoft Excel.

---

## Current limitations

See **Settings & Export → Known Limitations** in the admin app, or `PRODUCTION_CHECKLIST.md`.

Key points:

- Render free tier may sleep (~30s cold start)
- Demo passwords — change before public launch
- Images stored as Base64 (prototype approach)
- Reset/clear demo buttons affect local cache primarily; use with care on shared demo DB

---

## Future phases (planned, not started)

| Phase | Focus |
|-------|--------|
| Phase 6 (optional) | Payment / POS hardware integration planning |
| Future | Camera QR, payment gateway, inventory, production hardening |

---

## Support contacts

- **Repository:** GitHub issues on city-cafe-rewards
- **Deployment:** Render dashboard → city-cafe-rewards service
- **Database:** Neon console → project connection string in Render env `DATABASE_URL`

---

## Deployment reminder

After code changes:

1. Push to `main` → Render auto-deploys
2. Run migrations if needed: `npm run migrate-v5` (and earlier migrations on fresh DB)
3. Run `npm run test:production:live` before merchant demo
