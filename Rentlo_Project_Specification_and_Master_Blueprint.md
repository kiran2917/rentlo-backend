# RENTLO — MASTER PROJECT SPECIFICATION & TECHNICAL BLUEPRINT

> **PROJECT DEVELOPMENT STATUS:** PLANNING & BLUEPRINT PHASE (NOT YET STARTED)  
> **DOCUMENT REVISION:** 1.0 (Master Pre-Development Technical Specification)  
> **CONFIDENTIALITY:** FOR MANAGEMENT, ENGINEERING & ARCHITECTURE ADVISORY  

---

## 📋 Executive Overview & Technical Vision

**Rentlo** is a next-generation zero-brokerage real estate web application designed specifically for the Indian rental ecosystem. The platform directly connects prospective property buyers and tenants with verified property owners, eliminating high traditional broker fees (1–2 months' rent).

```
====================================================================================================
METRIC / ATTRIBUTE               SPECIFICATION DESIGN VALUE
====================================================================================================
Platform Name                    Rentlo (Zero-Brokerage Real Estate Platform)
Target Technology Stack          Django 4.2 / React Vite / PostgreSQL 15 + PostGIS / Redis
Primary Domain Name              rentlo.in / api.rentlo.in
Development Status               PLANNING & BLUEPRINT PHASE (NOT YET STARTED)
Primary Revenue Engine           Buyer Micro-Unlocks + Credit Passes + Owner Category Listing Fees
Data Privacy Standard            DPDP Act 2023 Baseline Compliance Specifications
====================================================================================================
```

---

## 🏛️ 1. Complete Database Schema Specification

Below is the complete relational data model specification to be built in PostgreSQL with the PostGIS spatial extension:

### `User` Model (`accounts`)
- `phone` (CharField, Unique)
- `email` (EmailField, Unique)
- `roles` (JSONField, default=`["buyer"]`)
- `is_phone_verified` (BooleanField, default=`False`)
- `dpdp_consent_given` (BooleanField, default=`False`)
- `dpdp_consent_timestamp` (DateTimeField, nullable)
- `dpdp_consent_version` (CharField, default=`"1.0"`)

### `Property` Model (`properties`)
- `title` (CharField), `property_type` (residential/apt_pg/commercial)
- `price` (DecimalField), `status` (pending/live/under_negotiation/rejected)
- `exact_lat`, `exact_lng` (DecimalField)
- `location` (PointField, geography=True, GiST Spatial Index)
- `registration_fee_paid` (BooleanField), `registration_utr` (CharField)

### `Unlock` Model (`unlocks`)
- `buyer` (FK -> User), `property` (FK -> Property)
- `status` (CharField: pending/paid/failed)
- `razorpay_order_id`, `razorpay_payment_id` (CharField)
- `created_at` (DateTimeField, default=timezone.now)
- **Constraint:** `UniqueConstraint(fields=['buyer', 'property'], condition=Q(status='paid'))`

### `BuyerSubscription` Model (`unlocks`)
- `buyer` (FK -> User), `pass_type` (starter/smart/pro)
- `credits_total`, `credits_remaining` (IntegerField)
- `status` (CharField: pending/active/expired/depleted)
- `created_at` (DateTimeField, default=timezone.now)
- **Constraint:** `UniqueConstraint(fields=['buyer', 'pass_type'], condition=Q(status='pending'))`

### `IdempotencyKey` Model (`unlocks`)
- `user` (FK -> User), `key` (CharField), `endpoint` (CharField)
- `created_at` (DateTimeField)
- **Constraint:** `UniqueConstraint(fields=['user', 'key', 'endpoint'])`

### `PlatformSettingsAuditLog` Model (`properties`)
- `changed_by` (FK -> User, nullable)
- `field_name` (CharField), `old_value` (CharField), `new_value` (CharField)
- `ip_address` (CharField), `changed_at` (DateTimeField)

---

## 💰 2. Revenue Model & Pricing Specifications

```
====================================================================================================
REVENUE CATEGORY             CONFIG PARAMETER             DEFAULT SPEC       OPERATIONAL BEHAVIOR
====================================================================================================
Single Contact Unlock        buyer_unlock_fee             Rs. 14 / unlock    Unlocks owner PII for 1 property
Buyer Starter Pass           buyer_pass_starter_price     Rs. 39 (3 unlocks) Rs. 13.00 per unlock (30d validity)
Buyer Smart Pass             buyer_pass_smart_price       Rs. 79 (7 unlocks) Rs. 11.28 per unlock (30d validity)
Buyer Pro Pass               buyer_pass_pro_price         Rs. 129 (15 unlocks)Rs. 8.60 per unlock (30d validity)
Residential Listing Fee      owner_residential_fee        Rs. 99 / listing   Single family / Independent house
Apartment/PG Listing Fee     owner_apt_pg_fee             Rs. 149 / listing  Flat / Multi-unit PG accommodation
Commercial Listing Fee       owner_commercial_fee         Rs. 199 / listing  Office / Retail shop listing
Digital E-Stamp Draft        e_stamp_price                Rs. 499 / draft    Rental agreement draft generator
====================================================================================================
```

---

## 🔒 3. Security, Authentication & DPDP Act Specifications

1. **Authentication & Session Tokens**:
   - Store Access Tokens (30m) and Refresh Tokens (7d) strictly in **HttpOnly, SameSite=Lax JWT Cookies**.
   - Enable token rotation with blacklisting upon refresh (`BLACKLIST_AFTER_ROTATION = True`).
2. **Rate Limiting (DRF ScopedRateThrottle)**:
   - OTP Request: `5/minute`
   - OTP Verify: `10/minute`
   - Login: `10/minute`
   - Contact Unlock: `10/minute`
   - Chat Send: `30/minute`
3. **DPDP Compliance Specifications**:
   - `dpdp_consent_given` defaults to `False` (affirmative user action required).
   - Server-authoritative `CURRENT_DPDP_POLICY_VERSION = '1.0'` recorded upon verification.
   - Atomic PII anonymization & chat message scrubbing endpoint (`POST /api/v1/auth/data-erasure/`) wrapped in `transaction.atomic()` with HTTP 500 error fallback.

---

## ⚡ 4. Payment Gateway & Locking Specifications

1. **HMAC SHA-256 Webhook Verification**: Validate Razorpay signatures over raw request body; verify payload `created_at` timestamp within 300s.
2. **Atomic Event Deduplication**: Execute `cache.add(f"razorpay_webhook_txn:{event_type}:{payment_id}", "processed", timeout=86400)` before processing.
3. **Concurrency Locking**: Enforce `select_for_update()` inside `transaction.atomic()` for single contact unlocks and multi-pass credit deductions.
4. **Stale Pending Expiry**: Run `created_at__lt=stale_cutoff` cleanup to expire abandoned pending orders (>15m).

---

## 🔌 5. Complete REST API Specifications

- `POST /api/v1/auth/login/`: Authenticate user and issue HttpOnly JWT cookies.
- `POST /api/v1/auth/otp/request/`: Send OTP for login/signup (throttled 5/min).
- `POST /api/v1/auth/otp/verify/`: Verify OTP & record DPDP consent.
- `POST /api/v1/auth/data-erasure/`: Atomic PII anonymization and chat scrubbing.
- `GET /api/v1/properties/public/`: Public property catalog search with PostGIS distance filtering.
- `POST /api/v1/unlocks/initiate/`: Initiate contact unlock or deduct pass credit.
- `POST /api/v1/unlocks/passes/initiate/`: Initiate pass credit pack purchase.
- `POST /api/v1/webhooks/razorpay/`: HMAC SHA-256 signed payment gateway webhook.
- `GET /api/v1/properties/platform-settings/audit-logs/`: Admin audit log history.
- `GET /api/docs/`: Interactive Swagger UI documentation.

---

## 👥 6. User Roles & Platform Features Specifications

```
========================================================================================================================
USER ROLE               CORE PLATFORM PRIVILEGES & SPECIFIED FEATURES           ACCESS SCOPE & SECURITY
========================================================================================================================
Real Estate Agent       • Manage multi-owner property portfolios                 IsAgent permission scope. 
                        • Verified agent badge on property cards                 Access restricted to assigned client 
                        • Commission tracking & lead assignment                 leads & earned referral commissions.
                        • Sub-agent team management dashboard

Buyer / Tenant          • Spatial radius search (PostGIS / Haversine)           AllowAny for public property search. 
                        • Single unlock (Rs. 14) or Pass credits                IsAuthenticated for unlocks, chat, 
                        • Direct owner chat & visit scheduling                   and pass purchases.
                        • Saved search criteria & instant alerts

Property Owner          • Category listing submission (Res/Apt/Comm)            IsAuthenticated for listing creation. 
                        • Verified tenant lead inbox & inquiry tracking          Can view only leads generated for 
                        • Digital rental agreement draft builder                owned properties.

Platform Admin          • Moderation queue for listing approval/rejection       IsAdmin superuser scope. 
                        • Global fee & settings editor with audit logging       Immutable logging of setting mutations 
                        • Real-time revenue & analytics dashboard                and moderation actions.
========================================================================================================================
```

---

## 📖 7. End-to-End Real Estate Transaction Story Walkthrough

### Act 1: Property Listing & Onboarding Payment (The Owner Journey)
**Ramesh (Property Owner)** wants to rent out his fully-furnished 2BHK apartment in HSR Layout, Bengaluru for Rs. 32,000/month. He navigates to Rentlo, enters his mobile number, verifies the OTP, and affirmatively agrees to the DPDP Act consent version 1.0.

Ramesh uploads property photos, selects the 'Apartment / PG' category, and sets the location pin. The platform calculates the category listing fee of **Rs. 149**. Ramesh pays via UPI. Razorpay issues a signed webhook; Rentlo verifies the HMAC SHA-256 signature and creates a pending listing record.

### Act 2: Admin Moderation & Quality Verification (The Admin Journey)
**Priya (Platform Admin)** opens the Admin Moderation Queue. She reviews Ramesh's listing, verifies the high-resolution photos, confirms reasonable pricing for HSR Layout, and clicks **Approve Listing**. The property status immediately transitions to `live`.

### Act 3: Discovery & Radius Search (The Buyer Journey)
**Ananya (Tenant / Buyer)** is looking for a 2BHK flat near her tech park. She opens Rentlo, sets a 5 km radius search around HSR Layout, and filters for 'Apartment' under Rs. 35,000. PostGIS executes a spatial distance query (`location__distance_lte`) and displays Ramesh's flat as the top result.

### Act 4: Contact Unlock & Atomic Credit Deduction
Ananya loves the apartment photos but Ramesh's phone number is protected. Ananya clicks **Unlock Contact**. Since she holds an active **Smart Pass** (7 unlocks pack), Rentlo executes a `select_for_update()` lock inside a `transaction.atomic()` block, atomically deducting 1 credit and granting instant access to Ramesh's phone number.

### Act 5: Chat, Visit Scheduling & Deal Closure
Ananya initiates a direct chat on Rentlo with Ramesh and schedules a physical visit for Saturday. After inspecting the flat, Ramesh and Ananya agree on terms. Ananya uses Rentlo's digital agreement draft builder to generate a standardized rental agreement draft.

### Act 6: Agent Referral & Ecosystem Governance
**Vikram (Real Estate Agent)** monitors his agent dashboard for nearby unrepresented properties. When specialized agent listings are onboarded, Vikram assists with verification and earns a platform referral commission tracked transparently in his Agent Earnings Summary.

---

## 🌟 8. Comprehensive Master Feature Directory

```
========================================================================================================================
FEATURE MODULE                  COMPONENT SPECIFICATIONS                        FUNCTIONAL OPERATIONAL VALUE
========================================================================================================================
Authentication & Security       • Passwordless Mobile OTP Auth                  Passwordless SMS OTP login. Stores tokens 
                                • HttpOnly JWT Cookie Engine                    in HttpOnly SameSite=Lax cookies to 
                                • DPDP Consent Tracking                         neutralize XSS. Enforces affirmative DPDP 
                                • Atomic PII Data Erasure                       Act consent and single-transaction PII erasure.

Property Discovery & Search     • PostGIS Spatial Radius Query                  Search properties within a 1-50 km radius 
                                • Multi-Criteria Catalog Filters                using PostGIS distance queries. Supports 
                                • Bounding-Box Math Fallback                    price, category, city, and locality filters 
                                • Redis Search Response Cache                   with 5-minute Redis response caching.

Contact Unlock & Passes         • Single Contact Unlock (Rs. 14)                Protects owner phone numbers behind server 
                                • Starter / Smart / Pro Passes                  authorization. Unlocks contact info via 
                                • Atomic Credit Deduction Locks                 single unlocks or credit passes using 
                                • Stale Pending Order Cleanup                   select_for_update() row locks.

Payment Gateway & Webhooks      • Razorpay HMAC Signature Verify                Validates payment webhooks using HMAC SHA-256. 
                                • Atomic Webhook Deduplication                  Prevents race-condition double-crediting 
                                • Idempotency Key Enforcer                      via atomic cache.add() keys and 
                                • Dynamic Fee Calculator                        endpoint-scoped IdempotencyKey constraints.

Owner Listing Management        • Tiered Category Onboarding Fees               List Residential (Rs. 99), Apt/PG (Rs. 149), 
                                • High-Res Image Optimization                   and Commercial (Rs. 199) properties. 
                                • Lead Inbox & Inquiry Tracking                 Strips image EXIF metadata, converts to WebP, 
                                • Digital Agreement Draft Builder               and provides lead tracking inbox.

Agent Ecosystem                 • Multi-Owner Portfolio Manager                 Empowers agents to manage multiple client 
                                • Verified Agent Card Badges                    listings under a unified dashboard. Tracks 
                                • Referral Commission Analytics                 earned referral commissions transparently 
                                • Sub-Agent Lead Assignment                     and supports team lead distribution.

Admin & Audit Governance        • Property Moderation Queue                     Superadmins hold full governance over 
                                • Global Fee & Settings Editor                  listing approvals/rejections with notes. 
                                • Immutable Settings Audit Log                  Features a dynamic settings editor that 
                                • Real-Time Revenue Analytics                   automatically logs every fee/toggle mutation.
========================================================================================================================
```

---

## 🚀 9. Execution Roadmap & Phase Plan

```
====================================================================================================
PHASE           CATEGORY SPECIFICATION                      KEY EXECUTION MILESTONE
====================================================================================================
Phase 1         Core Development & Auth                     Django backend, models, JWT auth, React Vite frontend.
Phase 2         Payment Gateway & Locking                   Razorpay webhooks, HMAC signature, atomic row locks.
Phase 3         Infrastructure & Scale                      Celery Redis workers, PostGIS spatial search, Redis cache.
Phase 4         Production Deployment & Legal Gate          Nginx TLS 1.3 reverse proxy, Gunicorn WSGI, Legal sign-off.
====================================================================================================
```
