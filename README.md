# Aida Cafe Rewards

Cafe loyalty and soft-POS platform: Team 1 customer apps and Team 2 staff POS/Admin share one Express API and Neon PostgreSQL database.

**Active development branch:** `feature/aida-cafe-production-rewire-phase3a`  
**Status:** Phases 0 → 3A complete on a temporary Neon validation branch. Production parent DB is not migrated by this workstream.

---

## Developer Onboarding

Start here:

| Document | Description |
|----------|-------------|
| **[docs/TEAMMATE_HANDOVER.md](docs/TEAMMATE_HANDOVER.md)** | Full teammate handover: architecture, security, workflows, setup, tests, contribution rules |
| **[docs/OPERATIONS_WORKFLOW.md](docs/OPERATIONS_WORKFLOW.md)** | Mermaid flows for terminal, login, shifts, sales, loyalty, reporting |
| **[docs/TEAM_INTEGRATION_CONTRACT.md](docs/TEAM_INTEGRATION_CONTRACT.md)** | Team 1 / Team 2 ownership and API boundaries |
| **[openapi.yaml](openapi.yaml)** | OpenAPI 3.1.2 contract (source of truth for request/response shapes) |
| **[docs/PHASE_3A_OPENAPI_DIFF.md](docs/PHASE_3A_OPENAPI_DIFF.md)** | Team 1 compatibility note for Phase 3A POS sales |
| **[docs/PHASE_1A_MIGRATION_VALIDATION.md](docs/PHASE_1A_MIGRATION_VALIDATION.md)** | Phase 1A validation evidence |
| **[docs/PHASE_2A_VALIDATION.md](docs/PHASE_2A_VALIDATION.md)** | Phase 2A validation evidence |
| **[docs/PHASE_2B_VALIDATION.md](docs/PHASE_2B_VALIDATION.md)** | Phase 2B validation evidence |
| **[docs/PHASE_3A_VALIDATION.md](docs/PHASE_3A_VALIDATION.md)** | Phase 3A validation evidence |
| **[production/api/.env.example](production/api/.env.example)** | API environment variable template (placeholders only) |

### Quick start (summary)

```powershell
git checkout feature/aida-cafe-production-rewire-phase3a
git pull

cd production/api
npm install
copy .env.example .env
# Configure local/disposable DATABASE_URL + JWT_SECRET only
npm run setup-db   # first time
# Apply migrations per docs/TEAMMATE_HANDOVER.md (never production)
npm run hash-passwords
npm run dev

# Separate terminal — React POS/Admin shells
cd ../../apps/pos-admin-web
npm install
npm run dev
```

Leave `ENABLE_POS_SALES` disabled unless you are on the authorised temporary validation database.

### Important rules

- Do not commit `.env` files or credentials.
- Do not migrate or deploy the production Neon parent from local experiments.
- Do not force-push shared branches.
- Prefer pull requests off feature branches.

Legacy merchant demo SPA remains at repository root (`index.html`, `js/city-cafe-v2.js`) and is served by the API.
