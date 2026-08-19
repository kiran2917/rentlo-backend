# Rentlo Platform - Production Server-Side Security Hardening Guide

This document outlines all mandatory server-side security measures, configuration standards, operational guidelines, and deployment practices for the **Rentlo** platform backend, database, and infrastructure.

---

## 1. Operating System & Server Environment Hardening

### A. System User & Access Control
- **Non-Root Execution:** Never run Django, Gunicorn, Celery, PostgreSQL, or Nginx as the `root` user. Create a dedicated unprivileged user (e.g., `rentlo`):
  ```bash
  sudo adduser --system --group rentlo
  ```
- **SSH Hardening (`/etc/ssh/sshd_config`):**
  - Disable password-based authentication (`PasswordAuthentication no`).
  - Disable root login (`PermitRootLogin no`).
  - Change default SSH port (e.g., to custom port `2222`).
  - Enforce SSH key-based authentication only (`Ed25519` keys recommended).

### B. Firewall & Network Exposure (`ufw`)
- Block all incoming ports except HTTPS (443), HTTP (80 - redirect only), and custom SSH:
  ```bash
  sudo ufw default deny incoming
  sudo ufw default allow outgoing
  sudo ufw allow 2222/tcp comment 'SSH'
  sudo ufw allow 80/tcp comment 'HTTP'
  sudo ufw allow 443/tcp comment 'HTTPS'
  sudo ufw enable
  ```
- **Internal Service Isolation:** Ensure PostgreSQL (`5432`) and Redis (`6379`) bind strictly to `localhost` (`127.0.0.1`) or private VPC subnet IPs. They must NEVER be publicly exposed to the internet.

---

## 2. Nginx & Reverse Proxy Configuration

Deploy Nginx in front of Gunicorn/Uvicorn to handle TLS termination, static asset delivery, rate limiting, and request buffering.

### Recommended Production Nginx Config (`/etc/nginx/sites-available/rentlo`)
```nginx
# Rate Limiting Zones
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=3r/s;

# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name api.rentlo.com;
    return 301 https://$host$request_uri;
}

# Production HTTPS Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.rentlo.com;

    # SSL Certificates (Let's Encrypt / Certbot)
    ssl_certificate /etc/letsencrypt/live/api.rentlo.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.rentlo.com/privkey.pem;
    ssl_trusted_certificate /etc/letsencrypt/live/api.rentlo.com/chain.pem;

    # SSL Cipher Suite & Protocol Hardening
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    server_tokens off;

    # Max Request Body Size (Prevents DoS via large file uploads)
    client_max_body_size 10M;

    location / {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Strict Rate Limit for Authentication & OTP Endpoints
    location /api/v1/auth/ {
        limit_req zone=auth_limit burst=5 nodelay;
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 3. Django Backend Code Security Controls

### A. Environment Configuration (`.env`)
- Store all sensitive credentials strictly inside `/backend/.env` file.
- **Never commit `.env` or hardcoded secret keys to version control.**
- Example `.env` checklist:
  ```env
  SECRET_KEY=use-a-strong-random-50-character-secret-key
  DEBUG=False
  ALLOWED_HOSTS=api.rentlo.com,rentlo.com
  DB_ENGINE=postgresql
  DB_NAME=rentlo_prod
  DB_USER=rentlo_user
  DB_PASSWORD=strong-database-password
  DB_HOST=127.0.0.1
  DB_PORT=5432
  CORS_ALLOWED_ORIGINS=https://rentlo.com,https://admin.rentlo.com
  ```

### B. Django Security Settings (`settings.py`)
```python
# Security Headers & Policies
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'

if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
```

---

## 4. PostgreSQL Database Hardening

1. **Dedicated Database User:** Create a non-superuser account for the application with permissions restricted to the `rentlo_prod` database:
   ```sql
   CREATE USER rentlo_user WITH PASSWORD 'strong_password_here';
   CREATE DATABASE rentlo_prod OWNER rentlo_user;
   GRANT ALL PRIVILEGES ON DATABASE rentlo_prod TO rentlo_user;
   ```
2. **Listen Address:** In `/etc/postgresql/15/main/postgresql.conf`:
   ```ini
   listen_addresses = '127.0.0.1'
   ```
3. **Encrypted Backups:** Automated daily database dumps using `pg_dump` compressed and encrypted before sending to offsite backup storage:
   ```bash
   pg_dump -U rentlo_user -h 127.0.0.1 rentlo_prod | gpg -c --batch --passphrase "backup-secret" > /backups/db_$(date +%F).sql.gpg
   ```

---

## 5. Cloud Storage (Cloudflare R2 / S3) Hardening

1. **Bucket Access Policy:** Keep S3/R2 buckets private (`Block all public access`).
2. **Presigned URLs:** Generate temporary expiring presigned URLs for private files (e.g., e-signatures, tenancy contracts, KYC ID proofs).
3. **MIME Validation:** Server-side validation of file extension and MIME type prior to returning upload presigned URLs.

---

## 6. Payment & Business Logic Protection

1. **Server-Side Pricing Computation:** Never trust price parameters passed from client requests. Recalculate pass prices, e-stamp fees, and listing payments directly on the backend.
2. **HMAC Webhook Verification:** Validate Razorpay / payment gateway webhooks using `RAZORPAY_WEBHOOK_SECRET` before marking transactions as successful.
3. **Atomic Transactions:** Wrap unlock credits and payment allocations in `transaction.atomic()` to prevent race condition double-spending.

---

## 7. Monitoring, Logging & Incident Response

1. **PII Scrubbing in Logs:** Rentlo backend features a custom `PIIScrubbingFilter` that redacts passwords, JWT tokens, and 10-digit phone numbers from log outputs.
2. **Fail2ban Integration:** Install Fail2ban to block IPs that repeatedly trigger 401/403 or SSH failure responses:
   ```bash
   sudo apt-get install fail2ban
   ```
3. **Log Rotation:** Ensure `/etc/logrotate.d/rentlo` compresses and rotates application log files (`security.log`, `audit.log`, `error.log`) daily, retaining logs for 90 days.
