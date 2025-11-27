# Database Management Guide

## Clear All User Data

### Method 1: Windows Batch Script (Easiest)

**On Windows**, double-click the file:
```
clear-users.bat
```

Or run from command prompt:
```cmd
cd C:\Users\David\Desktop\ETSY\etsy-automation-platform
clear-users.bat
```

### Method 2: Bash Script (Linux/Mac/Git Bash)

```bash
cd /c/Users/David/Desktop/ETSY/etsy-automation-platform
./clear-users.sh
```

### Method 3: Single Command (Quick)

```bash
docker-compose exec -T db psql -U postgres -d etsy_platform -c "TRUNCATE TABLE users CASCADE;"
```

This will automatically delete all related data:
- Users
- Tenants (organizations)
- Memberships
- Shops
- Products
- Listings
- Orders
- Schedules
- AI generations
- Usage costs

### Method 4: Manual SQL (Full Control)

Connect to database:
```bash
docker-compose exec db psql -U postgres -d etsy_platform
```

Then run SQL commands:
```sql
-- See current user count
SELECT COUNT(*) FROM users;

-- Clear all data
TRUNCATE TABLE users CASCADE;
TRUNCATE TABLE tenants CASCADE;

-- Reset auto-increment IDs (optional)
ALTER SEQUENCE users_id_seq RESTART WITH 1;
ALTER SEQUENCE tenants_id_seq RESTART WITH 1;
ALTER SEQUENCE memberships_id_seq RESTART WITH 1;

-- Verify it's empty
SELECT COUNT(*) FROM users;

-- Exit
\q
```

## View Current Users

### Quick Check
```bash
docker-compose exec db psql -U postgres -d etsy_platform -c "SELECT id, email, email_verified, created_at FROM users;"
```

### Detailed User Info
```bash
docker-compose exec db psql -U postgres -d etsy_platform
```

Then:
```sql
-- All users with verification status
SELECT
    u.id,
    u.email,
    u.name,
    u.email_verified,
    u.failed_login_attempts,
    u.locked_until,
    u.created_at
FROM users u
ORDER BY u.created_at DESC;

-- Users with their organizations
SELECT
    u.email,
    u.name,
    t.name as organization,
    m.role
FROM users u
JOIN memberships m ON u.id = m.user_id
JOIN tenants t ON m.tenant_id = t.id
ORDER BY u.created_at DESC;
```

## Delete Specific User

### By Email
```bash
docker-compose exec db psql -U postgres -d etsy_platform -c "DELETE FROM users WHERE email = 'user@example.com';"
```

### By ID
```bash
docker-compose exec db psql -U postgres -d etsy_platform -c "DELETE FROM users WHERE id = 1;"
```

## Reset Specific User's Password (Without Email)

If you need to manually reset a user's password:

```bash
# Generate a bcrypt hash for "NewPassword123"
docker-compose exec api python -c "from app.core.security import hash_password; print(hash_password('NewPassword123'))"
```

Copy the hash, then update user:
```bash
docker-compose exec db psql -U postgres -d etsy_platform -c "UPDATE users SET password_hash = 'PASTE_HASH_HERE' WHERE email = 'user@example.com';"
```

## Mark User as Verified (Skip Email Verification)

```bash
docker-compose exec db psql -U postgres -d etsy_platform -c "UPDATE users SET email_verified = TRUE, verification_token = NULL WHERE email = 'user@example.com';"
```

## Unlock Locked Account

```bash
docker-compose exec db psql -U postgres -d etsy_platform -c "UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE email = 'user@example.com';"
```

## Database Backup

### Create Backup
```bash
docker-compose exec db pg_dump -U postgres etsy_platform > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore Backup
```bash
cat backup_20250127_143000.sql | docker-compose exec -T db psql -U postgres -d etsy_platform
```

## Complete Database Reset (Nuclear Option)

⚠️ **WARNING**: This deletes EVERYTHING including all configuration!

```bash
docker-compose down -v
docker-compose up -d
```

Then re-run migrations:
```bash
docker-compose exec db psql -U postgres -d etsy_platform -f /docker-entrypoint-initdb.d/001_add_auth_fields.sql
```

## Useful PostgreSQL Commands

When connected to database (`docker-compose exec db psql -U postgres -d etsy_platform`):

```sql
-- List all tables
\dt

-- Describe users table structure
\d users

-- Show all databases
\l

-- Show current connections
SELECT * FROM pg_stat_activity WHERE datname = 'etsy_platform';

-- Table sizes
SELECT
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Exit
\q
```

## Common Issues

### "Cannot delete because of foreign key constraint"
Use `CASCADE` to automatically delete related data:
```sql
DELETE FROM users WHERE email = 'user@example.com' CASCADE;
```

Or use TRUNCATE instead:
```sql
TRUNCATE TABLE users CASCADE;
```

### "Database is being accessed by other users"
Restart the API container first:
```bash
docker-compose restart api
```

Then try the operation again.

### "Permission denied"
Make sure you're using the `postgres` user:
```bash
docker-compose exec db psql -U postgres -d etsy_platform
```

## Security Notes

- **Never commit database backups** to git (they contain passwords)
- **Always use environment variables** for sensitive data
- **Backup before major changes** to production database
- **Test destructive commands** on development first
- **Clear test data regularly** during development

## Quick Reference

| Task | Command |
|------|---------|
| Clear all users | `clear-users.bat` or `./clear-users.sh` |
| View users | `docker-compose exec db psql -U postgres -d etsy_platform -c "SELECT * FROM users;"` |
| Delete one user | `docker-compose exec db psql -U postgres -d etsy_platform -c "DELETE FROM users WHERE email = 'user@example.com';"` |
| Verify user | `docker-compose exec db psql -U postgres -d etsy_platform -c "UPDATE users SET email_verified = TRUE WHERE email = 'user@example.com';"` |
| Unlock account | `docker-compose exec db psql -U postgres -d etsy_platform -c "UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE email = 'user@example.com';"` |
| Backup | `docker-compose exec db pg_dump -U postgres etsy_platform > backup.sql` |
| Connect to DB | `docker-compose exec db psql -U postgres -d etsy_platform` |
