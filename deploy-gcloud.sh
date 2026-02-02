#!/bin/bash

# Google Cloud Deployment Script for Etsy Automation Platform
# Run this script on your Google Cloud VM after cloning the repository

set -e  # Exit on error

echo "=========================================="
echo "Etsy Automation Platform - GCloud Deploy"
echo "=========================================="
echo ""

# Check if running on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    echo "❌ Error: This script must run on Linux (Google Cloud VM)"
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    echo "✅ Docker installed"
else
    echo "✅ Docker already installed"
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "📦 Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo "✅ Docker Compose installed"
else
    echo "✅ Docker Compose already installed"
fi

echo ""
echo "=========================================="
echo "Environment Configuration"
echo "=========================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Copying from .env.example..."
    cp .env.example .env
    echo ""
    echo "🔧 Please edit .env file with your configuration:"
    echo "   nano .env"
    echo ""
    echo "Critical variables to update:"
    echo "  - DB_PASSWORD"
    echo "  - JWT_PRIVATE_KEY / JWT_PUBLIC_KEY"
    echo "  - ENCRYPTION_KEY"
    echo "  - ETSY_CLIENT_ID / ETSY_CLIENT_SECRET"
    echo "  - ETSY_REDIRECT_URI (use your VM IP)"
    echo "  - OPENAI_API_KEY"
    echo "  - GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET"
    echo "  - GOOGLE_REDIRECT_URI (use your VM IP)"
    echo ""
    read -p "Press Enter after updating .env file..."
else
    echo "✅ .env file found"
fi

echo ""
echo "=========================================="
echo "Get VM External IP"
echo "=========================================="
echo ""

VM_IP=$(curl -s ifconfig.me)
echo "Your VM External IP: $VM_IP"
echo ""
echo "Make sure to update these in .env:"
echo "  ETSY_REDIRECT_URI=http://$VM_IP:8080/api/shops/etsy/callback"
echo "  GOOGLE_REDIRECT_URI=http://$VM_IP:3000/oauth/google/callback"
echo "  FRONTEND_URL=http://$VM_IP:3000"
echo ""
read -p "Have you updated these URLs in .env? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Please update .env file and run this script again"
    exit 1
fi

echo ""
echo "=========================================="
echo "Building Docker Images"
echo "=========================================="
echo ""

docker-compose build

echo ""
echo "=========================================="
echo "Starting Services"
echo "=========================================="
echo ""

docker-compose up -d

echo ""
echo "Waiting for services to be healthy..."
sleep 10

# Check service status
echo ""
docker-compose ps

echo ""
echo "=========================================="
echo "Running Database Migrations"
echo "=========================================="
echo ""

# Wait for database to be ready
echo "Waiting for database..."
sleep 5

# Run migrations
docker-compose exec -T api alembic upgrade head

echo ""
echo "=========================================="
echo "✅ Deployment Complete!"
echo "=========================================="
echo ""
echo "Your services are now running at:"
echo ""
echo "  🌐 Frontend:    http://$VM_IP:3000"
echo "  🔧 API:         http://$VM_IP:8080"
echo "  📊 API Docs:    http://$VM_IP:8080/docs"
echo "  📈 Grafana:     http://$VM_IP:3001"
echo "  🗄️  Adminer:     http://$VM_IP:8081"
echo ""
echo "Default Credentials:"
echo "  Grafana: admin / [your GRAFANA_PASSWORD from .env]"
echo ""
echo "Useful Commands:"
echo "  View logs:         docker-compose logs -f"
echo "  Restart services:  docker-compose restart"
echo "  Stop services:     docker-compose down"
echo "  Update app:        git pull && docker-compose build && docker-compose up -d"
echo ""
echo "🎉 Share http://$VM_IP:3000 with your clients!"
echo ""
