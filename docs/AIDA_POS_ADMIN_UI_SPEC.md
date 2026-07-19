# Aida POS & Admin UI Spec (React)

**Branch:** `team1/aida-pos-admin-ui`  
**App:** `apps/pos-admin-web`  
**Base:** Phase 3A (`feature/aida-cafe-production-rewire-phase3a` @ `da59fb6`)

## Products

| Product | Route root | Audience |
|---------|------------|----------|
| **Aida Counter** | `/pos` | Staff (+ dual-role when selected) |
| **Aida Office** | `/admin` | Managers / admins |

Shared identity: **Aida Signature** CSS tokens in `src/styles/tokens.css`.

## Design system

Palette: Ivory `#FFF9F6`, Cream `#F6ECE6`, Surface `#FFFCFA`, Espresso `#2C171B`, Burgundy `#541A28`, Rose `#C92F50`, Floral Pink `#DE8D9D`, Blush `#F4D4DB`, Gold `#C8A345`, Taupe `#9A7F7A`, Success/Warning/Error.

Typography: Playfair Display (headings) + Plus Jakarta Sans (UI) — existing brand fonts from `index.html`.

Rules: gold accent-only; 48px primary POS targets; WCAG-oriented contrast; `prefers-reduced-motion` respected; no emoji icons.

## Security (preserved)

- Cookie sessions with `credentials: 'include'`
- No terminal/employee secrets in localStorage
- Server-resolved role, terminal, branch, sales point, shift
- Empty branch access ≠ global; `isGlobalManager` explicit
- `VITE_ALLOW_AUTH_BYPASS` and `VITE_UI_PREVIEW_MODE` fail closed in production builds

## OpenAPI conflicts / constraints

| Topic | Resolution |
|-------|------------|
| Variants/modifiers | UI-concept models only; labelled pending Team 2 contract; not submitted to API |
| `POST /api/v1/pos/sales` | Not called from UI; payment panel is preview-only (`ENABLE_POS_SALES` stays off) |
| Campaigns / MyInvois / many reports | Preview repositories or placeholders — no invented production endpoints |

## POS information architecture

Three-zone workspace when shift is **open**: Aida Rail · Menu Gallery · Order Ribbon.  
Shift open/lock/resume/close remain server-backed via existing `/api/v1/shifts/*`.

## Admin information architecture

Grouped nav: Overview, Reports, Operations, Catalogue, Rewards, System.  
No checkout controls in Admin.

## Preview mode

`VITE_UI_PREVIEW_MODE=true` (dev only) shows sample Admin/POS fixture data with banner `UI PREVIEW — SAMPLE DATA`. Checkout is preview-disabled even when the flag is off.
