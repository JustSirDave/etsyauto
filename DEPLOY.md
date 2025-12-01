# Deployment Guide

## Quick Deployment

### Option 1: Using PowerShell Script (Recommended)

Run the deployment script:

```powershell
.\deploy.ps1
```

You'll be prompted for the SSH password: `RzaCUoP939F8l1L2df`

---

### Option 2: Manual Deployment Steps

If you prefer to deploy manually, follow these steps:

#### 1. Connect to Server

```powershell
ssh -p 56777 root@146.19.143.180
```

Password: `RzaCUoP939F8l1L2df`

#### 2. Navigate to Project Directory

```bash
cd /root/etsy-automation-platform
```

#### 3. Pull Latest Changes

```bash
git pull origin main
```

#### 4. Rebuild and Restart Containers

```bash
docker compose down
docker compose up -d --build
```

#### 5. Check Container Status

```bash
docker compose ps
```

#### 6. View Logs (Optional)

```bash
# View all logs
docker compose logs -f

# View specific service logs
docker compose logs -f web
docker compose logs -f api
```

---

## Server Information

- **Hostname**: srv135768.hosttoname.com
- **IP**: 146.19.143.180
- **SSH Port**: 56777
- **SSH User**: root
- **Project Path**: /root/etsy-automation-platform

---

## Troubleshooting

### If deployment fails:

1. **Check if containers are running:**
   ```bash
   docker compose ps
   ```

2. **Check logs for errors:**
   ```bash
   docker compose logs --tail=50
   ```

3. **Restart specific service:**
   ```bash
   docker compose restart web
   docker compose restart api
   ```

4. **Rebuild from scratch:**
   ```bash
   docker compose down -v
   docker compose up -d --build
   ```

---

## Post-Deployment Verification

1. Visit: https://srv135768.hosttoname.com
2. Test login functionality
3. Test profile picture upload
4. Test AI content generation (ensure OpenAI API key is configured)
5. Check that toast notifications appear properly

---

## Environment Variables

Make sure `.env` file on server has all required variables:

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET_KEY`
- `OPENAI_API_KEY`
- `CORS_ORIGINS`

---

**Note**: The deployment script will automatically pull changes, rebuild containers, and restart services.

