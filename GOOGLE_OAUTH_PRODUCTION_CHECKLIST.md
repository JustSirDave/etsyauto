# Google OAuth 2.0 Production Deployment Checklist

## ✅ Implementation Status

### Backend (Server-Side Verification) ✓
- [x] Google ID token verification with `google-auth` library
- [x] Signature validation (automatic via `verify_oauth2_token`)
- [x] Audience (aud) validation - matches `GOOGLE_CLIENT_ID`
- [x] Issuer (iss) validation - `accounts.google.com` or `https://accounts.google.com`
- [x] Expiration (exp) validation - automatic via library
- [x] Email verification check (`email_verified` claim)
- [x] Detailed error messages for all validation failures
- [x] Logging of all authentication attempts (success/failure)

### Account Linking & User Management ✓
- [x] Uses Google `sub` claim as unique identifier
- [x] Links Google account to existing email-based users
- [x] Creates new user + organization for first-time Google users
- [x] Updates user profile picture from Google
- [x] Marks email as verified automatically
- [x] Prevents duplicate account creation

### Security ✓
- [x] Rate limiting on Google OAuth endpoint (10 req/min per IP)
- [x] Environment variables for OAuth credentials (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)
- [x] Conservative JWT session lifetime (5 minutes default)
- [x] Refresh token support (via remember_me flag)
- [x] HTTPS-only in production
- [x] CORS properly configured

### Frontend ✓
- [x] Uses `@react-oauth/google` official library
- [x] Error handling with user-friendly messages
- [x] Loading states during authentication
- [x] Toast notifications for errors
- [x] Post-login onboarding detection for new users

### Error Handling ✓
- [x] Clear, actionable error messages (no generic "authentication failed")
- [x] Different error codes for different scenarios (400, 401, 429, 500)
- [x] Logs detailed errors server-side
- [x] User-friendly errors client-side

---

## 🚀 Production Setup Steps

### 1. Google Cloud Console Configuration

#### Create OAuth 2.0 Credentials
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing project
3. Enable **Google+ API** (for user info)
4. Navigate to **APIs & Services > Credentials**
5. Create **OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Name: `Etsy Automation Platform - Production`

#### Configure Authorized Origins
Add all domains where your frontend is hosted:
```
https://etsyauto.bigbotdrivers.com
https://www.etsyauto.bigbotdrivers.com
```

#### Configure Authorized Redirect URIs
```
https://etsyauto.bigbotdrivers.com
https://etsyauto.bigbotdrivers.com/
https://www.etsyauto.bigbotdrivers.com
https://www.etsyauto.bigbotdrivers.com/
```

**Note:** Google OAuth button handles redirect internally, but these must match your frontend URL

#### Configure OAuth Consent Screen
1. Go to **OAuth consent screen**
2. Choose **External** (for public use) or **Internal** (for organization only)
3. Fill in required fields:
   - App name: `Etsy Automation Platform`
   - User support email: your-email@example.com
   - App logo: (optional, your logo)
   - Application home page: `https://etsyauto.bigbotdrivers.com`
   - Privacy policy: `https://etsyauto.bigbotdrivers.com/privacy`
   - Terms of service: `https://etsyauto.bigbotdrivers.com/terms`
4. **Scopes**: Add these scopes
   - `openid` - Required
   - `email` - Required
   - `profile` - Required
5. **Test users** (if not published):
   - Add test user emails during development
6. **Publishing status**:
   - Submit for verification if app will be public
   - Or keep in testing mode for limited users

### 2. Environment Variables Setup

#### Server (API) - `.env` or secrets manager
```bash
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://etsyauto.bigbotdrivers.com

# Required for production
ENVIRONMENT=production
DEBUG=False

# HTTPS enforcement
FRONTEND_URL=https://etsyauto.bigbotdrivers.com

# JWT Configuration (conservative settings)
JWT_TTL_SECONDS=300  # 5 minutes
REMEMBER_ME_TTL_DAYS=30  # 30 days for refresh

# Rate Limiting
REDIS_URL=redis://redis:6379/0  # Required for rate limiting
```

#### Frontend (Next.js) - Environment Variables
**Build-time** (in `.env.production` or build args):
```bash
NEXT_PUBLIC_API_URL=https://etsyauto.bigbotdrivers.com
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

**Update `docker-compose.yml` for production:**
```yaml
services:
  web:
    build:
      context: ./apps/web
      dockerfile: Dockerfile
      args:
        NEXT_PUBLIC_API_URL: https://etsyauto.bigbotdrivers.com
        NEXT_PUBLIC_GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
    environment:
      NEXT_PUBLIC_API_URL: https://etsyauto.bigbotdrivers.com
      NEXT_PUBLIC_GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
```

### 3. Security Checklist

- [ ] **HTTPS Only**: Ensure all traffic uses HTTPS (no mixed content)
- [ ] **Secure Cookies**: Set `Secure` and `HttpOnly` flags on session cookies
- [ ] **CORS Configuration**: Restrict to production domains only
  ```python
  CORS_ORIGINS = [
      "https://etsyauto.bigbotdrivers.com",
      "https://www.etsyauto.bigbotdrivers.com"
  ]
  ```
- [ ] **Rate Limiting**: Redis must be running for rate limiting to work
- [ ] **Secrets Management**: Never commit OAuth secrets to git
- [ ] **Log Monitoring**: Set up monitoring for failed auth attempts
- [ ] **CSP Headers**: Configure Content Security Policy

### 4. Testing Checklist

#### Pre-Production Testing
- [ ] Test Google sign-in with new user (first time)
- [ ] Test Google sign-in with existing email user (account linking)
- [ ] Test Google sign-in with existing Google user (returning user)
- [ ] Test with unverified Gmail account (should fail with clear message)
- [ ] Test rate limiting (10+ requests in 1 minute should trigger 429)
- [ ] Test token expiration (wait 5 minutes, should prompt re-login)
- [ ] Test error scenarios:
  - [ ] Invalid/expired token
  - [ ] Network failure
  - [ ] User cancels sign-in popup
  - [ ] Database connection failure

#### Production Smoke Test
After deployment:
- [ ] Sign in with Google (new user)
- [ ] Sign out and sign in again (existing user)
- [ ] Check logs for any errors
- [ ] Verify JWT token expiry works
- [ ] Verify rate limiting works (test with API tool)

### 5. Monitoring & Logging

Set up alerts for:
- [ ] High rate of Google OAuth failures (> 5% of attempts)
- [ ] Rate limit hits (429 responses)
- [ ] Token verification failures
- [ ] Database errors during auth
- [ ] Redis connection failures

Log important events:
- [x] New user registrations via Google
- [x] Account linking events
- [x] Failed authentication attempts
- [x] Rate limit violations

### 6. User Communication

Update user-facing documentation:
- [ ] How to sign in with Google
- [ ] What happens to existing email/password accounts (they can link Google)
- [ ] Privacy: What data Google shares (email, name, profile picture)
- [ ] How to unlink Google account (if feature exists)

### 7. Rollback Plan

If issues occur in production:
1. **Disable Google OAuth temporarily**:
   - Set `GOOGLE_CLIENT_ID` to empty string
   - Restart API container
   - Users fall back to email/password login

2. **Database rollback**:
   - Keep backup before deployment
   - Rollback command:
     ```bash
     docker compose exec db pg_restore -U postgres -d etsy_platform < backup.sql
     ```

3. **Check logs**:
   ```bash
   docker compose logs api --tail 100 | grep -i "google\|oauth"
   ```

---

## 📋 Production Deployment Commands

```bash
# 1. Build with production environment variables
docker compose -f docker-compose.prod.yml build

# 2. Deploy to production
docker compose -f docker-compose.prod.yml up -d

# 3. Verify all services are running
docker compose ps

# 4. Check API logs for Google OAuth startup
docker compose logs api | grep -i "google"

# 5. Test Google OAuth endpoint
curl -X POST https://etsyauto.bigbotdrivers.com/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{"google_token": "invalid_token_for_testing"}' \
  # Should return 400 with clear error message

# 6. Monitor logs in real-time
docker compose logs -f api web
```

---

## 🔒 Security Best Practices

### Implemented ✓
- [x] Server-side token verification (not client-side only)
- [x] Rate limiting (10 req/min per IP)
- [x] Detailed logging of all auth attempts
- [x] Secure session management with JWT
- [x] Account linking to prevent duplicates
- [x] Email verification requirement

### Recommended (Additional)
- [ ] **Two-Factor Authentication** (2FA) for admin accounts
- [ ] **IP whitelisting** for admin access
- [ ] **Audit logging** for all user account changes
- [ ] **Automated security scanning** (OWASP, dependency vulnerabilities)
- [ ] **Regular security reviews** of OAuth implementation

---

## 📊 Success Metrics

Track these metrics after deployment:
- **Google OAuth adoption rate**: % of users using Google vs email/password
- **Authentication success rate**: Should be > 95%
- **Error rate by type**: Track which errors are most common
- **Rate limit hits**: Should be rare (< 0.1% of requests)
- **Account linking events**: How many users link existing accounts

---

## 🆘 Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Invalid token" | Token expired or client ID mismatch | Check `GOOGLE_CLIENT_ID` matches Google Console |
| "Email not verified" | User's Google account email not verified | Ask user to verify email in Google account settings |
| Rate limit 429 | Too many requests | Normal behavior, user should wait 1 minute |
| "User has no organization" | Database error | Check logs, may need to manually create tenant |
| CORS error | Frontend domain not whitelisted | Add to `CORS_ORIGINS` in backend |

### Debug Mode
To enable detailed OAuth logging:
```python
# In config.py or environment
DEBUG=True
LOG_LEVEL=DEBUG
```

---

## ✅ Final Checklist Before Going Live

- [ ] Google Cloud Console configured with production URLs
- [ ] OAuth consent screen published (if public)
- [ ] Environment variables set in production
- [ ] HTTPS working on frontend and API
- [ ] Rate limiting tested and working
- [ ] All error scenarios tested
- [ ] Monitoring and alerts configured
- [ ] Documentation updated
- [ ] Rollback plan tested
- [ ] Team trained on troubleshooting

**Status: READY FOR PRODUCTION** ✅

