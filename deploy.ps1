# Deployment Script for Etsy Automation Platform
# This script connects to the server and deploys the latest changes

$SERVER = "146.19.143.180"
$PORT = "56777"
$USER = "root"
$APP_DIR = "/root/etsy-automation-platform"

Write-Host "Starting deployment to production server..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Pull latest changes
Write-Host "Step 1: Pulling latest changes from GitHub..." -ForegroundColor Yellow
$pullCmd = "cd $APP_DIR ; git pull origin main"
ssh -p $PORT ${USER}@${SERVER} $pullCmd

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to pull changes from GitHub" -ForegroundColor Red
    exit 1
}

Write-Host "Successfully pulled latest changes" -ForegroundColor Green
Write-Host ""

# Step 2: Rebuild and restart containers
Write-Host "Step 2: Rebuilding Docker containers..." -ForegroundColor Yellow
$deployCmd = "cd $APP_DIR ; docker compose down ; docker compose up -d --build"
ssh -p $PORT ${USER}@${SERVER} $deployCmd

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to rebuild containers" -ForegroundColor Red
    exit 1
}

Write-Host "Successfully rebuilt containers" -ForegroundColor Green
Write-Host ""

# Step 3: Check container status
Write-Host "Step 3: Checking container status..." -ForegroundColor Yellow
$statusCmd = "cd $APP_DIR ; docker compose ps"
ssh -p $PORT ${USER}@${SERVER} $statusCmd

Write-Host ""
Write-Host "Deployment completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Your application should be available at:" -ForegroundColor Cyan
Write-Host "   https://srv135768.hosttoname.com" -ForegroundColor White
Write-Host "   http://146.19.143.180:3000" -ForegroundColor White
Write-Host ""
