#!/bin/bash
# Clear all user login data from database

echo "⚠️  WARNING: This will delete ALL users and related data!"
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Cancelled"
    exit 1
fi

echo "🗑️  Clearing database..."

docker-compose exec -T db psql -U postgres -d etsy_platform << SQL
-- Disable foreign key checks temporarily
SET session_replication_role = 'replica';

-- Clear all user-related data (cascades to memberships, shops, products, etc.)
TRUNCATE TABLE users CASCADE;
TRUNCATE TABLE tenants CASCADE;

-- Reset auto-increment IDs
ALTER SEQUENCE users_id_seq RESTART WITH 1;
ALTER SEQUENCE tenants_id_seq RESTART WITH 1;
ALTER SEQUENCE memberships_id_seq RESTART WITH 1;

-- Re-enable foreign key checks
SET session_replication_role = 'origin';
SQL

echo "✅ Database cleared successfully!"
echo "📊 Checking remaining users..."
docker-compose exec -T db psql -U postgres -d etsy_platform -c "SELECT COUNT(*) as user_count FROM users;"
