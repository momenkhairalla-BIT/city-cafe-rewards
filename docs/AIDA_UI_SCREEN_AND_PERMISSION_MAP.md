# Aida UI Screen & Permission Map

## Employee access

| Route | Screen | Access |
|-------|--------|--------|
| `/employee` | Welcome, terminal enrol, password/badge login | Anonymous + enrolled terminal |
| `/employee/select-role` | Dual-role product select | Dual-role admin only |
| `/unauthorized` | Denied | Any |

Post-login routing (server identity): Staff → `/pos` · Manager → `/admin` · Dual-role → select-role.

## Aida Counter (`product=pos`)

| Surface | Permission |
|---------|------------|
| Shift open/lock/resume/close | Staff or dual-role with `selectedProduct=pos` |
| Menu / cart / member / payment UI | Same; sales API not called |
| Admin navigation | **Never shown** |

Attribution: employee cookie + terminal cookie + open shift (server). No client branch dropdown.

## Aida Office (`product=admin`)

| Route | Module | Fidelity |
|-------|--------|----------|
| `/admin` | Executive dashboard | High (preview KPIs) |
| `/admin/live` | Live ops | Placeholder |
| `/admin/reports/sales` | Sales report | High (preview table) |
| `/admin/reports/transactions` | Transactions | Placeholder |
| `/admin/reports/products` | Products report | Placeholder |
| `/admin/reports/members` | Members report | Placeholder |
| `/admin/operations/branches` | Branches | Placeholder |
| `/admin/operations/terminals` | Terminals | High (preview) |
| `/admin/operations/shifts` | Shifts | High (preview) |
| `/admin/operations/employees` | Employees | High (preview) |
| `/admin/catalogue/menu` | Menu editor | High (preview) |
| `/admin/catalogue/categories` | Categories | Placeholder |
| `/admin/catalogue/variants` | Variants | Placeholder (contract pending) |
| `/admin/rewards/*` | Loyalty/stamps/offers | Placeholder except campaigns high |
| `/admin/rewards/campaigns` | App campaigns | High (integration pending) |
| `/admin/system/audit` | Audit | Placeholder |
| `/admin/system/integrations` | MyInvois / payments | High placeholder labels |
| `/admin/system/settings` | Settings | Placeholder |

POS checkout **never** appears in Admin. Empty `assignedBranchIds` ≠ global unless `isGlobalManager`.
