# Fix Registration 500 Error

## Problem
Registration endpoint returns 500 Internal Server Error because JWT keys are missing or incomplete.

## Solution

### Step 1: Verify JWT Keys in .env File

On your production server, check that the JWT keys in `.env` are:
- **Complete** (not truncated)
- **On a single line** (no newlines)
- **Properly formatted** (starts with `-----BEGIN` and ends with `-----END`)

### Step 2: Format JWT Keys Correctly

JWT keys in `.env` must be on a single line. If your keys have newlines, remove them:

```bash
# On your production server
cd /path/to/etsy-automation-platform

# Check current keys
grep "JWT_PRIVATE_KEY" .env
grep "JWT_PUBLIC_KEY" .env
```

If keys are truncated or have newlines, update them:

```bash
# If you have private.pem and public.pem files:
JWT_PRIVATE_KEY=$(cat private.pem | tr -d '\n')
JWT_PUBLIC_KEY=$(cat public.pem | tr -d '\n')

# Then update .env file:
sed -i "s|JWT_PRIVATE_KEY=.*|JWT_PRIVATE_KEY=$JWT_PRIVATE_KEY|" .env
sed -i "s|JWT_PUBLIC_KEY=.*|JWT_PUBLIC_KEY=$JWT_PUBLIC_KEY|" .env
```

### Step 3: Restart API Container

After updating the `.env` file, restart the API container to load the new environment variables:

```bash
# Restart just the API container
docker compose -f docker-compose.prod.yml restart api

# OR restart all services
docker compose -f docker-compose.prod.yml restart
```

### Step 4: Verify Keys Are Loaded

Check that the API container has the JWT keys:

```bash
docker exec etsy-api python -c "from app.core.config import settings; print('Private key length:', len(settings.JWT_PRIVATE_KEY)); print('Public key length:', len(settings.JWT_PUBLIC_KEY))"
```

Expected output:
- Private key length: ~1700 characters
- Public key length: ~450 characters

### Step 5: Test Token Creation

Verify JWT token creation works:

```bash
docker exec etsy-api python -c "from app.core.security import create_access_token; token = create_access_token(1, 1, 'owner', [], False); print('Token created:', token[:50])"
```

If this works, registration should now work!

## Common Issues

### Issue 1: Keys are Truncated
**Symptom**: Keys end with `...` or are cut off
**Solution**: Ensure the full key is in the `.env` file (should be ~1700 chars for private, ~450 for public)

### Issue 2: Keys Have Newlines
**Symptom**: Keys span multiple lines in `.env`
**Solution**: Remove all newlines - keys must be on a single line

### Issue 3: Container Not Restarted
**Symptom**: Keys are correct in `.env` but still not working
**Solution**: Restart the API container: `docker compose -f docker-compose.prod.yml restart api`

### Issue 4: Wrong .env File Location
**Symptom**: Changes to `.env` don't take effect
**Solution**: Ensure `.env` is in the same directory as `docker-compose.prod.yml`

## Quick Fix Command

If you have `private.pem` and `public.pem` files on your server:

```bash
cd /path/to/etsy-automation-platform

# Update .env with keys (single line, no newlines)
JWT_PRIVATE_KEY=$(cat private.pem | tr -d '\n')
JWT_PUBLIC_KEY=$(cat public.pem | tr -d '\n')

# Update .env file
sed -i "s|JWT_PRIVATE_KEY=.*|JWT_PRIVATE_KEY=$JWT_PRIVATE_KEY|" .env
sed -i "s|JWT_PUBLIC_KEY=.*|JWT_PUBLIC_KEY=$JWT_PUBLIC_KEY|" .env

# Restart API
docker compose -f docker-compose.prod.yml restart api
```

## Verify It's Fixed

Try registering again at: `https://etsyauto.bigbotdrivers.com/register`

The 500 error should be resolved!




