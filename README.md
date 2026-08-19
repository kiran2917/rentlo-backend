# Rentlo

A full-stack property listing platform featuring a Django REST Framework backend and a React/Tailwind frontend, split across two micro-frontends: an `admin-portal` for agents/admins and a `buyer-web` portal for end-users.

## Prerequisites

- Node.js (v18+)
- Python (3.11+)
- PostgreSQL (or SQLite for dev testing)
- Redis Server (for Celery)

## Environment Variables

You must supply the following environment variables. In the `/backend` directory, create a `.env` file:

```env
# Django Settings
SECRET_KEY=your_django_secret_key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1,yourdomain.com

# Database (Postgres)
DB_NAME=rentlo_db
DB_USER=postgres
DB_PASSWORD=your_db_password
DB_HOST=127.0.0.1
DB_PORT=5432

# Razorpay Config
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# Cloudflare R2 / S3 Config
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret
R2_BUCKET_NAME=your_r2_bucket
R2_ENDPOINT_URL=https://your-account-id.r2.cloudflarestorage.com
R2_PUBLIC_URL_PREFIX=https://pub-xxxxxx.r2.dev
```

In the `/buyer-web` and `/admin-portal` directories, create `.env` files (if configuring Vite specifically):
```env
VITE_API_URL=http://localhost:8000/api/v1
VITE_RAZORPAY_KEY_ID=your_razorpay_key
```

## Running Locally

1. **Start Redis**: Ensure your local Redis server is running (`redis-server`).
2. **Start Backend API**:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate # or venv\Scripts\activate on Windows
   pip install -r requirements.txt
   python manage.py migrate
   python manage.py runserver
   ```
3. **Start Celery (In a separate terminal)**:
   ```bash
   cd backend
   source venv/bin/activate
   celery -A rentlo_backend worker -l info
   # In another terminal:
   celery -A rentlo_backend beat -l info
   ```
4. **Start Frontend (Buyer Web)**:
   ```bash
   cd buyer-web
   npm install
   npm run dev
   ```
5. **Start Frontend (Admin Portal)**:
   ```bash
   cd admin-portal
   npm install
   npm run dev
   ```

## Production Deployment

Use the `deploy.sh` script to automate zero-downtime deployments on an Ubuntu server running Nginx and Systemd.

1. Configure your `.env` securely on the server.
2. Run `chmod +x deploy.sh`.
3. Execute `./deploy.sh`. This pulls the latest code, migrates the DB, builds the React apps, and restarts Gunicorn and Celery.

For detailed VPS configuration (Nginx proxy rules, Systemd files, UFW), see the `deployment_setup.md` artifact.
