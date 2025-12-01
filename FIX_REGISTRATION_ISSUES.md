# Fix Registration and Login Issues

## Problems Identified

1. **Registration fails with 500 error on first attempt** - User is created but email sending fails
2. **Second registration attempt shows "email already registered"** - Because user was created in first attempt
3. **Login fails with "error occurred"** - Because email is not verified and EMAIL_VERIFICATION_REQUIRED is True
4. **Email not configured** - SMTP settings are missing on server

## Solutions Applied

### 1. ✅ Made Registration More Robust
- Registration now handles email sending failures gracefully
- User account is created even if email sending fails
- No more 500 errors during registration

### 2. Email Configuration Required

**On your server, update the `.env` file:**

```bash
cd /home/deploy/etsyauto
nano .env
```

Add these email configuration variables:

```env
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=noreply@bigbotdrivers.com
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

**For Gmail:**
1. Enable 2-factor authentication
2. Generate an "App Password" at https://myaccount.google.com/apppasswords
3. Use that app password as `SMTP_PASSWORD`

**For Brevo (Recommended for Production):**
1. Sign up at https://www.brevo.com/
2. Get SMTP credentials from dashboard
3. Use:
   - `SMTP_HOST=smtp-relay.brevo.com`
   - `SMTP_PORT=587`
   - `SMTP_USER=your-brevo-email@example.com`
   - `SMTP_PASSWORD=your-brevo-smtp-key`

### 3. Restart API Container

After updating `.env`:

```bash
docker compose restart api
```

### 4. Clear Existing Test Users (Optional)

If you want to start fresh:

```bash
docker compose exec db psql -U postgres -d etsy_platform -c "TRUNCATE TABLE users RESTART IDENTITY CASCADE;"
```

## Testing

1. **Register a new account** - Should work without 500 errors
2. **Check email** - You should receive verification email
3. **Click verification link** - Should verify your email
4. **Login** - Should work after email verification

## If Email Still Doesn't Work

If you can't configure email right now, you can temporarily disable email verification:

```env
EMAIL_VERIFICATION_REQUIRED=false
```

Then restart API:
```bash
docker compose restart api
```

**Note:** This is NOT recommended for production, but useful for testing.

## Commit and Push Changes

After testing works:

```bash
git add apps/api/app/api/endpoints/auth.py
git commit -m "Fix: Make registration robust - handle email failures gracefully"
git push
```

