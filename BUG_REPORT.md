# KnockNFix — Bug & Issue Report

> Audited: 2026-04-19  
> Scope: Full backend codebase (Controllers, routes, models, utils, config)  
> Ordered: **Critical → High → Medium → Low / Minor**

---

## 🔴 CRITICAL — Data integrity, security breaches, money loss, or service outage

---

### BUG-001 · Provider Bank Transfer is a Stub — Payouts Never Happen
**File:** `utils/paymentAutomation.js` · Lines 111–128  
**Severity:** Critical — Financial data corruption / provider trust failure

```js
// TODO: Implement actual bank transfer logic here
// For now, returning a mock success response
return {
    transferId: `transfer_${Date.now()}`,
    amount: amount,
    status: 'completed',   // ← always says "completed" but no money moved
    ...
};
```

**Problem:** `processProviderPayout()` calls `createProviderTransfer()`, which always returns a fake `status: 'completed'`. The calling code then updates the Payment record to `splitDetails.transferStatus = 'completed'` and `automationStatus.automationCompleted = true`.  
This means the provider dashboard shows "Payout Completed" and money was never sent.

**Fix:** Implement real Razorpay Payouts API call using the `createPayout` helper already defined in `config/razorpay.js`, OR mark the field `pending` and run a cron job to settle later.

---

### BUG-002 · OTP Rate Limiter Resets on Server Restart (In-Memory Only)
**File:** `utils/otp.js` · Line 5  
**Severity:** Critical (Security) — OTP brute-force possible after any restart/pod restart

```js
const otpRateLimit = new Map(); // ← in-memory, cleared on every restart
```

**Problem:** The rate limit for OTP sends is stored in a process-local `Map`. Any server restart, Docker container restart, or horizontal scale kills all rate limit state. An attacker can spam OTP requests by simply restarting the app, or by hitting a different pod in a load-balanced setup.

**Fix:** Move rate-limit state to Redis (e.g., `ioredis`) with a TTL-keyed entry per phone number.

---

### BUG-003 · CORS Allows All Origins (`*`) in Production
**File:** `app.js` · Lines 127–135  
**Severity:** Critical (Security) — Cross-site request forgery / data exposure

```js
res.header("Access-Control-Allow-Origin", "*");
```

**Problem:** A wildcard CORS policy lets any website make credentialed requests to this API. Combined with cookie-based sessions, this enables CSRF attacks from any origin.

**Fix:** Restrict to the specific production origin:
```js
const allowedOrigins = ['https://knocknfix.live'];
const origin = req.headers.origin;
if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Vary", "Origin");
}
```

---

### BUG-004 · `showUsers` in adminController Has a Function Definition Inside a Try Block
**File:** `Controllers/adminController.js` · Lines 506–575  
**Severity:** Critical — Syntax antipattern that silently swallows `showUserDetails` forever

```js
showUsers: async (req, res) => {
    try {
        let users = await User.find()...
        
        showUserDetails: async (req, res) => {   // ← This is LABELED STATEMENT syntax,
            // ... entire function body             //   not an actual method definition!
        };
        
        // Categorize users
        const customers = users.filter(...)
```

**Problem:** JavaScript interprets `showUserDetails: async (req, res) => { ... }` inside the try block as a **labeled statement**, not a function assignment. The `showUserDetails` method is **never registered** on `adminController` and will be `undefined` anywhere it is called. This will crash any admin route that calls `adminController.showUserDetails`.

**Fix:** Move `showUserDetails` outside `showUsers`, as a sibling method on `adminController`:
```js
showUserDetails: async (req, res) => {
    // ... moved outside showUsers
},
showUsers: async (req, res) => {
    // ... now clean
}
```

---

### BUG-005 · Payment Verification Route Has No Auth Guard (`/payment/verify-automated`)
**File:** `routes/payment.js` · Line 237  
**Severity:** Critical (Security) — Unauthenticated users can forge bookings

```js
router.post('/verify-automated', async (req, res) => {
```

**Problem:** This route creates a new `Booking` document using `req.user._id` without the `isLoggedIn` middleware. If an unauthenticated request reaches this route, `req.user` is `undefined`, crashing the server with a TypeError *or* — in some edge cases — allowing a guest to inject arbitrary booking data.

**Fix:** Add `isLoggedIn` middleware:
```js
router.post('/verify-automated', isLoggedIn, async (req, res) => {
```

---

### BUG-006 · OTP Dev Mode Can Leak to Production via `SKIP_OTP=true` Env Var
**File:** `Controllers/authController.js` · Lines 10–14  
**Severity:** Critical (Security)

```js
const isDevelopment = () => {
    return (
        process.env.NODE_ENV === "development" || process.env.SKIP_OTP === "true"
    );
};
```

**Problem:** `SKIP_OTP=true` bypasses ALL OTP verification even in `NODE_ENV=production`. If this env var is set in production (e.g., accidentally preserved from a .env.example), any user can log in or register without OTP. The `.env` file in the repo root should be checked — if `SKIP_OTP=true` is there, it ships to the server.

**Fix:** Remove the `SKIP_OTP` bypass entirely. Only rely on `NODE_ENV === 'development'`.

---

## 🟠 HIGH — Major functionality broken, data loss possible, significant UX failure

---

### BUG-007 · `completeBooking` Does Not Check if Final Payment Was Made
**File:** `Controllers/bookingController.js` · Lines 235–296  
**Severity:** High — Provider payout triggered without full payment

```js
exports.completeBooking = async (req, res) => {
    // ... finds booking
    const updatedBooking = await Booking.findByIdAndUpdate(bookingId, {
        status: 'completed',
        paymentStatus: 'completed'   // ← sets completed even if only advance was paid
    }, { new: true });
    await processProviderPayout(bookingId);
```

**Problem:** The controller marks `paymentStatus: 'completed'` without checking that the final payment (85%) was actually received. A provider or customer could call this endpoint while the booking is still in `partially_paid` state, falsely completing the booking.

**Fix:** Verify `booking.finalPayment.paid === true` before allowing completion.

---

### BUG-008 · `cancelBooking` Has Zero Time/Cancellation-Policy Enforcement
**File:** `Controllers/bookingController.js` · Lines 299–363  
**Severity:** High — Business logic disabled intentionally but left open

```js
// No time restrictions - allow cancellation anytime
// (You can add this back later for production)
```

**Problem:** Customers can cancel a `confirmed` or `in_progress` booking at ANY point (even 5 minutes before the service), with no penalty and no refund logic. This makes advance payments meaningless as a commitment mechanism.

**Fix:** Add a minimum cancellation window (e.g., 24 hours before `booking.date`) and a refund policy for advance payments.

---

### BUG-009 · Booking Success Page Fetches Arbitrary User's Booking — No Ownership Check
**File:** `Controllers/bookingController.js` · Lines 408–481  
**Severity:** High — Information exposure

```js
// First try to get the most recent completed booking for this user
booking = await Booking.findOne({
    customer: req.user._id,   // ← correct
    status: { $in: ['confirmed', 'completed'] }
})

// Fallback:
payment = await Payment.findOne({
    status: 'completed',
    paymentType: 'advance'     // ← NO filter by user
})
```

**Problem:** The fallback query fetches **any** completed payment from the database (no `customer` filter), then tries to match the related booking. If the match fails silently, a different user's booking details could be shown on the success page.

**Fix:** Always filter by `req.user._id` in both the primary and fallback queries.

---

### BUG-010 · Session Secret Falls Back to a Hardcoded Value
**File:** `app.js` · Line 112  
**Severity:** High (Security)

```js
secret: process.env.SESSION_SECRET || "mysupersecretcode",
```

**Problem:** If `SESSION_SECRET` is missing from `.env`, all session cookies are signed with `"mysupersecretcode"` — a publicly known string anyone reading this source code can use to forge cookies.

**Fix:** Throw an error at startup if `SESSION_SECRET` is not set:
```js
if (!process.env.SESSION_SECRET) throw new Error('SESSION_SECRET env var is required');
```

---

### BUG-011 · Cookie `expires` Computed Incorrectly (Milliseconds vs Date Object)
**File:** `app.js` · Line 116  
**Severity:** High — Sessions may not expire correctly in all browsers

```js
cookie: {
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,  // ← number, not a Date object
    maxAge: 7 * 24 * 60 * 60 * 1000,
```

**Problem:** `express-session` expects `expires` to be a `Date` object, not a raw millisecond timestamp. Some session store implementations and browsers may reject or misinterpret a numeric value.

**Fix:**
```js
expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
```

---

### BUG-012 · Admin `rejectProvider` Still Calls `logAdminAction` / `notifyProviderApproval` Without Error Wrapping
**File:** `Controllers/adminController.js` · Lines 270–280  
**Severity:** High — Reject action crashes if notification utils fail

```js
// Log admin action
await logAdminAction(...);          // ← not wrapped in try/catch
// Notify provider about rejection
await notifyProviderApproval(...);  // ← not wrapped in try/catch
```

**Problem:** Unlike `approveProvider` (which wraps these calls in individual try/catches), `rejectProvider` calls them bare. If either util throws (e.g., no admin users exist), the whole rejection handler crashes with 500, but the database was already updated — leaving an inconsistent state (rejected in DB but error response returned).

**Fix:** Wrap in try/catch identical to the `approveProvider` pattern.

---

### BUG-013 · `Payment` Model Has Both `type` and `paymentType` Fields (Duplication)
**File:** `models/Payment.js` · Lines 20–28  
**Severity:** High — Data inconsistency risk

```js
type: {
    type: String,
    enum: ['advance', 'final'],
    required: true
},
paymentType: { // For new automation system
    type: String,
    enum: ['advance', 'final']
},
```

**Problem:** Two fields carry the same semantic meaning. In `routes/payment.js`, both are set simultaneously (`type: paymentType, paymentType`). But queries differ — `verify-automated` checks `payment.paymentType`, while other code checks `payment.type`. If one is set and not the other, logic breaks.

**Fix:** Choose one field name and migrate all usages.

---

### BUG-014 · `Booking` Model Has Both `date` and `bookingDate` Fields (Duplication)
**File:** `models/Booking.js` · Lines 29–36  
**Severity:** High — Date confusion across views and sorting

```js
date: { type: Date, required: true },
bookingDate: { type: Date, default: Date.now },
```

**Problem:** The `bookingDate` defaults to **now** (creation time), while `date` is the customer's requested appointment date. These are semantically different but both used interchangeably across controllers and views. Pre-save middleware tries to sync them, resulting in `bookingDate` being overwritten with the appointment date in some paths — erasing the actual creation timestamp.

**Fix:** Rename `bookingDate` → `createdAt` (which is already provided by `timestamps: true`) and use only `date` for the appointment. Remove the pre-save sync logic.

---

### BUG-015 · OTP Document Stores Sensitive Provider Data as Plain JSON (`userData`)
**File:** `models/OTP.js` · Line 31, `Controllers/authController.js` · Lines 192–228  
**Severity:** High (Security / Privacy)

```js
userData: { type: Object, required: true }
```

**Problem:** The full registration payload — including Aadhar card number, PAN card number, Cloudinary image URLs, and all personal info — is stored in the OTP document. While these expire in 10 minutes, they are stored in plaintext and accessible to anyone with MongoDB read access. A database dump would expose document numbers of all in-progress registrations.

**Fix:** Store only a minimal reference (phone + role) in the OTP document. Re-fetch or reconstruct provider data from session/redis after OTP verification.

---

## 🟡 MEDIUM — Feature partially broken, poor UX, technical debt that will bite

---

### BUG-016 · `feedback` Route Has No Authorization Check — Anyone Can View Any Booking's Feedback Page
**File:** `routes/feedback.js` · Lines 7–31  
**Severity:** Medium

```js
router.get('/:bookingId', isLoggedIn, async (req, res) => {
    const booking = await Booking.findById(req.params.bookingId)...
    // No check: does req.user own this booking?
```

**Fix:** Add: `if (booking.customer.toString() !== req.user._id.toString()) { return res.status(403)... }`

---

### BUG-017 · `feedback` Model Has `submittedBy` Field But `Booking.feedback` Schema Does Not
**File:** `routes/feedback.js` · Line 50 vs `models/Booking.js` · Lines 98–116  
**Severity:** Medium — Field silently dropped by Mongoose

```js
// In route:
booking.feedback = { rating, comment, submittedAt, submittedBy: req.user._id };

// In Booking schema feedback subdocument: no `submittedBy` field defined
```

**Fix:** Add `submittedBy: { type: ObjectId, ref: 'User' }` to the `feedback` subdocument schema.

---

### BUG-018 · `Complaint` Model Has No `timestamps: true` — `createdAt` Defined Manually and Not Indexed Properly
**File:** `models/Complaint.js`  
**Severity:** Medium — Sorting and querying by time will be slow; manual `createdAt` won't be auto-updated on document modification

```js
createdAt: { type: Date, default: Date.now }
// No `updatedAt`, no `timestamps: true`
```

**Fix:** Remove manual `createdAt`, add `{ timestamps: true }` to the schema options; or at minimum add a DB index on `createdAt`.

---

### BUG-019 · No Admin Complaint Management Feature (Complaints are User-Only)
**File:** `routes/complaints.js`, `models/Complaint.js`  
**Severity:** Medium — Operators cannot manage or respond to complaints

**Problem:** Complaints can be submitted by users but there is no admin view, no status-update endpoint, and no way for admins to close or respond. The `status` field (`pending`, `in-progress`, `resolved`) exists in the model but there is no route to update it.

---

### BUG-020 · `providerUserId` in Booking Model References Wrong Collection
**File:** `models/Booking.js` · Lines 10–13  
**Severity:** Medium — Bad reference causes failed `.populate()` calls

```js
providerUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ServiceProvider",   // ← the field name suggests it stores a User ID
},
```

**Problem:** The field is named `providerUserId` (implying a User `_id`), but the `ref` is `ServiceProvider`. In `bookingController.js` line 51, it is set to `provider.user._id` (a User ID) — but the schema says it references `ServiceProvider`. Populating `providerUserId` as `ServiceProvider` will find nothing. 

**Fix:** Either rename to `providerRef` and set `ref: 'ServiceProvider'` with the `ServiceProvider._id`, OR change `ref` to `'User'` if the intent is to store the provider's user record.

---

### BUG-021 · Provider Dashboard Creates a New ServiceProvider Record for Any Logged-In Provider
**File:** `routes/dashboard.js` · Lines 160–191  
**Severity:** Medium — Data integrity risk

```js
if (!serviceProviderData) {
    serviceProviderData = await ServiceProvider.create({
        user: userId,
        availability: defaultAvailability,
        earnings: 0,
        isVerified: false,
        isActive: true,
        // ← Missing required fields: aadharCard, panCard, aadharImage, panImage
    });
}
```

**Problem:** If a provider loads the dashboard and no `ServiceProvider` record exists, the system creates one with blank Aadhar/PAN fields, bypassing all document verification requirements. This allows a provider to access dashboard features without being verified.

**Fix:** Do not auto-create the record. Instead, redirect the provider to a "Complete your profile" page or show an appropriate error.

---

### BUG-022 · Rate Limiting for OTP is Per-Process and Not Per-User Across Distributed Instances
**File:** `utils/otp.js`  
**Severity:** Medium — Already noted in BUG-002 but also affects clustered/PM2 deployments

If the app runs under PM2 cluster mode (multiple Node.js workers), each worker has its own `otpRateLimit` Map. A user can bypass the 1-minute limit by hitting different worker processes.

---

### BUG-023 · `getBookingSuccess` Route Sorts Bookings by `createdAt` Descending But Includes Confirmed Status — Shows Wrong Booking
**File:** `Controllers/bookingController.js` · Lines 416–460  
**Severity:** Medium — Wrong booking shown on success page

```js
booking = await Booking.findOne({
    customer: req.user._id,
    status: { $in: ['confirmed', 'completed'] }   // ← 'pending' excluded
}).sort({ createdAt: -1 });
```

**Problem:** A newly created booking has `status: 'pending'`, not `confirmed`. So after a successful advance payment, the success page query returns `null` (no pending booking matches the filter), falls through to the fallback, and may show a completely different older booking.

**Fix:** Include `'pending'` in the status filter on the success page query.

---

### BUG-024 · `findServiceDetails()` Uses `forEach` and Misuses `.toString()` on Potentially Null Service Reference
**File:** `Controllers/serviceController.js` · Lines 746–758  
**Severity:** Medium — Crashes with TypeError when `s.service` is null (deleted/orphaned service)

```js
provider.servicesOffered.forEach((category) => {
    category.services.forEach((s) => {
        if (s.service._id.toString() === serviceId) {  // ← s.service may be null
```

**Fix:** Add null guard:
```js
if (s.service && s.service._id && s.service._id.toString() === serviceId)
```

---

### BUG-025 · `package.json` `"main"` Points to Non-Existent `index.js`
**File:** `package.json` · Line 4  
**Severity:** Medium — Misleading; will fail if used as a module or with tools that rely on `main`

```json
"main": "index.js"
```

The actual entry point is `app.js`. No `index.js` exists in the project.

**Fix:** `"main": "app.js"`

---

### BUG-026 · `serviceController.js` Exposes Google Maps API Key to All Users in the Provider Page Template
**File:** `Controllers/serviceController.js` · Lines 190, 245  
**Severity:** Medium (Security)

```js
googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY, // ✅ This is correct!
```

Exposing the server-side Maps API key to client HTML templates means it's visible in page source. If the key has no domain/IP restrictions configured in Google Cloud Console, it can be abused for unlimited billing.

**Fix:** Restrict the key to your domain in Google Cloud Console. Consider using a separate restricted key for frontend vs. backend.

---

## 🔵 LOW / MINOR — Code quality, edge cases, UX rough edges

---

### BUG-027 · `middleware.js` Typo — Error Message Says "create listing" Instead of Generic Auth Message
**File:** `middleware.js` · Line 4  
**Severity:** Low

```js
req.flash("error", "You must be logged in to create listing");
```

This is a generic auth guard; the message is copy-pasted from a different project context.

**Fix:** `"You must be logged in to access this page."`

---

### BUG-028 · `isServiceProvider` Middleware Does Not Check Authentication First
**File:** `middleware.js` · Lines 10–18  
**Severity:** Low — Can be reached by unauthenticated requests if route doesn't also use `isLoggedIn`

```js
module.exports.isServiceProvider = async (req, res, next) => {
    if (req.user && req.user.role === 'provider') {
        return next();
    }
    return res.status(403).json({ ... });
```

If `req.user` is undefined (unauthenticated), the function falls through to the 403 JSON response — which is at least safe. But combining this with `isLoggedIn` is the correct pattern and should be enforced.

---

### BUG-029 · `Booking` Model Has `in_progress` Status in Enum but Controllers Use `in_progress` Inconsistently
**File:** `models/Booking.js` · Line 39 vs `Controllers/bookingController.js` · Lines 538–539  
**Severity:** Low

Schema defines: `['pending', 'confirmed', 'rejected', 'completed', 'cancelled']` — no `in_progress`.  
Admin `updateBookingStatus` validates against: `['pending', 'confirmed', 'in_progress', 'completed', 'cancelled']`.

**Problem:** Status `in_progress` passes admin validation but will be rejected by Mongoose schema validation on the `Booking` model, causing a 500 error.

**Fix:** Add `'in_progress'` to the Booking schema enum, or remove it from the admin validation list.

---

### BUG-030 · OTP Model Has a Duplicate `createdAt` TTL Index Definition
**File:** `models/OTP.js` · Lines 35–44  
**Severity:** Low — Redundant index

```js
createdAt: {
    type: Date,
    default: Date.now,
    expires: 600,           // ← via schema field option
},
// ...
OTPSchema.index({createdAt: 1}, {expireAfterSeconds: 600}); // ← via explicit index
```

Both define a TTL index on `createdAt`. MongoDB will create two TTL indexes, which wastes resources and may cause a warning.

**Fix:** Use only the schema field `expires: 600`; remove the explicit `OTPSchema.index` call.

---

### BUG-031 · `adminNotifications.js` Logs Aadhar Card Number in Plain Text to Console
**File:** `utils/adminNotifications.js` · Line 51  
**Severity:** Low (Privacy / Compliance)

```js
Aadhar: ${serviceProvider.aadharCard}
```

Aadhar numbers are regulated PII under India's Aadhaar Act. Logging them to console (and potentially to log aggregation services like Datadog, CloudWatch, etc.) violates data protection obligations.

**Fix:** Mask the Aadhar number: `${serviceProvider.aadharCard.replace(/\d(?=\d{4})/g, '*')}`

---

### BUG-032 · No Input Sanitization Against NoSQL Injection
**Files:** All controllers doing `User.findOne({ phone })` with user-supplied input  
**Severity:** Low (potential in combination) — Mongoose provides some protection but raw query operators could be injected via JSON body

For example: `POST /login` with body `{ "phone": {"$gt": ""} }` could match all users.

**Fix:** Use `express-mongo-sanitize` middleware to strip `$` operators and `.` from user input.

---

### BUG-033 · `providerController.js` and `dashboardController.js` Are Empty Files
**Files:** `Controllers/providerController.js`, `Controllers/dashboardController.js`  
**Severity:** Low — Dead code / misleading project structure

These files have 0 bytes. Their functionality is spread across other controllers and route files, but their existence implies they should be the authoritative place for that logic.

---

### BUG-034 · `chatMessage` Model Has No `.js` Extension
**File:** `models/chatMessage` (no extension)  
**Severity:** Low — Works due to Node.js resolution, but breaks IDE tooling, linting, and type inference

**Fix:** Rename to `chatMessage.js`.

---

### BUG-035 · `/db-status` Route Exposes Internal Database Info Without Auth
**File:** `app.js` · Lines 311–325  
**Severity:** Low (Security)

```js
app.get("/db-status", (req, res) => {
    res.json({
        status: ...,
        uri: process.env.MONGO_URI ? "URI configured" : "URI missing",
```

This endpoint is accessible to anyone, leaking whether the database is connected and configured. While it doesn't expose the full URI, it provides useful reconnaissance data to attackers.

**Fix:** Add `isAdmin` middleware or at minimum restrict to localhost/internal network.

---

### BUG-036 · Complaint Submission Has No Validation on `subject` or `description`
**File:** `routes/complaints.js` · Lines 32–50  
**Severity:** Low

No length limits or sanitization on subject/description fields. A malicious user could submit 100MB complaint payloads.

**Fix:** Add `express-validator` checks for min/max length.

---

### BUG-037 · `getProviderDashboardData` Updates Earnings on Every Dashboard Load
**File:** `routes/dashboard.js` · Lines 346–351  
**Severity:** Low — Performance issue

```js
if (totalEarnings !== serviceProviderData.earnings) {
    await ServiceProvider.findByIdAndUpdate(serviceProviderData._id, {
        earnings: totalEarnings,
    });
```

Every time the provider opens the dashboard, this runs a full aggregation over all completed bookings and writes to MongoDB if the value changed. Under load with many providers, this creates unnecessary write traffic.

**Fix:** Update earnings only on booking completion (event-driven), not on dashboard load.

---

### BUG-038 · Service Area `coordinates` Not Indexed as 2dsphere in ServiceProvider
**File:** `models/ServiceProvider.js` · Line 452  
**Severity:** Low — Performance/correctness

```js
serviceProviderSchema.index({ "businessAddress.coordinates": "2dsphere" });
```

The `serviceArea` field also has `coordinates` but it's stored as `{ latitude, longitude }` (not GeoJSON), and there's no 2dsphere index on it. MongoDB `$near` queries require GeoJSON format + 2dsphere index.

**Fix:** Convert `serviceArea.coordinates` to GeoJSON format (`{ type: 'Point', coordinates: [lng, lat] }`) and add a 2dsphere index.

---

## Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | 6 |
| 🟠 High | 9 |
| 🟡 Medium | 12 |
| 🔵 Low / Minor | 11 |
| **Total** | **38** |

### Top 5 to Fix First
1. **BUG-004** — `showUserDetails` labeled-statement bug crashes all admin user-detail views.
2. **BUG-005** — Unauthenticated booking creation via `/payment/verify-automated`.
3. **BUG-001** — Provider payouts never actually execute (stub).
4. **BUG-003** — Wildcard CORS in production.
5. **BUG-006** — `SKIP_OTP=true` can disable all OTP in production.
