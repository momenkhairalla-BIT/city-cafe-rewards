# Role & Permission Matrix — Aida Cafe Production Target

**Phase:** 0  
**Amended:** July 2026 (Phase 0 Review Amendments)  
**Purpose:** Define who can do what in the production Staff POS and Admin system, and how that differs from v1.5 today.  
**Enforcement rule:** Server-side RBAC (and branch scope) is authoritative. React routes are UX only.

---

## 1. Role model

### 1.1 Current (v1.5)

| JWT `role` | Product surface today | Notes |
|------------|----------------------|-------|
| `customer` | Customer app | Team 1; must not use employee welcome |
| `staff` | Staff POS (+ blocked from Admin by client gate) | Soft POS; **can list all members** today |
| `admin` | Admin (+ can open Staff/Customer via role switcher) | Treated as global manager without explicit flag |

Legacy DB enum may still contain `student`; application login uses `customer`.  
**All roles share** `POST /api/auth/login` today — must change.

### 1.2 Target (Team 2 production)

| Logical role | Suggested JWT / claim | Default product after login | Branch scope |
|--------------|----------------------|-----------------------------|--------------|
| Customer | `customer` | Customer App (Team 1) — **not** employee flow | Own member record only |
| Cashier / Staff | `staff` (alias: `cashier`) | **Staff POS only** | Assigned branches via **explicit** `user_branch_access` rows |
| Manager / Admin | `admin` (alias: `manager`) | **Admin Dashboard only** | Global **only if** `is_global_manager = TRUE`; otherwise only explicit access rows |
| Dual-authorized employee | `staff` + `admin` capabilities (explicit grant) | **Role-selection step** then one product | Per selected role + audit; global still requires flag |

**Product separation rules:**

- Admin navigation must never appear inside POS.
- POS checkout controls must never appear inside Admin.
- Admin may view sales reports but must not silently act as cashier without an explicit dual-role session recorded in `audit_logs`.
- Customer accounts never enter the employee authentication flow.
- **Employee accounts must not authenticate through the customer login endpoint.**

### 1.3 Global manager scope (authoritative)

| Rule | Requirement |
|------|-------------|
| Explicit flag | `users.is_global_manager` (or equivalent capability) **must be true** for cross-branch admin |
| Empty access | **Never** interpret missing/empty `user_branch_access` as global access |
| Non-global manager | Must have explicit access rows; otherwise denied |
| Current single manager | Seed `is_global_manager = TRUE` for the designated account |

---

## 2. Permission legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Allowed |
| 🔒 | Allowed only within assigned branch / sales-point scope (explicit access rows) |
| 👑 | Global (all branches) — requires `is_global_manager` |
| 📝 | Allowed as request only; requires manager approval |
| ❌ | Denied |
| — | Not applicable |

---

## 3. Authentication & session

| Action | Customer | Staff | Manager | Dual-role (after select) |
|--------|----------|-------|---------|--------------------------|
| Customer self-register | ✅ | ❌ | ❌ | ❌ |
| Customer login endpoint | ✅ | ❌ rejected | ❌ rejected | ❌ rejected |
| Employee welcome / employee login | ❌ | ✅ | ✅ | ✅ |
| Password login (correct endpoint) | ✅ customer | ✅ employee | ✅ employee | ✅ employee |
| Badge/card + PIN | ❌ | ✅ | ✅ | ✅ |
| Card-only login (no PIN) | ❌ | ❌ default | 👑 policy override only | Per policy |
| Idle screen lock | — | ✅ required | ✅ required | ✅ |
| Logout | ✅ | ✅ | ✅ | ✅ |
| Open POS product | ❌ | ✅ | ❌ unless dual-role→POS | If selected POS |
| Open Admin product | ❌ | ❌ | ✅ | If selected Admin |
| Switch product without re-auth / role select | ❌ | ❌ | ❌ | ❌ (must select + audit) |

### 3.1 Authentication claims vs operational context

| Stored in auth session / JWT | Allowed? | Notes |
|------------------------------|----------|-------|
| `sub`, `username`, `role`, `fullName` | ✅ | Stable identity |
| `selectedProduct` (`pos` \| `admin`) | ✅ | After dual-role selection; auditable |
| `is_global_manager` (or capability) | ✅ | For Admin authorization |
| `authMethod` | ✅ | `password` \| `badge_pin` \| … |
| `branchId`, `salesPointId`, `terminalId`, `shiftId` as **authoritative** long-lived claims | ❌ | Must **not** be trusted from JWT alone |
| Server-resolved terminal / location / open shift | ✅ required | Loaded from DB using enrolled terminal credential + employee session on **every** sensitive POS operation |

### 3.2 Auth channel separation

| Channel | Audience | Mechanism (target) |
|---------|----------|--------------------|
| Customer API | Team 1 mobile / customer web | Bearer JWT |
| Employee web (POS/Admin) | Team 2 | Short-lived employee session (HttpOnly Secure SameSite cookies preferred) |
| Terminal device | POS tablet | Revocable server-issued terminal credential (hash stored server-side) + employee session |

---

## 4. Location & shift

| Action | Staff | Manager | Notes |
|--------|-------|---------|-------|
| Present enrolled terminal credential | ✅ | — on POS | Required for POS bootstrap |
| Auto-select terminal’s registered location | ✅ | — (Admin not on terminal checkout) | From terminal registry (server) |
| Choose from authorized location dropdown | 🔒 | Only if dual-role POS + explicit access | Never show unauthorized; global flag does not auto-grant POS sell rights without access policy |
| Override to unauthorized branch | ❌ | ❌ | Audited management override only if explicitly designed later |
| Open / resume shift | 🔒 | ❌ on Admin; ✅ only if dual-role POS | Transactional; concurrency constraints |
| Lock shift (idle) | ✅ | — | |
| Close shift + cash variance / handover | 🔒 | View 👑 or 🔒; approve exceptional variance | See handover in branch model |
| Second active shift same terminal | ❌ | ❌ | DB enforced |
| Second active shift same employee | ❌ default | ❌ | Unless future approved policy |
| Change location while shift open | ❌ | ❌ without close or audited mgr override | |
| View all branches’ shifts | ❌ | 👑 only if `is_global_manager` | Else 🔒 |

---

## 5. Member-data permissions (authoritative)

| Action | Staff (POS) | Manager | Customer |
|--------|-------------|---------|----------|
| Limited lookup/scan by code/ID/phone/QR | ✅ min fields only | ✅ (Admin tools) | ❌ |
| Receive fields needed for checkout, loyalty, eligibility | ✅ (DTO whitelist) | ✅ | Own profile ✅ |
| List all members | ❌ | ✅ | ❌ |
| Full member profile | ❌ | ✅ | Own only ✅ |
| Complete purchase/redeem history (any member) | ❌ | ✅ | Own only ✅ |
| Create / update / deactivate members | ❌ | ✅ | Self-register only (customer) |
| Export members (CSV/Excel) | ❌ | ✅ (+ audit) | ❌ |

**POS scan response (minimum fields — illustrative whitelist):**

- Display name, member code / student id (as needed for receipt)
- `customer_type`, membership active flag
- Points, stamp progress, free drinks available
- Offer-eligibility inputs already implied by `customer_type` / flags

**Must not return to POS staff by default:** full phone/email dumps for browsing, internal notes, bulk lists, export payloads, other members’ complete histories.

---

## 6. Staff POS operations

| Action | Staff | Manager (Admin app) | Manager as dual-role POS |
|--------|-------|---------------------|--------------------------|
| Scan / limited member lookup | ✅ | Use Admin member tools | ✅ |
| Guest sale (no member) | ✅ (target P1) | ❌ | ✅ |
| Add cart items / modifiers | ✅ | ❌ | ✅ |
| Apply eligible offer | ✅ (server validates) | ❌ | ✅ |
| Manual arbitrary discount | ❌ or 📝 | Approve 👑/🔒 | 📝 / policy |
| Record soft payment method | ✅ | ❌ | ✅ |
| Checkout (create order) | ✅ (open shift + terminal credential) | ❌ | ✅ |
| Idempotent checkout replay | ✅ | — | ✅ |
| Reprint receipt | ✅ (own shift / recent) | 👑/🔒 reports | ✅ |
| Redeem voucher / free drink | ✅ | ❌ | ✅ |
| View own shift sale history | 🔒 | 👑/🔒 all in scope | 🔒 |
| Void request | 📝 | Approve | 📝 |
| Refund request | 📝 | Approve | 📝 |
| Cash adjustment | 📝 | Approve | 📝 |
| Edit menu / prices / offers | ❌ | ✅ | ❌ while in POS |
| Export CSV (members/sales) | ❌ | ✅ (+ audit) | ❌ |

---

## 7. Admin / management operations

| Action | Staff | Manager (`is_global_manager`) | Manager (branch-scoped only) |
|--------|-------|-------------------------------|------------------------------|
| Company overview KPIs | ❌ | 👑 | 🔒 |
| Filter by branch / sales point | ❌ | 👑 | 🔒 |
| Manage branches / sales points / terminals (enrol/revoke/replace) | ❌ | 👑 | 🔒 limited / ❌ create branch |
| Manage employees & `user_branch_access` / `is_global_manager` | ❌ | 👑 | 🔒 assign within branch; cannot grant global |
| Monitor shifts / cash variance | ❌ | 👑 | 🔒 |
| Member management / full history / exports | ❌ | 👑 | 🔒 or policy |
| Menu create/update/availability/images | ❌ | 👑 | 🔒 optional later |
| Offers create/update | ❌ | 👑 | 🔒 if branch offers exist |
| View transactions | ❌ | 👑 | 🔒 |
| Approve void / refund | ❌ | 👑 | 🔒 |
| View audit logs | ❌ | 👑 | 🔒 |
| Update / delete audit logs | ❌ | ❌ | ❌ |
| Data export | ❌ | 👑 (+ audit event) | 🔒 (+ audit) |
| System health | ❌ | 👑 | 🔒 read |

---

## 8. Shared Core API — resource matrix

Server must enforce the following on `/api` and `/api/v1`.

### 8.1 Auth

| Endpoint class | Customer | Staff | Manager |
|----------------|----------|-------|---------|
| `POST …/auth/login` (customer) | ✅ | ❌ 403 | ❌ 403 |
| `POST …/auth/employee/login` (target) | ❌ | ✅ | ✅ |
| `POST …/auth/register` | ✅ | ❌ | ❌ |
| `GET …/auth/me` | ✅ own | ✅ own | ✅ own |
| Rate-limited login | ✅ | ✅ | ✅ |

### 8.2 Members / scan

| Endpoint class | Customer | Staff | Manager |
|----------------|----------|-------|---------|
| Scan / limited lookup | ❌ | ✅ min DTO | ✅ |
| List all members | ❌ | ❌ | ✅ |
| Get own member profile / history | ✅ own | — | — |
| Get any full member profile / complete history | ❌ | ❌ | ✅ |
| Create / update / deactivate member | ❌ | ❌ | ✅ |
| Export members | ❌ | ❌ | ✅ |

### 8.3 Menu / offers

| Endpoint class | Customer | Staff | Manager |
|----------------|----------|-------|---------|
| Read active menu / offers | ✅ | ✅ | ✅ |
| Read inactive / admin menu | ❌ | ✅ (POS availability) | ✅ |
| Write menu / offers | ❌ | ❌ | ✅ |

### 8.4 Orders / loyalty

| Endpoint class | Customer | Staff | Manager |
|----------------|----------|-------|---------|
| Create sale | ❌ | ✅ (+ server-resolved shift/terminal) | ❌ unless dual-role POS |
| Redeem | ❌ | ✅ | ❌ unless dual-role POS |
| Read own history | ✅ | — | — |
| Read all / filtered transactions | ❌ | 🔒 own shift/today summary | 👑/🔒 |
| Void / refund approve | ❌ | 📝 request | ✅ approve |
| Loyalty balance mutate | ❌ | via sale/redeem APIs only | via approved adjustments only |

### 8.5 Operations (new)

| Endpoint class | Customer | Staff | Manager |
|----------------|----------|-------|---------|
| Terminal enrol (OTC) | ❌ | ❌ | ✅ |
| Terminal heartbeat / current context | ❌ | ✅ (valid credential) | ✅ |
| Terminal revoke / replace | ❌ | ❌ | ✅ |
| Shift open/close/lock | ❌ | ✅ | Read 👑/🔒 |
| Audit log write | — (system) | via actions | via actions |
| Audit log read | ❌ | ❌ | ✅ |
| Audit log update/delete | ❌ | ❌ | ❌ |
| Branch admin CRUD | ❌ | ❌ | ✅ |
| Analytics / exports | ❌ | limited shift summary | ✅ |

---

## 9. Mapping current code → target

| Current behavior | Target change |
|------------------|---------------|
| Shared `/api/auth/login` for all roles | Split; employees rejected on customer login |
| `requireRole('staff','admin')` on sales | Sales: POS product session + open shift + terminal credential; Admin role alone insufficient |
| Admin can call `/api/orders/sales` today | Remove silent cashiering; require dual-role POS session |
| Staff `GET /api/members` and `/api/students` list-all | Deny for staff; scan/limited lookup only |
| Client `showView` role gate | Keep UX gate; server product-scope + permissions authoritative |
| Hardcoded `CASHIER_NAME` | `orders.staff_user_id` from authenticated employee |
| No branch scope / implied global admin | Explicit `is_global_manager`; empty access ≠ global |
| Demo quick-login on UI | Production builds: disabled |

### Suggested auth claims (target — non-authoritative for location)

```text
sub, username, role, fullName,
selectedProduct: "pos" | "admin",
isGlobalManager: boolean,
authMethod: "password" | "badge_pin" | ...
```

Operational context (`branchId`, `salesPointId`, `terminalId`, `shiftId`) is returned from server context endpoints for UI display only and **re-validated from DB** on each sensitive mutation.

---

## 10. Audit requirements by sensitive action

Every row below must create an **append-only** `audit_logs` entry.

| Action | Required |
|--------|----------|
| Login / logout | ✅ |
| Role product selection (dual-role) | ✅ |
| Terminal enrol / revoke / replace | ✅ |
| Location select / override | ✅ |
| Shift open / resume / lock / close / handover | ✅ |
| Member scan (operational trace; minimize PII) | ✅ |
| Sale create | ✅ |
| Offer / discount applied | ✅ |
| Redemption | ✅ |
| Receipt reprint | ✅ |
| Void / refund request & approval | ✅ |
| Cash adjustment | ✅ |
| Menu / price / offer change | ✅ |
| Employee / permission / `is_global_manager` change | ✅ |
| Export | ✅ |

**Immutability:** Normal application routes and the application database role must not `UPDATE` or `DELETE` audit records. No UI to edit/delete audit history.  
**Secrets:** Never record passwords, PINs, raw badge values, terminal secrets, JWTs, or unnecessary personal data.

---

## 11. Future branch manager (prepared, not in first UI)

| Capability | Global manager (`is_global_manager`) | Branch manager (future) |
|------------|--------------------------------------|-------------------------|
| See all branches | ✅ | ❌ |
| See assigned branches | ✅ | ✅ (explicit rows) |
| Approve voids in other branches | ✅ | ❌ |
| Assign employees outside branch | ✅ | ❌ |
| Grant `is_global_manager` | ✅ (careful) | ❌ |
| Schema support | flag + `user_branch_access` | Same tables |

Do not expose branch-manager complexity in the first Admin UI; keep checks in server helpers so the UI can narrow later without a schema rewrite.

---

## 12. Team ownership interaction

| Topic | Rule |
|-------|------|
| Customer role permissions | Team 1; own profile/history/rewards; no sale/redeem mutate |
| Staff redemption | Staff-controlled via Team 2 POS APIs |
| Shared domains (members/menu/offers/loyalty/orders) | Joint OpenAPI approval for contract changes |
| Neither team | May create a separate loyalty or order source of truth |
| Permission changes affecting customer APIs | Version via `/api/v1` + contract notice |

---

## 13. Acceptance checks (permissions)

1. Staff JWT/session cannot access Admin routes or admin-only APIs.  
2. Manager cannot create sales without an explicit dual-role POS session.  
3. Customer token cannot call scan, sales, redeem, or admin APIs.  
4. **Employee authentication via customer login returns 403.**  
5. Staff location list contains only authorized IDs from explicit access (+ terminal rules).  
6. Checkout without open shift / valid terminal credential returns `403` with stable error code.  
7. **Staff cannot list or export all members; scan returns min fields only.**  
8. Empty `user_branch_access` without `is_global_manager` grants **no** global access.  
9. Audit log APIs reject UPDATE/DELETE for all roles.  
10. Sensitive POS ops ignore client-supplied branch/shift IDs unless they match server-resolved context.

---

## Phase 0 Review Amendments

| # | Correction |
|---|------------|
| 1 | Terminal credential + enrolment permissions; fingerprint not an auth factor. |
| 2 | Auth claims limited to identity/role; location/shift server-resolved; employee ≠ customer Bearer. |
| 3 | Staff member list/export/full history denied; scan min-field DTO; employees blocked from customer login. |
| 4 | `is_global_manager` mandatory for global scope; empty access ≠ global. |
| 5 | Shift concurrency permission rules aligned with DB constraints. |
| 6 | Idempotent checkout noted under POS ops (detail in migration/branch docs). |
| 7 | Audit immutability + secret exclusion strengthened. |
| 8 | Rate-limited login called out in auth matrix (P0). |
| 9 | Team ownership interaction section aligned with single API/SOR + joint shared-domain approval. |

---

*End of Role & Permission Matrix — Phase 0 (amended)*
