"""
Authentication API Endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, field_validator
from datetime import datetime

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.models.tenancy import User, Tenant, Membership

router = APIRouter()


# Request/Response Models
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    tenant_name: str

    @field_validator('password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if len(v) > 72:
            raise ValueError('Password must be less than 72 characters')
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str

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
    
    Returns JWT token for immediate login
    """
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == request.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create user
    user = User(
        email=request.email,
        password_hash=hash_password(request.password),
        name=request.name
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
    
    # Generate JWT token
    token = create_access_token(
        user_id=user.id,
        tenant_id=tenant.id,
        role='owner',
        shop_ids=[]  # No shops yet
    )
    
    return TokenResponse(
        access_token=token,
        expires_in=300,  # 5 minutes
        user={
            "id": user.id,
            "email": user.email,
            "name": user.name
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
    
    Returns JWT token for API access
    """
    # Find user
    user = db.query(User).filter(User.email == request.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Verify password
    if not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
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

    # Update last login
    user.last_login_at = datetime.utcnow()
    db.commit()

    # Generate JWT token
    token = create_access_token(
        user_id=user.id,
        tenant_id=membership.tenant_id,
        role=membership.role,
        shop_ids=shop_ids
    )

    return TokenResponse(
        access_token=token,
        expires_in=300,
        user={
            "id": user.id,
            "email": user.email,
            "name": user.name
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
        "tenant_id": current_user["tenant_id"],
        "role": current_user["role"]
    }