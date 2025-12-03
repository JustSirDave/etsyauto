# Authentication & Email System Upgrade Guide

**Production-Grade Implementation Plan**

---

## Table of Contents
1. [Google OAuth Passwordless Login](#1-google-oauth-passwordless-login)
2. [Email Delivery System Fix](#2-email-delivery-system-fix)
3. [Domain Email Setup (Hostinger + BlueVPS)](#3-domain-email-setup)
4. [Stronger Password Requirements](#4-stronger-password-requirements)
5. [Implementation Roadmap](#5-implementation-roadmap)

---

## 1. Google OAuth Passwordless Login

### Architecture Overview

**Design Pattern: Unified User Identity with Multiple Auth Providers**
- Single `users` table with nullable `password_hash`
- New `oauth_providers` table to track multiple OAuth connections
- Support both password and OAuth authentication methods
- Users can link multiple auth methods to one account

### Step 1: Google Cloud Console Setup

#### 1.1 Create OAuth 2.0 Credentials

```
1. Go to: https://console.cloud.google.com/
2. Create new project or select existing: "Etsy Automation Platform"
3. Enable Google+ API:
   - APIs & Services → Enable APIs and Services
   - Search "Google+ API" → Enable

4. Configure OAuth Consent Screen:
   - APIs & Services → OAuth consent screen
   - User Type: External (for public access)
   - App Information:
     * App name: Etsy Automation Platform
     * User support email: your-support@domain.com
     * Developer contact: your-email@domain.com
   - Scopes: Add these scopes:
     * .../auth/userinfo.email
     * .../auth/userinfo.profile
     * openid
   - Test users: Add your email for testing
   - Submit for verification (for production)

5. Create OAuth 2.0 Client ID:
   - APIs & Services → Credentials → Create Credentials
   - Application type: Web application
   - Name: Etsy Platform Web Client
   - Authorized JavaScript origins:
     * http://localhost:3000 (development)
     * https://yourdomain.com (production)
   - Authorized redirect URIs:
     * http://localhost:3000/api/auth/callback/google (dev)
     * https://yourdomain.com/api/auth/callback/google (prod)
   - Save Client ID and Client Secret
```

### Step 2: Database Schema Changes

**New Migration: `add_oauth_providers_table.py`**

```python
"""Add OAuth providers support

Revision ID: oauth_providers_001
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

def upgrade():
    # Create oauth_providers table
    op.create_table(
        'oauth_providers',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('provider', sa.String(50), nullable=False),  # 'google', 'github', etc.
        sa.Column('provider_user_id', sa.String(255), nullable=False),  # OAuth provider's user ID
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('name', sa.String(255), nullable=True),
        sa.Column('picture', sa.String(500), nullable=True),
        sa.Column('access_token', sa.Text(), nullable=True),  # Encrypted
        sa.Column('refresh_token', sa.Text(), nullable=True),  # Encrypted
        sa.Column('token_expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('provider', 'provider_user_id', name='unique_provider_user')
    )

    # Make password_hash nullable (for OAuth-only users)
    op.alter_column('users', 'password_hash', nullable=True)

    # Add indexes
    op.create_index('ix_oauth_providers_user_id', 'oauth_providers', ['user_id'])
    op.create_index('ix_oauth_providers_provider', 'oauth_providers', ['provider'])

def downgrade():
    op.drop_index('ix_oauth_providers_provider')
    op.drop_index('ix_oauth_providers_user_id')
    op.drop_table('oauth_providers')
    op.alter_column('users', 'password_hash', nullable=False)
```

### Step 3: Backend Implementation

#### 3.1 Install Dependencies

Add to `requirements.txt`:
```
google-auth==2.28.0
google-auth-oauthlib==1.2.0
google-auth-httplib2==0.2.0
```

#### 3.2 Create OAuth Service (`app/services/google_oauth.py`)

```python
"""
Google OAuth Service
Handles Google Sign-In authentication
"""
from google.oauth2 import id_token
from google.auth.transport import requests
from typing import Dict, Optional
import httpx
from app.core.config import settings

class GoogleOAuthService:
    """Service for Google OAuth authentication"""

    def __init__(self):
        self.client_id = settings.GOOGLE_CLIENT_ID
        self.client_secret = settings.GOOGLE_CLIENT_SECRET
        self.redirect_uri = settings.GOOGLE_REDIRECT_URI

    async def verify_token(self, token: str) -> Optional[Dict]:
        """
        Verify Google ID token

        Args:
            token: Google ID token from frontend

        Returns:
            User info dict if valid, None otherwise
        """
        try:
            # Verify token with Google
            idinfo = id_token.verify_oauth2_token(
                token,
                requests.Request(),
                self.client_id
            )

            # Verify issuer
            if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
                raise ValueError('Wrong issuer')

            # Extract user info
            return {
                'provider_user_id': idinfo['sub'],
                'email': idinfo['email'],
                'email_verified': idinfo.get('email_verified', False),
                'name': idinfo.get('name'),
                'picture': idinfo.get('picture'),
                'given_name': idinfo.get('given_name'),
                'family_name': idinfo.get('family_name')
            }

        except ValueError as e:
            print(f"Token verification failed: {e}")
            return None

    async def exchange_code_for_tokens(self, code: str) -> Optional[Dict]:
        """
        Exchange authorization code for access/refresh tokens

        Args:
            code: Authorization code from Google

        Returns:
            Token response with access_token, refresh_token, etc.
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                'https://oauth2.googleapis.com/token',
                data={
                    'code': code,
                    'client_id': self.client_id,
                    'client_secret': self.client_secret,
                    'redirect_uri': self.redirect_uri,
                    'grant_type': 'authorization_code'
                }
            )

            if response.status_code == 200:
                return response.json()
            return None

    async def refresh_access_token(self, refresh_token: str) -> Optional[Dict]:
        """Refresh access token using refresh token"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                'https://oauth2.googleapis.com/token',
                data={
                    'refresh_token': refresh_token,
                    'client_id': self.client_id,
                    'client_secret': self.client_secret,
                    'grant_type': 'refresh_token'
                }
            )

            if response.status_code == 200:
                return response.json()
            return None

# Global instance
google_oauth = GoogleOAuthService()
```

#### 3.3 Create OAuth Model (`app/models/oauth.py`)

```python
"""OAuth Provider Models"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base
from datetime import datetime, timezone

class OAuthProvider(Base):
    """OAuth provider connections (Google, GitHub, etc.)"""
    __tablename__ = "oauth_providers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    provider = Column(String(50), nullable=False)  # 'google', 'github'
    provider_user_id = Column(String(255), nullable=False)  # OAuth provider's user ID
    email = Column(String(255), nullable=False)
    name = Column(String(255))
    picture = Column(String(500))

    # Encrypted tokens
    access_token = Column(Text)
    refresh_token = Column(Text)
    token_expires_at = Column(DateTime(timezone=True))

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User", back_populates="oauth_providers")

    __table_args__ = (
        UniqueConstraint('provider', 'provider_user_id', name='unique_provider_user'),
    )
```

Update `app/models/tenancy.py`:
```python
# Add to User model
oauth_providers = relationship("OAuthProvider", back_populates="user", cascade="all, delete-orphan")
```

#### 3.4 Google OAuth Endpoints (`app/api/endpoints/google_auth.py`)

```python
"""
Google OAuth Authentication Endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from app.core.database import get_db
from app.models.tenancy import User, Tenant, Membership
from app.models.oauth import OAuthProvider
from app.services.google_oauth import google_oauth
from app.services.encryption import token_encryptor
from app.core.security import create_access_token
from app.core.config import settings

router = APIRouter()

class GoogleLoginRequest(BaseModel):
    """Request body for Google OAuth login"""
    token: str  # Google ID token from frontend

class GoogleLoginResponse(BaseModel):
    """Response for successful Google login"""
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict
    tenant: dict

@router.post("/google/login", response_model=GoogleLoginResponse, tags=["Auth"])
async def google_login(request: GoogleLoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate with Google OAuth

    Flow:
    1. Verify Google ID token
    2. Check if user exists by OAuth provider_user_id
    3. If exists: login
    4. If not exists: check if email exists
       - If email exists: link OAuth to existing account
       - If email doesn't exist: create new user + tenant
    """
    # Verify Google token
    google_user = await google_oauth.verify_token(request.token)
    if not google_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google token"
        )

    # Check if OAuth connection exists
    oauth_provider = db.query(OAuthProvider).filter(
        OAuthProvider.provider == "google",
        OAuthProvider.provider_user_id == google_user['provider_user_id']
    ).first()

    if oauth_provider:
        # User exists with this Google account - login
        user = oauth_provider.user

        # Update OAuth info
        oauth_provider.email = google_user['email']
        oauth_provider.name = google_user.get('name')
        oauth_provider.picture = google_user.get('picture')
        oauth_provider.updated_at = datetime.now(timezone.utc)

        # Update user's last login
        user.last_login_at = datetime.now(timezone.utc)
        db.commit()

    else:
        # Check if user exists with this email
        user = db.query(User).filter(User.email == google_user['email']).first()

        if user:
            # Email exists - link Google to existing account
            oauth_provider = OAuthProvider(
                user_id=user.id,
                provider="google",
                provider_user_id=google_user['provider_user_id'],
                email=google_user['email'],
                name=google_user.get('name'),
                picture=google_user.get('picture')
            )
            db.add(oauth_provider)

            # Auto-verify email if Google confirms it
            if google_user.get('email_verified'):
                user.email_verified = True

            user.last_login_at = datetime.now(timezone.utc)
            db.commit()

        else:
            # New user - create account with Google
            # Create tenant
            tenant_name = google_user.get('name', 'My Organization')
            tenant = Tenant(name=tenant_name)
            db.add(tenant)
            db.flush()

            # Create user (no password for OAuth-only users)
            user = User(
                email=google_user['email'],
                name=google_user.get('name'),
                password_hash=None,  # OAuth-only user
                email_verified=google_user.get('email_verified', False),
                profile_picture_url=google_user.get('picture'),
                created_at=datetime.now(timezone.utc),
                last_login_at=datetime.now(timezone.utc)
            )
            db.add(user)
            db.flush()

            # Create membership
            membership = Membership(
                user_id=user.id,
                tenant_id=tenant.id,
                role="owner",
                invitation_status="accepted",
                accepted_at=datetime.now(timezone.utc)
            )
            db.add(membership)

            # Create OAuth provider link
            oauth_provider = OAuthProvider(
                user_id=user.id,
                provider="google",
                provider_user_id=google_user['provider_user_id'],
                email=google_user['email'],
                name=google_user.get('name'),
                picture=google_user.get('picture')
            )
            db.add(oauth_provider)

            db.commit()
            db.refresh(user)
            db.refresh(tenant)

    # Get user's tenant and role
    membership = db.query(Membership).filter(
        Membership.user_id == user.id
    ).first()

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User has no tenant membership"
        )

    tenant = db.query(Tenant).filter(Tenant.id == membership.tenant_id).first()

    # Generate JWT
    token_data = {
        "sub": str(user.id),
        "email": user.email,
        "tenant_id": str(tenant.id),
        "role": membership.role
    }

    access_token = create_access_token(token_data)

    return GoogleLoginResponse(
        access_token=access_token,
        expires_in=settings.JWT_TTL_SECONDS,
        user={
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "email_verified": user.email_verified,
            "profile_picture_url": user.profile_picture_url
        },
        tenant={
            "id": tenant.id,
            "name": tenant.name,
            "role": membership.role
        }
    )

@router.post("/google/unlink", tags=["Auth"])
async def unlink_google(current_user = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Unlink Google account from user profile
    Only allowed if user has a password set
    """
    user = db.query(User).filter(User.id == int(current_user["sub"])).first()

    # Check if user has password
    if not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot unlink Google account. Please set a password first to maintain account access."
        )

    # Delete OAuth provider
    oauth = db.query(OAuthProvider).filter(
        OAuthProvider.user_id == user.id,
        OAuthProvider.provider == "google"
    ).first()

    if not oauth:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Google account is not linked"
        )

    db.delete(oauth)
    db.commit()

    return {"message": "Google account unlinked successfully"}
```

#### 3.5 Update Config (`app/core/config.py`)

```python
# Add to Settings class
# Google OAuth
GOOGLE_CLIENT_ID: str = ""
GOOGLE_CLIENT_SECRET: str = ""
GOOGLE_REDIRECT_URI: str = "http://localhost:3000/api/auth/callback/google"
```

#### 3.6 Update Main Router (`app/api/main.py`)

```python
from app.api.endpoints import google_auth

# Add to router includes
app.include_router(google_auth.router, prefix="/api/auth", tags=["Auth"])
```

### Step 4: Frontend Implementation (Next.js)

#### 4.1 Install Google Sign-In Library

```bash
npm install @react-oauth/google
```

#### 4.2 Add Google Client ID to Environment (`apps/web/.env.local`)

```bash
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

#### 4.3 Wrap App with Google OAuth Provider (`apps/web/app/layout.tsx`)

```typescript
import { GoogleOAuthProvider } from '@react-oauth/google';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}>
          {children}
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}
```

#### 4.4 Create Google Sign-In Component (`apps/web/components/GoogleSignInButton.tsx`)

```typescript
'use client';

import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface GoogleSignInButtonProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export default function GoogleSignInButton({ onSuccess, onError }: GoogleSignInButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      onError?.('No credential received from Google');
      return;
    }

    try {
      setLoading(true);

      const response = await fetch('http://localhost:8080/api/auth/google/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: credentialResponse.credential,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Google sign-in failed');
      }

      const data = await response.json();

      // Store JWT token
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('tenant', JSON.stringify(data.tenant));

      onSuccess?.();
      router.push('/dashboard');
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      onError?.(error.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    onError?.('Google sign-in was cancelled or failed');
  };

  return (
    <div className="w-full">
      <GoogleLogin
        onSuccess={handleGoogleSuccess}
        onError={handleGoogleError}
        useOneTap
        theme="filled_blue"
        size="large"
        text="signin_with"
        width="100%"
      />
    </div>
  );
}
```

#### 4.5 Update Login Page (`apps/web/app/login/page.tsx`)

```typescript
'use client';

import { useState } from 'react';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import { LogIn } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:8080/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Login failed');
      }

      const data = await response.json();
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));

      window.location.href = '/dashboard';
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-lg p-8 w-full max-w-md border border-slate-700">
        <div className="text-center mb-8">
          <div className="bg-gradient-to-r from-blue-600 to-teal-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <LogIn className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Welcome Back</h1>
          <p className="text-slate-400 mt-2">Sign in to your Etsy Automation Platform</p>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-400 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* Google Sign-In */}
        <div className="mb-6">
          <GoogleSignInButton
            onSuccess={() => {
              window.location.href = '/dashboard';
            }}
            onError={(error) => setError(error)}
          />
        </div>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-700"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-slate-800 text-slate-400">Or continue with email</span>
          </div>
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handlePasswordLogin} className="space-y-4">
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="••••••••"
              required
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center">
              <input type="checkbox" className="rounded border-slate-600 bg-slate-700" />
              <span className="ml-2 text-sm text-slate-400">Remember me</span>
            </label>
            <a href="/forgot-password" className="text-sm text-teal-400 hover:text-teal-300">
              Forgot password?
            </a>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-slate-400 text-sm mt-6">
          Don't have an account?{' '}
          <a href="/register" className="text-teal-400 hover:text-teal-300 font-medium">
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}
```

---

## 2. Email Delivery System Fix

### Current Issues Analysis

**Root Causes Identified:**

1. **Synchronous Email Sending**: Emails are sent during the HTTP request, blocking response
2. **No Retry Logic**: Failed sends are lost forever
3. **No Email Queue**: No way to track or retry failed emails
4. **Silent Failures**: The `return True` fallback masks real errors
5. **No Monitoring**: No visibility into email delivery status

### Production-Grade Solution: Celery Task Queue

#### Architecture

```
Registration Request
    ↓
Create User (immediate)
    ↓
Queue Email Task (async, <1ms)
    ↓
Return 201 Response (fast!)
    ↓
Background: Celery Worker picks up task
    ↓
Send Email (with retries)
    ↓
Update email_sent status
```

### Implementation

#### 2.1 Create Email Tasks (`apps/worker/tasks/email_tasks.py`)

```python
"""
Email Tasks - Async email sending with retries
"""
from celery import Task
from datetime import datetime, timezone
from typing import Optional
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.core.config import settings
from tasks import celery_app

class EmailTask(Task):
    """Base task with retry logic"""
    autoretry_for = (smtplib.SMTPException, ConnectionError, TimeoutError)
    retry_kwargs = {'max_retries': 5}
    retry_backoff = True  # Exponential backoff
    retry_backoff_max = 600  # Max 10 minutes between retries
    retry_jitter = True  # Add randomness to prevent thundering herd

@celery_app.task(base=EmailTask, name="send_verification_email")
def send_verification_email_task(
    email: str,
    name: str,
    verification_token: str,
    user_id: int
) -> dict:
    """
    Send verification email asynchronously

    Returns:
        dict with status and details
    """
    try:
        verification_url = f"{settings.FRONTEND_URL}/verify-email?token={verification_token}"

        subject = "Verify Your Email Address"

        html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #e2e8f0; background-color: #0f172a; margin: 0; padding: 20px;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; overflow: hidden; border: 1px solid #334155;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #14b8a6 100%); padding: 40px 24px; text-align: center;">
            <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 700;">Welcome to Etsy Auto!</h1>
        </div>

        <!-- Content -->
        <div style="padding: 40px 24px;">
            <p style="margin: 0 0 20px; color: #e2e8f0; font-size: 18px;">
                Hi {name},
            </p>

            <p style="margin: 0 0 20px; color: #e2e8f0; font-size: 16px; line-height: 1.8;">
                Thank you for signing up! We're excited to have you on board. To get started, please verify your email address by clicking the button below.
            </p>

            <!-- CTA Button -->
            <div style="text-align: center; margin: 32px 0;">
                <a href="{verification_url}"
                   style="display: inline-block; padding: 16px 40px; background-color: #14b8a6; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(20, 184, 166, 0.3);">
                    Verify Email Address
                </a>
            </div>

            <p style="margin: 24px 0 0; color: #94a3b8; font-size: 14px; line-height: 1.6;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="{verification_url}" style="color: #14b8a6; word-break: break-all;">{verification_url}</a>
            </p>

            <p style="margin: 24px 0 0; color: #94a3b8; font-size: 14px;">
                This link will expire in {settings.VERIFICATION_TOKEN_EXPIRY_HOURS} hours.
            </p>

            <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #334155;">
                <p style="margin: 0; color: #64748b; font-size: 13px;">
                    If you didn't create an account, you can safely ignore this email.
                </p>
            </div>
        </div>

        <!-- Footer -->
        <div style="background-color: #0f172a; padding: 24px; text-align: center; border-top: 1px solid #334155;">
            <p style="margin: 0 0 8px; color: #64748b; font-size: 12px;">
                © {datetime.now().year} Etsy Automation Platform
            </p>
            <p style="margin: 0; color: #64748b; font-size: 12px;">
                Automate your Etsy shop with confidence
            </p>
        </div>
    </div>
</body>
</html>
        """

        text_content = f"""
Hi {name},

Thank you for signing up! Please verify your email address to get started.

Click the link below to verify:
{verification_url}

This link will expire in {settings.VERIFICATION_TOKEN_EXPIRY_HOURS} hours.

If you didn't create an account, you can safely ignore this email.

© {datetime.now().year} Etsy Automation Platform
        """

        # Send email
        success = _send_email(email, subject, html_content, text_content)

        if success:
            # Update database to mark email as sent
            from app.core.database import SessionLocal
            from app.models.tenancy import User

            db = SessionLocal()
            try:
                user = db.query(User).filter(User.id == user_id).first()
                if user:
                    # You can add an email_sent_at field or use audit logs
                    pass
                db.commit()
            finally:
                db.close()

        return {
            "status": "sent" if success else "failed",
            "email": email,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    except Exception as e:
        # This will trigger retry
        raise

def _send_email(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: Optional[str] = None
) -> bool:
    """
    Internal email sending function

    Raises:
        SMTPException: If email sending fails (for retry)
    """
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        raise Exception("SMTP not configured")

    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        msg['To'] = to_email

        if text_content:
            msg.attach(MIMEText(text_content, 'plain'))
        msg.attach(MIMEText(html_content, 'html'))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)

        return True

    except Exception as e:
        print(f"Email send error: {e}")
        raise  # Re-raise for retry

@celery_app.task(base=EmailTask, name="send_password_reset_email")
def send_password_reset_email_task(
    email: str,
    name: str,
    reset_token: str
) -> dict:
    """Send password reset email asynchronously"""
    # Similar implementation to verification email
    pass

@celery_app.task(base=EmailTask, name="send_team_invitation_email")
def send_team_invitation_email_task(
    to_email: str,
    to_name: str,
    inviter_name: str,
    organization_name: str,
    role: str,
    invitation_token: str
) -> dict:
    """Send team invitation email asynchronously"""
    # Similar implementation
    pass
```

#### 2.2 Update Registration to Use Queue (`app/api/endpoints/auth.py`)

```python
# At the top, import the task
from tasks.email_tasks import send_verification_email_task

# In the register endpoint, replace:
# send_verification_email(user.email, user.name, verification_token)

# With:
send_verification_email_task.delay(
    email=user.email,
    name=user.name,
    verification_token=verification_token,
    user_id=user.id
)
```

#### 2.3 Add Email Status Tracking (Optional but Recommended)

Create a new table to track email delivery:

```python
"""
Email Delivery Log
Track all emails sent by the system
"""
class EmailLog(Base):
    __tablename__ = "email_logs"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    email_type = Column(String(50))  # 'verification', 'reset', 'invitation'
    recipient = Column(String(255))
    subject = Column(String(500))
    status = Column(String(20))  # 'queued', 'sent', 'failed', 'bounced'
    celery_task_id = Column(String(255))
    error_message = Column(Text, nullable=True)
    sent_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
```

#### 2.4 Monitor Email Queue Health

Add Celery monitoring endpoint:

```python
@router.get("/admin/email-queue/stats", tags=["Admin"])
async def email_queue_stats():
    """Get email queue statistics"""
    from celery import current_app

    inspect = current_app.control.inspect()

    return {
        "active": inspect.active(),
        "scheduled": inspect.scheduled(),
        "reserved": inspect.reserved(),
        "stats": inspect.stats()
    }
```

---

## 3. Domain Email Setup (Hostinger + BlueVPS)

### Overview

**Recommended Approach: Transactional Email Service**

Instead of sending directly from your VPS, use a dedicated transactional email service:

**Why?**
- Better deliverability (established IP reputation)
- Automatic SPF/DKIM/DMARC configuration
- Built-in bounce/complaint handling
- Rate limiting and throttling
- Delivery tracking and analytics
- No IP warmup required

**Recommended Services:**
1. **Resend** (Recommended) - Developer-friendly, excellent docs, free tier
2. **SendGrid** - Reliable, 100 emails/day free
3. **Mailgun** - Pay-as-you-go, good for startups
4. **Amazon SES** - Cheapest, requires AWS setup

### Option A: Using Resend (Recommended)

#### Why Resend?
- Simple API
- Excellent deliverability
- Automatic DKIM signing
- 100 emails/day free (3,000/month)
- First-class TypeScript support
- Built for developers

#### Setup Steps

**1. Sign up at https://resend.com**

**2. Verify your domain:**
```
1. Go to Domains → Add Domain
2. Enter your domain: yourdomain.com
3. Add these DNS records in Hostinger:

Type: TXT
Name: @
Value: resend-verification=<your-code>

Type: MX
Name: @
Priority: 10
Value: feedback-smtp.us-east-1.amazonses.com

Type: TXT
Name: _dmarc
Value: v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com

(Resend provides exact records - copy them)
```

**3. Get API Key:**
```
Settings → API Keys → Create API Key
Save it securely
```

**4. Install Resend SDK:**

```bash
pip install resend
```

**5. Update Email Service (`app/services/email_service_resend.py`):**

```python
"""
Email Service using Resend
Production-grade transactional emails
"""
import resend
from typing import Optional
from app.core.config import settings

resend.api_key = settings.RESEND_API_KEY

async def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    from_name: str = "Etsy Automation Platform",
    from_email: str = "noreply@yourdomain.com"
) -> bool:
    """
    Send email via Resend

    Returns:
        True if successful, raises exception if failed
    """
    try:
        params = {
            "from": f"{from_name} <{from_email}>",
            "to": [to_email],
            "subject": subject,
            "html": html_content
        }

        response = resend.Emails.send(params)

        return True

    except Exception as e:
        print(f"Resend error: {e}")
        raise  # Let Celery retry
```

**6. Update Config:**

```python
# .env
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=Etsy Automation Platform
```

### Option B: Direct SMTP (Not Recommended for Production)

If you must use direct SMTP:

#### 1. Set up email on Hostinger

```
1. Hostinger → Email → Create Email Account
2. Email: noreply@yourdomain.com
3. Password: Strong password
4. Note SMTP settings:
   - Host: smtp.hostinger.com
   - Port: 587 (TLS) or 465 (SSL)
   - Username: noreply@yourdomain.com
   - Password: your-password
```

#### 2. Configure SPF, DKIM, DMARC

**SPF Record (TXT):**
```
Name: @
Value: v=spf1 include:_spf.hostinger.com ip4:YOUR_VPS_IP ~all
```

**DKIM Record:**
```
1. Hostinger → Email → DKIM
2. Generate DKIM key
3. Add provided TXT record to DNS
```

**DMARC Record (TXT):**
```
Name: _dmarc
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com; pct=100
```

#### 3. Configure Reverse DNS (PTR Record)

Contact BlueVPS support to set PTR record:
```
YOUR_VPS_IP → mail.yourdomain.com
```

#### 4. IP Warm-up

Start slow to build reputation:
- Week 1: 50 emails/day
- Week 2: 100 emails/day
- Week 3: 250 emails/day
- Week 4+: Normal volume

### Email Testing Tools

**Before going live, test:**

1. **Mail-Tester** (https://www.mail-tester.com)
   - Checks SPF, DKIM, DMARC
   - Spam score
   - Content analysis

2. **MXToolbox** (https://mxtoolbox.com/SuperTool.aspx)
   - Blacklist check
   - DNS validation

3. **SendForensics** (https://sendforensics.com)
   - Deliverability testing

---

## 4. Stronger Password Requirements

### Implementation

#### 4.1 Update Password Validator (`app/core/security.py`)

```python
"""
Password Security Utilities
"""
import re
from typing import List, Tuple

class PasswordValidator:
    """
    Production-grade password validation
    Based on NIST 800-63B and OWASP guidelines
    """

    MIN_LENGTH = 12
    MAX_LENGTH = 128

    # Common passwords to reject (expand this list)
    COMMON_PASSWORDS = {
        'password', 'password123', '123456', '12345678', 'qwerty',
        'abc123', 'monkey', '1234567', 'letmein', 'trustno1',
        'dragon', 'baseball', 'iloveyou', 'master', 'sunshine',
        'ashley', 'bailey', 'passw0rd', 'shadow', '123123',
        'admin', 'welcome', 'login', 'Password1', 'Password123'
    }

    @staticmethod
    def validate(password: str) -> Tuple[bool, List[str]]:
        """
        Validate password strength

        Returns:
            (is_valid, list_of_errors)
        """
        errors = []

        # Check length
        if len(password) < PasswordValidator.MIN_LENGTH:
            errors.append(f'Password must be at least {PasswordValidator.MIN_LENGTH} characters long')

        if len(password) > PasswordValidator.MAX_LENGTH:
            errors.append(f'Password must be less than {PasswordValidator.MAX_LENGTH} characters')

        # Check for uppercase
        if not re.search(r'[A-Z]', password):
            errors.append('Password must contain at least one uppercase letter')

        # Check for lowercase
        if not re.search(r'[a-z]', password):
            errors.append('Password must contain at least one lowercase letter')

        # Check for numbers (at least 2)
        numbers = re.findall(r'\d', password)
        if len(numbers) < 2:
            errors.append('Password must contain at least 2 numbers')

        # Check for special characters
        if not re.search(r'[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/~`]', password):
            errors.append('Password must contain at least one special character (!@#$%^&* etc.)')

        # Check for common passwords
        if password.lower() in PasswordValidator.COMMON_PASSWORDS:
            errors.append('This password is too common. Please choose a more unique password')

        # Check for sequential characters
        if PasswordValidator._has_sequential_chars(password):
            errors.append('Password should not contain sequential characters (abc, 123, etc.)')

        # Check for repeated characters
        if PasswordValidator._has_repeated_chars(password):
            errors.append('Password should not contain repeated characters (aaa, 111, etc.)')

        return (len(errors) == 0, errors)

    @staticmethod
    def _has_sequential_chars(password: str, length: int = 3) -> bool:
        """Check for sequential characters"""
        password_lower = password.lower()

        # Check for sequential letters
        for i in range(len(password_lower) - length + 1):
            substring = password_lower[i:i+length]
            if substring.isalpha():
                if all(ord(substring[j+1]) == ord(substring[j]) + 1 for j in range(len(substring)-1)):
                    return True

        # Check for sequential numbers
        for i in range(len(password) - length + 1):
            substring = password[i:i+length]
            if substring.isdigit():
                if all(int(substring[j+1]) == int(substring[j]) + 1 for j in range(len(substring)-1)):
                    return True

        return False

    @staticmethod
    def _has_repeated_chars(password: str, length: int = 3) -> bool:
        """Check for repeated characters"""
        for i in range(len(password) - length + 1):
            substring = password[i:i+length]
            if len(set(substring)) == 1:  # All characters are the same
                return True
        return False

    @staticmethod
    def generate_strength_score(password: str) -> Tuple[int, str]:
        """
        Calculate password strength score

        Returns:
            (score_0_to_100, strength_label)
        """
        score = 0

        # Base score for length
        score += min(30, len(password) * 2)

        # Uppercase
        if re.search(r'[A-Z]', password):
            score += 10

        # Lowercase
        if re.search(r'[a-z]', password):
            score += 10

        # Numbers
        numbers = len(re.findall(r'\d', password))
        score += min(20, numbers * 5)

        # Special characters
        special = len(re.findall(r'[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/~`]', password))
        score += min(20, special * 5)

        # Variety bonus
        char_types = sum([
            bool(re.search(r'[A-Z]', password)),
            bool(re.search(r'[a-z]', password)),
            bool(re.search(r'\d', password)),
            bool(re.search(r'[^A-Za-z0-9]', password))
        ])
        if char_types >= 4:
            score += 10

        # Penalize common patterns
        if password.lower() in PasswordValidator.COMMON_PASSWORDS:
            score = min(score, 20)

        # Determine label
        if score < 40:
            label = "Weak"
        elif score < 60:
            label = "Fair"
        elif score < 80:
            label = "Good"
        else:
            label = "Strong"

        return (min(100, score), label)
```

#### 4.2 Update Registration Endpoint

```python
from app.core.security import PasswordValidator

# In RegisterRequest model
@field_validator('password')
def validate_password(cls, v):
    is_valid, errors = PasswordValidator.validate(v)
    if not is_valid:
        raise ValueError('\n'.join(errors))
    return v
```

#### 4.3 Frontend Password Strength Indicator

Create `apps/web/components/PasswordInput.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Eye, EyeOff, Check, X } from 'lucide-react';

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
}

interface ValidationRule {
  label: string;
  validator: (password: string) => boolean;
}

const PASSWORD_RULES: ValidationRule[] = [
  {
    label: 'At least 12 characters',
    validator: (p) => p.length >= 12,
  },
  {
    label: 'At least one uppercase letter',
    validator: (p) => /[A-Z]/.test(p),
  },
  {
    label: 'At least one lowercase letter',
    validator: (p) => /[a-z]/.test(p),
  },
  {
    label: 'At least 2 numbers',
    validator: (p) => (p.match(/\d/g) || []).length >= 2,
  },
  {
    label: 'At least one special character',
    validator: (p) => /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/~`]/.test(p),
  },
];

export default function PasswordInput({
  value,
  onChange,
  label = 'Password',
  placeholder = '••••••••••••',
  required = false,
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [strength, setStrength] = useState(0);
  const [strengthLabel, setStrengthLabel] = useState('');

  useEffect(() => {
    if (!value) {
      setStrength(0);
      setStrengthLabel('');
      return;
    }

    // Calculate strength
    let score = 0;

    // Length score (max 30 points)
    score += Math.min(30, value.length * 2);

    // Character type scores
    if (/[A-Z]/.test(value)) score += 10;
    if (/[a-z]/.test(value)) score += 10;
    score += Math.min(20, ((value.match(/\d/g) || []).length) * 5);
    score += Math.min(20, ((value.match(/[^A-Za-z0-9]/g) || []).length) * 5);

    // Variety bonus
    const charTypes = [
      /[A-Z]/.test(value),
      /[a-z]/.test(value),
      /\d/.test(value),
      /[^A-Za-z0-9]/.test(value),
    ].filter(Boolean).length;

    if (charTypes >= 4) score += 10;

    const finalScore = Math.min(100, score);
    setStrength(finalScore);

    if (finalScore < 40) setStrengthLabel('Weak');
    else if (finalScore < 60) setStrengthLabel('Fair');
    else if (finalScore < 80) setStrengthLabel('Good');
    else setStrengthLabel('Strong');
  }, [value]);

  const getStrengthColor = () => {
    if (strength < 40) return 'bg-red-500';
    if (strength < 60) return 'bg-orange-500';
    if (strength < 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStrengthTextColor = () => {
    if (strength < 40) return 'text-red-400';
    if (strength < 60) return 'text-orange-400';
    if (strength < 80) return 'text-yellow-400';
    return 'text-green-400';
  };

  return (
    <div className="space-y-2">
      <label className="block text-slate-300 text-sm font-medium">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>

      <div className="relative">
        <input
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 pr-12 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          placeholder={placeholder}
          required={required}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
        >
          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>

      {value && (
        <>
          {/* Strength Bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Password Strength:</span>
              <span className={`font-medium ${getStrengthTextColor()}`}>
                {strengthLabel}
              </span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${getStrengthColor()}`}
                style={{ width: `${strength}%` }}
              />
            </div>
          </div>

          {/* Validation Rules */}
          <div className="space-y-2 pt-2">
            {PASSWORD_RULES.map((rule, index) => {
              const isValid = rule.validator(value);
              return (
                <div
                  key={index}
                  className="flex items-center gap-2 text-xs"
                >
                  {isValid ? (
                    <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                  ) : (
                    <X className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  )}
                  <span className={isValid ? 'text-green-400' : 'text-slate-400'}>
                    {rule.label}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
```

---

## 5. Implementation Roadmap

### Phase 1: Email Fix (Week 1) - CRITICAL

**Priority: IMMEDIATE - This is blocking user registrations**

**Tasks:**
1. ✅ Implement Celery email tasks with retry logic
2. ✅ Update registration to use async email queue
3. ✅ Add email delivery logging
4. ✅ Set up monitoring dashboard
5. ✅ Test on production server

**Deliverables:**
- Users receive verification emails within seconds
- Failed emails retry automatically
- Email delivery is tracked and monitorable

### Phase 2: Domain Email (Week 2)

**Priority: HIGH - Improves deliverability and professionalism**

**Tasks:**
1. Sign up for Resend
2. Verify domain
3. Configure DNS records
4. Integrate Resend SDK
5. Test email deliverability
6. Monitor bounce rates

**Deliverables:**
- Emails sent from `noreply@yourdomain.com`
- SPF/DKIM/DMARC properly configured
- 95%+ deliverability rate

### Phase 3: Google OAuth (Week 3)

**Priority: MEDIUM - Improves UX but not blocking**

**Tasks:**
1. Create Google Cloud project
2. Add database migration for oauth_providers
3. Implement backend OAuth service
4. Create Google OAuth endpoints
5. Implement frontend Google Sign-In button
6. Test OAuth flow end-to-end
7. Add account linking UI

**Deliverables:**
- Users can sign in with Google
- Existing users can link Google account
- Passwordless authentication works

### Phase 4: Password Strength (Week 4)

**Priority: LOW - Security improvement**

**Tasks:**
1. Implement PasswordValidator class
2. Update registration validation
3. Create password strength UI component
4. Add password strength to change password flow
5. Show real-time feedback

**Deliverables:**
- Strong password requirements enforced
- Users see strength indicator
- Common passwords rejected

---

## Testing Checklist

### Email System
- [ ] Registration email arrives within 10 seconds
- [ ] Email retries on SMTP failure
- [ ] Email queue dashboard shows metrics
- [ ] Emails land in inbox (not spam)
- [ ] SPF/DKIM/DMARC pass (use mail-tester.com)
- [ ] Bounce handling works
- [ ] Email logs are created

### Google OAuth
- [ ] Google Sign-In button renders
- [ ] New user can register with Google
- [ ] Existing user can login with Google
- [ ] Existing user can link Google to account
- [ ] User can unlink Google (only if password set)
- [ ] Profile picture syncs from Google
- [ ] Email auto-verified for Google users
- [ ] Token refresh works

### Password Strength
- [ ] Weak passwords are rejected
- [ ] Common passwords are rejected
- [ ] Strength indicator updates in real-time
- [ ] All validation rules are checked
- [ ] Error messages are clear

---

## Environment Variables Summary

Add these to your production `.env`:

```bash
# Google OAuth
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCxxxxxxxxxxxxxxx
GOOGLE_REDIRECT_URI=https://yourdomain.com/api/auth/callback/google

# Email - Option A: Resend (Recommended)
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=Etsy Automation Platform

# Email - Option B: Direct SMTP (Not recommended)
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=587
SMTP_USER=noreply@yourdomain.com
SMTP_PASSWORD=xxxxxxxxxxxxx
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=Etsy Automation Platform

# Frontend
FRONTEND_URL=https://yourdomain.com
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com

# Auth
EMAIL_VERIFICATION_REQUIRED=true
VERIFICATION_TOKEN_EXPIRY_HOURS=24
```

---

## Cost Estimation

**Email Service (Resend):**
- Free: 100 emails/day (3,000/month)
- Pro: $20/month (50,000 emails)
- Business: $85/month (500,000 emails)

**Recommendation: Start with free tier**

**Google OAuth:**
- Free (unlimited authentications)

**Development Time:**
- Email Fix: 8-12 hours
- Domain Email: 4-6 hours
- Google OAuth: 12-16 hours
- Password Strength: 4-6 hours

**Total: ~40 hours of development**

---

This is your complete production-grade upgrade path. Let me know which phase you'd like to start with, and I'll provide more detailed implementation support!
