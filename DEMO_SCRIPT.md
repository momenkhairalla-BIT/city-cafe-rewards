# City Café Rewards — Merchant Demo Script

Use this script when presenting City Café Rewards to City University Malaysia café management, merchants, or stakeholders.

**Live URL:** https://city-cafe-rewards.onrender.com  
**App version:** v1.5-demo-ready

---

## Opening (2 minutes)

> "Good [morning/afternoon]. Today I’m showing **City Café Rewards** — a loyalty and POS system built for the City University Malaysia café.
>
> It connects three roles in one platform: **customers** earn points and stamps on their phone, **staff** scan members and record sales at the counter, and **admin** sees revenue, members, offers, and exports reports.
>
> The system runs on a live cloud deployment with a real PostgreSQL database — this is a working demo, not just mockups."

**Problem being solved:**

- Manual stamp cards are easy to lose and hard to track.
- Student discounts are applied inconsistently at the counter.
- Owners lack a single view of sales, loyalty, and member activity.

---

## 1. Staff POS demonstration (5–7 minutes)

**Say:** "Let me show how a typical sale works at the counter."

1. Click **Login as Staff** or enter `staff` / `staff123`.
2. Open **Scan Member** → enter `CU2024001` → member **Ahmad Faiz** loads with points and stamps.
3. Go to **POS / New Sale**.
4. Add **Latte** and **Croissant** to the cart.
5. Select **10% Student Drink Discount** (student-only offer).
6. Choose **Cash** → enter cash received → **Confirm Payment & Record Sale**.
7. Show the **receipt**: order ID, discount, points earned, stamp progress.
8. **Say:** "The sale is saved to the database immediately — not just on this device."

**Optional:** Scan general customer `60123456789` and note that student offers do not appear.

---

## 2. City University student demonstration (3–4 minutes)

**Say:** "This is what the student sees on their phone."

1. Logout → login as `CU2024001` / `demo123`.
2. **Home** — points, stamps, free drinks available.
3. **QR / Barcode** — scannable ID for the counter (keyboard/scanner input today; camera QR planned for future phase).
4. **History** — purchases after the staff demo sale should appear after sync.
5. **Rewards** — voucher redemption with points.

---

## 3. General customer demonstration (2–3 minutes)

**Say:** "Non-students can also join the loyalty programme."

1. Login as `general001` / `demo123` or `60123456789` / `demo123`.
2. Show points and member code.
3. **Say:** "General customers earn points and stamps but do not receive City University student-only offers — the POS enforces this server-side."

**Optional:** Register a new general customer with a phone number.

---

## 4. Admin dashboard demonstration (5–6 minutes)

**Say:** "The owner or manager gets full visibility."

1. Login as `admin` / `admin123`.
2. **Merchant Overview** — KPIs: revenue, orders, members, discounts, top product, merchant insights.
3. **System Status** — API and database connection (green = live).
4. **Transactions** — the sale from the staff demo.
5. **Menu Management** — edit a product, upload an image (PNG/JPG, max 500 KB), mark Best Seller / Student Offer Eligible.
6. **Offers & Promotions** — student discount rules.
7. **Demo Guide** — built-in reference for training staff.

---

## 5. Export / report demonstration (2 minutes)

**Say:** "Reports can be exported for Excel and record-keeping."

1. Go to **Settings & Export**.
2. Click **Export Sales CSV** — open in Excel.
3. Click **Export Members CSV** and **Export Menu CSV**.
4. **Say:** "Menu export includes a Has Image flag but not the image file itself — suitable for spreadsheets."

---

## Closing summary (2 minutes)

> "City Café Rewards today includes:
> - Member types: City University students and general customers
> - Scan by student ID, member code, barcode, QR value, or phone
> - Registration and secure login
> - Student offers with server-validated POS discounts
> - Menu management with product images
> - Admin analytics and CSV exports
>
> **Not included yet:** payment gateway, real bank/e-wallet confirmation, camera QR scanning, and enterprise hardening — those are planned future phases."

---

## Future development discussion

| Phase | Topic |
|-------|--------|
| Next | Payment gateway / e-wallet integration (planning only) |
| Next | Camera-based QR scanning |
| Future | Inventory management |
| Future | Hardware POS integration |
| Future | Production security hardening and custom domain |

---

## Demo accounts quick reference

| Role | Login | Password |
|------|-------|----------|
| Admin | admin | admin123 |
| Staff | staff | staff123 |
| City Student | CU2024001 | demo123 |
| General Customer | general001 or 60123456789 | demo123 |

**Tip:** If the live site is slow to respond, wait ~30 seconds — the free Render tier wakes from sleep after inactivity.
