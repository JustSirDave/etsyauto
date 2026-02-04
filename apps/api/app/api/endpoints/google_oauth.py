"""
Google OAuth Endpoints
Handle Google OAuth authentication flow
"""
from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Optional

from ...core.database import get_db
from ...models.tenancy import User, Membership, Tenant
from ...services.google_oauth import google_oauth_service
from ...core.security import create_access_token
from ...core.config import settings

router = APIRouter()


class GoogleAuthRequest(BaseModel):
    """Request to initiate Google OAuth"""
    invitation_token: Optional[str] = None


class GoogleCallbackRequest(BaseModel):
    """Google OAuth callback data"""
    code: str
    state: str


@router.post("/google/auth")
async def google_auth(
    request: GoogleAuthRequest,
    db: Session = Depends(get_db)
):
    """
    Initiate Google OAuth flow
    
    Returns authorization URL to redirect user to
    """
    # Generate state for CSRF protection
    state = google_oauth_service.generate_state()
    
    # Get authorization URL
    auth_url = google_oauth_service.get_authorization_url(
        state=state,
        invitation_token=request.invitation_token
    )
    
    return {
        "auth_url": auth_url,
        "state": state
    }


@router.post("/google/callback")
async def google_callback(
    request: GoogleCallbackRequest,
    db: Session = Depends(get_db)
):
    """
    Handle Google OAuth callback
    
    Exchanges code for token, gets user info, and creates/updates user
    """
    try:
        # Exchange code for access token
        token_response = await google_oauth_service.exchange_code_for_token(request.code)
        access_token = token_response.get("access_token")
        
        if not access_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to get access token from Google"
            )
        
        # Get user info from Google
        user_info = await google_oauth_service.get_user_info(access_token)
        
        email = user_info.get("email")
        name = user_info.get("name")
        picture = user_info.get("picture")
        google_user_id = user_info.get("id")
        
        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email not provided by Google"
            )
        
        # Parse state to check for invitation token
        state_parts = request.state.split(":")
        state = state_parts[0]
        invitation_token = state_parts[1] if len(state_parts) > 1 else None
        
        # Check if user exists
        user = db.query(User).filter(User.email == email).first()
        
        if user:
            # Update existing user with OAuth info
            user.oauth_provider = "google"
            user.oauth_provider_user_id = google_user_id
            user.profile_picture_url = picture or user.profile_picture_url
            user.name = name or user.name
            user.email_verified = True  # Google emails are already verified
            user.last_login_at = datetime.now(timezone.utc)
        else:
            # Create new user with OAuth
            user = User(
                email=email,
                name=name,
                profile_picture_url=picture,
                oauth_provider="google",
                oauth_provider_user_id=google_user_id,
                email_verified=True,
                password_hash=None,  # No password for OAuth users
                created_at=datetime.now(timezone.utc)
            )
            db.add(user)
            db.flush()  # Get user ID
        
        # Handle invitation if token provided
        if invitation_token:
            membership = db.query(Membership).filter(
                Membership.invitation_token == invitation_token,
                Membership.invitation_status == 'pending',
                Membership.user_id == user.id
            ).first()
            
            if membership:
                # Accept invitation
                membership.invitation_status = 'accepted'
                membership.accepted_at = datetime.now(timezone.utc)
                membership.invitation_token = None
                membership.invitation_token_expires = None
                
                # Get tenant info for response
                tenant = db.query(Tenant).filter(Tenant.id == membership.tenant_id).first()
                
                db.commit()
                
                # Create JWT token
                jwt_token = create_access_token(
                    user_id=user.id,
                    tenant_id=membership.tenant_id,
                    role=membership.role,
                    email=user.email,
                    name=user.name or "",
                    shop_ids=membership.allowed_shop_ids or [],
                    remember_me=True
                )
                
                # Redirect to frontend with token
                redirect_url = f"{settings.FRONTEND_URL}/login?token={jwt_token}&invitation_accepted=true"
                return RedirectResponse(url=redirect_url, status_code=302)
        
        # If no invitation or user already has memberships
        # Find user's primary membership
        membership = db.query(Membership).filter(
            Membership.user_id == user.id,
            Membership.invitation_status == 'accepted'
        ).first()
        
        if membership:
            db.commit()
            
            # Create JWT token
            jwt_token = create_access_token(
                user_id=user.id,
                tenant_id=membership.tenant_id,
                role=membership.role,
                email=user.email,
                name=user.name or "",
                shop_ids=membership.allowed_shop_ids or [],
                remember_me=True
            )
            
            # Redirect to frontend with token
            redirect_url = f"{settings.FRONTEND_URL}/login?token={jwt_token}"
            return RedirectResponse(url=redirect_url, status_code=302)
        else:
            # User exists but has no memberships and no invitation
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No organization membership found. Please use an invitation link."
            )
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OAuth authentication failed: {str(e)}"
        )
