# Google Cloud Deployment Guide

## 🚀 Full Production Deployment with $300 Free Credit

This guide will deploy your complete Etsy Automation Platform on Google Cloud with ALL features enabled.

---

## **What's Included:**

✅ **All Services:** API, Workers, Frontend, PostgreSQL, Redis, Prometheus, Grafana  
✅ **Full Functionality:** Background jobs, scheduling, real-time updates  
✅ **Professional Infrastructure:** Auto-scaling, monitoring, backups  
✅ **$300 Free Credit:** 90 days of full usage  
✅ **After Trial:** Always Free tier (1 f1-micro VM)

---

## **Prerequisites:**

1. Google Account
2. Credit card (for verification - won't be charged during trial)
3. SSH client (built into Windows 10+)

---

## **Step 1: Set Up Google Cloud Account**

### 1.1 Create Account

1. Go to: https://cloud.google.com/free
2. Click **"Get started for free"**
3. Sign in with Google account
4. Enter billing information (won't be charged)
5. **Claim $300 credit** (valid for 90 days)

### 1.2 Create New Project

1. Go to: https://console.cloud.google.com/
2. Click project dropdown → **"New Project"**
3. Name: `etsy-automation-platform`
4. Click **"Create"**
5. Wait for project creation (~30 seconds)

---

## **Step 2: Set Up Compute Engine VM**

### 2.1 Enable Compute Engine API

1. Go to: **Navigation menu** → **Compute Engine** → **VM instances**
2. Wait for API to enable (~2 minutes)

### 2.2 Create VM Instance

1. Click **"Create Instance"**
2. Configure:

   **Basic Details:**
   - **Name:** `etsy-platform-vm`
   - **Region:** Choose closest to you (e.g., `us-central1`)
   - **Zone:** Any (e.g., `us-central1-a`)

   **Machine Configuration:**
   - **Series:** `E2`
   - **Machine type:** `e2-medium` (2 vCPU, 4 GB RAM)
     - Cost: ~$25/month (~$0.033/hour)
     - Covered by free credit

   **Boot Disk:**
   - Click **"Change"**
   - **Operating System:** `Ubuntu`
   - **Version:** `Ubuntu 22.04 LTS`
   - **Boot disk type:** `Balanced persistent disk`
   - **Size:** `50 GB`
   - Click **"Select"**

   **Firewall:**
   - ✅ **Allow HTTP traffic**
   - ✅ **Allow HTTPS traffic**

3. Click **"Create"** (takes 30-60 seconds)

### 2.3 Configure Firewall Rules

1. Go to: **VPC Network** → **Firewall** → **Create Firewall Rule**

**Rule 1: Allow Frontend (Port 3000)**
```
Name: allow-frontend
Direction: Ingress
Targets: All instances in the network
Source IP ranges: 0.0.0.0/0
Protocols and ports: tcp:3000
```

**Rule 2: Allow API (Port 8080)**
```
Name: allow-api
Direction: Ingress
Targets: All instances in the network
Source IP ranges: 0.0.0.0/0
Protocols and ports: tcp:8080
```

**Rule 3: Allow Grafana (Port 3001)**
```
Name: allow-grafana
Direction: Ingress
Targets: All instances in the network
Source IP ranges: 0.0.0.0/0
Protocols and ports: tcp:3001
```

---

## **Step 3: Connect to VM and Install Dependencies**

### 3.1 Connect via SSH

1. Go back to **Compute Engine** → **VM instances**
2. Find your VM → Click **"SSH"** button
3. Browser SSH window will open

### 3.2 Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### 3.3 Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

### 3.4 Install Git

```bash
sudo apt install git -y
```

### 3.5 Configure Git (if needed)

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

---

## **Step 4: Clone Your Repository**

### 4.1 Generate SSH Key (if using private repo)

```bash
ssh-keygen -t ed25519 -C "your.email@example.com"
# Press Enter for all prompts (use default)

# Display public key
cat ~/.ssh/id_ed25519.pub
```

Copy the output and add to GitHub:
1. GitHub → Settings → SSH and GPG keys → New SSH key
2. Paste the key → Add SSH key

### 4.2 Clone Repository

```bash
# If public repo:
git clone https://github.com/yourusername/etsy-automation-platform.git

# If private repo with SSH:
git clone git@github.com:yourusername/etsy-automation-platform.git

# Enter project directory
cd etsy-automation-platform
```

---

## **Step 5: Configure Environment Variables**

### 5.1 Copy Environment Template

```bash
cp .env.example .env
nano .env
```

### 5.2 Update Environment Variables

Update these critical values in `.env`:

```bash
# Database
DB_PASSWORD=your_secure_db_password_here

# JWT Keys (keep from your local .env or generate new)
JWT_PRIVATE_KEY="your_jwt_private_key"
JWT_PUBLIC_KEY="your_jwt_public_key"

# Encryption
ENCRYPTION_KEY=your_32_character_encryption_key

# Etsy API
ETSY_CLIENT_ID=your_etsy_client_id
ETSY_CLIENT_SECRET=your_etsy_client_secret
ETSY_REDIRECT_URI=http://YOUR_VM_IP:8080/api/shops/etsy/callback

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://YOUR_VM_IP:3000/oauth/google/callback

# Email (Resend)
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=noreply@yourdomain.com
USE_RESEND=true

# Frontend URL
FRONTEND_URL=http://YOUR_VM_IP:3000

# Sentry (optional)
SENTRY_DSN=your_sentry_dsn

# Grafana
GRAFANA_PASSWORD=your_secure_grafana_password
```

**To get YOUR_VM_IP:**
```bash
curl ifconfig.me
```

Save and exit: `Ctrl+X` → `Y` → `Enter`

---

## **Step 6: Update OAuth Redirect URIs**

### 6.1 Update Etsy App

1. Go to: https://www.etsy.com/developers/your-apps
2. Select your app
3. Add redirect URI: `http://YOUR_VM_IP:8080/api/shops/etsy/callback`

### 6.2 Update Google OAuth

1. Go to: https://console.cloud.google.com/apis/credentials
2. Select your OAuth 2.0 Client ID
3. Add authorized redirect URI: `http://YOUR_VM_IP:3000/oauth/google/callback`

---

## **Step 7: Deploy Application**

### 7.1 Build and Start Services

```bash
# Build images
docker-compose build

# Start all services
docker-compose up -d

# Check status
docker-compose ps
```

All services should show "Up" status.

### 7.2 Run Database Migrations

```bash
# Run migrations
docker-compose exec api alembic upgrade head
```

### 7.3 Check Logs

```bash
# View all logs
docker-compose logs

# View specific service logs
docker-compose logs api
docker-compose logs web
docker-compose logs worker
```

---

## **Step 8: Access Your Application**

### 8.1 Get Your VM's External IP

In Google Cloud Console:
1. **Compute Engine** → **VM instances**
2. Find **External IP** column
3. Copy the IP address

Or in SSH:
```bash
curl ifconfig.me
```

### 8.2 Access Services

- **Frontend:** `http://YOUR_VM_IP:3000`
- **API:** `http://YOUR_VM_IP:8080`
- **API Docs:** `http://YOUR_VM_IP:8080/docs`
- **Grafana:** `http://YOUR_VM_IP:3001`
  - Username: `admin`
  - Password: [Your GRAFANA_PASSWORD from .env]

---

## **Step 9: Set Up Domain (Optional but Recommended)**

### 9.1 Reserve Static IP

1. Go to: **VPC Network** → **External IP addresses**
2. Click **"Reserve Static Address"**
3. Configure:
   - **Name:** `etsy-platform-ip`
   - **Attached to:** Select your VM
4. Click **"Reserve"**

### 9.2 Configure Domain DNS

In your domain registrar (e.g., Namecheap, GoDaddy):

**Add A Records:**
```
@ → YOUR_STATIC_IP
www → YOUR_STATIC_IP
api → YOUR_STATIC_IP
```

### 9.3 Set Up HTTPS with Nginx + Let's Encrypt

```bash
# Install Nginx
sudo apt install nginx certbot python3-certbot-nginx -y

# Create Nginx config
sudo nano /etc/nginx/sites-available/etsy-platform
```

Paste this configuration:

```nginx
# Frontend
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# API
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable and get SSL certificates:

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/etsy-platform /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Get SSL certificates
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com -d api.yourdomain.com
```

---

## **Step 10: Set Up Automatic Backups**

### 10.1 Create Backup Script

```bash
nano ~/backup.sh
```

Paste:

```bash
#!/bin/bash
BACKUP_DIR="/home/$USER/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
docker-compose exec -T db pg_dump -U postgres etsy_platform | gzip > "$BACKUP_DIR/db_backup_$DATE.sql.gz"

# Keep only last 7 days
find $BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

Make executable:
```bash
chmod +x ~/backup.sh
```

### 10.2 Schedule Daily Backups

```bash
crontab -e
```

Add this line:
```
0 2 * * * /home/$USER/backup.sh >> /home/$USER/backup.log 2>&1
```

---

## **Step 11: Monitoring & Maintenance**

### 11.1 Monitor Resource Usage

```bash
# Check disk space
df -h

# Check memory usage
free -h

# Check Docker resources
docker stats
```

### 11.2 View Application Logs

```bash
# Real-time logs
docker-compose logs -f

# Specific service
docker-compose logs -f api

# Last 100 lines
docker-compose logs --tail=100
```

### 11.3 Restart Services

```bash
# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart api
docker-compose restart worker
```

### 11.4 Update Application

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose build
docker-compose up -d

# Run migrations
docker-compose exec api alembic upgrade head
```

---

## **Cost Breakdown:**

### During $300 Free Trial (90 days):
- **e2-medium VM:** ~$25/month → **FREE** (covered by credit)
- **50GB Storage:** ~$2/month → **FREE**
- **Network egress:** ~$3/month → **FREE**
- **Total:** $0/month for 90 days

### After Trial (Always Free Tier):
You can switch to:
- **f1-micro VM:** FREE forever (0.6 GB RAM)
- **30GB Storage:** FREE
- **1GB egress/month:** FREE

**To stay free after trial:**
```bash
# In Google Cloud Console:
# 1. Stop current VM
# 2. Create new f1-micro instance
# 3. Follow same deployment steps
```

### If Keeping e2-medium After Trial:
- **VM:** ~$25/month
- **Storage:** ~$2/month
- **Network:** ~$3/month
- **Total:** ~$30/month

---

## **Troubleshooting:**

### Services won't start
```bash
# Check Docker status
sudo systemctl status docker

# Restart Docker
sudo systemctl restart docker

# Check logs
docker-compose logs
```

### Can't access from browser
1. Check firewall rules in Google Cloud Console
2. Verify services are running: `docker-compose ps`
3. Check VM external IP: `curl ifconfig.me`

### Database connection errors
```bash
# Check database is running
docker-compose ps db

# Check database logs
docker-compose logs db

# Try connecting manually
docker-compose exec db psql -U postgres -d etsy_platform
```

### Out of disk space
```bash
# Clean Docker images
docker system prune -a

# Check disk usage
df -h

# Remove old logs
docker-compose logs --tail=0
```

---

## **Scaling Options:**

### Increase VM Resources

1. Stop VM:
   ```bash
   docker-compose down
   ```

2. In Google Cloud Console:
   - Go to VM instance
   - Click **"Stop"**
   - Click **"Edit"**
   - Change machine type (e.g., `e2-standard-2`)
   - Click **"Save"**
   - Click **"Start"**

3. SSH back in and start services:
   ```bash
   cd etsy-automation-platform
   docker-compose up -d
   ```

### Add Load Balancer (for high traffic)

1. Google Cloud Console → **Network Services** → **Load Balancing**
2. Follow Google's guide for HTTP(S) Load Balancing

---

## **Security Best Practices:**

1. **Change default passwords** (Grafana, database)
2. **Enable automatic security updates:**
   ```bash
   sudo apt install unattended-upgrades
   sudo dpkg-reconfigure --priority=low unattended-upgrades
   ```
3. **Set up firewall:**
   ```bash
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw allow 3000/tcp
   sudo ufw allow 8080/tcp
   sudo ufw enable
   ```
4. **Regular backups** (automated in Step 10)
5. **Monitor logs** regularly

---

## **Next Steps:**

Your full-featured Etsy Automation Platform is now live on Google Cloud!

**To share with clients:**
1. Share the external IP or domain
2. Create test accounts for them
3. Show them the Grafana dashboard (`http://YOUR_IP:3001`)

**For production:**
1. Set up custom domain with HTTPS
2. Configure automatic backups
3. Set up monitoring alerts
4. Review security settings

Your deployment is production-ready and will run free for 90 days with $300 credit!
