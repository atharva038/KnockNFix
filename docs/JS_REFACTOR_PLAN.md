# KnockNFix Frontend JS Refactor Plan

Status: In progress (Phase 1 underway)
Date: 2026-04-21
Scope: public/js/pages + related inline JS usage in views

---

## 1) Current Assessment

### 1.1 Is the current JS code correct?

Short answer: mostly functional, but high-maintenance and high-regression risk.

What is good:
- Features are implemented and wired to real endpoints.
- Existing scripts were recently reorganized by domain under public/js/pages.
- Most flows have basic null checks and error handling.

What is risky or outdated:
- Very large files with mixed responsibilities:
  - public/js/pages/provider/dashboard.js (~1187 lines)
  - public/js/pages/provider/locations.js (~911 lines)
  - public/js/pages/customer/dashboard.js (~809 lines)
- Multiple DOMContentLoaded blocks in the same file (provider dashboard has 3 blocks).
- Heavy global/window coupling and global functions used by inline onclick.
- Repeated direct DOM writes via innerHTML templates.
- Browser-native alert/confirm used as primary UX feedback in many paths.
- Network logic (fetch/axios) and UI rendering are tightly coupled.
- No reusable frontend service layer (API client, toast, modal helpers are duplicated).

Conclusion:
- Keep the existing stack (EJS + vanilla JS) for now.
- Refactor architecture and module boundaries first.
- Do not jump to framework migration yet.

---

## 2) Target Frontend Architecture (Recommended "New Way")

### 2.1 Keep stack, modernize patterns

Use progressive vanilla JS modularization:
- Keep server-rendered EJS.
- Split scripts into small modules per feature.
- Minimize globals and inline handlers.
- Use event delegation + data-action attributes.
- Centralize API and UI utilities.

### 2.2 Proposed structure

public/js/
- core/
  - dom.js (query helpers, safe binding)
  - events.js (delegated event binding)
  - api.js (fetch wrapper, timeout, JSON handling)
  - notify.js (toast/flash abstraction replacing alert)
  - state.js (small page-scoped state helpers)
- features/
  - booking-actions.js
  - profile-editor.js
  - availability-manager.js
  - payout-history.js
  - location-map.js
  - travel-fee.js
  - payment-flow.js
- pages/
  - provider/dashboard.js (orchestrator only)
  - provider/locations.js (orchestrator only)
  - customer/dashboard.js (orchestrator only)

Rule:
- page file = bootstrap/orchestrator only
- feature file = one bounded behavior
- core file = shared utility only

---

## 3) Refactor Phases

## Phase 0: Baseline and Guardrails

Goal:
- Freeze behavior before internal rewrites.

Tasks:
- Capture page-level smoke checklist for:
  - provider dashboard
  - provider locations
  - customer dashboard
  - booking + booking-confirm payment flow
  - admin provider-payouts
- Add simple front-end console sanity checklist (no uncaught errors on load for each page).
- Identify and list all inline onclick dependencies in views.

Exit criteria:
- We can verify no behavior change after each refactor step.

---

## Phase 1: Shared Foundation (No behavior change)

Goal:
- Remove duplicated plumbing first.

Tasks:
- Create shared utilities under public/js/core:
  - api.js: request(method, url, body, options)
  - notify.js: success/error/info/warn via Bootstrap toast
  - dom.js: qs/qsa + safe on() helper
- Replace direct alert usage in 1-2 low-risk scripts first (admin/provider-payouts + profile/edit).
- Keep old function names where inline handlers still depend on them.

Exit criteria:
- No script has duplicate toast helpers.
- At least 2 scripts use shared api + notify utilities.

Progress update (2026-04-21):
- Added shared frontend core modules under `public/js/core`: `dom.js`, `api.js`, `notify.js`.
- Migrated `public/js/pages/admin/provider-payouts.js` to shared `api` and `notify` helpers.
- Migrated `public/js/pages/profile/edit.js` to shared `api` and `notify` helpers while preserving `openEditModal` and `saveProfile` globals for inline handlers.
- Migrated `public/js/pages/payment/payment.js` to shared `api` and `notify` helpers with compatibility fallback.
- Added `notify.confirm(...)` in shared `public/js/core/notify.js` for centralized confirmation prompts.
- Migrated `public/js/pages/customer/dashboard.js` to shared `notify` + centralized `apiGet/apiPost` wrappers (using `KNFCore.api` with fallbacks).
- Updated script loading in:
  - `views/pages/admin/provider-payouts.ejs`
  - `views/components/customerDashboard/profile.ejs`
  - `views/pages/booking-confirm.ejs`
  - `views/pages/customerDashboard.ejs`
- Exit criteria status:
  - `at least 2 scripts use shared api + notify` => met
  - `no script has duplicate toast helpers` => pending full sweep in remaining page scripts

---

## Phase 2: Provider Dashboard Decomposition (Highest Priority)

Goal:
- Break the largest file into maintainable pieces.

Split public/js/pages/provider/dashboard.js into:
- features/provider/navigation.js
- features/provider/profile.js
- features/provider/bookings.js
- features/provider/availability.js
- features/provider/bank-details.js
- features/provider/payout-history.js

Migration rules:
- Keep a temporary compatibility export for functions used in inline handlers:
  - openEditModal
  - acceptBooking
  - rejectBooking
  - completeBooking
- Convert promise chains to async/await gradually only when touching the block.

Exit criteria:
- Page orchestrator file <= 180 lines.
- Each feature module <= 250 lines.
- Only one DOMContentLoaded/bootstrap entry in page script.

---

## Phase 3: Provider Locations Decomposition (Second Priority)

Goal:
- Isolate map, list, and settings concerns.

Split public/js/pages/provider/locations.js into:
- features/provider/map-loader.js
- features/provider/service-area-list.js
- features/provider/service-area-api.js
- features/provider/travel-fee.js
- features/provider/location-detect.js

Migration rules:
- Keep map state private in module scope, avoid window.providerData mutations where possible.
- Replace innerHTML construction with template helper or createElement for user-provided fields.

Exit criteria:
- locations page script becomes orchestrator-only.
- No direct API calls from render-only modules.

---

## Phase 4: Customer Dashboard + Payment Stabilization

Goal:
- Improve reliability and UX consistency.

Tasks:
- Split customer dashboard into modules:
  - navigation
  - booking-details-modal
  - payment-actions
  - cancellation-policy-ui
- Replace alert/confirm flows with Bootstrap modal + toast wrappers.
- Move payment request/verification logic to payment feature service.

Exit criteria:
- customer/dashboard.js <= 220 lines.
- payment.js uses shared api + notify utilities.

---

## Phase 5: Remove Inline Handlers from Views

Goal:
- Reduce global namespace dependencies.

Tasks:
- Replace onclick attributes with delegated listeners.
- Introduce data-action and data-id attributes where needed.
- Keep temporary bridge only for pages not migrated yet.

Exit criteria:
- No new inline onclick added.
- Existing critical pages migrated (provider/customer dashboards first).

---

## Phase 6: Optional Modernization Track

Goal:
- Improve type safety and build ergonomics (optional).

Options:
- Option A (lightweight): JSDoc + ESLint + checkJs.
- Option B (stronger): TypeScript incremental migration for core + features.
- Option C (later): Introduce bundling only if module graph becomes complex.

Decision guidance:
- If runtime bugs are from data shape mismatch, prioritize TypeScript.
- If payload is stable and team velocity matters more, stay on JSDoc.

---

## 4) Coding Standards for Refactor

- One public init() per page script.
- Prefer event delegation for dynamic lists/tables.
- Keep selectors centralized per feature module.
- Never mutate DOM and call API in same function unless trivial.
- Escape/sanitize user-sourced content before injecting HTML.
- Avoid direct window globals except temporary compatibility bridges.
- Use shared notify utility instead of alert.

---

## 5) Priority Order (Execution)

1. provider/dashboard.js
2. provider/locations.js
3. customer/dashboard.js
4. payment/payment.js
5. admin/provider-payouts.js
6. common/sidebarToggle.js and chat/chatbot.js cleanup

---

## 6) Risks and Mitigations

Risk:
- Breaking inline handler calls during module split.
Mitigation:
- Keep temporary global bridge and remove only after view migration.

Risk:
- Silent behavior drift in booking/payment flows.
Mitigation:
- Run Phase 0 smoke checklist after each module extraction.

Risk:
- Regressions from replacing alert/confirm with custom UI.
Mitigation:
- Do UX replacement after functional decomposition, not before.

---

## 7) Definition of Done

- No page script above 250 lines except map-init utilities.
- Core utilities are reused by all major page scripts.
- No duplicate toast or API wrappers.
- No new inline onclick usage in updated views.
- All phase smoke checks pass for provider/customer/admin critical pages.

---

## 8) Immediate Next Refactor Slice

Start with provider dashboard only:
- Extract bookings actions + modal logic first.
- Extract availability logic second.
- Keep profile/bank section as-is initially.
- Verify page behavior, then continue to locations.
