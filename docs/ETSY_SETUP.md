# Etsy API Setup Guide

This guide will walk you through setting up Etsy API credentials for the ETSY Automation Platform.

## Overview

The platform uses **Etsy OAuth 2.0** with **PKCE** (Proof Key for Code Exchange) for secure authentication. This allows users to connect their Etsy shops and authorize the platform to manage listings, products, and orders on their behalf.

## Prerequisites

- An active Etsy seller account
- At least one Etsy shop
- Admin access to your Etsy account

## Step 1: Create an Etsy Developer Account

1. Go to [Etsy Developers Portal](https://www.etsy.com/developers)
2. Sign in with your Etsy seller account
3. Click **"Register as a Developer"** if you haven't already
4. Accept the Etsy API Terms of Service

## Step 2: Create a New App

1. Navigate to [Your Apps](https://www.etsy.com/developers/your-apps)
2. Click **"Create a New App"**
3. Fill in the application details:

   **App Name**: `ETSY Automation Platform` (or your preferred name)

   **App Description**:
   ```
   Automated listing management platform for Etsy sellers.
   Helps create, optimize, and publish product listings with AI-generated content.
   ```

   **What does this app do?**:
   - ✅ Read shop information
   - ✅ Read and write listings
   - ✅ Read transactions/orders
   - ✅ Read user profile

   **Tell us about your app**:
   ```
   This application automates the process of creating and managing Etsy product listings.
   It uses AI to generate optimized titles, descriptions, and tags, then publishes them
   to connected Etsy shops via the Etsy API.
   ```

4. Click **"Read Full API Terms of Service"** and agree
5. Click **"Create App"**

## Step 3: Configure OAuth Settings

After creating your app, you'll be taken to the app details page.

### Redirect URIs

Add the following redirect URI based on your environment:

**Development (localhost)**:
```
http://localhost:3000/settings
```

**Production** (when deploying):
```
https://etsyauto.bigbotdrivers.com/settings
```

**Important**:
- You can add multiple redirect URIs for different environments
- Make sure to match the exact URL including protocol (`http://` vs `https://`)
- No trailing slash

### OAuth Scopes

The platform requests the following scopes (these are configured in the code):

- `listings_r` - Read listings
- `listings_w` - Write/create listings
- `listings_d` - Delete listings
- `transactions_r` - Read orders/transactions
- `shops_r` - Read shop information
- `profile_r` - Read user profile

These scopes are already configured in [apps/api/app/services/etsy_oauth.py](../apps/api/app/services/etsy_oauth.py#L24-L31).

## Step 4: Get Your API Credentials

1. On your app details page, you'll see:
   - **Keystring** (this is your `ETSY_CLIENT_ID`)
   - **Shared Secret** (this is your `ETSY_CLIENT_SECRET`)

2. Click **"Show"** next to Shared Secret to reveal it
3. Copy both values - you'll need them for the next step

**⚠️ Security Warning**:
- Never commit these credentials to git
- Store them only in `.env` file (which is gitignored)
- Don't share them publicly

## Step 5: Update Your `.env` File

1. Open the `.env` file in the project root
2. Find the Etsy API section:

```env
# Etsy API
# See docs/ETSY_SETUP.md for step-by-step guide to get these credentials
# Get from: https://www.etsy.com/developers/your-apps
ETSY_CLIENT_ID=YOUR_ETSY_CLIENT_ID_HERE
ETSY_CLIENT_SECRET=YOUR_ETSY_CLIENT_SECRET_HERE
ETSY_REDIRECT_URI=http://localhost:3000/settings
```

3. Replace the placeholder values:

```env
ETSY_CLIENT_ID=abc123xyz456your_keystring_here
ETSY_CLIENT_SECRET=your_shared_secret_here
ETSY_REDIRECT_URI=http://localhost:3000/settings
```

4. Save the file

## Step 6: Restart the API Container

The API container needs to be restarted to load the new environment variables:

```bash
docker-compose restart api
```

Or rebuild if you made other changes:

```bash
docker-compose up -d --build api
```

## Step 7: Test the Connection

1. Start your application:
   ```bash
   docker-compose up -d
   ```

2. Open the web app: [http://localhost:3000](http://localhost:3000)

3. Log in to your account

4. Navigate to **Settings** page

5. Look for the **"Connected Shops"** section

6. Click **"Connect Etsy Shop"**

7. You should be redirected to Etsy's authorization page

8. Grant permissions to the app

9. You'll be redirected back to your Settings page

10. Your shop should now appear in the "Connected Shops" list

## Troubleshooting

### Error: "Invalid redirect_uri"

**Problem**: The redirect URI in your Etsy app settings doesn't match the one in your `.env` file.

**Solution**:
1. Check the `ETSY_REDIRECT_URI` in your `.env` file
2. Make sure it matches exactly (including http/https and trailing slash) with what's configured in your Etsy app settings
3. Restart the API container after making changes

### Error: "Invalid client_id" or "Invalid client_secret"

**Problem**: The API credentials are incorrect or not loaded.

**Solution**:
1. Verify you copied the Keystring and Shared Secret correctly from Etsy
2. Check for extra spaces or line breaks when pasting
3. Ensure the `.env` file is in the project root directory
4. Restart the API container: `docker-compose restart api`
5. Check API logs: `docker-compose logs api`

### Error: "Invalid OAuth state"

**Problem**: The OAuth state token expired (10 minute timeout) or Redis is not running.

**Solution**:
1. Check if Redis is running: `docker-compose ps redis`
2. Restart Redis if needed: `docker-compose restart redis`
3. Try the connection flow again (it times out after 10 minutes of inactivity)

### Error: "No shops found for this user"

**Problem**: Your Etsy account doesn't have an active shop.

**Solution**:
1. Make sure you have at least one Etsy shop
2. Verify the shop is active (not in vacation mode or closed)
3. Try logging in to [Etsy.com](https://www.etsy.com) to confirm your shop exists

### Connection works but listings won't publish

**Problem**: App doesn't have the correct OAuth scopes.

**Solution**:
1. Disconnect your shop from Settings page
2. Reconnect and carefully review the permission screen
3. Make sure you grant all requested permissions
4. If the permission screen doesn't show all scopes, you may need to:
   - Revoke the app access from [Etsy Account → Apps](https://www.etsy.com/your/account/apps)
   - Try connecting again

## Rate Limits

Etsy API has rate limits to prevent abuse:

- **Default**: 10,000 requests per day per app
- **Read operations**: Generally higher limits
- **Write operations**: More strictly limited

The platform implements automatic rate limiting:

```env
ETSY_RATE_LIMIT_CAPACITY=100          # Burst capacity
ETSY_RATE_LIMIT_REFILL_PER_SEC=0.5   # Tokens refilled per second
```

This is configured in [.env](../.env#L34-L35) and uses a **token bucket algorithm** to smooth out requests.

## Token Refresh

OAuth tokens expire after a certain period (typically 3600 seconds = 1 hour for Etsy).

The platform automatically refreshes expiring tokens:

- **Celery Beat** runs every hour and checks for tokens expiring in the next 24 hours
- Tokens are automatically refreshed using the refresh token
- If refresh fails, shop status is updated to `token_refresh_failed`
- You'll be notified to reconnect the shop

This is handled in [apps/api/app/worker/tasks/token_tasks.py](../apps/api/app/worker/tasks/token_tasks.py).

## Security Best Practices

### Token Encryption

All OAuth tokens are encrypted before being stored in the database using **AES-256-GCM**:

- Access tokens are encrypted
- Refresh tokens are encrypted
- Encryption key is stored in environment variable `ENCRYPTION_KEY`

**Generate a new encryption key**:
```bash
openssl rand -base64 32
```

Add to `.env`:
```env
ENCRYPTION_KEY=your_generated_key_here
```

**⚠️ Important**:
- Use a strong random key in production
- If you change the encryption key, all existing tokens become unusable
- Back up your encryption key securely

### HTTPS in Production

When deploying to production:

1. **Always use HTTPS** for redirect URIs
2. Update `.env`:
   ```env
   ETSY_REDIRECT_URI=https://etsyauto.bigbotdrivers.com/settings
   ```
3. Update your Etsy app settings to include the HTTPS redirect URI
4. Never use HTTP in production (OAuth tokens transmitted over HTTP are insecure)

### Environment Variables

Never commit sensitive data:

- ✅ `.env` is in `.gitignore`
- ✅ Use environment-specific `.env` files for dev/staging/production
- ✅ Rotate credentials periodically
- ❌ Never hardcode credentials in source code
- ❌ Never commit `.env` to version control
- ❌ Never share credentials in chat, email, or screenshots

## Production Deployment Checklist

Before going live:

- [ ] Create production Etsy app (separate from development)
- [ ] Update redirect URI to production domain with HTTPS
- [ ] Set production `ETSY_CLIENT_ID` and `ETSY_CLIENT_SECRET`
- [ ] Generate strong `ENCRYPTION_KEY` (different from development)
- [ ] Enable HTTPS/SSL on your domain
- [ ] Test OAuth flow on production
- [ ] Set up monitoring for token refresh failures
- [ ] Configure rate limiting for your expected traffic
- [ ] Review and adjust Celery beat schedule if needed
- [ ] Set up alerts for API errors
- [ ] Document credential rotation procedure for your team

## API Documentation

Official Etsy API documentation:

- [Etsy API v3 Overview](https://developers.etsy.com/documentation)
- [OAuth 2.0 Guide](https://developers.etsy.com/documentation/essentials/authentication)
- [Listings API](https://developers.etsy.com/documentation/reference#tag/ShopListing)
- [Shops API](https://developers.etsy.com/documentation/reference#tag/Shop)
- [Transactions API](https://developers.etsy.com/documentation/reference#tag/Shop-Receipt-Transactions)

## Support

If you encounter issues:

1. Check the [Troubleshooting](#troubleshooting) section above
2. Review API logs: `docker-compose logs api`
3. Check worker logs: `docker-compose logs worker`
4. Verify Redis is running: `docker-compose ps`
5. Test database connection: `docker-compose exec db psql -U postgres -d etsy_platform`

For Etsy API specific issues:
- [Etsy Developer Forums](https://community.etsy.com/t5/Etsy-Developer-API/bd-p/developer)
- [Etsy API Status](https://status.etsy.com/)

## Summary

You should now have:

✅ Etsy Developer Account
✅ Etsy App created with OAuth configured
✅ `ETSY_CLIENT_ID` and `ETSY_CLIENT_SECRET` in `.env`
✅ Redirect URI configured correctly
✅ Encryption key generated and configured
✅ API container restarted with new credentials
✅ Successfully connected an Etsy shop

Next step: Start importing products and creating automated listings! 🚀
