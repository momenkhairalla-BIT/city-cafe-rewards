# PRD.md — City Café Rewards Prototype

## 1. Product Name

**City Café Rewards**  
**Subtitle:** City University Malaysia Café Loyalty System

## 2. Product Overview

City Café Rewards is a frontend-only interactive prototype for a university café loyalty system. The system simulates how students, café counter staff, and café administrators interact with one shared loyalty database.

The prototype is designed for presentation and demonstration purposes. It does not require a backend, database server, authentication, or external APIs. All data is simulated using JavaScript objects, arrays, and `localStorage`.

The main goal is to demonstrate a realistic café loyalty workflow where:

1. A student shows or scans their student QR/ID.
2. The staff retrieves the student profile.
3. The staff records the purchase after payment.
4. The system awards points based on purchase amount.
5. The system tracks stamp progress.
6. Every 10 purchases unlocks 1 free drink.
7. Admin can monitor students, sales, transactions, points, rewards, and system rules.

## 3. Project Purpose

The university requested a café application prototype that can show how a student loyalty system may work in a real café environment. The prototype should be close to a real system structure by including three separate interfaces:

1. **Customer / Student App** — for students to view points, QR, rewards, history, and profile.
2. **Staff Counter App** — for café staff to scan students, record purchases, and redeem rewards.
3. **Admin / Owner Dashboard** — for management to view analytics, manage students, transactions, menu, reward rules, and SOP.

## 4. Target Users

### 4.1 Customer / Student

The student uses the app to:

- View total points.
- View free drink progress.
- Show QR code or student ID to café staff.
- View available rewards.
- Request redemption at the counter.
- View transaction history.
- View membership profile.

The student must not be able to manually add points, record purchases, or redeem rewards directly without staff confirmation.

### 4.2 Staff / Café Counter

The staff uses the counter interface to:

- Scan or enter student ID.
- Fetch student profile.
- Record purchases after payment.
- Add points automatically based on purchase amount.
- Add stamp progress.
- Redeem points-based rewards.
- Redeem free drink rewards.
- View today’s transactions.

### 4.3 Admin / Owner

The admin or café owner uses the dashboard to:

- View overall system analytics.
- Monitor total sales, transactions, points, and rewards.
- Search and manage student records.
- Review transaction history.
- Export transaction records as CSV.
- Manage menu prices.
- Manage reward point requirements.
- View SOP.
- Reset or reload demo data for presentation.

## 5. Product Scope

### In Scope

- Frontend-only prototype.
- One `index.html` file containing HTML, CSS, and JavaScript.
- Role selection screen.
- Customer interface.
- Staff interface.
- Admin dashboard.
- Simulated shared database using `localStorage`.
- Demo students.
- Menu items.
- Points calculation.
- Stamp progress.
- Free drink reward after 10 purchases.
- Voucher redemption simulation.
- Transaction history.
- Admin analytics.
- CSV export.
- Reset demo data.
- Responsive design.

### Out of Scope

- Real backend database.
- Real student database integration.
- Real QR camera scanning.
- Payment gateway integration.
- Real authentication.
- POS system integration.
- Real email notification.
- Native mobile app deployment.

## 6. System Concept

The prototype should simulate a real system with three connected interfaces:

```text
Customer / Student App  ---> Shared Database & API
Staff Counter App       ---> Shared Database & API
Admin / Owner Dashboard ---> Shared Database & API
```

In the prototype, the shared database and API are simulated using JavaScript and browser `localStorage`.

When the staff records a purchase, the customer app and admin dashboard should show updated data after switching roles or refreshing the page.

## 7. Main Entry Screen Requirements

The first screen should allow the presenter to choose the role/interface.

### Role Cards

#### Customer

- Description: `Phone · view points`
- Button: `Open Customer App`

#### Staff Counter

- Description: `Tablet · record sales`
- Button: `Open Staff App`

#### Admin / Owner

- Description: `Desktop · dashboard`
- Button: `Open Admin Dashboard`

### Entry Screen Notes

Show this note:

> Currently simulated in JavaScript using localStorage.

Also show a simple system diagram showing the relationship between the three interfaces and the shared database.

## 8. Shared Simulated Database

The prototype must create a demo student database with these students:

| Name | Student ID | Programme | Email |
|---|---|---|---|
| Ahmad Faiz | CU2024001 | Bachelor of IT | ahmad.faiz@student.city.edu.my |
| Sarah Lim | CU2024002 | Diploma in Business | sarah.lim@student.city.edu.my |
| Kumar Raj | CU2024003 | Bachelor of Computer Science | kumar.raj@student.city.edu.my |
| Nur Aina | CU2024004 | Diploma in IT | nur.aina@student.city.edu.my |
| Moimen Ali | CU2024005 | Master of IT | moimen.ali@student.city.edu.my |

Each student should include:

- `name`
- `studentId`
- `programme`
- `email`
- `points`
- `totalPurchases`
- `currentStampProgress`
- `freeDrinksAvailable`
- `membershipStatus`
- `transactionHistory`

## 9. Loyalty Rules

### Points Rule

- Every RM 1 spent gives 1 point.
- Example: RM 8 purchase gives 8 points.

### Stamp Rule

- Every completed purchase adds 1 stamp.
- Every 10 purchases unlocks 1 free drink.
- When the free drink is unlocked, `currentStampProgress` resets to 0.
- The system should increase `freeDrinksAvailable` by 1.

### Reward Redemption Rule

- Students can redeem vouchers using points.
- Redemption must be completed by staff, not directly by student.
- Staff must validate that the student has enough points or free drinks available.
- All redemptions must be recorded in transaction history.

## 10. Menu Items

| Item | Price |
|---|---:|
| Latte | RM 8 |
| Americano | RM 6 |
| Cappuccino | RM 9 |
| Iced Coffee | RM 7 |
| Matcha Latte | RM 10 |
| Sandwich | RM 12 |
| Croissant | RM 6 |

## 11. Voucher Rewards

| Reward | Points Required |
|---|---:|
| RM 5 Voucher | 100 points |
| RM 10 Voucher | 180 points |
| Free Pastry | 150 points |

## 12. Interface 1 — Customer / Student App

### Purpose

The customer/student app should look like a mobile app. It is for viewing information only. The student cannot add purchases or increase points.

### Navigation

Use bottom navigation with these screens:

1. Home
2. My QR
3. Rewards
4. History
5. Profile

### Customer Home

Show:

- Greeting: `Hi, [Student Name]`
- Total points
- Available free drinks
- Stamp progress: `X / 10 purchases`
- Progress bar
- Message: `Buy 10 times and get 1 free drink`
- Recent transaction summary
- Pink/black membership card

### My QR Screen

Show:

- Student profile card
- Simulated QR code box using CSS
- Student ID below QR code
- Instruction: `Show this QR code to the café staff before payment.`
- Button to copy student ID

### Rewards Screen

Show:

- Points balance
- Reward cards:
  - RM 5 voucher = 100 points
  - RM 10 voucher = 180 points
  - Free pastry = 150 points

Customer can click `Request Redeem`, but this should only show a message:

> Please show this reward to the café counter staff to complete redemption.

Points should not be deducted from the customer side.

### History Screen

Show transaction history for the selected student.

Each item should include:

- Date/time
- Type
- Item or reward
- Amount
- Points earned or used

### Profile Screen

Show:

- Name
- Student ID
- Programme
- Email
- Membership status

Also include a `Switch Student Demo` dropdown so the presenter can simulate different students.

### Empty State

If no student is selected, show a student selector with demo student buttons.

## 13. Interface 2 — Staff Counter App

### Purpose

The staff counter app should look like a tablet/counter interface. Staff use it to scan students, record purchases, and redeem rewards.

### Staff Screens

1. Scan Student
2. Record Purchase
3. Redeem
4. Today Transactions

### Scan Student Screen

Show:

- Fake QR scanner box with animated scan line
- Input field: `Enter Student ID`
- Quick demo buttons for students
- Button: `Scan / Fetch Student`

After scanning, show:

- Student name
- Student ID
- Programme
- Email
- Current points
- Stamp progress
- Free drinks available

### Record Purchase Screen

Requirements:

- Must require scanned student first.
- Show selected student card.
- Show menu item cards with prices.
- Staff can select one or more items.
- Show cart summary.
- Allow custom purchase amount.
- Button: `Confirm Purchase`.

On confirm:

- Add points based on total RM.
- Add 1 stamp/purchase count.
- If stamp reaches 10, add 1 free drink and reset stamp progress.
- Add transaction history.
- Show toast: `Purchase recorded successfully`.
- Show receipt-style confirmation after purchase.

### Redeem Screen

Requirements:

- Must require scanned student first.
- Show student points and free drinks.
- Staff can redeem:
  - RM 5 voucher for 100 points
  - RM 10 voucher for 180 points
  - Free pastry for 150 points
  - Free drink if `freeDrinksAvailable > 0`

The system must:

- Validate balance before redemption.
- Deduct points or free drink count correctly.
- Add transaction history.
- Show success or error toast.

### Today Transactions Screen

Show all transactions from all students.

Filters:

- Purchases
- Rewards
- Free Drinks

Show:

- Total sales today
- Total points issued today
- Total redemptions today

## 14. Interface 3 — Admin / Owner Dashboard

### Purpose

The admin dashboard should look like a desktop dashboard. It is for management, analytics, records, and rules.

### Layout

Use desktop dashboard layout with sidebar.

Sidebar items:

1. Overview
2. Students
3. Transactions
4. Menu & Rewards
5. SOP
6. Prototype Settings

### Overview Screen

Show KPI cards:

- Total students
- Total sales
- Total transactions
- Total points issued
- Total rewards redeemed
- Free drinks issued
- Active members

Add simple charts using CSS/HTML only, no external libraries:

- Top selling items bar chart
- Points issued chart
- Transaction type distribution

### Students Screen

Show table with all students:

- Name
- Student ID
- Programme
- Points
- Purchases
- Free drinks
- Membership status

Features:

- Search by name or student ID
- View student details
- Student detail modal/card with profile and history
- Add new demo student
- Edit points manually for prototype purposes
- Reset a student’s points and purchases

### Transactions Screen

Show table of all transactions.

Filters:

- Student
- Type
- Date

Columns:

- Date/time
- Student
- Type
- Item
- Amount
- Points
- Staff action

Feature:

- Export CSV button that downloads transactions as CSV

### Menu & Rewards Screen

Show:

- Menu item management section
- Reward/voucher management section

Admin can:

- Edit item price in prototype
- Edit points required for vouchers
- Save changes in `localStorage`

### SOP Screen

Show the complete café loyalty SOP in professional card layout:

1. Student shows QR code or student ID at café counter.
2. Staff scans or enters student ID.
3. System verifies student information from the student database.
4. Staff records purchase after payment.
5. System calculates points based on purchase amount.
6. System adds one stamp for each purchase.
7. Every 10 purchases unlocks one free drink.
8. Staff can redeem points or free drink when requested.
9. All actions are saved in transaction history.
10. Admin reviews analytics and manages loyalty rules.

### Prototype Settings Screen

Show:

- Reset all demo data button
- Clear transaction history button
- Load sample transactions button
- Note: `This prototype uses localStorage to simulate a real shared database.`

Future development section:

- Connect to real student database
- Connect to POS system
- Add staff login
- Add admin authentication
- Add QR scanner camera support
- Add reporting dashboard
- Add API and backend database

## 15. UI and Branding Requirements

### Theme

- Pink, black, white, and soft grey.
- Suitable for City University Malaysia café.
- Modern mobile app and dashboard style.
- Rounded cards.
- Soft shadows.
- Smooth transitions.
- Clean spacing.
- Professional visual hierarchy.

### Colors

| Color Name | Hex |
|---|---|
| Black | `#0B0B0D` |
| Pink | `#E91E63` |
| Soft Pink | `#FCE4EC` |
| White | `#FFFFFF` |
| Light Grey | `#F4F4F4` |
| Dark Grey | `#333333` |

### Interface Styling

- Customer interface should be mobile phone style.
- Staff interface should be tablet/counter style.
- Admin interface should be desktop dashboard style.
- Pink should highlight active role and active navigation.
- Black headers and pink accent buttons should be used.

## 16. General UX Requirements

The prototype must include:

- Role switcher at the top of every interface.
- Role switching without deleting data.
- Shared data through `localStorage`.
- Toast notifications.
- Empty states.
- Validation messages.
- Functional buttons.
- Polished interactions.
- Code comments explaining key sections.

## 17. Demo Testing Flow

Use this flow during presentation:

1. Open `index.html` in browser.
2. Select `Staff Counter`.
3. Scan student `CU2024001`.
4. Record a purchase.
5. Switch to `Customer` and see points updated.
6. Open `Rewards` to view stamp progress.
7. Switch back to `Staff Counter` and redeem a reward if available.
8. Switch to `Admin / Owner`.
9. View analytics and transactions.
10. Export CSV or reset demo data if needed.

## 18. Acceptance Criteria

The prototype is accepted when:

- One `index.html` file is created.
- It includes HTML, CSS, and JavaScript in the same file.
- It has a main role selection screen.
- It has three working interfaces: Customer, Staff, and Admin.
- All interfaces share data using `localStorage`.
- Staff can scan demo students.
- Staff can record purchases.
- Points are calculated correctly.
- Stamp progress works correctly.
- Every 10 purchases unlocks 1 free drink.
- Staff can redeem points-based rewards.
- Customer can view updated points and history.
- Admin can view updated analytics and transactions.
- Admin can edit menu and reward rules.
- The UI uses pink and black branding.
- The prototype is polished and presentation-ready.

## 19. Cursor Implementation Prompt

Copy the prompt below into Cursor Chat or Composer to generate the complete prototype.

```text
Create a complete frontend-only prototype for a university café loyalty system called City Café Rewards.

The prototype is for City University Malaysia café. It should simulate a real system with 3 different interfaces:

1. Customer / Student App
2. Staff Counter App
3. Admin / Owner Dashboard

Use only HTML, CSS, and JavaScript. Create everything inside one file called index.html. No backend is needed. Use JavaScript objects, arrays, and localStorage to simulate a shared database and API.

The final result must be presentation-ready, polished, clickable, and realistic.

Theme:
- Pink, black, white, and soft grey
- Suitable for City University Malaysia café
- Modern mobile app and dashboard style
- Rounded cards, soft shadows, clean spacing, smooth transitions

Branding:
App Name: City Café Rewards
Subtitle: City University Malaysia Café Loyalty System
Text branding: City University Malaysia Café
Do not use real City University logo unless an image is provided.

Colors:
Black: #0B0B0D
Pink: #E91E63
Soft Pink: #FCE4EC
White: #FFFFFF
Light Grey: #F4F4F4
Dark Grey: #333333

--------------------------------------------------
MAIN ENTRY SCREEN
--------------------------------------------------

Create a first screen where the presenter can choose one of three roles:

1. Customer
Description: Phone · view points
Button: Open Customer App

2. Staff Counter
Description: Tablet · record sales
Button: Open Staff App

3. Admin / Owner
Description: Desktop · dashboard
Button: Open Admin Dashboard

Also show a small system diagram:

Customer → Shared Database & API
Staff Counter → Shared Database & API
Admin Dashboard → Shared Database & API

Add note:
“Currently simulated in JavaScript using localStorage.”

All three interfaces must use the same shared localStorage data. When staff records a purchase, the customer app and admin dashboard should show the updated data after refresh or role switch.

--------------------------------------------------
SHARED SIMULATED DATABASE
--------------------------------------------------

Create demo student database with these students:

1. Ahmad Faiz
Student ID: CU2024001
Programme: Bachelor of IT
Email: ahmad.faiz@student.city.edu.my

2. Sarah Lim
Student ID: CU2024002
Programme: Diploma in Business
Email: sarah.lim@student.city.edu.my

3. Kumar Raj
Student ID: CU2024003
Programme: Bachelor of Computer Science
Email: kumar.raj@student.city.edu.my

4. Nur Aina
Student ID: CU2024004
Programme: Diploma in IT
Email: nur.aina@student.city.edu.my

5. Moimen Ali
Student ID: CU2024005
Programme: Master of IT
Email: moimen.ali@student.city.edu.my

Each student should have:
- name
- studentId
- programme
- email
- points
- totalPurchases
- currentStampProgress
- freeDrinksAvailable
- membershipStatus
- transactionHistory

Rules:
- 1 RM = 1 point
- Every purchase adds 1 stamp
- Every 10 purchases unlocks 1 free drink
- When free drink is unlocked, currentStampProgress resets to 0
- Student can redeem vouchers using points
- Staff can redeem free drink for student
- All actions must be recorded in transaction history

Menu items:
- Latte RM 8
- Americano RM 6
- Cappuccino RM 9
- Iced Coffee RM 7
- Matcha Latte RM 10
- Sandwich RM 12
- Croissant RM 6

Voucher rewards:
- RM 5 voucher = 100 points
- RM 10 voucher = 180 points
- Free pastry = 150 points

--------------------------------------------------
INTERFACE 1: CUSTOMER / STUDENT APP
--------------------------------------------------

This should look like a mobile app.

Purpose:
The customer/student can only view information and rewards. The customer must NOT be able to add purchases or manually increase points.

Customer screens using bottom navigation:
1. Home
2. My QR
3. Rewards
4. History
5. Profile

Customer Home:
- Greeting: “Hi, [Student Name]”
- Show total points
- Show available free drinks
- Show stamp progress: X / 10 purchases
- Show progress bar
- Show message: “Buy 10 times and get 1 free drink”
- Show recent transaction summary
- Show pink/black membership card

My QR screen:
- Show student profile card
- Show a simulated QR code box using CSS
- Display Student ID below QR code
- Add instruction: “Show this QR code to the café staff before payment.”
- Add button to copy Student ID

Rewards screen:
- Show points balance
- Show voucher cards:
  - RM 5 voucher = 100 points
  - RM 10 voucher = 180 points
  - Free pastry = 150 points
- Customer can click “Request Redeem”
- When customer clicks Request Redeem, show message:
  “Please show this reward to the café counter staff to complete redemption.”
- Do not deduct points from customer side. Deduction happens in Staff app only.

History screen:
- Show purchase history, reward history, and free drink history for selected student
- Each item should include date/time, type, item, amount, points earned/used

Profile screen:
- Show:
  - Name
  - Student ID
  - Programme
  - Email
  - Membership status
- Add “Switch Student Demo” dropdown so presenter can simulate another student

If no customer is selected:
- Show student selector screen with demo student buttons.

--------------------------------------------------
INTERFACE 2: STAFF COUNTER APP
--------------------------------------------------

This should look like a tablet/counter interface.

Purpose:
Staff uses this at café counter to scan student, record purchases, and redeem rewards.

Staff screens:
1. Scan Student
2. Record Purchase
3. Redeem
4. Today Transactions

Scan Student:
- Fake QR scanner box with animated scan line
- Input field: Enter Student ID
- Quick demo buttons for students
- Button: Scan / Fetch Student
- After scanning, show:
  - Student name
  - Student ID
  - Programme
  - Email
  - Current points
  - Stamp progress
  - Free drinks available

Record Purchase:
- Must require scanned student first
- Show selected student card
- Menu item cards with prices
- Staff can select one or more items
- Show cart summary
- Allow custom purchase amount
- Button: Confirm Purchase
- On confirm:
  - Add points based on total RM
  - Add 1 stamp/purchase count
  - If stamp reaches 10, add 1 free drink and reset stamp progress
  - Add transaction history
  - Show toast: “Purchase recorded successfully”
- Show receipt-style confirmation after purchase

Redeem:
- Must require scanned student first
- Show student points and free drinks
- Staff can redeem:
  1. RM 5 voucher for 100 points
  2. RM 10 voucher for 180 points
  3. Free pastry for 150 points
  4. Free drink if freeDrinksAvailable > 0
- Validate balance before redemption
- Deduct points or free drink count correctly
- Add transaction history
- Show success or error toast

Today Transactions:
- Show all transactions from all students
- Filter by:
  - Purchases
  - Rewards
  - Free Drinks
- Show total sales today
- Show total points issued today
- Show total redemptions today

--------------------------------------------------
INTERFACE 3: ADMIN / OWNER DASHBOARD
--------------------------------------------------

This should look like a desktop dashboard, not a mobile app.

Purpose:
Admin can view analytics, students, transactions, menu, and loyalty rules.

Admin layout:
- Desktop dashboard with sidebar
- Sidebar items:
  1. Overview
  2. Students
  3. Transactions
  4. Menu & Rewards
  5. SOP
  6. Prototype Settings

Overview:
Show KPI cards:
- Total students
- Total sales
- Total transactions
- Total points issued
- Total rewards redeemed
- Free drinks issued
- Active members

Add simple charts using CSS/HTML only, no external libraries:
- Top selling items bar chart
- Points issued chart
- Transaction type distribution

Students:
- Table with all students:
  - Name
  - Student ID
  - Programme
  - Points
  - Purchases
  - Free drinks
  - Membership status
- Search bar by name or student ID
- Button to view student details
- Student detail modal/card showing profile and history
- Admin can add a new demo student
- Admin can edit points manually for prototype purposes
- Admin can reset a student’s points/purchases

Transactions:
- Table of all transactions
- Filters:
  - Student
  - Type
  - Date
- Show:
  - Date/time
  - Student
  - Type
  - Item
  - Amount
  - Points
  - Staff action
- Add export CSV button that downloads transactions as CSV

Menu & Rewards:
- Show menu item management section
- Admin can edit item price in prototype
- Show rewards/vouchers section
- Admin can edit points required for vouchers in prototype
- Changes should be saved in localStorage

SOP:
Show the complete café loyalty SOP in a professional card layout:

1. Student shows QR code or student ID at café counter.
2. Staff scans or enters student ID.
3. System verifies student information from the student database.
4. Staff records purchase after payment.
5. System calculates points based on purchase amount.
6. System adds one stamp for each purchase.
7. Every 10 purchases unlocks one free drink.
8. Staff can redeem points or free drink when requested.
9. All actions are saved in transaction history.
10. Admin reviews analytics and manages loyalty rules.

Prototype Settings:
- Reset all demo data button
- Clear transaction history button
- Load sample transactions button
- Show note:
  “This prototype uses localStorage to simulate a real shared database.”
- Show future development section:
  - Connect to real student database
  - Connect to POS system
  - Add staff login
  - Add admin authentication
  - Add QR scanner camera support
  - Add reporting dashboard
  - Add API and backend database

--------------------------------------------------
GENERAL REQUIREMENTS
--------------------------------------------------

Navigation:
- Add a role switcher at the top of every interface so presenter can switch between Customer, Staff, and Admin.
- Role switch should not delete data.
- Data should remain shared across all roles through localStorage.

UI:
- Customer interface should be mobile phone style.
- Staff interface should be tablet/counter style.
- Admin interface should be desktop dashboard style.
- Use pink to highlight the active role and active navigation.
- Use black headers and pink accent buttons.
- Use City University Malaysia inspired professional style.

UX:
- Add toast notifications.
- Add empty states.
- Add validation messages.
- Make all buttons functional.
- Make the demo feel real and polished.
- Add comments in code explaining key sections.

At the top of index.html, add comments explaining how to use the prototype:
1. Open index.html in browser.
2. Select Staff Counter.
3. Scan student CU2024001.
4. Record purchase.
5. Switch to Customer and see points updated.
6. Switch to Admin and see analytics updated.

Final deliverable:
Create the complete index.html file now with all HTML, CSS, and JavaScript included in the same file.
```

## 20. How to Run

After Cursor generates `index.html`:

1. Save the file.
2. Open `index.html` directly in any browser.
3. Or use VS Code / Cursor Live Server.
4. Select a role from the entry screen.
5. Use Staff Counter to scan and record purchases.
6. Switch to Customer or Admin to see the shared data update.

## 21. Notes for Future Version

A real production version can be developed later using:

- Frontend: React, Next.js, Flutter, or React Native
- Backend: Node.js, Laravel, Django, or Supabase
- Database: PostgreSQL, MySQL, Firebase, or Supabase
- Authentication: Student login, staff login, admin login
- Integrations: QR scanner, POS system, student database, reporting dashboard
