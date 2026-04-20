# KnockNFix — Complete Feature List

> Home services marketplace connecting customers with verified service providers.
> Stack: Node.js · Express · MongoDB (Mongoose) · EJS · Passport.js · Razorpay · Cloudinary · Twilio / 2Factor.in

---
  
## 1. Authentication & User Management

### 1.1 Registration
- **Customer Registration** — Name + Phone (Indian 10-digit), optional profile image upload via Cloudinary.
- **Service Provider Registration** — Extended form with email, full business address (street/city/state/pincode), Aadhar card (12-digit), PAN card (AAAA1111A format), and mandatory document image uploads (Aadhar + PAN images via Cloudinary).
- **Dual-mode form validation** — Both `express-validator` middleware and manual controller-level guards (double-checked for every field).
- **Duplicate guards** — Checks for unique phone, email, Aadhar card, and PAN card before persisting any data.
- **File cleanup on failure** — Cloudinary files are destroyed on validation errors or registration failures.

### 1.2 OTP-Based Verification (Registration)
- SMS OTP sent via **2Factor.in API** using the pre-approved `KnockNFixOTP` template.
- Three-tier SMS fallback: Template SMS → Manual OTP SMS → Explicit-type SMS.
- **Dev mode bypass** — `NODE_ENV=development` or `SKIP_OTP=true` skips real SMS and auto-verifies.
- In-memory rate limiting (min 1-minute cooldown; 2-minute for resend).
- OTP document TTL — MongoDB auto-expires OTP records after 10 minutes (TTL index).
- Session-backed OTP state (`req.session.verificationPhone`, `otpSessionId`).

### 1.3 Login (OTP-Based, Passwordless)
- Login with **phone number only**; OTP sent to phone.
- Account status checks before OTP dispatch — blocks `pending_approval`, `rejected`, and `suspended` accounts with specific error messages.
- Login OTP stored in OTP collection with same TTL as registration OTPs.
- **Dev mode** — Skips OTP and logs user in directly via `req.login()`.

### 1.4 Remember Me / Auto-Login
- Generates a `rememberToken` (crypto random) stored in the User record with a `rememberTokenExpires` timestamp.
- Three cookies set: `username`, `rememberToken`, `rememberMe`.
- On every request, a global middleware checks these cookies to auto-authenticate the user without re-login.

### 1.5 Logout
- Clears `rememberToken` cookies.
- Calls `req.logout()` and destroys the session.

### 1.6 Roles & Statuses
| Role | Description |
|------|-------------|
| `customer` | Book services |
| `provider` | Offer/receive bookings |
| `admin` | Full system management |

| Status | Description |
|--------|-------------|
| `active` | Full access |
| `unverified` | Phone not verified yet |
| `pending_approval` | Provider awaiting admin review |
| `rejected` | Provider rejected by admin |
| `suspended` | Account suspended |
| `inactive` | Inactive account |

---

## 2. Provider Onboarding & Admin Approval Workflow

### 2.1 Provider Approval
- After registration, provider status is set to `pending_approval`; a ServiceProvider record is created with all access flags `false`.
- Admin receives a console log notification detailing new registrant (name, phone, Aadhar, PAN, address, timestamps).
- Admin can **Approve** with granular permission toggles:
  - `dashboardAccess`
  - `canRegisterServices`
  - `canReceiveBookings`
  - `canAccessPayouts`
- Approval atomically updates both `User` and `ServiceProvider` records plus pushes a status-history entry.

### 2.2 Provider Rejection
- Admin provides a rejection reason (min 10 chars).
- Both `User.status` and `ServiceProvider.verificationStatus` are set to `rejected`.
- All access flags revoked.

### 2.3 Permission Management (Post-Approval)
- Admin can modify individual provider permissions at any time (toggle each of the 4 flags).
- Changes are logged to console; provider notification hooks are defined (email/SMS TODOs).

### 2.4 Document Verification Tracking
- Individual flags: `aadharVerified`, `panVerified`, `imagesVerified`, `allDocumentsVerified`.
- Composite `adminVerification` subdocument records who verified, when, and with what notes.
- Full status history array (`approvalWorkflow.statusHistory`).

---

## 3. Services & Categories

### 3.1 Category Management (Admin)
- Create, read, update, delete categories.
- Category image upload via Cloudinary.
- Toggle active/inactive per category.

### 3.2 Service Management (Admin)
- Create, read, update, delete services.
- Toggle active/inactive per service.
- Services belong to a category.

### 3.3 Service Browser (Customer-facing)
- **Category listing** page — All active categories with images.
- **Services by category** page — Active services under a chosen category.
- **Provider listing by service** — Available providers offering that service, optionally filtered by date/time/location.

### 3.4 Provider Registration of Services (Provider)
- Providers register services through `/dashboard/registerService`.
- Select service category + specific service, set a **custom price** and **years of experience**.
- Duplicate service guard — provider cannot register the same service twice.
- Auto-grouped within `servicesOffered` by category.

---

## 4. Location & Provider Discovery

### 4.1 Location Detection
- Browser Geolocation API prompts on the landing page; coordinates stored in session and user document.
- **Google Maps API** integration for geocoding and map display.
- Users can update their current location; stored as `{latitude, longitude, lastUpdated}` in the User model.

### 4.2 Provider Search & Ranking
- Multi-strategy location matching:
  1. **City-level text match** — Provider's `serviceArea.city` vs user's location string (with fuzzy Levenshtein ≤2 tolerance).
  2. **GPS distance** — Haversine distance calculation from `utils/distance.js`.
  3. **Service area radius** — Each provider can define multiple service areas with custom radii.
  4. **State-level keyword fallback** — Matches on common Indian state/city keywords.
  5. **Large service area fallback** — Providers with ≥30 km radius included regardless.
- Results sorted by distance (ascending); providers without coordinates sorted by name.
- Auto-expand search radius to 100 km if initial search returns zero results.

### 4.3 Availability Filtering
- 7-day weekly availability schedule per provider (Monday–Sunday), each day with multiple time-slot ranges.
- When date/time is passed in query, providers are filtered by availability and returned as `{available, unavailable}` lists.

---

## 5. Booking Flow

### 5.1 Booking Confirmation Page
- Pre-payment review: shows service, provider, date, address, cost breakdown.
- User can choose a saved address or enter a new one.
- Service-specific cost pulled from provider's `servicesOffered.services.customCost`.

### 5.2 Booking Creation (Post-Payment)
- Created after payment verification.
- Stores: customer, service, provider, date, GeoJSON coordinates, detailed address, notes, total cost.
- Sets `paymentStatus: 'partially_paid'`, advance (15% of total) and final (85%) payment tracking.
- Returns `bookingId` to the frontend.

### 5.3 Booking States
`pending` → `confirmed` → `in_progress` → `completed` / `cancelled`

### 5.4 Customer Booking Actions
- **View bookings** — `/booking/mybookings` with full service and provider details.
- **Cancel booking** — Any non-completed/non-cancelled booking can be cancelled with an optional reason.
- **Booking details page** — Full detail view with payment status.
- **Payment success page** — Post-payment confirmation landing page.

### 5.5 Provider Booking Actions (Dashboard)
- Accept / Reject incoming bookings (provider confirmation sub-document).
- Mark booking as in-progress or completed.
- Completing a booking triggers **automated provider payout** (see §6).

### 5.6 Admin Booking Actions
- Full CRUD on bookings with paginated admin list view.
- Update any booking's status.

---

## 6. Payment System (Razorpay)

### 6.1 Advance Payment (15%)
- Razorpay order created via `/payment/create-advance-order`.
- Payment record stored without a booking ID (created after verification).
- After payment verification, Booking is created and linked to Payment.
- Deposit automation status tracked.

### 6.2 Final Payment (85%)
- Only available after provider confirms the booking (`booking.status === 'confirmed'`).
- `/payment/create-final-order` and `/:id/complete-payment` routes.
- Triggers split calculation: 10% platform commission, 90% provider amount.
- Provider payout automation scheduled.

### 6.3 Payment Verification
- HMAC-SHA256 Razorpay signature verification on every payment callback.
- Two verification paths: `POST /payment/verify-payment` (manual) and `POST /payment/verify-automated`.
- Payment record created with `status: 'completed'` after signature check.

### 6.4 Provider Payouts
- Payout processing triggered on booking completion.
- Checks if provider has bank details; if not, marks `bank_details_required`.
- Adds payout amount to `provider.pendingPayouts`.
- `createProviderTransfer` is implemented as a stub (TODO: real bank transfer via Razorpay Payouts API or IMPS).
- Razorpay Contacts, Fund Accounts, and Payouts APIs are configured with multi-path fallback logic.

### 6.5 Payment Records
Payment model tracks: booking reference, Razorpay IDs, amount, type (advance/final), status, commission, providerAmount, split details, automation status.

---

## 7. User & Provider Dashboards

### 7.1 Customer Dashboard
- Booking statistics (total, pending, confirmed, completed, cancelled).
- List of all bookings with service/provider info, payment and automation status.
- Quick access to service catalog.
- Recent payments panel.

### 7.2 Provider Dashboard
- Booking statistics + month-over-month booking increase percentage.
- Earnings summary with commission deduction (10%).
- Rating/reviews aggregate.
- Registered services list by category.
- Availability management (weekly schedule).
- Pending payouts info.

### 7.3 Admin Dashboard
- Platform-wide statistics: total users, customers, providers, pending providers, services, bookings.
- Revenue calculation.
- Recent bookings (last 10).
- System notification stats (pending providers, today's registrations, approved today).

---

## 8. Profile Management

### 8.1 Customer Profile
- Update name, email, profile image.
- Add/edit/delete saved addresses (Home / Work / Other) with coordinate support.

### 8.2 Provider Profile
- Update experience, specialization, bio.
- Manage service areas (city/state/pincode, GPS radius).
- Add portfolio images.
- Add/update bank details for payouts.
- Weekly availability schedule editor.

---

## 9. Feedback & Ratings

- Customers can submit a rating (1–5 stars) and comment after a completed booking.
- `recommend` boolean field on feedback (defined in model but not yet fully wired to UI routes).
- Provider's `averageRating` and `totalReviews` updated via `updateRating()` instance method.
- Feedback page loaded at `/feedback/:bookingId`.

---

## 10. Complaints

- Customers can submit complaints with a subject, description, and optional image attachments (Cloudinary).
- Complaints listed at `/complaints` (authenticated).
- Status tracking: `pending` / `in-progress` / `resolved`.
- No admin complaint management UI or status update API is currently implemented.

---

## 11. Chat

- Chat routes are defined (`/routes/chat.js`) and a `ChatMessage` model exists.
- A `/chatbot` route renders a chatbot page for authenticated users (AI or FAQ assistant).

---

## 12. Admin Panel

### 12.1 User Management
- List all users segmented by role and status.
- Individual user detail view (bookings if customer, services/booking counts if provider).
- Suspend / reactivate users.

### 12.2 Category & Service Management
- Full CRUD for both categories and services (see §3).

### 12.3 Provider Approval Queue
- Dedicated page listing all `pending_approval` providers.
- Modal with document images, provider info, and permission checkboxes.
- Approve/Reject on the same page.

### 12.4 Booking Management
- Paginated all-bookings view with status filter.
- Admin can update any booking's status.

### 12.5 Revenue Reporting
- Total revenue aggregated from completed bookings.
- Data export available (ExcelJS dependency present → likely CSV/XLSX export endpoint).

---

## 13. Notifications (Partial / Stubs)

- Admin notifications log to console on new provider registration.
- Provider approval/rejection notifications logged to console.
- Permission change notifications defined but actual SMS/email dispatch is TODO-commented.
- No real-time WebSocket/push notification system implemented yet.

---

## 14. Security & Middleware

- `isLoggedIn` — Session-based auth guard for all protected routes.
- `isServiceProvider` — Role check for provider-only actions.
- `isAdmin` — Role check for admin-only routes.
- CORS headers set globally (wildcard `*` — see bug list).
- Session with `httpOnly` cookies; `secure: true` in production.
- Rate limiting for OTP (in-memory Map).
- Method override for DELETE/PUT via HTML forms.
- Custom 404 and global error handlers.

---

## 15. Infrastructure & DevOps

- **Docker** — `Dockerfile` and `docker-compose.yml` for containerised deployment.
- **MongoDB Atlas** with connection pooling (`maxPoolSize: 10`, `minPoolSize: 5`).
- Graceful SIGINT shutdown (closes MongoDB connection).
- **Cloudinary** for all image storage (profile, documents, portfolio, category images).
- **`.env`** file for all secrets (MongoDB URI, session secret, Razorpay keys, Cloudinary, Google Maps, 2Factor API key).
- **nodemon** for development hot-reload.
- `test-connection.js` for standalone MongoDB connectivity testing.

---

## 16. API Endpoints Summary

| Prefix | Description |
|--------|-------------|
| `GET/POST /register` | Customer & provider registration |
| `GET/POST /verify-otp` | Registration OTP verification |
| `GET/POST /login` | Phone-based login |
| `GET/POST /verify-login-otp` | Login OTP verification |
| `GET /logout` | Logout |
| `GET /services` | Category listing |
| `GET /services/category/:id` | Services by category |
| `GET /services/:serviceId/providers` | Provider listing |
| `POST /booking/confirm` | Booking confirmation page |
| `POST /booking/create` | Create booking (post-payment) |
| `GET /booking/mybookings` | Customer booking list |
| `POST /booking/:id/cancel` | Cancel booking |
| `GET /booking/:id` | Booking detail |
| `POST /payment/create-advance-order` | Create Razorpay advance order |
| `POST /payment/verify-automated` | Verify automated advance payment |
| `POST /payment/verify-payment` | Verify manual payment |
| `GET/POST /dashboard` | Role-based dashboard |
| `GET/POST /profile` | Profile management |
| `GET/POST /feedback/:bookingId` | Feedback submission |
| `GET/POST /complaints` | Complaint management |
| `GET /admin/dashboard` | Admin dashboard |
| `GET /admin/users` | Admin user list |
| `GET /admin/pending-providers` | Pending provider approvals |
| `POST /admin/providers/:id/approve` | Approve provider |
| `POST /admin/providers/:id/reject` | Reject provider |
| `GET/POST /admin/categories` | Category CRUD |
| `GET/POST /admin/services` | Service CRUD |
| `GET /api/bookings` | Booking data API |
| `GET /api/location` | Location API |
| `GET /db-status` | Database health check |
| `GET /api/health` | Auth API health check |
