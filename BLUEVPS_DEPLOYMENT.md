# BlueVPS Deployment Guide - From GitHub to Server

Complete guide to deploy your Etsy Automation Platform from GitHub to BlueVPS.

---

## Prerequisites

- BlueVPS server with Ubuntu 20.04+ (or similar Linux)
- SSH access to your server
- Domain name (optional) or your server's IP address

---

## Step 1: Initial Server Setup (One-Time)

### 1.1 Connect to Your Server
```bash
ssh root@YOUR_BLUEVPS_IP
```

### 1.2 Update System
```bash
apt update && apt upgrade -y
```

### 1.3 Install Docker & Docker Compose
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose -y

# Verify installation
docker --version
docker compose version
```

### 1.4 Install Git (if not installed)
```bash
apt install git -y
```

### 1.5 Configure Firewall
```bash
# Allow HTTP and HTTPS
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

---

## Step 2: Clone Repository from GitHub

### 2.1 Navigate to Deployment Directory
```bash
cd /opt
```

### 2.2 Clone Your Repository
```bash
git clone https://github.com/JustSirDave/etsyauto.git
cd etsyauto
```

---

## Step 3: Configure Environment Variables

### 3.1 Copy Environment Template
```bash
cp env.production.example .env.production
```

### 3.2 Edit Environment File
```bash
nano .env.production
```

### 3.3 Required Configuration

Fill in these **REQUIRED** values:

```bash
# Database Password (generate a strong password)
POSTGRES_PASSWORD=your_strong_password_here

# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET_KEY=your_generated_jwt_secret_here

# Frontend URL (use your IP or domain)
FRONTEND_URL=http://YOUR_IP_ADDRESS
# OR if you have a domain:
# FRONTEND_URL=https://yourdomain.com

# Encryption Key (generate with: openssl rand -hex 32)
ENCRYPTION_KEY=your_generated_encryption_key_here
```

**Generate Secrets:**
```bash
# Generate JWT Secret
openssl rand -base64 32

# Generate Encryption Key
openssl rand -hex 32
```

### 3.4 Optional Configuration (for full functionality)

```bash
# Etsy API (get from https://www.etsy.com/developers)
ETSY_CLIENT_ID=your_etsy_client_id
ETSY_CLIENT_SECRET=your_etsy_client_secret
ETSY_REDIRECT_URI=${FRONTEND_URL}/api/shops/etsy/callback

# Google OAuth (get from Google Cloud Console)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=${FRONTEND_URL}/api/auth/google/callback

# Email Service (Resend)
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=noreply@yourdomain.com

# AI APIs (optional)
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
```

### 3.5 Save and Exit
Press `Ctrl+X`, then `Y`, then `Enter` to save.

---

## Step 4: Initial Deployment

### 4.1 Make Deploy Script Executable
```bash
chmod +x deploy.sh
```

### 4.2 Run Deployment
```bash
./deploy.sh
```

This script will:
- Pull latest code from GitHub
- Build Docker images
- Start all services
- Check service health

**OR manually:**
```bash
# Build images
docker compose -f docker-compose.prod.yml build --no-cache

# Start services
docker compose -f docker-compose.prod.yml up -d

# Check status
docker compose -f docker-compose.prod.yml ps
```

---

## Step 5: Verify Deployment

### 5.1 Check Service Status
```bash
docker compose -f docker-compose.prod.yml ps
```

All services should show `Up` or `healthy`.

### 5.2 Check Logs
```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f web
docker compose -f docker-compose.prod.yml logs -f api
```

### 5.3 Test Application
- **Frontend**: `http://YOUR_IP_ADDRESS`
- **API Health**: `http://YOUR_IP_ADDRESS/healthz`
- **API Docs**: `http://YOUR_IP_ADDRESS/api/docs`

---

## Step 6: Updating Application (After Code Changes)

When you push new code to GitHub, update on server:

### 6.1 Pull Latest Code
```bash
cd /opt/etsyauto
git pull origin main
```

### 6.2 Rebuild and Restart
```bash
# Rebuild images
docker compose -f docker-compose.prod.yml build --no-cache

# Restart services
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

**OR use the deploy script:**
```bash
./deploy.sh
```

---

## Step 7: SSL Certificate (Optional but Recommended)

### 7.1 Install Certbot
```bash
apt install certbot python3-certbot-nginx -y
```

### 7.2 Get SSL Certificate
```bash
# Stop nginx temporarily
docker compose -f docker-compose.prod.yml stop nginx

# Get certificate (replace with your domain)
certbot certonly --standalone -d yourdomain.com

# Update nginx.conf with certificate paths
nano nginx/nginx.conf
```

### 7.3 Update Nginx Config
Uncomment and update SSL lines in `nginx/nginx.conf`:
```nginx
ssl_certificate /etc/nginx/ssl/fullchain.pem;
ssl_certificate_key /etc/nginx/ssl/privkey.pem;
```

### 7.4 Restart Nginx
```bash
docker compose -f docker-compose.prod.yml restart nginx
```

---

## Common Commands

### View Logs
```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f web
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f db
```

### Restart Services
```bash
# All services
docker compose -f docker-compose.prod.yml restart

# Specific service
docker compose -f docker-compose.prod.yml restart web
docker compose -f docker-compose.prod.yml restart api
```

### Stop Services
```bash
docker compose -f docker-compose.prod.yml down
```

### Start Services
```bash
docker compose -f docker-compose.prod.yml up -d
```

### Backup Database
```bash
docker exec etsy-db pg_dump -U postgres etsy_platform > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore Database
```bash
docker exec -i etsy-db psql -U postgres etsy_platform < backup_file.sql
```

---

## Troubleshooting

### Services Not Starting
```bash
# Check logs
docker compose -f docker-compose.prod.yml logs

# Check service status
docker compose -f docker-compose.prod.yml ps

# Check if ports are in use
netstat -tulpn | grep :80
netstat -tulpn | grep :8080
```

### Database Connection Issues
```bash
# Check database logs
docker logs etsy-db

# Verify password in .env.production
cat .env.production | grep POSTGRES_PASSWORD
```

### Frontend Not Loading
```bash
# Check web container logs
docker logs etsy-web

# Verify NEXT_PUBLIC_API_URL in .env.production
cat .env.production | grep FRONTEND_URL
```

### Port Already in Use
```bash
# Find process using port
lsof -i :80
lsof -i :443

# Kill process (replace PID)
kill -9 PID
```

---

## Quick Reference

**Project Location**: `/opt/etsyauto`

**Environment File**: `.env.production`

**Deploy Command**: `./deploy.sh`

**Update Command**: `git pull && ./deploy.sh`

**Service URLs**:
- Frontend: `http://YOUR_IP`
- API: `http://YOUR_IP/api`
- API Docs: `http://YOUR_IP/api/docs`

---

## Support

If you encounter issues:
1. Check logs: `docker compose -f docker-compose.prod.yml logs`
2. Verify environment variables: `cat .env.production`
3. Check service health: `docker compose -f docker-compose.prod.yml ps`

