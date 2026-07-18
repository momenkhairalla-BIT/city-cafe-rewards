# Aida Cafe — POS & Admin Web (`apps/pos-admin-web`)

Phase 1A foundation: Vite + React + TypeScript (strict) route shells for employee / POS / Admin.

## Scripts

```powershell
npm install
npm run typecheck
npm test
npm run build
npm run dev
```

## Employee auth (fail closed)

- **Production builds** always enforce employee session checks. Unauthenticated users are sent to `/unauthorized`.
- Employee login is **not** implemented yet (Phase 2) — production shells therefore deny access until a verified session exists.
- **Local demo bypass only:** run with `VITE_ALLOW_AUTH_BYPASS=true` **and** `npm run dev` (Vite DEV mode).
- Setting `VITE_ALLOW_AUTH_BYPASS=true` for `npm run build` **fails the build**.
- Employee tokens are never stored in `localStorage`.

```powershell
# Local structural shell preview
$env:VITE_ALLOW_AUTH_BYPASS = "true"
npm run dev
```

## Product separation

- POS and Admin use separate layouts; do not mix navigation/checkout.
