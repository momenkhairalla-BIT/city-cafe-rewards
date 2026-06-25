# City Café Rewards — Production (Phase 1)

Self-hosted backend on **Neon PostgreSQL** + **Node.js/Express**.  
Serves the full UI (Customer, Staff POS, Admin) from one URL.

## Quick start (local)

```powershell
cd production/api
copy .env.example .env
# Edit .env — paste Neon DATABASE_URL
npm install
npm run setup-db      # first time only
npm run migrate-v2
npm run hash-passwords
npm run dev
```

Open **http://localhost:3001**

## Deploy to live URL

See **[DEPLOY.md](./DEPLOY.md)** for full Render + Neon deployment guide.

Summary:

1. Push repo to GitHub
2. Connect **Render** → Blueprint (`render.yaml`)
3. Set `DATABASE_URL` (Neon) + `JWT_SECRET` in Render dashboard
4. Share URL with merchant

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local development |
| `npm start` | Production server (Render uses this) |
| `npm run setup-db` | Initial schema + seed |
| `npm run migrate-v2` | Members, offers, auth upgrade |
| `npm run hash-passwords` | bcrypt demo accounts |
| `npm run verify-deploy` | Check env vars before deploy |
| `npm run test:acceptance` | Full API test suite |

## Demo logins

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | Admin |
| staff | staff123 | Staff |
| CU2024001 | demo123 | Customer |
| general001 | demo123 | Customer |

## Architecture

```
Browser → Express API (Render) → Neon PostgreSQL
              ↓
         index.html + js/ (same origin)
```

All `/api/*` routes require JWT except `/api/auth/login` and `/api/auth/register`.
