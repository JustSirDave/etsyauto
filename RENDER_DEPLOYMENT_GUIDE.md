# Render Free Tier Deployment Guide

## 🚀 Quick Deployment (30 minutes)

This guide will get your Etsy Automation Platform running on Render's free tier for client demos.

---

## **What's Included (Free Tier):**

✅ **API** (FastAPI) - Sleeps after 15 min, wakes on request  
✅ **Frontend** (Next.js) - Always available  
✅ **PostgreSQL** - Free for 90 days  
❌ **Celery Workers** - Disabled (requires paid tier)  
❌ **Redis** - Using free Upstash alternative

---

## **Prerequisites:**

1. GitHub account
2. Render account (free - no credit card)
3. Upstash account (free Redis)

---

## **Step 1: Set Up Upstash (Free Redis)**

1. **Go to:** https://upstash.com/
2. **Sign up** with GitHub (free, no credit card)
3. **Create Redis Database:**
   - Click "Create Database"
   - Name: `etsy-redis`
   - Type: `Regional`
   - Region: Choose closest to you
   - Click "Create"
4. **Copy Connection URL:**
   - Click on your database
   - Copy the `UPSTASH_REDIS_REST_URL` 
   - Format: `https://your-db.upstash.io`
   - Note: You'll need this later

---

## **Step 2: Prepare Your Repository**

### 2.1 Create Render-specific Dockerfile for API

Create `apps/api/Dockerfile.render`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Run migrations and start server
CMD alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}
```

### 2.2 Update Next.js Build for Static Export

Edit `apps/web/next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // Changed from 'export' for Render
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
}

module.exports = nextConfig
```

### 2.3 Disable Celery for Free Tier

Create `.env.render` file:

```bash
# Render Free Tier Configuration
DISABLE_CELERY=true
CELERY_ALWAYS_EAGER=true  # Run tasks synchronously
```

### 2.4 Commit and Push to GitHub

```bash
git add .
git commit -m "Add Render deployment configuration"
git push origin main
```

---

## **Step 3: Deploy to Render**

### 3.1 Create Render Account

1. Go to https://render.com
2. Click "Get Started for Free"
3. Sign up with GitHub
4. Authorize Render to access your repositories

### 3.2 Create PostgreSQL Database

1. Click **"New +"** → **"PostgreSQL"**
2. Configure:
   - **Name:** `etsy-db`
   - **Database:** `etsy_platform`
   - **User:** `postgres`
   - **Region:** Choose closest to you
   - **Plan:** **Free** (90 days)
3. Click **"Create Database"**
4. Wait 2-3 minutes for provisioning
5. **Copy Internal Connection String** (you'll need this)

### 3.3 Deploy FastAPI Backend

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository
3. Configure:
   - **Name:** `etsy-api`
   - **Region:** Same as database
   - **Branch:** `main`
   - **Root Directory:** `apps/api`
   - **Runtime:** `Docker`
   - **Dockerfile Path:** `apps/api/Dockerfile.render`
   - **Plan:** **Free**

4. **Add Environment Variables:**
   
   Click **"Advanced"** → **"Add Environment Variable"**
   
   ```
   DATABASE_URL = [Paste PostgreSQL Internal Connection String]
   REDIS_URL = [Paste Upstash Redis URL from Step 1]
   
   # JWT Keys (generate these)
   JWT_PRIVATE_KEY = [Your JWT private key from .env]
   JWT_PUBLIC_KEY = [Your JWT public key from .env]
   
   # Encryption
   ENCRYPTION_KEY = [Your encryption key from .env]
   
   # Etsy API
   ETSY_CLIENT_ID = [Your Etsy client ID]
   ETSY_CLIENT_SECRET = [Your Etsy client secret]
   ETSY_REDIRECT_URI = https://etsy-api.onrender.com/api/shops/etsy/callback
   
   # OpenAI
   OPENAI_API_KEY = [Your OpenAI API key]
   
   # Google OAuth
   GOOGLE_CLIENT_ID = [Your Google client ID]
   GOOGLE_CLIENT_SECRET = [Your Google client secret]
   GOOGLE_REDIRECT_URI = https://etsy-web.onrender.com/oauth/google/callback
   
   # Email
   RESEND_API_KEY = [Your Resend API key]
   EMAIL_FROM = noreply@yourdomain.com
   USE_RESEND = true
   
   # Feature flags
   DISABLE_CELERY = true
   CELERY_ALWAYS_EAGER = true
   
   # Frontend URL
   FRONTEND_URL = https://etsy-web.onrender.com
   ```

5. Click **"Create Web Service"**
6. Wait 5-10 minutes for build and deployment
7. **Copy the service URL** (e.g., `https://etsy-api.onrender.com`)

### 3.4 Deploy Next.js Frontend

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository
3. Configure:
   - **Name:** `etsy-web`
   - **Region:** Same as API
   - **Branch:** `main`
   - **Root Directory:** `apps/web`
   - **Runtime:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Plan:** **Free**

4. **Add Environment Variables:**
   
   ```
   NEXT_PUBLIC_API_URL = [Your API URL from previous step]
   NEXT_PUBLIC_GOOGLE_CLIENT_ID = [Your Google client ID]
   NEXTAUTH_URL = https://etsy-web.onrender.com
   NEXTAUTH_SECRET = [Generate random 32-char string]
   ```

5. Click **"Create Web Service"**
6. Wait 5-10 minutes for build and deployment

---

## **Step 4: Run Database Migrations**

Once your API is deployed:

1. Go to your **etsy-api** service on Render
2. Click **"Shell"** tab
3. Run migrations:
   ```bash
   alembic upgrade head
   ```

---

## **Step 5: Test Your Deployment**

1. **Visit your frontend:** `https://etsy-web.onrender.com`
2. **Try to register/login**
3. **Check API health:** `https://etsy-api.onrender.com/healthz`

---

## **⚠️ Free Tier Limitations:**

1. **API sleeps after 15 minutes** of inactivity
   - First request after sleep takes ~30 seconds to wake
   - Subsequent requests are fast

2. **Background jobs disabled**
   - No Celery workers
   - Listing jobs run synchronously
   - May be slower for bulk operations

3. **PostgreSQL expires after 90 days**
   - Will need to upgrade or migrate

4. **Monthly limits:**
   - 750 hours/month runtime
   - Should be enough for client testing

---

## **Troubleshooting:**

### API not responding
- **Check:** Render dashboard → etsy-api → Logs
- **Wait:** 30 seconds for cold start after sleep

### Database connection errors
- **Check:** DATABASE_URL is correct
- **Verify:** Database is running (green status)

### Frontend can't reach API
- **Check:** NEXT_PUBLIC_API_URL is correct
- **Verify:** CORS settings in API

### Migrations failed
- **Try:** Manual shell → `alembic upgrade head`
- **Check:** Database permissions

---

## **Next Steps:**

After testing on Render free tier, you can:

1. **Keep it free** for demos (with limitations)
2. **Upgrade to paid** ($7/month for workers)
3. **Move to Google Cloud** for full functionality (see Google Cloud guide)

---

## **Cost to Remove Limitations:**

- **Starter Plan:** $7/month per service
  - No sleep
  - Persistent connections
  - Can run Celery workers

**Total for full functionality:**
- API: $7/month
- Workers: $7/month  
- Database: $7/month (after 90 days)
- Frontend: Free
- **Total:** ~$21/month

---

## **Support:**

If you encounter issues:
1. Check Render logs (Dashboard → Service → Logs)
2. Check Upstash dashboard for Redis usage
3. Verify all environment variables are set
4. Test API health endpoint directly

Your app should be live and testable for client demos within 30 minutes!
