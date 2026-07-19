# Aida React UI Validation

**Branch:** `team1/aida-pos-admin-ui`  
**Date:** 2026-07-19 (updated — preview terminal activation)

## Ownership

Team 1 = React POS/Admin UI only. No migrations, API edits, Neon access, or live OTC generation.

## Preview terminal activation

With `VITE_UI_PREVIEW_MODE=true` (default in `.env.development`):

1. Open http://localhost:5173/employee  
2. Banner: **UI PREVIEW — SAMPLE DATA**  
3. Enrolment code: **`AIDA-482731`**  
4. Binds to Main Café · Main Counter · POS-MAIN-01  
5. Demo logins (not production auth):
   - Admin: `preview.admin` / `preview123` → Office  
   - Staff: `preview.staff` / `preview123` → Counter  
   - Dual: `preview.dual` / `preview123` → role select  

Simulated: invalid, expired (`AIDA-EXPIRED` / Simulate expiry), single-use, success.

See `docs/AIDA_UI_BACKEND_BENCHMARK.md` for Team 2 live API expectations.

## Commands

```powershell
cd apps/pos-admin-web
npm run typecheck
npm test
npm run build
```

Production build must fail if `VITE_UI_PREVIEW_MODE=true`.

## Screenshots

Capture to `apps/pos-admin-web/docs_screenshots/`:

| File | View |
|------|------|
| `terminal-enrol-preview.png` | Enrolment with sample code + banner |
| `pos-1366.png` | Counter after staff login + open shift |
| `admin-overview-1440.png` | Office overview after admin login |
