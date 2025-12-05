# BlueVPS Deployment Guide

## Prerequisites

1. **BlueVPS Server** with:
   - Ubuntu 20.04+ or similar Linux distribution
   - Docker and Docker Compose installed
   - Git installed
   - At least 2GB RAM, 20GB storage

2. **Domain Name** (optional but recommended)
   - Point your domain to your BlueVPS IP address

## Step 1: Connect to Your BlueVPS Server

```bash
ssh root@YOUR_BLUEVPS_IP
```

## Step 2: Install Docker & Docker Compose

```bash
# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose -y

# Verify installation
docker --version
docker compose version
```

## Step 3: Clone Your Repository

```bash
# Install Git if not installed
apt install git -y

# Clone repository
cd /opt
git clone https://github.com/JustSirDave/etsyauto.git
cd etsyauto
```

## Step 4: Configure Environment Variables

```bash
# Copy example file
cp .env.production.example .env.production

# Edit with your values
nano .env.production
```

**Required Variables to Set:**
- `POSTGRES_PASSWORD` - Strong database password
- `JWT_SECRET_KEY` - Random 32+ character string
- `FRONTEND_URL` - Your domain or IP (e.g., `https://yourdomain.com` or `http://YOUR_IP`)
- `ETSY_CLIENT_ID` & `ETSY_CLIENT_SECRET` - From Etsy Developer Portal
- `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET` - From Google Cloud Console
- `RESEND_API_KEY` - For email sending
- `ENCRYPTION_KEY` - Random 32-byte key

**Generate Secrets:**
```bash
# Generate JWT Secret
openssl rand -base64 32

# Generate Encryption Key
openssl rand -hex 32
```

## Step 5: Update Nginx Configuration

Edit `nginx/nginx.conf` and update:
- `server_name` with your domain
- SSL certificate paths (if using HTTPS)

For initial deployment without SSL, the config already allows HTTP on port 80.

## Step 6: Deploy

```bash
# Make deploy script executable
chmod +x deploy.sh

# Run deployment
./deploy.sh
```

Or manually:
```bash
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
```

## Step 7: Verify Deployment

```bash
# Check all services are running
docker compose -f docker-compose.prod.yml ps

# Check logs
docker compose -f docker-compose.prod.yml logs -f
```

## Step 8: Access Your Application

- **Frontend**: `http://YOUR_IP` or `https://yourdomain.com`
- **API Docs**: `http://YOUR_IP/api/docs`
- **Health Check**: `http://YOUR_IP/healthz`

## Firewall Configuration

```bash
# Allow HTTP and HTTPS
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

## SSL Certificate (Optional but Recommended)

### Using Let's Encrypt (Free SSL):

```bash
# Install Certbot
apt install certbot python3-certbot-nginx -y

# Get certificate (replace with your domain)
certbot certonly --standalone -d yourdomain.com

# Update nginx.conf with certificate paths
# Then restart nginx
docker compose -f docker-compose.prod.yml restart nginx
```

## Monitoring & Maintenance

### View Logs
```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f web
docker compose -f docker-compose.prod.yml logs -f api
```

### Restart Services
```bash
docker compose -f docker-compose.prod.yml restart
```

### Update Application
```bash
git pull origin main
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
```

### Backup Database
```bash
docker exec etsy-db pg_dump -U postgres etsy_platform > backup_$(date +%Y%m%d).sql
```

## Troubleshooting

### Services not starting
```bash
# Check logs
docker compose -f docker-compose.prod.yml logs

# Check service status
docker compose -f docker-compose.prod.yml ps
```

### Database connection issues
- Verify `POSTGRES_PASSWORD` in `.env.production`
- Check database container: `docker logs etsy-db`

### Port conflicts
- Ensure ports 80, 443, 8080 are not in use
- Check: `netstat -tulpn | grep :80`

## Support

For issues, check:
- Docker logs: `docker compose -f docker-compose.prod.yml logs`
- Service health: `docker compose -f docker-compose.prod.yml ps`

