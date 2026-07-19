# Aida Report Catalogue

All figures in the current React UI are **preview/sample** unless an Implemented API repository is wired. Metric definitions below describe the intended production meaning.

| # | Report | Status | Filters (intended) | Notes |
|---|--------|--------|--------------------|-------|
| 1 | Daily sales summary | UI preview | Date, branch, sales point | Net ≠ gross ≠ cash |
| 2 | Weekly / monthly sales | UI preview | Period, branch | Comparison period labelled |
| 3 | Branch comparison | UI preview | Date range | Main Cafe rollup |
| 4 | Sales-point comparison | UI preview | Main Counter vs Snack Station | Shared inventory |
| 5 | Hourly / peak demand | UI preview | Day | Chart + table |
| 6 | Transaction / receipt lookup | UI preview | Order #, staff, terminal | Soft POS methods |
| 7 | Sales by item / category / variant | Partial preview | Category | Variants blocked on contract |
| 8 | Best / low sellers | UI preview | Period | |
| 9 | Payment method / reconciliation | UI preview | Method | No card PAN |
| 10 | Discounts / offers / student offers | UI preview | Offer | Server eligibility later |
| 11 | Member vs guest sales | UI preview | | |
| 12 | Points issued / redeemed | UI preview | | No client loyalty math |
| 13 | Stamp rewards | UI preview | | |
| 14 | Voucher liability / expiry | Future | | API pending |
| 15 | Shift float / expected / actual / variance | UI preview + live shift APIs for own shift | | |
| 16 | Sales by employee / terminal | UI preview | Permission-scoped | |
| 17 | Voids / refunds | Future UI | | Approval flow not built |
| 18 | Menu sold-out events | UI preview | | |
| 19 | Inventory / wastage | Future | | Only if inventory contract |
| 20 | Terminal health / heartbeat | UI preview | | Enrol/revoke API exists for ops |
| 21 | Audit events | UI preview placeholder | | Append-only server logs |

**Exports:** CSV/XLSX/PDF controls shown **disabled** with “API pending” until secure export endpoints exist.
