# Quick Start: Fix Email Delivery NOW

**Immediate solution for your production server email issues**

---

## Problem

- Users register but don't receive verification emails
- Registration fails with "registration failed" message
- Emails arrive after long delays
- Silent failures with no error messages

## Root Cause

Emails are sent synchronously during HTTP request, blocking response and timing out on server.

## Solution: Async Email Queue with Celery

---

## Step 1: Install Resend (5 minutes)

**Why Resend?**
- Free tier: 100 emails/day
- No SMTP configuration needed
- Automatic DKIM signing
- Excellent deliverability
- Simple API

**Setup:**

1. Sign up: https://resend.com
2. Verify your domain (add DNS records)
3. Get API key: Settings → API Keys → Create
4. Copy API key

---

## Step 2: Update Backend (30 minutes)

### 2.1 Install Package

```bash
cd apps/api
pip install resend
pip freeze > requirements.txt
```

### 2.2 Update Config

Add to `apps/api/.env`:

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=noreply@yourdomain.com
```

Add to `apps/api/app/core/config.py`:

```python
# Email Configuration
RESEND_API_KEY: str = ""
EMAIL_FROM: str = "noreply@yourdomain.com"
```

### 2.3 Create Resend Email Service

Create `apps/api/app/services/resend_email.py`:

```python
"""
Resend Email Service
"""
import resend
from app.core.config import settings

resend.api_key = settings.RESEND_API_KEY

def send_email_sync(to: str, subject: str, html: str) -> bool:
    """Send email via Resend"""
    try:
        resend.Emails.send({
            "from": f"Etsy Auto <{settings.EMAIL_FROM}>",
            "to": [to],
            "subject": subject,
            "html": html
        })
        return True
    except Exception as e:
        print(f"Email error: {e}")
        return False
```

### 2.4 Update Email Tasks

Update `apps/api/app/worker/tasks/email_tasks.py`:

Replace the `_send_email` function with:

```python
from app.services.resend_email import send_email_sync

def _send_email(to_email: str, subject: str, html_content: str, text_content=None) -> bool:
    """Send email via Resend"""
    return send_email_sync(to_email, subject, html_content)
```

### 2.5 Update Registration to Use Celery

In `apps/api/app/api/endpoints/auth.py`, replace:

```python
# Old synchronous code:
send_verification_email(user.email, user.name, verification_token)
```

With:

```python
# New async code:
from app.worker.tasks.email_tasks import send_verification_email_task

send_verification_email_task.delay(
    email=user.email,
    name=user.name,
    verification_token=verification_token,
    user_id=user.id
)
```

---

## Step 3: Verify Domain DNS (10 minutes)

In Resend dashboard, you'll see DNS records to add. Add them in Hostinger:

**Example records (yours will be different):**

```
Type: TXT
Name: resend._domainkey
Value: [long DKIM key provided by Resend]

Type: TXT
Name: @
Value: v=spf1 include:_spf.resend.com ~all

Type: TXT
Name: _dmarc
Value: v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com
```

**Wait 5-30 minutes for DNS propagation**

---

## Step 4: Test (5 minutes)

### 4.1 Test Email Sending

Create `apps/api/test_email.py`:

```python
import resend

resend.api_key = "re_xxxxxxxxxxxxx"  # Your key

try:
    resend.Emails.send({
        "from": "noreply@yourdomain.com",
        "to": ["your-email@gmail.com"],
        "subject": "Test Email",
        "html": "<h1>It works!</h1>"
    })
    print("✅ Email sent successfully!")
except Exception as e:
    print(f"❌ Error: {e}")
```

Run:
```bash
python test_email.py
```

### 4.2 Test Registration

1. Clear users from database
2. Register new account
3. Check email arrives within 10 seconds
4. Click verification link
5. Login successfully

---

## Step 5: Deploy to Server (15 minutes)

### 5.1 Update Environment Variables

SSH into your server:

```bash
ssh user@your-server-ip
cd /path/to/etsy-automation-platform
```

Update `.env`:

```bash
nano .env
```

Add:
```bash
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=noreply@yourdomain.com
```

### 5.2 Rebuild Containers

```bash
docker compose down
docker compose build
docker compose up -d
```

### 5.3 Check Logs

```bash
# API logs
docker compose logs api -f

# Worker logs
docker compose logs worker -f
```

---

## Step 6: Monitor (5 minutes)

### Check Email Queue

```bash
# See active email tasks
docker compose exec worker celery -A tasks inspect active

# See scheduled tasks
docker compose exec worker celery -A tasks inspect scheduled
```

### Check Resend Dashboard

- Go to Resend dashboard
- View → Emails
- See delivery status in real-time

---

## Troubleshooting

### Emails still not sending?

**1. Check Resend API Key:**
```bash
docker compose exec api python -c "from app.core.config import settings; print(settings.RESEND_API_KEY)"
```

**2. Check Worker is Running:**
```bash
docker compose ps
```

Should show `worker` container as healthy.

**3. Check Celery Connection:**
```bash
docker compose logs worker | grep "Connected to redis"
```

Should see: `celery@worker ready`

**4. Manually Test Email:**
```bash
docker compose exec worker python -c "
from app.services.resend_email import send_email_sync
result = send_email_sync('your-email@gmail.com', 'Test', '<h1>Test</h1>')
print('Success!' if result else 'Failed!')
"
```

### DNS Not Verified?

1. Check DNS propagation: https://dnschecker.org
2. Enter: `resend._domainkey.yourdomain.com`
3. Should see TXT record
4. If not, wait more (can take up to 48 hours)
5. In meantime, use Resend's test domain

---

## Alternative: Temporary Fix (If DNS Takes Time)

While waiting for DNS, use Resend's verification bypass:

```python
# In registration endpoint, auto-verify email:
user.email_verified = True  # Temporary - remove after DNS verified
```

**Remember to remove this after DNS is verified!**

---

## Success Checklist

- [ ] Resend account created
- [ ] API key added to `.env`
- [ ] `resend` package installed
- [ ] Email service updated to use Resend
- [ ] Registration uses Celery task
- [ ] DNS records added in Hostinger
- [ ] Test email received successfully
- [ ] Registration email arrives within 10 seconds
- [ ] Server restarted with new config
- [ ] Worker logs show email tasks running

---

## Next Steps

After email is working:

1. **Add Email Monitoring**: Track bounces and failures
2. **Implement Retry Logic**: Auto-retry failed emails
3. **Add Email Templates**: Professional HTML templates
4. **Set Up Alerts**: Get notified of email failures

---

## Need Help?

**Common Issues:**

| Issue | Solution |
|-------|----------|
| "Invalid API key" | Check key format, should start with `re_` |
| "Domain not verified" | Wait for DNS propagation, use test domain temporarily |
| "Worker not picking up tasks" | Restart worker: `docker compose restart worker` |
| "Emails in spam" | Check SPF/DKIM/DMARC in mail-tester.com |

**Still stuck?** Check Resend docs: https://resend.com/docs

---

## Estimated Time

- **Setup**: 30 minutes
- **Testing**: 10 minutes
- **Deployment**: 15 minutes
- **Total**: ~1 hour

---

**You're fixing the most critical issue first. After this, users will receive emails instantly and reliably. The other features (Google OAuth, password strength) can wait - email delivery is blocking your users from using the platform!**
