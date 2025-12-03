"""
Google OAuth Service
Handles Google OAuth authentication and user account creation/linking

Supports both:
- ID tokens (from GoogleLogin component)
- Access tokens (from useGoogleLogin hook with implicit flow)
"""
from google.oauth2 import id_token
from google.auth.transport import requests
from typing import Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
import logging
import httpx

from app.core.config import settings
from app.models.tenancy import User, Tenant, Membership
from app.models.oauth import OAuthProvider

logger = logging.getLogger(__name__)


class GoogleOAuthService:
    """Service for handling Google OAuth authentication"""

    @staticmethod
    def verify_google_token(token: str) -> Tuple[Optional[dict], Optional[str]]:
        """
        Verify Google token server-side and return user info
        
        Supports both ID tokens and access tokens:
        - ID tokens: Cryptographic verification via google-auth library
        - Access tokens: Verified by calling Google's userinfo endpoint
        
        Validates:
        - Token signature (ID token) or validity (access token)
        - Audience (aud) matches our client ID (ID token only)
        - Issuer (iss) is Google (ID token only)
        - Expiration (exp)
        - Email verification status

        Args:
            token: Google ID token or access token from frontend

        Returns:
            Tuple of (user_info_dict, error_message)
            - user_info_dict: Dict with user info or None if invalid
            - error_message: Error details or None if successful
        """
        # First, try to verify as an ID token
        try:
            idinfo = id_token.verify_oauth2_token(
                token,
                requests.Request(),
                settings.GOOGLE_CLIENT_ID
            )

            # Verify the issuer explicitly
            if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
                error_msg = f"Invalid token issuer: {idinfo['iss']}. Expected Google issuer."
                logger.warning(error_msg)
                return None, error_msg

            # Verify audience matches our client ID
            if idinfo.get('aud') != settings.GOOGLE_CLIENT_ID:
                error_msg = f"Token audience mismatch. Token not intended for this application."
                logger.warning(error_msg)
                return None, error_msg

            # Check email verification
            if not idinfo.get('email_verified', False):
                error_msg = "Email not verified by Google. Please use a verified Google account."
                logger.warning(f"Unverified email attempted: {idinfo.get('email')}")
                return None, error_msg

            # Extract user info
            user_info = {
                'google_id': idinfo['sub'],
                'email': idinfo['email'],
                'email_verified': idinfo.get('email_verified', False),
                'name': idinfo.get('name'),
                'picture': idinfo.get('picture'),
                'given_name': idinfo.get('given_name'),
                'family_name': idinfo.get('family_name'),
            }
            
            logger.info(f"Google ID token verified successfully for: {user_info['email']}")
            return user_info, None

        except ValueError as e:
            # ID token validation failed - might be an access token
            logger.debug(f"ID token validation failed, trying as access token: {str(e)}")
            return GoogleOAuthService._verify_access_token(token)
        except Exception as e:
            # Try as access token
            logger.debug(f"ID token verification error, trying as access token: {str(e)}")
            return GoogleOAuthService._verify_access_token(token)

    @staticmethod
    def _verify_access_token(token: str) -> Tuple[Optional[dict], Optional[str]]:
        """
        Verify Google access token by calling Google's userinfo endpoint
        
        Args:
            token: Google access token
            
        Returns:
            Tuple of (user_info_dict, error_message)
        """
        try:
            # Call Google's userinfo endpoint to verify the access token
            with httpx.Client() as client:
                response = client.get(
                    'https://www.googleapis.com/oauth2/v3/userinfo',
                    headers={'Authorization': f'Bearer {token}'}
                )
                
                if response.status_code != 200:
                    error_msg = f"Invalid access token: Google returned {response.status_code}"
                    logger.warning(error_msg)
                    return None, error_msg
                
                userinfo = response.json()
            
            # Check email verification
            if not userinfo.get('email_verified', False):
                error_msg = "Email not verified by Google. Please use a verified Google account."
                logger.warning(f"Unverified email attempted: {userinfo.get('email')}")
                return None, error_msg
            
            # Extract user info
            user_info = {
                'google_id': userinfo['sub'],
                'email': userinfo['email'],
                'email_verified': userinfo.get('email_verified', False),
                'name': userinfo.get('name'),
                'picture': userinfo.get('picture'),
                'given_name': userinfo.get('given_name'),
                'family_name': userinfo.get('family_name'),
            }
            
            logger.info(f"Google access token verified successfully for: {user_info['email']}")
            return user_info, None
            
        except httpx.RequestError as e:
            error_msg = f"Failed to verify Google token: Network error - {str(e)}"
            logger.error(error_msg)
            return None, error_msg
        except Exception as e:
            error_msg = f"Failed to verify Google token: {str(e)}"
            logger.error(error_msg)
            return None, error_msg

    @staticmethod
    def get_or_create_user(
        db: Session,
        google_user_info: dict,
        tenant_name: Optional[str] = None
    ) -> Tuple[User, bool, Optional[Tenant]]:
        """
        Get existing user or create new user from Google info

        Args:
            db: Database session
            google_user_info: User info from Google
            tenant_name: Optional tenant name for new users

        Returns:
            Tuple of (User, is_new_user, Tenant)
        """
        google_id = google_user_info['google_id']
        email = google_user_info['email']

        # Check if OAuth provider already exists
        oauth_provider = db.query(OAuthProvider).filter(
            OAuthProvider.provider == 'google',
            OAuthProvider.provider_user_id == google_id
        ).first()

        if oauth_provider:
            # User exists, return it
            user = oauth_provider.user
            # Update OAuth provider info
            oauth_provider.email = email
            oauth_provider.name = google_user_info.get('name')
            oauth_provider.picture = google_user_info.get('picture')
            oauth_provider.updated_at = datetime.utcnow()
            db.commit()
            return user, False, None

        # Check if user with this email already exists
        existing_user = db.query(User).filter(User.email == email).first()

        if existing_user:
            # Link Google account to existing user
            new_oauth_provider = OAuthProvider(
                user_id=existing_user.id,
                provider='google',
                provider_user_id=google_id,
                email=email,
                name=google_user_info.get('name'),
                picture=google_user_info.get('picture')
            )
            db.add(new_oauth_provider)

            # Mark email as verified if Google verified it
            if google_user_info.get('email_verified'):
                existing_user.email_verified = True

            # Update profile picture if not set
            if not existing_user.profile_picture_url and google_user_info.get('picture'):
                existing_user.profile_picture_url = google_user_info.get('picture')

            db.commit()
            return existing_user, False, None

        # Create new user
        new_user = User(
            email=email,
            name=google_user_info.get('name'),
            email_verified=google_user_info.get('email_verified', False),
            profile_picture_url=google_user_info.get('picture'),
            password_hash=None  # OAuth user, no password
        )
        db.add(new_user)
        db.flush()  # Get the user ID

        # Create OAuth provider record
        new_oauth_provider = OAuthProvider(
            user_id=new_user.id,
            provider='google',
            provider_user_id=google_id,
            email=email,
            name=google_user_info.get('name'),
            picture=google_user_info.get('picture')
        )
        db.add(new_oauth_provider)

        # Create tenant for new users (auto-generate name if not provided)
        tenant = None
        if not tenant_name:
            # Auto-generate tenant name from user's name or email
            if google_user_info.get('name'):
                tenant_name = f"{google_user_info.get('name')}'s Shop"
            else:
                # Use email username as fallback
                email_username = email.split('@')[0]
                tenant_name = f"{email_username}'s Shop"
        
        tenant = Tenant(
            name=tenant_name,
            billing_tier='starter',
            status='active'
        )
        db.add(tenant)
        db.flush()  # Get the tenant ID

        # Create membership (owner role for new tenant)
        membership = Membership(
            user_id=new_user.id,
            tenant_id=tenant.id,
            role='owner',
            invitation_status='accepted',
            accepted_at=datetime.utcnow()
        )
        db.add(membership)

        db.commit()
        return new_user, True, tenant

    @staticmethod
    def authenticate_with_google(
        db: Session,
        google_token: str,
        tenant_name: Optional[str] = None
    ) -> Tuple[Optional[User], Optional[str], Optional[Tenant], Optional[bool]]:
        """
        Authenticate user with Google token (server-side verification)

        Args:
            db: Database session
            google_token: Google ID token from frontend
            tenant_name: Optional tenant name for new users

        Returns:
            Tuple of (User, error_message, Tenant, is_new_user)
        """
        # Verify Google token server-side
        google_user_info, verification_error = GoogleOAuthService.verify_google_token(google_token)

        if verification_error:
            logger.warning(f"Google authentication failed: {verification_error}")
            return None, f"Google authentication failed: {verification_error}", None, None

        if not google_user_info:
            error_msg = "Invalid Google token. Please try signing in again."
            logger.error(error_msg)
            return None, error_msg, None, None

        try:
            # Get or create user (handles account linking)
            user, is_new_user, tenant = GoogleOAuthService.get_or_create_user(
                db,
                google_user_info,
                tenant_name
            )

            # Update last login timestamp
            user.last_login_at = datetime.utcnow()
            user.failed_login_attempts = 0
            user.locked_until = None
            db.commit()

            log_action = "New user registered" if is_new_user else "Existing user logged in"
            logger.info(f"{log_action} via Google OAuth: {user.email} (Google ID: {google_user_info['google_id']})")

            return user, None, tenant, is_new_user

        except Exception as e:
            error_msg = f"Database error during Google authentication: {str(e)}"
            logger.error(error_msg, exc_info=True)
            db.rollback()
            return None, "Authentication failed due to a server error. Please try again.", None, None
