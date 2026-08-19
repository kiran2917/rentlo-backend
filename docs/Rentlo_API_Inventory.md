# RENTLO COMPLETE API INVENTORY

This document provides a comprehensive inventory of all RESTful API endpoints discovered in the Rentlo backend repository.

---

## 1. Authentication & User Management (`/api/v1/auth/`, `/api/v1/accounts/`)

| Method | Endpoint | Purpose | Authentication | Roles Allowed |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register/` | Register new user account | Public | All |
| `POST` | `/api/v1/auth/login/` | Obtain JWT token pair (Cookie) | Public | All |
| `POST` | `/api/v1/auth/refresh/` | Refresh expired access token | Public | All |
| `POST` | `/api/v1/auth/logout/` | Invalidate session cookies | Authenticated | All |
| `GET` | `/api/v1/auth/me/` | Fetch current profile & roles | Authenticated | All |
| `GET` | `/api/v1/auth/check-phone/` | Real-time owner phone check | Authenticated | Admin, Sub-Admin, Agent |
| `POST` | `/api/v1/auth/buyer-otp/request/` | Request OTP for phone auth | Public (Rate Limited) | All |
| `POST` | `/api/v1/auth/buyer-otp/verify/` | Verify OTP & issue session | Public (Rate Limited) | All |
| `GET` | `/api/v1/accounts/users/` | List system users | Authenticated | Admin, Sub-Admin |
| `GET` | `/api/v1/accounts/sub-admins/` | List sub-admins & flags | Authenticated | Admin |
| `POST` | `/api/v1/accounts/sub-admins/create/` | Create sub-admin account | Authenticated | Admin |
| `PATCH` | `/api/v1/accounts/sub-admins/{id}/permissions/` | Update permission flags | Authenticated | Admin |
| `DELETE` | `/api/v1/accounts/sub-admins/{id}/delete/` | Delete sub-admin account | Authenticated | Admin |

---

## 2. Properties & Marketplace (`/api/v1/properties/`)

| Method | Endpoint | Purpose | Authentication | Roles Allowed |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/properties/public/` | Search catalog with map/filters | Public | All |
| `GET` | `/api/v1/properties/public/{id}/` | Get public listing details | Public | All |
| `POST` | `/api/v1/properties/` | Onboard new property listing | Authenticated | Owner, Agent, Admin |
| `GET/PUT` | `/api/v1/properties/{id}/` | View/Update property listing | Authenticated | Owner, Agent, Admin |
| `GET` | `/api/v1/properties/my-properties/` | List owner's own listings | Authenticated | Owner |
| `GET` | `/api/v1/properties/owner-leads/` | Fetch tenant leads for owner | Authenticated | Owner |
| `GET` | `/api/v1/properties/cities/` | List active platform cities | Public | All |
| `GET` | `/api/v1/properties/cities/{id}/localities/` | Fetch localities for city | Public | All |
| `GET/PUT` | `/api/v1/properties/platform-settings/` | Get/Set theme & settings | Authenticated | Admin |
| `POST` | `/api/v1/properties/generate-description/` | Auto-generate AI description | Authenticated | Owner, Agent, Admin |

---

## 3. Contact Unlocks & Subscriptions (`/api/v1/unlocks/`, `/api/v1/pass/`)

| Method | Endpoint | Purpose | Authentication | Roles Allowed |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/properties/{id}/unlock/initiate/` | Initiate contact unlock | Authenticated | Buyer Only |
| `POST` | `/api/v1/properties/{id}/unlock/verify/` | Verify HMAC payment unlock | Authenticated | Buyer Only |
| `GET` | `/api/v1/properties/{id}/full/` | Fetch unlocked owner PII | Authenticated | Unlocked Buyer |
| `GET` | `/api/v1/my-unlocks/` | Fetch buyer unlock history | Authenticated | Buyer |
| `POST` | `/api/v1/pass/initiate/` | Initiate multi-pass purchase | Authenticated | Buyer Only |
| `POST` | `/api/v1/pass/verify/` | Verify pass payment | Authenticated | Buyer Only |
| `GET` | `/api/v1/unlocks/admin/list/` | List UTR manual verifications | Authenticated | Admin, Sub-Admin |
| `POST` | `/api/v1/unlocks/admin/{id}/action/` | Approve/Reject UTR payment | Authenticated | Admin, Sub-Admin |

---

## 4. Moderation, Visits & Messaging

| Method | Endpoint | Purpose | Authentication | Roles Allowed |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/moderation/properties/{id}/moderate/` | Approve or reject listing | Authenticated | Admin, Sub-Admin |
| `GET` | `/api/v1/chat/threads/` | List active chat threads | Authenticated | Buyer, Owner |
| `GET/POST`| `/api/v1/chat/property/{id}/` | Read/Send inquiry messages | Authenticated | Buyer, Owner |
| `GET/POST`| `/api/v1/visits/my-slots/` | View/Create visit slots | Authenticated | Owner |
| `POST` | `/api/v1/visits/slots/{id}/book/` | Book inspection visit slot | Authenticated | Buyer |
