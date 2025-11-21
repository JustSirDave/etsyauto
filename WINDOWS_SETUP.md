# 🪟 Windows Quick Start Guide

## ⚡ Setup (5 Minutes)

### Prerequisites
1. **Docker Desktop** - [Download here](https://www.docker.com/products/docker-desktop)
   - Install and start Docker Desktop
   - Make sure it's running (whale icon in system tray)

2. **PowerShell** - Already included in Windows
   - Right-click Start menu → "Windows PowerShell" or "Terminal"

---

## 🚀 Getting Started

### Step 1: Open PowerShell in Project Directory

```powershell
# Navigate to project folder
cd C:\users\david\desktop\etsy\etsy-automation-platform

# If you get "execution policy" error, run this first:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Step 2: Run Setup Script

```powershell
.\setup.ps1
```

This will:
- ✅ Check Docker is running
- ✅ Create `.env` file
- ✅ Generate JWT keys (if OpenSSL available)
- ✅ Build Docker images
- ✅ Start all services
- ✅ Check health

**Note**: First run takes 5-10 minutes to download and build images.

### Step 3: Access the Application

Once setup completes, open your browser:

- **Dashboard**: http://localhost:3000
- **API Docs**: http://localhost:8080/docs
- **Grafana**: http://localhost:3001 (admin/admin)

---

## 📝 Available Scripts

All scripts are PowerShell (`.ps1`) files:

```powershell
.\setup.ps1      # Initial setup (run once)
.\start.ps1      # Start all services
.\stop.ps1       # Stop all services
.\restart.ps1    # Restart all services
.\logs.ps1       # View logs (Ctrl+C to exit)
.\health.ps1     # Check if everything is working
```

---

## 🔧 Manual Setup (If Script Fails)

### 1. Create .env file
```powershell
Copy-Item .env.example .env
```

### 2. Generate JWT Keys

**Option A: Using Git Bash** (if you have Git installed)
```bash
# Open Git Bash
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
```

**Option B: Using WSL** (if you have Windows Subsystem for Linux)
```powershell
wsl bash -c "openssl genrsa -out private.pem 2048 && openssl rsa -in private.pem -pubout -out public.pem"
```

**Option C: Install OpenSSL for Windows**
- Download from: https://slproweb.com/products/Win32OpenSSL.html
- Install, then run in PowerShell:
```powershell
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
```

**Option D: Skip for now** (you can add keys later when needed for authentication)

### 3. Start Docker Services
```powershell
docker compose up -d
```

### 4. Check Status
```powershell
docker compose ps
```

---

## 🐛 Troubleshooting

### Error: "Execution Policy" or "Cannot be loaded"

**Problem**: PowerShell blocks running scripts by default.

**Solution**:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Then try running the script again.

---

### Error: "Docker is not running"

**Problem**: Docker Desktop is not started.

**Solution**:
1. Look for Docker whale icon in system tray (bottom-right)
2. If not there, start Docker Desktop from Start menu
3. Wait until it says "Docker Desktop is running"
4. Try setup again

---

### Error: Port already in use

**Problem**: Another application is using port 3000 or 8080.

**Solution**:
```powershell
# Check what's using the port
netstat -ano | findstr :3000
netstat -ano | findstr :8080

# Kill the process (replace PID with actual number)
taskkill /PID <PID> /F

# Or change ports in docker-compose.yml
```

---

### Error: "No such file or directory" during build

**Problem**: Line ending issues (Windows uses CRLF, Linux uses LF).

**Solution**: 
This shouldn't happen with the provided files, but if it does:
```powershell
# Convert line endings (if you have Git)
git config core.autocrlf true
```

---

### Docker is slow or hangs

**Problem**: Docker Desktop needs more resources.

**Solution**:
1. Open Docker Desktop
2. Settings → Resources
3. Increase:
   - CPUs: 4+
   - Memory: 6-8 GB
   - Disk: 20+ GB
4. Click "Apply & Restart"

---

### Services won't start

**Problem**: Previous containers interfering.

**Solution**:
```powershell
# Stop everything
docker compose down

# Remove all volumes (⚠️ deletes data)
docker compose down -v

# Start fresh
docker compose up -d
```

---

## 💡 Useful Commands

### Docker Compose Commands
```powershell
# View status
docker compose ps

# View logs
docker compose logs
docker compose logs api
docker compose logs web

# Follow logs (live)
docker compose logs -f

# Restart a service
docker compose restart api

# Stop everything
docker compose down

# Remove everything including data
docker compose down -v
```

### Database Commands
```powershell
# Open PostgreSQL shell
docker compose exec db psql -U postgres -d etsy_platform

# Inside psql:
# \dt          - List tables
# \q           - Exit
```

### Redis Commands
```powershell
# Open Redis CLI
docker compose exec redis redis-cli

# Inside redis-cli:
# PING         - Test connection
# KEYS *       - List all keys
# EXIT         - Exit
```

---

## 📚 Next Steps

### 1. Verify Everything Works
```powershell
.\health.ps1
```

Should show all services as healthy.

### 2. Explore the Dashboard
- Open http://localhost:3000
- You'll see connection status and recent orders
- Navigate through the sidebar menu

### 3. Check API Documentation
- Open http://localhost:8080/docs
- Interactive API documentation
- Try the `/healthz` endpoint

### 4. Read Documentation
- `QUICK_START.md` - General guide
- `NEXT_STEPS.md` - What to build next
- `BUILD_GUIDE.md` - Detailed instructions
- `ARCHITECTURE.md` - System design

### 5. Start Development
- See `NEXT_STEPS.md` → Phase 1
- Start with authentication implementation
- All code is in `apps/` folder

---

## 🎯 Common Workflows

### Starting Your Day
```powershell
cd C:\users\david\desktop\etsy\etsy-automation-platform
.\start.ps1
.\logs.ps1  # Keep this open in another terminal
```

### Making Code Changes

1. Edit files in your favorite editor (VS Code recommended)
2. For backend changes:
   ```powershell
   docker compose restart api
   ```
3. For frontend changes:
   ```powershell
   docker compose restart web
   ```

### Checking if Everything Works
```powershell
.\health.ps1
```

### Viewing Logs
```powershell
.\logs.ps1  # All services
docker compose logs api  # Just API
docker compose logs web  # Just frontend
```

### Stopping When Done
```powershell
.\stop.ps1
```

---

## 🔑 Environment Configuration

The `.env` file contains all configuration. Edit it if you need to:

```powershell
notepad .env
```

Key settings:
- `DB_PASSWORD` - Database password
- `ETSY_CLIENT_ID` - Add when you have Etsy API credentials
- `OPENAI_API_KEY` - Add when ready for AI features
- `PRINTFUL_API_KEY` - Add for order fulfillment

After editing `.env`:
```powershell
.\restart.ps1
```

---

## 📞 Getting Help

### Check Logs
```powershell
.\logs.ps1
```
Look for error messages (red text).

### Check Health
```powershell
.\health.ps1
```
Shows which services are having issues.

### Clean Start
```powershell
docker compose down -v
.\setup.ps1
```

### Documentation
- All `.md` files in project root
- Start with `INDEX.md` for navigation

---

## ✅ Verification Checklist

Before moving forward, verify:

- [ ] Docker Desktop is running
- [ ] `.\setup.ps1` completed successfully
- [ ] `.\health.ps1` shows all services healthy
- [ ] http://localhost:3000 loads the dashboard
- [ ] http://localhost:8080/docs shows API documentation
- [ ] Dashboard has dark theme with blue-green colors
- [ ] Recent orders table is visible

**If all checked, you're ready to start development! 🎉**

---

## 🚀 Ready to Code!

You now have a complete development environment running on Windows!

**Next**: Open `NEXT_STEPS.md` to see what to build in Phase 1.

**Happy coding! 💻**
