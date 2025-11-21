# VPS Deployment Guide - Etsy Automation Platform

Complete guide for deploying to a VPS (BlueVPS, DigitalOcean, Linode, Vultr, etc.)

## 📋 Prerequisites

Before starting, ensure you have:

- ✅ VPS server (Ubuntu 20.04/22.04 recommended)
- ✅ Domain name (e.g., `etsyauto.yourdomain.com`)
- ✅ SSH access to your VPS
- ✅ Root or sudo privileges
- ✅ Basic terminal/SSH knowledge

**Recommended VPS Specs:**
- **CPU**: 2+ cores
- **RAM**: 4GB minimum (8GB recommended)
- **Storage**: 50GB SSD
- **OS**: Ubuntu 22.04 LTS

---

## 🚀 Deployment Steps

### Step 1: Initial Server Setup

**1.1 Connect to Your VPS:**

```bash
ssh root@your-server-ip
# Or if using SSH key:
ssh -i ~/.ssh/your-key.pem root@your-server-ip
```

**1.2 Create Deployment User:**

```bash
# Create a new user
adduser deploy
usermod -aG sudo deploy

# Switch to deploy user
su - deploy
```

**1.3 Update System:**

```bash
sudo apt update
sudo apt upgrade -y
```

**1.4 Install Required Software:**

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Git
sudo apt install git -y

# Install Nginx (reverse proxy)
sudo apt install nginx -y

# Install Certbot (for SSL)
sudo apt install certbot python3-certbot-nginx -y

# Log out and back in for Docker group to take effect
exit
ssh deploy@your-server-ip
```

**1.5 Verify Installations:**

```bash
docker --version
docker-compose --version
nginx -v
certbot --version
```

---

### Step 2: Configure Domain & DNS

**2.1 Point Domain to VPS:**

In your domain registrar (e.g., Namecheap, GoDaddy):

```
Type: A Record
Host: etsyauto (or @)
Value: YOUR_VPS_IP_ADDRESS
TTL: 300
```

**2.2 Verify DNS Propagation:**

```bash
# Wait 5-10 minutes, then test:
nslookup etsyauto.yourdomain.com
# Should return your VPS IP
```

---

### Step 3: Clone & Configure Application

**3.1 Clone Repository:**

```bash
cd /home/deploy
git clone https://github.com/yourusername/etsy-automation-platform.git
cd etsy-automation-platform
```

**3.2 Create Production Environment File:**

```bash
# Copy example env file
cp apps/api/.env.example apps/api/.env

# Edit environment variables
nano apps/api/.env
```

**3.3 Configure Production Environment:**

```env
# apps/api/.env

# Application
APP_NAME=Etsy Automation Platform
ENVIRONMENT=production
DEBUG=False

# Database (use strong passwords!)
DATABASE_URL=postgresql://postgres:CHANGE_THIS_PASSWORD@db:5432/etsy_platform
DB_PASSWORD=CHANGE_THIS_PASSWORD

# Redis
REDIS_URL=redis://redis:6379/0

# JWT (keys will be generated)
JWT_ALGORITHM=RS256
JWT_ISSUER=api
JWT_AUDIENCE=api
JWT_TTL_SECONDS=300

# CORS (use your actual domain)
CORS_ORIGINS=["https://etsyauto.yourdomain.com"]

# Etsy API (leave empty until approved)
ETSY_CLIENT_ID=
ETSY_CLIENT_SECRET=
ETSY_REDIRECT_URI=https://etsyauto.yourdomain.com/api/auth/callback/etsy

# AI Providers (optional)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Celery
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/0

# Security
ENCRYPTION_KEY=GENERATE_32_BYTE_KEY_HERE

# Feature Flags
ENABLE_AI_GENERATION=True
ENABLE_SCHEDULED_PUBLISHING=True
```

**3.4 Generate Secure Secrets:**

```bash
# Generate encryption key
python3 -c "import secrets; print(secrets.token_hex(32))"
# Copy output to ENCRYPTION_KEY

# Generate database password
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
# Copy to DB_PASSWORD and DATABASE_URL
```

**3.5 Configure Frontend Environment:**

```bash
nano apps/web/.env.local
```

```env
# apps/web/.env.local
NEXT_PUBLIC_API_URL=https://etsyauto.yourdomain.com
```

---

### Step 4: Setup Nginx Reverse Proxy

**4.1 Create Nginx Configuration:**

```bash
sudo nano /etc/nginx/sites-available/etsy-automation
```

```nginx
# /etc/nginx/sites-available/etsy-automation

server {
    listen 80;
    server_name etsyauto.yourdomain.com;

    # Redirect to HTTPS (will be enabled after SSL setup)
    # return 301 https://$server_name$request_uri;

    # Frontend (Next.js)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API Documentation
    location /docs {
        proxy_pass http://localhost:8080/docs;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:8080/health;
    }

    # Increase upload size for product imports
    client_max_body_size 20M;
}
```

**4.2 Enable Site:**

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/etsy-automation /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

### Step 5: Setup SSL Certificate (HTTPS)

**5.1 Generate SSL Certificate:**

```bash
sudo certbot --nginx -d etsyauto.yourdomain.com
```

**Follow prompts:**
- Enter email address
- Agree to terms
- Choose redirect HTTP to HTTPS (option 2)

**5.2 Test Auto-Renewal:**

```bash
sudo certbot renew --dry-run
```

**5.3 Update Nginx Config:**

Certbot automatically updates the config, but verify:

```bash
sudo nano /etc/nginx/sites-available/etsy-automation
# Should now have SSL sections
```

---

### Step 6: Configure Production Docker Compose

**6.1 Create Production Docker Compose:**

```bash
nano docker-compose.prod.yml
```

```yaml
# docker-compose.prod.yml

version: '3.8'

services:
  db:
    image: postgres:15-alpine
    container_name: etsy-db
    restart: always
    environment:
      POSTGRES_DB: etsy_platform
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - etsy-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: etsy-redis
    restart: always
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    networks:
      - etsy-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

  api:
    build:
      context: ./apps/api
      dockerfile: Dockerfile
    container_name: etsy-api
    restart: always
    ports:
      - "8080:8080"
    env_file:
      - ./apps/api/.env
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./apps/api:/app
    networks:
      - etsy-network
    command: uvicorn app.main:app --host 0.0.0.0 --port 8080 --workers 4

  worker:
    build:
      context: ./apps/api
      dockerfile: Dockerfile
    container_name: etsy-worker
    restart: always
    env_file:
      - ./apps/api/.env
    depends_on:
      - db
      - redis
      - api
    volumes:
      - ./apps/api:/app
    networks:
      - etsy-network
    command: celery -A app.worker.celery_app worker --loglevel=info --concurrency=4

  beat:
    build:
      context: ./apps/api
      dockerfile: Dockerfile
    container_name: etsy-beat
    restart: always
    env_file:
      - ./apps/api/.env
    depends_on:
      - db
      - redis
      - api
    volumes:
      - ./apps/api:/app
    networks:
      - etsy-network
    command: celery -A app.worker.celery_app beat --loglevel=info

  web:
    build:
      context: ./apps/web
      dockerfile: Dockerfile
      args:
        NEXT_PUBLIC_API_URL: https://etsyauto.yourdomain.com
    container_name: etsy-web
    restart: always
    ports:
      - "3000:3000"
    depends_on:
      - api
    networks:
      - etsy-network
    environment:
      - NODE_ENV=production

volumes:
  postgres_data:
  redis_data:

networks:
  etsy-network:
    driver: bridge
```

---

### Step 7: Deploy Application

**7.1 Generate JWT Keys:**

```bash
cd /home/deploy/etsy-automation-platform/apps/api

# Generate private key
openssl genrsa -out private.pem 2048

# Generate public key
openssl rsa -in private.pem -pubout -out public.pem

# Secure the keys
chmod 600 private.pem
chmod 644 public.pem
```

**7.2 Build and Start Services:**

```bash
cd /home/deploy/etsy-automation-platform

# Build images
docker-compose -f docker-compose.prod.yml build

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps
```

**7.3 Run Database Migrations:**

```bash
docker-compose -f docker-compose.prod.yml exec api alembic upgrade head
```

**7.4 Verify Deployment:**

```bash
# Check API health
curl https://etsyauto.yourdomain.com/health

# Check frontend
curl https://etsyauto.yourdomain.com

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

---

### Step 8: Configure Firewall

**8.1 Setup UFW:**

```bash
# Enable UFW
sudo ufw enable

# Allow SSH (IMPORTANT - do this first!)
sudo ufw allow 22/tcp

# Allow HTTP & HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Check status
sudo ufw status
```

**8.2 Verify Access:**

Open browser and navigate to:
- `https://etsyauto.yourdomain.com` - Should load frontend
- `https://etsyauto.yourdomain.com/docs` - Should load API docs

---

### Step 9: Setup Monitoring & Logs

**9.1 View Logs:**

```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f api
docker-compose -f docker-compose.prod.yml logs -f worker
docker-compose -f docker-compose.prod.yml logs -f web
```

**9.2 Setup Log Rotation:**

```bash
sudo nano /etc/docker/daemon.json
```

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

```bash
sudo systemctl restart docker
docker-compose -f docker-compose.prod.yml restart
```

**9.3 Setup System Monitoring:**

```bash
# Install htop
sudo apt install htop -y

# Monitor resources
htop

# Monitor Docker
docker stats
```

---

### Step 10: Apply for Etsy API Keys

**Now that you have a live URL:**

1. **Go to Etsy Developers**: https://www.etsy.com/developers/register

2. **Create New App**:
   - **App Name**: Etsy Automation Platform
   - **App Description**: Automated listing management for Etsy sellers
   - **Callback URL**: `https://etsyauto.yourdomain.com/api/auth/callback/etsy`
   - **Privacy Policy**: (Create a simple one or use template)
   - **Terms of Service**: (Optional)

3. **Submit for Review**:
   - Wait 1-3 business days
   - Check email for approval

4. **Add API Keys**:
   ```bash
   nano /home/deploy/etsy-automation-platform/apps/api/.env

   # Add these lines:
   ETSY_CLIENT_ID=your_keystring_here
   ETSY_CLIENT_SECRET=your_shared_secret_here
   ```

5. **Restart Services**:
   ```bash
   docker-compose -f docker-compose.prod.yml restart api worker
   ```

---

## 🔄 Maintenance & Updates

### Update Application

```bash
cd /home/deploy/etsy-automation-platform

# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# Run migrations
docker-compose -f docker-compose.prod.yml exec api alembic upgrade head
```

### Backup Database

```bash
# Create backup
docker-compose -f docker-compose.prod.yml exec db pg_dump -U postgres etsy_platform > backup_$(date +%Y%m%d).sql

# Restore backup
cat backup_20250101.sql | docker-compose -f docker-compose.prod.yml exec -T db psql -U postgres etsy_platform
```

### Monitor Disk Space

```bash
df -h
docker system df
docker system prune -a  # Clean up unused images
```

---

## 🐛 Troubleshooting

### Services Won't Start

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs

# Check individual service
docker-compose -f docker-compose.prod.yml logs api

# Restart service
docker-compose -f docker-compose.prod.yml restart api
```

### Database Connection Fails

```bash
# Check database is running
docker-compose -f docker-compose.prod.yml ps db

# Check connection from API
docker-compose -f docker-compose.prod.yml exec api python -c "from app.core.database import engine; print(engine)"
```

### SSL Certificate Issues

```bash
# Renew certificate manually
sudo certbot renew

# Check certificate expiry
sudo certbot certificates
```

### Out of Memory

```bash
# Check memory usage
free -h

# Reduce worker concurrency in docker-compose.prod.yml
# Change --concurrency=4 to --concurrency=2
```

---

## 📊 Production Checklist

Before going live:

- [ ] SSL certificate installed and working
- [ ] Database backups configured
- [ ] Firewall configured (UFW)
- [ ] Domain DNS properly configured
- [ ] All environment variables set
- [ ] JWT keys generated
- [ ] Database migrations run
- [ ] Health check endpoint accessible
- [ ] Etsy callback URL matches deployment
- [ ] Monitoring/logging setup
- [ ] Regular backups scheduled

---

## 🔒 Security Best Practices

1. **Keep System Updated**:
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **Use Strong Passwords**:
   - Database password (32+ characters)
   - Encryption key (32 bytes)

3. **Limit SSH Access**:
   - Disable root login
   - Use SSH keys instead of passwords
   - Change default SSH port

4. **Monitor Logs**:
   - Check logs regularly
   - Set up alerts for errors

5. **Regular Backups**:
   - Daily database backups
   - Weekly full system backups

---

## 📞 Support

If you encounter issues:
- Check troubleshooting section above
- Review Docker logs
- Check Nginx error logs: `sudo tail -f /var/log/nginx/error.log`
- Verify DNS is propagated
- Test from different networks

---

**Deployment Guide Version**: 1.0.0
**Last Updated**: 2025
