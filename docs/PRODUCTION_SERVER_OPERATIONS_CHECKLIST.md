# Rentlo Platform — Master Production Server Deployment & Operations Playbook

This document contains the step-by-step production server setup, configuration standards, operational tasks, security hardening, and legal governance checklist required to deploy **Rentlo** live.

---

## 📋 EXECUTIVE DEPLOYMENT CHECKLIST

- [ ] **1. Server Provisioning & OS Hardening** (Ubuntu 22.04 LTS, non-root user, UFW firewall, SSH key-only access)
- [ ] **2. Domain & SSL/TLS Configuration** (DNS A-records, Let's Encrypt Certbot, HSTS preload)
- [ ] **3. PostgreSQL & PostGIS Spatial Database Setup** (PostGIS extension, unprivileged user, restricted listen address)
- [ ] **4. Redis Broker & Async Celery Worker Setup** (Redis server, Celery worker systemd service, Celery Beat service)
- [ ] **5. Python Environment & Gunicorn WSGI Application** (Virtualenv, dependencies, Gunicorn systemd service)
- [ ] **6. Nginx HTTP/2 Reverse Proxy & Rate Limiting** (Nginx server block, rate-limit zones, static file serving)
- [ ] **7. Production Environment File (`.env`) Secrets** (Secret keys, Razorpay credentials, Cloudflare R2 storage keys)
- [ ] **8. Automated Database Backups & Log Rotation** (Encrypted pg_dump cron job, 90-day log rotation, Fail2ban)
- [ ] **9. Legal Governance & Mandatory Privacy Review** (Formal attorney sign-off on DPDP data retention & privacy policies)

---

## 1. SERVER PROVISIONING & OS HARDENING

### Step 1.1: System User Creation
Run Django, Gunicorn, Celery, and Nginx as unprivileged system users:
```bash
sudo adduser --system --group --shell /bin/bash rentlo
sudo usermod -aG www-data rentlo
```

### Step 1.2: Firewall Configuration (`ufw`)
Deny all unapproved incoming traffic except HTTPS (443), HTTP (80 - redirect), and SSH (custom port 2222):
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 2222/tcp comment 'SSH Port'
sudo ufw allow 80/tcp comment 'HTTP Redirect'
sudo ufw allow 443/tcp comment 'HTTPS Production'
sudo ufw enable
```

### Step 1.3: SSH Hardening (`/etc/ssh/sshd_config`)
```ini
Port 2222
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
X11Forwarding no
MaxAuthTries 3
```
Restart SSH daemon:
```bash
sudo systemctl restart ssh
```

---

## 2. DOMAIN, DNS & SSL CERTIFICATE SETUP

### Step 2.1: DNS A-Record Mapping
Point domain A-records to the production VPS IP address:
- `rentlo.in` -> `192.0.2.1`
- `api.rentlo.in` -> `192.0.2.1`
- `www.rentlo.in` -> `192.0.2.1`

### Step 2.2: Let's Encrypt SSL Procurement (`certbot`)
```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d rentlo.in -d api.rentlo.in -d www.rentlo.in --agree-tos -m admin@rentlo.in
```

---

## 3. POSTGRESQL 15 & POSTGIS SPATIAL DATABASE

### Step 3.1: Installation & PostGIS Extension
```bash
sudo apt install -y postgresql postgresql-contrib postgis postgresql-15-postgis-3
```

### Step 3.2: Database & User Setup
```sql
sudo -u postgres psql

CREATE USER rentlo_user WITH PASSWORD 'STRONG_PRODUCTION_DB_PASSWORD_HERE';
CREATE DATABASE rentlo_prod OWNER rentlo_user;
\c rentlo_prod
CREATE EXTENSION postgis;
GRANT ALL PRIVILEGES ON DATABASE rentlo_prod TO rentlo_user;
\q
```

### Step 3.3: Network Isolation (`/etc/postgresql/15/main/postgresql.conf`)
Ensure PostgreSQL listend strictly on `127.0.0.1`:
```ini
listen_addresses = '127.0.0.1'
```

---

## 4. REDIS & ASYNC CELERY WORKERS

### Step 4.1: Redis Installation
```bash
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

### Step 4.2: Enable Async Celery Workers in Settings
In `/var/www/rentlo/backend/rentlo_backend/settings.py`:
```python
CELERY_TASK_ALWAYS_EAGER = False
CELERY_BROKER_URL = 'redis://127.0.0.1:6379/0'
```

### Step 4.3: Celery Systemd Service (`/etc/systemd/system/celery_rentlo.service`)
```ini
[Unit]
Description=Celery Redis Worker for Rentlo Async Image Processing & SMS Dispatch
After=network.target redis.service postgresql.service

[Service]
Type=forking
User=rentlo
Group=www-data
WorkingDirectory=/var/www/rentlo/backend
EnvironmentFile=/var/www/rentlo/backend/.env
ExecStart=/var/www/rentlo/backend/venv/bin/celery -A rentlo_backend worker --loglevel=INFO -D

[Install]
WantedBy=multi-user.target
```

---

## 5. PYTHON VIRTUAL ENVIRONMENT & GUNICORN WSGI

### Step 5.1: Repository Setup & Virtualenv
```bash
sudo mkdir -p /var/www/rentlo
sudo chown -R rentlo:www-data /var/www/rentlo
cd /var/www/rentlo
git clone <repository_url> .
cd backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### Step 5.2: Database Migrations & Static Collection
```bash
python manage.py migrate
python manage.py collectstatic --noinput
```

### Step 5.3: Gunicorn Systemd Service (`/etc/systemd/system/gunicorn_rentlo.service`)
```ini
[Unit]
Description=Gunicorn WSGI Application Daemon for Rentlo
After=network.target postgresql.service redis.service

[Service]
User=rentlo
Group=www-data
WorkingDirectory=/var/www/rentlo/backend
EnvironmentFile=/var/www/rentlo/backend/.env
ExecStart=/var/www/rentlo/backend/venv/bin/gunicorn --access-logfile /var/log/rentlo/gunicorn_access.log --error-logfile /var/log/rentlo/gunicorn_error.log --workers 4 --bind 127.0.0.1:8000 rentlo_backend.wsgi:application

[Install]
WantedBy=multi-user.target
```

---

## 6. NGINX REVERSE PROXY & RATE LIMITING

### Step 6.1: Active Server Configuration (`/etc/nginx/sites-available/rentlo`)
```nginx
# Rate Limiting Zones
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=3r/s;

server {
    listen 80;
    server_name rentlo.in api.rentlo.in www.rentlo.in;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name rentlo.in api.rentlo.in www.rentlo.in;

    ssl_certificate /etc/letsencrypt/live/rentlo.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rentlo.in/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    client_max_body_size 25M;

    # Single Page Application Frontend
    location / {
        root /var/www/rentlo/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Django Gunicorn API Proxy
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Authentication Endpoints Rate Limit
    location /api/v1/auth/ {
        limit_req zone=auth_limit burst=5 nodelay;
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static & Media Asset Delivery
    location /static/ {
        alias /var/www/rentlo/backend/staticfiles/;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    location /media/ {
        alias /var/www/rentlo/backend/media/;
        expires 7d;
    }
}
```

Enable site & test syntax:
```bash
sudo ln -s /etc/nginx/sites-available/rentlo /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 7. PRODUCTION ENVIRONMENT FILE TEMPLATE (`/backend/.env`)

```env
# Production Core Settings
DEBUG=False
SECRET_KEY=GENERATE_RANDOM_SECURE_50_CHARACTER_STRING_HERE
ALLOWED_HOSTS=rentlo.in,api.rentlo.in,www.rentlo.in,127.0.0.1

# PostgreSQL + PostGIS Configuration
DB_ENGINE=postgresql
DB_NAME=rentlo_prod
DB_USER=rentlo_user
DB_PASSWORD=STRONG_PRODUCTION_DB_PASSWORD_HERE
DB_HOST=127.0.0.1
DB_PORT=5432

# Redis & Cache Configuration
REDIS_URL=redis://127.0.0.1:6379/0

# CORS Security Allowed Origins
CORS_ALLOWED_ORIGINS=https://rentlo.in,https://www.rentlo.in

# Razorpay Production Payment Gateway Credentials
RAZORPAY_KEY_ID=rzp_live_PROD_KEY_HERE
RAZORPAY_KEY_SECRET=PROD_SECRET_KEY_HERE
RAZORPAY_WEBHOOK_SECRET=PROD_WEBHOOK_SECRET_HERE

# Cloudflare R2 / S3 Storage Credentials
R2_ACCESS_KEY_ID=CLOUDFLARE_R2_KEY_ID
R2_SECRET_ACCESS_KEY=CLOUDFLARE_R2_SECRET_KEY
R2_BUCKET_NAME=rentlo-media-prod
R2_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com

# DPDP Act Consent Version
CURRENT_DPDP_POLICY_VERSION=1.0
```

---

## 8. BACKUPS, LOG ROTATION & FAIL2BAN

### Step 8.1: Encrypted Daily Database Backup Script (`/var/www/rentlo/backup.sh`)
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/rentlo"
mkdir -p $BACKUP_DIR
FILE="$BACKUP_DIR/rentlo_db_$(date +%Y%m%d_%H%M%S).sql.gz"
pg_dump -U rentlo_user -h 127.0.0.1 rentlo_prod | gzip > $FILE
find $BACKUP_DIR -type f -mtime +30 -delete
```

### Step 8.2: Log Rotation (`/etc/logrotate.d/rentlo`)
```ini
/var/log/rentlo/*.log {
    daily
    missingok
    rotate 90
    compress
    delaycompress
    notifempty
    create 0640 rentlo www-data
}
```

### Step 8.3: Fail2ban Intrusion Prevention
```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

---

## ⚖️ 9. MANDATORY LEGAL GOVERNANCE & PRIVACY GATE

Before launching production marketing campaigns or accepting live user transactions:

1. **Formal DPDP Legal Counsel Sign-off**: Have a licensed Indian data privacy attorney review:
   - Privacy Policy & Terms of Service terms.
   - Statutory data retention policy boundaries.
   - DPDP consent modal UI presentation.
2. **E-Stamp Vendor Legal Onboarding**: Keep `enable_e_stamp_agreements = False` until an official contract is executed with a certified e-stamp provider (Digio / Signzy API).
