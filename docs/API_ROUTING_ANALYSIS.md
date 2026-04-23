# KnockNFix — API Routing Working & Flaw Analysis

Based on the repository audit and current state of the codebase, here is the analysis of the API routing structure. Currently, routing is handled centrally via `app.js` and splits out into various domain-specific files in the `routes/` directory.

---

## Complete Route Map (All Files)

### `app.js` — Mount Points
| Prefix | Route File |
|---|---|
| `/` | `auth.js`, `about.js`, `chat.js`, `admin/add.js`, `system.js` |
| `/services` | `services.js` |
| `/dashboard` | `dashboard.js` |
| `/admin` | `admin.js` |
| `/api/location` | `location.js` |
| `/booking` | `booking.js` |
| `/payment` | `payment.js` |
| `/profile` | `profile.js` |
| `/provider` | `provider.js` |
| `/feedback` | `feedback.js` |
| `/api/bookings` | `routes/api/bookings.js` |
| `/complaints` | `complaints.js` |
| `/user` | `user.js` |

---

## Route-by-Route Breakdown with `:id` / Param Analysis

### `/booking` → `routes/booking.js`

| Method | Full Path | Param Name | Param Type | Validated? | ✅/⚠️ |
|---|---|---|---|---|---|
| POST | `/booking/create` | — | — | ✅ payload validated | ✅ |
| POST | `/booking/confirm` | — | — | ✅ payload validated | ✅ |
| GET | `/booking/mybookings` | — | — | — | ✅ |
| GET | `/booking/details/:id` | `:id` | MongoDB ObjectId (Booking) | ✅ `validateBookingIdParam` | ✅ |
| POST | `/booking/complete/:id` | `:id` | MongoDB ObjectId (Booking) | ✅ `validateBookingIdParam` | ✅ |
| POST | `/booking/cancel/:id` | `:id` | MongoDB ObjectId (Booking) | ✅ `validateBookingIdParam` | ✅ |
| GET | `/booking/success` | — | — | — | ✅ |
| GET | `/booking/admin/all` | — | — | — | ✅ |
| PATCH | `/booking/admin/:id/status` | `:id` | MongoDB ObjectId (Booking) | ✅ `validateBookingIdParam` | ✅ |

> **All `:id` params here are Booking MongoDB ObjectIds. All are validated. ✅**

---

### `/payment` → `routes/payment.js`

| Method | Full Path | Param Name | Param Type | Validated? | ✅/⚠️ |
|---|---|---|---|---|---|
| POST | `/payment/create-advance-order` | — | — | ✅ payload | ✅ |
| POST | `/payment/create-final-order` | — | — | ✅ payload | ✅ |
| POST | `/payment/verify-automated` | — | — | ✅ payload | ✅ |
| POST | `/payment/create-order` | — | — | ✅ payload | ✅ |
| POST | `/payment/verify-payment` | — | — | ✅ payload | ✅ |
| GET | `/payment/success/:bookingId` | `:bookingId` | MongoDB ObjectId (Booking) | ✅ `validatePaymentSuccessBookingParam` | ✅ |
| POST | `/payment/:id/complete-payment` | `:id` | MongoDB ObjectId (Booking) | ✅ `validateBookingIdParam` | ✅ |
| POST | `/payment/:id/advance-payment` | `:id` | MongoDB ObjectId (Booking) | ✅ `validateBookingIdParam` | ✅ |
| POST | `/payment/payment-success` | — | — | ✅ payload | ✅ |
| GET | `/payment/provider-payout/:providerId` | `:providerId` | MongoDB ObjectId (Provider/User) | ✅ `validateProviderIdParam` | ✅ |

> **Previously `/verify-automated` was missing `isLoggedIn` — this has been FIXED. ✅**

---

### `/dashboard` → `routes/dashboard.js`

| Method | Full Path | Param Name | Param Type | Validated? | ✅/⚠️ |
|---|---|---|---|---|---|
| GET | `/dashboard/` | — | — | — | ✅ |
| GET | `/dashboard/api/bookings` | — | — | — | ✅ |
| POST | `/dashboard/provider/update-info` | — | — | — | ✅ |
| GET | `/dashboard/registerService` | — | — | — | ✅ |
| POST | `/dashboard/registerService` | — | — | ✅ body validators | ✅ |
| POST | `/dashboard/service/delete/:id` | `:id` | MongoDB ObjectId (Service) | ❌ No validation | ⚠️ |
| GET | `/dashboard/service/:id` | `:id` | MongoDB ObjectId (Service) | ❌ No validation | ⚠️ |
| POST | `/dashboard/:id/advance-payment` | `:id` | MongoDB ObjectId (Booking) | ❌ No validation | ⚠️ |
| POST | `/dashboard/:id/complete-payment` | `:id` | MongoDB ObjectId (Booking) | ❌ No validation | ⚠️ |
| DELETE | `/dashboard/api/provider/locations/:id` | `:id` | MongoDB ObjectId (Location) | ❌ No validation | ⚠️ |

> **⚠️ All `:id` params in dashboard routes are unvalidated MongoDB ObjectIds. A non-ObjectId value will crash Mongoose with a CastError.**

---

### `/admin` → `routes/admin.js`

| Method | Full Path | Param Name | Param Type | Validated? | ✅/⚠️ |
|---|---|---|---|---|---|
| GET | `/admin/pending-providers` | — | — | — | ✅ |
| POST | `/admin/approve-provider/:providerId` | `:providerId` | MongoDB ObjectId (Provider) | ✅ `validateApproveProvider` | ✅ |
| POST | `/admin/reject-provider/:providerId` | `:providerId` | MongoDB ObjectId (Provider) | ✅ `validateRejectProvider` | ✅ |
| POST | `/admin/manage-permissions/:providerId` | `:providerId` | MongoDB ObjectId (Provider) | ✅ `validateManageProviderPermissions` | ✅ |
| GET | `/admin/api/provider-details/:providerId` | `:providerId` | MongoDB ObjectId (Provider) | ✅ `validateProviderIdParam` | ✅ |
| GET | `/admin/editCategory/:id` | `:id` | MongoDB ObjectId (Category) | ✅ `validateObjectIdParam` | ✅ |
| PUT | `/admin/categories/:id` | `:id` | MongoDB ObjectId (Category) | ✅ `validateObjectIdParam` | ✅ |
| DELETE | `/admin/categories/:id` | `:id` | MongoDB ObjectId (Category) | ✅ `validateObjectIdParam` | ✅ |
| POST | `/admin/categories/:id/toggle` | `:id` | MongoDB ObjectId (Category) | ✅ `validateObjectIdParam` | ✅ |
| DELETE | `/admin/services/:id` | `:id` | MongoDB ObjectId (Service) | ✅ `validateObjectIdParam` | ✅ |
| POST | `/admin/services/:id/toggle` | `:id` | MongoDB ObjectId (Service) | ✅ `validateObjectIdParam` | ✅ |
| POST | `/admin/process-payout/:providerId` | `:providerId` | MongoDB ObjectId (Provider) | ✅ `validateProviderIdParam` | ✅ |
| POST | `/admin/verify-bank-details/:providerId` | `:providerId` | MongoDB ObjectId (Provider) | ✅ `validateProviderIdParam` | ✅ |

> **Admin routes are well-validated. ✅**

---

### `/services` → `routes/services.js`

| Method | Full Path | Param Name | Param Type | Validated? | ✅/⚠️ |
|---|---|---|---|---|---|
| GET | `/services/` | — | — | — | ✅ |
| GET | `/services/:id` | `:id` | MongoDB ObjectId (Category) | ❌ No validation | ⚠️ |
| GET | `/services/:serviceId/providers` | `:serviceId` | MongoDB ObjectId (Service) | ❌ No validation | ⚠️ |
| GET | `/services/:id/:provider/book` | `:id`, `:provider` | ObjectId (Service), ObjectId (Provider) | ❌ No validation | ⚠️ |
| POST | `/services/update-location` | — | — | — | ⚠️ No auth |

> **⚠️ `/services/update-location` has no `isLoggedIn`. All `:id` / `:serviceId` / `:provider` params are raw and unvalidated.**

---

### `/feedback` → `routes/feedback.js`

| Method | Full Path | Param Name | Param Type | Validated? | ✅/⚠️ |
|---|---|---|---|---|---|
| GET | `/feedback/:bookingId` | `:bookingId` | MongoDB ObjectId (Booking) | ❌ No ObjectId check | ⚠️ |
| POST | `/feedback/submit` | — | — | — | ✅ |

> **⚠️ `/feedback/:bookingId` has no ownership check — any logged-in user can load any booking's feedback page.**

---

### `/provider` → `routes/provider.js`

| Method | Full Path | Param Name | Param Type | Validated? | ✅/⚠️ |
|---|---|---|---|---|---|
| GET | `/provider/myservices` | — | — | — | ✅ |
| POST | `/provider/edit/:serviceId` | `:serviceId` | MongoDB ObjectId (Service) | ✅ `validateServiceIdParam` | ✅ |

> **Provider routes are clean. ✅**

---

### `/user` → `routes/user.js`

| Method | Full Path | Param Name | Param Type | Validated? | ✅/⚠️ |
|---|---|---|---|---|---|
| POST | `/user/add-address` | — | — | ✅ | ✅ |
| POST | `/user/update-address/:index` | `:index` | Integer (array index) | ✅ `validateAddressIndexParam` | ✅ |
| POST | `/user/delete-address/:index` | `:index` | Integer (array index) | ✅ `validateAddressIndexParam` | ✅ |
| POST | `/user/set-default-address/:index` | `:index` | Integer (array index) | ✅ `validateAddressIndexParam` | ✅ |
| POST | `/user/update-location` | — | — | ✅ | ✅ |

> **User address routes use `:index` (array index, not a MongoDB ObjectId). All validated. ✅**

---

### `/complaints` → `routes/complaints.js`

| Method | Full Path | Param Name | Param Type | Validated? | ✅/⚠️ |
|---|---|---|---|---|---|
| GET | `/complaints/` | — | — | — | ✅ |
| POST | `/complaints/add` | — | — | ❌ No body validation | ⚠️ |

---

## Summary: What "Long ID" Means in Your Routes

All `:id`, `:bookingId`, `:serviceId`, `:providerId` params are **MongoDB ObjectIds** — they look like this:

```
6630f3a2c9e77b1234567890
```

They are 24-character hexadecimal strings. This is completely normal and expected.

### Are They Correct?
| Route Group | Param | Correct? | Notes |
|---|---|---|---|
| `/booking/:id` | Booking ObjectId | ✅ YES | Validated with `validateBookingIdParam` |
| `/payment/:id` | Booking ObjectId | ✅ YES | Validated |
| `/payment/success/:bookingId` | Booking ObjectId | ✅ YES | Validated |
| `/payment/provider-payout/:providerId` | Provider ObjectId | ✅ YES | Validated |
| `/admin/:id` | Category/Service ObjectId | ✅ YES | Validated with `validateObjectIdParam` |
| `/admin/:providerId` | Provider ObjectId | ✅ YES | Validated |
| `/services/:id` | Category ObjectId | ⚠️ NOT VALIDATED | Needs `isMongoId()` check |
| `/services/:serviceId/providers` | Service ObjectId | ⚠️ NOT VALIDATED | Needs `isMongoId()` check |
| `/services/:id/:provider/book` | Two ObjectIds | ⚠️ NOT VALIDATED | Needs validation on both |
| `/dashboard/:id` | Booking/Service ObjectId | ⚠️ NOT VALIDATED | CastError risk |
| `/feedback/:bookingId` | Booking ObjectId | ⚠️ NOT VALIDATED + No ownership check | Security flaw |
| `/user/:index` | Integer index | ✅ YES — NOT an ObjectId | Array index, validated correctly |
| `/provider/:serviceId` | Service ObjectId | ✅ YES | Validated |

---

## Biggest Flaws and Errors in Routing (Prioritized)

### 1. CRITICAL: Unauthenticated Payment/Booking Forgery — ✅ FIXED
**File:** `routes/payment.js`
`/payment/verify-automated` now has `isLoggedIn` applied. Previously unauthenticated.

### 2. HIGH: Wildcard CORS Vulnerability
**File:** `app.js`
The global CORS middleware is allowing `*` origins in production. When combined with session cookies, this opens up the API to Cross-Site Request Forgery (CSRF) attacks.
→ **Fix:** Use `allowedOrigins` list already defined in `app.js` — just ensure the `cors` middleware in `middleware/cors.js` correctly uses it.

### 3. HIGH: Broken Admin User Route — ✅ FIXED
**File:** `routes/admin.js` & `Controllers/adminController.js`
The `showUserDetails` labeled-statement bug has been resolved by splitting admin controllers into separate files (`userAdminController`, `dashboardAdminController`, etc.).

### 4. MEDIUM: Feedback Route Lacks Ownership Check
**File:** `routes/feedback.js`
`GET /feedback/:bookingId` uses `isLoggedIn` but doesn't check if `req.user._id` matches the booking's customer. Any logged-in user can view any other user's feedback page.
→ **Fix in `feedbackController.showFeedbackPage`:** Add `if (booking.customer.toString() !== req.user._id.toString()) return res.status(403).send('Forbidden')`.

### 5. MEDIUM: Unvalidated `:id` Params in `/dashboard` and `/services`
**Files:** `routes/dashboard.js`, `routes/services.js`
All `:id` params here bypass ObjectId validation. A malformed ID (e.g. `abc`) will cause a Mongoose `CastError` that propagates as an unhandled 500 crash.
→ **Fix:** Add `param('id').isMongoId()` middleware to these routes.

### 6. LOW: `/services/update-location` Has No Auth
**File:** `routes/services.js`
`POST /services/update-location` has no `isLoggedIn` middleware, so anonymous users can call it.

### 7. LOW: `/complaints/add` Has No Body Validation
**File:** `routes/complaints.js`
`POST /complaints/add` accepts raw payloads with no length or format checks.

---

## Proposed Fixes (Remaining Items)

```js
// routes/services.js — Add to all `:id` routes:
const { param, validationResult } = require('express-validator');
const validateObjectId = [
  param('id').isMongoId().withMessage('Invalid ID format'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  }
];

// routes/dashboard.js — Same pattern for /:id routes

// routes/feedback.js — Ownership check in controller:
if (booking.customer.toString() !== req.user._id.toString()) {
  return res.status(403).send('Forbidden');
}

// routes/services.js — Add isLoggedIn to update-location:
router.post('/update-location', isLoggedIn, serviceController.updateLocation);
```
