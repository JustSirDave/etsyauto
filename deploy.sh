#!/bin/bash

# BlueVPS Deployment Script
# Run this script on your BlueVPS server

set -e

echo "🚀 Starting deployment to BlueVPS..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "📝 Please copy env.production.example to .env and fill in your values"
    exit 1
fi

# Load environment variables (if .env exists)
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Pull latest code
echo "📥 Pulling latest code from GitHub..."
git pull origin main

# Build and start services
echo "🔨 Building Docker images..."
docker compose -f docker-compose.prod.yml build --no-cache

echo "🛑 Stopping existing containers..."
docker compose -f docker-compose.prod.yml down

echo "🚀 Starting services..."
docker compose -f docker-compose.prod.yml up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to start..."
sleep 10

# Check service health
echo "🏥 Checking service health..."
docker compose -f docker-compose.prod.yml ps

echo "✅ Deployment complete!"
echo "🌐 Your app should be available at: ${FRONTEND_URL}"
echo ""
echo "📊 Service Status:"
docker compose -f docker-compose.prod.yml ps

