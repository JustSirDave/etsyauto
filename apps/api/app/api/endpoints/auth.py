"""
Authentication API Endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, field_validator
from datetime import datetime, timedelta, timezone
from typing import Set, Optional
import os
import uuid
from PIL import Image
import io

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.core.email import generate_token, send_verification_email, send_password_reset_email, send_password_changed_notification
from app.core.config import settings
from app.models.tenancy import User, Tenant, Membership

router = APIRouter()


# List of disposable/temporary email domains to block
DISPOSABLE_EMAIL_DOMAINS: Set[str] = {
    'tempmail.com', 'throwaway.email', '10minutemail.com', 'guerrillamail.com',
    'mailinator.com', 'maildrop.cc', 'temp-mail.org', 'yopmail.com',
    'trashmail.com', 'fakeinbox.com', 'getnada.com', 'sharklasers.com',
    'spam4.me', 'mytemp.email', 'temp-mail.io', 'mohmal.com',
    'mintemail.com', 'emailondeck.com', 'dispostable.com', 'throwawaymail.com'
}


def validate_email_domain(email: str) -> bool:
    """
    Validate email domain exists and is not disposable

    Args:
        email: Email address to validate

    Returns:
        True if valid, False otherwise

    Raises:
        ValueError: If email is invalid
    """
    # Extract domain
    domain = email.split('@')[1].lower()

    # Check if disposable email
    if domain in DISPOSABLE_EMAIL_DOMAINS:
        raise ValueError(f'Disposable email addresses are not allowed')

    # Optional: Check if domain has MX records (uncomment to enable)
    # try:
    #     dns.resolver.resolve(domain, 'MX')
    # except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.exception.Timeout):
    #     raise ValueError(f'Email domain does not exist or has no mail server')

    return True


# Request/Response Models
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    tenant_name: str

    @field_validator('email')
    def validate_email(cls, v):
        """Validate email format and domain"""
        email_str = str(v).lower()

        # Additional format checks
        if '..' in email_str:
            raise ValueError('Email cannot contain consecutive dots')
        if email_str.startswith('.') or email_str.endswith('.'):
            raise ValueError('Email cannot start or end with a dot')

        # Validate domain
        validate_email_domain(email_str)

        return email_str

    @field_validator('password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if len(v) > 72:
            raise ValueError('Password must be less than 72 characters')
        return v

    @field_validator('name')
    def validate_name(cls, v):
        if len(v.strip()) < 2:
            raise ValueError('Name must be at least 2 characters')
        if len(v) > 100:
            raise ValueError('Name must be less than 100 characters')
        return v.strip()

    @field_validator('tenant_name')
    def validate_tenant_name(cls, v):
        if len(v.strip()) < 2:
            raise ValueError('Company/Shop name must be at least 2 characters')
        if len(v) > 100:
            raise ValueError('Company/Shop name must be less than 100 characters')
        return v.strip()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    remember_me: bool = False

    @field_validator('password')
    def validate_password(cls, v):
        if len(v) > 72:
            raise ValueError('Password must be less than 72 characters')
        return v


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict
    tenant: dict


@router.post("/register", response_model=TokenResponse, tags=["Auth"])
async def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """
    Register a new user

    Creates:
    - New user account
    - Personal tenant (organization)
    - Owner membership
    - Sends email verification link

    Returns JWT token for immediate login
    """
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == request.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Generate verification token
    verification_token = generate_token()
    verification_expires = datetime.now(timezone.utc) + timedelta(hours=settings.VERIFICATION_TOKEN_EXPIRY_HOURS)

    # Create user
    user = User(
        email=request.email,
        password_hash=hash_password(request.password),
        name=request.name,
        email_verified=not settings.EMAIL_VERIFICATION_REQUIRED,  # Auto-verify if not required
        verification_token=verification_token if settings.EMAIL_VERIFICATION_REQUIRED else None,
        verification_token_expires=verification_expires if settings.EMAIL_VERIFICATION_REQUIRED else None
    )
    db.add(user)
    db.flush()  # Get user.id without committing

    # Create personal tenant (organization)
    tenant = Tenant(
        name=request.tenant_name,
        billing_tier='starter',
        status='active'
    )
    db.add(tenant)
    db.flush()

    # Create membership (owner role)
    membership = Membership(
        user_id=user.id,
        tenant_id=tenant.id,
        role='owner'
    )
    db.add(membership)

    db.commit()
    db.refresh(user)
    db.refresh(tenant)

    # Send verification email
    if settings.EMAIL_VERIFICATION_REQUIRED:
        send_verification_email(user.email, user.name, verification_token)
        # Return 202 Accepted - account created but requires email verification
        raise HTTPException(
            status_code=status.HTTP_202_ACCEPTED,
            detail="Account created successfully! Please check your email to verify your account before logging in."
        )

    # Only generate token if email verification is not required
    token = create_access_token(
        user_id=user.id,
        tenant_id=tenant.id,
        role='owner',
        shop_ids=[],  # No shops yet
        remember_me=False
    )

    return TokenResponse(
        access_token=token,
        expires_in=settings.JWT_TTL_SECONDS,
        user={
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "email_verified": user.email_verified
        },
        tenant={
            "id": tenant.id,
            "name": tenant.name,
            "role": "owner"
        }
    )


@router.post("/login", response_model=TokenResponse, tags=["Auth"])
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """
    Login with email and password

    Supports:
    - Account lockout after failed attempts
    - Email verification check
    - Remember me for extended sessions

    Returns JWT token for API access
    """
    # Find user
    user = db.query(User).filter(User.email == request.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Check if account is locked
    if user.locked_until and user.locked_until > datetime.now(timezone.utc):
        minutes_left = int((user.locked_until - datetime.now(timezone.utc)).total_seconds() / 60)
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Account is locked. Try again in {minutes_left} minute(s)"
        )

    # Verify password
    if not verify_password(request.password, user.password_hash):
        # Increment failed login attempts
        user.failed_login_attempts += 1

        # Lock account if max attempts reached
        if user.failed_login_attempts >= settings.MAX_LOGIN_ATTEMPTS:
            user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCOUNT_LOCKOUT_MINUTES)
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=f"Account locked due to too many failed login attempts. Try again in {settings.ACCOUNT_LOCKOUT_MINUTES} minutes"
            )

        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Check email verification (optional - can be warning only)
    if settings.EMAIL_VERIFICATION_REQUIRED and not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email address before logging in. Check your inbox for the verification link."
        )

    # Get user's tenant and role
    membership = db.query(Membership).filter(Membership.user_id == user.id).first()
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User has no organization membership"
        )

    # Get tenant info
    tenant = db.query(Tenant).filter(Tenant.id == membership.tenant_id).first()

    # Get user's shops (empty for now)
    shop_ids = []

    # Reset failed login attempts and update last login
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()

    # Generate JWT token with remember_me support
    token = create_access_token(
        user_id=user.id,
        tenant_id=membership.tenant_id,
        role=membership.role,
        shop_ids=shop_ids,
        remember_me=request.remember_me
    )

    # Calculate token expiry
    if request.remember_me:
        expires_in = settings.REMEMBER_ME_TTL_DAYS * 24 * 60 * 60  # Days to seconds
    else:
        expires_in = settings.JWT_TTL_SECONDS

    return TokenResponse(
        access_token=token,
        expires_in=expires_in,
        user={
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "email_verified": user.email_verified
        },
        tenant={
            "id": tenant.id,
            "name": tenant.name,
            "role": membership.role
        }
    )


@router.post("/logout", tags=["Auth"])
async def logout():
    """
    Logout (client-side token removal)
    
    Since JWT is stateless, logout is handled by client
    removing the token from storage
    """
    return {"message": "Logged out successfully"}


@router.get("/me", tags=["Auth"])
async def get_current_user_info(current_user = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Get current authenticated user info

    Requires: Valid JWT token
    """
    user = db.query(User).filter(User.id == int(current_user["sub"])).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "email_verified": user.email_verified,
        "profile_picture_url": user.profile_picture_url,
        "tenant_id": current_user["tenant_id"],
        "role": current_user["role"]
    }


# Email Verification Endpoints

@router.post("/verify-email", tags=["Auth"])
async def verify_email(token: str, db: Session = Depends(get_db)):
    """
    Verify user email address with token

    Args:
        token: Verification token from email

    Returns:
        Success message
    """
    # Find user with this verification token
    user = db.query(User).filter(User.verification_token == token).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification token"
        )

    # Check if token expired
    if user.verification_token_expires and user.verification_token_expires < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification token has expired. Please request a new one."
        )

    # Mark email as verified
    user.email_verified = True
    user.verification_token = None
    user.verification_token_expires = None
    db.commit()

    return {
        "message": "Email verified successfully",
        "email": user.email
    }


@router.post("/resend-verification", tags=["Auth"])
async def resend_verification_email(email: EmailStr, db: Session = Depends(get_db)):
    """
    Resend verification email

    Args:
        email: User's email address

    Returns:
        Success message
    """
    user = db.query(User).filter(User.email == email).first()

    if not user:
        # Don't reveal if email exists
        return {"message": "If the email exists, a verification link has been sent"}

    if user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already verified"
        )

    # Generate new verification token
    verification_token = generate_token()
    verification_expires = datetime.now(timezone.utc) + timedelta(hours=settings.VERIFICATION_TOKEN_EXPIRY_HOURS)

    user.verification_token = verification_token
    user.verification_token_expires = verification_expires
    db.commit()

    # Send verification email
    send_verification_email(user.email, user.name, verification_token)

    return {"message": "Verification email sent"}


# Password Reset Endpoints

class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator('new_password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if len(v) > 72:
            raise ValueError('Password must be less than 72 characters')
        return v


@router.post("/forgot-password", tags=["Auth"])
async def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """
    Request password reset link

    Args:
        request: Email address

    Returns:
        Success message (always, for security)
    """
    user = db.query(User).filter(User.email == request.email).first()

    if user:
        # Generate reset token
        reset_token = generate_token()
        reset_expires = datetime.now(timezone.utc) + timedelta(hours=settings.RESET_TOKEN_EXPIRY_HOURS)

        user.reset_token = reset_token
        user.reset_token_expires = reset_expires
        db.commit()

        # Send password reset email
        send_password_reset_email(user.email, user.name, reset_token)

    # Always return success to prevent email enumeration
    return {
        "message": "If the email exists, a password reset link has been sent"
    }


@router.post("/reset-password", tags=["Auth"])
async def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    """
    Reset password with token

    Args:
        request: Reset token and new password

    Returns:
        Success message
    """
    # Find user with this reset token
    user = db.query(User).filter(User.reset_token == request.token).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset token"
        )

    # Check if token expired
    if user.reset_token_expires and user.reset_token_expires < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired. Please request a new one."
        )

    # Update password
    user.password_hash = hash_password(request.new_password)
    user.reset_token = None
    user.reset_token_expires = None

    # Reset failed login attempts and unlock account
    user.failed_login_attempts = 0
    user.locked_until = None

    db.commit()

    # Send notification email
    send_password_changed_notification(user.email, user.name)

    return {
        "message": "Password reset successfully",
        "email": user.email
    }


# Profile Picture Upload

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB in bytes


@router.post("/profile/upload-picture", tags=["Auth"])
async def upload_profile_picture(
    file: UploadFile = File(...),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload profile picture for current user

    Requirements:
    - Valid JWT token
    - Image file (JPEG, PNG, GIF, WebP)
    - Max size: 5MB

    Returns:
        Profile picture URL
    """
    # Validate file type
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed types: {', '.join(ALLOWED_IMAGE_TYPES)}"
        )

    # Read file content
    contents = await file.read()

    # Validate file size
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds maximum of {MAX_FILE_SIZE / (1024 * 1024)}MB"
        )

    try:
        # Validate it's actually an image and get dimensions
        image = Image.open(io.BytesIO(contents))
        image.verify()

        # Reopen for processing (verify() closes the file)
        image = Image.open(io.BytesIO(contents))

        # Create thumbnail (150x150)
        thumbnail_size = (150, 150)
        image.thumbnail(thumbnail_size, Image.Resampling.LANCZOS)

        # Generate unique filename
        file_extension = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
        unique_filename = f"{uuid.uuid4()}.{file_extension}"

        # Create uploads directory if it doesn't exist
        upload_dir = "uploads/profile-pictures"
        os.makedirs(upload_dir, exist_ok=True)

        # Save thumbnail
        file_path = os.path.join(upload_dir, unique_filename)
        image.save(file_path, optimize=True, quality=85)

        # Generate URL (this would be different if using S3)
        # For now, using local path - in production, upload to S3 and get URL
        profile_picture_url = f"/uploads/profile-pictures/{unique_filename}"

        # Update user's profile picture URL
        user = db.query(User).filter(User.id == int(current_user["sub"])).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Delete old profile picture file if it exists and is local
        if user.profile_picture_url and user.profile_picture_url.startswith("/uploads/"):
            old_file_path = user.profile_picture_url.lstrip("/")
            if os.path.exists(old_file_path):
                try:
                    os.remove(old_file_path)
                except Exception:
                    pass  # Ignore errors deleting old file

        user.profile_picture_url = profile_picture_url
        db.commit()

        return {
            "message": "Profile picture uploaded successfully",
            "profile_picture_url": profile_picture_url
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid image file: {str(e)}"
        )


@router.delete("/profile/delete-picture", tags=["Auth"])
async def delete_profile_picture(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete profile picture for current user

    Requires: Valid JWT token
    """
    user = db.query(User).filter(User.id == int(current_user["sub"])).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.profile_picture_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No profile picture to delete"
        )

    # Delete file if it's local
    if user.profile_picture_url.startswith("/uploads/"):
        file_path = user.profile_picture_url.lstrip("/")
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass  # Ignore errors deleting file

    user.profile_picture_url = None
    db.commit()

    return {"message": "Profile picture deleted successfully"}