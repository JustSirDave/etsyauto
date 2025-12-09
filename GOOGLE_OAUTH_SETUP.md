# Google OAuth Setup Guide

## 🔑 Setting Up Google OAuth

Follow these steps to enable Google Sign-In for your Etsy Automation Platform:

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name your project (e.g., "Etsy Automation Platform")
4. Click "Create"

### 2. Enable Google+ API

1. In the Google Cloud Console, go to "APIs & Services" → "Library"
2. Search for "Google+ API"
3. Click on it and press "Enable"

### 3. Configure OAuth Consent Screen

1. Go to "APIs & Services" → "OAuth consent screen"
2. Choose "External" (unless you have a Google Workspace)
3. Click "Create"
4. Fill in the required fields:
   - **App name**: Etsy Automation Platform
   - **User support email**: your-email@example.com
   - **Developer contact information**: your-email@example.com
5. Click "Save and Continue"
6. On the "Scopes" page, click "Add or Remove Scopes"
7. Add these scopes:
   - `openid`
   - `email`
   - `profile`
8. Click "Save and Continue"
9. Add test users (your email and any testers)
10. Click "Save and Continue"

### 4. Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Choose "Web application"
4. Name it "Etsy Platform Web Client"
5. Add **Authorized redirect URIs**:
   - Development: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://yourdomain.com/api/auth/callback/google`
6. Click "Create"
7. **Save your Client ID and Client Secret**

### 5. Add to Environment Variables

Add these to your `.env` file:

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret-here
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback/google
```

For production, update `GOOGLE_REDIRECT_URI` to your production URL.

### 6. Run Database Migration

```bash
# Apply the OAuth fields migration
docker exec etsy-api alembic upgrade head
```

### 7. Restart Containers

```bash
docker compose restart
```

## ✅ Testing

1. Go to the invitation acceptance page
2. Click "Continue with Google"
3. Sign in with your Google account
4. You should be redirected back and automatically logged in

## 🔐 Security Notes

- **Never commit** your `.env` file to Git
- Keep your Client Secret secure
- Use different OAuth credentials for development and production
- Regularly rotate your secrets
- Enable 2FA for your Google Cloud account

## 📝 Features

With Google OAuth enabled, users can:
- ✅ Accept invitations with their Google account (passwordless)
- ✅ Sign up without creating a password
- ✅ Log in instantly with Google
- ✅ Automatic email verification (Google emails are pre-verified)
- ✅ Profile picture automatically imported from Google

## 🐛 Troubleshooting

### "redirect_uri_mismatch" error
- Make sure the redirect URI in Google Console exactly matches the one in your `.env`
- Check for trailing slashes
- Verify the protocol (http vs https)

### "access_denied" error
- User canceled the OAuth flow
- User not added as test user in OAuth consent screen

### "invalid_client" error
- Check your Client ID and Client Secret
- Make sure they're correctly set in `.env`
- Restart the API container after changing env vars

## 🎯 Next Steps

Consider implementing:
- Microsoft OAuth
- GitHub OAuth
- Apple Sign In
- More OAuth providers as needed

