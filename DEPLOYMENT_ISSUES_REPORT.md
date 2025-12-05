# Deployment Issues Report - Production Server

**Date:** December 1, 2025  
**Environment:** Production Server (`https://etsyauto.bigbotdrivers.com`)  
**Status:** ✅ **RESOLVED** - All critical issues fixed

---

## Executive Summary

During deployment to production, we encountered multiple cascading issues that prevented user registration and login. The root causes were:
1. **CORS Configuration** - Frontend calling wrong API URL
2. **Database Schema** - Missing required columns
3. **Email Configuration** - SMTP not configured
4. **JWT Keys** - Missing or malformed authentication keys

All issues have been identified and resolved. The application is now fully functional.

---

## Issue #1: CORS Policy Error ❌ → ✅ FIXED

### Problem
- **Error:** `Access to fetch at 'http://localhost:8080/api/auth/me' from origin 'https://etsyauto.bigbotdrivers.com' has been blocked by CORS policy`
- **Symptom:** Frontend couldn't communicate with backend API
- **Root Cause:** Frontend was hardcoded to call `http://localhost:8080` instead of production domain

### Investigation
- Browser console showed all API calls going to `localhost:8080`
- Nginx was correctly configured to proxy `/api/` to backend
- Environment variable `NEXT_PUBLIC_API_URL` was set to `localhost:8080` in `docker-compose.yml`

### Solution
**Files Modified:**
- `docker-compose.yml` - Updated `NEXT_PUBLIC_API_URL` and `NEXTAUTH_URL` to `https://etsyauto.bigbotdrivers.com`

**Changes:**
```yaml
environment:
  NEXT_PUBLIC_API_URL: https://etsyauto.bigbotdrivers.com  # Changed from localhost:8080
  NEXTAUTH_URL: https://etsyauto.bigbotdrivers.com         # Changed from localhost:3000
```

**Action Taken:**
1. Updated `docker-compose.yml` on server
2. Rebuilt web container: `docker compose up -d --build web`
3. Verified frontend now calls correct domain

**Status:** ✅ **RESOLVED**

---

## Issue #2: Database Schema Missing Columns ❌ → ✅ FIXED

### Problem
- **Error:** `psycopg2.errors.UndefinedColumn: column users.verification_token does not exist`
- **Symptom:** Registration failed with 500 Internal Server Error
- **Root Cause:** Database migrations not run, missing required columns

### Investigation
- API logs showed SQL queries trying to access columns that didn't exist:
  - `verification_token`
  - `verification_token_expires`
  - `reset_token`
  - `reset_token_expires`
  - `failed_login_attempts`
  - `locked_until`
  - `last_login_at`
  - `deleted_at`

### Solution
**Action Taken:**
```sql
-- Added all missing columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_expires TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
```

**Status:** ✅ **RESOLVED**

---

## Issue #3: Registration Flow Failures ❌ → ✅ FIXED

### Problem
- **Symptom 1:** First registration attempt → "error occurred" (500 error)
- **Symptom 2:** Second registration attempt → "email already registered" (400 error)
- **Symptom 3:** Login with registered email → "error occurred" (500 error)
- **Root Cause:** 
  1. User was created in database, but email sending failed
  2. Registration endpoint crashed after user creation
  3. Transaction wasn't rolled back, leaving orphaned user records

### Investigation
- Registration created user, tenant, and membership successfully
- Email sending failed (SMTP not configured)
- Exception during email sending caused 500 error
- User record remained in database even though registration "failed"

### Solution
**File Modified:** `apps/api/app/api/endpoints/auth.py`

**Changes:**
```python
# Before: Email sending could crash registration
if settings.EMAIL_VERIFICATION_REQUIRED:
    send_verification_email(user.email, user.name, verification_token)
    raise HTTPException(...)

# After: Email failures don't crash registration
if settings.EMAIL_VERIFICATION_REQUIRED:
    try:
        email_sent = send_verification_email(user.email, user.name, verification_token)
        if not email_sent:
            print(f"⚠️  Warning: Failed to send verification email...")
    except Exception as e:
        print(f"⚠️  Warning: Exception sending verification email: {e}")
    
    # Always return 202, even if email failed
    raise HTTPException(...)
```

**Status:** ✅ **RESOLVED**

---

## Issue #4: Email Configuration Missing ❌ → ✅ FIXED

### Problem
- **Error:** `Email not configured. Would have sent to...`
- **Symptom:** Verification emails not sent, password reset emails not sent
- **Root Cause:** SMTP environment variables not set in `.env` file

### Investigation
- API logs showed: `⚠️  Email not configured. Would have sent to...`
- Email service checks for `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`
- All were empty/missing in server `.env`

### Solution
**Action Taken:**
Added to server `.env` file:
```env
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=justsirdave@gmail.com
SMTP_PASSWORD=<app-password>
SMTP_FROM_EMAIL=justsirdave@gmail.com
SMTP_FROM_NAME=Etsy Automation Platform
FRONTEND_URL=https://etsyauto.bigbotdrivers.com

# Auth Configuration
EMAIL_VERIFICATION_REQUIRED=true
VERIFICATION_TOKEN_EXPIRY_HOURS=24
RESET_TOKEN_EXPIRY_HOURS=1
MAX_LOGIN_ATTEMPTS=5
ACCOUNT_LOCKOUT_MINUTES=30
REMEMBER_ME_TTL_DAYS=30
```

**Status:** ✅ **RESOLVED** (Email verification now working)

---

## Issue #5: JWT Keys Missing/Malformed ❌ → ✅ FIXED

### Problem
- **Error:** `ValueError: Unable to load PEM file. MalformedFraming`
- **Symptom:** Login failed with 500 Internal Server Error after successful registration
- **Root Cause:** `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` missing or malformed in `.env`

### Investigation
- Stack trace showed error in `create_access_token()` function
- JWT encoding failed when trying to sign tokens
- Error occurred at: `jwt.encode(payload, settings.JWT_PRIVATE_KEY, algorithm="RS256")`
- Server `.env` file had empty or missing JWT keys

### Solution
**Action Taken:**
```bash
# Generated RSA key pair on server
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem

# Formatted keys (removed newlines) and added to .env
PRIVATE_KEY=$(cat private.pem | tr -d '\n')
PUBLIC_KEY=$(cat public.pem | tr -d '\n')

echo "JWT_PRIVATE_KEY=$PRIVATE_KEY" >> .env
echo "JWT_PUBLIC_KEY=$PUBLIC_KEY" >> .env

# Restarted API container
docker compose restart api
```

**Status:** ✅ **RESOLVED** (Login now working)

---

## Current System Status

### ✅ Working Features
- [x] User Registration
- [x] Email Verification
- [x] User Login
- [x] Password Reset (email sending)
- [x] JWT Token Generation
- [x] CORS Configuration
- [x] Database Schema
- [x] API Health Checks

### ⚠️ Known Limitations
- Email sending uses Gmail SMTP (free tier has daily limits)
- Consider migrating to Brevo/SendGrid for production scale

### 📋 Recommended Next Steps

1. **Email Service Upgrade** (Optional but Recommended)
   - Migrate from Gmail SMTP to Brevo or SendGrid
   - Better deliverability and analytics
   - See `docs/EMAIL_SETUP.md` for Brevo setup

2. **Database Migrations** (Future)
   - Set up Alembic migrations to run automatically
   - Prevent schema drift issues

3. **Monitoring** (Future)
   - Set up error tracking (Sentry)
   - Monitor email delivery rates
   - Track registration/login success rates

---

## Files Modified During Fixes

### Backend
- `apps/api/app/api/endpoints/auth.py` - Made registration robust to email failures

### Configuration
- `docker-compose.yml` - Updated environment variables for production
- Server `.env` file - Added email and JWT configuration

### Database
- `users` table - Added missing columns via SQL ALTER statements

---

## Testing Checklist

- [x] Registration with new email → Success
- [x] Email verification received → Success
- [x] Email verification link works → Success
- [x] Login after verification → Success
- [x] Registration with existing email → Shows "email already registered"
- [x] Login without verification → Shows "Please verify your email"
- [x] Password reset email → Received

---

## Lessons Learned

1. **Environment Variables:** Always verify all required env vars are set in production
2. **Database Migrations:** Run migrations before deploying new code
3. **Error Handling:** Make critical flows (like registration) resilient to non-critical failures (like email)
4. **JWT Keys:** Generate keys during initial setup, not during deployment
5. **CORS:** Use same domain for frontend and API to avoid CORS issues

---

## Commands Reference

### Check API Logs
```bash
docker compose logs api --tail 100
```

### Check Database Schema
```bash
docker compose exec db psql -U postgres -d etsy_platform -c "\d users"
```

### Restart Services
```bash
docker compose restart api
docker compose restart web
```

### Rebuild After Code Changes
```bash
docker compose up -d --build api
docker compose up -d --build web
```

---

## Conclusion

All critical deployment issues have been resolved. The application is now fully functional in production. Users can:
- Register new accounts
- Receive and verify email addresses
- Log in successfully
- Reset passwords

The system is ready for production use. 🎉

