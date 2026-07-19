# Aida UI ↔ API Capability Matrix

Legend:

- **Connected** — UI calls live endpoint
- **Flagged** — Implemented behind feature flag
- **Preview** — UI only / fixtures
- **Blocked** — Awaiting Team 2 modifier contract
- **Future** — Not in scope yet

| UI action | Capability |
|-----------|------------|
| Terminal enrol / status / clear | Connected |
| Employee password / badge login | Connected |
| Employee session / logout / product-select | Connected |
| Idle reauthentication | Connected |
| Shift open / current / lock / resume / close | Connected |
| POS context (branch/SP/terminal from server) | Connected |
| Menu browse (Counter gallery) | Preview |
| Modifier selection | Blocked (UI concept) |
| Member scan / rewards panel | Preview |
| Soft payment / receipt | Preview (does **not** call `POST /api/v1/pos/sales`) |
| POS sales API | Flagged (`ENABLE_POS_SALES`; UI does not enable) |
| Admin overview KPIs / charts | Preview |
| Admin sales / transactions reports | Preview |
| Admin terminals list + OTC modal | Preview UI; enrol-code API Connected when wired to live |
| Admin shifts monitoring | Preview |
| Admin employees list | Preview |
| Admin menu editor save/publish | Preview |
| Variants / modifier groups save | Blocked |
| Offers / loyalty rule publish | Preview |
| App campaigns publish | Preview (integration pending) |
| Audit log read | Preview |
| MyInvois | Future / pending business decision |
| Report CSV export | Preview (disabled control) |
| Void / refund approval | Future |
