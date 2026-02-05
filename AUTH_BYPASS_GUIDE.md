# Authentication Bypass Guide

## Overview

This guide explains how to temporarily disable authentication in the Etsy Automation Platform for development and testing purposes. This feature allows developers to bypass login/signup flows while keeping all authentication code intact and easily reversible.

⚠️ **WARNING: NEVER enable auth bypass in production environments. This is for development and testing only.**

## Current State

Authentication is currently **DISABLED** via environment variables.

## How It Works

### Backend (API)

The backend uses a feature flag `AUTH_DISABLED` in the configuration to bypass JWT authentication:

**File:** `apps/api/app/core/config.py`
```python
# Auth bypass (for development/testing only - DO NOT use in production)
AUTH_DISABLED: bool = False
```

**File:** `apps/api/app/api/dependencies.py`

The `get_user_context` dependency checks if `AUTH_DISABLED` is `True`:
- If disabled: Returns a default `UserContext` using the first active user/membership in the database, or a dummy context if none exist
- If enabled: Performs normal JWT validation and authorization

### Frontend (Web)

The frontend uses `NEXT_PUBLIC_AUTH_DISABLED` environment variable to bypass authentication:

**File:** `apps/web/.env.local`
```
NEXT_PUBLIC_AUTH_DISABLED=true
```

**File:** `apps/web/lib/auth-context.tsx`

The `AuthProvider` checks if auth is disabled:
- If disabled: Sets a default user context and bypasses all auth API calls
- If enabled: Performs normal authentication flow

**Files:** `apps/web/app/login/page.tsx` and `apps/web/app/register/page.tsx`

Both pages redirect to the dashboard (`/`) when auth is disabled, preventing users from accessing login/signup pages.

## How to Disable Authentication (Current Setup)

### Step 1: Backend

Set the environment variable in `.env`:

```bash
# WARNING: Only enable AUTH_DISABLED in development/testing - NEVER in production
AUTH_DISABLED=true
```

### Step 2: Frontend

Create or update `apps/web/.env.local`:

```bash
# WARNING: Only enable NEXT_PUBLIC_AUTH_DISABLED in development/testing - NEVER in production
NEXT_PUBLIC_AUTH_DISABLED=true
```

### Step 3: Restart Services

```bash
docker compose down
docker compose up --build
```

Or restart individual services:

```bash
docker compose restart api worker beat web
```

## How to Re-Enable Authentication

### Step 1: Backend

Update `.env` to disable the bypass:

```bash
# Auth bypass disabled - normal authentication flow
AUTH_DISABLED=false
```

Or remove/comment out the line entirely (defaults to `false`).

### Step 2: Frontend

Update `apps/web/.env.local`:

```bash
# Auth bypass disabled - normal authentication flow
NEXT_PUBLIC_AUTH_DISABLED=false
```

Or delete the `.env.local` file entirely.

### Step 3: Restart Services

```bash
docker compose down
docker compose up --build
```

Or restart individual services:

```bash
docker compose restart api worker beat web
```

### Step 4: Verify

1. Navigate to `http://localhost:3000`
2. You should be redirected to `/login`
3. Authentication should work normally

## What Gets Bypassed

### Backend
- JWT token validation
- User authentication checks
- Session validation
- Authorization middleware (uses default `owner` role)

### Frontend
- Login form submission
- Registration form submission
- Token refresh
- Session checks
- Auth-protected route guards

## What Stays Intact

### All Code Remains
- All authentication endpoints (`/api/auth/login`, `/api/auth/register`, etc.)
- All JWT token generation/validation logic
- All password hashing/validation
- All OAuth flows (Google Sign-In, Etsy OAuth)
- All RBAC (role-based access control) logic
- All frontend auth components and pages

### Database Schema
- No changes to user/tenant/membership tables
- No changes to OAuth token storage
- No changes to audit logs

## Default User Context (When Bypassed)

### Backend
The system attempts to use the first active user and accepted membership from the database:

```python
UserContext(
    user_id=<first_user.id>,
    tenant_id=<first_membership.tenant_id>,
    role=<first_membership.role>,
    email=<first_user.email>,
    name=<first_user.name>,
    allowed_shop_ids=[]  # Empty = access to all shops
)
```

If no users exist, a dummy context is used:

```python
UserContext(
    user_id=1,
    tenant_id=1,
    role='owner',
    email='admin@example.com',
    name='Admin',
    allowed_shop_ids=[]
)
```

### Frontend
```typescript
{
  id: 1,
  email: 'admin@example.com',
  name: 'Admin',
  tenant_id: 1,
  tenant_name: 'Default Tenant',
  role: 'owner',
  profile_picture_url: null,
  tenant_description: null,
  onboarding_completed: true
}
```

## Security Considerations

### ⚠️ CRITICAL: Production Safety

1. **NEVER deploy with auth bypass enabled**
   - Always check environment variables before deployment
   - Use CI/CD checks to prevent `AUTH_DISABLED=true` in production
   - Consider using separate `.env.production` files

2. **Access Control**
   - When bypassed, all users have `owner` role permissions
   - No RBAC enforcement
   - All shops are accessible

3. **Audit Logs**
   - All actions are logged with the default user context
   - Cannot trace actions to real users when bypassed

4. **API Security**
   - All API endpoints are accessible without authentication
   - Rate limiting may not work correctly
   - No tenant isolation

### Recommended Production Checklist

Before deploying to production:

- [ ] Verify `AUTH_DISABLED=false` or not set in `.env`
- [ ] Verify `NEXT_PUBLIC_AUTH_DISABLED=false` or not set in `.env.local`
- [ ] Delete `.env.local` from production builds
- [ ] Test login/signup flows manually
- [ ] Verify JWT token generation works
- [ ] Verify OAuth flows work (Google, Etsy)
- [ ] Check audit logs show correct user IDs
- [ ] Verify RBAC permissions are enforced

## Testing Scenarios

### With Auth Disabled
1. Navigate to `http://localhost:3000` → Should go directly to dashboard
2. Try to access `/login` → Should redirect to dashboard
3. Try to access `/register` → Should redirect to dashboard
4. All API calls succeed with default user context

### With Auth Enabled
1. Navigate to `http://localhost:3000` → Should redirect to `/login`
2. Login with valid credentials → Should access dashboard
3. Invalid credentials → Should show error
4. Protected routes without login → Should redirect to `/login`

## Troubleshooting

### Issue: Frontend still shows login page when auth disabled

**Solution:**
1. Ensure `.env.local` exists in `apps/web/` directory
2. Verify `NEXT_PUBLIC_AUTH_DISABLED=true` is set
3. Rebuild and restart web service: `docker compose up --build web`
4. Clear browser cache and cookies

### Issue: Backend returns 401 Unauthorized when auth disabled

**Solution:**
1. Ensure `AUTH_DISABLED=true` is set in root `.env`
2. Restart API service: `docker compose restart api`
3. Check logs: `docker compose logs api | grep -i "auth"`

### Issue: Default user not working

**Solution:**
1. Ensure database has at least one user with an accepted membership
2. Check logs for user context creation
3. If needed, create a user manually:
   ```sql
   INSERT INTO users (email, name) VALUES ('admin@example.com', 'Admin');
   INSERT INTO tenants (name) VALUES ('Default Tenant');
   INSERT INTO memberships (user_id, tenant_id, role, invitation_status) 
   VALUES (1, 1, 'owner', 'accepted');
   ```

## Implementation Details

### Files Modified

#### Backend
- `apps/api/app/core/config.py` - Added `AUTH_DISABLED` flag
- `apps/api/app/api/dependencies.py` - Modified `get_user_context` to bypass when flag is true
- `.env` - Added `AUTH_DISABLED=true`

#### Frontend
- `apps/web/.env.local` - Created with `NEXT_PUBLIC_AUTH_DISABLED=true`
- `apps/web/lib/auth-context.tsx` - Modified `AuthProvider` to bypass when flag is true
- `apps/web/app/login/page.tsx` - Added redirect to dashboard when auth disabled
- `apps/web/app/register/page.tsx` - Added redirect to dashboard when auth disabled

### No Files Deleted
All authentication code remains intact and functional.

## Reverting Changes

To completely remove the auth bypass feature (not recommended unless you're sure):

1. Remove `AUTH_DISABLED` from `apps/api/app/core/config.py`
2. Revert changes to `apps/api/app/api/dependencies.py`
3. Remove bypass logic from `apps/web/lib/auth-context.tsx`
4. Remove bypass redirects from login/register pages
5. Delete `.env.local`
6. Remove `AUTH_DISABLED` from `.env`

However, it's **recommended to keep the bypass code** and simply set the environment variables to `false` instead.

## Summary

The authentication bypass feature is a non-destructive, reversible way to disable auth flows for development and testing. It works via environment variables and preserves all authentication code for easy reactivation.

**Remember: This is for development only. Never use in production.**
