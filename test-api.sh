#!/bin/bash
# Quick API test script

echo "🔍 Testing Etsy Automation Platform API..."
echo ""

# Test 1: Health Check
echo "1. Testing health endpoint..."
curl -s http://localhost:8080/healthz | jq .
echo ""

# Test 2: Root endpoint
echo "2. Testing root endpoint..."
curl -s http://localhost:8080/ | jq .
echo ""

# Test 3: Register user
echo "3. Testing user registration..."
curl -s -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpassword123",
    "name": "Test User",
    "tenant_name": "Test Shop"
  }' | jq .
echo ""

echo "✅ Tests complete!"
