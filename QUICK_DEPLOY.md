# Quick BlueVPS Deployment Checklist

## On Your BlueVPS Server

### 1. Connect via SSH
```bash
ssh root@YOUR_BLUEVPS_IP
```

### 2. Install Docker
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
apt install docker-compose -y
```

### 3. Clone Repository
```bash
cd /opt
git clone https://github.com/JustSirDave/etsyauto.git
cd etsyauto
```

### 4. Setup Environment
```bash
# Copy example file
cp env.production.example .env.production

# Edit with your values
nano .env.production
```

**Minimum Required Settings:**
- `POSTGRES_PASSWORD` - Strong password
- `JWT_SECRET_KEY` - Generate: `openssl rand -base64 32`
- `FRONTEND_URL` - Your IP or domain (e.g., `http://YOUR_IP`)
- `ENCRYPTION_KEY` - Generate: `openssl rand -hex 32`

### 5. Deploy
```bash
chmod +x deploy.sh
./deploy.sh
```

### 6. Open Firewall
```bash
ufw allow 80/tcp
ufw allow 443/tcp
```

### 7. Access Your App
Visit: `http://YOUR_IP_ADDRESS`

---

## Full Guide
See `DEPLOYMENT.md` for detailed instructions including SSL setup.

