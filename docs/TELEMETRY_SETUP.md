# 📡 Rentlo / PropertyHub — Multi-Cloud Telemetry & Observability Guide

This guide details how live telemetry and distributed tracing operate across **Vercel** (Frontend), **Render** (Cloud Backend/Staging), and your **VPS** (Self-Hosted Production).

---

## 1. Environment Variable Setup

### A. Vercel (Frontend Dashboard)
Go to **Project Settings > Environment Variables** on Vercel and add:

| Variable Name | Value | Purpose |
| :--- | :--- | :--- |
| `VITE_SENTRY_DSN` | `https://<public_key>@o<org>.ingest.sentry.io/<project_id>` | Frontend error & Web Vitals ingestion |
| `VITE_ENVIRONMENT` | `vercel-production` | Filters events originating from Vercel |
| `VITE_RELEASE` | `rentlo-web@1.0.0` | Associates errors with the deployed version |
| `VITE_API_URL` | `https://your-api-domain.com/api/v1` | Backend API URL |

---

### B. Render (Cloud Backend / Staging)
Go to **Service > Environment** on Render and add:

| Variable Name | Value | Purpose |
| :--- | :--- | :--- |
| `SENTRY_DSN` | `https://<key>@o<org>.ingest.sentry.io/<project_id>` | Backend error & API transaction tracing |
| `ENVIRONMENT` | `render-staging` | Distinguishes Render metrics from VPS |
| `SERVER_NAME` | `render-api-01` | Host identifier |
| `SENTRY_TRACES_SAMPLE_RATE` | `0.2` (or `1.0` for 100% trace capture) | Distributed trace sampling |

---

### C. VPS (Self-Hosted Production)
In your VPS `.env` file (e.g. `/var/www/rentlo/backend/.env`):

```bash
# Telemetry Configuration
SENTRY_DSN=https://<key>@o<org>.ingest.sentry.io/<project_id>
ENVIRONMENT=vps-production
SERVER_NAME=vps-prod-master
IS_VPS=true
SENTRY_TRACES_SAMPLE_RATE=0.2
SENTRY_PROFILES_SAMPLE_RATE=0.1
```

After modifying the `.env` on VPS, reload Gunicorn/Uvicorn:
```bash
sudo systemctl restart gunicorn
# or
sudo systemctl restart rentlo-backend
```

---

## 2. Real-Time Health & Diagnostic Endpoint

Your backend exposes a live telemetry diagnostic endpoint at:
```http
GET /api/v1/health/
```

### Sample Live Response:
```json
{
  "status": "healthy",
  "timestamp": "2026-09-05T17:45:00.000000",
  "environment": "vps-production",
  "host_server": "vps",
  "telemetry": {
    "sentry_configured": true,
    "traces_sample_rate": 0.2
  },
  "services": {
    "database": {
      "status": "connected",
      "latency_ms": 1.45,
      "engine": "postgresql"
    },
    "cache": {
      "status": "connected",
      "latency_ms": 0.82
    }
  },
  "system": {
    "cpu_percent": 12.4,
    "memory_percent": 38.2,
    "disk_percent": 41.0
  }
}
```

---

## 3. Distributed Tracing Workflow (How Vercel + Render/VPS connect)

```
[User Browser (Vercel)] 
       │
       ▼ (Passes traceparent header)
[Django API (VPS / Render)]
       │
       ├─► Database Query (PostgreSQL / SQLite)
       ├─► Cache Lookup (Redis)
       └─► Background Worker (Celery)
```

1. When a user navigates on Vercel, the frontend SDK creates a **trace context**.
2. Outgoing `fetch` requests carry `sentry-trace` and `baggage` HTTP headers.
3. Django receives these headers and attaches its DB queries and latency spans to the same trace ID.
4. On your Sentry/SigNoz dashboard, clicking any transaction shows the **complete end-to-end timeline** across both frontend and backend.

---

## 4. Troubleshooting & Verification

1. **Verify Backend Telemetry**:
   ```bash
   curl -i https://<your-vps-or-render-api>/api/v1/health/
   ```
   Check the response headers for:
   - `X-Served-By: vps` or `render`
   - `X-Environment: vps-production` or `render-staging`

2. **Verify Frontend Telemetry**:
   - Open browser developer console on your Vercel URL.
   - You should see: `[Telemetry] Initialized for [vercel-production]`.
