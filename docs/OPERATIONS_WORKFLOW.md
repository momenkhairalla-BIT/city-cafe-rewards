# Aida Cafe — Operations Workflow

Detailed flows for implemented Phase 1A–3A behaviour.  
**Planned** steps are labelled explicitly and must not be treated as live.

Companion: [TEAMMATE_HANDOVER.md](./TEAMMATE_HANDOVER.md)

---

## 1. Terminal enrolment

**Implemented.**

```mermaid
sequenceDiagram
  actor Mgr as Manager Admin session
  participant API as Express /api/v1
  participant DB as PostgreSQL
  actor Dev as Device browser

  Mgr->>API: POST /terminals/{id}/enrolment-codes<br/>(employee cookie + CSRF)
  API->>DB: Store OTC hash, expiry
  API-->>Mgr: enrolmentCode once
  Note over Mgr: Deliver code out-of-band<br/>(never log secrets)
  Dev->>API: POST /terminals/enrol { enrolmentCode }
  API->>DB: Consume OTC, store credential hash
  API-->>Dev: Set-Cookie HttpOnly terminal<br/>JSON without secret
  Dev->>API: GET /terminals/status (credentials include)
  API-->>Dev: enrolled + location
```

| Step | Status |
|------|--------|
| Manager issues OTC | Implemented |
| Device exchanges OTC for HttpOnly cookie | Implemented |
| Fingerprint alone authenticates | **Rejected** (telemetry only) |
| Device generates its own code | **Not allowed** |

---

## 2. Employee login and role routing

**Implemented** (React + API).

```mermaid
flowchart TD
  A[GET /employee] --> B{Terminal cookie valid?}
  B -->|No| C[Terminal activation UI]
  C --> B
  B -->|Yes| D[Password or Badge+PIN login]
  D --> E[POST /auth/employee/login or /login/badge]
  E --> F[HttpOnly employee session cookie]
  F --> G{Role / dual-role?}
  G -->|staff| H["/pos"]
  G -->|admin no dual-role| I["/admin"]
  G -->|dual_role_pos_enabled| J["/employee/select-role"]
  J --> K[POST /auth/employee/product-select]
  K -->|pos| H
  K -->|admin| I
```

| Path | Status |
|------|--------|
| Cookie session + CSRF Origin | Implemented |
| Dual-role audited product select | Implemented |
| Legacy SPA `legacy-login` (feature flag) | Implemented (deprecated Phase 5) |
| Customer Bearer for employee routes | **Denied** |

---

## 3. Shift lifecycle

**Implemented.**

```mermaid
stateDiagram-v2
  [*] --> None: No active shift
  None --> Open: POST /shifts/open<br/>+ terminal cookie
  Open --> Locked: POST /shifts/{id}/lock
  Locked --> Open: POST /shifts/{id}/resume<br/>(same employee)
  Open --> Closed: POST /shifts/{id}/close
  Locked --> Closed: POST /shifts/{id}/close
  Closed --> [*]
```

| Rule | Status |
|------|--------|
| Location from terminal only | Implemented |
| Client `branchId` spoof rejected | Implemented |
| One active shift per employee / terminal | Implemented |
| Sales require `status === open` | Implemented (Phase 3A) |
| Expected closing cash ≈ float + cash sales | Implemented (shift summary fields) |

---

## 4. Member / guest sale transaction

**API implemented** (`POST /api/v1/pos/sales`).  
**React cart/checkout UI: not implemented** (Phase 3B).

```mermaid
sequenceDiagram
  participant Client as POS client<br/>(API test / future React)
  participant API as /api/v1/pos/sales
  participant DB as PostgreSQL

  Client->>API: Idempotency-Key + business body<br/>(menuItemId, qty, optional member/offer)
  Note over Client,API: No unitPrice / totals / branch / shift
  API->>API: Employee cookie + terminal + CSRF<br/>+ ENABLE_POS_SALES=1 + open shift
  API->>DB: BEGIN
  API->>DB: Idempotency lookup FOR UPDATE
  alt Same key + same hash
    DB-->>API: Existing order
    API-->>Client: 200 replay
  else Same key + different hash
    API-->>Client: 409 IDEMPOTENCY_KEY_REUSED
  else New sale
    API->>DB: Lock shift + member FOR UPDATE
    API->>DB: Load menu_items prices
    API->>DB: Revalidate offer / voucher
    API->>DB: Insert order + item snapshots
    API->>DB: Loyalty if member
    API->>DB: Update shift cash totals
    API->>DB: Audit pos.sale_created
    API->>DB: COMMIT
    API-->>Client: 201 created
  end
```

| Sale type | Behaviour | Status |
|-----------|-----------|--------|
| Member | Loyalty via shared `loyalty.js` | Implemented |
| Guest | `student_id` null; no loyalty | Implemented |
| Soft payment methods | Cash / Card / E-wallet / Student Wallet recorded | Implemented |
| Gateway settlement | — | **Planned / out of scope** |
| React checkout UI | — | **Planned Phase 3B** |

---

## 5. Loyalty, idempotency and audit (one transaction)

**Implemented** for POS sales path.

```mermaid
flowchart LR
  subgraph txn [Single DB transaction]
    A[Validate session/shift/terminal]
    B[Lock member row if any]
    C[Price from menu_items]
    D[Offer / voucher rules]
    E[Insert order + items]
    F[Update points/stamps]
    G[Shift aggregates]
    H[Append audit_logs]
  end
  A --> B --> C --> D --> E --> F --> G --> H
  H -->|any failure| R[ROLLBACK all]
```

| Concern | Status |
|---------|--------|
| No partial order/loyalty/audit | Implemented |
| Concurrent same idempotency key → one order | Implemented |
| Order number via `order_number_seq` | Implemented |
| `audit_logs` UPDATE/DELETE blocked | Implemented |

---

## 6. Branch and Snack Station reporting

**Attribution implemented; rich Admin reporting UI planned.**

```mermaid
flowchart TB
  subgraph cafe [Main Cafe BR-MAIN]
    SP1[SP-MAIN Main Counter<br/>POS-MAIN-01]
    SP2[SP-SNACK Level 2<br/>POS-SNACK-01]
    INV[Shared inventory location]
  end
  SP1 --> ORD1[Orders attributed<br/>sales_point_id = SP-MAIN]
  SP2 --> ORD2[Orders attributed<br/>sales_point_id = SP-SNACK]
  ORD1 --> RPT[Branch rollup BR-MAIN]
  ORD2 --> RPT
  INV -.-> SP1
  INV -.-> SP2
```

| Capability | Status |
|------------|--------|
| Sale stores `branch_id` + `sales_point_id` from terminal | Implemented |
| Snack Station filterable vs Main Counter | Data model ready |
| Consolidated Main Cafe reporting | Data model ready; Admin UI modules **planned** |
| Client-supplied location overrides | **Rejected** |

---

## Planned (not implemented)

| Area | Notes |
|------|--------|
| React POS cart / checkout | Call existing `/api/v1/pos/sales` |
| Void / refund with approval | New endpoints + audit |
| Payment gateway / terminal SDK | Soft POS recording only today |
| Offline queue | Fail closed; retry with same Idempotency-Key |
| Full Admin modules | Shells + placeholders only |
| Menu modifiers | Rejected until schema exists |

---

## Quick reference — key endpoints

| Flow | Method + path |
|------|----------------|
| Issue OTC | `POST /api/v1/terminals/:terminalId/enrolment-codes` |
| Enrol device | `POST /api/v1/terminals/enrol` |
| Terminal probe | `GET /api/v1/terminals/status` |
| Employee login | `POST /api/v1/auth/employee/login` |
| Product select | `POST /api/v1/auth/employee/product-select` |
| Open shift | `POST /api/v1/shifts/open` |
| POS sale | `POST /api/v1/pos/sales` |
| Lock / resume / close | `POST /api/v1/shifts/:id/lock\|resume\|close` |

Full schemas: [../openapi.yaml](../openapi.yaml).
