# Deployment Checklist - BlueVPS

Quick reference checklist for deploying to your VPS.

## ✅ Pre-Deployment (Do This First)

- [ ] VPS server purchased and accessible
- [ ] Domain name registered
- [ ] SSH access confirmed (can login to server)
- [ ] Server specs: 4GB RAM, 2 CPU cores minimum

---

## 🚀 Deployment Steps (Follow in Order)

### 1. Server Setup (30 minutes)
```bash
ssh root@your-vps-ip
```

- [ ] Create deploy user
- [ ] Install Docker
- [ ] Install Docker Compose
- [ ] Install Nginx
- [ ] Install Certbot (SSL)
- [ ] Install Git

### 2. DNS Configuration (10 minutes)
In your domain registrar:

- [ ] Create A record: `etsyauto` → `YOUR_VPS_IP`
- [ ] Wait 5-10 minutes for propagation
- [ ] Verify: `nslookup etsyauto.yourdomain.com`

### 3. Clone & Configure (15 minutes)
```bash
cd /home/deploy
git clone <your-repo-url>
cd etsy-automation-platform
```

- [ ] Copy `.env.example` to `.env`
- [ ] Update all environment variables
- [ ] Generate encryption key (32 bytes)
- [ ] Generate strong database password
- [ ] Set CORS_ORIGINS to your domain
- [ ] Set ETSY_REDIRECT_URI to your domain

### 4. Nginx Setup (10 minutes)

- [ ] Create Nginx config file
- [ ] Enable site
- [ ] Test config: `sudo nginx -t`
- [ ] Reload Nginx: `sudo systemctl reload nginx`

### 5. SSL Certificate (5 minutes)

- [ ] Run Certbot: `sudo certbot --nginx -d etsyauto.yourdomain.com`
- [ ] Choose redirect HTTP to HTTPS
- [ ] Test auto-renewal

### 6. Deploy Application (20 minutes)

- [ ] Generate JWT keys (`openssl genrsa...`)
- [ ] Build Docker images
- [ ] Start services: `docker-compose -f docker-compose.prod.yml up -d`
- [ ] Run migrations: `docker-compose exec api alembic upgrade head`
- [ ] Check all services running: `docker-compose ps`

### 7. Firewall Setup (5 minutes)

- [ ] Enable UFW
- [ ] Allow SSH (port 22) **FIRST!**
- [ ] Allow HTTP (port 80)
- [ ] Allow HTTPS (port 443)
- [ ] Verify status: `sudo ufw status`

### 8. Verification (10 minutes)

- [ ] Visit `https://etsyauto.yourdomain.com`
- [ ] Frontend loads successfully
- [ ] Can register new account
- [ ] Can login
- [ ] API docs work: `/docs`
- [ ] Health check: `/health`

### 9. Etsy API Application (10 minutes)

- [ ] Go to https://www.etsy.com/developers/register
- [ ] Create new app
- [ ] Use callback URL: `https://etsyauto.yourdomain.com/api/auth/callback/etsy`
- [ ] Submit for review
- [ ] Wait for approval (1-3 days)

### 10. Post-Approval (5 minutes)

Once Etsy approves:

- [ ] Add ETSY_CLIENT_ID to `.env`
- [ ] Add ETSY_CLIENT_SECRET to `.env`
- [ ] Restart services
- [ ] Test Etsy connection in Settings

---

## 📝 Important URLs

**Production URLs:**
- Frontend: `https://etsyauto.yourdomain.com`
- API Docs: `https://etsyauto.yourdomain.com/docs`
- Health Check: `https://etsyauto.yourdomain.com/health`
- Etsy Callback: `https://etsyauto.yourdomain.com/api/auth/callback/etsy`

**Server Access:**
- SSH: `ssh deploy@your-vps-ip`
- App Directory: `/home/deploy/etsy-automation-platform`

---

## 🔑 Important Commands

### View Logs
```bash
cd /home/deploy/etsy-automation-platform
docker-compose -f docker-compose.prod.yml logs -f
```

### Restart Services
```bash
docker-compose -f docker-compose.prod.yml restart
```

### Update Application
```bash
git pull origin main
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
```

### Backup Database
```bash
docker-compose -f docker-compose.prod.yml exec db pg_dump -U postgres etsy_platform > backup.sql
```

---

## 🆘 Quick Troubleshooting

**Can't access website:**
```bash
# Check Nginx
sudo systemctl status nginx
sudo nginx -t

# Check Docker services
docker-compose -f docker-compose.prod.yml ps
```

**SSL not working:**
```bash
# Check certificate
sudo certbot certificates

# Renew if needed
sudo certbot renew
```

**Services crashing:**
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs api
docker-compose -f docker-compose.prod.yml logs worker
```

---

## 📞 Need Help?

Full deployment guide: `docs/DEPLOYMENT-VPS.md`

---

**Estimated Total Time**: 2-3 hours (excluding DNS propagation & Etsy approval)

**Ready to Start?** → Open `docs/DEPLOYMENT-VPS.md` and follow Step 1!
