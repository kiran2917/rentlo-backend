# Architecture Rules

*Author: Principal System Architect*

This document serves as the persistent standard for the Rentlo platform. Every future change, feature addition, and bug fix must strictly adhere to these rules. Any violation of these principles compromises the integrity, security, and scalability of the marketplace.

---

## 1. Security Rules

- **Zero Hardcoded Secrets**: Never hardcode API keys, credentials, or secrets in the codebase. All sensitive values must be injected via environment variables. These values must never be committed to version control.
- **Strict Webhook Verification**: Every payment webhook (Razorpay/Cashfree) must explicitly verify the cryptographic signature before processing the payload. Reject and log any unverified payload immediately. Never trust the payload data alone.
- **Server-Side Authorization**: Every API endpoint must enforce role-based permission checks server-side using Django REST Framework's permission classes (e.g., `IsAdmin`, `IsAgent`). Never rely on the frontend hiding a button as a security measure.
- **JWT Lifecycle Management**: JWT tokens must have sensible expirations (e.g., 24 hours for access tokens, 7 days for refresh tokens). Infinite-lived tokens are strictly prohibited.
- **Input Validation & Sanitization**: All user input must be rigorously validated and sanitized server-side. Frontend validation is exclusively for user experience, not security.
- **Server-Side Location Masking**: Location masking (offsetting exact coordinates for non-paying users) must occur exclusively in the API response serialization layer. The database must always hold the true, exact value. Never maintain a separate "fake" copy of the coordinates in the database.
- **Rate-Limiting**: Sensitive endpoints—including login, OTP generation/verification, and unlock initiation—must be strictly rate-limited to prevent brute-force and scripted abuse.
- **Secure File Uploads**: File uploads (images, consent proofs) must be validated for MIME type and file size strictly server-side. Never trust client-side file checks.
- **VPS Hardening**: Firewall rules on the VPS must be strictly minimal (e.g., only ports 80, 443, and 22 open). SSH access must be key-only; password authentication must be disabled.
- **Off-Server Backups**: All database backups must be automated and securely pushed to off-server object storage (e.g., Cloudflare R2 / Backblaze B2). Never rely on the VPS disk as the sole backup source.
- **Third-Party Trust Boundary**: Any new third-party integration (payment gateways, SMS providers, cloud storage) must be authenticated via signature/key verification. External data is untrusted by default.
- **Data Privacy & PII Handling**: Personally Identifiable Information (PII) such as owner phone numbers must be strictly protected. PII must NEVER be printed in application logs or crash reports.
- **Idempotency in Financials**: All payment endpoints and webhooks MUST be idempotent. If Razorpay fires the `payment.captured` webhook twice for the same order, the system must not generate duplicate unlocks or duplicate earning entries. Use database constraints or status checks before processing.

---

## 2. Scalability & Resilience Rules

- **No Hardcoded Business Logic**: Hardcoded cities, localities, prices, or commission rates are strictly forbidden. All business rules must be database or config-driven, leveraging the existing `City`, `Locality`, and `CommissionRule` architectural patterns.
- **Multi-City First Design**: Every new feature must be designed to support multi-city operations from day one, even if only one city is currently active. Use global city selectors and ensure all filtering takes `city_id` into account.
- **Database Query Optimization**: Queries must utilize proper indexing on frequently filtered and joined fields (e.g., `status`, `city`, `agent`, `created_at`). Avoid unindexed queries or full table scans on tables that will scale.
- **Asynchronous Processing**: Long-running or non-instant operations (e.g., sending notifications, expiry checks, webhook retries, image processing) must be offloaded to Celery background jobs. Never block the main HTTP request-response cycle.
- **Object Storage for Media**: All media files must be uploaded to object storage (Cloudflare R2) and delivered via CDN. Media must never be stored on the application server's local disk in production.
- **Strict Pagination**: API responses must be paginated for any list endpoint expected to grow beyond a small fixed size. Never return unbounded result sets to the client.
- **Additive & Reversible Migrations**: New features must be additive and backward-compatible with existing production data. Avoid breaking migrations. All database migrations must be safely reversible.
- **Dormant-by-Default Financials**: Any commission, payout, or fee logic must remain strictly dormant unless an explicit, active configuration rule exists. Never assume a default charge or payout without explicit configuration.
- **Database Locking for Concurrency**: Critical financial transactions (e.g., wallet deductions, earnings generation) must use explicit database row-level locking (e.g., `select_for_update()`) to prevent race conditions during concurrent requests.
- **Fail Gracefully (Circuit Breakers)**: If a third-party service (like Razorpay or an SMS provider) is down, the system must not crash. Implement retries with exponential backoff for Celery tasks, and return graceful error messages to the user.

---

## 3. Code Quality & Lifecycle Rules

- **No Dummy Data in Production Paths**: Hardcoded placeholders, dummy text, labels, or sample data are prohibited in production code paths. All user-facing content must be data-driven or securely configured.
- **Observability First (Logging)**: No silent failures. All exceptions must be caught and logged with structured context (e.g., `user_id`, `request_id`). APM (Application Performance Monitoring) principles must be followed to track API latency.
- **Feature Flags**: Large architectural changes or incomplete features must be hidden behind feature flags. This allows safe merging into `main` without exposing unstable functionality to production users.
- **Soft Deletes for Auditing**: Never use `DELETE` operations on core tables (e.g., `User`, `Property`, `EarningEntry`). Always use a soft-delete mechanism (e.g., `is_deleted = True` or `status = 'archived'`) to maintain financial and operational audit histories.
- **No Dead UI Elements**: Every interactive UI element (buttons, links, toggles) must have a real, working handler tied to a functional API call. Empty handlers or non-functional UI elements are not allowed.
- **Robust UI States**: Every list or table screen must implement fully functional `loading`, `empty`, and `error` states as real, distinct components.
- **API Versioning & Consistency**: All new endpoints must follow the existing `/api/v1/` versioning convention and utilize the established permission-class patterns. One-off exceptions are not permitted.
- **Unified Design System**: Maintain the single design system already established (colors, spacing, typography). Do not introduce ad-hoc styling or inline CSS that breaks out of the established design language.

---

## 4. Process Rules

**Before implementing any new feature or executing any prompt in this project, you must cross-check the requirements against this file.**

If a requested change would violate any rule stated above (e.g., introducing a hardcoded value, omitting a server-side permission check, processing an unverified webhook, or relying on client-only security), you must **explicitly flag the violation** instead of silently implementing it, and propose the fully compliant alternative architecture.

**Documentation Sync**: After implementing any new feature, workflow, or architectural change, you MUST update `PROJECT_OVERVIEW.md` to reflect the current, real state of the project. The overview document must never drift from the actual implementation.

---

## 5. SECURITY THREAT CHECKLIST

This checklist acts as a concrete, testable set of rules specifically tailored to the Rentlo stack (Django REST Framework, PostgreSQL, React, Razorpay/Cashfree, Celery/Redis, VPS with Nginx). Every feature must be checked against these points.

### SQL Injection
- All database queries must use Django ORM or parameterized queries.
- Zero raw SQL string concatenation anywhere in the codebase.
- No usage of `.raw()`, `.extra()`, or `cursor.execute()` with unparameterized strings or f-strings containing user input.

### Server-Side Request Forgery (SSRF)
- Any endpoint that fetches a URL on the server's behalf (e.g., webhook verification calls to Razorpay/Cashfree, future image-fetch-from-URL features) must only call an explicit allowlist of trusted domains (Razorpay's/Cashfree's documented API domains).
- Never accept or fetch an arbitrary user-supplied URL server-side.

### Insecure Deserialization
- No use of Python `pickle`, `eval()`, or `exec()` anywhere on data coming from a request, webhook payload, or file upload.
- All webhook payloads (Razorpay/Cashfree) must be parsed as JSON only and validated against their expected schema before use.

### Authentication Bypass
- Every endpoint except explicitly public ones (e.g., `GET /api/v1/cities`, `GET /api/v1/properties`, `GET /api/v1/health`) must have a DRF `permission_classes` enforced. DRF's default should never be left as `AllowAny` by accident.
- JWT validation must check token expiry and signature on every protected request, not just on login.
- Role checks (e.g., `IsAdmin`, `IsAgent`) must happen server-side in every view, not just via frontend route guards.

### Race Conditions
- **Unlock/Payment flow**: Use a database-level unique constraint or `select_for_update()` row lock when creating an `Unlock` row so the same buyer cannot trigger two simultaneous "unlock" requests for the same property and get double-charged.
- **Webhook Handlers**: Webhooks must be idempotent. If Razorpay/Cashfree sends the same webhook event twice, processing it twice must not double-unlock, double-count revenue, or double-create an `EarningEntry`. Use the gateway's event ID to check-and-skip already-processed events.
- **Listing Approval**: Listing approval/rejection by two moderators simultaneously must not leave the property in an inconsistent state. Use row locking or a status-transition guard (only allow approve/reject if current status is still `pending_review`).

### Business Logic Bugs
- **Data Masking**: The `exact_lat`/`exact_lng` and owner contact fields must be genuinely unreachable via any endpoint without a valid paid `Unlock` row. Calling "full" property details as an unauthenticated user or an unauthorized buyer must return masked/403 data.
- **Dynamic Pricing**: The unlock price must always be read dynamically from `city.unlock_price`. There must be no code path that defaults to a hardcoded ₹10 if the city lookup fails silently.
- **State Guards**: A rejected or expired listing cannot be unlocked or paid for. Unlock endpoints must validate `property.status == 'live'` before creating a Razorpay order.

### Cross-Site Scripting (XSS)
- React's default JSX escaping must be relied on everywhere.
- Use of `dangerouslySetInnerHTML` is strictly prohibited unless extensively justified and secured.
- Any user-submitted text (property description, agent notes, feedback notes) must be escaped on render, never inserted as raw HTML.
- Proper `Content-Security-Policy` headers must be set via Nginx to restrict script sources.

### Remote Code Execution (RCE)
- File upload handling (property photos, voice notes, consent proof) must validate the file type by actual content/magic bytes, not just by filename extension, before storing or processing.
- No endpoint should ever pass user input into a shell command, subprocess call, or template string that gets executed (e.g., no unsanitized `subprocess` or `os.system` calls).

### Insecure Direct Object References (IDOR)
- Every endpoint that takes an `{id}` in the URL (property, unlock, earning entry, saved search, notification) must verify the requesting user actually owns or has permission to access that specific object.
- It is not enough to verify the user is authenticated; the object query must be scoped (e.g., `filter(buyer=request.user)`).

### API Rate Limiting
- DRF throttling classes must be applied to: login (prevent brute force), OTP request/verify endpoints, unlock/payment initiation, and the public browse/search endpoints (prevent scraping/abuse).
- Define and enforce specific limits (e.g., login: 5/minute per IP, OTP: 3/10-minutes per phone number, unlock initiate: 10/hour per user) in settings.

### OTP Rate/Attempt Limiting
- OTP generation must be capped per phone number (e.g., max 3 requests per 10 minutes) to prevent SMS-bombing abuse.
- OTP verification must be capped on wrong attempts (e.g., lock after 5 wrong attempts, require new OTP request) to prevent brute-forcing.
- OTPs must expire (e.g., 10 minutes) and be strictly single-use.

### Database Connection Pooling
- PostgreSQL connections must use a proper pool (e.g., pgbouncer or Django's `CONN_MAX_AGE` setting correctly configured). `CONN_MAX_AGE` must not be left at default `0`, which opens/closes a connection per request under load.

### Caching
- Cacheable, non-sensitive public data (city list, locality list, live property browse results) must use Redis-backed caching with a sensible TTL (e.g., 60-120 seconds).
- Sensitive data (unlocked owner contact, payment status) must never be cached at a shared/public cache layer and must always be a fresh, permission-checked query.
