# KnockNFix — Modern Refactoring Blueprint

> Status: Reference document — implement at your own pace  
> Created: 2026-04-19  

---

## Current State vs Target State

```
CURRENT (messy)                          TARGET (clean)
─────────────────────────────────────    ────────────────────────────────────────
Controllers/                             Controllers/
  adminController.js    (1506 lines)       admin/
  authController.js     (800+ lines)         approvalController.js
  bookingController.js  (585 lines)          bookingAdminController.js
  dashboardController.js (extracted ✅)      categoryController.js
  paymentController.js   (extracted ✅)      paymentAdminController.js
  providerController.js (0 bytes - empty)    serviceAdminController.js
  serviceController.js  (800+ lines)         userAdminController.js
                                           auth/
routes/                                      loginController.js
  admin/    (sub-folder exists)              otpController.js
  api/      (sub-folder exists)              registerController.js
  dashboard/ (sub-folder exists)           booking/
  admin.js                                   bookingController.js
  auth.js          (517 lines)               bookingCancelController.js
  booking.js                                 bookingCompleteController.js
  chat.js                                  dashboard/
  complaints.js                              customerDashboardController.js
  dashboard.js     (slimmed ✅)              providerDashboardController.js
  feedback.js                              payment/
  location.js                                paymentController.js   (extracted ✅)
  payment.js       (slimmed ✅)              payoutController.js
  profile.js                               provider/
  provider.js                                providerProfileController.js
  services.js                                providerServiceController.js
  user.js                                    providerLocationController.js
  about.js                               
                                         routes/
models/                                    admin.js
  Booking.js       (issues: enum)           auth.js
  Complaint.js     (needs timestamps)       booking.js
  OTP.js           (dup TTL index)          dashboard.js    (slimmed ✅)
  Payment.js       (dup type field)         feedback.js
  Service.js                               payment.js     (slimmed ✅)
  ServiceProvider.js (944 lines)           profile.js
  User.js          (456 lines)             provider.js
  category.js                              services.js
  chatMessage      (missing .js)           complaints.js
                                           chat.js
utils/
  adminNotifications.js  (console-only)   middleware/
  catchAsync.js                             auth.js         (isLoggedIn, isAdmin...)
  distance.js                               roles.js        (role-based guards)
  otp.js            (562 lines)             validation.js   (shared validators)
  paymentAutomation.js (stub payout)      
                                         utils/
                                           otp.js
                                           distance.js
                                           paymentAutomation.js
                                           catchAsync.js
                                           adminNotifications.js
                                         
                                         config/
                                           cloudinary.js
                                           razorpay.js
                                           passport.js     (move from app.js)
                                           session.js      (move from app.js)
```

---

## Phase 1 — Controller Restructure ✅ (Partially Done)

### 1.1 Split `adminController.js` → `Controllers/admin/`

**`adminController.js` currently has 1506 lines covering 6 domains. Split into:**

| New File | Methods to Move |
|----------|----------------|
| `Controllers/admin/userAdminController.js` | `showUsers`, `showUserDetails` ← fix BUG-004, `suspendUser`, `reactivateUser` |
| `Controllers/admin/approvalController.js` | `showPendingProviders`, `approveProvider`, `rejectProvider`, `updateProviderPermissions`, `grantDashboardAccess`, `revokeDashboardAccess` |
| `Controllers/admin/categoryController.js` | `showCategories`, `addCategory`, `updateCategory`, `deleteCategory` |
| `Controllers/admin/serviceAdminController.js` | `showServices`, `addService`, `updateService`, `deleteService` |
| `Controllers/admin/bookingAdminController.js` | `showBookings`, `updateBookingStatus` |
| `Controllers/admin/paymentAdminController.js` | `showPayments`, `showProviderPayouts`, `processPayout`, `verifyBankDetails` |
| `Controllers/admin/reportsController.js` | `showReports`, `showFeedback`, `getRevenueData`, `getServiceData`, `getUserGrowthData`, `getFeedbackData` |
| `Controllers/admin/settingsController.js` | `showSettings`, `updateSettings`, `getSystemSettings` |
| `Controllers/admin/dashboardAdminController.js` | `showDashboard`, `getRecentActivity`, `getSystemNotifications`, `calculateTotalRevenue` |

**`routes/admin.js` wires them all:**
```js
const userAdmin    = require('../Controllers/admin/userAdminController');
const approval     = require('../Controllers/admin/approvalController');
// ...etc
```

---

### 1.2 Split `authController.js` → `Controllers/auth/`

**Currently 800+ lines. Split into:**

| New File | Responsibility |
|----------|---------------|
| `Controllers/auth/registerController.js` | `showRegister`, `handleRegister`, `handleRegisterAPI` |
| `Controllers/auth/otpController.js` | `handleVerifyOTP`, `handleVerifyOTPAPI`, `resendOTP`, `resendLoginOTP`, `getOTPStatus`, `checkOTPSession`, `clearOTPSession` |
| `Controllers/auth/loginController.js` | `showLogin`, `handleLogin`, `handleLoginAPI`, `showVerifyLoginOTP`, `handleVerifyLoginOTP`, `handleVerifyLoginOTPAPI` |
| `Controllers/auth/sessionController.js` | `handleLogout`, remember-token logic, auto-login middleware |

---

### 1.3 Split `dashboardController.js` → `Controllers/dashboard/` ✅ Extracted, now split further

| New File | Responsibility |
|----------|---------------|
| `Controllers/dashboard/customerDashboardController.js` | `getCustomerDashboardData`, `showCustomerDashboard` |
| `Controllers/dashboard/providerDashboardController.js` | `getProviderDashboardData`, `showProviderDashboard`, earnings/rating helpers |

---

### 1.4 Populate `Controllers/providerController.js` → `Controllers/provider/`

| New File | Methods |
|----------|---------|
| `Controllers/provider/providerProfileController.js` | Update profile, bank details, portfolio |
| `Controllers/provider/providerServiceController.js` | Register service, delete service |
| `Controllers/provider/providerLocationController.js` | Add/delete service areas, update service area, travel fee |
| `Controllers/provider/providerAvailabilityController.js` | Update weekly availability |

---

### 1.5 Split `serviceController.js`

| New File | Responsibility |
|----------|---------------|
| `Controllers/service/serviceBrowseController.js` | `showCategories`, `showServicesByCategory`, `showProvidersByService` |
| `Controllers/service/providerSearchController.js` | `filterProvidersByLocationAndDistance`, `getAvailableProviders` |

---

### 1.6 Split `bookingController.js`

| New File | Responsibility |
|----------|---------------|
| `Controllers/booking/bookingCreateController.js` | `confirmBooking`, `createBooking` |
| `Controllers/booking/bookingStatusController.js` | `completeBooking`, `cancelBooking`, `confirmByProvider` |
| `Controllers/booking/bookingViewController.js` | `getMyBookings`, `getBookingDetail`, `getBookingSuccess` |

---

## Phase 2 — Route File Cleanup

### Current route files that need cleanup

| File | Problem | Fix |
|------|---------|-----|
| `routes/auth.js` | Contains validation rules, helper middleware inline (517 lines) | Extract validators to `middleware/validation.js`; route file → 60 lines |
| `routes/profile.js` | 9498 bytes — has business logic inline | Move logic to `Controllers/provider/providerProfileController.js` |
| `routes/location.js` | 9099 bytes — has business logic inline | Move to `Controllers/provider/providerLocationController.js` |
| `routes/user.js` | 7716 bytes — has business logic inline | Move to `Controllers/userController.js` |
| `routes/admin.js` | Wires to monolithic controller | Update refs to split admin controllers |
| `routes/feedback.js` | No ownership check (BUG-016) | Add auth check + move body to controller |
| `routes/complaints.js` | No validation | Add express-validator |

---

## Phase 3 — Middleware Refactor

### Current `middleware.js` (single 26-line file)

**Split into `middleware/` folder:**

```
middleware/
  auth.js          →  isLoggedIn, isAdmin, isServiceProvider
  roles.js         →  requireRole(role), requireStatus(status)
  validation.js    →  shared express-validator rule sets (phone, OTP, etc.)
  errorHandler.js  →  global error handler (move from app.js)
  dbCheck.js       →  database connection check (move from app.js)
```

**`middleware.js` (kept for backward compat):**
```js
// Backward-compatible re-export
module.exports = require('./middleware/auth');
```

---

## Phase 4 — Model Cleanup

| Model | Change | Reason |
|-------|--------|--------|
| `models/Booking.js` | Add `'in_progress'` to status enum | BUG-029: admin sends it but schema rejects it |
| `models/Booking.js` | Deprecate `bookingDate` field; use `date` only | BUG-014: dual date fields |
| `models/Payment.js` | Remove `type` OR `paymentType` (keep one) | BUG-013: duplicate fields |
| `models/Complaint.js` | Remove manual `createdAt`; add `{ timestamps: true }` | BUG-018 |
| `models/OTP.js` | Remove `OTPSchema.index({createdAt:1}, {expireAfterSeconds:600})` | BUG-030: duplicate TTL |
| `models/chatMessage` | Rename to `chatMessage.js` | BUG-034: missing extension |
| `models/category.js` | Rename to `Category.js` (capital C for consistency) | Convention |

---

## Phase 5 — Utils Cleanup

| File | Change |
|------|--------|
| `utils/adminNotifications.js` | Replace console-only logs with actual SMS/email stubs; mask Aadhar in logs (BUG-031) |
| `utils/paymentAutomation.js` | Implement real `createProviderTransfer` via Razorpay Payouts API (BUG-001) |
| `utils/otp.js` | Replace in-memory `otpRateLimit` Map with Redis (BUG-002) |
| `utils/catchAsync.js` | Already good — use it everywhere to replace try/catch boilerplate |

**Add new utils:**
```
utils/
  AppError.js      →  Custom error class (code, status, message)
  validators.js    →  Shared phone/OTP/PAN/Aadhar regex constants
```

---

## Phase 6 — `app.js` Cleanup

**`app.js` currently handles**: DB connect, session config, passport config, CORS, route mounting, error handler — all in one file.

**Split into:**
```
config/
  database.js     →  mongoose connect + event listeners
  session.js      →  express-session options
  passport.js     →  passport strategy setup (move from app.js)
  
middleware/
  errorHandler.js →  global error handler (move from app.js lines 380-409)
  dbCheck.js      →  database connection middleware (move from app.js)
```

**`app.js` becomes ~60 lines:**
```js
const express = require('express');
const app = express();

require('./config/database')();      // connect DB
require('./config/passport')(app);   // setup passport
require('./config/session')(app);    // setup session

// Mount routes
app.use('/auth', require('./routes/auth'));
// ... etc

require('./middleware/errorHandler')(app); // global error handler

module.exports = app;
```

---

## Final Target Folder Structure

```
KnockNFix/
├── app.js                          (~60 lines, orchestrator only)
├── package.json
├── middleware.js                   (backward-compat re-export only)
│
├── config/
│   ├── cloudinary.js
│   ├── database.js                 [NEW] extracted from app.js
│   ├── passport.js                 [NEW] extracted from app.js
│   ├── razorpay.js
│   └── session.js                  [NEW] extracted from app.js
│
├── Controllers/
│   ├── admin/
│   │   ├── approvalController.js   [NEW] split from adminController.js
│   │   ├── bookingAdminController.js
│   │   ├── categoryController.js
│   │   ├── dashboardAdminController.js
│   │   ├── paymentAdminController.js
│   │   ├── reportsController.js
│   │   ├── serviceAdminController.js
│   │   ├── settingsController.js
│   │   └── userAdminController.js  [NEW] includes BUG-004 fix
│   │
│   ├── auth/
│   │   ├── loginController.js      [NEW] split from authController.js
│   │   ├── otpController.js        [NEW]
│   │   ├── registerController.js   [NEW]
│   │   └── sessionController.js   [NEW]
│   │
│   ├── booking/
│   │   ├── bookingCreateController.js   [NEW] split from bookingController.js
│   │   ├── bookingStatusController.js   [NEW]
│   │   └── bookingViewController.js     [NEW]
│   │
│   ├── dashboard/
│   │   ├── customerDashboardController.js  [NEW] split from dashboardController.js
│   │   └── providerDashboardController.js  [NEW]
│   │
│   ├── payment/
│   │   ├── paymentController.js    ✅ already extracted
│   │   └── payoutController.js     [NEW] extracted payout logic
│   │
│   ├── provider/
│   │   ├── providerAvailabilityController.js  [NEW]
│   │   ├── providerLocationController.js      [NEW]
│   │   ├── providerProfileController.js       [NEW]
│   │   └── providerServiceController.js       [NEW]
│   │
│   └── service/
│       ├── serviceBrowseController.js   [NEW] split from serviceController.js
│       └── providerSearchController.js  [NEW]
│
├── middleware/
│   ├── auth.js                     [NEW] extracted from middleware.js
│   ├── dbCheck.js                  [NEW] extracted from app.js
│   ├── errorHandler.js             [NEW] extracted from app.js
│   ├── roles.js                    [NEW]
│   └── validation.js               [NEW] shared validator rule-sets
│
├── models/
│   ├── Booking.js                  [MODIFY] add in_progress enum, fix bookingDate
│   ├── Category.js                 [RENAME] category.js → Category.js
│   ├── Complaint.js                [MODIFY] timestamps: true
│   ├── OTP.js                      [MODIFY] remove dup TTL index
│   ├── Payment.js                  [MODIFY] merge type/paymentType
│   ├── Service.js
│   ├── ServiceProvider.js
│   ├── User.js
│   └── chatMessage.js              [RENAME] chatMessage → chatMessage.js
│
├── routes/
│   ├── admin.js                    [MODIFY] update refs
│   ├── auth.js                     [MODIFY] slim down, validators → middleware/
│   ├── booking.js
│   ├── chat.js
│   ├── complaints.js               [MODIFY] add validation
│   ├── dashboard.js                ✅ slimmed
│   ├── feedback.js                 [MODIFY] add ownership check
│   ├── location.js                 [MODIFY] slim down
│   ├── payment.js                  ✅ slimmed
│   ├── profile.js                  [MODIFY] slim down
│   ├── provider.js
│   ├── services.js
│   └── user.js                     [MODIFY] slim down
│
└── utils/
    ├── AppError.js                 [NEW] custom error class
    ├── adminNotifications.js       [MODIFY] mask PII in logs
    ├── catchAsync.js               ✅ already exists, use it everywhere
    ├── distance.js
    ├── otp.js                      [MODIFY] Redis rate limiter
    ├── paymentAutomation.js        [MODIFY] real bank transfer
    └── validators.js               [NEW] shared regex constants
```

---

## Priority Order for Implementation

```
Phase 1 (Structural — high ROI)
  ├─ Split adminController.js           ← biggest win, 1506 lines
  ├─ Split authController.js            ← 2nd biggest, 800+ lines
  ├─ Fix BUG-004 (showUserDetails)      ← admin panel broken without this
  └─ Slim routes/auth.js                ← extract validators

Phase 2 (Models — correctness)
  ├─ Fix Booking.js enum (in_progress)
  ├─ Merge Payment.js type/paymentType
  ├─ Fix Complaint.js timestamps
  ├─ Fix OTP.js dup TTL
  └─ Rename chatMessage + category.js

Phase 3 (Middleware — cleanness)
  ├─ Extract middleware/ folder
  ├─ Move errorHandler out of app.js
  └─ Move DB connect to config/database.js

Phase 4 (Utils — reliability)
  ├─ Implement real payoutTransfer (BUG-001)
  ├─ Redis OTP rate limiter (BUG-002)
  └─ Mask PII in adminNotifications (BUG-031)
```

---

## Quick Reference — File Size Targets

| File | Current | Target |
|------|---------|--------|
| `adminController.js` | 1506 lines | deleted (split into 9 files) |
| `authController.js` | 800+ lines | deleted (split into 4 files) |
| `dashboardController.js` | 450 lines | split into 2 × ~150 lines |
| `serviceController.js` | 800+ lines | split into 2 × ~200 lines |
| `routes/auth.js` | 517 lines | ~80 lines |
| `routes/dashboard.js` | ~~1290~~ → 48 lines ✅ | done |
| `routes/payment.js` | ~~1072~~ → 30 lines ✅ | done |
| `app.js` | 409 lines | ~80 lines |
| `middleware.js` | 26 lines | kept as re-export |
