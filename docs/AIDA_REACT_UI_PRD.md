# PRD — Aida Counter & Aida Office (React UI Redesign)

| Field | Value |
|-------|--------|
| **Product** | Aida Cafe Rewards — Staff POS & Admin shells |
| **Document** | Product Requirements Document (UI redesign) |
| **Audience** | Product, design, Team 1 (React UI), Team 2 (API) |
| **App path** | `apps/pos-admin-web` |
| **Branch** | `team1/aida-pos-admin-ui` |
| **PR** | https://github.com/momenkhairalla-BIT/city-cafe-rewards/pull/1 |
| **Version** | `0.1-preview` |
| **Date** | 21 Jul 2026 |
| **Status** | UI preview ready for team review (not production cutover) |

---

## 1. Purpose

Replace the legacy staff experience with two branded React products that feel like a café counter system and a café office — not a generic SaaS dashboard:

| Product | Name | Route | Primary user |
|---------|------|-------|--------------|
| Soft POS | **Aida Counter** | `/pos` | Counter staff |
| Back office | **Aida Office** | `/admin` | Managers / admins |
| Access gate | **Employee Access** | `/employee` | Staff + admins (before product entry) |

Shared visual language: **Aida Signature** (ivory/cream surfaces, espresso/burgundy type, rose accent, gold accent-only).

This PRD describes the **new React UI redesign** Team 1 built for colleague review. It does **not** replace the master product PRD (`PRD.md` at repo root) for loyalty rules, payments strategy, or production hosting.

---

## 2. Goals

### Must achieve
1. **Brand-first counter & office** — Aida identity is obvious in the first viewport of both products.
2. **Real café workflows** — terminal enrol → employee login → open shift → sell → close shift; managers review ops without checkout controls.
3. **Safe preview for demos** — run with sample data, no Neon / live OTC / sales API required.
4. **Preserve security model** — cookie employee session, terminal binding, role-based routing, production fail-closed for bypass/preview flags.
5. **Clear Team 1 / Team 2 boundary** — UI only on this branch; API/migrations stay Team 2.

### Non-goals (this release)
- Calling `POST /api/v1/pos/sales` (soft payment is preview-only).
- Live manager OTC minting or Neon access from Team 1.
- Finalising modifier/variant OpenAPI contracts (UI concept only, labelled pending).
- Replacing the customer loyalty app or the legacy root `index.html` merchant demo in this PR.

---

## 3. Users & permissions

| Role | After login | Can use |
|------|-------------|---------|
| Staff | → Aida Counter | Shift, menu/cart UI, member panel UI, preview payment |
| Admin / manager | → Aida Office | Dashboard, reports, operations, catalogue, rewards, system modules |
| Dual-role | → Choose workspace | Staff POS **or** Admin Dashboard |

**Rules**
- Empty branch assignment ≠ global access; global requires explicit manager flag.
- Admin never shows POS checkout.
- Counter never shows Admin navigation.
- Location comes from **terminal enrolment** (server), not a client branch picker.

---

## 4. Information architecture

### 4.1 Employee Access (`/employee`)
1. Activate terminal with manager-issued enrolment code (OTC).
2. Sign in with password **or** badge + PIN.
3. Dual-role users pick Counter vs Office.

### 4.2 Aida Counter (`/pos`)
**Shift phases:** need location → open shift → ready (workspace) → locked → closing → closed.

**Three-zone workspace (shift open):**
| Zone | Purpose |
|------|---------|
| **Aida Rail** | New Sale, Orders, Member, Shift, Terminal, Help |
| **Menu Gallery** | Categories, search, product tiles, modifiers sheet |
| **Order Ribbon** | Line items, qty, member chip, Pay / Clear |

### 4.3 Aida Office (`/admin`)
Grouped left nav:

| Group | Screens |
|-------|---------|
| Overview | Dashboard, Live Ops |
| Reports | Sales, Transactions, Products, Members |
| Operations | Branches, Terminals, Shifts, Employees |
| Catalogue | Menu, Categories, Variants |
| Rewards | Loyalty, Stamps, Offers, Campaigns |
| System | Audit, Integrations, Settings |

---

## 5. Functional requirements

### 5.1 Terminal enrolment
| ID | Requirement | Preview | Live (Team 2) |
|----|-------------|---------|---------------|
| T1 | Staff cannot invent enrolment codes | Sample `AIDA-482731` | Manager-minted OTC via API |
| T2 | Invalid / expired / reused codes fail clearly | Simulated | API error codes |
| T3 | Success binds branch · sales point · terminal | Main Café · Main Counter · POS-MAIN-01 | Server-resolved location |
| T4 | No terminal secrets in localStorage | Preview flag in sessionStorage only | HttpOnly terminal cookie |

### 5.2 Authentication
| ID | Requirement |
|----|-------------|
| A1 | Password login for employees |
| A2 | Badge + PIN login |
| A3 | Idle lock / reauth preserved |
| A4 | Logout clears employee session |
| A5 | Dual-role product select recorded for audit |

### 5.3 Shift lifecycle (Counter)
| ID | Requirement |
|----|-------------|
| S1 | Open shift with opening float |
| S2 | Lock / resume shift |
| S3 | Close shift with expected/actual cash, variance, notes, handover |
| S4 | Confirm step before final close |

### 5.4 Sale UX (Counter) — UI preview
| ID | Requirement | Note |
|----|-------------|------|
| C1 | Browse menu by category + search | Sample catalogue |
| C2 | Modifier sheet before add-to-cart | **UI concept** — contract pending Team 2 |
| C3 | Cart qty, clear sale | Local cart |
| C4 | Attach member / rewards panel | Sample members; no directory export |
| C5 | Payment methods + preview receipt | Does **not** post sales to API |
| C6 | Recent orders rail | Sample rows only |

### 5.5 Office modules
| Fidelity | Modules |
|----------|---------|
| High (preview data) | Dashboard, Sales report, Terminals, Shifts, Employees, Menu, Campaigns, Integrations labels |
| Placeholder shell | Live Ops, other reports, Branches, Categories, Variants, Loyalty/Stamps/Offers, Audit, Settings |

---

## 6. Design requirements

| Topic | Spec |
|-------|------|
| Palette | Ivory `#FFF9F6`, Cream `#F6ECE6`, Espresso `#2C171B`, Burgundy `#541A28`, Rose `#C92F50`, Gold `#C8A345` (accent only) |
| Type | Playfair Display (display) + Plus Jakarta Sans (UI) |
| POS targets | Large primary actions (~48px) for touch |
| Motion | Intentional, restrained; respect `prefers-reduced-motion` |
| Icons | No emoji iconography |
| Preview banner | Always show **UI PREVIEW — SAMPLE DATA** when preview mode is on |

Tokens live in `apps/pos-admin-web/src/styles/tokens.css`.

---

## 7. Technical constraints

| Constraint | Detail |
|------------|--------|
| Stack | React + Vite + React Router + TanStack Query |
| Base branch | Phase 3A (`feature/aida-cafe-production-rewire-phase3a`) |
| Preview flag | `VITE_UI_PREVIEW_MODE=true` in `.env.development` only |
| Production safety | Vite **fails the build** if preview mode is enabled for production |
| Auth bypass | `VITE_ALLOW_AUTH_BYPASS` also fail-closed in production |
| Ownership | Team 1 = React UI only — no API edits, migrations, or Neon |

---

## 8. How to review (colleague quick start)

```powershell
git fetch origin
git checkout team1/aida-pos-admin-ui
cd apps/pos-admin-web
npm install
copy .env.example .env.development
npm run dev
```

Open **http://localhost:5173/employee**

| Step | Value |
|------|--------|
| Enrolment code | `AIDA-482731` |
| Admin | `preview.admin` / `preview123` → Office |
| Staff | `preview.staff` / `preview123` → Counter |
| Dual | `preview.dual` / `preview123` → role select |
| Badge demo | `PREVIEW-BADGE` / PIN `4821` |

**Screenshots (all screens):**  
`apps/pos-admin-web/docs_screenshots/all-screens/`  
Regenerate: `node scripts/capture-all-screens.mjs`

**Pull request:** https://github.com/momenkhairalla-BIT/city-cafe-rewards/pull/1

---

## 9. Success criteria

- [ ] Colleague can enrol + login in preview without an API.
- [ ] Counter three-zone layout is usable for a sample sale (modifier → pay → receipt).
- [ ] Office nav reaches every module; high-fidelity pages show sample café data.
- [ ] Banner clearly marks preview; no confusion with production.
- [ ] `npm test` / `npm run typecheck` / `npm run build` pass (preview flag off for build).
- [ ] Agreement on which modules Team 2 should wire next (sales, modifiers, live OTC).

---

## 10. Open decisions / next phase

1. **Team 2 live adapters** — swap preview repositories for real terminal, auth, shift, and eventually sales endpoints.
2. **Modifier / variant OpenAPI** — approve contract before Counter submits real lines.
3. **ENABLE_POS_SALES** — keep off until authorised validation DB + UI wiring.
4. **Flutter vs React** — React is the active review candidate on this branch; Flutter remains a parallel experiment if still needed.
5. **Placeholder Office modules** — prioritise which placeholders become high-fidelity first (e.g. Live Ops, Transactions).

---

## 11. Related documents

| Doc | Why |
|-----|-----|
| `docs/AIDA_POS_ADMIN_UI_SPEC.md` | Design + IA detail |
| `docs/AIDA_UI_SCREEN_AND_PERMISSION_MAP.md` | Route × permission map |
| `docs/AIDA_UI_API_CAPABILITY_MATRIX.md` | Connected vs preview vs blocked |
| `docs/AIDA_UI_BACKEND_BENCHMARK.md` | Expected Team 2 API behaviour |
| `docs/AIDA_UI_VALIDATION.md` | Demo credentials & validation notes |
| `docs/AIDA_REPORT_CATALOGUE.md` | Report inventory |
| Root `PRD.md` | Full product PRD (loyalty, production, payments) |

---

## 12. Summary for email / WhatsApp

> New React redesign for **Aida Counter** (POS) and **Aida Office** (Admin) is on branch `team1/aida-pos-admin-ui` / [PR #1](https://github.com/momenkhairalla-BIT/city-cafe-rewards/pull/1).  
> Run preview with sample enrol code `AIDA-482731` and logins `preview.staff` or `preview.admin` / `preview123`.  
> Full screen captures are under `apps/pos-admin-web/docs_screenshots/all-screens/`.  
> Soft payment and many admin modules are **UI preview** — sales API and live OTC are intentionally not enabled yet.
