# RENTLO COMPLETE PROJECT AUDIT REPORT

**System Name:** Rentlo Rental Property Marketplace & Governance Suite  
**Audit Type:** Source Code & Systems Architecture Forensic Audit  
**Audit Date:** August 15, 2026  
**Primary Tech Stack:** Django 5.0 (Python 3.11) + REST Framework + React 18 (Vite 8) + PostgreSQL / Cloudflare R2  

---

## 1. Executive Summary

Rentlo is a direct-owner rental property marketplace designed to remove traditional brokerage fees and simplify verified tenant-owner connections. The system features a dual-console architecture:
- **Tenant Marketplace (`/`):** Public property discovery, spatial polygon boundary searching, verified contact unlocking, and direct chat/visit scheduling.
- **Back-Office Consoles (`/owner/*`, `/admin/*`):** Onboarding workflows for Home Owners, Field KYC Agents, Sub-Admins, and Super Administrators.

---

## 2. Platform Revenue Model Architecture

Rentlo operates a 4-tier monetization model verified directly from models and views (`properties.PlatformSettings`, `unlocks.BuyerUnlock`, `unlocks.UnlockPass`, `earnings.CommissionRule`):

1. **Buyer Single Contact Unlock Fee (Pay-Per-Unlock):** Single fee (`buyer_unlock_fee`, default: ₹14.00) billed to buyers to reveal owner phone number & name.
2. **Buyer Multi-Pass Packages:** Tiered packages (`buyer_pass_starter_price` ₹39, `buyer_pass_smart_price` ₹79, `buyer_pass_pro_price` ₹129) granting multi-unlock access with validity days.
3. **Owner Property Registration Fees:** Category-wise onboarding fees:
   - Independent House / Villa: `owner_residential_fee` (₹99.00), 3-Pack (₹259), 6-Pack (₹499), 10-Pack (₹859)
   - Apartment / Flat / PG: `owner_apt_pg_fee` (₹149.00), 3-Pack (₹349), 6-Pack (₹649), 10-Pack (₹999)
   - Commercial (Office / Retail / Warehouse): `owner_commercial_fee` (₹199.00), 3-Pack (₹449), 6-Pack (₹799), 10-Pack (₹1,199)
4. **E-Stamp Legal Lease Agreements:** Price per digital e-stamped lease agreement (`e_stamp_price`, default: ₹499.00).

---

## 3. Complete Adjustable Platform Settings Matrix

All revenue parameters, payment options, auth policies, and theme aesthetics are 100% adjustable via `/admin/settings` (persisting to `properties_platformsettings`):

| Configurable Parameter | Database Model Field | Default Value | Admin Console Location | Operational & Revenue Impact |
| :--- | :--- | :--- | :--- | :--- |
| **Single Contact Unlock Fee** | `buyer_unlock_fee` | ₹14.00 | Settings → General & Pricing | Sets pay-per-unlock price for tenants |
| **Buyer Starter Pass Price** | `buyer_pass_starter_price` | ₹39.00 | Settings → General & Pricing | Sets Starter multi-pass package price |
| **Buyer Smart Pass Price** | `buyer_pass_smart_price` | ₹79.00 | Settings → General & Pricing | Sets Smart multi-pass package price |
| **Buyer Pro Pass Price** | `buyer_pass_pro_price` | ₹129.00 | Settings → General & Pricing | Sets Pro multi-pass package price |
| **Bypass Buyer Payments** | `bypass_buyer_payment` | False | Settings → General & Pricing | If True, all contact unlocks are 100% FREE |
| **Bypass Owner Payments** | `bypass_owner_payment` | False | Settings → General & Pricing | If True, all owner property listings are FREE |
| **Buyer Payment Gateway** | `buyer_payment_gateway` | razorpay | Settings → Payment Gateways | Switches tenant billing: Razorpay vs Direct UPI |
| **Owner Payment Gateway** | `owner_payment_gateway` | upi | Settings → Payment Gateways | Switches owner onboarding: Direct UPI vs Razorpay |
| **Role-Based OTP Rules** | `*_require_otp_signup` | True | Settings → Auth & Security | Enforces SMS OTP verification per role |
| **E-Stamp Feature Toggle** | `enable_e_stamp_agreements` | False | Settings → E-Stamp & Legal | Enables/Disables digital legal lease creation |
| **E-Stamp Agreement Price** | `e_stamp_price` | ₹499.00 | Settings → E-Stamp & Legal | Sets legal tenancy e-stamp price |
| **Buyer Marketplace Theme** | `buyer_theme` | emerald_minimal | Settings → Theme & Branding | Switches public tenant portal aesthetic |
| **Consoles Theme** | `dashboard_theme` | emerald_minimal | Settings → Theme & Branding | Switches Owner & Admin console theme live |

---

## 4. Source Code Architecture & Directory Structure Audit

### Backend (`/backend`)
- **`accounts/`:** User identity, custom AbstractUser, phone OTP request/verify, role assignment (`buyer`, `owner`, `agent`, `sub_admin`, `admin`), Sub-Admin permission management, Agent KYC, and owner phone pre-registration lookup (`GET /api/v1/auth/check-phone/`).
- **`properties/`:** Property CRUD, City & Locality management, Leaflet map pinning, reverse geocoding, AI description generator (`GenerateDescriptionView`), saved searches, and platform settings.
- **`unlocks/`:** Single contact unlock initiation & HMAC verification, multi-pass subscription purchases (`UnlockPass`), manual UTR payment verification queue (`AdminUnlockListView`).
- **`moderation/`:** Property listing review queue (`ModeratePropertyView`), agent fraud flags (`AgentFraudListView`), and agent suspension (`SuspendAgentView`).
- **`chat/`:** Unlocked property inquiry messaging between buyers and owners (`ChatMessagesView`, `ChatThreadsView`).
- **`visits/`:** Owner visit slot creation (`OwnerSlotsView`) and buyer slot booking/status transitions (`BookSlotView`, `BookingActionView`).
- **`analytics/`:** Platform & regional metrics aggregation (`AnalyticsSummaryView`).
- **`earnings/`:** Field agent commission rules and earnings payout processing (`AgentEarningsSummaryView`).
- **`notifications/`:** In-app notification queue and read receipts.
- **`media/`:** R2/S3 presigned URL generator and Pillow image processing (EXIF metadata stripping & WebP conversion).

---

## 5. User Roles & Permission Matrix

| Module / Action | Buyer (Tenant) | Home Owner | Field Agent | Sub-Admin | Super Admin |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Marketplace Search** | READ | READ | READ | READ | READ |
| **Unlock Owner Contacts** | CREATE / READ | FORBIDDEN | FORBIDDEN (403) | FORBIDDEN (403) | ADMIN ACT |
| **Property Onboarding** | — | CREATE / EDIT | CREATE (Assigned) | CREATE (Flagged) | FULL CRUD |
| **Listing Moderation** | — | — | — | REVIEW (Flagged) | APPROVE / REJECT |
| **User CRM & Status** | SELF READ | SELF READ | SELF READ | READ / FILTER | TOGGLE ACTIVE |
| **Sub-Admin Delegation** | — | — | — | — | FULL CRUD |
| **Theme & Settings** | READ | READ | READ | READ (Flagged) | FULL CONFIGURE |

---

## 6. Implementation Status & Summary Table

| Module | Feature | Implementation Status | Notes |
| :--- | :--- | :--- | :--- |
| **Auth** | Cookie JWT & Phone Check | `IMPLEMENTED` | HttpOnly cookies + real-time phone lookup |
| **Auth** | OTP Engine | `IMPLEMENTED` | Scoped rate limits on SMS OTP |
| **Properties** | Leaflet & Polygon Search | `IMPLEMENTED` | Map radius & custom polygon filter |
| **Properties** | Staff Owner Onboarding | `IMPLEMENTED` | Disables password if owner exists, mandates if new |
| **Unlocks** | Razorpay & UTR Unlocks | `IMPLEMENTED` | HMAC verified single unlocks & multi-passes |
| **Governance** | Sub-Admin Management | `IMPLEMENTED` | Granular permission flags |
| **Governance** | Live Theme Sync Engine | `IMPLEMENTED` | Event-driven instant dual-console theme updates |
| **Visits** | Visit Scheduling | `IMPLEMENTED` | Slot creation & booking flow |
| **Chat** | Buyer-Owner Inquiry Chat | `IMPLEMENTED` | Restricted to unlocked properties |
| **Lease** | Digital Lease Agreement | `PARTIALLY IMPLEMENTED` | Canvas signature & template generation |
| **Scale** | WhatsApp Lead Alerts | `FUTURE WORK` | Automated WhatsApp API messaging |
