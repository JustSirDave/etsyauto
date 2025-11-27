# Email Setup with Brevo (Sendinblue)

## Why Brevo?
- **Professional email delivery** (99% deliverability)
- **Free tier**: 300 emails/day (perfect for development)
- **Easy setup**: Just SMTP credentials
- **Analytics**: Track email opens, clicks, bounces
- **No code changes**: Drop-in replacement for Gmail

## Setup Steps:

### 1. Sign Up for Brevo
1. Go to: https://www.brevo.com/
2. Click "Sign Up Free"
3. Verify your email
4. Complete onboarding

### 2. Get SMTP Credentials
1. Go to "SMTP & API" in dashboard
2. Click "SMTP" tab
3. Copy your credentials:
   - Login (email): your-email@example.com
   - SMTP key: xsmtpsib-xxxx (looks like a long random string)
   - Server: smtp-relay.brevo.com
   - Port: 587

### 3. Add to .env File

```env
# Email Configuration (Brevo for Production-Ready Emails)
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your-brevo-email@example.com
SMTP_PASSWORD=your-brevo-smtp-key
SMTP_FROM_EMAIL=noreply@bigbotdrivers.com  # Your domain email
SMTP_FROM_NAME=Etsy Automation Platform
FRONTEND_URL=http://localhost:3000

# Auth Configuration
EMAIL_VERIFICATION_REQUIRED=true
VERIFICATION_TOKEN_EXPIRY_HOURS=24
RESET_TOKEN_EXPIRY_HOURS=1
MAX_LOGIN_ATTEMPTS=5
ACCOUNT_LOCKOUT_MINUTES=30
REMEMBER_ME_TTL_DAYS=30
```

### 4. Verify Sender Domain (Important!)
1. In Brevo dashboard, go to "Senders & IP"
2. Add your domain: bigbotdrivers.com
3. Add DNS records Brevo provides:
   - SPF record
   - DKIM record
   - Domain verification TXT record
4. This ensures emails don't go to spam

### 5. Restart API Container
```bash
docker-compose restart api
```

### 6. Test Email Flow
1. Register a new account
2. Check your inbox for verification email
3. Verify email works end-to-end
4. Test password reset flow

## Cost Breakdown:

### Free Tier (Development)
- 300 emails/day
- Unlimited contacts
- Email support

### Starter Plan ($25/month) (Production)
- 20,000 emails/month
- No daily sending limit
- Advanced statistics
- Remove Brevo logo

### Business Plan ($65/month) (Scale)
- 40,000 emails/month
- Marketing automation
- A/B testing
- Phone support

## Production Checklist:
- [ ] Sign up for Brevo
- [ ] Get SMTP credentials
- [ ] Add domain verification DNS records
- [ ] Configure sender: noreply@bigbotdrivers.com
- [ ] Test email delivery
- [ ] Monitor deliverability in dashboard
- [ ] Upgrade to paid plan when needed

## Alternative Services:

### SendGrid (Twilio)
- Similar to Brevo
- 100 emails/day free
- Better developer docs
- SMTP: smtp.sendgrid.net:587

### Mailgun
- Developer-focused
- 100 emails/day free
- Great API
- SMTP: smtp.mailgun.org:587

### AWS SES
- Cheapest ($0.10 per 1000 emails)
- Requires AWS setup
- Best for high volume
- More complex setup

## Why NOT Use Auth0?

Auth0 is excellent for:
- ✅ Social login (Google, Facebook, etc.)
- ✅ Enterprise SSO
- ✅ Multi-factor authentication
- ✅ Compliance (SOC2, HIPAA)
- ✅ If you don't want to maintain auth code

But for your project:
- ❌ Expensive ($240+/year, scales with users)
- ❌ Your custom multi-tenant RBAC is already built
- ❌ Would require significant refactoring
- ❌ Vendor lock-in
- ❌ Less flexibility for Etsy-specific features

**Our custom auth + Brevo** gives you:
- ✅ Full control
- ✅ Professional email delivery
- ✅ Cost-effective
- ✅ Already working
- ✅ Easy to maintain

## Security Best Practices (Already Implemented)

- ✅ RS256 JWT tokens (public/private key)
- ✅ Password hashing with bcrypt
- ✅ Account lockout after failed attempts
- ✅ Email verification
- ✅ Password reset with expiring tokens
- ✅ Remember me with extended sessions
- ✅ Disposable email blocking
- ✅ Role-based access control (RBAC)
- ✅ Multi-tenancy isolation

This is **enterprise-grade authentication** without the enterprise price tag.
