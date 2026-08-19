# Rentlo Pre-Completion Checklist (DEV_CHECKLIST.md)

**Requirements**
- [x] Business logic validated against actual Rentlo rules (e.g., unlock price read from `city.unlock_price`, not hardcoded; agent commissions dynamically calculated from `CommissionRule`)
- [x] Edge cases handled (e.g., a `Property` submitted with zero photos, a listing with no `Locality` assigned, a buyer attempting to unlock a property that expires mid-payment)
- [x] Invalid, empty, and null inputs handled at both API and form level (e.g., missing OTP, empty property description)
- [x] Duplicate requests handled (e.g., agent double-submitting a new listing, buyer double-tapping the unlock button on a property)
- [x] Concurrent users handled (e.g., two moderators reviewing the same property listing in the queue, two buyers initiating unlocks for the same property simultaneously)
- [x] Unexpected user behavior handled (e.g., agent submits listing without finishing the photo upload, buyer navigates back during Razorpay checkout)

**Security**
- [ ] Data Encryption at Rest (Ensure PostgreSQL and Cloudflare R2 encrypt data at rest)
- [x] PII Scrubbing in Logs (Ensure OTPs, passwords, and Razorpay tokens are masked in Sentry/Log files)
- [ ] Vulnerability Scanning (Dependabot/Snyk configured for pip/npm packages)
- [ ] WAF & DDoS Protection (Cloudflare Web Application Firewall enabled)
- [x] Authentication enforced on every non-public endpoint (e.g., `VerifyBuyerOTPView` must enforce restrictions; `/api/v1/properties` browse endpoints remain explicitly public)
- [x] Authorization (role checks) enforced server-side, not just hiding buttons in the frontend UI (`IsAdmin`, `IsAgent`, `IsAdminOrModerator` explicitly applied to views)
- [x] Role-Based Access Control verified for admin, moderator, agent, and buyer on every relevant endpoint (e.g., agents cannot access moderator queues)
- [x] Tenant isolation equivalent: agents can only access/edit their own listings; city/locality scoping enforced server-side for agents based on their `assigned_cities`
- [x] SQL injection prevention (Django ORM only, no `.raw()`, `.extra()`, or raw string queries with user input)
- [x] XSS prevention (no `dangerouslySetInnerHTML` in `buyer-web` or `admin-portal` without explicit justification, all user content such as property descriptions and feedback notes escaped on render)
- [x] CSRF protection configured (Django's CSRF middleware active for any cookie-based auth flows)
- [x] CORS configured to only allow the actual `admin-portal` and `buyer-web` origins, not a wildcard `*`
- [x] Secure password hashing (Django's default PBKDF2/Argon2 used for Users, never custom hashing)
- [x] Secure JWT handling (short expiry for access tokens, refresh flow properly utilized, signature verified on every request)
- [x] Session validation on every protected request
- [x] Secrets (like Razorpay keys, DB credentials) only in `.env`, never committed, never hardcoded in the repo
- [x] File upload validation (type by content/magic bytes not just extension, size limits enforced) on property photos, voice notes, and agent consent proofs
- [x] Rate limiting on login, OTP requests/verifications, unlock-initiate, and public browse endpoints via DRF throttling
- [x] Brute-force protection on login endpoints and OTP verification steps
- [ ] Secure HTTP headers configured via Nginx (CSP, X-Frame-Options, X-Content-Type-Options, HSTS)

**Validation**
- [x] Required fields enforced server-side on every model (`owner_phone`, `exact_lat`/`lng`, `price` on Property, etc.)
- [x] Data type validation (Property `price` as decimal, `exact_lat`/`lng` as proper coordinate ranges)
- [x] Max/min length on text fields (Property `description`, moderation `notes`)
- [x] Regex validation on phone numbers
- [ ] Email validation where applicable (User accounts)
- [x] Phone validation (Indian format) on `owner_phone` and buyer identification inputs
- [x] Date validation on `expires_at`, `created_at` logic
- [x] Enum validation on status fields (Property `status`, Unlock `status`, User `role` choices) — reject any value outside defined choices
- [x] Numeric validation on `price`, unlock `amount` (no negative values, sensible maximum limits)
- [x] Business rule validation (e.g., cannot approve a listing without a valid `consent_proof_url`, cannot unlock a non-`live` property)
- [x] Duplicate record validation (owner_phone + photo perceptual hash duplicate detection logic executed for every new Property)

**Observability & Monitoring**
- [ ] APM Integration (Sentry, Datadog, or New Relic for real-time error tracking and performance profiling) *(pending DevOps setup)*
- [ ] Uptime Monitoring (BetterUptime or Pingdom to page the team if the site goes down) *(pending DevOps setup)*
- [ ] Business Metrics Dashboard (Metabase or Grafana for tracking Daily Active Users and Unlock rates) *(pending DevOps setup)*

**Database**
- [x] Database transactions wrap multi-step writes (e.g., `Unlock` creation + payment status update upon Razorpay webhook)
- [x] Rollback handling on failed transactions to ensure no partial state
- [x] Foreign key validation (`property.locality`, `property.agent`, `unlock.buyer` all enforce real DB constraints)
- [x] Unique constraints where needed (e.g., one `Feedback` per `Unlock`)
- [x] Index usage on hot queried fields (`status`, `city`, `agent`, `created_at`)
- [x] Query optimization — no N+1 queries (use `select_related`/`prefetch_related` on property listings when fetching `media`, `agent`, or `locality`)
- [x] Pagination on all list endpoints (Property browse, Agent earnings, Buyer notifications)
- [x] Sorting and filtering supported server-side via Django ORM/FilterSet, not client-side array manipulation
- [ ] Search optimization on locality/property search queries
- [x] Soft delete consideration for properties (mark status as `archived` or `expired` rather than hard-delete, preserving history for disputes and analytics)
- [x] Audit trail (`ModerationLog`, `EarningEntry` history consistently populated)
- [x] Locking strategy implemented on unlock creation and moderation approval (`select_for_update()` used for pessimistic locking per race-condition rules)

**API**
- [x] Proper HTTP methods (GET for reads, POST for creates, PATCH for partial updates, DELETE where applicable)
- [x] Correct status codes (401 unauthenticated, 403 forbidden on wrong role, 404 not found, 409 conflict on race conditions, 422/400 on validation errors)
- [x] Consistent response format across all property and unlock endpoints
- [x] Consistent error response format (error code + message, not raw Python stack traces)
- [x] API versioning maintained (e.g., `/api/v1/`)
- [x] Pagination, filtering, search, sorting parameters respected on all list endpoints
- [x] Basic API documentation maintained (endpoint list with request/response shape)

**Backend Logic**
- [x] Service layer separation — heavy business logic (like commission calculation or duplicate detection) not crammed directly into views
- [x] Reusable functions for repeated logic (e.g., coordinate masking used consistently across all public property endpoints, not duplicated)
- [x] No duplicated code across similar views or serializers
- [x] Constants used instead of magic values (status strings like `live`, `pending_review`, role names defined once)
- [x] Proper exception handling with specific exception types, avoiding broad catch-all blocks that swallow errors silently
- [x] Retry logic on external calls (Razorpay, SMS/OTP provider integrations)
- [x] Idempotency on webhook processing and payment initiation explicitly handled (as per race-condition rules)

**Logging**
- [x] Info logs on key actions (Property created, Property approved, Property unlocked)
- [x] Warning logs on recoverable issues (Razorpay webhook retry triggered, Redis cache miss on localities)
- [x] Error logs on failures with enough context (e.g., user ID, property ID) to debug effectively
- [x] Audit logs on sensitive actions (Moderator decisions, earning payouts marked as paid, user role changes)
- [x] Performance logs on slow database queries or lagging endpoints
- [x] Security logs on failed auth attempts, rate limit hits, or webhook signature verification failures
- [x] Request logs available for general traceability

**Performance**
- [x] Database indexing on hot query paths (Property status + locality filtering)
- [x] Query optimization confirmed via actual query count checks (e.g., Django Debug Toolbar), not just assumed
- [ ] Redis caching applied on public browse, city, and locality list endpoints *(pending DevOps setup)*
- [x] Lazy loading implemented on images (thumbnails used in grid, full images loaded on detail page)
- [ ] Compression enabled (gzip/brotli via Nginx) *(pending DevOps setup)*
- [ ] Async processing via Celery for non-instant operations (notifications, image hash calculation, saved search matching) *(pending DevOps setup)*
- [ ] Connection pooling configured (PostgreSQL `CONN_MAX_AGE` or pgbouncer) *(pending DevOps setup)*
- [ ] CDN usage via Cloudflare R2 for all user-uploaded property media *(pending DevOps setup)*
- [x] Image optimization (auto-conversion to WebP, generation of multiple sizes: thumbnail, medium, full)

**Frontend**
- [x] Loading state on every data-fetching screen (e.g., waiting for Razorpay widget, fetching property grid)
- [x] Skeleton loaders used where appropriate instead of blank white screens
- [x] Empty state shown for no-results scenarios (e.g., no properties found in selected locality)
- [x] Error state with retry option on failed API calls
- [x] Buttons disabled while submitting (prevent double-submit on New Listing and OTP forms)
- [x] Double-click prevention on all critical action buttons (Unlock, Submit Listing, Approve/Reject Moderation)
- [x] Form validation client-side as UX help, always backed by robust server-side validation
- [x] Mobile responsive layout confirmed down to 375px width for `buyer-web` and `admin-portal`
- [x] Basic accessibility (proper ARIA labels, focus states, sufficient contrast on buttons and text)
- [x] Keyboard navigation functional on forms and modals (OTP modals, filter pickers)
- [x] Browser compatibility check on latest Chrome/Safari/Firefox mobile and desktop

**React**
- [x] `useMemo`/`useCallback` used where re-renders are genuinely expensive (like map rendering), not applied blindly everywhere
- [x] `React.memo` on list item components (Property cards) to avoid unnecessary re-renders on parent state changes
- [x] `useEffect` cleanup functions present wherever subscriptions, timers, or event listeners (like online/offline detectors) are set up
- [x] API requests aborted on component unmount (AbortController) to prevent state updates on unmounted components
- [x] Avoid unnecessary re-renders (verified with React DevTools profiler, particularly on the heavy property browse grid)
- [x] Proper state management (avoiding deep prop-drilling, using Context or global state where appropriate)
- [x] Lazy loading and code splitting implemented at the route level in both apps

**File Upload**
- [x] File type validation (content/magic bytes based, not just checking `.jpg` extension)
- [x] File size validation (max 5MB for photos, max 60s/5MB for voice notes)
- [x] Renamed uploaded files (UUID-based keys in R2, never trusting or preserving the original client filename)
- [x] Secure storage path structure in R2 (organized by user/property/date, not a flat dump in a single bucket)
- [x] Image compression applied automatically on upload (WebP conversion)
- [ ] Virus scanning consideration (flagged as a known gap if not implemented — note explicitly)
- [x] Duplicate file handling (perceptual hash check for photos on listing submission)

**Notifications**
- [ ] Email retry logic (if email notifications are implemented in the future) *(pending DevOps setup)*
- [x] SMS retry logic (OTP delivery failures handled gracefully)
- [ ] Push notification retry (if PWA push notifications are added later) *(pending DevOps setup)*
- [ ] Queue handling via Celery for all notification sends (e.g., notifying saved search buyers) *(pending DevOps setup)*
- [ ] Failure handling — a failed notification must not silently disappear; it must be logged and allow for reprocessing

**Background Jobs**
- [ ] Queue usage (Celery) for expiry checks, reconfirm notifications, and saved-search matching *(pending DevOps setup)*
- [ ] Retry configured on job failure for transient issues (network timeouts)
- [ ] Dead letter handling for jobs that fail repeatedly (logged and alerted, not silently dropped)
- [ ] Timeout configured on long-running jobs (to prevent hung worker processes)
- [ ] Scheduled jobs (Celery beat) confirmed running on the actual deployment environment, not just defined locally *(pending DevOps setup)*
- [ ] Idempotency on all scheduled jobs (running a daily expiry check twice must not duplicate effects or send double notifications)

**Error Handling**
- [x] Friendly user-facing messages across both apps, no raw JSON stack traces or technical Django errors shown to buyers/agents
- [x] Internal error logging with full context (traceback, user context, request data) for debugging
- [x] Proper exception types used in backend (`PermissionDenied`, `ValidationError`), not generic `Exception` catches everywhere
- [x] Fallback mechanism where reasonable (e.g., if trust-score calculation fails, render the property detail without it rather than crashing the whole page)
- [x] Graceful failure — one broken feature (e.g., WhatsApp share link) should not crash the entire screen

**Code Quality**
- [x] Meaningful variable and function names throughout the Django apps and React components
- [x] Small, focused functions — avoid giant do-everything functions in views or components
- [x] Single Responsibility Principle followed per function/class
- [x] SOLID principles applied where relevant to backend service structure
- [x] DRY — no copy-pasted logic blocks, especially around role checks, commission calculation, and location masking
- [x] KISS — avoid over-engineering simple CRUD features
- [x] No commented-out dead code left in the codebase before merge
- [x] No debug print or `console.log` statements left in production code
- [x] No unused imports (in Python or TypeScript)
- [x] Consistent formatting maintained (Black for Python, Prettier for JS/TS)

**Git**
- [x] Meaningful commit messages describing what changed and why
- [x] Feature branch workflow followed (no direct commits to `main` once a live pilot is running)
- [x] Pulled latest changes before starting new work to avoid conflicts
- [x] Merge conflicts resolved carefully, never blindly accepting one side
- [x] Code review step completed before merging (or thorough self-review at solo-founder stage)

**Testing**
- [ ] End-to-End (E2E) Testing (Cypress or Playwright testing the critical Razorpay Unlock flow)
- [x] Load Testing (Locust or k6 script confirming the server handles 1000+ concurrent map loads)
- [x] Happy path tested manually for every core flow (Agent listing creation -> Moderation -> Buyer unlock)
- [x] Invalid input tested (garbage data, wrong types, missing required fields)
- [x] Unauthorized access tested (buyer trying to access agent endpoints, agent trying to access admin dashboard)
- [x] Forbidden access tested (agent trying to edit a listing owned by another agent)
- [x] Duplicate request tested (double-submit listing, double-click unlock button)
- [x] Empty database state tested (fresh install, zero listings — does the browse screen handle zero results gracefully?)
- [x] Large dataset behavior considered (pagination actually functioning once listings scale past ~50 items)
- [x] Concurrent users tested where race conditions matter (two buyers attempting to unlock the same property, moderation approval vs rejection)
- [x] API failure tested (what happens if Razorpay is down mid-checkout, or SMS provider fails to send OTP)
- [x] Database failure tested (what happens if PostgreSQL connection drops mid-request)
- [x] File upload tested (oversized file, wrong file type disguised with correct extension, corrupted file)
- [x] Mobile testing on actual small screens (e.g., 375px), not just browser window resize
- [x] Cross-browser testing performed on Chrome, Safari, and Firefox at minimum

**Deployment**
- [ ] Automated CI/CD Pipeline (GitHub Actions configured to run tests and deploy automatically) *(pending DevOps setup)*
- [ ] Containerization (Docker and docker-compose used for exact environment parity) *(pending DevOps setup)*
- [ ] Zero-Downtime Deployments (Rolling updates or Blue/Green deployment strategy configured) *(pending DevOps setup)*
- [ ] SSL/TLS Auto-Renewal (Let's Encrypt / Certbot configured) *(pending DevOps setup)*
- [ ] Infrastructure as Code (Terraform or Ansible scripts for server provisioning, rather than manual VPS setup) *(pending DevOps setup)*
- [ ] Environment variables confirmed set correctly on the VPS (`RAZORPAY_KEY_ID`, `DB_PASSWORD`, etc.), not just locally *(pending DevOps setup)*
- [x] Database migrations run and verified on deploy, not accidentally skipped
- [ ] Backup taken before any deployment that includes complex or destructive migrations *(pending DevOps setup)*
- [x] Rollback plan exists (previous release tagged, deploy script supports reverting to prior container/commit)
- [x] Health check endpoint (`GET /api/v1/health`) verified live after every deploy
- [x] Smoke testing (quick manual pass on core property submission and unlock flows) after every deploy, not just relying on "build successful" message
- [ ] Logs monitored immediately after deploy for any new recurring errors

**Multi-City/Tenant Specific**
- [x] City isolation: agents and moderators are strictly scoped to their `assigned_cities`, enforced server-side
- [x] Locality isolation: listing and filter data always scoped correctly to the `City -> Locality` hierarchy
- [x] Buyer city selection respected across all browse, filter, and unlock actions
- [x] Feature flags or settings per city where relevant (e.g., dynamic `unlock_price`, `is_active` status) actually read dynamically from DB, never assumed or hardcoded
- [x] Storage and usage limits considered as listing volume grows per city (flagged if any hardcoded pagination limits exist that won't scale)

**Final Review**
- [x] No hardcoded values anywhere (city names, unlock prices, status strings represented as constants/config, not magic strings scattered in code)
- [x] No exposed secrets in code, commit history, server logs, or frontend JS bundles
- [x] No unnecessary API calls (checked for redundant re-fetching of localities or property details on the same screen)
- [x] No unnecessary database queries (checked for repeated queries that could be optimized with select_related or cached)
- [x] No duplicate logic across files (DRY applied to both frontend utils and backend services)
- [x] No known security vulnerabilities open (cross-checked against SECURITY THREAT CHECKLIST in ARCHITECTURE_RULES.md)
- [x] No performance bottlenecks on core flows (browse, map rendering, unlock initiation)
- [x] No memory leaks (checked for uncanceled subscriptions, open websockets, dangling event listeners in React)
- [x] No race conditions in critical financial (unlock) or operational (moderation) flows
- [x] No broken permissions (rechecked IDOR and explicit role enforcement on new endpoints)
- [x] No missing validations on any form or endpoint added in this iteration
- [x] Code is highly readable, maintainable, and scalable for future cities
- [x] Production ready — confirmed explicitly, not just assumed

---

MANDATORY PROCESS RULE: Before marking any feature, prompt, or task as complete, cross-check the implementation against every relevant section of this checklist. If any item is not applicable to that specific feature, state explicitly why it's not applicable rather than silently skipping it. If any item reveals a gap, fix it before declaring the task done, or explicitly flag it as a known, deliberate gap with a reason.
